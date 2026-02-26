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

import { Component, onMount, onCleanup, createEffect } from 'solid-js'

import KLineChartPro from '../KLineChartPro'
import type { SymbolInfo, Period, Datafeed, ChartProOptions } from '../types'

export interface ChartPaneProps {
  paneId: string
  symbol: SymbolInfo
  period: Period
  periods: Period[]
  mainIndicators: string[]
  subIndicators: string[]
  datafeed: Datafeed
  theme: string
  locale: string
  isActive: boolean
  onFocus: (paneId: string) => void
  onClose?: (paneId: string) => void
  onSymbolChange?: (paneId: string, symbol: SymbolInfo) => void
}

const ChartPane: Component<ChartPaneProps> = (props) => {
  let containerRef: HTMLDivElement | undefined
  let chartInstance: KLineChartPro | null = null
  let resizeObserver: ResizeObserver | null = null

  const handleClick = () => {
    props.onFocus(props.paneId)
  }

  const handleClose = (e: MouseEvent) => {
    e.stopPropagation()
    props.onClose?.(props.paneId)
  }

  onMount(() => {
    if (!containerRef) return

    const chartOptions: ChartProOptions = {
      container: containerRef,
      symbol: props.symbol,
      period: props.period,
      periods: props.periods,
      mainIndicators: props.mainIndicators,
      subIndicators: props.subIndicators,
      datafeed: props.datafeed,
      theme: props.theme,
      locale: props.locale,
      drawingBarVisible: true,
      onSymbolChange: (symbol: SymbolInfo) => {
        props.onSymbolChange?.(props.paneId, symbol)
      }
    }

    chartInstance = new KLineChartPro(chartOptions)

    // Observe container size changes to resize the chart
    resizeObserver = new ResizeObserver(() => {
      chartInstance?.resize()
    })
    resizeObserver.observe(containerRef)
  })

  // Sync theme changes
  createEffect(() => {
    chartInstance?.setTheme(props.theme)
  })

  // Sync locale changes
  createEffect(() => {
    chartInstance?.setLocale(props.locale)
  })

  onCleanup(() => {
    resizeObserver?.disconnect()
    resizeObserver = null
    if (chartInstance) {
      chartInstance.dispose()
      chartInstance = null
    }
  })

  return (
    <div
      class="layout-pane"
      classList={{ 'layout-pane--active': props.isActive }}
      onClick={handleClick}
    >
      <div class="layout-pane__header">
        <div class="layout-pane__header-info">
          <span class="layout-pane__symbol">{props.symbol.shortName ?? props.symbol.ticker}</span>
        </div>
        {props.onClose && (
          <button class="layout-pane__close" onClick={handleClose} title="Close pane">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>
      <div
        ref={containerRef}
        class="layout-pane__chart"
      />
    </div>
  )
}

export default ChartPane
