/**
 * Mini Chart Widget Component
 * Displays small price charts for featured coins
 */

import { createSignal, createEffect, onCleanup, For, type Component } from 'solid-js'
import { marketDataService, type TickerUpdate } from '../services'
import { type SymbolInfo } from '../types'

// Default featured coins - can be customized by user
const DEFAULT_FEATURED_COINS = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT']

interface MiniChartWidgetProps {
  coins?: string[]
  onCoinClick?: (symbol: SymbolInfo) => void
  onSettingsClick?: () => void
}

interface CoinData {
  symbol: string
  ticker: TickerUpdate | null
  priceHistory: number[]
}

const formatPrice = (price: number): string => {
  if (price >= 1000) return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  if (price >= 1) return `$${price.toFixed(4)}`
  if (price >= 0.01) return `$${price.toFixed(6)}`
  return `$${price.toFixed(8)}`
}

const formatChange = (change: number): string => {
  const sign = change >= 0 ? '+' : ''
  return `${sign}${change.toFixed(2)}%`
}

// Simple sparkline SVG component
const Sparkline: Component<{ data: number[]; positive: boolean }> = (props) => {
  const width = 120
  const height = 40
  const padding = 2

  const points = () => {
    const data = props.data
    if (data.length < 2) return ''

    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 1

    return data
      .map((value, index) => {
        const x = padding + (index / (data.length - 1)) * (width - 2 * padding)
        const y = height - padding - ((value - min) / range) * (height - 2 * padding)
        return `${x},${y}`
      })
      .join(' ')
  }

  return (
    <svg width={width} height={height} class="mini-chart-card__chart">
      <polyline
        fill="none"
        stroke={props.positive ? '#00d26a' : '#f6465d'}
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        points={points()}
      />
    </svg>
  )
}

export const MiniChartWidget: Component<MiniChartWidgetProps> = (props) => {
  const [coins, setCoins] = createSignal<CoinData[]>(
    (props.coins || DEFAULT_FEATURED_COINS).map(symbol => ({
      symbol,
      ticker: null,
      priceHistory: []
    }))
  )

  createEffect(() => {
    // Subscribe to market data updates
    const unsubscribe = marketDataService.subscribeAll((tickers) => {
      setCoins(prev => 
        prev.map(coin => {
          const ticker = tickers.get(coin.symbol)
          if (ticker) {
            // Keep last 20 price points for sparkline
            const newHistory = [...coin.priceHistory, ticker.price].slice(-20)
            return { ...coin, ticker, priceHistory: newHistory }
          }
          return coin
        })
      )
    })

    onCleanup(() => {
      unsubscribe()
    })
  })

  const handleCoinClick = (coin: CoinData) => {
    if (props.onCoinClick && coin.ticker) {
      const symbolInfo: SymbolInfo = {
        ticker: coin.symbol,
        name: `${coin.symbol.replace('USDT', '')} / USDT`,
        shortName: coin.symbol.replace('USDT', ''),
        exchange: 'Binance',
        market: 'crypto',
        pricePrecision: coin.ticker.price >= 1000 ? 2 : coin.ticker.price >= 1 ? 4 : 6,
        volumePrecision: 2
      }
      props.onCoinClick(symbolInfo)
    }
  }

  return (
    <div class="dashboard-card mini-charts">
      <div class="dashboard-card__header">
        <h3 class="dashboard-card__title">📈 Live Charts</h3>
        <div class="mini-charts__settings">
          <button 
            class="mini-charts__settings-btn" 
            onClick={props.onSettingsClick}
            title="Customize coins"
          >
            ⚙️
          </button>
        </div>
      </div>
      <div class="dashboard-card__body">
        <div class="mini-charts__grid">
          <For each={coins()}>
            {(coin) => (
              <div 
                class="mini-chart-card" 
                onClick={() => handleCoinClick(coin)}
              >
                <div class="mini-chart-card__header">
                  <span class="mini-chart-card__symbol">
                    {coin.symbol.replace('USDT', '')}
                  </span>
                  {coin.ticker && (
                    <span class={`mini-chart-card__change ${coin.ticker.priceChangePercent >= 0 ? 'mini-chart-card__change--positive' : 'mini-chart-card__change--negative'}`}>
                      {formatChange(coin.ticker.priceChangePercent)}
                    </span>
                  )}
                </div>
                <div class="mini-chart-card__price">
                  {coin.ticker ? formatPrice(coin.ticker.price) : '--'}
                </div>
                {coin.priceHistory.length > 1 && (
                  <Sparkline 
                    data={coin.priceHistory} 
                    positive={coin.ticker ? coin.ticker.priceChangePercent >= 0 : true}
                  />
                )}
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  )
}

export default MiniChartWidget
