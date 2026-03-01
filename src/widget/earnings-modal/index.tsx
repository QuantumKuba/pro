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

import { Component, createSignal, createEffect, For, Show } from 'solid-js'

import { Modal, Loading } from '../../component'
import earningsService, { EarningsEvent } from '../../EarningsService'
import watchlistService from '../../WatchlistService'
import i18n from '../../i18n'

import './index.less'

interface EarningsModalProps {
  locale: string
  visible: boolean
  onClose: () => void
}

const EarningsModal: Component<EarningsModalProps> = props => {
  const [events, setEvents] = createSignal<EarningsEvent[]>([])
  const [loading, setLoading] = createSignal(false)

  createEffect(() => {
    if (props.visible) {
      loadEarnings()
    }
  })

  const loadEarnings = async () => {
    setLoading(true)
    try {
      const symbols = watchlistService.getAllSymbols()
      if (symbols.length > 0) {
        const earnings = await earningsService.getUpcomingEarnings(symbols, 30)
        setEvents(earnings)
      } else {
        setEvents([])
      }
    } catch (e) {
      console.error('Failed to load earnings:', e)
      setEvents([])
    } finally {
      setLoading(false)
    }
  }

  const formatRevenue = (value: number | null): string => {
    if (value === null) return '-'
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`
    return `$${value.toFixed(0)}`
  }

  const formatEPS = (value: number | null): string => {
    if (value === null) return '-'
    return `$${value.toFixed(2)}`
  }

  return (
    <Show when={props.visible}>
      <Modal
        title={i18n('earnings_calendar', props.locale)}
        onClose={props.onClose}
        width={750}
      >
        <div class="klinecharts-pro-earnings-modal">
          <Show when={loading()}>
            <div class="loading-container">
              <Loading />
            </div>
          </Show>

          <Show when={!loading()}>
            <Show when={events().length > 0} fallback={
              <div class="empty-state">
                <span>📊</span>
                <p>{i18n('no_earnings', props.locale)}</p>
                <p class="hint">{i18n('add_symbols_hint', props.locale)}</p>
              </div>
            }>
              <div class="earnings-table-container">
                <table class="earnings-table">
                  <thead>
                    <tr>
                      <th>{i18n('symbol', props.locale)}</th>
                      <th>{i18n('report_date', props.locale)}</th>
                      <th>{i18n('fiscal_period', props.locale)}</th>
                      <th>EPS</th>
                      <th>{i18n('revenue', props.locale)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={events()}>
                      {(event) => (
                        <tr>
                          <td class="symbol">{event.symbol}</td>
                          <td>
                            <div class="date-cell">
                              <span class="date">{earningsService.formatEarningsDate(event.reportDate)}</span>
                              <Show when={event.hour !== 'unknown'}>
                                <span class="hour-badge">{earningsService.formatHour(event.hour)}</span>
                              </Show>
                            </div>
                          </td>
                          <td>{event.fiscalQuarter} {event.fiscalYear}</td>
                          <td>
                            <Show when={event.epsActual !== null} fallback={
                              <span class="estimate">{formatEPS(event.epsEstimate)} <small>est.</small></span>
                            }>
                              <span>{formatEPS(event.epsActual)}</span>
                            </Show>
                          </td>
                          <td>
                            <Show when={event.revenueActual !== null} fallback={
                              <span class="estimate">{formatRevenue(event.revenueEstimate)} <small>est.</small></span>
                            }>
                              <span>{formatRevenue(event.revenueActual)}</span>
                            </Show>
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </Show>
          </Show>
        </div>
      </Modal>
    </Show>
  )
}

export default EarningsModal
