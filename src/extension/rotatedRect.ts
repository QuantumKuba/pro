import { OverlayTemplate } from 'klinecharts'

const rotatedRect: OverlayTemplate = {
  name: 'rotatedRect',
  totalStep: 3,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: true,
  needDefaultYAxisFigure: true,
  styles: {
    polygon: {
      color: 'rgba(22, 119, 255, 0.15)'
    }
  },
  createPointFigures: ({ coordinates }) => {
    if (coordinates.length > 1) {
      const p1 = coordinates[0]
      const p2 = coordinates[1]
      if (coordinates.length === 2) {
         return [
            {
              type: 'line',
              attrs: { coordinates: [p1, p2] }
            }
         ]
      }
      const p3 = coordinates[2]
      
      const dx12 = p2.x - p1.x
      const dy12 = p2.y - p1.y
      
      const dx13 = p3.x - p1.x
      const dy13 = p3.y - p1.y
      
      const dot = dx12 * dx13 + dy12 * dy13
      const lenSq = dx12 * dx12 + dy12 * dy12
      
      if (lenSq === 0) return []

      const t = dot / lenSq
      
      const projX = p1.x + t * dx12
      const projY = p1.y + t * dy12
      
      const vPerpX = p3.x - projX
      const vPerpY = p3.y - projY
      
      const c1 = p1
      const c2 = p2
      const c3 = { x: p2.x + vPerpX, y: p2.y + vPerpY }
      const c4 = { x: p1.x + vPerpX, y: p1.y + vPerpY }
      
      return [
        {
          type: 'polygon',
          attrs: {
            coordinates: [c1, c2, c3, c4]
          },
          styles: { style: 'stroke_fill' }
        }
      ]
    }
    return []
  }
}

export default rotatedRect
