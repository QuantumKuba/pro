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

import { Component, createSignal, onCleanup } from 'solid-js'

export interface PaneSplitterProps {
  direction: 'horizontal' | 'vertical'
  /** Called on every mouse move during drag with the total accumulated delta */
  onDrag: (totalDelta: number) => void
  /** Called when drag ends with the final total delta */
  onDragEnd: (totalDelta: number) => void
  onDoubleClick?: () => void
}

const PaneSplitter: Component<PaneSplitterProps> = (props) => {
  const [dragging, setDragging] = createSignal(false)
  let startPos = 0
  let totalDelta = 0

  const onStart = (e: MouseEvent | TouchEvent) => {
    if ('touches' in e && e.touches.length > 1) return
    if (e.cancelable) {
      e.preventDefault()
    }
    e.stopPropagation()
    setDragging(true)
    
    let clientX, clientY
    if ('touches' in e) {
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else {
      clientX = (e as MouseEvent).clientX
      clientY = (e as MouseEvent).clientY
    }

    startPos = props.direction === 'horizontal' ? clientX : clientY
    totalDelta = 0
    document.addEventListener('mousemove', onMove)
    document.addEventListener('touchmove', onMove, { passive: false })
    document.addEventListener('mouseup', onEnd)
    document.addEventListener('touchend', onEnd)
    document.body.style.cursor = props.direction === 'horizontal' ? 'col-resize' : 'row-resize'
    document.body.style.userSelect = 'none'
  }

  const onMove = (e: MouseEvent | TouchEvent) => {
    if (e.cancelable) {
      e.preventDefault()
    }
    let clientX, clientY
    if ('touches' in e) {
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else {
      clientX = (e as MouseEvent).clientX
      clientY = (e as MouseEvent).clientY
    }
    const currentPos = props.direction === 'horizontal' ? clientX : clientY
    totalDelta = currentPos - startPos
    props.onDrag(totalDelta)
  }

  const onEnd = () => {
    setDragging(false)
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('touchmove', onMove)
    document.removeEventListener('mouseup', onEnd)
    document.removeEventListener('touchend', onEnd)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    props.onDragEnd(totalDelta)
    totalDelta = 0
  }

  const onDblClick = (e: MouseEvent) => {
    e.preventDefault()
    props.onDoubleClick?.()
  }

  onCleanup(() => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('touchmove', onMove)
    document.removeEventListener('mouseup', onEnd)
    document.removeEventListener('touchend', onEnd)
  })

  return (
    <div
      class={`layout-splitter layout-splitter--${props.direction}`}
      classList={{ 'layout-splitter--active': dragging() }}
      onMouseDown={onStart}
      onTouchStart={onStart}
      onDblClick={onDblClick}
    >
      <div class="layout-splitter__handle" />
    </div>
  )
}

export default PaneSplitter
