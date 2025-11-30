/**
 * Binance Datafeed for KLineCharts Pro
 * Free real-time crypto data - no API key required
 */

import { KLineData } from 'klinecharts'

import { Datafeed, SymbolInfo, Period, DatafeedSubscribeCallback } from './types'

const BINANCE_API = 'https://api.binance.com/api/v3'
const BINANCE_WS = 'wss://stream.binance.com:9443/ws'

// Popular trading pairs
const SYMBOLS: SymbolInfo[] = [
  { ticker: 'BTCUSDT', name: 'Bitcoin / USDT', shortName: 'BTC', exchange: 'Binance', market: 'crypto', pricePrecision: 2, volumePrecision: 5 },
  { ticker: 'ETHUSDT', name: 'Ethereum / USDT', shortName: 'ETH', exchange: 'Binance', market: 'crypto', pricePrecision: 2, volumePrecision: 4 },
  { ticker: 'BNBUSDT', name: 'BNB / USDT', shortName: 'BNB', exchange: 'Binance', market: 'crypto', pricePrecision: 2, volumePrecision: 3 },
  { ticker: 'SOLUSDT', name: 'Solana / USDT', shortName: 'SOL', exchange: 'Binance', market: 'crypto', pricePrecision: 2, volumePrecision: 3 },
  { ticker: 'XRPUSDT', name: 'XRP / USDT', shortName: 'XRP', exchange: 'Binance', market: 'crypto', pricePrecision: 4, volumePrecision: 1 },
  { ticker: 'ADAUSDT', name: 'Cardano / USDT', shortName: 'ADA', exchange: 'Binance', market: 'crypto', pricePrecision: 4, volumePrecision: 1 },
  { ticker: 'DOGEUSDT', name: 'Dogecoin / USDT', shortName: 'DOGE', exchange: 'Binance', market: 'crypto', pricePrecision: 5, volumePrecision: 0 },
  { ticker: 'DOTUSDT', name: 'Polkadot / USDT', shortName: 'DOT', exchange: 'Binance', market: 'crypto', pricePrecision: 3, volumePrecision: 2 },
  { ticker: 'LINKUSDT', name: 'Chainlink / USDT', shortName: 'LINK', exchange: 'Binance', market: 'crypto', pricePrecision: 3, volumePrecision: 2 },
  { ticker: 'AVAXUSDT', name: 'Avalanche / USDT', shortName: 'AVAX', exchange: 'Binance', market: 'crypto', pricePrecision: 2, volumePrecision: 2 },
  { ticker: 'MATICUSDT', name: 'Polygon / USDT', shortName: 'MATIC', exchange: 'Binance', market: 'crypto', pricePrecision: 4, volumePrecision: 1 },
  { ticker: 'ATOMUSDT', name: 'Cosmos / USDT', shortName: 'ATOM', exchange: 'Binance', market: 'crypto', pricePrecision: 3, volumePrecision: 2 },
  { ticker: 'LTCUSDT', name: 'Litecoin / USDT', shortName: 'LTC', exchange: 'Binance', market: 'crypto', pricePrecision: 2, volumePrecision: 3 },
  { ticker: 'UNIUSDT', name: 'Uniswap / USDT', shortName: 'UNI', exchange: 'Binance', market: 'crypto', pricePrecision: 3, volumePrecision: 2 },
  { ticker: 'NEARUSDT', name: 'NEAR Protocol / USDT', shortName: 'NEAR', exchange: 'Binance', market: 'crypto', pricePrecision: 3, volumePrecision: 1 },
]

function periodToInterval(period: Period): string {
  const { span, type } = period
  switch (type) {
    case 'second': return '1s'
    case 'minute':
      if (span === 1) return '1m'
      if (span === 3) return '3m'
      if (span === 5) return '5m'
      if (span === 15) return '15m'
      if (span === 30) return '30m'
      return `${span}m`
    case 'hour':
      if (span === 1) return '1h'
      if (span === 2) return '2h'
      if (span === 4) return '4h'
      if (span === 6) return '6h'
      if (span === 8) return '8h'
      if (span === 12) return '12h'
      return `${span}h`
    case 'day':
      if (span === 1) return '1d'
      if (span === 3) return '3d'
      return `${span}d`
    case 'week': return '1w'
    case 'month': return '1M'
    case 'year': return '1M' // Binance doesn't support yearly, use monthly
    default: return '15m'
  }
}

export default class BinanceDatafeed implements Datafeed {
  private _ws: WebSocket | null = null
  private _currentSymbol: string | null = null
  private _currentInterval: string | null = null

  async searchSymbols(search?: string): Promise<SymbolInfo[]> {
    if (!search) return SYMBOLS
    const searchLower = search.toLowerCase()
    return SYMBOLS.filter(s => 
      s.ticker.toLowerCase().includes(searchLower) ||
      s.name?.toLowerCase().includes(searchLower) ||
      s.shortName?.toLowerCase().includes(searchLower)
    )
  }

  async getHistoryKLineData(
    symbol: SymbolInfo,
    period: Period,
    from: number,
    to: number
  ): Promise<KLineData[]> {
    const interval = periodToInterval(period)
    const url = `${BINANCE_API}/klines?symbol=${symbol.ticker}&interval=${interval}&startTime=${from}&endTime=${to}&limit=1000`
    
    try {
      const response = await fetch(url)
      const data = await response.json()
      
      if (!Array.isArray(data)) {
        console.error('Binance API error:', data)
        return []
      }
      
      return data.map((kline: any[]) => ({
        timestamp: kline[0],
        open: parseFloat(kline[1]),
        high: parseFloat(kline[2]),
        low: parseFloat(kline[3]),
        close: parseFloat(kline[4]),
        volume: parseFloat(kline[5]),
        turnover: parseFloat(kline[7]), // Quote asset volume
      }))
    } catch (error) {
      console.error('Failed to fetch history:', error)
      return []
    }
  }

  subscribe(
    symbol: SymbolInfo,
    period: Period,
    callback: DatafeedSubscribeCallback
  ): void {
    const interval = periodToInterval(period)
    const streamName = `${symbol.ticker.toLowerCase()}@kline_${interval}`
    
    // Close existing connection if symbol/interval changed
    if (this._ws && (this._currentSymbol !== symbol.ticker || this._currentInterval !== interval)) {
      this._ws.close()
      this._ws = null
    }
    
    if (!this._ws) {
      this._ws = new WebSocket(`${BINANCE_WS}/${streamName}`)
      this._currentSymbol = symbol.ticker
      this._currentInterval = interval
      
      this._ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.e === 'kline') {
            const k = data.k
            callback({
              timestamp: k.t, // Kline start time
              open: parseFloat(k.o),
              high: parseFloat(k.h),
              low: parseFloat(k.l),
              close: parseFloat(k.c),
              volume: parseFloat(k.v),
              turnover: parseFloat(k.q),
            })
          }
        } catch (error) {
          console.error('WebSocket message error:', error)
        }
      }
      
      this._ws.onerror = (error) => {
        console.error('WebSocket error:', error)
      }
      
      this._ws.onclose = () => {
        console.log('WebSocket closed')
      }
    }
  }

  unsubscribe(symbol: SymbolInfo, period: Period): void {
    if (this._ws) {
      this._ws.close()
      this._ws = null
      this._currentSymbol = null
      this._currentInterval = null
    }
  }
}
