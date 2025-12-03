/// <reference types="vite/client" />
import { KLineChartPro, DefaultDatafeed, BinanceDatafeed, CompositeDatafeed } from '../src/index'
import { inject } from '@vercel/analytics'

const polygonDatafeed = new DefaultDatafeed(import.meta.env.VITE_POLYGON || '')
const binanceDatafeed = new BinanceDatafeed()

const datafeed = new CompositeDatafeed({
  stocks: polygonDatafeed,
  crypto: binanceDatafeed
})

function init() {
  // Initialize Vercel Web Analytics
  inject()

  const chart = new KLineChartPro({
    container: 'app',
    symbol: {
      ticker: 'BTCUSDT',
      name: 'Bitcoin / USDT',
      shortName: 'BTC',
      exchange: 'Binance',
      market: 'crypto',
      pricePrecision: 2,
      volumePrecision: 5,
    },
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
  })

  // Expose chart to window for debugging
  ;(window as any).chart = chart
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
