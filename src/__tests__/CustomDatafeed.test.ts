import { describe, it, expect, vi, beforeEach } from 'vitest'
import CustomDatafeed from '../CustomDatafeed'
import type { SymbolInfo, Period } from '../types'

const makeSymbol = (ticker = 'BTCUSDT'): SymbolInfo => ({
  ticker,
  name: `${ticker} Test`,
  shortName: ticker,
  exchange: 'Test',
  market: 'test',
  pricePrecision: 2,
  volumePrecision: 0
})

const makeCandle = (ts: number, price = 100) => ({
  timestamp: ts,
  open: price,
  high: price + 10,
  low: price - 10,
  close: price + 5,
  volume: 1000
})

const period: Period = { span: 1, type: 'minute', text: '1m' }

describe('CustomDatafeed', () => {
  let feed: CustomDatafeed

  beforeEach(() => {
    feed = new CustomDatafeed()
  })

  describe('setData / hasData', () => {
    it('stores candles for a symbol', () => {
      const sym = makeSymbol()
      expect(feed.hasData(sym.ticker)).toBe(false)

      feed.setData(sym, [makeCandle(1000), makeCandle(2000)])
      expect(feed.hasData(sym.ticker)).toBe(true)
      expect(feed.hasData()).toBe(true)
    })

    it('sorts candles by timestamp ascending', async () => {
      const sym = makeSymbol()
      feed.setData(sym, [makeCandle(3000), makeCandle(1000), makeCandle(2000)])

      const result = await feed.getHistoryKLineData(sym, period, 0, 999999)
      expect(result.map(c => c.timestamp)).toEqual([1000, 2000, 3000])
    })

    it('stores multiple symbols independently', () => {
      const btc = makeSymbol('BTCUSDT')
      const eth = makeSymbol('ETHUSDT')

      feed.setData(btc, [makeCandle(1000)])
      feed.setData(eth, [makeCandle(2000)])

      expect(feed.hasData('BTCUSDT')).toBe(true)
      expect(feed.hasData('ETHUSDT')).toBe(true)
    })
  })

  describe('getHistoryKLineData', () => {
    it('returns candles within the from/to range', async () => {
      const sym = makeSymbol()
      feed.setData(sym, [
        makeCandle(1000),
        makeCandle(2000),
        makeCandle(3000),
        makeCandle(4000)
      ])

      const result = await feed.getHistoryKLineData(sym, period, 2000, 3000)
      expect(result).toHaveLength(2)
      expect(result[0].timestamp).toBe(2000)
      expect(result[1].timestamp).toBe(3000)
    })

    it('returns empty array for unknown symbol', async () => {
      const sym = makeSymbol('UNKNOWN')
      const result = await feed.getHistoryKLineData(sym, period, 0, 99999)
      expect(result).toEqual([])
    })

    it('returns empty array when symbol has no data', async () => {
      const sym = makeSymbol()
      feed.setData(sym, [])
      const result = await feed.getHistoryKLineData(sym, period, 0, 99999)
      expect(result).toEqual([])
    })

    it('returns all data when from/to range does not intersect stored candles', async () => {
      const sym = makeSymbol()
      // Store candles with old timestamps
      feed.setData(sym, [
        makeCandle(1000),
        makeCandle(2000),
        makeCandle(3000)
      ])
      // Request a range far in the future (simulates wall-clock-based range)
      const result = await feed.getHistoryKLineData(sym, period, 9_000_000, 10_000_000)
      expect(result).toHaveLength(3)
      expect(result[0].timestamp).toBe(1000)
      expect(result[2].timestamp).toBe(3000)
    })
  })

  describe('pushUpdate', () => {
    it('fires the subscription callback', () => {
      const sym = makeSymbol()
      const callback = vi.fn()

      feed.setData(sym, [makeCandle(1000)])
      feed.subscribe(sym, period, callback)

      const update = makeCandle(2000, 200)
      feed.pushUpdate(sym.ticker, update)

      expect(callback).toHaveBeenCalledOnce()
      expect(callback).toHaveBeenCalledWith(update)
    })

    it('appends new candle to stored data', async () => {
      const sym = makeSymbol()
      feed.setData(sym, [makeCandle(1000)])
      feed.subscribe(sym, period, vi.fn())

      feed.pushUpdate(sym.ticker, makeCandle(2000))

      const result = await feed.getHistoryKLineData(sym, period, 0, 99999)
      expect(result).toHaveLength(2)
    })

    it('updates last candle in-place when timestamps match', async () => {
      const sym = makeSymbol()
      feed.setData(sym, [makeCandle(1000, 100)])
      feed.subscribe(sym, period, vi.fn())

      const updated = makeCandle(1000, 200)
      feed.pushUpdate(sym.ticker, updated)

      const result = await feed.getHistoryKLineData(sym, period, 0, 99999)
      expect(result).toHaveLength(1)
      expect(result[0].open).toBe(200)
    })

    it('does nothing when no subscription exists', () => {
      const sym = makeSymbol()
      feed.setData(sym, [makeCandle(1000)])
      // No subscribe call — should not throw
      expect(() => feed.pushUpdate(sym.ticker, makeCandle(2000))).not.toThrow()
    })
  })

  describe('clearData', () => {
    it('clears a specific symbol', () => {
      const btc = makeSymbol('BTCUSDT')
      const eth = makeSymbol('ETHUSDT')

      feed.setData(btc, [makeCandle(1000)])
      feed.setData(eth, [makeCandle(2000)])

      feed.clearData('BTCUSDT')
      expect(feed.hasData('BTCUSDT')).toBe(false)
      expect(feed.hasData('ETHUSDT')).toBe(true)
    })

    it('clears all symbols when no ticker given', () => {
      feed.setData(makeSymbol('BTCUSDT'), [makeCandle(1000)])
      feed.setData(makeSymbol('ETHUSDT'), [makeCandle(2000)])

      feed.clearData()
      expect(feed.hasData()).toBe(false)
    })
  })

  describe('subscribe / unsubscribe', () => {
    it('stops firing callback after unsubscribe', () => {
      const sym = makeSymbol()
      const callback = vi.fn()

      feed.setData(sym, [makeCandle(1000)])
      feed.subscribe(sym, period, callback)
      feed.unsubscribe(sym, period)

      feed.pushUpdate(sym.ticker, makeCandle(2000))
      expect(callback).not.toHaveBeenCalled()
    })
  })

  describe('searchSymbols', () => {
    it('returns all symbols when no search term', async () => {
      feed.setData(makeSymbol('BTCUSDT'), [makeCandle(1000)])
      feed.setData(makeSymbol('ETHUSDT'), [makeCandle(2000)])

      const results = await feed.searchSymbols()
      expect(results).toHaveLength(2)
    })

    it('filters symbols by search term', async () => {
      feed.setData(makeSymbol('BTCUSDT'), [makeCandle(1000)])
      feed.setData(makeSymbol('ETHUSDT'), [makeCandle(2000)])

      const results = await feed.searchSymbols('btc')
      expect(results).toHaveLength(1)
      expect(results[0].ticker).toBe('BTCUSDT')
    })
  })

  describe('getLoadedSymbols', () => {
    it('returns list of all loaded symbol infos', () => {
      const btc = makeSymbol('BTCUSDT')
      const eth = makeSymbol('ETHUSDT')

      feed.setData(btc, [makeCandle(1000)])
      feed.setData(eth, [makeCandle(2000)])

      const loaded = feed.getLoadedSymbols()
      expect(loaded).toHaveLength(2)
      expect(loaded.map(s => s.ticker).sort()).toEqual(['BTCUSDT', 'ETHUSDT'])
    })
  })

  describe('timeframe aggregation', () => {
    const basePeriod: Period = { span: 1, type: 'minute', text: '1m' }
    const fiveMin: Period = { span: 5, type: 'minute', text: '5m' }
    const oneHour: Period = { span: 1, type: 'hour', text: '1H' }

    const make1mCandles = (count: number, baseTs = 0) =>
      Array.from({ length: count }, (_, i) => makeCandle(baseTs + i * 60_000, 100 + i))

    it('aggregates candles when base period is set and higher period requested', async () => {
      const sym = makeSymbol()
      const candles = make1mCandles(10)
      feed.setData(sym, candles, basePeriod)

      const result = await feed.getHistoryKLineData(sym, fiveMin, 0, 999999)
      expect(result).toHaveLength(2) // 10 × 1m → 2 × 5m
    })

    it('returns candles unchanged when requested period equals base period', async () => {
      const sym = makeSymbol()
      const candles = make1mCandles(5)
      feed.setData(sym, candles, basePeriod)

      const result = await feed.getHistoryKLineData(sym, basePeriod, 0, 999999)
      expect(result).toHaveLength(5)
    })

    it('does not aggregate when no base period is set', async () => {
      const sym = makeSymbol()
      const candles = make1mCandles(10)
      feed.setData(sym, candles) // no base period

      const result = await feed.getHistoryKLineData(sym, fiveMin, 0, 999999)
      expect(result).toHaveLength(10) // returned as-is
    })

    it('setBasePeriod works independently of setData', async () => {
      const sym = makeSymbol()
      const candles = make1mCandles(60)
      feed.setData(sym, candles)
      feed.setBasePeriod(sym.ticker, basePeriod)

      const result = await feed.getHistoryKLineData(sym, oneHour, 0, 999999)
      expect(result).toHaveLength(1) // 60 × 1m → 1 × 1H
    })

    it('getBasePeriod returns the stored base period', () => {
      const sym = makeSymbol()
      feed.setData(sym, [makeCandle(1000)], basePeriod)
      expect(feed.getBasePeriod(sym.ticker)).toEqual(basePeriod)
    })

    it('clearData removes base period', () => {
      const sym = makeSymbol()
      feed.setData(sym, [makeCandle(1000)], basePeriod)
      feed.clearData(sym.ticker)
      expect(feed.getBasePeriod(sym.ticker)).toBeUndefined()
    })
  })
})

