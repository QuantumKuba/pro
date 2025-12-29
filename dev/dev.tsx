/// <reference types="vite/client" />
import { render } from 'solid-js/web'
import { createSignal, Show, onCleanup } from 'solid-js'
import { KLineChartPro, BinanceDatafeed, CompositeDatafeed, DefaultDatafeed } from '../src/index'
import { CryptoDashboard } from '../src/dashboard'
import { type SymbolInfo } from '../src/types'
import { inject } from '@vercel/analytics'

// Import dashboard styles (includes chart-view styles)
import '../src/dashboard/dashboard.less'

// Initialize datafeeds
const polygonDatafeed = new DefaultDatafeed(import.meta.env.VITE_POLYGON || '')
const binanceDatafeed = new BinanceDatafeed()

const datafeed = new CompositeDatafeed({
  stocks: polygonDatafeed,
  crypto: binanceDatafeed
})

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
  
  let chartInstance: any = null
  let chartContainer: HTMLDivElement | undefined

  const handleNavigateToChart = (symbol: SymbolInfo) => {
    setState({ view: 'chart', symbol })
  }

  const handleBackToDashboard = () => {
    // Destroy chart instance if exists
    if (chartInstance) {
      chartInstance.destroy()
      chartInstance = null
    }
    setState({ view: 'dashboard', symbol: null })
  }

  // Handle symbol change from within the chart
  const handleSymbolChange = (newSymbol: SymbolInfo) => {
    setState(prev => ({ ...prev, symbol: newSymbol }))
  }

  // Create chart when view changes to 'chart'
  const initChart = (container: HTMLDivElement) => {
    chartContainer = container
    const symbol = state().symbol
    
    if (!symbol) return

    chartInstance = new KLineChartPro({
      container,
      symbol,
      period: { span: 15, type: 'minute', text: '15m' },
      periods: [
        { span: 1, type: 'minute', text: '1m' },
        { span: 3, type: 'minute', text: '3m' },
        { span: 5, type: 'minute', text: '5m' },
        { span: 15, type: 'minute', text: '15m' },
        { span: 30, type: 'minute', text: '30m' },
        { span: 1, type: 'hour', text: '1H' },
        { span: 2, type: 'hour', text: '2H' },
        { span: 4, type: 'hour', text: '4H' },
        { span: 6, type: 'hour', text: '6H' },
        { span: 12, type: 'hour', text: '12H' },
        { span: 1, type: 'day', text: '1D' },
        { span: 1, type: 'week', text: '1W' },
        { span: 1, type: 'month', text: '1M' },
      ],
      mainIndicators: ['MA'],
      subIndicators: ['VOL'],
      datafeed,
      drawingBarVisible: true,
      theme: 'dark',
      onSymbolChange: handleSymbolChange,
    })

    // Expose chart to window for debugging
    ;(window as any).chart = chartInstance
  }

  onCleanup(() => {
    if (chartInstance) {
      chartInstance.destroy()
    }
  })

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
          <div 
            id="chart-container" 
            class="chart-view__chart"
            ref={initChart}
          />
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
