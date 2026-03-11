import { KLineData } from 'klinecharts'
import { Period } from './types'

/**
 * Convert a Period to its duration in milliseconds.
 * For week/month/year, returns approximate values used only for comparison —
 * actual bucket boundaries use calendar-aware alignment.
 */
export function periodToMs(period: Period): number {
  const span = period.span ?? 1
  switch (period.type) {
    case 'second': return span * 1_000
    case 'minute': return span * 60_000
    case 'hour':   return span * 3_600_000
    case 'day':    return span * 86_400_000
    case 'week':   return span * 7 * 86_400_000
    case 'month':  return span * 30 * 86_400_000
    case 'year':   return span * 365 * 86_400_000
    default:       return span * 60_000
  }
}

/**
 * Returns the calendar-aligned bucket start timestamp for a given timestamp
 * and target period. For sub-day periods, uses simple modular alignment.
 * For day/week/month/year, uses UTC calendar alignment.
 */
function getBucketStart(timestamp: number, period: Period): number {
  const span = period.span ?? 1

  switch (period.type) {
    case 'second': {
      const bucketMs = span * 1_000
      return Math.floor(timestamp / bucketMs) * bucketMs
    }
    case 'minute': {
      const bucketMs = span * 60_000
      return Math.floor(timestamp / bucketMs) * bucketMs
    }
    case 'hour': {
      const bucketMs = span * 3_600_000
      return Math.floor(timestamp / bucketMs) * bucketMs
    }
    case 'day': {
      const d = new Date(timestamp)
      d.setUTCHours(0, 0, 0, 0)
      if (span > 1) {
        // Align to an epoch-based day count
        const daysSinceEpoch = Math.floor(d.getTime() / 86_400_000)
        const alignedDay = daysSinceEpoch - (daysSinceEpoch % span)
        return alignedDay * 86_400_000
      }
      return d.getTime()
    }
    case 'week': {
      const d = new Date(timestamp)
      d.setUTCHours(0, 0, 0, 0)
      // Align to Monday (ISO week start)
      const dow = d.getUTCDay()
      const mondayOffset = dow === 0 ? 6 : dow - 1
      d.setUTCDate(d.getUTCDate() - mondayOffset)
      if (span > 1) {
        const weeksSinceEpoch = Math.floor(d.getTime() / (7 * 86_400_000))
        const alignedWeek = weeksSinceEpoch - (weeksSinceEpoch % span)
        return alignedWeek * 7 * 86_400_000
      }
      return d.getTime()
    }
    case 'month': {
      const d = new Date(timestamp)
      let month = d.getUTCMonth()
      const year = d.getUTCFullYear()
      if (span > 1) {
        const totalMonths = year * 12 + month
        const alignedTotal = totalMonths - (totalMonths % span)
        return Date.UTC(Math.floor(alignedTotal / 12), alignedTotal % 12, 1)
      }
      return Date.UTC(year, month, 1)
    }
    case 'year': {
      const d = new Date(timestamp)
      let year = d.getUTCFullYear()
      if (span > 1) {
        year = year - (year % span)
      }
      return Date.UTC(year, 0, 1)
    }
    default:
      return timestamp
  }
}

/**
 * Aggregate sorted base-timeframe candles into target-period buckets.
 *
 * Rules:
 * - open  = first candle's open in the bucket
 * - high  = max of all highs in the bucket
 * - low   = min of all lows in the bucket
 * - close = last candle's close in the bucket
 * - volume = sum of all volumes in the bucket
 * - timestamp = bucket start time
 *
 * If the target period is the same or smaller than the base period,
 * candles are returned unchanged (can't subdivide data).
 */
export function aggregateCandles(
  candles: KLineData[],
  basePeriod: Period,
  targetPeriod: Period
): KLineData[] {
  if (candles.length === 0) return []

  const baseMs = periodToMs(basePeriod)
  const targetMs = periodToMs(targetPeriod)

  // Can't subdivide — return as-is
  if (targetMs <= baseMs) return candles

  const result: KLineData[] = []
  let currentBucket = -1
  let current: KLineData | null = null

  for (const candle of candles) {
    const bucketStart = getBucketStart(candle.timestamp, targetPeriod)

    if (bucketStart !== currentBucket) {
      // Flush previous bucket
      if (current) {
        result.push(current)
      }
      // Start new bucket
      currentBucket = bucketStart
      current = {
        timestamp: bucketStart,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume ?? 0
      }
    } else {
      // Aggregate into current bucket
      current!.high = Math.max(current!.high, candle.high)
      current!.low = Math.min(current!.low, candle.low)
      current!.close = candle.close
      current!.volume = (current!.volume ?? 0) + (candle.volume ?? 0)
    }
  }

  // Flush last bucket
  if (current) {
    result.push(current)
  }

  return result
}
