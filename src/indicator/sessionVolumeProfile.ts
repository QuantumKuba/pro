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

import { IndicatorTemplate, KLineData } from 'klinecharts'
import { computeVolumeProfile, groupIntoSessions, VolumeProfileResult } from './volumeProfileUtils'

/**
 * Session Volume Profile (SVP)
 * 
 * Renders horizontal volume histograms for each time session (daily or weekly).
 * Each session gets its own profile anchored to the start of that session.
 * 
 * calcParams:
 *  [0] numBins - Number of price bins per session (default: 24)
 *  [1] vaPercent - Value Area percentage (default: 70)
 *  [2] sessionType - 0=daily, 1=weekly (default: 0)
 *  [3] opacity - Bar opacity 0-100 (default: 30)
 */

interface SVPResult {
  placeholder?: number
}

// Color configuration
const VA_BUY_COLOR = 'rgba(38, 166, 154, '    // Teal green
const VA_SELL_COLOR = 'rgba(239, 83, 80, '     // Red
const NON_VA_BUY_COLOR = 'rgba(38, 166, 154, ' // Same color, lower opacity outside VA
const NON_VA_SELL_COLOR = 'rgba(239, 83, 80, '
const POC_COLOR = 'rgba(255, 235, 59, 0.9)'    // Bright yellow for POC line

function drawSessionProfile(
  ctx: CanvasRenderingContext2D,
  profile: VolumeProfileResult,
  sessionStartX: number,
  sessionEndX: number,
  yAxis: any,
  opacity: number
): void {
  const barMaxWidth = Math.max(20, (sessionEndX - sessionStartX) * 0.85)
  const baseOpacity = opacity / 100
  const vaOpacity = baseOpacity
  const nonVaOpacity = baseOpacity * 0.5

  for (let i = 0; i < profile.bins.length; i++) {
    const bin = profile.bins[i]
    if (bin.totalVolume <= 0) continue

    const yTop = yAxis.convertToPixel(bin.priceHigh)
    const yBottom = yAxis.convertToPixel(bin.priceLow)
    const barHeight = Math.max(1, Math.abs(yBottom - yTop))
    const barY = Math.min(yTop, yBottom)

    const widthRatio = bin.totalVolume / profile.maxBinVolume
    const totalBarWidth = barMaxWidth * widthRatio

    const isInVA = bin.priceMid >= profile.vaLow && bin.priceMid <= profile.vaHigh
    const currentOpacity = isInVA ? vaOpacity : nonVaOpacity

    // Draw buy volume (left portion)
    const buyRatio = bin.buyVolume / bin.totalVolume
    const buyWidth = totalBarWidth * buyRatio
    const sellWidth = totalBarWidth * (1 - buyRatio)

    const buyColor = isInVA ? VA_BUY_COLOR : NON_VA_BUY_COLOR
    const sellColor = isInVA ? VA_SELL_COLOR : NON_VA_SELL_COLOR

    // Buy bar
    if (buyWidth > 0) {
      ctx.fillStyle = `${buyColor}${currentOpacity})`
      ctx.fillRect(sessionStartX, barY, buyWidth, barHeight)
    }
    // Sell bar (stacked after buy)
    if (sellWidth > 0) {
      ctx.fillStyle = `${sellColor}${currentOpacity})`
      ctx.fillRect(sessionStartX + buyWidth, barY, sellWidth, barHeight)
    }
  }

  // Draw POC line
  const pocBin = profile.bins[profile.pocIndex]
  if (pocBin) {
    const pocY = yAxis.convertToPixel(pocBin.priceMid)
    ctx.strokeStyle = POC_COLOR
    ctx.lineWidth = 1.5
    ctx.setLineDash([4, 2])
    ctx.beginPath()
    ctx.moveTo(sessionStartX, pocY)
    ctx.lineTo(sessionStartX + barMaxWidth, pocY)
    ctx.stroke()
    ctx.setLineDash([])
  }

  // Draw VA boundaries (subtle dashed lines)
  ctx.strokeStyle = `rgba(255, 255, 255, ${baseOpacity * 0.6})`
  ctx.lineWidth = 0.5
  ctx.setLineDash([2, 3])

  const vaHighY = yAxis.convertToPixel(profile.vaHigh)
  ctx.beginPath()
  ctx.moveTo(sessionStartX, vaHighY)
  ctx.lineTo(sessionStartX + barMaxWidth, vaHighY)
  ctx.stroke()

  const vaLowY = yAxis.convertToPixel(profile.vaLow)
  ctx.beginPath()
  ctx.moveTo(sessionStartX, vaLowY)
  ctx.lineTo(sessionStartX + barMaxWidth, vaLowY)
  ctx.stroke()

  ctx.setLineDash([])
}

const sessionVolumeProfile: IndicatorTemplate = {
  name: 'SVP',
  shortName: 'SVP',
  calcParams: [24, 70, 0, 30], // numBins, vaPercent, sessionType, opacity
  precision: 2,
  shouldOhlc: true,
  figures: [],
  calc: (dataList: KLineData[]): SVPResult[] => {
    // Return placeholder results matching data length
    return dataList.map(() => ({ placeholder: 0 }))
  },
  draw: (params: any): boolean => {
    const { ctx, chart, bounding, xAxis, yAxis } = params

    const dataList: KLineData[] = chart.getDataList()
    const visibleRange = chart.getVisibleRange()
    if (!dataList || dataList.length === 0 || !visibleRange) return true

    const indicator = params.indicator
    const calcParams = indicator.calcParams
    const numBins = (calcParams[0] as number) || 24
    const vaPercent = (calcParams[1] as number) || 70
    const sessionType = (calcParams[2] as number) || 0
    const opacity = (calcParams[3] as number) || 30

    const from = Math.max(0, visibleRange.from)
    const to = Math.min(dataList.length - 1, visibleRange.to)
    if (from > to) return true

    // Group into sessions
    const sessions = groupIntoSessions(dataList, from, to, sessionType)

    ctx.save()

    for (const session of sessions) {
      if (session.data.length < 2) continue

      const profile = computeVolumeProfile(session.data, numBins, 0, vaPercent)
      if (!profile) continue

      const sessionStartX = xAxis.convertToPixel(session.startIndex)
      const sessionEndX = xAxis.convertToPixel(session.endIndex)

      drawSessionProfile(ctx, profile, sessionStartX, sessionEndX, yAxis, opacity)
    }

    ctx.restore()

    // Return true to prevent default figure drawing (we handle everything)
    return true
  }
}

export default sessionVolumeProfile
