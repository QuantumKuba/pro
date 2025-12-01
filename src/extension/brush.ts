import { OverlayTemplate } from 'klinecharts'

const brush: OverlayTemplate = {
  name: 'brush',
  totalStep: Number.MAX_SAFE_INTEGER,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: true,
  needDefaultYAxisFigure: true,
  createPointFigures: ({ coordinates }) => {
    return [
      {
        type: 'line',
        attrs: { coordinates }
      }
    ]
  }
}

export default brush
