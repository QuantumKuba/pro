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
        const dataIndexDiff = Math.abs((p2.dataIndex || 0) - (p1.dataIndex || 0))
        
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
            styles: { style: 'stroke_fill' }
          },
          {
            type: 'text',
            attrs: {
              x: coordinates[1].x,
              y: coordinates[1].y,
              text: text,
              align: 'left',
              baseline: 'bottom'
            }
          }
        ]
      }
    }
    return []
  }
}

export default measure
