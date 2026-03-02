/**
 * Crypto Dashboard Main Component
 * TradingView-inspired landing page with market list, watchlists, summary, and news
 */

import { createMemo, createSignal, For, onCleanup, onMount, Show, type Component } from 'solid-js'
import { type SymbolInfo } from '../types'
import watchlistService from '../WatchlistService'

import { MacroDashboardSection } from './MacroDashboardSection'

import './dashboard.less'

export interface CryptoDashboardProps {
  onNavigateToChart?: (symbol: SymbolInfo) => void
  logoSrc?: string
}

interface ScreenerRow {
  id: string
  ticker: string
  symbol: string
  name: string
  price: number
  marketCap: number
  volume24h: number
  change24h: number
}

interface MarketNewsItem {
  id: string
  title: string
  source: string
  url: string
  summary: string
  publishedAt: number
}

const STARRED_STORAGE_KEY = 'dashboard_starred_symbols'

const formatPrice = (price: number): string => {
  if (price >= 1000) return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  if (price >= 1) return `$${price.toFixed(4)}`
  if (price >= 0.01) return `$${price.toFixed(6)}`
  return `$${price.toFixed(8)}`
}

const formatCompactCurrency = (value: number): string => {
  if (!Number.isFinite(value)) return '$0'
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

const formatChange = (change: number): string => {
  const sign = change >= 0 ? '+' : ''
  return `${sign}${change.toFixed(2)}%`
}

const formatRelativeTime = (timestamp: number): string => {
  const diffMs = Date.now() - timestamp
  const mins = Math.floor(diffMs / 60000)
  const hours = Math.floor(mins / 60)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

const toSymbolInfo = (row: Pick<ScreenerRow, 'ticker' | 'symbol' | 'price'>): SymbolInfo => ({
  ticker: row.ticker,
  name: `${row.symbol} / USDT`,
  shortName: row.symbol,
  exchange: 'Binance',
  market: 'crypto',
  pricePrecision: row.price >= 1000 ? 2 : row.price >= 1 ? 4 : 6,
  volumePrecision: 2
})

const loadStarred = (): string[] => {
  try {
    const data = localStorage.getItem(STARRED_STORAGE_KEY)
    return data ? (JSON.parse(data) as string[]) : ['BTC', 'ETH', 'SOL']
  } catch {
    return ['BTC', 'ETH', 'SOL']
  }
}

const saveStarred = (symbols: string[]): void => {
  try {
    localStorage.setItem(STARRED_STORAGE_KEY, JSON.stringify(symbols))
  } catch {
    // Ignore localStorage write failures in private mode.
  }
}

interface CoinGeckoRow {
  id: string
  symbol: string
  name: string
  current_price: number
  market_cap: number
  total_volume: number
  price_change_percentage_24h: number
}

interface CoinGeckoNewsResponse {
  Data?: Array<{
    id?: string
    title?: string
    source?: string
    url?: string
    body?: string
    published_on?: number
  }>
}

export const CryptoDashboard: Component<CryptoDashboardProps> = (props) => {
  const [screenerRows, setScreenerRows] = createSignal<ScreenerRow[]>([])
  const [loadingRows, setLoadingRows] = createSignal(true)
  const [search, setSearch] = createSignal('')
  const [starredSymbols, setStarredSymbols] = createSignal<string[]>([])
  const [watchedSymbols, setWatchedSymbols] = createSignal<string[]>([])
  const [news, setNews] = createSignal<MarketNewsItem[]>([])
  const [newsLoading, setNewsLoading] = createSignal(true)

  const filteredRows = createMemo(() => {
    const term = search().trim().toUpperCase()
    if (!term) return screenerRows()
    return screenerRows().filter(row => row.symbol.includes(term) || row.name.toUpperCase().includes(term))
  })

  const starredRows = createMemo(() => {
    const starSet = new Set(starredSymbols())
    return screenerRows().filter(row => starSet.has(row.symbol)).slice(0, 12)
  })

  const watchedRows = createMemo(() => {
    const watchedSet = new Set(watchedSymbols())
    return screenerRows().filter(row => watchedSet.has(row.symbol)).slice(0, 12)
  })

  const handleCoinClick = (symbol: SymbolInfo) => {
    props.onNavigateToChart?.(symbol)
  }

  const refreshWatchlistSymbols = () => {
    const watchlist = watchlistService.getDefaultWatchlist()
    setWatchedSymbols((watchlist?.items ?? []).map(item => item.symbol.replace('USDT', '')))
  }

  const ensureDefaultWatchlist = () => {
    const existing = watchlistService.getDefaultWatchlist()
    if (!existing) {
      watchlistService.createWatchlist('My Watchlist', 'Dashboard watchlist', true)
    }
    refreshWatchlistSymbols()
  }

  const toggleStar = (symbol: string) => {
    setStarredSymbols(prev => {
      const next = prev.includes(symbol) ? prev.filter(item => item !== symbol) : [...prev, symbol]
      saveStarred(next)
      return next
    })
  }

  const toggleWatch = (symbol: string) => {
    const ticker = `${symbol}USDT`
    const watchlist = watchlistService.getDefaultWatchlist()
    if (!watchlist) return

    const existing = watchlist.items.find(item => item.symbol === ticker)
    if (existing) {
      watchlistService.removeSymbol(watchlist.id, existing.id)
    } else {
      watchlistService.addSymbol(watchlist.id, ticker)
    }
    refreshWatchlistSymbols()
  }

  const fetchScreener = async () => {
    try {
      const response = await fetch(
        'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=120&page=1&sparkline=false&price_change_percentage=24h'
      )

      if (!response.ok) {
        throw new Error(`CoinGecko response: ${response.status}`)
      }

      const data = (await response.json()) as CoinGeckoRow[]
      const rows: ScreenerRow[] = data
        .filter(item => Number.isFinite(item.current_price))
        .map(item => {
          const symbol = item.symbol.toUpperCase()
          return {
            id: item.id,
            ticker: `${symbol}USDT`,
            symbol,
            name: item.name,
            price: item.current_price,
            marketCap: item.market_cap,
            volume24h: item.total_volume,
            change24h: item.price_change_percentage_24h ?? 0
          }
        })

      setScreenerRows(rows)
    } catch (error) {
      console.error('Failed to fetch screener rows:', error)
      setScreenerRows([])
    } finally {
      setLoadingRows(false)
    }
  }

  const fetchNews = async () => {
    setNewsLoading(true)
    try {
      const response = await fetch(
        'https://min-api.cryptocompare.com/data/v2/news/?lang=EN&categories=BTC,ETH,Blockchain,Altcoin&excludeCategories=Sponsored'
      )

      if (!response.ok) {
        throw new Error(`CryptoCompare response: ${response.status}`)
      }

      const payload = (await response.json()) as CoinGeckoNewsResponse
      const items = (payload.Data ?? []).slice(0, 8).map((item, index) => ({
        id: item.id ?? `news-${index}`,
        title: item.title ?? 'Untitled',
        source: item.source ?? 'CryptoCompare',
        url: item.url ?? '#',
        summary: item.body ?? '',
        publishedAt: (item.published_on ?? Math.floor(Date.now() / 1000)) * 1000
      }))

      setNews(items)
    } catch (error) {
      console.error('Failed to fetch market news:', error)
      setNews([])
    } finally {
      setNewsLoading(false)
    }
  }

  onMount(() => {
    setStarredSymbols(loadStarred())
    ensureDefaultWatchlist()

    fetchScreener()
    fetchNews()

    const screenerInterval = setInterval(fetchScreener, 90 * 1000)
    const newsInterval = setInterval(fetchNews, 5 * 60 * 1000)
    const unsubscribeWatchlist = watchlistService.subscribe(refreshWatchlistSymbols)

    onCleanup(() => {
      clearInterval(screenerInterval)
      clearInterval(newsInterval)
      unsubscribeWatchlist()
    })
  })

  return (
    <div class="crypto-dashboard">
      <header class="crypto-dashboard__header">
        <img 
          src={props.logoSrc || '/logo_with_text.svg'} 
          alt="DeltaScope AI" 
          class="crypto-dashboard__logo"
        />
        <nav class="crypto-dashboard__nav">
          <button class="crypto-dashboard__nav-btn crypto-dashboard__nav-btn--active">
            Dashboard
          </button>
          <button 
            class="crypto-dashboard__nav-btn"
            onClick={() => handleCoinClick({
              ticker: 'BTCUSDT',
              name: 'Bitcoin / USDT',
              shortName: 'BTC',
              exchange: 'Binance',
              market: 'crypto',
              pricePrecision: 2,
              volumePrecision: 5
            })}
          >
            Trade
          </button>
        </nav>
      </header>

      <main class="crypto-dashboard__content">
        <section class="market-hero dashboard-card">
          <div class="dashboard-card__header market-hero__header">
            <div>
              <h2 class="dashboard-card__title">Market Pulse</h2>
              <p class="market-hero__subtitle">Your crypto home </p>
            </div>
            <input
              class="market-hero__search"
              type="text"
              value={search()}
              onInput={event => setSearch(event.currentTarget.value)}
              placeholder="Search coin or ticker..."
            />
          </div>

          <div class="market-hero__layout">
            <div class="market-hero__screener">
              <table class="market-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Price</th>
                    <th>24h</th>
                    <th>Market Cap</th>
                    <th>Volume</th>
                    <th>Watch</th>
                    <th>Star</th>
                  </tr>
                </thead>
                <tbody>
                  <Show when={!loadingRows()} fallback={<tr><td colSpan={7}>Loading market data...</td></tr>}>
                    <For each={filteredRows().slice(0, 60)}>
                      {(row) => (
                        <tr>
                          <td>
                            <button class="market-table__link" onClick={() => handleCoinClick(toSymbolInfo(row))}>
                              <span>{row.symbol}</span>
                              <small>{row.name}</small>
                            </button>
                          </td>
                          <td>{formatPrice(row.price)}</td>
                          <td>
                            <span class={`market-chip ${row.change24h >= 0 ? 'market-chip--up' : 'market-chip--down'}`}>
                              {formatChange(row.change24h)}
                            </span>
                          </td>
                          <td>{formatCompactCurrency(row.marketCap)}</td>
                          <td>{formatCompactCurrency(row.volume24h)}</td>
                          <td>
                            <button
                              class={`icon-toggle ${watchedSymbols().includes(row.symbol) ? 'icon-toggle--active' : ''}`}
                              title="Add to watchlist"
                              onClick={() => toggleWatch(row.symbol)}
                            >
                              👁
                            </button>
                          </td>
                          <td>
                            <button
                              class={`icon-toggle ${starredSymbols().includes(row.symbol) ? 'icon-toggle--active' : ''}`}
                              title="Star coin"
                              onClick={() => toggleStar(row.symbol)}
                            >
                              ★
                            </button>
                          </td>
                        </tr>
                      )}
                    </For>
                  </Show>
                </tbody>
              </table>
            </div>

            <aside class="market-hero__sidebar">
              <section class="side-panel">
                <h3>Starred</h3>
                <div class="side-panel__list">
                  <Show when={starredRows().length > 0} fallback={<p class="side-panel__empty">No starred coins yet.</p>}>
                    <For each={starredRows()}>
                      {(row) => (
                        <button class="side-panel__item" onClick={() => handleCoinClick(toSymbolInfo(row))}>
                          <span>{row.symbol}</span>
                          <span>{formatPrice(row.price)}</span>
                        </button>
                      )}
                    </For>
                  </Show>
                </div>
              </section>

              <section class="side-panel">
                <h3>Watched</h3>
                <div class="side-panel__list">
                  <Show when={watchedRows().length > 0} fallback={<p class="side-panel__empty">Add symbols to your watchlist from the table.</p>}>
                    <For each={watchedRows()}>
                      {(row) => (
                        <button class="side-panel__item" onClick={() => handleCoinClick(toSymbolInfo(row))}>
                          <span>{row.symbol}</span>
                          <span class={row.change24h >= 0 ? 'up' : 'down'}>{formatChange(row.change24h)}</span>
                        </button>
                      )}
                    </For>
                  </Show>
                </div>
              </section>

              <section class="side-panel side-panel--news">
                <h3>Market News</h3>
                <div class="side-panel__list">
                  <Show when={!newsLoading()} fallback={<p class="side-panel__empty">Loading latest headlines...</p>}>
                    <Show when={news().length > 0} fallback={<p class="side-panel__empty">News feed is unavailable right now.</p>}>
                      <For each={news()}>
                        {(item) => (
                          <a class="news-item" href={item.url} target="_blank" rel="noreferrer">
                            <span class="news-item__title">{item.title}</span>
                            <span class="news-item__meta">{item.source} · {formatRelativeTime(item.publishedAt)}</span>
                          </a>
                        )}
                      </For>
                    </Show>
                  </Show>
                </div>
              </section>
            </aside>
          </div>
        </section>

        <div class="crypto-dashboard__grid">
          <MacroDashboardSection />
        </div>
      </main>
    </div>
  )
}

export default CryptoDashboard
