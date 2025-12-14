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
import { ReplayState, ReplaySpeed, ReplayCallbacks, DEFAULT_REPLAY_STATE } from './ReplayTypes'
import { Period } from './types'

/**
 * Controller class for managing replay mode functionality.
 * Handles timing, state, and candle progression during replay.
 */
export default class ReplayController {
  private _state: ReplayState
  private _callbacks: ReplayCallbacks
  private _period: Period | null
  private _timerId: ReturnType<typeof setInterval> | null = null

  constructor(callbacks: ReplayCallbacks) {
    this._state = { ...DEFAULT_REPLAY_STATE }
    this._callbacks = callbacks
    this._period = null
  }

  /**
   * Get current replay state
   */
  get state(): ReplayState {
    return { ...this._state }
  }

  /**
   * Check if replay mode is active
   */
  get isActive(): boolean {
    return this._state.isActive
  }

  /**
   * Check if replay is paused
   */
  get isPaused(): boolean {
    return this._state.isPaused
  }

  /**
   * Get current speed
   */
  get speed(): ReplaySpeed {
    return this._state.speed
  }

  /**
   * Set the current period for calculating interval timing
   */
  setPeriod(period: Period): void {
    this._period = period
  }

  /**
   * Calculate the interval between candles based on period and speed
   */
  private _calculateInterval(): number {
    if (!this._period) {
      return 1000 // Default 1 second
    }

    // Base interval: we want candles to appear at a reasonable rate
    // For 1x speed, we'll show one candle per second regardless of timeframe
    const baseInterval = 1000 // 1 second base
    return baseInterval / this._state.speed
  }

  /**
   * Start replay mode from a specific timestamp
   */
  start(timestamp: number, fullData: KLineData[]): void {
    // Find the index where we should start (first candle at or after timestamp)
    let startIndex = fullData.findIndex(d => d.timestamp >= timestamp)
    if (startIndex === -1) {
      startIndex = 0
    }

    this._state = {
      isActive: true,
      isPaused: true,
      speed: 1,
      startTimestamp: timestamp,
      currentIndex: startIndex,
      totalCandles: fullData.length,
      fullData: fullData
    }

    this._callbacks.onModeChange(true)
    this._callbacks.onCandleProgress(startIndex, fullData.slice(0, startIndex + 1))
  }

  /**
   * Stop replay mode and return to normal
   */
  stop(): void {
    this._stopTimer()
    this._state = { ...DEFAULT_REPLAY_STATE }
    this._callbacks.onModeChange(false)
  }

  /**
   * Start or resume playback
   */
  play(): void {
    if (!this._state.isActive || !this._state.isPaused) {
      return
    }

    this._state.isPaused = false
    this._startTimer()
  }

  /**
   * Pause playback
   */
  pause(): void {
    if (!this._state.isActive || this._state.isPaused) {
      return
    }

    this._state.isPaused = true
    this._stopTimer()
  }

  /**
   * Toggle between play and pause
   */
  togglePlayPause(): void {
    if (this._state.isPaused) {
      this.play()
    } else {
      this.pause()
    }
  }

  /**
   * Move forward one candle
   */
  stepForward(): void {
    if (!this._state.isActive) {
      return
    }

    if (this._state.currentIndex < this._state.totalCandles - 1) {
      this._state.currentIndex++
      this._notifyProgress()
    } else {
      // At the end
      this._callbacks.onReplayEnd()
    }
  }

  /**
   * Move backward one candle
   */
  stepBackward(): void {
    if (!this._state.isActive) {
      return
    }

    if (this._state.currentIndex > 0) {
      this._state.currentIndex--
      this._notifyProgress()
    }
  }

  /**
   * Set playback speed
   */
  setSpeed(speed: ReplaySpeed): void {
    this._state.speed = speed

    // Restart timer with new speed if playing
    if (this._state.isActive && !this._state.isPaused) {
      this._stopTimer()
      this._startTimer()
    }
  }

  /**
   * Jump to a specific index
   */
  goToIndex(index: number): void {
    if (!this._state.isActive) {
      return
    }

    const clampedIndex = Math.max(0, Math.min(index, this._state.totalCandles - 1))
    this._state.currentIndex = clampedIndex
    this._notifyProgress()
  }

  /**
   * Update fullData when backward historical data is loaded
   * Called when user scrolls left and more data is prepended
   */
  updateFullData(newFullData: KLineData[], newIndex: number): void {
    if (!this._state.isActive) {
      return
    }
    this._state.fullData = newFullData
    this._state.totalCandles = newFullData.length
    this._state.currentIndex = newIndex
  }

  /**
   * Get current progress as percentage (0-100)
   */
  getProgress(): number {
    if (this._state.totalCandles <= 1) {
      return 100
    }
    return (this._state.currentIndex / (this._state.totalCandles - 1)) * 100
  }

  /**
   * Start the playback timer
   */
  private _startTimer(): void {
    if (this._timerId !== null) {
      return
    }

    const interval = this._calculateInterval()
    this._timerId = setInterval(() => {
      this._advanceCandle()
    }, interval)
  }

  /**
   * Stop the playback timer
   */
  private _stopTimer(): void {
    if (this._timerId !== null) {
      clearInterval(this._timerId)
      this._timerId = null
    }
  }

  /**
   * Advance to the next candle (called by timer)
   */
  private _advanceCandle(): void {
    if (this._state.currentIndex < this._state.totalCandles - 1) {
      this._state.currentIndex++
      this._notifyProgress()
    } else {
      // Reached the end
      this.pause()
      this._callbacks.onReplayEnd()
    }
  }

  /**
   * Notify about progress change
   */
  private _notifyProgress(): void {
    const visibleData = this._state.fullData.slice(0, this._state.currentIndex + 1)
    this._callbacks.onCandleProgress(this._state.currentIndex, visibleData)
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this._stopTimer()
    this._state = { ...DEFAULT_REPLAY_STATE }
  }
}
