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

import { Component, createSignal, createEffect, onCleanup, For, Show } from 'solid-js'

import { Modal, Button, Input } from '../../component'
import watchlistService, { Watchlist, WatchlistItem } from '../../WatchlistService'
import i18n from '../../i18n'

import './index.less'

interface WatchlistModalProps {
  locale: string
  visible: boolean
  onClose: () => void
  onSymbolSelect?: (symbol: string) => void
}

const WatchlistModal: Component<WatchlistModalProps> = props => {
  const [watchlists, setWatchlists] = createSignal<Watchlist[]>([])
  const [selectedWatchlist, setSelectedWatchlist] = createSignal<Watchlist | null>(null)
  const [newWatchlistName, setNewWatchlistName] = createSignal('')
  const [newSymbol, setNewSymbol] = createSignal('')
  const [showCreateForm, setShowCreateForm] = createSignal(false)

  const loadData = () => {
    const lists = watchlistService.getWatchlists()
    setWatchlists(lists)
    const selected = selectedWatchlist()
    if (selected) {
      const updated = lists.find(w => w.id === selected.id)
      if (updated) setSelectedWatchlist(updated)
      else setSelectedWatchlist(lists[0] || null)
    } else if (lists.length > 0) {
      setSelectedWatchlist(lists[0])
    }
  }

  createEffect(() => {
    if (props.visible) {
      loadData()
      const unsubscribe = watchlistService.subscribe(loadData)
      onCleanup(unsubscribe)
    }
  })

  const handleCreateWatchlist = () => {
    const name = newWatchlistName().trim()
    if (!name) return
    const wl = watchlistService.createWatchlist(name)
    setNewWatchlistName('')
    setShowCreateForm(false)
    setSelectedWatchlist(wl)
  }

  const handleDeleteWatchlist = (id: string) => {
    watchlistService.deleteWatchlist(id)
    setSelectedWatchlist(null)
  }

  const handleAddSymbol = () => {
    const symbol = newSymbol().trim().toUpperCase()
    const wl = selectedWatchlist()
    if (!symbol || !wl) return
    watchlistService.addSymbol(wl.id, symbol)
    setNewSymbol('')
  }

  const handleRemoveSymbol = (watchlistId: string, itemId: string) => {
    watchlistService.removeSymbol(watchlistId, itemId)
  }

  const formatPrice = (price?: number) => {
    if (price === undefined || price === null) return '-'
    return price.toFixed(2)
  }

  const formatChange = (change?: number) => {
    if (change === undefined || change === null) return ''
    return change >= 0 ? `+${change.toFixed(2)}%` : `${change.toFixed(2)}%`
  }

  return (
    <Show when={props.visible}>
      <Modal
        title={i18n('watchlists', props.locale)}
        onClose={props.onClose}
        width={700}
      >
        <div class="klinecharts-pro-watchlist-modal">
          {/* Watchlist Tabs */}
          <div class="watchlist-tabs">
            <div class="tabs-list">
              <For each={watchlists()}>
                {(wl) => (
                  <button
                    class={`tab ${selectedWatchlist()?.id === wl.id ? 'active' : ''}`}
                    onClick={() => setSelectedWatchlist(wl)}
                  >
                    {wl.name}
                    <Show when={!wl.isDefault}>
                      <span
                        class="tab-delete"
                        onClick={(e) => { e.stopPropagation(); handleDeleteWatchlist(wl.id) }}
                      >×</span>
                    </Show>
                  </button>
                )}
              </For>
              <button
                class="tab add-tab"
                onClick={() => setShowCreateForm(true)}
              >+</button>
            </div>
          </div>

          {/* Create Form */}
          <Show when={showCreateForm()}>
            <div class="create-form">
              <Input
                value={newWatchlistName()}
                placeholder={i18n('watchlist_name', props.locale)}
                onChange={setNewWatchlistName}
              />
              <div class="form-actions">
                <Button
                  type="confirm"
                  onClick={handleCreateWatchlist}
                >{i18n('confirm', props.locale)}</Button>
                <Button
                  onClick={() => { setShowCreateForm(false); setNewWatchlistName('') }}
                >{i18n('cancel', props.locale)}</Button>
              </div>
            </div>
          </Show>

          {/* Symbol List */}
          <Show when={selectedWatchlist()} keyed>
            {(wl: Watchlist) => (
              <div class="watchlist-content">
                {/* Add Symbol */}
                <div class="add-symbol-form">
                  <Input
                    value={newSymbol()}
                    placeholder={i18n('add_symbol', props.locale)}
                    onChange={setNewSymbol}
                  />
                  <Button
                    type="confirm"
                    onClick={handleAddSymbol}
                  >{i18n('confirm', props.locale)}</Button>
                </div>

                {/* Items Table */}
                <Show when={wl.items.length > 0} fallback={
                  <div class="empty-state">
                    <span>📋</span>
                    <p>{i18n('no_symbols', props.locale)}</p>
                  </div>
                }>
                  <div class="symbols-table-container">
                    <table class="symbols-table">
                      <thead>
                        <tr>
                          <th>{i18n('symbol', props.locale)}</th>
                          <th>{i18n('price', props.locale)}</th>
                          <th>{i18n('change', props.locale)}</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        <For each={wl.items}>
                          {(item: WatchlistItem) => (
                            <tr
                              class="symbol-row"
                              onClick={() => props.onSymbolSelect?.(item.symbol)}
                            >
                              <td class="symbol-name">{item.symbol}</td>
                              <td>{formatPrice(item.currentPrice)}</td>
                              <td class={item.percentChange !== undefined ? (item.percentChange >= 0 ? 'positive' : 'negative') : ''}>
                                {formatChange(item.percentChange)}
                              </td>
                              <td>
                                <button
                                  class="remove-btn"
                                  onClick={(e) => { e.stopPropagation(); handleRemoveSymbol(wl.id, item.id) }}
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
            )}
          </Show>
        </div>
      </Modal>
    </Show>
  )
}

export default WatchlistModal
