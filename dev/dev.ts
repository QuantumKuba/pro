/// <reference types="vite/client" />
import { KLineChartPro, DefaultDatafeed } from '../src/index'

const chart = new KLineChartPro({
  container: 'app',
  symbol: {
    exchange: 'XNYS',
    market: 'stocks',
    name: 'Alibaba Group Holding Limited American Depositary Shares, each represents eight Ordinary Shares',
    shortName: 'BABA',
    ticker: 'BABA',
    priceCurrency: 'usd',
    type: 'ADRC',
  },
  period: { multiplier: 15, timespan: 'minute', text: '15m' },
  datafeed: new DefaultDatafeed(import.meta.env.VITE_POLYGON || '')
})
