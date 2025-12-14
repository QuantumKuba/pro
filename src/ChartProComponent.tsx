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

import { createSignal, createEffect, onMount, Show, onCleanup, startTransition, Component } from 'solid-js'

import {
  init, dispose, utils, Nullable, Chart, OverlayMode, Styles, DeepPartial,
  ActionType, PaneOptions, Indicator, DomPosition, FormatDateType,
  FormatDateParams, FormatExtendTextParams,
  TooltipFeatureStyle,
  IndicatorTooltipData,
  FeatureType,
  registerYAxis
} from 'klinecharts'

import lodashSet from 'lodash/set'
import lodashClone from 'lodash/cloneDeep'

import { SelectDataSourceItem, Loading } from './component'

import {
  PeriodBar, DrawingBar, IndicatorModal, TimezoneModal, SettingModal,
  ScreenshotModal, IndicatorSettingModal, SymbolSearchModal, PeriodSettingModal,
  ReplayBar
} from './widget'

import { translateTimezone } from './widget/timezone-modal/data'

import { SymbolInfo, Period, ChartProOptions, ChartPro } from './types'
import ChartDataLoader from './DataLoader'
import ReplayController from './ReplayController'
import { ReplayState, ReplaySpeed, DEFAULT_REPLAY_STATE } from './ReplayTypes'

type AxisType = 'normal' | 'percentage' | 'log'

interface AxisSettings {
  type: AxisType
  reverse: boolean
}

interface AxisRange {
  from: number
  to: number
  range: number
  realFrom: number
  realTo: number
  realRange: number
  displayFrom: number
  displayTo: number
  displayRange: number
}

interface AxisCreateRangeParams {
  chart: Chart
  paneId: string
  defaultRange: AxisRange
}

interface AxisTick {
  coord: number
  value: number | string
  text: string
}

interface AxisCreateTicksParams {
  defaultTicks: AxisTick[]
  range: AxisRange
}

const DEFAULT_AXIS_SETTINGS: AxisSettings = { type: 'normal', reverse: false }
const NORMAL_AXIS_NAME = 'normal'
const LOG_AXIS_NAME = 'logarithm'
const PERCENTAGE_AXIS_NAME = 'klinecharts_pro_percentage'

let percentageAxisRegistered = false

const isAxisType = (value: unknown): value is AxisType => value === 'normal' || value === 'percentage' || value === 'log'

const formatPercentLabel = (value: number): string => {
  if (!Number.isFinite(value)) {
    return '--'
  }
  const prefix = value > 0 ? '+' : value < 0 ? '-' : ''
  const magnitude = utils.formatPrecision(Math.abs(value), 2)
  return `${prefix}${magnitude}%`
}

const extractAxisSettingsFromStyles = (styles?: DeepPartial<Styles>): AxisSettings => {
  const rawType = (styles as any)?.yAxis?.type
  const normalizedType = (() => {
    if (rawType === 'logarithm') {
      return 'log'
    }
    if (isAxisType(rawType)) {
      return rawType
    }
    return DEFAULT_AXIS_SETTINGS.type
  })()
  const rawReverse = (styles as any)?.yAxis?.reverse
  return {
    type: normalizedType,
    reverse: typeof rawReverse === 'boolean' ? rawReverse : DEFAULT_AXIS_SETTINGS.reverse
  }
}

const stripAxisKeys = (styles?: DeepPartial<Styles>): DeepPartial<Styles> | undefined => {
  if (!styles) {
    return styles
  }
  const cloned = lodashClone(styles)
  const axis = (cloned as any)?.yAxis
  if (axis) {
    delete axis.type
    delete axis.reverse
    if (axis && Object.keys(axis).length === 0) {
      delete (cloned as any).yAxis
    }
  }
  return cloned
}

const axisNameToType = (value: unknown): AxisType | undefined => {
  if (!utils.isString(value)) {
    return undefined
  }
  switch (value) {
    case PERCENTAGE_AXIS_NAME:
    case 'percentage':
      return 'percentage'
    case LOG_AXIS_NAME:
    case 'log':
      return 'log'
    case NORMAL_AXIS_NAME:
    case 'normal':
      return 'normal'
    default:
      return undefined
  }
}

const readAxisOverrides = (styles?: DeepPartial<Styles>): Partial<AxisSettings> | null => {
  if (!styles) {
    return null
  }
  const axis = (styles as any)?.yAxis
  if (!axis) {
    return null
  }
  const result: Partial<AxisSettings> = {}
  if ('type' in axis && axis.type !== undefined) {
    const parsed = axisNameToType(axis.type)
    if (parsed) {
      result.type = parsed
    }
  }
  if ('reverse' in axis && axis.reverse !== undefined) {
    result.reverse = Boolean(axis.reverse)
  }
  return Object.keys(result).length > 0 ? result : null
}

const axisTypeToTemplateName = (type: AxisType): string => {
  switch (type) {
    case 'percentage':
      return PERCENTAGE_AXIS_NAME
    case 'log':
      return LOG_AXIS_NAME
    default:
      return NORMAL_AXIS_NAME
  }
}

const computePercentageRange = (chart: Chart, defaultRange: AxisRange): AxisRange => {
  const dataList = (chart as any).getDataList?.() as Array<Record<string, unknown>> | undefined
  const visibleRange = chart.getVisibleRange?.()
  if (!Array.isArray(dataList) || dataList.length === 0 || !visibleRange) {
    return defaultRange
  }
  const start = Math.max(visibleRange.from, 0)
  const end = Math.min(visibleRange.to, dataList.length - 1)
  if (start > end) {
    return defaultRange
  }

  let highest = Number.NEGATIVE_INFINITY
  let lowest = Number.POSITIVE_INFINITY
  for (let i = start; i <= end; i++) {
    const data = dataList[i] ?? {}
    const high = utils.isNumber(data.high) ? (data.high as number) : (utils.isNumber(data.close) ? (data.close as number) : undefined)
    const low = utils.isNumber(data.low) ? (data.low as number) : (utils.isNumber(data.close) ? (data.close as number) : undefined)
    if (typeof high === 'number') {
      highest = Math.max(highest, high)
    }
    if (typeof low === 'number') {
      lowest = Math.min(lowest, low)
    }
  }

  if (!Number.isFinite(highest) || !Number.isFinite(lowest)) {
    return defaultRange
  }

  const fallbackIndex = Number.isFinite(end) ? end : start
  const referenceData = dataList[fallbackIndex] ?? dataList[start]
  const currentPriceCandidate = [referenceData?.close, referenceData?.last, referenceData?.high, referenceData?.low, referenceData?.open].find(value => utils.isNumber(value))
  const currentPrice = typeof currentPriceCandidate === 'number' ? currentPriceCandidate : undefined

  if (!Number.isFinite(currentPrice) || currentPrice === 0) {
    return defaultRange
  }

  let base = lowest
  if (!Number.isFinite(base) || base === 0) {
    base = Number.isFinite(highest) ? highest : base
  }
  if (!Number.isFinite(base) || base === 0) {
    return defaultRange
  }

  const midpoint = (highest + lowest) / 2
  if ((currentPrice as number) < midpoint) {
    base = highest
  } else {
    base = lowest
  }

  if (!Number.isFinite(base) || base === 0) {
    return defaultRange
  }

  const convert = (price: number) => ((price - base) / base) * 100
  const realFrom = convert(defaultRange.from)
  const realTo = convert(defaultRange.to)

  if (!Number.isFinite(realFrom) || !Number.isFinite(realTo)) {
    return defaultRange
  }

  const realRange = realTo - realFrom
  if (realRange === 0) {
    return defaultRange
  }

  return {
    ...defaultRange,
    realFrom,
    realTo,
    realRange,
    displayFrom: realFrom,
    displayTo: realTo,
    displayRange: realRange
  }
}

const ensurePercentageAxisRegistered = (): void => {
  if (percentageAxisRegistered) {
    return
  }
  registerYAxis({
    name: PERCENTAGE_AXIS_NAME,
    minSpan: () => Math.pow(10, -2),
    displayValueToText: (value: number) => formatPercentLabel(value),
    valueToRealValue: (value: number, { range }: { range: AxisRange }) => (value - range.from) / range.range * range.realRange + range.realFrom,
    realValueToValue: (value: number, { range }: { range: AxisRange }) => (value - range.realFrom) / range.realRange * range.range + range.from,
    realValueToDisplayValue: (value: number, { range }: { range: AxisRange }) => (value - range.realFrom) / range.realRange * range.displayRange + range.displayFrom,
    displayValueToRealValue: (value: number, { range }: { range: AxisRange }) => (value - range.displayFrom) / range.displayRange * range.realRange + range.realFrom,
    createRange: ({ chart, defaultRange }: AxisCreateRangeParams) => computePercentageRange(chart, defaultRange),
    createTicks: ({ defaultTicks }: AxisCreateTicksParams) => defaultTicks.map(tick => {
      const numeric = typeof tick.value === 'number' ? tick.value : Number(tick.value)
      return {
        ...tick,
        value: numeric,
        text: formatPercentLabel(numeric)
      }
    })
  })
  percentageAxisRegistered = true
}

export interface ChartProComponentProps extends Required<Omit<ChartProOptions, 'container' | 'datafeed'>> {
  ref: (chart: ChartPro) => void
  dataloader: ChartDataLoader
}

interface PrevSymbolPeriod {
  symbol: SymbolInfo
  period: Period
}

function createIndicator(widget: Chart, indicatorName: string, isStack?: boolean, paneOptions?: PaneOptions): Nullable<string> {
  // VOL should never be on the candle_pane - it needs its own pane for proper scaling
  if (indicatorName === 'VOL') {
    // Remove id if it was set to candle_pane, and add gap for VOL pane
    const { id, ...restPaneOptions } = paneOptions || {}
    paneOptions = {
      axis: { gap: { bottom: 2 } },
      ...restPaneOptions,
      // Only keep the id if it's NOT candle_pane
      ...(id && id !== 'candle_pane' ? { id } : {})
    }
  }
  const indi = widget.createIndicator({
    name: indicatorName,
    createTooltipDataSource: (param): IndicatorTooltipData => {
      const indiStyles = param.chart.getStyles().indicator
      const features = indiStyles.tooltip.features
      const icons: TooltipFeatureStyle[] = []
      if (param.indicator.visible) {
        icons.push(features[1])
        icons.push(features[2])
        icons.push(features[3])
      } else {
        icons.push(features[0])
        icons.push(features[2])
        icons.push(features[3])
      }
      const calcParams = param.indicator.calcParams
      const joinedString = calcParams.map((item: any) => {
        if (typeof item === 'object' && item !== null && 'value' in item) {
          return item.value
        }
        return item
      }).join(', ')
      const calcParamsText = ` ${joinedString}`
      return {
        name: indicatorName,
        calcParamsText,
        features: icons,
        legends: []
      }
    }
  }, isStack, paneOptions) ?? null

  return indi
}

export const [widget, setWidget] = createSignal<Nullable<Chart>>(null)
export const [loadingVisible, setLoadingVisible] = createSignal(false)
export const [symbol, setSymbol] = createSignal<Nullable<SymbolInfo>>(null)
export const [period, setPeriod] = createSignal<Nullable<Period>>(null)

const ChartProComponent: Component<ChartProComponentProps> = props => {
  let widgetRef: HTMLDivElement | undefined = undefined

  let priceUnitDom: HTMLElement

  let loading = false

  const [theme, setTheme] = createSignal(props.theme)
  const [locale, setLocale] = createSignal(props.locale)

  const initialAxisSettings = extractAxisSettingsFromStyles(props.styles)
  const defaultAxisSettings: AxisSettings = { ...initialAxisSettings }
  const [axisSettings, setAxisSettings] = createSignal<AxisSettings>(initialAxisSettings)
  const [styleOverrides, setStyleOverrides] = createSignal<DeepPartial<Styles> | undefined>(props.styles)

  const applyAxisOverride = (override: Partial<AxisSettings>) => {
    if (!override || (override.type === undefined && override.reverse === undefined)) {
      return
    }
    setAxisSettings(prev => {
      const next: AxisSettings = {
        type: override.type ?? prev.type,
        reverse: override.reverse ?? prev.reverse
      }
      if (next.type === prev.type && next.reverse === prev.reverse) {
        return prev
      }
      return next
    })
  }

  const updateAxisSettingsFromStyle = (style?: DeepPartial<Styles>) => {
    const override = readAxisOverrides(style)
    if (override) {
      applyAxisOverride(override)
    }
  }

  const applyAxisSettingsToChart = (chart: Chart, settings: AxisSettings) => {
    if (settings.type === 'percentage') {
      ensurePercentageAxisRegistered()
    }
    chart.setPaneOptions({
      id: 'candle_pane',
      axis: {
        name: axisTypeToTemplateName(settings.type),
        reverse: settings.reverse
      }
    })
  }

  const refreshPriceUnit = () => {
    if (!priceUnitDom) {
      return
    }
    const currentAxis = axisSettings()
    if (currentAxis.type === 'percentage') {
      priceUnitDom.innerHTML = '%'
      priceUnitDom.style.display = 'flex'
      return
    }
    const currentSymbol = symbol()
    if (currentSymbol?.priceCurrency) {
      priceUnitDom.innerHTML = currentSymbol.priceCurrency.toLocaleUpperCase()
      priceUnitDom.style.display = 'flex'
    } else {
      priceUnitDom.style.display = 'none'
    }
  }

  const [indicatorModalVisible, setIndicatorModalVisible] = createSignal(false)
  const [mainIndicators, setMainIndicators] = createSignal([...(props.mainIndicators!)])
  const [subIndicators, setSubIndicators] = createSignal<Record<string, string>>({})

  const [timezoneModalVisible, setTimezoneModalVisible] = createSignal(false)
  const [timezone, setTimezone] = createSignal<SelectDataSourceItem>({ key: props.timezone, text: translateTimezone(props.timezone, props.locale) })

  const [settingModalVisible, setSettingModalVisible] = createSignal(false)
  const [widgetDefaultStyles, setWidgetDefaultStyles] = createSignal<Styles>()

  const [screenshotUrl, setScreenshotUrl] = createSignal('')

  const [drawingBarVisible, setDrawingBarVisible] = createSignal(props.drawingBarVisible)

  const [symbolSearchModalVisible, setSymbolSearchModalVisible] = createSignal(false)

  const [periodSettingModalVisible, setPeriodSettingModalVisible] = createSignal(false)

  const [indicatorSettingModalParams, setIndicatorSettingModalParams] = createSignal({
    visible: false, indicatorName: '', paneId: '', calcParams: [] as Array<any>
  })

  const [candleFetchLimit, setCandleFetchLimit] = createSignal(500)

  // Replay mode state
  const [replayActive, setReplayActive] = createSignal(false)
  const [replayState, setReplayState] = createSignal<ReplayState>({ ...DEFAULT_REPLAY_STATE })

  // Helper to trigger chart data reload (forces getBars to be called)
  const triggerChartReload = () => {
    const s = symbol()
    if (s) {
      widget()?.setSymbol({
        ticker: s.ticker,
        pricePrecision: s.pricePrecision,
        volumePrecision: s.volumePrecision,
      })
    }
  }

  const [replayController] = createSignal<ReplayController>(new ReplayController({
    onModeChange: (active) => setReplayActive(active),
    onCandleProgress: (index, data) => {
      setReplayState(prev => ({ ...prev, currentIndex: index }))
      // Update the DataLoader's replay index
      props.dataloader.updateReplayIndex(index)
      // Suppress backward loading during playback chart reloads
      props.dataloader.setSuppressBackwardLoading(true)
      triggerChartReload()
      // Allow backward loading again after a short delay (for user scrolling)
      setTimeout(() => {
        props.dataloader.setSuppressBackwardLoading(false)
      }, 100)
    },
    onReplayEnd: () => {
      // Optionally auto-pause when reaching the end
    }
  }))

  // Start replay mode
  const startReplay = async () => {
    const chart = widget()
    if (!chart) return

    const s = symbol()
    const p = period()
    if (!s || !p) return

    setLoadingVisible(true)

    // Suspend live data subscription
    props.dataloader.suspendSubscription()

    // Load all historical data for replay
    const timestamp = Date.now()
    const [to] = props.dataloader.adjustFromTo(p, timestamp, 1)
    const [from] = props.dataloader.adjustFromTo(p, to, props.dataloader.fetchLimit)

    try {
      const fullData = await props.dataloader.getHistoryData(s, p, from, to)

      if (fullData && fullData.length > 0) {
        // Default to starting replay from about 20% into the data
        const startIndex = Math.floor(fullData.length * 0.2)
        const startTimestamp = fullData[startIndex]?.timestamp || fullData[0].timestamp

        // Set replay data in the DataLoader
        props.dataloader.setReplayData(fullData, startIndex)

        // Set up callback for when backward data is loaded during scrolling
        props.dataloader.setOnBackwardDataLoaded((newCandleCount) => {
          const updatedData = props.dataloader.getReplayData()
          const newIndex = props.dataloader.visibleEndIndex

          // Update ReplayState with new data (index shifts by the prepended amount)
          setReplayState(prev => ({
            ...prev,
            fullData: updatedData,
            totalCandles: updatedData.length,
            currentIndex: newIndex
          }))

          // Also update the ReplayController's state
          replayController().updateFullData(updatedData, newIndex)

          // Suppress backward loading during this reload to prevent infinite loop
          props.dataloader.setSuppressBackwardLoading(true)
          triggerChartReload()
          setTimeout(() => {
            props.dataloader.setSuppressBackwardLoading(false)
          }, 500)
        })

        setReplayState({
          isActive: true,
          isPaused: true,
          speed: 1,
          startTimestamp,
          currentIndex: startIndex,
          totalCandles: fullData.length,
          fullData
        })

        replayController().setPeriod(p)
        replayController().start(startTimestamp, fullData)

        // Trigger chart reload - this will call getBars which now returns replay data
        triggerChartReload()
      }
    } catch (error) {
      console.error('Failed to load replay data:', error)
      // Resume subscription on error
      props.dataloader.clearReplayMode()
      props.dataloader.resumeSubscription()
    }

    setLoadingVisible(false)
  }

  // Stop replay mode and restore normal chart
  const stopReplay = async () => {
    replayController().stop()
    setReplayState({ ...DEFAULT_REPLAY_STATE })

    // Clear replay mode from DataLoader
    props.dataloader.clearReplayMode()

    // Resume live data subscription
    props.dataloader.resumeSubscription()

    // Trigger chart reload to get live data
    triggerChartReload()
  }

  // Handle date change in replay mode
  const handleReplayDateChange = async (timestamp: number) => {
    const state = replayState()

    // Check if we need to fetch new data
    // If we have data, and the target timestamp is within the range of our current fullData
    const isDataAvailable = state.fullData.length > 0 &&
      timestamp >= state.fullData[0].timestamp &&
      timestamp <= state.fullData[state.fullData.length - 1].timestamp

    if (isDataAvailable) {
      // Data is available locally, just jump to it
      let targetIndex = state.fullData.findIndex(d => d.timestamp >= timestamp)
      if (targetIndex === -1) {
        targetIndex = state.fullData.length - 1
      }

      // Update DataLoader and trigger reload
      props.dataloader.updateReplayIndex(targetIndex)
      replayController().goToIndex(targetIndex)
      setReplayState(prev => ({
        ...prev,
        startTimestamp: timestamp,
        currentIndex: targetIndex
      }))
      triggerChartReload()
    } else {
      // Data not available, need to fetch
      setLoadingVisible(true)
      const p = period()
      const s = symbol()

      if (!p || !s) {
        setLoadingVisible(false)
        return
      }

      try {
        // Calculate period in milliseconds
        let periodMs = 0
        switch (p.type) {
          case 'minute': periodMs = p.span * 60 * 1000; break
          case 'hour': periodMs = p.span * 60 * 60 * 1000; break
          case 'day': periodMs = p.span * 24 * 60 * 60 * 1000; break
          case 'week': periodMs = p.span * 7 * 24 * 60 * 60 * 1000; break
          case 'month': periodMs = p.span * 30 * 24 * 60 * 60 * 1000; break
          default: periodMs = 60 * 1000
        }

        // Load data: some context before + future data to play into
        const contextCount = 300
        const futureCount = 1000
        const fromTimestamp = timestamp - (contextCount * periodMs)
        const toTimestamp = Math.min(timestamp + (futureCount * periodMs), Date.now())

        const fullData = await props.dataloader.getHistoryData(s, p, fromTimestamp, toTimestamp)

        if (fullData && fullData.length > 0) {
          // Find target index in the new data
          let startIndex = fullData.findIndex(d => d.timestamp >= timestamp)
          if (startIndex === -1) {
            startIndex = timestamp > fullData[fullData.length - 1].timestamp
              ? fullData.length - 1
              : 0
          }

          // Set replay data in the DataLoader
          props.dataloader.setReplayData(fullData, startIndex)

          // Set up callback for when backward data is loaded during scrolling
          props.dataloader.setOnBackwardDataLoaded((newCandleCount) => {
            const updatedData = props.dataloader.getReplayData()
            const newIndex = props.dataloader.visibleEndIndex

            setReplayState(prev => ({
              ...prev,
              fullData: updatedData,
              totalCandles: updatedData.length,
              currentIndex: newIndex
            }))

            replayController().updateFullData(updatedData, newIndex)

            // Suppress backward loading during this reload to prevent infinite loop
            props.dataloader.setSuppressBackwardLoading(true)
            triggerChartReload()
            setTimeout(() => {
              props.dataloader.setSuppressBackwardLoading(false)
            }, 500)
          })

          setReplayState({
            isActive: true,
            isPaused: true,
            speed: state.speed,
            startTimestamp: timestamp,
            currentIndex: startIndex,
            totalCandles: fullData.length,
            fullData
          })

          replayController().setPeriod(p)
          replayController().start(timestamp, fullData)

          // Trigger chart reload
          triggerChartReload()
        }
      } catch (e) {
        console.error("Failed to load replay data for date", e)
      } finally {
        setLoadingVisible(false)
      }
    }
  }

  // Effect to handle period changes during replay mode
  let prevPeriodRef: Period | null = null
  createEffect(() => {
    const p = period()
    const isActive = replayActive()

    // Skip if not in replay mode
    if (!isActive || !p) {
      prevPeriodRef = p
      return
    }

    // Skip if period hasn't actually changed
    if (prevPeriodRef && prevPeriodRef.type === p.type && prevPeriodRef.span === p.span) {
      return
    }

    // Period changed while in replay mode - must reload data with new period
    if (prevPeriodRef !== null) {
      console.info('Period changed during replay, reloading data with new period', { from: prevPeriodRef, to: p })

      // Pause playback during reload
      replayController().pause()
      setReplayState(prev => ({ ...prev, isPaused: true }))

      // Get current timestamp to reload around
      const currentTimestamp = replayState().startTimestamp
      const s = symbol()

      if (s) {
        setLoadingVisible(true)

        // Calculate period in milliseconds for the NEW period
        let periodMs = 0
        switch (p.type) {
          case 'minute': periodMs = p.span * 60 * 1000; break
          case 'hour': periodMs = p.span * 60 * 60 * 1000; break
          case 'day': periodMs = p.span * 24 * 60 * 60 * 1000; break
          case 'week': periodMs = p.span * 7 * 24 * 60 * 60 * 1000; break
          case 'month': periodMs = p.span * 30 * 24 * 60 * 60 * 1000; break
          default: periodMs = 60 * 1000
        }

        const contextCount = 300
        const futureCount = 1000
        const fromTimestamp = currentTimestamp - (contextCount * periodMs)
        const toTimestamp = Math.min(currentTimestamp + (futureCount * periodMs), Date.now())

        // Fetch new data with the new period
        props.dataloader.getHistoryData(s, p, fromTimestamp, toTimestamp).then(fullData => {
          if (fullData && fullData.length > 0) {
            let startIndex = fullData.findIndex(d => d.timestamp >= currentTimestamp)
            if (startIndex === -1) {
              startIndex = currentTimestamp > fullData[fullData.length - 1].timestamp
                ? fullData.length - 1
                : 0
            }

            // Update DataLoader with new period's data
            props.dataloader.setReplayData(fullData, startIndex)

            // Set up callback for when backward data is loaded during scrolling
            props.dataloader.setOnBackwardDataLoaded((newCandleCount) => {
              const updatedData = props.dataloader.getReplayData()
              const newIndex = props.dataloader.visibleEndIndex

              setReplayState(prev => ({
                ...prev,
                fullData: updatedData,
                totalCandles: updatedData.length,
                currentIndex: newIndex
              }))

              replayController().updateFullData(updatedData, newIndex)

              // Suppress backward loading during this reload to prevent infinite loop
              props.dataloader.setSuppressBackwardLoading(true)
              triggerChartReload()
              setTimeout(() => {
                props.dataloader.setSuppressBackwardLoading(false)
              }, 500)
            })

            setReplayState({
              isActive: true,
              isPaused: true,
              speed: replayState().speed,
              startTimestamp: currentTimestamp,
              currentIndex: startIndex,
              totalCandles: fullData.length,
              fullData
            })

            replayController().setPeriod(p)
            replayController().start(currentTimestamp, fullData)

            // Update widget period and trigger chart reload
            widget()?.setPeriod(p)
            triggerChartReload()
          }
          setLoadingVisible(false)
        }).catch(e => {
          console.error('Failed to reload replay data for new period', e)
          setLoadingVisible(false)
        })
      }
    }

    prevPeriodRef = p
  })

  setPeriod(props.period)
  setSymbol(props.symbol)

  props.ref({
    setTheme,
    getTheme: () => theme(),
    setStyles: (style: DeepPartial<Styles>) => {
      updateAxisSettingsFromStyle(style)
      setStyleOverrides(() => style)
    },
    getStyles: () => {
      const styles = utils.clone(widget()!.getStyles()) as any
      const axis = axisSettings()
      if (!styles.yAxis) {
        styles.yAxis = {}
      }
      styles.yAxis.type = axis.type
      styles.yAxis.reverse = axis.reverse
      return styles
    },
    setLocale,
    getLocale: () => locale(),
    setTimezone: (timezone: string) => { setTimezone({ key: timezone, text: translateTimezone(props.timezone, locale()) }) },
    getTimezone: () => timezone().key,
    setSymbol,
    getSymbol: () => symbol()!,
    setPeriod,
    getPeriod: () => period()!,
    getInstanceApi: () => widget(),
    resize: () => widget()?.resize(),
    dispose: () => { }
  })

  const documentResize = () => {
    widget()?.resize()
  }

  onMount(() => {
    window.addEventListener('resize', documentResize)
    setWidget(init(widgetRef!, {
      formatter: {
        formatDate: (params: FormatDateParams) => {
          const p = period()!
          switch (p.type) {
            case 'minute': {
              if (params.type === 'xAxis') {
                return utils.formatDate(params.dateTimeFormat, params.timestamp, 'HH:mm')
              }
              return utils.formatDate(params.dateTimeFormat, params.timestamp, 'YYYY-MM-DD HH:mm')
            }
            case 'hour': {
              if (params.type === 'xAxis') {
                return utils.formatDate(params.dateTimeFormat, params.timestamp, 'MM-DD HH:mm')
              }
              return utils.formatDate(params.dateTimeFormat, params.timestamp, 'YYYY-MM-DD HH:mm')
            }
            case 'day':
            case 'week': return utils.formatDate(params.dateTimeFormat, params.timestamp, 'YYYY-MM-DD')
            case 'month': {
              if (params.type === 'xAxis') {
                return utils.formatDate(params.dateTimeFormat, params.timestamp, 'YYYY-MM')
              }
              return utils.formatDate(params.dateTimeFormat, params.timestamp, 'YYYY-MM-DD')
            }
            case 'year': {
              if (params.type === 'xAxis') {
                return utils.formatDate(params.dateTimeFormat, params.timestamp, 'YYYY')
              }
              return utils.formatDate(params.dateTimeFormat, params.timestamp, 'YYYY-MM-DD')
            }
          }
          return utils.formatDate(params.dateTimeFormat, params.timestamp, 'YYYY-MM-DD HH:mm')
        },
        formatExtendText: (params: FormatExtendTextParams) => {
          if (params.type === 'last_price') {
            const p = period()
            if (!p) return ''
            const current = Date.now()
            const timestamp = params.data.timestamp
            let periodMs = 0
            switch (p.type) {
              case 'minute': periodMs = p.span * 60 * 1000; break
              case 'hour': periodMs = p.span * 60 * 60 * 1000; break
              case 'day': periodMs = p.span * 24 * 60 * 60 * 1000; break
              case 'week': periodMs = p.span * 7 * 24 * 60 * 60 * 1000; break
              case 'month': periodMs = p.span * 30 * 24 * 60 * 60 * 1000; break
              case 'year': periodMs = p.span * 365 * 24 * 60 * 60 * 1000; break
            }
            const next = timestamp + periodMs
            const remaining = Math.max(0, next - current)

            const totalSeconds = Math.floor(remaining / 1000)
            const hours = Math.floor(totalSeconds / 3600)
            const minutes = Math.floor((totalSeconds % 3600) / 60)
            const seconds = totalSeconds % 60

            const pad = (n: number) => n.toString().padStart(2, '0')
            if (periodMs >= 60 * 60 * 1000) {
              return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
            }
            return `${pad(minutes)}:${pad(seconds)}`
          }
          return ''
        }
      }
    }))

    if (widget()) {
      console.info('ChartPro widget initialized')
      const watermarkContainer = widget()!.getDom('candle_pane', 'main')
      if (watermarkContainer) {
        let watermark = document.createElement('div')
        watermark.className = 'klinecharts-pro-watermark'
        if (utils.isString(props.watermark)) {
          const str = (props.watermark as string).replace(/(^\s*)|(\s*$)/g, '')
          watermark.innerHTML = str
        } else {
          watermark.appendChild(props.watermark as Node)
        }
        watermarkContainer.appendChild(watermark)
      }

      const priceUnitContainer = widget()!.getDom('candle_pane', 'yAxis')
      priceUnitDom = document.createElement('span')
      priceUnitDom.className = 'klinecharts-pro-price-unit'
      priceUnitContainer?.appendChild(priceUnitDom)

      widget()?.subscribeAction('onCrosshairFeatureClick', (data) => {
        console.info('onCrosshairFeatureClick', data)
      })

      widget()?.subscribeAction('onIndicatorTooltipFeatureClick', (data) => {
        console.info('onIndicatorTooltipFeatureClick', data)
        const _data = data as { paneId: string, feature: TooltipFeatureStyle, indicator: Indicator }
        // if (_data.indicatorName) {
        switch (_data.feature.id) {
          case 'visible': {
            widget()?.overrideIndicator({ name: _data.indicator.name, visible: true, paneId: _data.paneId })
            break
          }
          case 'invisible': {
            widget()?.overrideIndicator({ name: _data.indicator.name, visible: false, paneId: _data.paneId })
            break
          }
          case 'setting': {
            const indicator = widget()?.getIndicators({ paneId: _data.paneId, name: _data.indicator.name, id: _data.indicator.id }).at(0)
            if (!indicator) return
            setIndicatorSettingModalParams({
              visible: true, indicatorName: _data.indicator.name, paneId: _data.paneId, calcParams: indicator.calcParams
            })
            break
          }
          case 'close': {
            if (_data.paneId === 'candle_pane') {
              const newMainIndicators = [...mainIndicators()]
              widget()?.removeIndicator({ paneId: _data.paneId, name: _data.indicator.name, id: _data.indicator.id })
              newMainIndicators.splice(newMainIndicators.indexOf(_data.indicator.name), 1)
              setMainIndicators(newMainIndicators)
            } else {
              const newIndicators: Record<string, string> = { ...subIndicators() }
              widget()?.removeIndicator({ paneId: _data.paneId, name: _data.indicator.name, id: _data.indicator.id })
              delete newIndicators[_data.indicator.name]
              setSubIndicators(newIndicators)
            }
          }
        }
        // }
      })

      widget()?.subscribeAction('onCandleTooltipFeatureClick', (data) => {
        console.info('onCandleTooltipFeatureClick', data)
      })

      refreshPriceUnit()
      const s = symbol()
      if (s) {
        widget()?.setSymbol({ ticker: s.ticker, pricePrecision: s.pricePrecision ?? 2, volumePrecision: s.volumePrecision ?? 0 })
      }
      widget()?.setPeriod(period()!)
      widget()?.setDataLoader(props.dataloader)
    }

    const w = widget()

    if (w) {
      mainIndicators().forEach(indicator => {
        if (w)
          createIndicator(w, indicator, true, { id: 'candle_pane' })
      })
      const subIndicatorMap: Record<string, string> = {}
      props.subIndicators!.forEach(indicator => {
        const paneId = createIndicator(w, indicator, true)
        if (paneId) {
          subIndicatorMap[indicator] = paneId
        }
      })
      setSubIndicators(subIndicatorMap)
    }
  })

  onCleanup(() => {
    window.removeEventListener('resize', documentResize)
    dispose(widgetRef!)
  })

  createEffect((prev?: PrevSymbolPeriod) => {
    console.info('symbol or period changed effect', symbol(), period(), prev)

    if (!props.dataloader.loading) {
      console.info('setLoadingVisible false by effect')
      const s = symbol()
      const p = period()

      if (prev?.period.span !== p!.span || prev?.period.type !== p!.type) {
        console.info('period changed: set period', p)
        widget()?.setPeriod(p!)
      }
      if (prev?.symbol?.ticker !== s!.ticker)
        console.info('ticker changed: set symbol', s)
      widget()?.setSymbol({
        ticker: s!.ticker,
        pricePrecision: s!.pricePrecision,
        volumePrecision: s!.volumePrecision,
      })

      onCleanup(() => {
        // Optional cleanup logic before re-run
      })

      return { symbol: s!, period: p! }
    }
    console.info('props.dataloader.loading is true, skip setLoadingVisible false')

    return prev
  })

  createEffect(() => {
    const chart = widget()
    if (!chart) {
      return
    }
    const t = theme()
    chart.setStyles(t)
    const color = t === 'dark' ? '#929AA5' : '#76808F'
    chart.setStyles({
      candle: {
        priceMark: {
          last: {
            extendTexts: [
              {
                show: true,
                color: '#e7e7e7ff',
                size: 12,
                family: 'Helvetica Neue',
                weight: 'normal',
                position: 'below_price',
                updateInterval: 800,
                paddingLeft: 2,
                paddingTop: 2,
                paddingRight: 2,
                paddingBottom: 2
              }
            ]
          }
        }
      },
      indicator: {
        tooltip: {
          features: [
            {
              id: 'visible',
              position: 'middle',
              marginLeft: 8,
              marginTop: 7,
              marginRight: 0,
              marginBottom: 0,
              paddingLeft: 0,
              paddingTop: 0,
              paddingRight: 0,
              paddingBottom: 0,
              type: 'icon_font',
              content: {
                code: '\ue903',
                family: 'icomoon',
              },
              size: 14,
              color: color,
              activeColor: color,
              backgroundColor: 'transparent',
              activeBackgroundColor: 'rgba(22, 119, 255, 0.15)'
            },
            {
              id: 'invisible',
              position: 'middle',
              marginLeft: 8,
              marginTop: 7,
              marginRight: 0,
              marginBottom: 0,
              paddingLeft: 0,
              paddingTop: 0,
              paddingRight: 0,
              paddingBottom: 0,
              type: 'icon_font',
              content: {
                code: '\ue901',
                family: 'icomoon',
              },
              size: 14,
              color: color,
              activeColor: color,
              backgroundColor: 'transparent',
              activeBackgroundColor: 'rgba(22, 119, 255, 0.15)'
            },
            {
              id: 'setting',
              position: 'middle',
              marginLeft: 6,
              marginTop: 7,
              marginBottom: 0,
              marginRight: 0,
              paddingLeft: 0,
              paddingTop: 0,
              paddingRight: 0,
              paddingBottom: 0,
              type: 'icon_font',
              content: {
                code: '\ue902',
                family: 'icomoon',
              },
              size: 14,
              color: color,
              activeColor: color,
              backgroundColor: 'transparent',
              activeBackgroundColor: 'rgba(22, 119, 255, 0.15)'
            },
            {
              id: 'close',
              position: 'middle',
              marginLeft: 6,
              marginTop: 7,
              marginRight: 0,
              marginBottom: 0,
              paddingLeft: 0,
              paddingTop: 0,
              paddingRight: 0,
              paddingBottom: 0,
              type: 'icon_font',
              content: {
                code: '\ue900',
                family: 'icomoon',
              },
              size: 14,
              color: color,
              activeColor: color,
              backgroundColor: 'transparent',
              activeBackgroundColor: 'rgba(22, 119, 255, 0.15)'
            }
          ]
        }
      }
    })
    setWidgetDefaultStyles(lodashClone(chart.getStyles()))
  })

  createEffect(() => {
    widget()?.setLocale(locale())
  })

  createEffect(() => {
    widget()?.setTimezone(timezone().key)
  })

  createEffect(() => {
    const chart = widget()
    if (!chart) {
      return
    }
    const override = styleOverrides()
    if (override) {
      updateAxisSettingsFromStyle(override)
      const sanitized = stripAxisKeys(override)
      if (sanitized && Object.keys(sanitized).length > 0) {
        chart.setStyles(sanitized)
      }
    }
    setWidgetDefaultStyles(lodashClone(chart.getStyles()))
  })

  createEffect(() => {
    theme()
    const chart = widget()
    if (!chart) {
      return
    }
    applyAxisSettingsToChart(chart, axisSettings())
  })

  createEffect(() => {
    refreshPriceUnit()
  })

  return (
    <>
      <i class="icon-close klinecharts-pro-load-icon" />
      <Show when={symbolSearchModalVisible()}>
        <SymbolSearchModal
          locale={locale()}
          datafeed={props.dataloader}
          onSymbolSelected={symbol => { setSymbol(symbol) }}
          onClose={() => { setSymbolSearchModalVisible(false) }} />
      </Show>
      <Show when={indicatorModalVisible()}>
        <IndicatorModal
          locale={locale()}
          mainIndicators={mainIndicators()}
          subIndicators={subIndicators()}
          onClose={() => { setIndicatorModalVisible(false) }}
          onMainIndicatorChange={data => {
            const newMainIndicators = [...mainIndicators()]
            if (data.added) {
              createIndicator(widget()!, data.name, true, { id: 'candle_pane' })
              newMainIndicators.push(data.name)
            } else {
              widget()?.removeIndicator({ name: data.name, paneId: 'candle_pane', id: data.id ?? undefined })
              newMainIndicators.splice(newMainIndicators.indexOf(data.name), 1)
            }
            setMainIndicators(newMainIndicators)
          }}
          onSubIndicatorChange={data => {
            console.info('onSubIndicatorChange', data)
            const newSubIndicators: Record<string, string> = { ...subIndicators() }
            if (data.added) {
              const id = createIndicator(widget()!, data.name)
              if (id) {
                newSubIndicators[data.name] = id
              }
            } else {
              if (data.id) {
                widget()?.removeIndicator({ name: data.name, id: data.id })
                delete newSubIndicators[data.name]
              }
            }
            setSubIndicators(newSubIndicators)
          }} />
      </Show>
      <Show when={timezoneModalVisible()}>
        <TimezoneModal
          locale={locale()}
          timezone={timezone()}
          onClose={() => { setTimezoneModalVisible(false) }}
          onConfirm={setTimezone}
        />
      </Show>
      <Show when={settingModalVisible()}>
        <SettingModal
          locale={locale()}
          currentStyles={(() => {
            const styles = utils.clone(widget()!.getStyles()) as any
            const axis = axisSettings()
            if (!styles.yAxis) {
              styles.yAxis = {}
            }
            styles.yAxis.type = axis.type
            styles.yAxis.reverse = axis.reverse
              // Inject candleFetchLimit
              ; (styles as any).candleFetchLimit = candleFetchLimit()
            return styles as Styles
          })()}
          onClose={() => { setSettingModalVisible(false) }}
          onChange={style => {
            const fetchLimit = (style as any).candleFetchLimit
            if (fetchLimit) {
              setCandleFetchLimit(fetchLimit)
              props.dataloader.setFetchLimit(fetchLimit)
              delete (style as any).candleFetchLimit
            }
            setStyleOverrides(() => style)
          }}
          onLocaleChange={setLocale}
          onRestoreDefault={(options: SelectDataSourceItem[]) => {
            const style: DeepPartial<Styles> = {}
            const defaults = widgetDefaultStyles()
            if (!defaults) {
              lodashSet(style, 'yAxis.type', defaultAxisSettings.type)
              lodashSet(style, 'yAxis.reverse', defaultAxisSettings.reverse)
              applyAxisOverride(defaultAxisSettings)
              setStyleOverrides(() => style)
              // Reset fetch limit
              setCandleFetchLimit(500)
              props.dataloader.setFetchLimit(500)
              return
            }
            options.forEach(option => {
              const key = option.key
              lodashSet(style, key, utils.formatValue(defaults, key))
            })
            lodashSet(style, 'yAxis.type', defaultAxisSettings.type)
            lodashSet(style, 'yAxis.reverse', defaultAxisSettings.reverse)
            applyAxisOverride(defaultAxisSettings)
            setStyleOverrides(() => style)
            // Reset fetch limit
            setCandleFetchLimit(500)
            props.dataloader.setFetchLimit(500)
          }}
        />
      </Show>
      <Show when={screenshotUrl().length > 0}>
        <ScreenshotModal
          locale={locale()}
          url={screenshotUrl()}
          onClose={() => { setScreenshotUrl('') }}
        />
      </Show>
      <Show when={indicatorSettingModalParams().visible}>
        <IndicatorSettingModal
          locale={locale()}
          params={indicatorSettingModalParams()}
          onClose={() => { setIndicatorSettingModalParams({ visible: false, indicatorName: '', paneId: '', calcParams: [] }) }}
          onConfirm={(params) => {
            const modalParams = indicatorSettingModalParams()
            widget()?.overrideIndicator({ name: modalParams.indicatorName, calcParams: params, paneId: modalParams.paneId })
          }}
        />
      </Show>
      <Show when={periodSettingModalVisible()}>
        <PeriodSettingModal
          locale={locale()}
          onClose={() => { setPeriodSettingModalVisible(false) }}
          onConfirm={p => {
            setPeriod(p)
          }} />
      </Show>
      <PeriodBar
        locale={locale()}
        symbol={symbol()!}
        spread={drawingBarVisible()}
        period={period()!}
        periods={props.periods}
        replayActive={replayActive()}
        onMenuClick={async () => {
          try {
            await startTransition(() => setDrawingBarVisible(!drawingBarVisible()))
            widget()?.resize()
          } catch (e) { }
        }}
        onSymbolClick={() => { setSymbolSearchModalVisible(!symbolSearchModalVisible()) }}
        onPeriodChange={setPeriod}
        onIndicatorClick={() => { setIndicatorModalVisible((visible => !visible)) }}
        onTimezoneClick={() => { setTimezoneModalVisible((visible => !visible)) }}
        onSettingClick={() => { setSettingModalVisible((visible => !visible)) }}
        onScreenshotClick={() => {
          if (widget) {
            const url = widget()!.getConvertPictureUrl(true, 'jpeg', props.theme === 'dark' ? '#151517' : '#ffffff')
            setScreenshotUrl(url)
          }
        }}
        onPeriodSettingClick={() => { setPeriodSettingModalVisible(true) }}
        onReplayClick={() => {
          if (replayActive()) {
            stopReplay()
          } else {
            startReplay()
          }
        }}
      />
      <div
        class="klinecharts-pro-content">
        <Show when={loadingVisible()}>
          <Loading />
        </Show>
        <Show when={drawingBarVisible()}>
          <DrawingBar
            locale={props.locale}
            onDrawingItemClick={overlay => {
              // Ensure overlays created from the drawing bar belong to the drawing group
              const DEFAULT_GROUP_ID = 'drawing_tools'

              if (typeof overlay === 'object') {
                const withGroup = { groupId: (overlay as any).groupId ?? DEFAULT_GROUP_ID, ...(overlay as any) }

                // Special handling for brush tool - it needs continuous point adding
                if (withGroup.name === 'brush') {
                  widget()?.createOverlay({
                    ...withGroup,
                    onDrawing: ({ overlay: brushOverlay }) => {
                      // Only add points after the first click (currentStep > 1)
                      const internalOverlay = brushOverlay as any
                      if (internalOverlay.currentStep > 1) {
                        // Advance to next step on each mouse move to add points continuously
                        internalOverlay.nextStep?.()
                      }
                    }
                  })
                  return
                }

                widget()?.createOverlay(withGroup)
                return
              }

              widget()?.createOverlay(overlay)
            }}
            onModeChange={mode => { widget()?.overrideOverlay({ mode: mode as OverlayMode }) }}
            onLockChange={lock => { widget()?.overrideOverlay({ lock }) }}
            onVisibleChange={visible => { widget()?.overrideOverlay({ visible }) }}
            onRemoveClick={(groupId) => { widget()?.removeOverlay({ groupId }) }} />
        </Show>
        <div
          ref={widgetRef}
          class='klinecharts-pro-widget'
          data-drawing-bar-visible={drawingBarVisible()} />
        <Show when={replayActive()}>
          <ReplayBar
            locale={locale()}
            isPaused={replayState().isPaused}
            speed={replayState().speed}
            currentIndex={replayState().currentIndex}
            totalCandles={replayState().totalCandles}
            startTimestamp={replayState().startTimestamp}
            onPlay={() => {
              replayController().play()
              setReplayState(prev => ({ ...prev, isPaused: false }))
            }}
            onPause={() => {
              replayController().pause()
              setReplayState(prev => ({ ...prev, isPaused: true }))
            }}
            onStepForward={() => replayController().stepForward()}
            onStepBackward={() => replayController().stepBackward()}
            onSpeedChange={(speed: ReplaySpeed) => {
              replayController().setSpeed(speed)
              setReplayState(prev => ({ ...prev, speed }))
            }}
            onSeek={(index: number) => {
              replayController().goToIndex(index)
              props.dataloader.updateReplayIndex(index)
              setReplayState(prev => ({ ...prev, currentIndex: index }))
              triggerChartReload()
            }}
            onExit={stopReplay}
            onDateChange={handleReplayDateChange}
          />
        </Show>
      </div>
    </>
  )
}

export default ChartProComponent