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

const brush: OverlayTemplate = {
  name: 'brush',
  totalStep: Number.MAX_SAFE_INTEGER,
  needDefaultPointFigure: false,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  styles: {
    line: {
      style: 'solid',
      size: 2,
      color: '#2196F3'
    }
  },
  createPointFigures: ({ coordinates }) => {
    // Filter out any undefined or invalid coordinates
    const validCoords = coordinates.filter(c => c && typeof c.x === 'number' && typeof c.y === 'number')
    if (validCoords.length < 2) {
      return []
    }
    return [
      {
        type: 'line',
        attrs: { coordinates: validCoords },
        ignoreEvent: true
      }
    ]
  }
}

export default brush
