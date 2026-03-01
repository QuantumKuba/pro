/**
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at

 * http://www.apache.org/licenses/LICENSE-2.0

 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { registerOverlay, registerIndicator } from 'klinecharts'

import overlays from './extension'
import indicators from './indicator'

import DefaultDatafeed from './DefaultDatafeed'
import BinanceDatafeed from './BinanceDatafeed'
import CompositeDatafeed from './CompositeDatafeed'
import KLineChartPro from './KLineChartPro'

import { LayoutManager, LayoutSelector } from './layout'

import { load } from './i18n'

import watchlistService from './WatchlistService'
import priceAlertService from './PriceAlertService'
import newsService from './NewsService'
import earningsService from './EarningsService'

import { Datafeed, SymbolInfo, Period, DatafeedSubscribeCallback, ChartProOptions, ChartPro } from './types'

import './index.less'
import './layout/layout.less'

overlays.forEach(o => { registerOverlay(o) })
indicators.forEach(i => { registerIndicator(i) })

export {
  DefaultDatafeed,
  BinanceDatafeed,
  CompositeDatafeed,
  KLineChartPro,
  LayoutManager,
  LayoutSelector,
  load as loadLocales,
  watchlistService,
  priceAlertService,
  newsService,
  earningsService
}

export type {
  Datafeed, SymbolInfo, Period, DatafeedSubscribeCallback, ChartProOptions, ChartPro
}

export type { Watchlist, WatchlistItem } from './WatchlistService'
export type { PriceAlert, AlertType } from './PriceAlertService'
export type { NewsArticle } from './NewsService'
export type { EarningsEvent } from './EarningsService'

export type { LayoutManagerApi, LayoutManagerProps } from './layout'
export type { LayoutNode, LayoutState, PaneConfig, LayoutPreset, SplitDirection } from './layout'
