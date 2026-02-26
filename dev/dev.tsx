/// <reference types="vite/client" />
import { render } from 'solid-js/web'
import { createSignal, Show, onCleanup } from 'solid-js'
import { BinanceDatafeed, CompositeDatafeed, DefaultDatafeed } from '../src/index'
import { LayoutManager, LayoutSelector } from '../src/layout'
import type { LayoutManagerApi } from '../src/layout'
import type { LayoutPreset } from '../src/layout/types'
import { CryptoDashboard } from '../src/dashboard'
import { type SymbolInfo } from '../src/types'
import { inject } from '@vercel/analytics'

// Import dashboard styles (includes chart-view styles)
import '../src/dashboard/dashboard.less'
import '../src/layout/layout.less'

// Initialize datafeeds
const polygonDatafeed = new DefaultDatafeed(import.meta.env.VITE_POLYGON || '')
const binanceDatafeed = new BinanceDatafeed()

const datafeed = new CompositeDatafeed({
  stocks: polygonDatafeed,
  crypto: binanceDatafeed
})

const defaultPeriods = [
  { span: 1, type: 'minute' as const, text: '1m' },
  { span: 3, type: 'minute' as const, text: '3m' },
  { span: 5, type: 'minute' as const, text: '5m' },
  { span: 15, type: 'minute' as const, text: '15m' },
  { span: 30, type: 'minute' as const, text: '30m' },
  { span: 1, type: 'hour' as const, text: '1H' },
  { span: 2, type: 'hour' as const, text: '2H' },
  { span: 4, type: 'hour' as const, text: '4H' },
  { span: 6, type: 'hour' as const, text: '6H' },
  { span: 12, type: 'hour' as const, text: '12H' },
  { span: 1, type: 'day' as const, text: '1D' },
  { span: 1, type: 'week' as const, text: '1W' },
  { span: 1, type: 'month' as const, text: '1M' },
]

// View state: 'dashboard' or 'chart'
type ViewState = 'dashboard' | 'chart'

interface AppState {
  view: ViewState
  symbol: SymbolInfo | null
}

function App() {
  const [state, setState] = createSignal<AppState>({
    view: 'dashboard',
    symbol: null
  })

  const [currentPresetId, setCurrentPresetId] = createSignal('single')
  let layoutApi: LayoutManagerApi | null = null

  const handleNavigateToChart = (symbol: SymbolInfo) => {
    setState({ view: 'chart', symbol })
  }

  const handleBackToDashboard = () => {
    layoutApi = null
    setState({ view: 'dashboard', symbol: null })
  }

  const handleSymbolChange = (newSymbol: SymbolInfo) => {
    setState(prev => ({ ...prev, symbol: newSymbol }))
  }

  const handleLayoutSelect = (preset: LayoutPreset) => {
    layoutApi?.switchPreset(preset)
    setCurrentPresetId(preset.id)
  }

  const handleLayoutRef = (api: LayoutManagerApi) => {
    layoutApi = api
  }

  return (
    <>
      <Show when={state().view === 'dashboard'}>
        <CryptoDashboard 
          onNavigateToChart={handleNavigateToChart}
          logoSrc="/logo_with_text.svg"
        />
      </Show>
      
      <Show when={state().view === 'chart'}>
        <div class="chart-view">
          <header class="chart-view__header">
            <div class="chart-view__header-left">
              <img 
                src="/logo_with_text.svg" 
                alt="DeltaScope AI" 
                class="chart-view__logo"
                onClick={handleBackToDashboard}
              />
              <div class="chart-view__symbol-info">
                <span class="chart-view__symbol">{state().symbol?.shortName}</span>
                <span class="chart-view__pair">/ USDT</span>
              </div>
            </div>
            <nav class="chart-view__nav">
              <LayoutSelector
                currentPresetId={currentPresetId()}
                onSelect={handleLayoutSelect}
              />
              <button class="chart-view__nav-btn" onClick={handleBackToDashboard}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
                  <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
                Dashboard
              </button>
              <button class="chart-view__nav-btn chart-view__nav-btn--active">
                Trade
              </button>
            </nav>
          </header>
          <div class="chart-view__chart">
            <Show when={state().symbol}>
              {(symbol) => (
                <LayoutManager
                  ref={handleLayoutRef}
                  initialSymbol={symbol()}
                  period={{ span: 15, type: 'minute', text: '15m' }}
                  periods={defaultPeriods}
                  datafeed={datafeed}
                  theme="dark"
                  locale="en-US"
                  mainIndicators={['MA']}
                  subIndicators={['VOL']}
                  onSymbolChange={handleSymbolChange}
                />
              )}
            </Show>
          </div>
        </div>
      </Show>
    </>
  )
}

function init() {
  // Initialize Vercel Web Analytics
  inject()

  // Render the app
  const appElement = document.getElementById('app')
  if (appElement) {
    render(() => <App />, appElement)
  }
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
