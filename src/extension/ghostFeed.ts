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

import { OverlayTemplate, utils } from 'klinecharts'

/**
 * Ghost Feed Overlay
 * 
 * Displays phantom/projected candles on the chart
 * Features:
 * - Semi-transparent candle rendering
 * - Different styling to distinguish from real data
 * - Can be populated via API for AI predictions
 */

const ghostFeed: OverlayTemplate = {
  name: 'ghostFeed',
  totalStep: 3, // 2 clicks to define a "ghost candle" (open and close price at same time)
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: true,
  needDefaultYAxisFigure: true,
  styles: {
    polygon: {
      color: 'rgba(103, 58, 183, 0.25)' // Purple ghost
    }
  },
  createPointFigures: ({ coordinates, overlay, chart }) => {
    const figures: any[] = []

    if (coordinates.length < 2) return figures

    const points = overlay.points
    const precision = chart.getSymbol()?.pricePrecision ?? 2

    // Get the two points that define the ghost candle
    const openCoord = coordinates[0]
    const closeCoord = coordinates[1]
    const openPrice = points[0]?.value || 0
    const closePrice = points[1]?.value || 0

    // Determine candle direction
    const isBullish = closePrice >= openPrice

    // Colors with transparency for ghost effect
    const bullishColor = 'rgba(38, 166, 154, 0.4)'
    const bearishColor = 'rgba(239, 83, 80, 0.4)'
    const bullishBorder = 'rgba(38, 166, 154, 0.8)'
    const bearishBorder = 'rgba(239, 83, 80, 0.8)'

    const fillColor = isBullish ? bullishColor : bearishColor
    const borderColor = isBullish ? bullishBorder : bearishBorder
    const textColor = '#ffffff'

    // Calculate candle body dimensions
    const candleWidth = 20 // Fixed width for ghost candle
    const left = openCoord.x - candleWidth / 2
    const right = openCoord.x + candleWidth / 2

    const bodyTop = Math.min(openCoord.y, closeCoord.y)
    const bodyBottom = Math.max(openCoord.y, closeCoord.y)

    // Candle body with dashed border for ghost effect
    figures.push({
      type: 'polygon',
      attrs: {
        coordinates: [
          { x: left, y: bodyTop },
          { x: right, y: bodyTop },
          { x: right, y: bodyBottom },
          { x: left, y: bodyBottom }
        ]
      },
      styles: {
        style: 'stroke_fill',
        color: fillColor,
        borderColor: borderColor,
        borderSize: 2,
        borderStyle: 'dashed',
        borderDashedValue: [4, 2]
      }
    })

    // Wick (assume some extension above and below)
    const wickExtension = Math.abs(closeCoord.y - openCoord.y) * 0.3 || 10
    const wickTop = bodyTop - wickExtension
    const wickBottom = bodyBottom + wickExtension

    // Upper wick
    figures.push({
      type: 'line',
      ignoreEvent: true,
      attrs: {
        coordinates: [
          { x: openCoord.x, y: wickTop },
          { x: openCoord.x, y: bodyTop }
        ]
      },
      styles: {
        style: 'dashed',
        color: borderColor,
        size: 1,
        dashedValue: [3, 2]
      }
    })

    // Lower wick
    figures.push({
      type: 'line',
      ignoreEvent: true,
      attrs: {
        coordinates: [
          { x: openCoord.x, y: bodyBottom },
          { x: openCoord.x, y: wickBottom }
        ]
      },
      styles: {
        style: 'dashed',
        color: borderColor,
        size: 1,
        dashedValue: [3, 2]
      }
    })

    // Ghost indicator icon/label
    figures.push({
      type: 'text',
      ignoreEvent: true,
      attrs: {
        x: openCoord.x,
        y: wickTop - 10,
        text: '👻',
        baseline: 'bottom',
        align: 'center'
      },
      styles: {
        size: 16
      }
    })

    // Price labels
    const priceDiff = closePrice - openPrice
    const percentDiff = (priceDiff / openPrice) * 100
    const labelText = isBullish
      ? `+${utils.formatPrecision(priceDiff, precision)} (+${percentDiff.toFixed(2)}%)`
      : `${utils.formatPrecision(priceDiff, precision)} (${percentDiff.toFixed(2)}%)`

    figures.push({
      type: 'text',
      ignoreEvent: true,
      attrs: {
        x: right + 8,
        y: (bodyTop + bodyBottom) / 2,
        text: `Ghost: ${labelText}`,
        baseline: 'middle',
        align: 'left'
      },
      styles: {
        color: textColor,
        backgroundColor: 'rgba(103, 58, 183, 0.85)',
        borderRadius: 4,
        paddingLeft: 6,
        paddingRight: 6,
        paddingTop: 3,
        paddingBottom: 3,
        size: 11
      }
    })

    // Open price label
    figures.push({
      type: 'text',
      ignoreEvent: true,
      attrs: {
        x: left - 4,
        y: openCoord.y,
        text: `O: ${utils.formatPrecision(openPrice, precision)}`,
        baseline: 'middle',
        align: 'right'
      },
      styles: {
        color: '#aaaaaa',
        size: 10
      }
    })

    // Close price label
    figures.push({
      type: 'text',
      ignoreEvent: true,
      attrs: {
        x: left - 4,
        y: closeCoord.y,
        text: `C: ${utils.formatPrecision(closePrice, precision)}`,
        baseline: 'middle',
        align: 'right'
      },
      styles: {
        color: '#aaaaaa',
        size: 10
      }
    })

    return figures
  }
}

export default ghostFeed
