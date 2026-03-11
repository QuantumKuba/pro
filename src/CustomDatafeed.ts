import { KLineData } from 'klinecharts'
import { Datafeed, SymbolInfo, Period, DatafeedSubscribeCallback } from './types'
import { aggregateCandles } from './aggregateCandles'

/**
 * A Datafeed implementation that serves user-provided OHLCV data.
 * 
 * Designed for algorithmic trading research: load custom candle data
 * and have all chart features (indicators, drawings, crosshair) work
 * seamlessly because data flows through the standard pipeline.
 * 
 * Supports:
 * - Static data loading via setData()
 * - Real-time streaming via pushUpdate()
 * - Multiple symbols stored simultaneously
 * - Timeframe aggregation: store data at a base period and automatically
 *   aggregate into higher timeframes when requested
 */
export default class CustomDatafeed implements Datafeed {
  private _data: Map<string, KLineData[]> = new Map()
  private _symbols: Map<string, SymbolInfo> = new Map()
  private _callbacks: Map<string, DatafeedSubscribeCallback> = new Map()
  private _basePeriods: Map<string, Period> = new Map()

  /**
   * Load OHLCV data for a symbol. Data should be sorted by timestamp ascending.
   * Optionally specify the base period (timeframe) of the data for aggregation.
   */
  setData(symbol: SymbolInfo, candles: KLineData[], basePeriod?: Period): void {
    const sorted = [...candles].sort((a, b) => a.timestamp - b.timestamp)
    this._data.set(symbol.ticker, sorted)
    this._symbols.set(symbol.ticker, symbol)
    if (basePeriod) {
      this._basePeriods.set(symbol.ticker, basePeriod)
    }
  }

  /**
   * Set the base period for a symbol independently of data loading.
   * Useful for streaming mode where data arrives incrementally.
   */
  setBasePeriod(ticker: string, basePeriod: Period): void {
    this._basePeriods.set(ticker, basePeriod)
  }

  /**
   * Get the base period for a symbol, if set.
   */
  getBasePeriod(ticker: string): Period | undefined {
    return this._basePeriods.get(ticker)
  }

  /**
   * Push a real-time candle update. If the chart is subscribed to this
   * symbol, the callback fires immediately (same as live WebSocket feeds).
   */
  pushUpdate(ticker: string, candle: KLineData): void {
    const callback = this._callbacks.get(ticker)
    if (callback) {
      callback(candle)
    }
    // Also append/update in stored data
    const existing = this._data.get(ticker)
    if (existing) {
      const last = existing[existing.length - 1]
      if (last && last.timestamp === candle.timestamp) {
        existing[existing.length - 1] = candle
      } else {
        existing.push(candle)
      }
    }
  }

  /**
   * Clear stored data for a specific symbol, or all symbols if no ticker given.
   */
  clearData(ticker?: string): void {
    if (ticker) {
      this._data.delete(ticker)
      this._symbols.delete(ticker)
      this._callbacks.delete(ticker)
      this._basePeriods.delete(ticker)
    } else {
      this._data.clear()
      this._symbols.clear()
      this._callbacks.clear()
      this._basePeriods.clear()
    }
  }

  /**
   * Check if data has been loaded for a given ticker or any ticker.
   */
  hasData(ticker?: string): boolean {
    if (ticker) {
      return this._data.has(ticker) && this._data.get(ticker)!.length > 0
    }
    return this._data.size > 0
  }

  /**
   * Get the list of symbols that have data loaded.
   */
  getLoadedSymbols(): SymbolInfo[] {
    return Array.from(this._symbols.values())
  }

  async searchSymbols(search?: string): Promise<SymbolInfo[]> {
    const symbols = Array.from(this._symbols.values())
    if (!search) return symbols
    const q = search.toLowerCase()
    return symbols.filter(s =>
      s.ticker.toLowerCase().includes(q) ||
      s.name?.toLowerCase().includes(q) ||
      s.shortName?.toLowerCase().includes(q)
    )
  }

  async getHistoryKLineData(
    symbol: SymbolInfo,
    period: Period,
    from: number,
    to: number
  ): Promise<KLineData[]> {
    const candles = this._data.get(symbol.ticker)
    if (!candles || candles.length === 0) return []
    // If the from/to range intersects the data, return the intersection.
    // Otherwise return ALL candles — custom data is typically loaded all at
    // once for research, and the chart's time window (based on wall-clock)
    // often doesn't overlap historical data timestamps.
    const filtered = candles.filter(c => c.timestamp >= from && c.timestamp <= to)
    const toReturn = filtered.length > 0 ? filtered : [...candles]

    // Aggregate if we have a base period and the requested period is different
    const basePeriod = this._basePeriods.get(symbol.ticker)
    if (basePeriod) {
      return aggregateCandles(toReturn, basePeriod, period)
    }
    return toReturn
  }

  subscribe(
    symbol: SymbolInfo,
    _period: Period,
    callback: DatafeedSubscribeCallback,
    _subscriberId?: string
  ): void {
    this._callbacks.set(symbol.ticker, callback)
  }

  unsubscribe(
    symbol: SymbolInfo,
    _period: Period,
    _subscriberId?: string
  ): void {
    this._callbacks.delete(symbol.ticker)
  }
}
