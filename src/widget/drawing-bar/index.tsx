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

import { Component, createMemo, createSignal, onMount, onCleanup, Show, For } from 'solid-js'

import { OverlayCreate, OverlayMode } from 'klinecharts'

import { List } from '../../component'
import {
  createSingleLineOptions, createMoreLineOptions,
  createPolygonOptions, createFibonacciOptions, createWaveOptions,
  createMagnetOptions, createDrawingOptions, createTradingToolsOptions,
  Icon
} from './icons'

export interface DrawingBarApi {
  clearSelection: () => void
}

export interface DrawingBarProps {
  locale: string
  ref?: (api: DrawingBarApi) => void
  onDrawingItemClick: (value: string | OverlayCreate) => void
  onModeChange: (mode: string) => void,
  onLockChange: (lock: boolean) => void
  onVisibleChange: (visible: boolean) => void
  onRemoveClick: (groupId: string) => void
}

const GROUP_ID = 'drawing_tools'

// Height constants for overflow calculation
const ITEM_HEIGHT = 42
const SPLIT_LINE_HEIGHT = 13  // 1px line + 6px margin top + 6px margin bottom
const OVERFLOW_BTN_HEIGHT = 42
const PADDING_TOP = 6

// Ripple effect helper
const createRipple = (event: MouseEvent, element: HTMLElement) => {
  const rect = element.getBoundingClientRect()
  const ripple = document.createElement('span')
  ripple.className = 'ripple'
  const size = Math.max(rect.width, rect.height)
  ripple.style.width = ripple.style.height = `${size}px`
  ripple.style.left = `${event.clientX - rect.left - size / 2}px`
  ripple.style.top = `${event.clientY - rect.top - size / 2}px`
  element.appendChild(ripple)
  setTimeout(() => ripple.remove(), 500)
}

/**
 * The drawing bar has this layout (each entry is an "element"):
 *   0: overlay[0] (singleLine)
 *   1: overlay[1] (moreLine)
 *   2: overlay[2] (polygon)
 *   3: overlay[3] (drawing)
 *   4: overlay[4] (fibonacci)
 *   5: overlay[5] (wave)
 *   6: overlay[6] (trading)
 *   7: measure
 *   8: split-line  (first separator)
 *   9: magnet
 *  10: lock
 *  11: visible
 *  12: split-line  (second separator)
 *  13: remove
 *
 * When computing overflow, we walk through these elements, accumulating heights.
 * Elements 0-7 and 9-11 and 13 are items (42px each).
 * Elements 8 and 12 are split-lines (13px each).
 */

// Element types for height computation
type ElementType = 'item' | 'split'
const ELEMENT_LAYOUT: ElementType[] = [
  'item', 'item', 'item', 'item', 'item', 'item', 'item', // 7 overlays
  'item',       // measure
  'split',      // separator 1
  'item',       // magnet
  'item',       // lock
  'item',       // visible
  'split',      // separator 2
  'item'        // remove
]

function computeMaxVisibleElements(containerHeight: number): number {
  const availableHeight = containerHeight - PADDING_TOP
  const totalElements = ELEMENT_LAYOUT.length

  // Check if everything fits without overflow button
  let totalNeeded = 0
  for (let i = 0; i < totalElements; i++) {
    totalNeeded += ELEMENT_LAYOUT[i] === 'split' ? SPLIT_LINE_HEIGHT : ITEM_HEIGHT
  }
  if (totalNeeded <= availableHeight) {
    return totalElements // no overflow needed
  }

  // Reserve space for the overflow button
  const spaceForItems = availableHeight - OVERFLOW_BTN_HEIGHT
  let used = 0
  for (let i = 0; i < totalElements; i++) {
    const h = ELEMENT_LAYOUT[i] === 'split' ? SPLIT_LINE_HEIGHT : ITEM_HEIGHT
    if (used + h > spaceForItems) {
      return i
    }
    used += h
  }
  return totalElements
}

const DrawingBar: Component<DrawingBarProps> = props => {
  let barRef: HTMLDivElement | undefined

  const [singleLineIcon, setSingleLineIcon] = createSignal('horizontalStraightLine')
  const [moreLineIcon, setMoreLineIcon] = createSignal('priceChannelLine')
  const [polygonIcon, setPolygonIcon] = createSignal('circle')
  const [drawingIcon, setDrawingIcon] = createSignal('rect')
  const [fibonacciIcon, setFibonacciIcon] = createSignal('fibonacciLine')
  const [waveIcon, setWaveIcon] = createSignal('xabcd')
  const [tradingIcon, setTradingIcon] = createSignal('longPosition')

  const [modeIcon, setModeIcon] = createSignal('weak_magnet')
  const [mode, setMode] = createSignal('normal')

  const [lock, setLock] = createSignal(false)

  const [visible, setVisible] = createSignal(true)

  const [popoverKey, setPopoverKey] = createSignal('')

  const [selectedIcon, setSelectedIcon] = createSignal('')

  // Overflow state
  const [maxVisible, setMaxVisible] = createSignal(ELEMENT_LAYOUT.length)
  const [overflowOpen, setOverflowOpen] = createSignal(false)
  const [overflowSubKey, setOverflowSubKey] = createSignal('')

  const needsOverflow = () => maxVisible() < ELEMENT_LAYOUT.length

  // Expose API to parent for clearing selection when drawing completes
  props.ref?.({
    clearSelection: () => setSelectedIcon('')
  })

  // ResizeObserver for vertical overflow detection
  onMount(() => {
    if (barRef && typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(entries => {
        for (const entry of entries) {
          const h = entry.contentRect.height
          setMaxVisible(computeMaxVisibleElements(h))
        }
      })
      ro.observe(barRef)
      onCleanup(() => ro.disconnect())
    }

    // Close overflow dropdown on outside click
    const closeOverflow = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (overflowOpen() && !target.closest('.drawing-overflow')) {
        setOverflowOpen(false)
      }
    }
    document.addEventListener('click', closeOverflow)
    onCleanup(() => document.removeEventListener('click', closeOverflow))
  })

  const overlays = createMemo(() => {
    return [
      { key: 'singleLine', icon: singleLineIcon(), list: createSingleLineOptions(props.locale), setter: setSingleLineIcon },
      { key: 'moreLine', icon: moreLineIcon(), list: createMoreLineOptions(props.locale), setter: setMoreLineIcon },
      { key: 'polygon', icon: polygonIcon(), list: createPolygonOptions(props.locale), setter: setPolygonIcon },
      { key: 'drawing', icon: drawingIcon(), list: createDrawingOptions(props.locale), setter: setDrawingIcon },
      { key: 'fibonacci', icon: fibonacciIcon(), list: createFibonacciOptions(props.locale), setter: setFibonacciIcon },
      { key: 'wave', icon: waveIcon(), list: createWaveOptions(props.locale), setter: setWaveIcon },
      { key: 'trading', icon: tradingIcon(), list: createTradingToolsOptions(props.locale), setter: setTradingIcon }
    ]
  })

  const modes = createMemo(() => createMagnetOptions(props.locale))

  // Helper: is element index visible?
  const isElementVisible = (index: number) => index < maxVisible()

  // Build the ordered list of all elements for the overflow dropdown
  // Each element has a type and render function
  const allElements = createMemo(() => {
    const items: { index: number; type: ElementType; render: 'overlay' | 'measure' | 'split' | 'magnet' | 'lock' | 'visible' | 'remove'; overlayIdx?: number }[] = []
    // Overlays: elements 0-6
    overlays().forEach((_, i) => {
      items.push({ index: i, type: 'item', render: 'overlay', overlayIdx: i })
    })
    // Measure: element 7
    items.push({ index: 7, type: 'item', render: 'measure' })
    // Split: element 8
    items.push({ index: 8, type: 'split', render: 'split' })
    // Magnet: element 9
    items.push({ index: 9, type: 'item', render: 'magnet' })
    // Lock: element 10
    items.push({ index: 10, type: 'item', render: 'lock' })
    // Visible: element 11
    items.push({ index: 11, type: 'item', render: 'visible' })
    // Split: element 12
    items.push({ index: 12, type: 'split', render: 'split' })
    // Remove: element 13
    items.push({ index: 13, type: 'item', render: 'remove' })
    return items
  })

  // Overflow elements (index >= maxVisible, excluding split-lines for the dropdown)
  const overflowElements = () => allElements().filter(el => !isElementVisible(el.index) && el.type !== 'split')

  // --- Render helpers for overlay items ---
  const renderOverlayItem = (item: ReturnType<typeof overlays>[0], idx: number) => (
    <div
      class="item"
      tabIndex={0}
      onBlur={() => { setPopoverKey('') }}>
      <span
        class={`icon-overlay ${selectedIcon() === item.icon ? 'selected' : ''}`}
        onClick={(e) => {
          createRipple(e, e.currentTarget as HTMLElement)
          setSelectedIcon(item.icon)
          props.onDrawingItemClick({ groupId: GROUP_ID, name: item.icon, visible: visible(), lock: lock(), mode: mode() as OverlayMode })
        }}>
        <Icon name={item.icon} />
      </span>
      <div
        class="icon-arrow"
        onClick={() => {
          if (item.key === popoverKey()) {
            setPopoverKey('')
          } else {
            setPopoverKey(item.key)
          }
        }}>
        <svg
          class={item.key === popoverKey() ? 'rotate' : ''}
          viewBox="0 0 4 6">
          <path d="M1.07298,0.159458C0.827521,-0.0531526,0.429553,-0.0531526,0.184094,0.159458C-0.0613648,0.372068,-0.0613648,0.716778,0.184094,0.929388L2.61275,3.03303L0.260362,5.07061C0.0149035,5.28322,0.0149035,5.62793,0.260362,5.84054C0.505822,6.05315,0.903789,6.05315,1.14925,5.84054L3.81591,3.53075C4.01812,3.3556,4.05374,3.0908,3.92279,2.88406C3.93219,2.73496,3.87113,2.58315,3.73964,2.46925L1.07298,0.159458Z" stroke="none" stroke-opacity="0" />
        </svg>
      </div>
      {
        item.key === popoverKey() && (
          <List class="list">
            {
              item.list.map(data => (
                <li
                  onClick={() => {
                    item.setter(data.key)
                    setSelectedIcon(data.key)
                    props.onDrawingItemClick({ name: data.key, lock: lock(), mode: mode() as OverlayMode })
                    setPopoverKey('')
                  }}>
                  <span class="icon-overlay">
                    <Icon name={data.key} />
                  </span>
                  <span>{data.text}</span>
                </li>
              ))
            }
          </List>
        )
      }
    </div>
  )

  // Render an overlay item inside the overflow dropdown with expandable sub-list
  const renderOverflowOverlayItem = (item: ReturnType<typeof overlays>[0]) => (
    <div
      class={`drawing-overflow-item has-submenu ${selectedIcon() === item.icon ? 'selected' : ''} ${overflowSubKey() === item.key ? 'expanded' : ''}`}
      onClick={() => {
        // Toggle sub-menu open/closed instead of selecting the tool directly
        setOverflowSubKey(overflowSubKey() === item.key ? '' : item.key)
      }}>
      <span class="drawing-overflow-icon">
        <Icon name={item.icon} />
      </span>
      <svg class={`drawing-overflow-arrow ${overflowSubKey() === item.key ? 'rotate' : ''}`} viewBox="0 0 4 6">
        <path d="M1.07298,0.159458C0.827521,-0.0531526,0.429553,-0.0531526,0.184094,0.159458C-0.0613648,0.372068,-0.0613648,0.716778,0.184094,0.929388L2.61275,3.03303L0.260362,5.07061C0.0149035,5.28322,0.0149035,5.62793,0.260362,5.84054C0.505822,6.05315,0.903789,6.05315,1.14925,5.84054L3.81591,3.53075C4.01812,3.3556,4.05374,3.0908,3.92279,2.88406C3.93219,2.73496,3.87113,2.58315,3.73964,2.46925L1.07298,0.159458Z" stroke="none" stroke-opacity="0" />
      </svg>
      <Show when={overflowSubKey() === item.key}>
        <div class="drawing-overflow-submenu">
          {item.list.map(data => (
            <div
              class="drawing-overflow-submenu-item"
              onClick={(e) => {
                e.stopPropagation()
                item.setter(data.key)
                setSelectedIcon(data.key)
                props.onDrawingItemClick({ name: data.key, lock: lock(), mode: mode() as OverlayMode })
                setOverflowOpen(false)
                setOverflowSubKey('')
              }}>
              <span class="drawing-overflow-submenu-icon">
                <Icon name={data.key} />
              </span>
              <span>{data.text}</span>
            </div>
          ))}
        </div>
      </Show>
    </div>
  )

  return (
    <div
      ref={el => { barRef = el }}
      class="klinecharts-pro-drawing-bar">
      {/* Overlays: elements 0-6 */}
      <For each={overlays()}>
        {(item, idx) => (
          <Show when={isElementVisible(idx())}>
            {renderOverlayItem(item, idx())}
          </Show>
        )}
      </For>
      {/* Measure: element 7 */}
      <Show when={isElementVisible(7)}>
        <div class="item">
          <span
            class={`icon-overlay ${selectedIcon() === 'measure' ? 'selected' : ''}`}
            onClick={(e) => {
              createRipple(e, e.currentTarget as HTMLElement)
              setSelectedIcon('measure')
              props.onDrawingItemClick({ groupId: GROUP_ID, name: 'measure', visible: visible(), lock: lock(), mode: mode() as OverlayMode })
            }}>
            <Icon name="measure" />
          </span>
        </div>
      </Show>
      {/* Split line 1: element 8 */}
      <Show when={isElementVisible(8)}>
        <span class="split-line" />
      </Show>
      {/* Magnet: element 9 */}
      <Show when={isElementVisible(9)}>
        <div
          class="item"
          tabIndex={0}
          onBlur={() => { setPopoverKey('') }}>
          <span
            class={`icon-overlay ${mode() !== 'normal' ? 'selected' : ''}`}
            onClick={(e) => {
              createRipple(e, e.currentTarget as HTMLElement)
              let currentMode = modeIcon()
              if (mode() !== 'normal') {
                currentMode = 'normal'
              }
              setMode(currentMode)
              props.onModeChange(currentMode)
            }}>
            {
              modeIcon() === 'weak_magnet'
                ? <Icon name="weak_magnet" />
                : <Icon name="strong_magnet" />
            }
          </span>
          <div
            class="icon-arrow"
            onClick={() => {
              if (popoverKey() === 'mode') {
                setPopoverKey('')
              } else {
                setPopoverKey('mode')
              }
            }}>
            <svg
              class={popoverKey() === 'mode' ? 'rotate' : ''}
              viewBox="0 0 4 6">
              <path d="M1.07298,0.159458C0.827521,-0.0531526,0.429553,-0.0531526,0.184094,0.159458C-0.0613648,0.372068,-0.0613648,0.716778,0.184094,0.929388L2.61275,3.03303L0.260362,5.07061C0.0149035,5.28322,0.0149035,5.62793,0.260362,5.84054C0.505822,6.05315,0.903789,6.05315,1.14925,5.84054L3.81591,3.53075C4.01812,3.3556,4.05374,3.0908,3.92279,2.88406C3.93219,2.73496,3.87113,2.58315,3.73964,2.46925L1.07298,0.159458Z" stroke="none" stroke-opacity="0" />
            </svg>
          </div>
          {
            popoverKey() === 'mode' && (
              <List class="list">
                {
                  modes().map(data => (
                    <li
                      onClick={() => {
                        setModeIcon(data.key)
                        setMode(data.key)
                        props.onModeChange(data.key)
                        setPopoverKey('')
                      }}>
                      <span class="icon-overlay">
                        <Icon name={data.key} />
                      </span>
                      <span>{data.text}</span>
                    </li>
                  ))
                }
              </List>
            )
          }
        </div>
      </Show>
      {/* Lock: element 10 */}
      <Show when={isElementVisible(10)}>
        <div
          class="item">
          <span
            class={`icon-overlay ${lock() ? 'selected' : ''}`}
            onClick={(e) => {
              createRipple(e, e.currentTarget as HTMLElement)
              const currentLock = !lock()
              setLock(currentLock)
              props.onLockChange(currentLock)
            }}>
            {
              lock() ? <Icon name="lock" /> : <Icon name="unlock" />
            }
          </span>
        </div>
      </Show>
      {/* Visible: element 11 */}
      <Show when={isElementVisible(11)}>
        <div
          class="item">
          <span
            class={`icon-overlay ${!visible() ? 'selected' : ''}`}
            onClick={(e) => {
              createRipple(e, e.currentTarget as HTMLElement)
              const v = !visible()
              setVisible(v)
              props.onVisibleChange(v)
            }}>
            {
              visible() ? <Icon name="visible" /> : <Icon name="invisible" />
            }
          </span>
        </div>
      </Show>
      {/* Split line 2: element 12 */}
      <Show when={isElementVisible(12)}>
        <span class="split-line" />
      </Show>
      {/* Remove: element 13 */}
      <Show when={isElementVisible(13)}>
        <div
          class="item">
          <span
            class="icon-overlay"
            onClick={(e) => {
              createRipple(e, e.currentTarget as HTMLElement)
              props.onRemoveClick(GROUP_ID)
            }}>
            <Icon name="remove" />
          </span>
        </div>
      </Show>

      {/* Overflow dropdown button + menu */}
      <Show when={needsOverflow()}>
        <div class="drawing-overflow">
          <div
            class="drawing-overflow-btn"
            onClick={(e) => {
              e.stopPropagation()
              setOverflowOpen(v => !v)
            }}>
            <svg viewBox="0 0 20 20">
              <circle cx="10" cy="3" r="2" />
              <circle cx="10" cy="10" r="2" />
              <circle cx="10" cy="17" r="2" />
            </svg>
          </div>
          <Show when={overflowOpen()}>
            <div class="drawing-overflow-dropdown" onMouseLeave={() => setOverflowSubKey('')}>
              <For each={overflowElements()}>
                {(el) => {
                  if (el.render === 'overlay' && el.overlayIdx !== undefined) {
                    const item = overlays()[el.overlayIdx]
                    return renderOverflowOverlayItem(item)
                  }
                  if (el.render === 'measure') {
                    return (
                      <div
                        class={`drawing-overflow-item ${selectedIcon() === 'measure' ? 'selected' : ''}`}
                        onClick={() => {
                          setSelectedIcon('measure')
                          props.onDrawingItemClick({ groupId: GROUP_ID, name: 'measure', visible: visible(), lock: lock(), mode: mode() as OverlayMode })
                          setOverflowOpen(false)
                        }}>
                        <Icon name="measure" />
                      </div>
                    )
                  }
                  if (el.render === 'magnet') {
                    return (
                      <div
                        class={`drawing-overflow-item has-submenu ${mode() !== 'normal' ? 'selected' : ''} ${overflowSubKey() === 'mode' ? 'expanded' : ''}`}
                        onClick={() => {
                          // Toggle sub-menu open/closed instead of changing mode directly
                          setOverflowSubKey(overflowSubKey() === 'mode' ? '' : 'mode')
                        }}>
                        <span class="drawing-overflow-icon">
                          {
                            modeIcon() === 'weak_magnet'
                              ? <Icon name="weak_magnet" />
                              : <Icon name="strong_magnet" />
                          }
                        </span>
                        <svg class={`drawing-overflow-arrow ${overflowSubKey() === 'mode' ? 'rotate' : ''}`} viewBox="0 0 4 6">
                          <path d="M1.07298,0.159458C0.827521,-0.0531526,0.429553,-0.0531526,0.184094,0.159458C-0.0613648,0.372068,-0.0613648,0.716778,0.184094,0.929388L2.61275,3.03303L0.260362,5.07061C0.0149035,5.28322,0.0149035,5.62793,0.260362,5.84054C0.505822,6.05315,0.903789,6.05315,1.14925,5.84054L3.81591,3.53075C4.01812,3.3556,4.05374,3.0908,3.92279,2.88406C3.93219,2.73496,3.87113,2.58315,3.73964,2.46925L1.07298,0.159458Z" stroke="none" stroke-opacity="0" />
                        </svg>
                        <Show when={overflowSubKey() === 'mode'}>
                          <div class="drawing-overflow-submenu">
                            {modes().map(data => (
                              <div
                                class="drawing-overflow-submenu-item"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setModeIcon(data.key)
                                  setMode(data.key)
                                  props.onModeChange(data.key)
                                  setOverflowOpen(false)
                                  setOverflowSubKey('')
                                }}>
                                <span class="drawing-overflow-submenu-icon">
                                  <Icon name={data.key} />
                                </span>
                                <span>{data.text}</span>
                              </div>
                            ))}
                          </div>
                        </Show>
                      </div>
                    )
                  }
                  if (el.render === 'lock') {
                    return (
                      <div
                        class={`drawing-overflow-item ${lock() ? 'selected' : ''}`}
                        onClick={() => {
                          const currentLock = !lock()
                          setLock(currentLock)
                          props.onLockChange(currentLock)
                          setOverflowOpen(false)
                        }}>
                        {lock() ? <Icon name="lock" /> : <Icon name="unlock" />}
                      </div>
                    )
                  }
                  if (el.render === 'visible') {
                    return (
                      <div
                        class={`drawing-overflow-item ${!visible() ? 'selected' : ''}`}
                        onClick={() => {
                          const v = !visible()
                          setVisible(v)
                          props.onVisibleChange(v)
                          setOverflowOpen(false)
                        }}>
                        {visible() ? <Icon name="visible" /> : <Icon name="invisible" />}
                      </div>
                    )
                  }
                  if (el.render === 'remove') {
                    return (
                      <div
                        class="drawing-overflow-item"
                        onClick={() => {
                          props.onRemoveClick(GROUP_ID)
                          setOverflowOpen(false)
                        }}>
                        <Icon name="remove" />
                      </div>
                    )
                  }
                  return null
                }}
              </For>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  )
}

export default DrawingBar