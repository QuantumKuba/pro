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

import { Component, For, createSignal, Show } from 'solid-js'

import { LAYOUT_PRESETS } from './presets'
import type { LayoutPreset } from './types'

export interface LayoutSelectorProps {
  currentPresetId: string
  onSelect: (preset: LayoutPreset) => void
}

/** SVG mini-icons for each preset */
function PresetIcon (props: { presetId: string }) {
  const size = 28
  const gap = 2
  const stroke = 'currentColor'
  const fill = 'none'
  const sw = 1.5
  const r = 2

  return (
    <>
      {(() => {
        switch (props.presetId) {
          case 'single':
            return (
              <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                <rect x="2" y="2" width="24" height="24" rx={r} fill={fill} stroke={stroke} stroke-width={sw} />
              </svg>
            )
          case '2-cols':
            return (
              <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                <rect x="2" y="2" width="11" height="24" rx={r} fill={fill} stroke={stroke} stroke-width={sw} />
                <rect x="15" y="2" width="11" height="24" rx={r} fill={fill} stroke={stroke} stroke-width={sw} />
              </svg>
            )
          case '2-rows':
            return (
              <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                <rect x="2" y="2" width="24" height="11" rx={r} fill={fill} stroke={stroke} stroke-width={sw} />
                <rect x="2" y="15" width="24" height="11" rx={r} fill={fill} stroke={stroke} stroke-width={sw} />
              </svg>
            )
          case '2x2':
            return (
              <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                <rect x="2" y="2" width="11" height="11" rx={r} fill={fill} stroke={stroke} stroke-width={sw} />
                <rect x="15" y="2" width="11" height="11" rx={r} fill={fill} stroke={stroke} stroke-width={sw} />
                <rect x="2" y="15" width="11" height="11" rx={r} fill={fill} stroke={stroke} stroke-width={sw} />
                <rect x="15" y="15" width="11" height="11" rx={r} fill={fill} stroke={stroke} stroke-width={sw} />
              </svg>
            )
          case 'leader':
            return (
              <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                <rect x="2" y="2" width="15" height="24" rx={r} fill={fill} stroke={stroke} stroke-width={sw} />
                <rect x="19" y="2" width="7" height="11" rx={r} fill={fill} stroke={stroke} stroke-width={sw} />
                <rect x="19" y="15" width="7" height="11" rx={r} fill={fill} stroke={stroke} stroke-width={sw} />
              </svg>
            )
          case '3-cols':
            return (
              <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                <rect x="2" y="2" width="7" height="24" rx={r} fill={fill} stroke={stroke} stroke-width={sw} />
                <rect x="11" y="2" width="7" height="24" rx={r} fill={fill} stroke={stroke} stroke-width={sw} />
                <rect x="20" y="2" width="7" height="24" rx={r} fill={fill} stroke={stroke} stroke-width={sw} />
              </svg>
            )
          default:
            return (
              <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                <rect x="2" y="2" width="24" height="24" rx={r} fill={fill} stroke={stroke} stroke-width={sw} />
              </svg>
            )
        }
      })()}
    </>
  )
}

const LayoutSelector: Component<LayoutSelectorProps> = (props) => {
  const [open, setOpen] = createSignal(false)

  const handleSelect = (preset: LayoutPreset) => {
    props.onSelect(preset)
    setOpen(false)
  }

  const handleToggle = () => {
    setOpen(!open())
  }

  // Close on click outside
  const handleClickOutside = (e: MouseEvent) => {
    const target = e.target as HTMLElement
    if (!target.closest('.layout-selector')) {
      setOpen(false)
    }
  }

  return (
    <div class="layout-selector">
      <button
        class="layout-selector__trigger"
        onClick={handleToggle}
        title="Layout"
      >
        <PresetIcon presetId={props.currentPresetId} />
      </button>
      <Show when={open()}>
        <div class="layout-selector__dropdown" onClick={(e: any) => e.stopPropagation()}>
          <div class="layout-selector__title">Layout</div>
          <div class="layout-selector__grid">
            <For each={LAYOUT_PRESETS}>
              {(preset) => (
                <button
                  class="layout-selector__option"
                  classList={{ 'layout-selector__option--active': preset.id === props.currentPresetId }}
                  onClick={() => handleSelect(preset)}
                  title={preset.name}
                >
                  <PresetIcon presetId={preset.id} />
                  <span class="layout-selector__label">{preset.name}</span>
                </button>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  )
}

export default LayoutSelector
