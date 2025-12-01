/**
 * Binance Datafeed for KLineCharts Pro
 * Free real-time crypto data - no API key required
 */

import { KLineData } from 'klinecharts'

import { Datafeed, SymbolInfo, Period, DatafeedSubscribeCallback } from './types'

const BINANCE_API = 'https://api.binance.com/api/v3'
const BINANCE_WS = 'wss://stream.binance.com:9443/ws'

// Popular trading pairs
const SYMBOLS: SymbolInfo[] = [
  { ticker: 'BTCUSDT', name: 'Bitcoin / USDT', shortName: 'BTC', exchange: 'Binance', market: 'crypto', pricePrecision: 2, volumePrecision: 5 },
  { ticker: 'ETHUSDT', name: 'Ethereum / USDT', shortName: 'ETH', exchange: 'Binance', market: 'crypto', pricePrecision: 2, volumePrecision: 4 },
  { ticker: 'BNBUSDT', name: 'BNB / USDT', shortName: 'BNB', exchange: 'Binance', market: 'crypto', pricePrecision: 2, volumePrecision: 3 },
  { ticker: 'SOLUSDT', name: 'Solana / USDT', shortName: 'SOL', exchange: 'Binance', market: 'crypto', pricePrecision: 2, volumePrecision: 3 },
  { ticker: 'XRPUSDT', name: 'XRP / USDT', shortName: 'XRP', exchange: 'Binance', market: 'crypto', pricePrecision: 4, volumePrecision: 1 },
  { ticker: 'ADAUSDT', name: 'Cardano / USDT', shortName: 'ADA', exchange: 'Binance', market: 'crypto', pricePrecision: 4, volumePrecision: 1 },
  { ticker: 'DOGEUSDT', name: 'Dogecoin / USDT', shortName: 'DOGE', exchange: 'Binance', market: 'crypto', pricePrecision: 5, volumePrecision: 0 },
  { ticker: 'DOTUSDT', name: 'Polkadot / USDT', shortName: 'DOT', exchange: 'Binance', market: 'crypto', pricePrecision: 3, volumePrecision: 2 },
  { ticker: 'LINKUSDT', name: 'Chainlink / USDT', shortName: 'LINK', exchange: 'Binance', market: 'crypto', pricePrecision: 3, volumePrecision: 2 },
  { ticker: 'AVAXUSDT', name: 'Avalanche / USDT', shortName: 'AVAX', exchange: 'Binance', market: 'crypto', pricePrecision: 2, volumePrecision: 2 },
  { ticker: 'MATICUSDT', name: 'Polygon / USDT', shortName: 'MATIC', exchange: 'Binance', market: 'crypto', pricePrecision: 4, volumePrecision: 1 },
  { ticker: 'ATOMUSDT', name: 'Cosmos / USDT', shortName: 'ATOM', exchange: 'Binance', market: 'crypto', pricePrecision: 3, volumePrecision: 2 },
  { ticker: 'LTCUSDT', name: 'Litecoin / USDT', shortName: 'LTC', exchange: 'Binance', market: 'crypto', pricePrecision: 2, volumePrecision: 3 },
  { ticker: 'UNIUSDT', name: 'Uniswap / USDT', shortName: 'UNI', exchange: 'Binance', market: 'crypto', pricePrecision: 3, volumePrecision: 2 },
  { ticker: 'NEARUSDT', name: 'NEAR Protocol / USDT', shortName: 'NEAR', exchange: 'Binance', market: 'crypto', pricePrecision: 3, volumePrecision: 1 },
]

const SUPPORTED_INTERVALS = {
  second: [1],
  minute: [1, 3, 5, 15, 30],
  hour: [1, 2, 4, 6, 8, 12],
  day: [1, 3],
  week: [1],
  month: [1]
}

interface IntervalStrategy {
  interval: string
  multiplier: number
  baseSpan: number
  baseType: string
}

function getStrategy(period: Period): IntervalStrategy {
  const { span, type } = period
  
  // Check if natively supported
  // @ts-expect-error
  if (SUPPORTED_INTERVALS[type] && SUPPORTED_INTERVALS[type].includes(span)) {
    let interval = ''
    switch (type) {
      case 'second': interval = `${span}s`; break
      case 'minute': interval = `${span}m`; break
      case 'hour': interval = `${span}h`; break
      case 'day': interval = `${span}d`; break
      case 'week': interval = `${span}w`; break
      case 'month': interval = `${span}M`; break
      case 'year': interval = `${span}M`; break // Should not happen if checked against SUPPORTED_INTERVALS
    }
    return { interval, multiplier: 1, baseSpan: span, baseType: type }
  }

  // Find best base interval
  // Try to find a divisor in the same unit
  // @ts-expect-error
  const sameUnitSupported = SUPPORTED_INTERVALS[type]
  if (sameUnitSupported) {
    // Sort descending to find largest divisor
    const sorted = [...sameUnitSupported].sort((a, b) => b - a)
    for (const base of sorted) {
      if (span % base === 0) {
        let interval = ''
        switch (type) {
          case 'second': interval = `${base}s`; break
          case 'minute': interval = `${base}m`; break
          case 'hour': interval = `${base}h`; break
          case 'day': interval = `${base}d`; break
          case 'week': interval = `${base}w`; break
          case 'month': interval = `${base}M`; break
        }
        return { interval, multiplier: span / base, baseSpan: base, baseType: type }
      }
    }
  }

  // Fallback logic for cross-unit (e.g. 90 minutes -> 30 minutes is handled above)
  // But what if 90 minutes -> 1 hour? No.
  // What if 1 week? Binance supports 1w.
  // What if 2 weeks? 1w * 2.
  
  // If we are here, we didn't find a divisor in the same unit.
  // e.g. 7 minutes. Divisor 1m.
  // e.g. 27 minutes. Divisor 3m (handled above).
  
  // Fallback to smallest unit if possible
  if (type === 'minute') {
    return { interval: '1m', multiplier: span, baseSpan: 1, baseType: 'minute' }
  }
  if (type === 'hour') {
    return { interval: '1h', multiplier: span, baseSpan: 1, baseType: 'hour' }
  }
  if (type === 'day') {
    return { interval: '1d', multiplier: span, baseSpan: 1, baseType: 'day' }
  }

  // Default fallback
  return { interval: '1m', multiplier: 1, baseSpan: 1, baseType: 'minute' }
}

export default class BinanceDatafeed implements Datafeed {
  private _ws: WebSocket | null = null
  private _currentSymbol: string | null = null
  private _currentStrategy: IntervalStrategy | null = null
  
  // Store the base candles for the current aggregated period
  // Key: timestamp of the base candle
  private _currentBaseCandles: Map<number, KLineData> = new Map()

  async searchSymbols(search?: string): Promise<SymbolInfo[]> {
    if (!search) return SYMBOLS
    const searchLower = search.toLowerCase()
    return SYMBOLS.filter(s => 
      s.ticker.toLowerCase().includes(searchLower) ||
      s.name?.toLowerCase().includes(searchLower) ||
      s.shortName?.toLowerCase().includes(searchLower)
    )
  }

  async getHistoryKLineData(
    symbol: SymbolInfo,
    period: Period,
    from: number,
    to: number
  ): Promise<KLineData[]> {
    const strategy = getStrategy(period)

    let unitMs = 60 * 1000
    if (strategy.baseType === 'second') unitMs = 1000
    if (strategy.baseType === 'hour') unitMs = 60 * 60 * 1000
    if (strategy.baseType === 'day') unitMs = 24 * 60 * 60 * 1000
    if (strategy.baseType === 'week') unitMs = 7 * 24 * 60 * 60 * 1000
    if (strategy.baseType === 'month') unitMs = 30 * 24 * 60 * 60 * 1000

    const baseDuration = strategy.baseSpan * unitMs
    
    // Calculate aggregation duration to ensure we fetch the start of the current bucket
    // This is crucial for the WebSocket subscription to continue correctly without gaps or jumps
    const aggDuration = strategy.multiplier * baseDuration
    const currentBucketStart = Math.floor(to / aggDuration) * aggDuration
    const msInCurrentBucket = to - currentBucketStart
    // Add buffer to ensure we cover the start
    const candlesInCurrentBucket = Math.ceil(msInCurrentBucket / baseDuration) + 2

    const neededCandles = Math.ceil((to - from) / baseDuration)
    const limit = Math.min(1000, Math.max(1, neededCandles, candlesInCurrentBucket))

    const url = `${BINANCE_API}/klines?symbol=${symbol.ticker}&interval=${strategy.interval}&endTime=${to}&limit=${limit}`
    
    try {
      const response = await fetch(url)
      const data = await response.json()
      
      if (!Array.isArray(data)) {
        console.error('Binance API error:', data)
        return []
      }
      
      const baseKlines: KLineData[] = data.map((kline: any[]) => ({
        timestamp: kline[0],
        open: parseFloat(kline[1]),
        high: parseFloat(kline[2]),
        low: parseFloat(kline[3]),
        close: parseFloat(kline[4]),
        volume: parseFloat(kline[5]),
        turnover: parseFloat(kline[7]),
      }))

      if (strategy.multiplier === 1) {
        return baseKlines
      }

      // Aggregate
      const result: KLineData[] = []
      let currentAgg: KLineData | null = null
      let currentBaseCandles: KLineData[] = []

      const aggDuration = strategy.multiplier * strategy.baseSpan * unitMs

      baseKlines.forEach(k => {
        // Determine start time of the aggregated candle this base candle belongs to
        // Assuming alignment to 0
        // For months/weeks this simple math might be slightly off due to calendar, but for minutes/hours it's fine.
        // For Binance, candles are usually aligned.
        // We can use the timestamp of the base candle to determine the bucket.
        
        // However, simply taking floor might not work if the start time is not 0-aligned (e.g. weekly starts on Monday).
        // But let's assume standard alignment.
        
        const aggTimestamp = Math.floor(k.timestamp / aggDuration) * aggDuration
        
        if (currentAgg && currentAgg.timestamp !== aggTimestamp) {
          result.push(currentAgg)
          currentAgg = null
          currentBaseCandles = []
        }

        if (!currentAgg) {
          currentAgg = {
            timestamp: aggTimestamp,
            open: k.open,
            high: k.high,
            low: k.low,
            close: k.close,
            volume: k.volume,
            turnover: k.turnover
          }
          currentBaseCandles = [k]
        } else {
          currentAgg.high = Math.max(currentAgg.high, k.high)
          currentAgg.low = Math.min(currentAgg.low, k.low)
          currentAgg.close = k.close
          currentAgg.volume = (currentAgg.volume ?? 0) + (k.volume ?? 0)
          currentAgg.turnover = (currentAgg.turnover ?? 0) + (k.turnover ?? 0)
          currentBaseCandles.push(k)
        }
      })

      if (currentAgg) {
        result.push(currentAgg)
        // Store the base candles of the last aggregated candle for subscription use
        this._currentBaseCandles.clear()
        currentBaseCandles.forEach(k => this._currentBaseCandles.set(k.timestamp, k))
      }

      return result

    } catch (error) {
      console.error('Failed to fetch history:', error)
      return []
    }
  }

  subscribe(
    symbol: SymbolInfo,
    period: Period,
    callback: DatafeedSubscribeCallback
  ): void {
    const strategy = getStrategy(period)
    const streamName = `${symbol.ticker.toLowerCase()}@kline_${strategy.interval}`
    
    // Close existing connection if symbol/interval changed
    if (this._ws && (this._currentSymbol !== symbol.ticker || this._currentStrategy?.interval !== strategy.interval)) {
      this._ws.close()
      this._ws = null
    }
    
    if (!this._ws) {
      this._ws = new WebSocket(`${BINANCE_WS}/${streamName}`)
      this._currentSymbol = symbol.ticker
      this._currentStrategy = strategy
      
      this._ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.e === 'kline') {
            const k = data.k
            const baseCandle: KLineData = {
              timestamp: k.t,
              open: parseFloat(k.o),
              high: parseFloat(k.h),
              low: parseFloat(k.l),
              close: parseFloat(k.c),
              volume: parseFloat(k.v),
              turnover: parseFloat(k.q),
            }

            if (strategy.multiplier === 1) {
              callback(baseCandle)
              return
            }

            // Aggregation logic
            let unitMs = 60 * 1000
            if (strategy.baseType === 'second') unitMs = 1000
            if (strategy.baseType === 'hour') unitMs = 60 * 60 * 1000
            if (strategy.baseType === 'day') unitMs = 24 * 60 * 60 * 1000
            if (strategy.baseType === 'week') unitMs = 7 * 24 * 60 * 60 * 1000
            if (strategy.baseType === 'month') unitMs = 30 * 24 * 60 * 60 * 1000

            const aggDuration = strategy.multiplier * strategy.baseSpan * unitMs
            const aggTimestamp = Math.floor(baseCandle.timestamp / aggDuration) * aggDuration

            // Update current base candles map
            // If this base candle belongs to a new aggregated period, clear old ones
            // Check the timestamp of the first candle in the map
            const firstBaseTimestamp = this._currentBaseCandles.keys().next().value
            if (firstBaseTimestamp !== undefined) {
               const firstAggTimestamp = Math.floor(firstBaseTimestamp / aggDuration) * aggDuration
               if (firstAggTimestamp !== aggTimestamp) {
                 this._currentBaseCandles.clear()
               }
            }

            this._currentBaseCandles.set(baseCandle.timestamp, baseCandle)

            // Re-aggregate
            let aggCandle: KLineData | null = null
            // Sort by timestamp to ensure correct Open/Close
            const sortedBase = Array.from(this._currentBaseCandles.values()).sort((a, b) => a.timestamp - b.timestamp)
            
            sortedBase.forEach(k => {
              if (!aggCandle) {
                aggCandle = {
                  timestamp: aggTimestamp,
                  open: k.open,
                  high: k.high,
                  low: k.low,
                  close: k.close,
                  volume: k.volume,
                  turnover: k.turnover
                }
              } else {
                aggCandle.high = Math.max(aggCandle.high, k.high)
                aggCandle.low = Math.min(aggCandle.low, k.low)
                aggCandle.close = k.close
                aggCandle.volume = (aggCandle.volume ?? 0) + (k.volume ?? 0)
                aggCandle.turnover = (aggCandle.turnover ?? 0) + (k.turnover ?? 0)
              }
            })

            if (aggCandle) {
              callback(aggCandle)
            }
          }
        } catch (error) {
          console.error('WebSocket message error:', error)
        }
      }
      
      this._ws.onerror = (error) => {
        console.error('WebSocket error:', error)
      }
      
      this._ws.onclose = () => {
        console.log('WebSocket closed')
      }
    }
  }

  unsubscribe(symbol: SymbolInfo, period: Period): void {
    if (this._ws) {
      this._ws.close()
      this._ws = null
      this._currentSymbol = null
      this._currentStrategy = null
      this._currentBaseCandles.clear()
    }
  }
}
