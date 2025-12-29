/**
 * Top Movers Widget Component
 * Shows top gaining and losing cryptocurrencies
 */

import { createSignal, createEffect, onCleanup, For, Show, type Component } from 'solid-js'
import { topMoversService, type TopMover, type TopMoversData, type TimeFilter } from '../services'
import { type SymbolInfo } from '../types'

interface TopMoversWidgetProps {
  onCoinClick?: (symbol: SymbolInfo) => void
}

const formatPrice = (price: number): string => {
  if (price >= 1000) return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  if (price >= 1) return `$${price.toFixed(4)}`
  if (price >= 0.01) return `$${price.toFixed(6)}`
  return `$${price.toFixed(8)}`
}

const formatVolume = (volume: number): string => {
  if (volume >= 1e9) return `$${(volume / 1e9).toFixed(2)}B`
  if (volume >= 1e6) return `$${(volume / 1e6).toFixed(2)}M`
  if (volume >= 1e3) return `$${(volume / 1e3).toFixed(2)}K`
  return `$${volume.toFixed(2)}`
}

const formatChange = (change: number): string => {
  const sign = change >= 0 ? '+' : ''
  return `${sign}${change.toFixed(2)}%`
}

export const TopMoversWidget: Component<TopMoversWidgetProps> = (props) => {
  const [tab, setTab] = createSignal<'gainers' | 'losers'>('gainers')
  const [timeFilter, setTimeFilter] = createSignal<TimeFilter>('24h')
  const [data, setData] = createSignal<TopMoversData | null>(null)
  const [loading, setLoading] = createSignal(true)

  const fetchData = async () => {
    setLoading(true)
    try {
      const result = await topMoversService.getTopMovers(timeFilter(), 10)
      setData(result)
    } catch (error) {
      console.error('Failed to fetch top movers:', error)
    } finally {
      setLoading(false)
    }
  }

  createEffect(() => {
    // Re-fetch when time filter changes
    timeFilter()
    fetchData()
    
    // Refresh every minute
    const interval = setInterval(fetchData, 60 * 1000)
    onCleanup(() => clearInterval(interval))
  })

  const movers = () => {
    const d = data()
    if (!d) return []
    return tab() === 'gainers' ? d.gainers : d.losers
  }

  const handleRowClick = (mover: TopMover) => {
    if (props.onCoinClick) {
      const symbolInfo = topMoversService.moverToSymbolInfo(mover)
      props.onCoinClick(symbolInfo)
    }
  }

  return (
    <div class="dashboard-card top-movers">
      <div class="dashboard-card__header">
        <div class="top-movers__tabs">
          <button
            class={`top-movers__tab top-movers__tab--gainers ${tab() === 'gainers' ? 'top-movers__tab--active' : ''}`}
            onClick={() => setTab('gainers')}
          >
            🚀 Top Gainers
          </button>
          <button
            class={`top-movers__tab top-movers__tab--losers ${tab() === 'losers' ? 'top-movers__tab--active' : ''}`}
            onClick={() => setTab('losers')}
          >
            📉 Top Losers
          </button>
        </div>
        <div class="top-movers__filters">
          <button
            class={`top-movers__filter ${timeFilter() === '1h' ? 'top-movers__filter--active' : ''}`}
            onClick={() => setTimeFilter('1h')}
          >
            1H
          </button>
          <button
            class={`top-movers__filter ${timeFilter() === '24h' ? 'top-movers__filter--active' : ''}`}
            onClick={() => setTimeFilter('24h')}
          >
            24H
          </button>
          <button
            class={`top-movers__filter ${timeFilter() === '7d' ? 'top-movers__filter--active' : ''}`}
            onClick={() => setTimeFilter('7d')}
          >
            7D
          </button>
        </div>
      </div>
      <div class="dashboard-card__body">
        <Show when={!loading()} fallback={<div class="top-movers__empty">Loading...</div>}>
          <Show when={movers().length > 0} fallback={<div class="top-movers__empty">No data available</div>}>
            <table class="top-movers__table">
              <thead>
                <tr>
                  <th class="top-movers__th">#</th>
                  <th class="top-movers__th">Asset</th>
                  <th class="top-movers__th">Price</th>
                  <th class="top-movers__th">Volume (24h)</th>
                  <th class="top-movers__th">Change</th>
                </tr>
              </thead>
              <tbody>
                <For each={movers()}>
                  {(mover, index) => (
                    <tr class="top-movers__row" onClick={() => handleRowClick(mover)}>
                      <td class="top-movers__td top-movers__rank">{index() + 1}</td>
                      <td class="top-movers__td">
                        <span class="top-movers__symbol">{mover.symbol}</span>
                        <span class="top-movers__name">{mover.name !== mover.symbol ? mover.name : ''}</span>
                      </td>
                      <td class="top-movers__td top-movers__price">{formatPrice(mover.price)}</td>
                      <td class="top-movers__td top-movers__volume">{formatVolume(mover.quoteVolume)}</td>
                      <td class="top-movers__td">
                        <span class={`top-movers__change ${mover.priceChangePercent >= 0 ? 'top-movers__change--positive' : 'top-movers__change--negative'}`}>
                          {formatChange(mover.priceChangePercent)}
                        </span>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </Show>
        </Show>
      </div>
    </div>
  )
}

export default TopMoversWidget
