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

import { Component, createSignal, createResource, Show, For, createMemo } from 'solid-js'

import { Modal, List, Input } from '../../component'

import i18n from '../../i18n'

import { SymbolInfo, ChartDataLoaderType } from '../../types'
import { getFavorites, toggleFavorite, isFavorite } from '../../FavoritesService'
import { QUOTE_ASSETS, QuoteAsset, filterSymbolsByQuoteAsset } from '../../BinanceDatafeed'

export interface SymbolSearchModalProps {
  locale: string
  datafeed: ChartDataLoaderType
  onSymbolSelected: (symbol: SymbolInfo) => void
  onClose: () => void
}

// Tab options for quote asset filtering
const TABS: { key: QuoteAsset; label: string }[] = [
  { key: 'ALL', label: 'All' },
  ...QUOTE_ASSETS.map(q => ({ key: q as QuoteAsset, label: q })),
  { key: 'OTHER', label: 'Other' }
]

const SymbolSearchModal: Component<SymbolSearchModalProps> = props => {
  const [searchValue, setSearchValue] = createSignal('')
  const [activeTab, setActiveTab] = createSignal<QuoteAsset>('USDT')
  const [favoritesExpanded, setFavoritesExpanded] = createSignal(true)
  const [, setFavoritesVersion] = createSignal(0) // Trigger re-render on favorites change

  // Fetch all symbols
  const [allSymbols] = createResource(
    () => '', // Initial empty search to load all
    () => props.datafeed.searchSymbols('')
  )

  // Get current favorites
  const favorites = createMemo(() => {
    // Access version to trigger reactivity
    setFavoritesVersion
    return getFavorites()
  })

  // Filter symbols based on search and active tab
  const filteredSymbols = createMemo(() => {
    const symbols = allSymbols() ?? []
    const search = searchValue().toLowerCase()
    const tab = activeTab()

    // Filter by quote asset first
    let filtered = filterSymbolsByQuoteAsset(symbols, tab)

    // Then filter by search
    if (search) {
      filtered = filtered.filter(s =>
        s.ticker.toLowerCase().includes(search) ||
        s.name?.toLowerCase().includes(search) ||
        s.shortName?.toLowerCase().includes(search)
      )
    }

    return filtered
  })

  // Get favorite symbols from the filtered list
  const favoriteSymbols = createMemo(() => {
    const symbols = allSymbols() ?? []
    const favs = favorites()
    return symbols.filter(s => favs.includes(s.ticker))
  })

  // Handle star click
  const handleToggleFavorite = (ticker: string, e: Event) => {
    e.stopPropagation()
    toggleFavorite(ticker)
    // Force re-render by updating version
    setFavoritesVersion(v => v + 1)
  }

  // Check if symbol is favorite (reactive)
  const isSymbolFavorite = (ticker: string) => {
    favorites() // Access to trigger reactivity
    return isFavorite(ticker)
  }

  return (
    <Modal
      title={i18n('symbol_search', props.locale)}
      width={520}
      onClose={props.onClose}>

      {/* Search Input */}
      <Input
        class="klinecharts-pro-symbol-search-modal-input"
        placeholder={i18n('symbol_code', props.locale)}
        suffix={
          <svg viewBox="0 0 1024 1024">
            <path d="M945.066667 898.133333l-189.866667-189.866666c55.466667-64 87.466667-149.333333 87.466667-241.066667 0-204.8-168.533333-373.333333-373.333334-373.333333S96 264.533333 96 469.333333 264.533333 842.666667 469.333333 842.666667c91.733333 0 174.933333-34.133333 241.066667-87.466667l189.866667 189.866667c6.4 6.4 14.933333 8.533333 23.466666 8.533333s17.066667-2.133333 23.466667-8.533333c8.533333-12.8 8.533333-34.133333-2.133333-46.933334zM469.333333 778.666667C298.666667 778.666667 160 640 160 469.333333S298.666667 160 469.333333 160 778.666667 298.666667 778.666667 469.333333 640 778.666667 469.333333 778.666667z" />
          </svg>
        }
        value={searchValue()}
        onChange={v => setSearchValue(`${v}`)} />

      {/* Quote Asset Tabs */}
      <div class="klinecharts-pro-symbol-search-tabs">
        <For each={TABS}>
          {tab => (
            <button
              class={`tab-item ${activeTab() === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}>
              {tab.label}
            </button>
          )}
        </For>
      </div>

      {/* Favorites Section */}
      <Show when={favoriteSymbols().length > 0}>
        <div class="klinecharts-pro-symbol-search-favorites">
          <div
            class="favorites-header"
            onClick={() => setFavoritesExpanded(!favoritesExpanded())}>
            <span class="favorites-title">
              <svg class={`chevron ${favoritesExpanded() ? 'expanded' : ''}`} viewBox="0 0 24 24">
                <path d="M9 18l6-6-6-6" />
              </svg>
              {i18n('favorites', props.locale) || 'Favorites'}
            </span>
            <span class="favorites-count">{favoriteSymbols().length}</span>
          </div>

          <Show when={favoritesExpanded()}>
            <div class="favorites-list">
              <For each={favoriteSymbols()}>
                {symbol => (
                  <div
                    class="symbol-row favorite"
                    onClick={() => {
                      props.onSymbolSelected(symbol)
                      props.onClose()
                    }}>
                    <button
                      class="star-button active"
                      onClick={(e) => handleToggleFavorite(symbol.ticker, e)}
                      title={i18n('remove_from_favorites', props.locale) || 'Remove from favorites'}>
                      <svg viewBox="0 0 24 24">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                    </button>
                    <div class="symbol-info">
                      <span class="symbol-ticker">{symbol.shortName ?? symbol.ticker}</span>
                      <span class="symbol-name">{symbol.name}</span>
                    </div>
                    <span class="symbol-exchange">{symbol.exchange}</span>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>
      </Show>

      {/* Symbol List */}
      <div class="klinecharts-pro-symbol-search-section-title">
        {i18n('all_pairs', props.locale) || 'All Pairs'}
        <span class="symbol-count">({filteredSymbols().length})</span>
      </div>

      <List
        class="klinecharts-pro-symbol-search-modal-list"
        loading={allSymbols.loading}
        dataSource={filteredSymbols()}
        renderItem={(symbol: SymbolInfo) => (
          <li
            class="symbol-row"
            onClick={() => {
              props.onSymbolSelected(symbol)
              props.onClose()
            }}>
            <button
              class={`star-button ${isSymbolFavorite(symbol.ticker) ? 'active' : ''}`}
              onClick={(e) => handleToggleFavorite(symbol.ticker, e)}
              title={isSymbolFavorite(symbol.ticker)
                ? (i18n('remove_from_favorites', props.locale) || 'Remove from favorites')
                : (i18n('add_to_favorites', props.locale) || 'Add to favorites')}>
              <svg viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </button>
            <div class="symbol-info">
              <span class="symbol-ticker">{symbol.shortName ?? symbol.ticker}</span>
              <span class="symbol-name">{symbol.name}</span>
            </div>
            <span class="symbol-exchange">{symbol.exchange}</span>
          </li>
        )}>
      </List>
    </Modal>
  )
}

export default SymbolSearchModal
