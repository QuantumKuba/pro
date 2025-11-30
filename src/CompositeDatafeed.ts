/**
 * Composite Datafeed - Routes requests to different datafeeds based on market type
 */

import { KLineData } from 'klinecharts'

import { Datafeed, SymbolInfo, Period, DatafeedSubscribeCallback } from './types'

export interface CompositeDatafeedOptions {
  [market: string]: Datafeed
}

export default class CompositeDatafeed implements Datafeed {
  private _datafeeds: CompositeDatafeedOptions
  private _defaultMarket: string

  constructor(datafeeds: CompositeDatafeedOptions, defaultMarket?: string) {
    this._datafeeds = datafeeds
    this._defaultMarket = defaultMarket || Object.keys(datafeeds)[0]
  }

  private _getDatafeed(symbol?: SymbolInfo): Datafeed {
    if (symbol?.market && this._datafeeds[symbol.market]) {
      return this._datafeeds[symbol.market]
    }
    return this._datafeeds[this._defaultMarket]
  }

  async searchSymbols(search?: string): Promise<SymbolInfo[]> {
    // Search across all datafeeds and combine results
    const results = await Promise.all(
      Object.values(this._datafeeds).map(df => df.searchSymbols(search))
    )
    return results.flat()
  }

  async getHistoryKLineData(
    symbol: SymbolInfo,
    period: Period,
    from: number,
    to: number
  ): Promise<KLineData[]> {
    const datafeed = this._getDatafeed(symbol)
    return datafeed.getHistoryKLineData(symbol, period, from, to)
  }

  subscribe(
    symbol: SymbolInfo,
    period: Period,
    callback: DatafeedSubscribeCallback
  ): void {
    const datafeed = this._getDatafeed(symbol)
    datafeed.subscribe(symbol, period, callback)
  }

  unsubscribe(symbol: SymbolInfo, period: Period): void {
    const datafeed = this._getDatafeed(symbol)
    datafeed.unsubscribe(symbol, period)
  }
}
