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

import { KLineData } from 'klinecharts'

/**
 * Available playback speed multipliers for replay mode
 */
export type ReplaySpeed = 0.5 | 1 | 2 | 5 | 10

/**
 * Represents the current state of replay mode
 */
export interface ReplayState {
  /** Whether replay mode is currently active */
  isActive: boolean
  /** Whether playback is paused */
  isPaused: boolean
  /** Current playback speed multiplier */
  speed: ReplaySpeed
  /** Timestamp from which replay started */
  startTimestamp: number
  /** Current candle index being displayed */
  currentIndex: number
  /** Total number of candles available for replay */
  totalCandles: number
  /** All historical data loaded for replay */
  fullData: KLineData[]
}

/**
 * Default replay state when not in replay mode
 */
export const DEFAULT_REPLAY_STATE: ReplayState = {
  isActive: false,
  isPaused: true,
  speed: 1,
  startTimestamp: 0,
  currentIndex: 0,
  totalCandles: 0,
  fullData: []
}

/**
 * Callbacks for replay events
 */
export interface ReplayCallbacks {
  /** Called when replay mode is activated or deactivated */
  onModeChange: (active: boolean) => void
  /** Called when a new candle is revealed */
  onCandleProgress: (index: number, data: KLineData[]) => void
  /** Called when replay reaches the end */
  onReplayEnd: () => void
}

/**
 * Available speed options with labels
 */
export const REPLAY_SPEED_OPTIONS: Array<{ value: ReplaySpeed; label: string }> = [
  { value: 0.5, label: '0.5x' },
  { value: 1, label: '1x' },
  { value: 2, label: '2x' },
  { value: 5, label: '5x' },
  { value: 10, label: '10x' }
]
