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

import { Component, createSignal, createMemo, createEffect, onCleanup, For, Show } from 'solid-js'

import { Modal, Button } from '../../component'
import tradeLogService, { Trade, TradeStats } from '../../TradeLogService'
import i18n from '../../i18n'

import './index.less'

interface TradeLogModalProps {
  locale: string
  visible: boolean
  onClose: () => void
}

type FilterType = 'all' | 'open' | 'closed'

const TradeLogModal: Component<TradeLogModalProps> = props => {
  const [trades, setTrades] = createSignal<Trade[]>([])
  const [stats, setStats] = createSignal<TradeStats | null>(null)
  const [filter, setFilter] = createSignal<FilterType>('all')

  // Load trades and stats
  const loadData = () => {
    setTrades(tradeLogService.getTrades())
    setStats(tradeLogService.getStats())
  }

  // Subscribe to changes
  createEffect(() => {
    if (props.visible) {
      loadData()
      const unsubscribe = tradeLogService.subscribe(loadData)
      onCleanup(unsubscribe)
    }
  })

  // Filtered trades
  const filteredTrades = createMemo(() => {
    const allTrades = trades()
    switch (filter()) {
      case 'open':
        return allTrades.filter(t => t.status === 'open')
      case 'closed':
        return allTrades.filter(t => t.status === 'closed')
      default:
        return allTrades
    }
  })

  // Export to CSV
  const handleExport = () => {
    const csv = tradeLogService.exportToCSV()
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `trade_log_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Format date
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString()
  }

  // Format price
  const formatPrice = (price: number) => {
    return price.toFixed(2)
  }

  // Format P&L with color
  const formatPnL = (pnl?: number) => {
    if (pnl === undefined) return '-'
    const formatted = pnl >= 0 ? `+${pnl.toFixed(2)}` : pnl.toFixed(2)
    return formatted
  }

  return (
    <Show when={props.visible}>
      <Modal
        title={i18n('trade_log', props.locale)}
        onClose={props.onClose}
        width={900}
      >
        <div class="klinecharts-pro-trade-log-modal">
          {/* Stats Summary */}
          <Show when={stats()} keyed>
            {(s: TradeStats) => (
              <div class="stats-grid">
                <div class="stat-card">
                  <div class="stat-value">{s.totalTrades}</div>
                  <div class="stat-label">{i18n('total_trades', props.locale)}</div>
                </div>
                <div class="stat-card win">
                  <div class="stat-value">{s.winRate.toFixed(1)}%</div>
                  <div class="stat-label">{i18n('win_rate', props.locale)}</div>
                </div>
                <div class="stat-card">
                  <div class={`stat-value ${s.totalPnL >= 0 ? 'positive' : 'negative'}`}>
                    {s.totalPnL >= 0 ? '+' : ''}{s.totalPnL.toFixed(2)}
                  </div>
                  <div class="stat-label">{i18n('total_pnl', props.locale)}</div>
                </div>
                <div class="stat-card">
                  <div class="stat-value">{s.profitFactor === Infinity ? '∞' : s.profitFactor.toFixed(2)}</div>
                  <div class="stat-label">{i18n('profit_factor', props.locale)}</div>
                </div>
                <div class="stat-card win">
                  <div class="stat-value positive">+{s.avgWin.toFixed(2)}</div>
                  <div class="stat-label">{i18n('avg_win', props.locale)}</div>
                </div>
                <div class="stat-card loss">
                  <div class="stat-value negative">-{s.avgLoss.toFixed(2)}</div>
                  <div class="stat-label">{i18n('avg_loss', props.locale)}</div>
                </div>
              </div>
            )}
          </Show>

          {/* Filter Tabs & Export */}
          <div class="toolbar">
            <div class="tabs">
              <button
                class={`tab ${filter() === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
              >
                {i18n('all_trades', props.locale)}
              </button>
              <button
                class={`tab ${filter() === 'open' ? 'active' : ''}`}
                onClick={() => setFilter('open')}
              >
                {i18n('open_trades', props.locale)}
              </button>
              <button
                class={`tab ${filter() === 'closed' ? 'active' : ''}`}
                onClick={() => setFilter('closed')}
              >
                {i18n('closed_trades', props.locale)}
              </button>
            </div>
            <button class="export-btn" onClick={handleExport}>
              📥 {i18n('export_csv', props.locale)}
            </button>
          </div>

          {/* Trades Table */}
          <div class="trades-table-container">
            <Show when={filteredTrades().length > 0} fallback={
              <div class="empty-state">
                <span>📊</span>
                <p>{i18n('no_trades', props.locale)}</p>
              </div>
            }>
              <table class="trades-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Symbol</th>
                    <th>{i18n('entry_price', props.locale)}</th>
                    <th>{i18n('take_profit', props.locale)}</th>
                    <th>{i18n('stop_loss', props.locale)}</th>
                    <th>{i18n('rr_ratio', props.locale)}</th>
                    <th>P&L</th>
                    <th>Status</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={filteredTrades()}>
                    {(trade) => (
                      <tr class={trade.status}>
                        <td>
                          <span class={`type-badge ${trade.type}`}>
                            {trade.type === 'long' ? '🟢 LONG' : '🔴 SHORT'}
                          </span>
                        </td>
                        <td class="symbol">{trade.symbol}</td>
                        <td>{formatPrice(trade.entryPrice)}</td>
                        <td class="tp">{formatPrice(trade.takeProfit)}</td>
                        <td class="sl">{formatPrice(trade.stopLoss)}</td>
                        <td>1:{trade.rrRatio.toFixed(2)}</td>
                        <td class={trade.pnl !== undefined ? (trade.pnl >= 0 ? 'positive' : 'negative') : ''}>
                          {formatPnL(trade.pnl)}
                        </td>
                        <td>
                          <span class={`status-badge ${trade.status}`}>
                            {trade.status}
                          </span>
                        </td>
                        <td class="time">{formatDate(trade.entryTime)}</td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </Show>
          </div>
        </div>
      </Modal>
    </Show>
  )
}

export default TradeLogModal
