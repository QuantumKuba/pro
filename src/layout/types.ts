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

import type { SymbolInfo, Period } from '../types'

/** Direction of a split between panes */
export type SplitDirection = 'horizontal' | 'vertical'

/** Configuration for a single chart pane */
export interface PaneConfig {
  id: string
  symbol: SymbolInfo
  period: Period
  mainIndicators: string[]
  subIndicators: string[]
}

/**
 * Recursive layout tree node.
 * A leaf node renders a ChartPane; a split node renders children with a splitter.
 */
export type LayoutNode =
  | { type: 'leaf'; paneId: string }
  | { type: 'split'; direction: SplitDirection; children: LayoutNode[]; ratios: number[] }

/** Metadata for a layout preset */
export interface LayoutPreset {
  id: string
  name: string
  icon: string
  createTree: () => LayoutNode
  paneCount: number
}

/** Top-level layout state */
export interface LayoutState {
  activePaneId: string
  panes: Record<string, PaneConfig>
  tree: LayoutNode
  presetId: string
}
