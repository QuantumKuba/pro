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

import { OverlayTemplate } from 'klinecharts'

const measure: OverlayTemplate = {
  name: 'measure',
  totalStep: 3,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: true,
  needDefaultYAxisFigure: true,
  styles: {
    polygon: {
      color: 'rgba(22, 119, 255, 0.15)'
    }
  },
  createPointFigures: ({ coordinates, overlay, chart }) => {
    if (coordinates.length > 1) {
      const points = overlay.points
      if (points[0] && points[1]) {
        const p1 = points[0]
        const p2 = points[1]
        const precision = chart.getSymbol()?.pricePrecision ?? 2
        
        const valueDiff = (p2.value || 0) - (p1.value || 0)
        const percentDiff = (valueDiff / (p1.value || 1)) * 100
        
        let dataIndexDiff = Math.abs((p2.dataIndex || 0) - (p1.dataIndex || 0))
        // If dataIndex is not available or 0 (which might be incorrect if points are different), try to calculate from dataList
        if (dataIndexDiff === 0 && p1.timestamp && p2.timestamp && p1.timestamp !== p2.timestamp) {
          const dataList = chart.getDataList()
          const t1 = p1.timestamp
          const t2 = p2.timestamp
          const i1 = dataList.findIndex(d => d.timestamp === t1)
          const i2 = dataList.findIndex(d => d.timestamp === t2)
          if (i1 > -1 && i2 > -1) {
            dataIndexDiff = Math.abs(i2 - i1)
          }
        }
        
        // Time diff
        const timeDiff = Math.abs((p2.timestamp || 0) - (p1.timestamp || 0))
        
        // Format
        const valueText = valueDiff.toFixed(precision)
        const percentText = `${percentDiff >= 0 ? '+' : ''}${percentDiff.toFixed(2)}%`
        const barsText = `${dataIndexDiff} bars`
        
        // Simple time format
        const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24))
        const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
        const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60))
        
        let timeText = ''
        if (days > 0) timeText += `${days}d `
        if (hours > 0) timeText += `${hours}h `
        if (minutes > 0) timeText += `${minutes}m`
        if (timeText === '') timeText = '0m'

        const text = `${valueText} (${percentText}) ${barsText} ${timeText}`

        const isNegative = valueDiff < 0
        const fillColor = isNegative ? 'rgba(255, 77, 79, 0.15)' : 'rgba(22, 119, 255, 0.15)'
        const borderColor = isNegative ? '#ff4d4f' : '#1677ff'
        const textBgColor = isNegative ? 'rgba(255, 77, 79, 0.85)' : 'rgba(22, 119, 255, 0.85)'
        const textColor = '#fff'

        // compute arrow positions (center-left and center-right inside the box)
        const leftX = Math.min(coordinates[0].x, coordinates[1].x)
        const rightX = Math.max(coordinates[0].x, coordinates[1].x)
        const topY = Math.min(coordinates[0].y, coordinates[1].y)
        const bottomY = Math.max(coordinates[0].y, coordinates[1].y)
        const midY = (topY + bottomY) / 2

        const midX = (leftX + rightX) / 2
        const arrowSize = Math.min(12, Math.max(6, Math.abs(bottomY - topY) * 0.12))

        const makeArrow = (cx: number, cy: number, size: number, dir: 'up' | 'down' | 'left' | 'right') => {
          const half = size / 2
          switch (dir) {
            case 'up':
              return [
                { x: cx, y: cy - half },
                { x: cx - half, y: cy + half },
                { x: cx + half, y: cy + half }
              ]
            case 'down':
              return [
                { x: cx, y: cy + half },
                { x: cx - half, y: cy - half },
                { x: cx + half, y: cy - half }
              ]
            case 'left':
              return [
                { x: cx - half, y: cy },
                { x: cx + half, y: cy - half },
                { x: cx + half, y: cy + half }
              ]
            case 'right':
            default:
              return [
                { x: cx + half, y: cy },
                { x: cx - half, y: cy - half },
                { x: cx - half, y: cy + half }
              ]
          }
        }

        const horizDir = (coordinates[1].x - coordinates[0].x) >= 0 ? 'right' : 'left'
        const vertDir: 'up' | 'down' = isNegative ? 'down' : 'up'

        const padding = Math.max(4, arrowSize * 0.5)

        // Horizontal shaft spans left->right (inset by padding so heads fit)
        const hStartX = leftX + padding
        const hEndX = rightX - padding
        const horizShaft = { start: { x: hStartX, y: midY }, end: { x: hEndX, y: midY } }

        // Place horizontal head at the end corresponding to direction
        const headHx = horizDir === 'right' ? hEndX : hStartX
        const headHy = midY
        const tri1 = makeArrow(headHx, headHy, arrowSize, horizDir)

        // Vertical shaft spans top->bottom (inset by padding)
        const vStartY = topY + padding
        const vEndY = bottomY - padding
        const vertShaft = { start: { x: midX, y: vStartY }, end: { x: midX, y: vEndY } }

        // Place vertical head at the end corresponding to direction (up -> head at top, down -> head at bottom)
        const headVx = midX
        const headVy = vertDir === 'up' ? vStartY : vEndY
        const tri2 = makeArrow(headVx, headVy, arrowSize, vertDir)

        return [
          {
            type: 'polygon',
            attrs: {
              coordinates: [
                coordinates[0],
                { x: coordinates[1].x, y: coordinates[0].y },
                coordinates[1],
                { x: coordinates[0].x, y: coordinates[1].y }
              ]
            },
            styles: {
              style: 'stroke_fill',
              color: fillColor,
              borderColor: borderColor,
              borderWidth: 2,
              borderRadius: 8
            }
          },
          {
            type: 'text',
            ignoreEvent: true,
            attrs: ((): any => {
              const offset = Math.max(6, arrowSize / 2 + 4)
              const boxWidth = Math.abs(rightX - leftX)
              const boxHeight = Math.abs(bottomY - topY)
              const paddingX = Math.max(10, boxWidth * 0.04)
              const paddingY = Math.max(4, boxHeight * 0.04)
              const radius = 6
              // For y-axis direction: if vertical arrow points down (negative), place text below box;
              // if it points up (positive), place text above box.
              if (vertDir === 'down') {
                return {
                  x: midX,
                  y: bottomY + offset,
                  text: text,
                  align: 'center',
                  baseline: 'top',
                  backgroundColor: textBgColor,
                  color: textColor,
                  borderRadius: radius,
                  paddingX,
                  paddingY,
                  fontWeight: 'bold',
                  fontSize: 14,
                  borderColor: borderColor,
                  borderWidth: 2
                }
              }
              return {
                x: midX,
                y: topY - offset,
                text: text,
                align: 'center',
                baseline: 'bottom',
                backgroundColor: textBgColor,
                color: textColor,
                borderRadius: radius,
                paddingX,
                paddingY,
                fontWeight: 'bold',
                fontSize: 14,
                borderColor: borderColor,
                borderWidth: 2
              }
            })()
          },
          {
            type: 'line',
            ignoreEvent: true,
            attrs: [
              { coordinates: [ horizShaft.start, horizShaft.end ] }
            ],
            styles: { style: 'stroke', color: fillColor }
          },
          {
            type: 'polygon',
            ignoreEvent: true,
            attrs: {
              coordinates: tri1
            },
            styles: { style: 'fill', color: fillColor }
          },
          {
            type: 'line',
            ignoreEvent: true,
            attrs: [
              { coordinates: [ vertShaft.start, vertShaft.end ] }
            ],
            styles: { style: 'stroke', color: fillColor }
          },
          {
            type: 'polygon',
            ignoreEvent: true,
            attrs: {
              coordinates: tri2
            },
            styles: { style: 'fill', color: fillColor }
          }
        ]
      }
    }
    return []
  }
}

export default measure
