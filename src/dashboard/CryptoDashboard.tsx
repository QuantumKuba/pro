/**
 * Crypto Dashboard Main Component
 * Landing page with market overview and top movers
 */

import { createSignal, onMount, onCleanup, type Component } from 'solid-js'
import { type SymbolInfo } from '../types'
import { marketDataService } from '../services'

import { MarketOverview } from './MarketOverview'
import { TopMoversWidget } from './TopMoversWidget'
import { MiniChartWidget } from './MiniChartWidget'
import { SettingsModal, loadSelectedCoins, saveSelectedCoins } from './SettingsModal'

import './dashboard.less'

export interface CryptoDashboardProps {
  onNavigateToChart?: (symbol: SymbolInfo) => void
  logoSrc?: string
}

export const CryptoDashboard: Component<CryptoDashboardProps> = (props) => {
  const [showSettings, setShowSettings] = createSignal(false)
  const [selectedCoins, setSelectedCoins] = createSignal<string[]>(loadSelectedCoins())
  
  onMount(() => {
    // Connect to market data on mount
    marketDataService.connect()
  })

  onCleanup(() => {
    // Cleanup on unmount
    marketDataService.disconnect()
  })

  const handleCoinClick = (symbol: SymbolInfo) => {
    if (props.onNavigateToChart) {
      props.onNavigateToChart(symbol)
    }
  }

  const handleSettingsClick = () => {
    setShowSettings(true)
  }

  const handleSettingsSave = (coins: string[]) => {
    setSelectedCoins(coins)
    saveSelectedCoins(coins)
  }

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
        <div class="crypto-dashboard__grid">
          {/* Market Overview Stats */}
          <MarketOverview />

          {/* Mini Charts for Featured Coins */}
          <MiniChartWidget 
            coins={selectedCoins()}
            onCoinClick={handleCoinClick}
            onSettingsClick={handleSettingsClick}
          />

          {/* Top Movers Widget */}
          <TopMoversWidget onCoinClick={handleCoinClick} />
        </div>
      </main>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettings()}
        onClose={() => setShowSettings(false)}
        selectedCoins={selectedCoins()}
        onSave={handleSettingsSave}
      />
    </div>
  )
}

export default CryptoDashboard
