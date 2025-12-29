/**
 * Market Data Service
 * Real-time price streaming via Binance WebSocket
 */

export interface TickerUpdate {
  symbol: string
  price: number
  priceChange: number
  priceChangePercent: number
  high: number
  low: number
  volume: number
  quoteVolume: number
  timestamp: number
}

type TickerCallback = (ticker: TickerUpdate) => void
type AllTickersCallback = (tickers: Map<string, TickerUpdate>) => void

// Binance mini ticker WebSocket message
interface BinanceMiniTicker {
  e: string        // Event type
  E: number        // Event time
  s: string        // Symbol
  c: string        // Close price
  o: string        // Open price
  h: string        // High price
  l: string        // Low price
  v: string        // Total traded base asset volume
  q: string        // Total traded quote asset volume
}

class MarketDataService {
  private ws: WebSocket | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private subscribers: Map<string, Set<TickerCallback>> = new Map()
  private allTickersSubscribers: Set<AllTickersCallback> = new Set()
  private tickers: Map<string, TickerUpdate> = new Map()
  private isConnecting = false
  private reconnectAttempts = 0
  private readonly MAX_RECONNECT_ATTEMPTS = 10
  private readonly RECONNECT_DELAY = 3000

  /**
   * Connect to Binance WebSocket
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return
    }

    this.isConnecting = true

    try {
      // Use mini ticker stream for all symbols
      this.ws = new WebSocket('wss://stream.binance.com:9443/ws/!miniTicker@arr')

      this.ws.onopen = () => {
        console.log('[MarketDataService] Connected to Binance WebSocket')
        this.isConnecting = false
        this.reconnectAttempts = 0
      }

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data)
      }

      this.ws.onerror = (error) => {
        console.error('[MarketDataService] WebSocket error:', error)
        this.isConnecting = false
      }

      this.ws.onclose = () => {
        console.log('[MarketDataService] WebSocket closed')
        this.isConnecting = false
        this.scheduleReconnect()
      }
    } catch (error) {
      console.error('[MarketDataService] Failed to connect:', error)
      this.isConnecting = false
      this.scheduleReconnect()
    }
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    if (this.ws) {
      this.ws.close()
      this.ws = null
    }

    this.subscribers.clear()
    this.allTickersSubscribers.clear()
    this.tickers.clear()
  }

  /**
   * Subscribe to a specific symbol's price updates
   */
  subscribe(symbol: string, callback: TickerCallback): () => void {
    const upperSymbol = symbol.toUpperCase()
    
    if (!this.subscribers.has(upperSymbol)) {
      this.subscribers.set(upperSymbol, new Set())
    }
    
    this.subscribers.get(upperSymbol)!.add(callback)

    // Ensure connection is active
    this.connect()

    // Return unsubscribe function
    return () => {
      const callbacks = this.subscribers.get(upperSymbol)
      if (callbacks) {
        callbacks.delete(callback)
        if (callbacks.size === 0) {
          this.subscribers.delete(upperSymbol)
        }
      }
    }
  }

  /**
   * Subscribe to all tickers updates (for dashboard)
   */
  subscribeAll(callback: AllTickersCallback): () => void {
    this.allTickersSubscribers.add(callback)
    
    // Ensure connection is active
    this.connect()

    // Send current state immediately if available
    if (this.tickers.size > 0) {
      callback(this.tickers)
    }

    // Return unsubscribe function
    return () => {
      this.allTickersSubscribers.delete(callback)
    }
  }

  /**
   * Get current ticker for a symbol
   */
  getTicker(symbol: string): TickerUpdate | undefined {
    return this.tickers.get(symbol.toUpperCase())
  }

  /**
   * Get all current tickers
   */
  getAllTickers(): Map<string, TickerUpdate> {
    return this.tickers
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(data: string): void {
    try {
      const tickers: BinanceMiniTicker[] = JSON.parse(data)

      for (const ticker of tickers) {
        // Only process USDT pairs
        if (!ticker.s.endsWith('USDT')) continue

        const openPrice = parseFloat(ticker.o)
        const closePrice = parseFloat(ticker.c)
        const priceChange = closePrice - openPrice
        const priceChangePercent = openPrice > 0 ? (priceChange / openPrice) * 100 : 0

        const update: TickerUpdate = {
          symbol: ticker.s,
          price: closePrice,
          priceChange,
          priceChangePercent,
          high: parseFloat(ticker.h),
          low: parseFloat(ticker.l),
          volume: parseFloat(ticker.v),
          quoteVolume: parseFloat(ticker.q),
          timestamp: ticker.E
        }

        this.tickers.set(ticker.s, update)

        // Notify symbol-specific subscribers
        const callbacks = this.subscribers.get(ticker.s)
        if (callbacks) {
          callbacks.forEach(callback => callback(update))
        }
      }

      // Notify all-tickers subscribers
      this.allTickersSubscribers.forEach(callback => {
        callback(this.tickers)
      })
    } catch (error) {
      console.error('[MarketDataService] Error parsing message:', error)
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      console.error('[MarketDataService] Max reconnection attempts reached')
      return
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
    }

    this.reconnectAttempts++
    const delay = this.RECONNECT_DELAY * Math.min(this.reconnectAttempts, 5)

    console.log(`[MarketDataService] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`)

    this.reconnectTimer = setTimeout(() => {
      this.connect()
    }, delay)
  }
}

export const marketDataService = new MarketDataService()
export default MarketDataService
