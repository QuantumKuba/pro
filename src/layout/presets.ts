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

import type { LayoutPreset, LayoutNode } from './types'

let paneCounter = 0
export function generatePaneId (): string {
  return `pane_${++paneCounter}_${Date.now()}`
}

function leaf (id?: string): LayoutNode {
  return { type: 'leaf', paneId: id ?? generatePaneId() }
}

function split (direction: 'horizontal' | 'vertical', children: LayoutNode[], ratios?: number[]): LayoutNode {
  const r = ratios ?? children.map(() => 1 / children.length)
  return { type: 'split', direction, children, ratios: r }
}

/** Single full-screen chart */
const singlePreset: LayoutPreset = {
  id: 'single',
  name: 'Single',
  icon: '⬜',
  paneCount: 1,
  createTree: () => leaf()
}

/** Two charts side by side (columns) */
const twoCols: LayoutPreset = {
  id: '2-cols',
  name: '2 Columns',
  icon: '⬜⬜',
  paneCount: 2,
  createTree: () => split('horizontal', [leaf(), leaf()], [0.5, 0.5])
}

/** Two charts stacked (rows) */
const twoRows: LayoutPreset = {
  id: '2-rows',
  name: '2 Rows',
  icon: '⬜\n⬜',
  paneCount: 2,
  createTree: () => split('vertical', [leaf(), leaf()], [0.5, 0.5])
}

/** 2×2 grid */
const grid2x2: LayoutPreset = {
  id: '2x2',
  name: '2×2 Grid',
  icon: '⬜⬜\n⬜⬜',
  paneCount: 4,
  createTree: () => split('vertical', [
    split('horizontal', [leaf(), leaf()], [0.5, 0.5]),
    split('horizontal', [leaf(), leaf()], [0.5, 0.5])
  ], [0.5, 0.5])
}

/** Leader: 1 large left + 2 small stacked right */
const leader: LayoutPreset = {
  id: 'leader',
  name: '1 + 2',
  icon: '⬛⬜\n⬛⬜',
  paneCount: 3,
  createTree: () => split('horizontal', [
    leaf(),
    split('vertical', [leaf(), leaf()], [0.5, 0.5])
  ], [0.6, 0.4])
}

/** Three columns */
const threeCols: LayoutPreset = {
  id: '3-cols',
  name: '3 Columns',
  icon: '⬜⬜⬜',
  paneCount: 3,
  createTree: () => split('horizontal', [leaf(), leaf(), leaf()], [0.333, 0.334, 0.333])
}

export const LAYOUT_PRESETS: LayoutPreset[] = [
  singlePreset,
  twoCols,
  twoRows,
  grid2x2,
  leader,
  threeCols
]

export function getPresetById (id: string): LayoutPreset | undefined {
  return LAYOUT_PRESETS.find(p => p.id === id)
}

/** Collect all leaf pane IDs from a tree */
export function collectPaneIds (node: LayoutNode): string[] {
  if (node.type === 'leaf') {
    return [node.paneId]
  }
  return node.children.flatMap(collectPaneIds)
}
