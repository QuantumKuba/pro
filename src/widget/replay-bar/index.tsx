/**
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Component, For, createSignal, Show, createEffect, onCleanup } from 'solid-js'
import { ReplaySpeed, REPLAY_SPEED_OPTIONS } from '../../ReplayTypes'
import i18n from '../../i18n'

export interface ReplayBarProps {
  locale: string
  isPaused: boolean
  speed: ReplaySpeed
  currentIndex: number
  totalCandles: number
  startTimestamp: number
  onPlay: () => void
  onPause: () => void
  onStepForward: () => void
  onStepBackward: () => void
  onSpeedChange: (speed: ReplaySpeed) => void
  onSeek: (index: number) => void
  onExit: () => void
  onDateChange: (timestamp: number) => void
}

const ReplayBar: Component<ReplayBarProps> = props => {
  const [isVisible, setIsVisible] = createSignal(true)
  let hideTimeout: number | undefined

  const show = () => {
    setIsVisible(true)
    if (hideTimeout) {
      clearTimeout(hideTimeout)
      hideTimeout = undefined
    }
  }

  const scheduleHide = () => {
    if (hideTimeout) {
      clearTimeout(hideTimeout)
    }
    hideTimeout = window.setTimeout(() => {
      setIsVisible(false)
    }, 3000)
  }

  // Show initially and schedule hide
  createEffect(() => {
    scheduleHide()
  })

  const [showSpeedMenu, setShowSpeedMenu] = createSignal(false)

  // Cleanup
  onCleanup(() => {
    if (hideTimeout) {
      clearTimeout(hideTimeout)
    }
  })

  // Re-show when progress updates (user interacting via keys etc)
  createEffect(() => {
    props.currentIndex
    show()
    scheduleHide()
  })

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp)
    return date.toISOString().slice(0, 16)
  }

  const progress = () => {
    if (props.totalCandles <= 1) return 100
    return (props.currentIndex / (props.totalCandles - 1)) * 100
  }

  const handleDateInput = (e: Event) => {
    const target = e.target as HTMLInputElement
    const timestamp = new Date(target.value).getTime()
    if (!isNaN(timestamp)) {
      props.onDateChange(timestamp)
    }
  }

  const handleProgressClick = (e: MouseEvent) => {
    const target = e.currentTarget as HTMLDivElement
    const rect = target.getBoundingClientRect()
    const percentage = (e.clientX - rect.left) / rect.width
    const index = Math.floor(percentage * (props.totalCandles - 1))
    props.onSeek(index)
  }

  const handleMouseEnter = () => {
    show()
  }

  const handleMouseLeave = () => {
    scheduleHide()
  }

  return (
    <div
      class="replay-bar-hover-zone"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div class={`klinecharts-pro-replay-bar ${isVisible() ? 'visible' : 'hidden'}`}>
        {/* Progress Bar */}
        <div class="replay-progress-container" onClick={handleProgressClick}>
          <div class="replay-progress-track">
            <div
              class="replay-progress-fill"
              style={{ width: `${progress()}%` }}
            />
            <div
              class="replay-progress-thumb"
              style={{ left: `${progress()}%` }}
            />
          </div>
        </div>

        <div class="replay-controls">
          {/* Date Picker */}
          <div class="replay-date-section">
            <label class="replay-label">{i18n('replay_select_date', props.locale)}</label>
            <input
              type="datetime-local"
              class="replay-date-input"
              value={formatDate(props.startTimestamp)}
              onInput={handleDateInput}
            />
          </div>

          {/* Playback Controls */}
          <div class="replay-playback-controls">
            {/* Step Backward */}
            <button
              class="replay-btn"
              onClick={props.onStepBackward}
              title={i18n('replay_step_back', props.locale)}
            >
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path fill="currentColor" d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
              </svg>
            </button>

            {/* Play/Pause */}
            <button
              class="replay-btn replay-btn-primary"
              onClick={() => props.isPaused ? props.onPlay() : props.onPause()}
              title={props.isPaused ? i18n('replay_play', props.locale) : i18n('replay_pause', props.locale)}
            >
              <Show when={props.isPaused} fallback={
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <path fill="currentColor" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
              }>
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <path fill="currentColor" d="M8 5v14l11-7z" />
                </svg>
              </Show>
            </button>

            {/* Step Forward */}
            <button
              class="replay-btn"
              onClick={props.onStepForward}
              title={i18n('replay_step_forward', props.locale)}
            >
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path fill="currentColor" d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
              </svg>
            </button>
          </div>

          {/* Speed Control */}
          <div class="replay-speed-section">
            <button
              class="replay-speed-btn"
              onClick={() => setShowSpeedMenu(!showSpeedMenu())}
            >
              <span class="replay-speed-label">{i18n('replay_speed', props.locale)}:</span>
              <span class="replay-speed-value">{props.speed}x</span>
              <svg viewBox="0 0 24 24" width="14" height="14">
                <path fill="currentColor" d="M7 10l5 5 5-5z" />
              </svg>
            </button>

            <Show when={showSpeedMenu()}>
              <div class="replay-speed-menu">
                <For each={REPLAY_SPEED_OPTIONS}>
                  {option => (
                    <button
                      class={`replay-speed-option ${props.speed === option.value ? 'active' : ''}`}
                      onClick={() => {
                        props.onSpeedChange(option.value)
                        setShowSpeedMenu(false)
                      }}
                    >
                      {option.label}
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>

          {/* Candle Counter */}
          <div class="replay-counter">
            <span>{props.currentIndex + 1}</span>
            <span class="replay-counter-divider">/</span>
            <span>{props.totalCandles}</span>
          </div>

          {/* Exit Button */}
          <button
            class="replay-btn replay-btn-exit"
            onClick={props.onExit}
          >
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
            <span>{i18n('replay_stop', props.locale)}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default ReplayBar
