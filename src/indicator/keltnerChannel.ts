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

import { IndicatorTemplate, KLineData } from 'klinecharts'

interface KeltnerResult {
  basis?: number
  upper1?: number
  lower1?: number
  upper2?: number
  lower2?: number
  upper3?: number
  lower3?: number
}

type MaMode = 0 | 1 | 2 | 3

type SourceMode = 0 | 1 | 2 | 3 | 4

const toPositiveInt = (value: unknown, fallback: number): number => {
  const n = Number(value)
  if (!Number.isFinite(n)) {
    return fallback
  }
  const normalized = Math.floor(n)
  return normalized > 0 ? normalized : fallback
}

const toNonNegative = (value: unknown, fallback: number): number => {
  const n = Number(value)
  if (!Number.isFinite(n)) {
    return fallback
  }
  return n >= 0 ? n : fallback
}

const toMode = (value: unknown, fallback: number, max: number): number => {
  const n = Number(value)
  if (!Number.isFinite(n)) {
    return fallback
  }
  const normalized = Math.floor(n)
  if (normalized < 0 || normalized > max) {
    return fallback
  }
  return normalized
}

const getSourcePrice = (data: KLineData, sourceMode: SourceMode): number => {
  switch (sourceMode) {
    case 1:
      return (data.high + data.low + data.close) / 3 // HLC3
    case 2:
      return (data.high + data.low) / 2 // HL2
    case 3:
      return (data.open + data.high + data.low + data.close) / 4 // OHLC4
    case 4:
      return data.open
    default:
      return data.close
  }
}

const calcTrueRange = (dataList: KLineData[]): number[] => {
  const result: number[] = []
  for (let i = 0; i < dataList.length; i++) {
    const current = dataList[i]
    if (i === 0) {
      result.push(current.high - current.low)
      continue
    }
    const prevClose = dataList[i - 1].close
    const tr = Math.max(
      current.high - current.low,
      Math.abs(current.high - prevClose),
      Math.abs(current.low - prevClose)
    )
    result.push(tr)
  }
  return result
}

const calcSMA = (values: number[], period: number): (number | undefined)[] => {
  const result: (number | undefined)[] = new Array(values.length).fill(undefined)
  if (period <= 0) {
    return result
  }
  let sum = 0
  for (let i = 0; i < values.length; i++) {
    sum += values[i]
    if (i >= period) {
      sum -= values[i - period]
    }
    if (i >= period - 1) {
      result[i] = sum / period
    }
  }
  return result
}

const calcEMA = (values: number[], period: number): (number | undefined)[] => {
  const result: (number | undefined)[] = new Array(values.length).fill(undefined)
  if (period <= 0 || values.length === 0) {
    return result
  }

  const seed = calcSMA(values, period)
  const alpha = 2 / (period + 1)
  let ema: number | undefined

  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      continue
    }
    if (i === period - 1) {
      ema = seed[i]
      result[i] = ema
      continue
    }
    if (ema !== undefined) {
      ema = values[i] * alpha + ema * (1 - alpha)
      result[i] = ema
    }
  }
  return result
}

const calcRMA = (values: number[], period: number): (number | undefined)[] => {
  const result: (number | undefined)[] = new Array(values.length).fill(undefined)
  if (period <= 0 || values.length === 0) {
    return result
  }

  const seed = calcSMA(values, period)
  let rma: number | undefined

  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      continue
    }
    if (i === period - 1) {
      rma = seed[i]
      result[i] = rma
      continue
    }
    if (rma !== undefined) {
      rma = (rma * (period - 1) + values[i]) / period
      result[i] = rma
    }
  }
  return result
}

const calcWMA = (values: number[], period: number): (number | undefined)[] => {
  const result: (number | undefined)[] = new Array(values.length).fill(undefined)
  if (period <= 0 || values.length === 0) {
    return result
  }

  const denominator = (period * (period + 1)) / 2
  for (let i = period - 1; i < values.length; i++) {
    let weightedSum = 0
    for (let j = 0; j < period; j++) {
      weightedSum += values[i - period + 1 + j] * (j + 1)
    }
    result[i] = weightedSum / denominator
  }
  return result
}

const calcMAByMode = (values: number[], period: number, mode: MaMode): (number | undefined)[] => {
  switch (mode) {
    case 1:
      return calcSMA(values, period)
    case 2:
      return calcWMA(values, period)
    case 3:
      return calcRMA(values, period)
    default:
      return calcEMA(values, period)
  }
}

const keltnerChannel: IndicatorTemplate = {
  name: 'KELTNER',
  shortName: 'Keltner',
  calcParams: [20, 20, 1, 2, 3, 1, 0, 3],
  precision: 4,
  shouldOhlc: true,
  figures: [
    { key: 'basis', title: 'Basis: ', type: 'line' },
    { key: 'upper1', title: 'U1: ', type: 'line' },
    { key: 'lower1', title: 'L1: ', type: 'line' },
    { key: 'upper2', title: 'U2: ', type: 'line' },
    { key: 'lower2', title: 'L2: ', type: 'line' },
    { key: 'upper3', title: 'U3: ', type: 'line' },
    { key: 'lower3', title: 'L3: ', type: 'line' }
  ],
  styles: {
    lines: [
      { color: '#0D47A1', size: 2 },
      { color: '#00A86B' },
      { color: '#00A86B' },
      { color: '#F9A825' },
      { color: '#F9A825' },
      { color: '#C62828' },
      { color: '#C62828' }
    ]
  },
  calc: (dataList: KLineData[], indicator): KeltnerResult[] => {
    const params = indicator.calcParams

    const basisPeriod = toPositiveInt(params[0], 20)
    const atrPeriod = toPositiveInt(params[1], 20)

    const multiplier1 = toNonNegative(params[2], 1)
    const multiplier2 = toNonNegative(params[3], 2)
    const multiplier3 = toNonNegative(params[4], 3)

    const sourceMode = toMode(params[5], 1, 4) as SourceMode
    const basisMode = toMode(params[6], 0, 3) as MaMode
    const atrMode = toMode(params[7], 3, 3) as MaMode

    const sourceValues = dataList.map(data => getSourcePrice(data, sourceMode))
    const trValues = calcTrueRange(dataList)

    const basisValues = calcMAByMode(sourceValues, basisPeriod, basisMode)
    const atrValues = calcMAByMode(trValues, atrPeriod, atrMode)

    return dataList.map((_, i) => {
      const basis = basisValues[i]
      const atr = atrValues[i]
      if (basis === undefined || atr === undefined) {
        return {}
      }

      return {
        basis,
        upper1: basis + atr * multiplier1,
        lower1: basis - atr * multiplier1,
        upper2: basis + atr * multiplier2,
        lower2: basis - atr * multiplier2,
        upper3: basis + atr * multiplier3,
        lower3: basis - atr * multiplier3
      }
    })
  }
}

export default keltnerChannel
