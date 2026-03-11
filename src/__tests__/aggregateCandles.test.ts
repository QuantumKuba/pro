import { describe, it, expect } from 'vitest'
import { aggregateCandles, periodToMs } from '../aggregateCandles'
import type { Period } from '../types'
import { KLineData } from 'klinecharts'

// ── helpers ──────────────────────────────────────────────────────────

const p = (span: number, type: string, text?: string): Period => ({
  span,
  type: type as Period['type'],
  text: text ?? `${span}${type[0]}`
})

/** Create a candle at a given minute offset from a base timestamp */
const makeMinuteCandles = (
  count: number,
  baseTs = Date.UTC(2024, 2, 1, 0, 0, 0), // 2024-03-01 00:00 UTC
  intervalMs = 60_000
): KLineData[] =>
  Array.from({ length: count }, (_, i) => ({
    timestamp: baseTs + i * intervalMs,
    open: 100 + i,
    high: 110 + i,
    low: 90 + i,
    close: 105 + i,
    volume: 1000 + i * 10
  }))

// ── periodToMs ──────────────────────────────────────────────────────

describe('periodToMs', () => {
  it('computes second/minute/hour/day durations', () => {
    expect(periodToMs(p(1, 'second'))).toBe(1_000)
    expect(periodToMs(p(1, 'minute'))).toBe(60_000)
    expect(periodToMs(p(5, 'minute'))).toBe(300_000)
    expect(periodToMs(p(1, 'hour'))).toBe(3_600_000)
    expect(periodToMs(p(4, 'hour'))).toBe(14_400_000)
    expect(periodToMs(p(1, 'day'))).toBe(86_400_000)
  })
})

// ── aggregateCandles ────────────────────────────────────────────────

describe('aggregateCandles', () => {
  it('returns empty array for empty input', () => {
    expect(aggregateCandles([], p(1, 'minute'), p(5, 'minute'))).toEqual([])
  })

  it('returns candles unchanged when target <= base (same period)', () => {
    const candles = makeMinuteCandles(10)
    const result = aggregateCandles(candles, p(1, 'minute'), p(1, 'minute'))
    expect(result).toEqual(candles)
  })

  it('returns candles unchanged when target is smaller than base', () => {
    const candles = makeMinuteCandles(5, Date.UTC(2024, 2, 1), 3_600_000) // 1H candles
    const result = aggregateCandles(candles, p(1, 'hour'), p(5, 'minute'))
    expect(result).toEqual(candles)
  })

  describe('1m → 5m aggregation', () => {
    it('aggregates 10 one-minute candles into 2 five-minute candles', () => {
      const candles = makeMinuteCandles(10) // 10 × 1m candles
      const result = aggregateCandles(candles, p(1, 'minute'), p(5, 'minute'))
      expect(result).toHaveLength(2)
    })

    it('sets open from first candle in bucket', () => {
      const candles = makeMinuteCandles(5)
      const result = aggregateCandles(candles, p(1, 'minute'), p(5, 'minute'))
      expect(result[0].open).toBe(candles[0].open)
    })

    it('sets close from last candle in bucket', () => {
      const candles = makeMinuteCandles(5)
      const result = aggregateCandles(candles, p(1, 'minute'), p(5, 'minute'))
      expect(result[0].close).toBe(candles[4].close)
    })

    it('sets high as max of all highs in bucket', () => {
      const candles = makeMinuteCandles(5)
      const result = aggregateCandles(candles, p(1, 'minute'), p(5, 'minute'))
      const expectedHigh = Math.max(...candles.map(c => c.high))
      expect(result[0].high).toBe(expectedHigh)
    })

    it('sets low as min of all lows in bucket', () => {
      const candles = makeMinuteCandles(5)
      const result = aggregateCandles(candles, p(1, 'minute'), p(5, 'minute'))
      const expectedLow = Math.min(...candles.map(c => c.low))
      expect(result[0].low).toBe(expectedLow)
    })

    it('sums volume across bucket', () => {
      const candles = makeMinuteCandles(5)
      const result = aggregateCandles(candles, p(1, 'minute'), p(5, 'minute'))
      const expectedVol = candles.reduce((s, c) => s + (c.volume ?? 0), 0)
      expect(result[0].volume).toBe(expectedVol)
    })

    it('uses bucket start as timestamp', () => {
      const base = Date.UTC(2024, 2, 1, 0, 3, 0) // starts at 00:03
      const candles = makeMinuteCandles(5, base)
      const result = aggregateCandles(candles, p(1, 'minute'), p(5, 'minute'))
      // 00:03−00:04 → bucket 00:00, 00:05−00:07 → bucket 00:05
      expect(result[0].timestamp).toBe(Date.UTC(2024, 2, 1, 0, 0, 0))
      expect(result[1].timestamp).toBe(Date.UTC(2024, 2, 1, 0, 5, 0))
    })
  })

  describe('1m → 1H aggregation', () => {
    it('aggregates 60 one-minute candles into 1 hourly candle', () => {
      const candles = makeMinuteCandles(60)
      const result = aggregateCandles(candles, p(1, 'minute'), p(1, 'hour'))
      expect(result).toHaveLength(1)
    })

    it('aggregates 120 one-minute candles into 2 hourly candles', () => {
      const candles = makeMinuteCandles(120)
      const result = aggregateCandles(candles, p(1, 'minute'), p(1, 'hour'))
      expect(result).toHaveLength(2)
    })
  })

  describe('1H → 1D aggregation', () => {
    it('aggregates 24 hourly candles into 1 daily candle', () => {
      const base = Date.UTC(2024, 2, 1, 0, 0, 0)
      const candles = makeMinuteCandles(24, base, 3_600_000) // 24 × 1H
      const result = aggregateCandles(candles, p(1, 'hour'), p(1, 'day'))
      expect(result).toHaveLength(1)
      expect(result[0].timestamp).toBe(Date.UTC(2024, 2, 1))
    })
  })

  describe('partial groups', () => {
    it('handles partial bucket at end correctly', () => {
      const candles = makeMinuteCandles(7) // 7 × 1m → 5m gives 1 full + 1 partial
      const result = aggregateCandles(candles, p(1, 'minute'), p(5, 'minute'))
      expect(result).toHaveLength(2)
      // Second bucket has only 2 candles
      expect(result[1].open).toBe(candles[5].open)
      expect(result[1].close).toBe(candles[6].close)
    })
  })

  describe('OHLCV correctness with varied data', () => {
    it('correctly aggregates when middle candle has the extreme values', () => {
      const base = Date.UTC(2024, 2, 1, 0, 0, 0)
      const candles: KLineData[] = [
        { timestamp: base,             open: 100, high: 105, low: 98,  close: 102, volume: 10 },
        { timestamp: base + 60_000,    open: 102, high: 120, low: 80,  close: 110, volume: 20 }, // extreme H/L
        { timestamp: base + 120_000,   open: 110, high: 112, low: 95,  close: 99,  volume: 30 },
      ]
      const result = aggregateCandles(candles, p(1, 'minute'), p(5, 'minute'))
      expect(result).toHaveLength(1)
      expect(result[0].open).toBe(100)   // first candle's open
      expect(result[0].high).toBe(120)   // max high
      expect(result[0].low).toBe(80)     // min low
      expect(result[0].close).toBe(99)   // last candle's close
      expect(result[0].volume).toBe(60)  // sum
    })
  })

  describe('month aggregation', () => {
    it('aggregates daily candles into monthly buckets', () => {
      // 31 daily candles for January 2024
      const base = Date.UTC(2024, 0, 1) // Jan 1
      const candles = makeMinuteCandles(31, base, 86_400_000) // 31 × 1D
      const result = aggregateCandles(candles, p(1, 'day'), p(1, 'month'))
      expect(result).toHaveLength(1)
      expect(result[0].timestamp).toBe(Date.UTC(2024, 0, 1))
    })

    it('splits across month boundaries', () => {
      // 5 daily candles: Jan 30, Jan 31, Feb 1, Feb 2, Feb 3
      const base = Date.UTC(2024, 0, 30)
      const candles = makeMinuteCandles(5, base, 86_400_000)
      const result = aggregateCandles(candles, p(1, 'day'), p(1, 'month'))
      expect(result).toHaveLength(2)
      expect(result[0].timestamp).toBe(Date.UTC(2024, 0, 1)) // Jan bucket
      expect(result[1].timestamp).toBe(Date.UTC(2024, 1, 1)) // Feb bucket
    })
  })

  describe('week aggregation', () => {
    it('aggregates daily candles into weekly buckets', () => {
      // 14 daily candles → 2-3 weekly candles
      const base = Date.UTC(2024, 2, 4) // Monday March 4, 2024
      const candles = makeMinuteCandles(14, base, 86_400_000)
      const result = aggregateCandles(candles, p(1, 'day'), p(1, 'week'))
      expect(result).toHaveLength(2)
    })
  })
})
