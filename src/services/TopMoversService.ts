/**
 * Top Movers Service
 * Fetches top gaining and losing cryptocurrencies from Binance and CoinGecko
 */

import { SymbolInfo } from '../types'

export interface TopMover {
  symbol: string
  name: string
  price: number
  priceChange: number
  priceChangePercent: number
  volume: number
  quoteVolume: number
  high: number
  low: number
  ticker: string
}

export interface TopMoversData {
  gainers: TopMover[]
  losers: TopMover[]
  timestamp: number
}

export type TimeFilter = '1h' | '24h' | '7d'

// Binance 24hr ticker response
interface Binance24hrTicker {
  symbol: string
  priceChange: string
  priceChangePercent: string
  weightedAvgPrice: string
  prevClosePrice: string
  lastPrice: string
  lastQty: string
  bidPrice: string
  bidQty: string
  askPrice: string
  askQty: string
  openPrice: string
  highPrice: string
  lowPrice: string
  volume: string
  quoteVolume: string
  openTime: number
  closeTime: number
  firstId: number
  lastId: number
  count: number
}

// CoinGecko market response
interface CoinGeckoMarket {
  id: string
  symbol: string
  name: string
  current_price: number
  market_cap: number
  total_volume: number
  high_24h: number
  low_24h: number
  price_change_24h: number
  price_change_percentage_24h: number
  price_change_percentage_1h_in_currency?: number
  price_change_percentage_7d_in_currency?: number
}

// CoinGecko global data
export interface GlobalMarketData {
  totalMarketCap: number
  totalVolume: number
  btcDominance: number
  marketCapChange24h: number
}

const BINANCE_API = 'https://api.binance.com'
const COINGECKO_API = 'https://api.coingecko.com/api/v3'

// Minimum volume filter (in USDT)
const MIN_VOLUME = 1000000 // $1M

class TopMoversService {
  private cache: Map<string, { data: TopMoversData; timestamp: number }> = new Map()
  private globalCache: { data: GlobalMarketData | null; timestamp: number } = { data: null, timestamp: 0 }
  private symbolInfoCache: Map<string, SymbolInfo> = new Map()
  private readonly CACHE_TTL = 60 * 1000 // 1 minute
  private readonly GLOBAL_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  /**
   * Get top movers (gainers and losers) for a given time filter
   */
  async getTopMovers(filter: TimeFilter = '24h', limit: number = 10): Promise<TopMoversData> {
    const cacheKey = `${filter}-${limit}`
    const cached = this.cache.get(cacheKey)
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data
    }

    let data: TopMoversData

    if (filter === '24h') {
      data = await this.fetch24hMoversFromBinance(limit)
    } else {
      data = await this.fetchMoversFromCoinGecko(filter, limit)
    }

    this.cache.set(cacheKey, { data, timestamp: Date.now() })
    return data
  }

  /**
   * Fetch 24h movers from Binance API
   */
  private async fetch24hMoversFromBinance(limit: number): Promise<TopMoversData> {
    try {
      const response = await fetch(`${BINANCE_API}/api/v3/ticker/24hr`)
      const tickers: Binance24hrTicker[] = await response.json()

      // Filter to USDT pairs with sufficient volume
      const usdtPairs = tickers
        .filter(t => 
          t.symbol.endsWith('USDT') && 
          !t.symbol.includes('UP') && 
          !t.symbol.includes('DOWN') &&
          !t.symbol.includes('BEAR') &&
          !t.symbol.includes('BULL') &&
          parseFloat(t.quoteVolume) > MIN_VOLUME
        )

      // Sort for gainers
      const sortedGainers = [...usdtPairs]
        .sort((a, b) => parseFloat(b.priceChangePercent) - parseFloat(a.priceChangePercent))
        .slice(0, limit)

      // Sort for losers
      const sortedLosers = [...usdtPairs]
        .sort((a, b) => parseFloat(a.priceChangePercent) - parseFloat(b.priceChangePercent))
        .slice(0, limit)

      return {
        gainers: sortedGainers.map(t => this.binanceTickerToMover(t)),
        losers: sortedLosers.map(t => this.binanceTickerToMover(t)),
        timestamp: Date.now()
      }
    } catch (error) {
      console.error('Error fetching from Binance:', error)
      return { gainers: [], losers: [], timestamp: Date.now() }
    }
  }

  /**
   * Fetch 1h or 7d movers from CoinGecko API
   */
  private async fetchMoversFromCoinGecko(filter: TimeFilter, limit: number): Promise<TopMoversData> {
    try {
      const priceChangeParam = filter === '1h' 
        ? 'price_change_percentage_1h_in_currency'
        : 'price_change_percentage_7d_in_currency'

      const response = await fetch(
        `${COINGECKO_API}/coins/markets?vs_currency=usd&order=volume_desc&per_page=250&page=1&sparkline=false&price_change_percentage=1h,7d`
      )
      const markets: CoinGeckoMarket[] = await response.json()

      // Filter by volume
      const filtered = markets.filter(m => m.total_volume > MIN_VOLUME)

      const getChangePercent = (m: CoinGeckoMarket): number => {
        if (filter === '1h') return m.price_change_percentage_1h_in_currency || 0
        return m.price_change_percentage_7d_in_currency || 0
      }

      // Sort for gainers
      const sortedGainers = [...filtered]
        .sort((a, b) => getChangePercent(b) - getChangePercent(a))
        .slice(0, limit)

      // Sort for losers
      const sortedLosers = [...filtered]
        .sort((a, b) => getChangePercent(a) - getChangePercent(b))
        .slice(0, limit)

      return {
        gainers: sortedGainers.map(m => this.coinGeckoToMover(m, filter)),
        losers: sortedLosers.map(m => this.coinGeckoToMover(m, filter)),
        timestamp: Date.now()
      }
    } catch (error) {
      console.error('Error fetching from CoinGecko:', error)
      return { gainers: [], losers: [], timestamp: Date.now() }
    }
  }

  /**
   * Get global market data from CoinGecko
   */
  async getGlobalMarketData(): Promise<GlobalMarketData | null> {
    if (this.globalCache.data && Date.now() - this.globalCache.timestamp < this.GLOBAL_CACHE_TTL) {
      return this.globalCache.data
    }

    try {
      const response = await fetch(`${COINGECKO_API}/global`)
      const result = await response.json()
      const data = result.data

      const globalData: GlobalMarketData = {
        totalMarketCap: data.total_market_cap.usd,
        totalVolume: data.total_volume.usd,
        btcDominance: data.market_cap_percentage.btc,
        marketCapChange24h: data.market_cap_change_percentage_24h_usd
      }

      this.globalCache = { data: globalData, timestamp: Date.now() }
      return globalData
    } catch (error) {
      console.error('Error fetching global data:', error)
      return null
    }
  }

  /**
   * Convert Binance ticker to TopMover
   */
  private binanceTickerToMover(ticker: Binance24hrTicker): TopMover {
    const symbol = ticker.symbol.replace('USDT', '')
    return {
      symbol,
      name: symbol, // Will be enriched later if needed
      ticker: ticker.symbol,
      price: parseFloat(ticker.lastPrice),
      priceChange: parseFloat(ticker.priceChange),
      priceChangePercent: parseFloat(ticker.priceChangePercent),
      volume: parseFloat(ticker.volume),
      quoteVolume: parseFloat(ticker.quoteVolume),
      high: parseFloat(ticker.highPrice),
      low: parseFloat(ticker.lowPrice)
    }
  }

  /**
   * Convert CoinGecko market to TopMover
   */
  private coinGeckoToMover(market: CoinGeckoMarket, filter: TimeFilter): TopMover {
    const priceChangePercent = filter === '1h' 
      ? market.price_change_percentage_1h_in_currency || 0
      : market.price_change_percentage_7d_in_currency || 0

    return {
      symbol: market.symbol.toUpperCase(),
      name: market.name,
      ticker: `${market.symbol.toUpperCase()}USDT`,
      price: market.current_price,
      priceChange: market.price_change_24h,
      priceChangePercent,
      volume: market.total_volume / market.current_price, // Approx base volume
      quoteVolume: market.total_volume,
      high: market.high_24h,
      low: market.low_24h
    }
  }

  /**
   * Convert TopMover to SymbolInfo for chart navigation
   */
  moverToSymbolInfo(mover: TopMover): SymbolInfo {
    if (this.symbolInfoCache.has(mover.ticker)) {
      return this.symbolInfoCache.get(mover.ticker)!
    }

    const symbolInfo: SymbolInfo = {
      ticker: mover.ticker,
      name: `${mover.symbol} / USDT`,
      shortName: mover.symbol,
      exchange: 'Binance',
      market: 'crypto',
      pricePrecision: this.getPricePrecision(mover.price),
      volumePrecision: 2
    }

    this.symbolInfoCache.set(mover.ticker, symbolInfo)
    return symbolInfo
  }

  /**
   * Determine price precision based on price magnitude
   */
  private getPricePrecision(price: number): number {
    if (price >= 1000) return 2
    if (price >= 1) return 4
    if (price >= 0.01) return 6
    return 8
  }
}

export const topMoversService = new TopMoversService()
export default TopMoversService
