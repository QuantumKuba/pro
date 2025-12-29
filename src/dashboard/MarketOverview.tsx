/**
 * Market Overview Component
 * Displays global market statistics
 */

import { createSignal, createEffect, onCleanup, Show, type Component } from 'solid-js'
import { topMoversService, type GlobalMarketData } from '../services'

const formatNumber = (num: number): string => {
  if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`
  return `$${num.toLocaleString()}`
}

const formatPercent = (num: number): string => {
  const sign = num >= 0 ? '+' : ''
  return `${sign}${num.toFixed(2)}%`
}

interface StatCardProps {
  label: string
  value: string
  change?: number
  loading?: boolean
  icon?: string
}

const StatCard: Component<StatCardProps> = (props) => {
  return (
    <div class={`stat-card ${props.loading ? 'stat-card--loading' : ''}`}>
      <div class="stat-card__label">
        {props.icon && <span>{props.icon}</span>}
        {props.label}
      </div>
      <div class="stat-card__value">{props.loading ? '...' : props.value}</div>
      <Show when={props.change !== undefined}>
        <div class={`stat-card__change ${(props.change ?? 0) >= 0 ? 'stat-card__change--positive' : 'stat-card__change--negative'}`}>
          {formatPercent(props.change ?? 0)}
        </div>
      </Show>
    </div>
  )
}

export const MarketOverview: Component = () => {
  const [data, setData] = createSignal<GlobalMarketData | null>(null)
  const [loading, setLoading] = createSignal(true)

  const fetchData = async () => {
    try {
      const result = await topMoversService.getGlobalMarketData()
      setData(result)
    } catch (error) {
      console.error('Failed to fetch global market data:', error)
    } finally {
      setLoading(false)
    }
  }

  createEffect(() => {
    fetchData()
    
    // Refresh every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000)
    onCleanup(() => clearInterval(interval))
  })

  return (
    <div class="market-overview">
      <StatCard
        label="Total Market Cap"
        icon="💰"
        value={data() ? formatNumber(data()!.totalMarketCap) : '$0'}
        change={data()?.marketCapChange24h}
        loading={loading()}
      />
      <StatCard
        label="24h Volume"
        icon="📊"
        value={data() ? formatNumber(data()!.totalVolume) : '$0'}
        loading={loading()}
      />
      <StatCard
        label="BTC Dominance"
        icon="₿"
        value={data() ? `${data()!.btcDominance.toFixed(1)}%` : '0%'}
        loading={loading()}
      />
      <StatCard
        label="Active Pairs"
        icon="🔗"
        value="2,000+"
        loading={loading()}
      />
    </div>
  )
}

export default MarketOverview
