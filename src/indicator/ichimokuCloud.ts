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

/**
 * Ichimoku Cloud (一目均衡表) Indicator
 * 
 * Components:
 * 1. Tenkan-sen (Conversion Line) - (9-period high + 9-period low) / 2
 * 2. Kijun-sen (Base Line) - (26-period high + 26-period low) / 2
 * 3. Senkou Span A (Leading Span A) - (Tenkan-sen + Kijun-sen) / 2, plotted 26 periods ahead
 * 4. Senkou Span B (Leading Span B) - (52-period high + 52-period low) / 2, plotted 26 periods ahead
 * 5. Chikou Span (Lagging Span) - Close price, plotted 26 periods behind
 */

interface IchimokuResult {
  tenkanSen?: number
  kijunSen?: number
  senkouSpanA?: number
  senkouSpanB?: number
  chikouSpan?: number
}

/**
 * Calculate the highest high and lowest low over a period
 */
function calcHighLow(dataList: KLineData[], index: number, period: number): { high: number; low: number } | null {
  if (index < period - 1) {
    return null
  }

  let high = Number.MIN_SAFE_INTEGER
  let low = Number.MAX_SAFE_INTEGER

  for (let i = index - period + 1; i <= index; i++) {
    const data = dataList[i]
    if (data.high > high) {
      high = data.high
    }
    if (data.low < low) {
      low = data.low
    }
  }

  return { high, low }
}

const ichimokuCloud: IndicatorTemplate = {
  name: 'ICHIMOKU',
  shortName: 'Ichimoku',
  calcParams: [9, 26, 52, 26], // Tenkan period, Kijun period, Senkou B period, Displacement
  precision: 2,
  shouldOhlc: true,
  figures: [
    { key: 'tenkanSen', title: 'Tenkan: ', type: 'line' },
    { key: 'kijunSen', title: 'Kijun: ', type: 'line' },
    { key: 'senkouSpanA', title: 'SpanA: ', type: 'line' },
    { key: 'senkouSpanB', title: 'SpanB: ', type: 'line' },
    { key: 'chikouSpan', title: 'Chikou: ', type: 'line' }
  ],
  // Match TradingView colors
  styles: {
    lines: [
      { color: '#2962FF' },  // Tenkan-sen - Blue
      { color: '#B71C1C' },  // Kijun-sen - Dark Red  
      { color: '#089981' },  // Senkou Span A - Green
      { color: '#F23645' },  // Senkou Span B - Red
      { color: '#7B1FA2' }   // Chikou Span - Purple
    ]
  },
  calc: (dataList: KLineData[], indicator): IchimokuResult[] => {
    const params = indicator.calcParams
    const tenkanPeriod = params[0] as number
    const kijunPeriod = params[1] as number
    const senkouBPeriod = params[2] as number
    const displacement = params[3] as number

    const result: IchimokuResult[] = []

    // First pass: calculate Tenkan-sen, Kijun-sen, and raw Senkou values
    const tenkanValues: (number | undefined)[] = []
    const kijunValues: (number | undefined)[] = []
    const senkouSpanAValues: (number | undefined)[] = []
    const senkouSpanBValues: (number | undefined)[] = []

    for (let i = 0; i < dataList.length; i++) {
      // Tenkan-sen (Conversion Line)
      const tenkanHL = calcHighLow(dataList, i, tenkanPeriod)
      const tenkanSen = tenkanHL ? (tenkanHL.high + tenkanHL.low) / 2 : undefined
      tenkanValues.push(tenkanSen)

      // Kijun-sen (Base Line)
      const kijunHL = calcHighLow(dataList, i, kijunPeriod)
      const kijunSen = kijunHL ? (kijunHL.high + kijunHL.low) / 2 : undefined
      kijunValues.push(kijunSen)

      // Senkou Span A (will be displaced forward)
      const senkouSpanA = (tenkanSen !== undefined && kijunSen !== undefined)
        ? (tenkanSen + kijunSen) / 2
        : undefined
      senkouSpanAValues.push(senkouSpanA)

      // Senkou Span B (will be displaced forward)
      const senkouBHL = calcHighLow(dataList, i, senkouBPeriod)
      const senkouSpanB = senkouBHL ? (senkouBHL.high + senkouBHL.low) / 2 : undefined
      senkouSpanBValues.push(senkouSpanB)
    }

    // Second pass: build result with proper displacement
    for (let i = 0; i < dataList.length + displacement; i++) {
      const ichimokuData: IchimokuResult = {}

      // Tenkan-sen and Kijun-sen are at current position
      if (i < dataList.length) {
        ichimokuData.tenkanSen = tenkanValues[i]
        ichimokuData.kijunSen = kijunValues[i]
      }

      // Senkou Span A and B are displaced forward (current index shows value from displacement periods ago)
      const senkouIndex = i - displacement
      if (senkouIndex >= 0 && senkouIndex < dataList.length) {
        ichimokuData.senkouSpanA = senkouSpanAValues[senkouIndex]
        ichimokuData.senkouSpanB = senkouSpanBValues[senkouIndex]
      }

      // Chikou Span is displaced backward (current index shows close from displacement periods ahead)
      const chikouIndex = i + displacement
      if (chikouIndex < dataList.length && i < dataList.length) {
        ichimokuData.chikouSpan = dataList[chikouIndex].close
      }

      result.push(ichimokuData)
    }

    return result
  },

  // Custom draw function for the cloud fill
  draw: (params: any) => {
    const { ctx, indicator, xAxis, yAxis, bounding, visibleRange: vr } = params

    const result = indicator.result as IchimokuResult[]
    if (!result || result.length === 0) {
      return false
    }

    // Get visible range - try multiple ways to access it
    let from = 0
    let to = result.length

    if (vr && typeof vr.from === 'number' && typeof vr.to === 'number') {
      from = Math.max(0, vr.from)
      to = Math.min(result.length, vr.to + 1)
    }

    // Clamp to valid range
    from = Math.max(0, from)
    to = Math.min(result.length, to)

    if (from >= to) {
      return false
    }

    // Collect points for cloud segments
    interface CloudPoint {
      x: number
      spanA: number
      spanB: number
    }

    // Draw cloud fill
    // We'll draw two separate passes: one for bullish sections (green) and one for bearish (red)
    const bullishPoints: CloudPoint[] = []
    const bearishPoints: CloudPoint[] = []

    let prevX = 0
    let prevSpanAY = 0
    let prevSpanBY = 0
    let prevIsBullish: boolean | null = null

    for (let i = from; i < to; i++) {
      const data = result[i]
      if (data?.senkouSpanA === undefined || data?.senkouSpanB === undefined) {
        continue
      }

      const x = xAxis.convertToPixel(i)
      const spanAY = yAxis.convertToPixel(data.senkouSpanA)
      const spanBY = yAxis.convertToPixel(data.senkouSpanB)
      const isBullish = data.senkouSpanA >= data.senkouSpanB

      // Check if cloud direction changed
      if (prevIsBullish !== null && prevIsBullish !== isBullish) {
        // Calculate crossover point using linear interpolation
        const prevDiff = prevSpanAY - prevSpanBY
        const currDiff = spanAY - spanBY
        const t = prevDiff / (prevDiff - currDiff)
        const crossX = prevX + t * (x - prevX)
        const crossY = prevSpanAY + t * (spanAY - prevSpanAY)

        // Close current segment at crossover
        if (prevIsBullish) {
          bullishPoints.push({ x: crossX, spanA: crossY, spanB: crossY })
        } else {
          bearishPoints.push({ x: crossX, spanA: crossY, spanB: crossY })
        }

        // Start new segment from crossover
        if (isBullish) {
          bullishPoints.push({ x: crossX, spanA: crossY, spanB: crossY })
        } else {
          bearishPoints.push({ x: crossX, spanA: crossY, spanB: crossY })
        }
      }

      // Add current point to appropriate array
      if (isBullish) {
        bullishPoints.push({ x, spanA: spanAY, spanB: spanBY })
      } else {
        bearishPoints.push({ x, spanA: spanAY, spanB: spanBY })
      }

      prevX = x
      prevSpanAY = spanAY
      prevSpanBY = spanBY
      prevIsBullish = isBullish
    }

    // Helper to draw cloud segment
    const drawCloudSegment = (points: CloudPoint[], color: string) => {
      if (points.length < 2) return

      // Find contiguous segments
      let segmentStart = 0
      for (let i = 0; i < points.length; i++) {
        // If there's a gap (consecutive crossover markers), draw and reset
        if (i > 0 && points[i].spanA === points[i].spanB && points[i - 1].spanA === points[i - 1].spanB) {
          // Draw current segment
          if (i - segmentStart >= 2) {
            drawSegment(points.slice(segmentStart, i), color)
          }
          segmentStart = i
        }
      }
      // Draw remaining segment
      if (points.length - segmentStart >= 2) {
        drawSegment(points.slice(segmentStart), color)
      }
    }

    const drawSegment = (points: CloudPoint[], color: string) => {
      if (points.length < 2) return

      ctx.beginPath()

      // Draw top edge (Span A values)
      ctx.moveTo(points[0].x, points[0].spanA)
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].spanA)
      }

      // Draw bottom edge (Span B values) in reverse
      for (let i = points.length - 1; i >= 0; i--) {
        ctx.lineTo(points[i].x, points[i].spanB)
      }

      ctx.closePath()
      ctx.fillStyle = color
      ctx.fill()
    }

    // Draw bullish cloud (green) - more solid opacity like TradingView
    drawCloudSegment(bullishPoints, 'rgba(76, 175, 80, 0.1)')

    // Draw bearish cloud (red) - more solid opacity like TradingView  
    drawCloudSegment(bearishPoints, 'rgba(239, 83, 80, 0.1)')

    // Return false to allow default line drawing to continue
    return false
  }
}

export default ichimokuCloud

