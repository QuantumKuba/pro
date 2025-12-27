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
 * Long Position Overlay - TradingView Style
 * 
 * Allows traders to:
 * - Set entry price (first click)
 * - Set take profit (second click - above entry for long, also defines right edge)
 * - Set stop loss (third click - below entry for long)
 * - Visualize risk/reward ratio
 * - Drag to adjust TP/SL levels
 */

const longPosition: OverlayTemplate = {
  name: 'longPosition',
  totalStep: 4, // 3 clicks: entry, TP, SL
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: true,
  needDefaultYAxisFigure: true,
  styles: {
    polygon: {
      color: 'rgba(38, 166, 154, 0.15)'
    }
  },
  createPointFigures: ({ coordinates, overlay, chart }) => {
    const figures: any[] = []

    if (coordinates.length === 0) return figures

    const points = overlay.points
    const precision = chart.getSymbol()?.pricePrecision ?? 2

    // Get entry point (always the first point)
    const entryCoord = coordinates[0]
    const entryPrice = points[0]?.value || 0

    // Colors
    const profitColor = '#26a69a' // Green for profit
    const lossColor = '#ef5350'   // Red for loss
    const entryColor = '#2196F3'  // Blue for entry
    const textColor = '#ffffff'

    // Determine box boundaries
    // startX is always entry x, endX is the TP point's x (second click defines width)
    const startX = entryCoord.x
    const endX = coordinates[1]?.x ?? entryCoord.x

    // Only draw entry line while waiting for TP click
    if (coordinates.length === 1) {
      figures.push({
        type: 'line',
        attrs: {
          coordinates: [
            { x: startX, y: entryCoord.y },
            { x: startX + 100, y: entryCoord.y } // Short preview line
          ]
        },
        styles: {
          style: 'dashed',
          color: entryColor,
          size: 2
        }
      })
      return figures
    }

    // Entry line (from startX to endX)
    figures.push({
      type: 'line',
      attrs: {
        coordinates: [
          { x: startX, y: entryCoord.y },
          { x: endX, y: entryCoord.y }
        ]
      },
      styles: {
        style: 'dashed',
        color: entryColor,
        size: 2
      }
    })

    // Entry label
    figures.push({
      type: 'text',
      ignoreEvent: true,
      attrs: {
        x: startX + 5,
        y: entryCoord.y - 6,
        text: `Entry: ${utils.formatPrecision(entryPrice, precision)}`,
        baseline: 'bottom',
        align: 'left'
      },
      styles: {
        color: textColor,
        backgroundColor: entryColor,
        borderRadius: 4,
        paddingLeft: 6,
        paddingRight: 6,
        paddingTop: 3,
        paddingBottom: 3,
        size: 12
      }
    })

    // Take Profit (second point - above entry for long)
    if (coordinates.length > 1 && points[1]) {
      const tpCoord = coordinates[1]
      const tpPrice = points[1].value || 0
      const profitDiff = tpPrice - entryPrice
      const profitPercent = (profitDiff / entryPrice) * 100

      // TP zone (shaded area between entry and TP)
      figures.push({
        type: 'polygon',
        attrs: {
          coordinates: [
            { x: startX, y: entryCoord.y },
            { x: endX, y: entryCoord.y },
            { x: endX, y: tpCoord.y },
            { x: startX, y: tpCoord.y }
          ]
        },
        styles: {
          style: 'fill',
          color: 'rgba(38, 166, 154, 0.15)'
        }
      })

      // TP line
      figures.push({
        type: 'line',
        attrs: {
          coordinates: [
            { x: startX, y: tpCoord.y },
            { x: endX, y: tpCoord.y }
          ]
        },
        styles: {
          style: 'solid',
          color: profitColor,
          size: 2
        }
      })

      // TP label
      figures.push({
        type: 'text',
        ignoreEvent: true,
        attrs: {
          x: startX + 5,
          y: tpCoord.y - 6,
          text: `TP: ${utils.formatPrecision(tpPrice, precision)} (+${profitPercent.toFixed(2)}%)`,
          baseline: 'bottom',
          align: 'left'
        },
        styles: {
          color: textColor,
          backgroundColor: profitColor,
          borderRadius: 4,
          paddingLeft: 6,
          paddingRight: 6,
          paddingTop: 3,
          paddingBottom: 3,
          size: 12
        }
      })
    }

    // Stop Loss (third point - below entry for long)
    if (coordinates.length > 2 && points[2]) {
      const slCoord = coordinates[2]
      const slPrice = points[2].value || 0
      const tpPrice = points[1]?.value || entryPrice
      const lossDiff = entryPrice - slPrice
      const lossPercent = (lossDiff / entryPrice) * 100

      // SL zone (shaded area between entry and SL)
      figures.push({
        type: 'polygon',
        attrs: {
          coordinates: [
            { x: startX, y: entryCoord.y },
            { x: endX, y: entryCoord.y },
            { x: endX, y: slCoord.y },
            { x: startX, y: slCoord.y }
          ]
        },
        styles: {
          style: 'fill',
          color: 'rgba(239, 83, 80, 0.15)'
        }
      })

      // SL line
      figures.push({
        type: 'line',
        attrs: {
          coordinates: [
            { x: startX, y: slCoord.y },
            { x: endX, y: slCoord.y }
          ]
        },
        styles: {
          style: 'solid',
          color: lossColor,
          size: 2
        }
      })

      // SL label
      figures.push({
        type: 'text',
        ignoreEvent: true,
        attrs: {
          x: startX + 5,
          y: slCoord.y + 6,
          text: `SL: ${utils.formatPrecision(slPrice, precision)} (-${lossPercent.toFixed(2)}%)`,
          baseline: 'top',
          align: 'left'
        },
        styles: {
          color: textColor,
          backgroundColor: lossColor,
          borderRadius: 4,
          paddingLeft: 6,
          paddingRight: 6,
          paddingTop: 3,
          paddingBottom: 3,
          size: 12
        }
      })

      // Calculate Risk/Reward Ratio
      const reward = tpPrice - entryPrice
      const risk = entryPrice - slPrice
      const rrRatio = risk > 0 ? (reward / risk).toFixed(2) : '∞'

      // R/R label in the center of the box
      const centerX = (startX + endX) / 2
      const centerY = (entryCoord.y + (coordinates[1]?.y || entryCoord.y)) / 2
      figures.push({
        type: 'text',
        ignoreEvent: true,
        attrs: {
          x: centerX,
          y: centerY,
          text: `R/R: 1:${rrRatio}`,
          baseline: 'middle',
          align: 'center'
        },
        styles: {
          color: '#ffffff',
          backgroundColor: 'rgba(33, 150, 243, 0.9)',
          borderRadius: 6,
          paddingLeft: 10,
          paddingRight: 10,
          paddingTop: 6,
          paddingBottom: 6,
          size: 14,
          weight: 'bold'
        }
      })

      // Position type indicator
      figures.push({
        type: 'text',
        ignoreEvent: true,
        attrs: {
          x: endX - 5,
          y: entryCoord.y,
          text: 'LONG',
          baseline: 'middle',
          align: 'right'
        },
        styles: {
          color: '#ffffff',
          backgroundColor: profitColor,
          borderRadius: 4,
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 4,
          paddingBottom: 4,
          size: 12,
          weight: 'bold'
        }
      })
    }

    return figures
  }
}

export default longPosition
