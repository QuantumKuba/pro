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

import { Component, createSignal, createEffect, createResource, createMemo, onCleanup, For, Show } from 'solid-js'

import { Modal, Button, Input, Select } from '../../component'
import priceAlertService, { PriceAlert, AlertType } from '../../PriceAlertService'
import i18n from '../../i18n'
import type { ChartDataLoaderType, SymbolInfo } from '../../types'

import './index.less'

interface PriceAlertModalProps {
  locale: string
  visible: boolean
  currentSymbol?: string
  datafeed?: ChartDataLoaderType
  onClose: () => void
}

const PriceAlertModal: Component<PriceAlertModalProps> = props => {
  const [alerts, setAlerts] = createSignal<PriceAlert[]>([])
  const [showCreateForm, setShowCreateForm] = createSignal(false)
  const [newSymbol, setNewSymbol] = createSignal('')
  const [symbolSearch, setSymbolSearch] = createSignal('')
  const [showSymbolDropdown, setShowSymbolDropdown] = createSignal(false)
  const [newAlertType, setNewAlertType] = createSignal<AlertType>('above')
  const [newTargetPrice, setNewTargetPrice] = createSignal('')
  const [newChangePercent, setNewChangePercent] = createSignal('')
  const [filter, setFilter] = createSignal<'all' | 'active' | 'triggered'>('all')

  // Symbol search: load all available symbols from datafeed
  const [allSymbols] = createResource(
    () => props.visible && props.datafeed ? true : false,
    async () => {
      if (!props.datafeed) return []
      try {
        return await props.datafeed.searchSymbols('')
      } catch {
        return []
      }
    }
  )

  const filteredSymbols = createMemo(() => {
    const symbols = allSymbols() ?? []
    const search = symbolSearch().toLowerCase()
    if (!search) return symbols.slice(0, 50)
    return symbols.filter(s =>
      s.ticker.toLowerCase().includes(search) ||
      s.name?.toLowerCase().includes(search) ||
      s.shortName?.toLowerCase().includes(search)
    ).slice(0, 50)
  })

  const loadData = () => {
    setAlerts(priceAlertService.getAlerts())
  }

  createEffect(() => {
    if (props.visible) {
      loadData()
      if (props.currentSymbol) {
        setNewSymbol(props.currentSymbol)
      }
      const unsubscribe = priceAlertService.subscribe(loadData)
      onCleanup(unsubscribe)
    }
  })

  const filteredAlerts = () => {
    const all = alerts()
    switch (filter()) {
      case 'active': return all.filter(a => a.isActive)
      case 'triggered': return all.filter(a => a.triggeredAt !== undefined)
      default: return all
    }
  }

  const handleCreate = () => {
    const symbol = newSymbol().trim().toUpperCase()
    if (!symbol) return

    const alertType = newAlertType()
    let targetPrice: number | undefined
    let changePercent: number | undefined

    if (alertType === 'change_percent') {
      changePercent = parseFloat(newChangePercent())
      if (isNaN(changePercent)) return
    } else {
      targetPrice = parseFloat(newTargetPrice())
      if (isNaN(targetPrice)) return
    }

    priceAlertService.createAlert({
      symbol,
      alertType,
      targetPrice,
      changePercent,
      browserEnabled: true
    })

    setShowCreateForm(false)
    setNewTargetPrice('')
    setNewChangePercent('')
  }

  const handleDelete = (id: string) => {
    priceAlertService.deleteAlert(id)
  }

  const handleToggle = (alert: PriceAlert) => {
    priceAlertService.toggleActive(alert.id)
  }

  const handleEnableNotifications = async () => {
    await priceAlertService.requestNotificationPermission()
  }

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return '-'
    return new Date(timestamp).toLocaleString()
  }

  const alertTypeLabel = (type: AlertType) => {
    switch (type) {
      case 'above': return i18n('price_above', props.locale)
      case 'below': return i18n('price_below', props.locale)
      case 'change_percent': return i18n('change_percent', props.locale)
    }
  }

  return (
    <Show when={props.visible}>
      <Modal
        title={i18n('price_alerts', props.locale)}
        onClose={props.onClose}
        width={750}
      >
        <div class="klinecharts-pro-price-alert-modal">
          {/* Notification Permission */}
          <Show when={typeof Notification !== 'undefined' && Notification.permission !== 'granted'}>
            <div class="notification-banner">
              <span>🔔 {i18n('enable_notifications', props.locale)}</span>
              <Button
                type="confirm"
                onClick={handleEnableNotifications}
              >{i18n('confirm', props.locale)}</Button>
            </div>
          </Show>

          {/* Toolbar */}
          <div class="toolbar">
            <div class="tabs">
              <button
                class={`tab ${filter() === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
              >{i18n('all_trades', props.locale)}</button>
              <button
                class={`tab ${filter() === 'active' ? 'active' : ''}`}
                onClick={() => setFilter('active')}
              >{i18n('active', props.locale)}</button>
              <button
                class={`tab ${filter() === 'triggered' ? 'active' : ''}`}
                onClick={() => setFilter('triggered')}
              >{i18n('triggered', props.locale)}</button>
            </div>
            <Button
              type="confirm"
              onClick={() => setShowCreateForm(true)}
            >{`+ ${i18n('create_alert', props.locale)}`}</Button>
          </div>

          {/* Create Form */}
          <Show when={showCreateForm()}>
            <div class="create-form">
              <div class="form-row">
                <div class="symbol-search-container">
                  <Input
                    value={newSymbol()}
                    placeholder={i18n('search_symbol', props.locale)}
                    onChange={(v) => {
                      setNewSymbol(v as string)
                      setSymbolSearch(v as string)
                      setShowSymbolDropdown(true)
                    }}
                  />
                  <Show when={showSymbolDropdown() && props.datafeed && filteredSymbols().length > 0}>
                    <ul class="symbol-dropdown">
                      <For each={filteredSymbols()}>
                        {(sym) => (
                          <li
                            class={`symbol-dropdown-item ${sym.ticker === newSymbol() ? 'selected' : ''}`}
                            onMouseDown={(e) => {
                              e.preventDefault()
                              setNewSymbol(sym.ticker)
                              setSymbolSearch('')
                              setShowSymbolDropdown(false)
                            }}
                          >
                            <span class="symbol-ticker">{sym.ticker}</span>
                            <Show when={sym.name}>
                              <span class="symbol-name">{sym.name}</span>
                            </Show>
                          </li>
                        )}
                      </For>
                    </ul>
                  </Show>
                </div>
                <Select
                  value={newAlertType()}
                  dataSource={[
                    { key: 'above', text: i18n('price_above', props.locale) },
                    { key: 'below', text: i18n('price_below', props.locale) },
                    { key: 'change_percent', text: i18n('change_percent', props.locale) }
                  ]}
                  onSelected={(item) => setNewAlertType((item as { key: string }).key as AlertType)}
                />
              </div>
              <div class="form-row">
                <Show when={newAlertType() !== 'change_percent'} fallback={
                  <Input
                    value={newChangePercent()}
                    placeholder={i18n('change_percent', props.locale) + ' (%)'}
                    onChange={setNewChangePercent}
                  />
                }>
                  <Input
                    value={newTargetPrice()}
                    placeholder={i18n('target_price', props.locale)}
                    onChange={setNewTargetPrice}
                  />
                </Show>
              </div>
              <div class="form-actions">
                <Button
                  type="confirm"
                  onClick={handleCreate}
                >{i18n('confirm', props.locale)}</Button>
                <Button
                  onClick={() => setShowCreateForm(false)}
                >{i18n('cancel', props.locale)}</Button>
              </div>
            </div>
          </Show>

          {/* Alerts Table */}
          <Show when={filteredAlerts().length > 0} fallback={
            <div class="empty-state">
              <span>🔔</span>
              <p>{i18n('no_alerts', props.locale)}</p>
            </div>
          }>
            <div class="alerts-table-container">
              <table class="alerts-table">
                <thead>
                  <tr>
                    <th>{i18n('symbol', props.locale)}</th>
                    <th>{i18n('alert_type', props.locale)}</th>
                    <th>{i18n('target_price', props.locale)}</th>
                    <th>Status</th>
                    <th>{i18n('triggered_at', props.locale)}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <For each={filteredAlerts()}>
                    {(alert) => (
                      <tr class={alert.isActive ? '' : 'inactive'}>
                        <td class="symbol">{alert.symbol}</td>
                        <td>{alertTypeLabel(alert.alertType)}</td>
                        <td>
                          {alert.alertType === 'change_percent'
                            ? `${alert.changePercent}%`
                            : alert.targetPrice?.toFixed(2)
                          }
                        </td>
                        <td>
                          <span
                            class={`status-badge ${alert.isActive ? 'active' : 'inactive'}`}
                            onClick={() => handleToggle(alert)}
                          >
                            {alert.isActive ? i18n('active', props.locale) : i18n('inactive', props.locale)}
                          </span>
                        </td>
                        <td class="time">{formatDate(alert.triggeredAt ?? undefined)}</td>
                        <td>
                          <button
                            class="delete-btn"
                            onClick={() => handleDelete(alert.id)}
                          >×</button>
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </Show>
        </div>
      </Modal>
    </Show>
  )
}

export default PriceAlertModal
