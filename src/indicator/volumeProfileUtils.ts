/**
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at

 * http://www.apache.org/licenses/LICENSE-2.0

 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { KLineData } from 'klinecharts'

/** A single price bin in the volume profile */
export interface VolumeBin {
  /** Lower bound of the price bin */
  priceLow: number
  /** Upper bound of the price bin */
  priceHigh: number
  /** Midpoint price of the bin */
  priceMid: number
  /** Total volume in this bin */
  totalVolume: number
  /** Estimated buy (ask) volume */
  buyVolume: number
  /** Estimated sell (bid) volume */
  sellVolume: number
}

/** Result of a full volume profile computation */
export interface VolumeProfileResult {
  bins: VolumeBin[]
  /** Index of the POC bin (highest volume) */
  pocIndex: number
  /** Value Area High price */
  vaHigh: number
  /** Value Area Low price */
  vaLow: number
  /** Total volume across all bins */
  totalVolume: number
  /** Max volume in a single bin (for scaling) */
  maxBinVolume: number
}

/**
 * Distribute a single candle's volume across price bins using uniform distribution.
 * The candle's volume is spread across all bins that its high-low range touches.
 * Buy/sell estimation: if close >= open, volume is biased as buy; otherwise sell.
 */
function distributeCandle(bins: VolumeBin[], candle: KLineData, binLow: number, tickSize: number): void {
  const vol = candle.volume ?? 0
  if (vol <= 0 || candle.high <= candle.low) return

  const candleLow = candle.low
  const candleHigh = candle.high
  const isBullish = candle.close >= candle.open
  const buyPct = isBullish ? 0.6 : 0.4

  // Find the bins this candle touches
  const startIdx = Math.max(0, Math.floor((candleLow - binLow) / tickSize))
  const endIdx = Math.min(bins.length - 1, Math.floor((candleHigh - binLow) / tickSize))

  if (startIdx > endIdx) return

  // Calculate how much of the candle range each bin covers
  const candleRange = candleHigh - candleLow
  let totalWeight = 0
  const weights: number[] = []

  for (let i = startIdx; i <= endIdx; i++) {
    const overlapLow = Math.max(candleLow, bins[i].priceLow)
    const overlapHigh = Math.min(candleHigh, bins[i].priceHigh)
    const weight = Math.max(0, overlapHigh - overlapLow) / candleRange
    weights.push(weight)
    totalWeight += weight
  }

  if (totalWeight <= 0) return

  for (let i = startIdx; i <= endIdx; i++) {
    const w = weights[i - startIdx] / totalWeight
    const binVol = vol * w
    bins[i].totalVolume += binVol
    bins[i].buyVolume += binVol * buyPct
    bins[i].sellVolume += binVol * (1 - buyPct)
  }
}

/**
 * Compute the volume profile for a set of candles.
 * @param data Array of KLineData candles to profile
 * @param numBins Target number of price bins (if tickSize is 0/auto)
 * @param fixedTickSize Optional fixed tick size. If 0, auto-calculated from data range.
 * @param vaPercent Value Area percentage (0-100), default 70
 */
export function computeVolumeProfile(
  data: KLineData[],
  numBins: number = 24,
  fixedTickSize: number = 0,
  vaPercent: number = 70
): VolumeProfileResult | null {
  if (data.length === 0) return null

  // Find price range
  let priceHigh = -Infinity
  let priceLow = Infinity
  for (const d of data) {
    if (d.high > priceHigh) priceHigh = d.high
    if (d.low < priceLow) priceLow = d.low
  }

  if (!isFinite(priceHigh) || !isFinite(priceLow) || priceHigh <= priceLow) return null

  const range = priceHigh - priceLow
  const tickSize = fixedTickSize > 0 ? fixedTickSize : range / Math.max(numBins, 1)

  if (tickSize <= 0) return null

  // Create bins
  const actualBins = Math.ceil(range / tickSize)
  const bins: VolumeBin[] = []
  for (let i = 0; i < actualBins; i++) {
    const low = priceLow + i * tickSize
    bins.push({
      priceLow: low,
      priceHigh: low + tickSize,
      priceMid: low + tickSize / 2,
      totalVolume: 0,
      buyVolume: 0,
      sellVolume: 0
    })
  }

  // Distribute volume
  for (const candle of data) {
    distributeCandle(bins, candle, priceLow, tickSize)
  }

  // Find POC
  let pocIndex = 0
  let maxVol = 0
  let totalVolume = 0
  for (let i = 0; i < bins.length; i++) {
    totalVolume += bins[i].totalVolume
    if (bins[i].totalVolume > maxVol) {
      maxVol = bins[i].totalVolume
      pocIndex = i
    }
  }

  if (totalVolume <= 0) return null

  // Compute Value Area (70% default)
  const targetVolume = totalVolume * (vaPercent / 100)
  let vaVolume = bins[pocIndex].totalVolume
  let vaHighIdx = pocIndex
  let vaLowIdx = pocIndex

  while (vaVolume < targetVolume && (vaLowIdx > 0 || vaHighIdx < bins.length - 1)) {
    const aboveVol = vaHighIdx < bins.length - 1 ? bins[vaHighIdx + 1].totalVolume : 0
    const belowVol = vaLowIdx > 0 ? bins[vaLowIdx - 1].totalVolume : 0

    if (aboveVol >= belowVol && vaHighIdx < bins.length - 1) {
      vaHighIdx++
      vaVolume += bins[vaHighIdx].totalVolume
    } else if (vaLowIdx > 0) {
      vaLowIdx--
      vaVolume += bins[vaLowIdx].totalVolume
    } else if (vaHighIdx < bins.length - 1) {
      vaHighIdx++
      vaVolume += bins[vaHighIdx].totalVolume
    } else {
      break
    }
  }

  return {
    bins,
    pocIndex,
    vaHigh: bins[vaHighIdx].priceHigh,
    vaLow: bins[vaLowIdx].priceLow,
    totalVolume,
    maxBinVolume: maxVol
  }
}

/** Session boundary detection */
export interface SessionGroup {
  startIndex: number
  endIndex: number
  data: KLineData[]
}

/**
 * Group candles into sessions.
 * @param data Full data list
 * @param from Start index
 * @param to End index (inclusive)
 * @param sessionType 0=daily, 1=weekly
 */
export function groupIntoSessions(
  data: KLineData[],
  from: number,
  to: number,
  sessionType: number
): SessionGroup[] {
  const sessions: SessionGroup[] = []
  if (from > to || data.length === 0) return sessions

  let currentKey = ''
  let currentSession: SessionGroup | null = null

  for (let i = from; i <= to; i++) {
    if (i < 0 || i >= data.length) continue
    const d = data[i]
    const date = new Date(d.timestamp)
    let key: string

    if (sessionType === 1) {
      // Weekly: use ISO week number
      const jan1 = new Date(date.getFullYear(), 0, 1)
      const weekNum = Math.ceil(((date.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7)
      key = `${date.getFullYear()}-W${weekNum}`
    } else {
      // Daily
      key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
    }

    if (key !== currentKey) {
      if (currentSession) sessions.push(currentSession)
      currentKey = key
      currentSession = { startIndex: i, endIndex: i, data: [d] }
    } else if (currentSession) {
      currentSession.endIndex = i
      currentSession.data.push(d)
    }
  }
  if (currentSession) sessions.push(currentSession)

  return sessions
}
