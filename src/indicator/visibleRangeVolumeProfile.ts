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
import { computeVolumeProfile, VolumeProfileResult } from './volumeProfileUtils'

/**
 * Visible Range Volume Profile (VRVP)
 * 
 * A large horizontal histogram anchored to the right-side Y-axis that
 * dynamically recalculates based on the currently visible price action.
 * 
 * calcParams:
 *  [0] numBins - Number of price rows (default: 24)
 *  [1] vaPercent - Value Area percentage (default: 70)
 *  [2] maxWidthPercent - Maximum width as % of chart width (default: 30)
 *  [3] opacity - Bar opacity 0-100 (default: 40)
 */

interface VRVPResult {
  placeholder?: number
}

// Color configuration
const VA_BUY_COLOR = 'rgba(38, 166, 154, '    // Teal green
const VA_SELL_COLOR = 'rgba(239, 83, 80, '     // Red
const NON_VA_BUY_COLOR = 'rgba(100, 120, 115, ' // Muted teal
const NON_VA_SELL_COLOR = 'rgba(160, 100, 100, ' // Muted red
const POC_COLOR = 'rgba(255, 235, 59, 0.9)'    // Bright yellow
const POC_LINE_COLOR = 'rgba(255, 235, 59, 0.3)' // Subtle yellow line across chart

function drawVRVP(
  ctx: CanvasRenderingContext2D,
  profile: VolumeProfileResult,
  bounding: { width: number; height: number; top: number; left: number },
  yAxis: any,
  maxWidthPercent: number,
  opacity: number
): void {
  const maxBarWidth = bounding.width * (maxWidthPercent / 100)
  const rightEdge = bounding.left + bounding.width
  const baseOpacity = opacity / 100
  const vaOpacity = baseOpacity
  const nonVaOpacity = baseOpacity * 0.55

  for (let i = 0; i < profile.bins.length; i++) {
    const bin = profile.bins[i]
    if (bin.totalVolume <= 0) continue

    const yTop = yAxis.convertToPixel(bin.priceHigh)
    const yBottom = yAxis.convertToPixel(bin.priceLow)
    const barHeight = Math.max(1, Math.abs(yBottom - yTop) - 0.5) // Slight gap between rows
    const barY = Math.min(yTop, yBottom) + 0.25

    const widthRatio = bin.totalVolume / profile.maxBinVolume
    const totalBarWidth = maxBarWidth * widthRatio

    const isInVA = bin.priceMid >= profile.vaLow && bin.priceMid <= profile.vaHigh
    const isPOC = i === profile.pocIndex
    const currentOpacity = isInVA ? vaOpacity : nonVaOpacity

    // Calculate buy/sell split
    const buyRatio = bin.totalVolume > 0 ? bin.buyVolume / bin.totalVolume : 0.5
    const buyWidth = totalBarWidth * buyRatio
    const sellWidth = totalBarWidth * (1 - buyRatio)

    const buyColor = isInVA ? VA_BUY_COLOR : NON_VA_BUY_COLOR
    const sellColor = isInVA ? VA_SELL_COLOR : NON_VA_SELL_COLOR

    // Draw from right edge, extending left
    // Sell bar (rightmost, closest to price axis)
    if (sellWidth > 0) {
      ctx.fillStyle = `${sellColor}${currentOpacity})`
      ctx.fillRect(rightEdge - sellWidth, barY, sellWidth, barHeight)
    }
    // Buy bar (to the left of sell)
    if (buyWidth > 0) {
      ctx.fillStyle = `${buyColor}${currentOpacity})`
      ctx.fillRect(rightEdge - totalBarWidth, barY, buyWidth, barHeight)
    }

    // POC highlight: brighter border on the POC row
    if (isPOC) {
      ctx.strokeStyle = POC_COLOR
      ctx.lineWidth = 1.5
      ctx.strokeRect(rightEdge - totalBarWidth, barY, totalBarWidth, barHeight)
    }
  }

  // Draw POC line extending across the full chart width
  const pocBin = profile.bins[profile.pocIndex]
  if (pocBin) {
    const pocY = yAxis.convertToPixel(pocBin.priceMid)
    ctx.strokeStyle = POC_LINE_COLOR
    ctx.lineWidth = 1
    ctx.setLineDash([6, 4])
    ctx.beginPath()
    ctx.moveTo(bounding.left, pocY)
    ctx.lineTo(rightEdge, pocY)
    ctx.stroke()
    ctx.setLineDash([])

    // POC label
    ctx.fillStyle = POC_COLOR
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText('POC', rightEdge - 4, pocY - 3)
  }

  // Draw Value Area boundaries
  const vaHighY = yAxis.convertToPixel(profile.vaHigh)
  const vaLowY = yAxis.convertToPixel(profile.vaLow)

  ctx.strokeStyle = `rgba(100, 181, 246, ${baseOpacity * 0.7})`
  ctx.lineWidth = 0.8
  ctx.setLineDash([3, 3])

  ctx.beginPath()
  ctx.moveTo(bounding.left, vaHighY)
  ctx.lineTo(rightEdge, vaHighY)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(bounding.left, vaLowY)
  ctx.lineTo(rightEdge, vaLowY)
  ctx.stroke()

  ctx.setLineDash([])

  // VA labels
  ctx.fillStyle = `rgba(100, 181, 246, ${baseOpacity * 0.9})`
  ctx.font = '9px sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('VAH', bounding.left + 4, vaHighY - 2)
  ctx.fillText('VAL', bounding.left + 4, vaLowY + 10)
}

const visibleRangeVolumeProfile: IndicatorTemplate = {
  name: 'VRVP',
  shortName: 'VRVP',
  calcParams: [24, 70, 30, 40], // numBins, vaPercent, maxWidthPercent, opacity
  precision: 2,
  shouldOhlc: true,
  figures: [],
  calc: (dataList: KLineData[]): VRVPResult[] => {
    return dataList.map(() => ({ placeholder: 0 }))
  },
  draw: (params: any): boolean => {
    const { ctx, chart, bounding, yAxis } = params

    const dataList: KLineData[] = chart.getDataList()
    const visibleRange = chart.getVisibleRange()
    if (!dataList || dataList.length === 0 || !visibleRange) return true

    const indicator = params.indicator
    const calcParams = indicator.calcParams
    const numBins = (calcParams[0] as number) || 24
    const vaPercent = (calcParams[1] as number) || 70
    const maxWidthPercent = (calcParams[2] as number) || 30
    const opacity = (calcParams[3] as number) || 40

    const from = Math.max(0, visibleRange.from)
    const to = Math.min(dataList.length - 1, visibleRange.to)
    if (from > to) return true

    // Slice the visible data
    const visibleData = dataList.slice(from, to + 1)
    if (visibleData.length === 0) return true

    const profile = computeVolumeProfile(visibleData, numBins, 0, vaPercent)
    if (!profile) return true

    ctx.save()
    drawVRVP(ctx, profile, bounding, yAxis, maxWidthPercent, opacity)
    ctx.restore()

    return true
  }
}

export default visibleRangeVolumeProfile
