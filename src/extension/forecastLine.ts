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
 * Forecast Line Overlay
 * 
 * For AI signal visualization - shows projected price movement
 * Features:
 * - Dashed projection line from current price to target
 * - Optional confidence cone (multiple fading lines)
 * - Target price and time labels
 */

const forecastLine: OverlayTemplate = {
  name: 'forecastLine',
  totalStep: 3, // 2 clicks: start and end point
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: true,
  needDefaultYAxisFigure: true,
  styles: {
    line: {
      color: '#9C27B0', // Purple for AI/forecast
      size: 2,
      style: 'dashed'
    }
  },
  createPointFigures: ({ coordinates, overlay, chart }) => {
    const figures: any[] = []

    if (coordinates.length === 0) return figures

    const points = overlay.points
    const precision = chart.getSymbol()?.pricePrecision ?? 2

    const startCoord = coordinates[0]
    const startPrice = points[0]?.value || 0

    // Primary color
    const forecastColor = '#9C27B0' // Purple
    const textColor = '#ffffff'

    // Start point marker
    figures.push({
      type: 'circle',
      attrs: {
        x: startCoord.x,
        y: startCoord.y,
        r: 6
      },
      styles: {
        style: 'fill',
        color: forecastColor
      }
    })

    // Start label
    figures.push({
      type: 'text',
      ignoreEvent: true,
      attrs: {
        x: startCoord.x + 10,
        y: startCoord.y,
        text: `Start: ${utils.formatPrecision(startPrice, precision)}`,
        baseline: 'middle',
        align: 'left'
      },
      styles: {
        color: textColor,
        backgroundColor: forecastColor,
        borderRadius: 4,
        paddingLeft: 6,
        paddingRight: 6,
        paddingTop: 3,
        paddingBottom: 3,
        size: 11
      }
    })

    // Target point (second point)
    if (coordinates.length > 1 && points[1]) {
      const endCoord = coordinates[1]
      const endPrice = points[1].value || 0
      const priceDiff = endPrice - startPrice
      const percentDiff = (priceDiff / startPrice) * 100
      const isUp = priceDiff >= 0

      // Main forecast line (dashed)
      figures.push({
        type: 'line',
        attrs: {
          coordinates: [startCoord, endCoord]
        },
        styles: {
          style: 'dashed',
          color: forecastColor,
          size: 2,
          dashedValue: [8, 4]
        }
      })

      // Confidence cone lines (fainter lines above and below)
      const coneOffset = Math.abs(endCoord.y - startCoord.y) * 0.2

      // Upper confidence line
      figures.push({
        type: 'line',
        attrs: {
          coordinates: [
            startCoord,
            { x: endCoord.x, y: endCoord.y - coneOffset }
          ]
        },
        styles: {
          style: 'dashed',
          color: 'rgba(156, 39, 176, 0.3)',
          size: 1,
          dashedValue: [4, 4]
        }
      })

      // Lower confidence line
      figures.push({
        type: 'line',
        attrs: {
          coordinates: [
            startCoord,
            { x: endCoord.x, y: endCoord.y + coneOffset }
          ]
        },
        styles: {
          style: 'dashed',
          color: 'rgba(156, 39, 176, 0.3)',
          size: 1,
          dashedValue: [4, 4]
        }
      })

      // Confidence zone fill
      figures.push({
        type: 'polygon',
        ignoreEvent: true,
        attrs: {
          coordinates: [
            startCoord,
            { x: endCoord.x, y: endCoord.y - coneOffset },
            { x: endCoord.x, y: endCoord.y + coneOffset }
          ]
        },
        styles: {
          style: 'fill',
          color: 'rgba(156, 39, 176, 0.08)'
        }
      })

      // End point marker
      figures.push({
        type: 'circle',
        attrs: {
          x: endCoord.x,
          y: endCoord.y,
          r: 8
        },
        styles: {
          style: 'stroke_fill',
          color: forecastColor,
          borderColor: '#ffffff',
          borderSize: 2
        }
      })

      // Arrow head pointing to target
      const arrowSize = 12
      const angle = Math.atan2(endCoord.y - startCoord.y, endCoord.x - startCoord.x)
      const arrowCoords = [
        { x: endCoord.x, y: endCoord.y },
        {
          x: endCoord.x - arrowSize * Math.cos(angle - Math.PI / 6),
          y: endCoord.y - arrowSize * Math.sin(angle - Math.PI / 6)
        },
        {
          x: endCoord.x - arrowSize * Math.cos(angle + Math.PI / 6),
          y: endCoord.y - arrowSize * Math.sin(angle + Math.PI / 6)
        }
      ]

      figures.push({
        type: 'polygon',
        ignoreEvent: true,
        attrs: {
          coordinates: arrowCoords
        },
        styles: {
          style: 'fill',
          color: forecastColor
        }
      })

      // Target label
      const targetText = isUp
        ? `Target: ${utils.formatPrecision(endPrice, precision)} (+${percentDiff.toFixed(2)}%)`
        : `Target: ${utils.formatPrecision(endPrice, precision)} (${percentDiff.toFixed(2)}%)`

      figures.push({
        type: 'text',
        ignoreEvent: true,
        attrs: {
          x: endCoord.x + 10,
          y: endCoord.y,
          text: targetText,
          baseline: 'middle',
          align: 'left'
        },
        styles: {
          color: textColor,
          backgroundColor: isUp ? '#26a69a' : '#ef5350',
          borderRadius: 4,
          paddingLeft: 6,
          paddingRight: 6,
          paddingTop: 4,
          paddingBottom: 4,
          size: 12,
          weight: 'bold'
        }
      })

      // "FORECAST" label at midpoint
      const midX = (startCoord.x + endCoord.x) / 2
      const midY = (startCoord.y + endCoord.y) / 2
      figures.push({
        type: 'text',
        ignoreEvent: true,
        attrs: {
          x: midX,
          y: midY - 20,
          text: '📊 FORECAST',
          baseline: 'bottom',
          align: 'center'
        },
        styles: {
          color: textColor,
          backgroundColor: 'rgba(156, 39, 176, 0.85)',
          borderRadius: 4,
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 4,
          paddingBottom: 4,
          size: 11
        }
      })
    }

    return figures
  }
}

export default forecastLine
