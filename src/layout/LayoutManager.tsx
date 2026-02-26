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

import { Component, createSignal, createMemo } from 'solid-js'

import ChartPane from './ChartPane'
import PaneSplitter from './PaneSplitter'
import { generatePaneId, collectPaneIds, LAYOUT_PRESETS } from './presets'
import type { LayoutNode, LayoutState, PaneConfig, LayoutPreset } from './types'
import type { SymbolInfo, Period, Datafeed } from '../types'

/** API exposed by LayoutManager via ref */
export interface LayoutManagerApi {
  switchPreset: (preset: LayoutPreset) => void
  getPresetId: () => string
  getState: () => LayoutState
}

export interface LayoutManagerProps {
  /** Initial symbol for the first pane */
  initialSymbol: SymbolInfo
  /** Default period */
  period: Period
  /** Available periods */
  periods: Period[]
  /** Shared datafeed */
  datafeed: Datafeed
  /** Theme */
  theme: string
  /** Locale */
  locale: string
  /** Default main indicators */
  mainIndicators?: string[]
  /** Default sub indicators */
  subIndicators?: string[]
  /** Called when the active pane's symbol changes */
  onSymbolChange?: (symbol: SymbolInfo) => void
  /** Ref callback to receive the API */
  ref?: (api: LayoutManagerApi) => void
}

const MIN_PANE_RATIO = 0.15 // minimum 15% of total size

const LayoutManager: Component<LayoutManagerProps> = (props) => {
  // Create initial single-pane layout
  const initialPaneId = generatePaneId()
  const initialPane: PaneConfig = {
    id: initialPaneId,
    symbol: props.initialSymbol,
    period: props.period,
    mainIndicators: props.mainIndicators ?? ['MA'],
    subIndicators: props.subIndicators ?? ['VOL']
  }

  const initialTree: LayoutNode = { type: 'leaf', paneId: initialPaneId }

  // ═══════════════════════════════════════════════════════════════
  // CRITICAL: These must be SEPARATE signals so that changing
  // activePaneId does NOT trigger re-rendering of the layout tree.
  // Only tree changes should cause panes to be destroyed/recreated.
  // ═══════════════════════════════════════════════════════════════
  const [tree, setTree] = createSignal<LayoutNode>(initialTree)
  const [panesMap, setPanesMap] = createSignal<Record<string, PaneConfig>>(
    { [initialPaneId]: initialPane }
  )
  const [activePaneId, setActivePaneId] = createSignal(initialPaneId)
  const [presetId, setPresetId] = createSignal('single')

  /** Derived: how many panes currently exist */
  const paneCount = createMemo(() => collectPaneIds(tree()).length)

  /** Create default pane config for a new pane */
  const createDefaultPane = (paneId: string): PaneConfig => ({
    id: paneId,
    symbol: props.initialSymbol,
    period: props.period,
    mainIndicators: props.mainIndicators ?? ['MA'],
    subIndicators: props.subIndicators ?? ['VOL']
  })

  /** Switch to a preset layout */
  const switchPreset = (preset: LayoutPreset) => {
    const newTree = preset.createTree()
    const newPaneIds = collectPaneIds(newTree)

    // Current state
    const currentPaneIds = collectPaneIds(tree())
    const currentPanes = panesMap()

    // Build new panes map, reusing existing configs where possible
    const newPanes: Record<string, PaneConfig> = {}
    newPaneIds.forEach((id, index) => {
      if (index < currentPaneIds.length && currentPanes[currentPaneIds[index]]) {
        const existing = currentPanes[currentPaneIds[index]]
        newPanes[id] = { ...existing, id }
      } else {
        newPanes[id] = createDefaultPane(id)
      }
    })

    // Batch all signal updates together
    setPresetId(preset.id)
    setPanesMap(newPanes)
    setActivePaneId(newPaneIds[0])
    // Set tree LAST — this is what triggers the re-render
    setTree(newTree)
  }

  /** Set active pane — only updates activePaneId, does NOT touch tree */
  const setActivePane = (paneId: string) => {
    setActivePaneId(paneId)
  }

  /** Handle symbol change from a pane */
  const handleSymbolChange = (paneId: string, symbol: SymbolInfo) => {
    setPanesMap(prev => {
      const pane = prev[paneId]
      if (!pane) return prev
      return { ...prev, [paneId]: { ...pane, symbol } }
    })
    if (activePaneId() === paneId) {
      props.onSymbolChange?.(symbol)
    }
  }

  /** Close a pane — removes from tree, which triggers re-render */
  const closePane = (paneId: string) => {
    const currentTree = tree()
    const allIds = collectPaneIds(currentTree)
    if (allIds.length <= 1) return

    const newTree = removePaneFromTree(currentTree, paneId)
    if (!newTree) return

    const newPanes = { ...panesMap() }
    delete newPanes[paneId]

    const remainingIds = collectPaneIds(newTree)
    const currentActive = activePaneId()
    const newActive = remainingIds.includes(currentActive)
      ? currentActive
      : remainingIds[0]

    const matchingPreset = LAYOUT_PRESETS.find(p => p.paneCount === remainingIds.length)

    setPanesMap(newPanes)
    setActivePaneId(newActive)
    setPresetId(matchingPreset?.id ?? 'single')
    setTree(newTree)
  }

  /** Reset ratios to equal for a split node at a path */
  const resetRatios = (path: number[]) => {
    setTree(prev => resetTreeRatios(prev, path))
  }

  /** Update ratios between two adjacent children of a split node */
  const updateRatiosBetween = (path: number[], childIndex: number, delta: number, containerSize: number) => {
    setTree(prev => updateSplitRatios(prev, path, childIndex, delta, containerSize))
  }

  /**
   * Recursively render the layout tree.
   *
   * CRITICAL DESIGN NOTE:
   * This function must NOT eagerly read activePaneId() or panesMap() at the top
   * level. These signals are only referenced inside JSX prop expressions, which
   * SolidJS's compiler wraps in property getters (deferred evaluation).
   * This means changes to activePaneId or panesMap do NOT cause this function
   * to re-run — only tree changes do.
   */
  const renderNode = (node: LayoutNode, path: number[]): any => {
    if (node.type === 'leaf') {
      const paneId = node.paneId

      // All signal reads below are inside JSX prop expressions.
      // SolidJS's babel transform wraps these in getters, so they are
      // NOT evaluated during renderNode execution — they only fire
      // when the ChartPane component accesses the prop.
      return (
        <ChartPane
          paneId={paneId}
          symbol={panesMap()[paneId]?.symbol ?? props.initialSymbol}
          period={panesMap()[paneId]?.period ?? props.period}
          periods={props.periods}
          mainIndicators={panesMap()[paneId]?.mainIndicators ?? props.mainIndicators ?? ['MA']}
          subIndicators={panesMap()[paneId]?.subIndicators ?? props.subIndicators ?? ['VOL']}
          datafeed={props.datafeed}
          theme={props.theme}
          locale={props.locale}
          isActive={activePaneId() === paneId}
          onFocus={setActivePane}
          onClose={paneCount() > 1 ? closePane : undefined}
          onSymbolChange={handleSymbolChange}
        />
      )
    }

    // Split node — uses DOM-based resizing during drag to avoid signal-triggered re-renders
    const isHorizontal = node.direction === 'horizontal'
    const children: any[] = []
    let splitContainerRef: HTMLDivElement | undefined

    node.children.forEach((child, index) => {
      const ratio = node.ratios[index] ?? (1 / node.children.length)
      const sizePercent = `${(ratio * 100).toFixed(4)}%`

      children.push(
        <div
          class="layout-split__segment"
          data-split-index={index}
          style={{
            [isHorizontal ? 'width' : 'height']: sizePercent,
            [isHorizontal ? 'height' : 'width']: '100%'
          }}
        >
          {renderNode(child, [...path, index])}
        </div>
      )

      // Add splitter between children (not after last)
      if (index < node.children.length - 1) {
        children.push(
          <PaneSplitter
            direction={node.direction}
            onDrag={(totalDelta) => {
              // Live resize via DOM manipulation — NO signal updates
              if (!splitContainerRef) return
              const segments = splitContainerRef.querySelectorAll<HTMLElement>(
                ':scope > .layout-split__segment'
              )
              const seg1 = segments[index]
              const seg2 = segments[index + 1]
              if (!seg1 || !seg2) return

              const containerRect = splitContainerRef.getBoundingClientRect()
              const containerSize = isHorizontal ? containerRect.width : containerRect.height
              const origRatio1 = node.ratios[index] ?? (1 / node.children.length)
              const origRatio2 = node.ratios[index + 1] ?? (1 / node.children.length)
              const deltaRatio = totalDelta / containerSize

              let newR1 = origRatio1 + deltaRatio
              let newR2 = origRatio2 - deltaRatio
              if (newR1 < MIN_PANE_RATIO) { newR1 = MIN_PANE_RATIO; newR2 = origRatio1 + origRatio2 - MIN_PANE_RATIO }
              if (newR2 < MIN_PANE_RATIO) { newR2 = MIN_PANE_RATIO; newR1 = origRatio1 + origRatio2 - MIN_PANE_RATIO }

              const sizeProp = isHorizontal ? 'width' : 'height'
              seg1.style[sizeProp] = `${(newR1 * 100).toFixed(4)}%`
              seg2.style[sizeProp] = `${(newR2 * 100).toFixed(4)}%`

              // Trigger chart resize inside each segment (debounced by ResizeObserver in ChartPane)
            }}
            onDragEnd={(totalDelta) => {
              // Commit final ratios to the tree signal
              if (!splitContainerRef) return
              const containerRect = splitContainerRef.getBoundingClientRect()
              const containerSize = isHorizontal ? containerRect.width : containerRect.height
              updateRatiosBetween(path, index, totalDelta, containerSize)
            }}
            onDoubleClick={() => resetRatios(path)}
          />
        )
      }
    })

    return (
      <div
        ref={splitContainerRef}
        class={`layout-split layout-split--${node.direction}`}
      >
        {children}
      </div>
    )
  }

  // Expose API via ref
  props.ref?.({
    switchPreset,
    getPresetId: () => presetId(),
    getState: () => ({
      activePaneId: activePaneId(),
      panes: panesMap(),
      tree: tree(),
      presetId: presetId()
    })
  })

  // The ONLY signal read at the top level of the JSX return is tree().
  // This means the layout tree is only rebuilt when the tree structure changes
  // (preset switch, pane close), NOT when the active pane changes.
  return (
    <div class="layout-manager">
      {renderNode(tree(), [])}
    </div>
  )
}

// --- Tree manipulation helpers ---

function removePaneFromTree (node: LayoutNode, paneId: string): LayoutNode | null {
  if (node.type === 'leaf') {
    return node.paneId === paneId ? null : node
  }

  const newChildren: LayoutNode[] = []
  const newRatios: number[] = []

  for (let i = 0; i < node.children.length; i++) {
    const result = removePaneFromTree(node.children[i], paneId)
    if (result) {
      newChildren.push(result)
      newRatios.push(node.ratios[i])
    }
  }

  if (newChildren.length === 0) return null
  if (newChildren.length === 1) return newChildren[0]

  const total = newRatios.reduce((a, b) => a + b, 0)
  const normalizedRatios = newRatios.map(r => r / total)

  return { type: 'split', direction: node.direction, children: newChildren, ratios: normalizedRatios }
}

function resetTreeRatios (node: LayoutNode, path: number[]): LayoutNode {
  if (path.length === 0 && node.type === 'split') {
    const equalRatio = 1 / node.children.length
    return { ...node, ratios: node.children.map(() => equalRatio) }
  }
  if (node.type === 'leaf') return node

  const [head, ...rest] = path
  const newChildren = [...node.children]
  newChildren[head] = resetTreeRatios(newChildren[head], rest)
  return { ...node, children: newChildren }
}

function updateSplitRatios (
  node: LayoutNode,
  path: number[],
  childIndex: number,
  delta: number,
  containerSize: number
): LayoutNode {
  if (node.type === 'leaf') return node

  if (path.length === 0) {
    const ratios = [...node.ratios]
    const deltaRatio = delta / containerSize

    const newFirst = ratios[childIndex] + deltaRatio
    const newSecond = ratios[childIndex + 1] - deltaRatio

    if (newFirst < MIN_PANE_RATIO || newSecond < MIN_PANE_RATIO) {
      return node
    }

    ratios[childIndex] = newFirst
    ratios[childIndex + 1] = newSecond

    return { ...node, ratios }
  }

  const [head, ...rest] = path
  const newChildren = [...node.children]
  newChildren[head] = updateSplitRatios(newChildren[head], rest, childIndex, delta, containerSize)
  return { ...node, children: newChildren }
}

export { LayoutManager }
export default LayoutManager
