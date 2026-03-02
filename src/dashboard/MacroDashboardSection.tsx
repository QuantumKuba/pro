import { createSignal, onMount, type Component, For } from 'solid-js'

interface MarketOverviewData {
  totalMarketCap: number
  marketCapChange7d: number
  marketCapTrend7d: number[]
  btcDominance: number
  btcDominanceChange7d: number
  btcDominanceTrend7d: number[]
  timeframe: string
}

interface TokenUnlockEntry {
  dateLabel: string
  dayLabel: string
  value: number
  bucket: 'past' | 'today' | 'future'
}

interface FearGreedData {
  score: number
  label: string
}

interface AltcoinIndexData {
  score: number
  source: 'live' | 'mock'
}

interface MacroAssetData {
  symbol: string
  name: string
  badge: string
  price: number
  change24h: number
}

interface MacroData {
  timeframe: string
  sp500: MacroAssetData
  gold: MacroAssetData
}

const MOCK_MARKET_OVERVIEW: MarketOverviewData = {
  totalMarketCap: 2.37e12,
  marketCapChange7d: -4.82,
  marketCapTrend7d: [2.52e12, 2.5e12, 2.45e12, 2.41e12, 2.39e12, 2.38e12, 2.37e12],
  btcDominance: 55.64,
  btcDominanceChange7d: 1.18,
  btcDominanceTrend7d: [54.25, 54.4, 54.7, 54.9, 55.1, 55.35, 55.64],
  timeframe: '7D'
}

const MOCK_FEAR_GREED: FearGreedData = {
  score: 14,
  label: 'Extreme fear'
}

const MOCK_ALTCOIN_INDEX: AltcoinIndexData = {
  score: 38,
  source: 'mock'
}

const MOCK_MACRO: MacroData = {
  timeframe: '24H',
  sp500: {
    symbol: 'SPX',
    name: 'S&P 500',
    badge: '500',
    price: 5118.4,
    change24h: -0.41
  },
  gold: {
    symbol: 'XAU',
    name: 'Gold',
    badge: 'Au',
    price: 2031.22,
    change24h: 0.63
  }
}

const STABLE_SYMBOLS = new Set(['USDT', 'USDC', 'DAI', 'TUSD', 'FDUSD', 'USDE'])

const formatTrillions = (value: number): string => {
  if (!Number.isFinite(value)) return '$0.00T'
  return `$${(value / 1e12).toFixed(2)}T`
}

const formatPercent = (value: number): string => {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

const formatCompactMillions = (value: number): string => {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`
  return `$${Math.round(value).toLocaleString()}`
}

const formatMacroPrice = (value: number): string => {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value))

const generateTrend = (current: number, dailyChangePercent: number, points = 7): number[] => {
  const change = dailyChangePercent / 100
  const trend: number[] = []
  for (let i = 0; i < points; i += 1) {
    const drift = (i - (points - 1)) * change * 0.28
    const wave = Math.sin(i * 0.9) * 0.006
    trend.push(current * (1 + drift + wave))
  }
  return trend
}

const computeChangeFromTrend = (trend: number[]): number => {
  if (trend.length < 2 || trend[0] === 0) return 0
  const first = trend[0]
  const last = trend[trend.length - 1]
  return ((last - first) / first) * 100
}

const buildUnlockMock = (): TokenUnlockEntry[] => {
  const offsets = [-3, -2, -1, 0, 1, 2, 3]
  const values = [25.1e6, 44.2e6, 68.7e6, 111.2e6, 58.4e6, 36.3e6, 23.8e6]

  return offsets.map((offset, index) => {
    const date = new Date()
    date.setDate(date.getDate() + offset)
    return {
      dateLabel: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      dayLabel: offset === 0 ? 'Today' : date.toLocaleDateString(undefined, { weekday: 'short' }),
      value: values[index],
      bucket: offset < 0 ? 'past' : offset === 0 ? 'today' : 'future'
    }
  })
}

const fetchCoinGeckoGlobal = async (): Promise<MarketOverviewData | null> => {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/global')
    if (!response.ok) return null

    const payload = await response.json() as {
      data?: {
        total_market_cap?: { usd?: number }
        market_cap_change_percentage_24h_usd?: number
        market_cap_percentage?: { btc?: number }
      }
    }

    const totalMarketCap = payload.data?.total_market_cap?.usd
    const dailyChange = payload.data?.market_cap_change_percentage_24h_usd ?? 0
    const btcDominance = payload.data?.market_cap_percentage?.btc

    if (!totalMarketCap || btcDominance === undefined) return null

    const marketCapTrend = generateTrend(totalMarketCap, dailyChange, 7)
    const dominanceTrend = generateTrend(btcDominance, dailyChange * 0.12, 7)

    return {
      totalMarketCap,
      marketCapChange7d: computeChangeFromTrend(marketCapTrend),
      marketCapTrend7d: marketCapTrend,
      btcDominance,
      btcDominanceChange7d: computeChangeFromTrend(dominanceTrend),
      btcDominanceTrend7d: dominanceTrend,
      timeframe: '7D'
    }
  } catch {
    return null
  }
}

const fetchFearGreed = async (): Promise<FearGreedData | null> => {
  try {
    const response = await fetch('https://api.alternative.me/fng/?limit=1')
    if (!response.ok) return null

    const payload = await response.json() as {
      data?: Array<{
        value?: string
        value_classification?: string
      }>
    }

    const first = payload.data?.[0]
    if (!first?.value) return null

    return {
      score: clamp(Number(first.value), 0, 100),
      label: first.value_classification || 'Neutral'
    }
  } catch {
    return null
  }
}

const fetchMacroData = async (): Promise<MacroData | null> => {
  const apiKey = import.meta.env.VITE_FMP_API_KEY as string | undefined
  if (!apiKey) return null

  try {
    const [spResponse, goldResponse] = await Promise.all([
      fetch(`https://financialmodelingprep.com/api/v3/quote/SPY?apikey=${apiKey}`),
      fetch(`https://financialmodelingprep.com/api/v3/quote/XAUUSD?apikey=${apiKey}`)
    ])

    if (!spResponse.ok || !goldResponse.ok) return null

    const [spPayload, goldPayload] = await Promise.all([
      spResponse.json() as Promise<Array<{ price?: number; changesPercentage?: number }>>,
      goldResponse.json() as Promise<Array<{ price?: number; changesPercentage?: number }>>
    ])

    const sp = spPayload[0]
    const gold = goldPayload[0]
    if (!sp?.price || !gold?.price) return null

    return {
      timeframe: '24H',
      sp500: {
        symbol: 'SPX',
        name: 'S&P 500',
        badge: '500',
        price: sp.price,
        change24h: sp.changesPercentage ?? 0
      },
      gold: {
        symbol: 'XAU',
        name: 'Gold',
        badge: 'Au',
        price: gold.price,
        change24h: gold.changesPercentage ?? 0
      }
    }
  } catch {
    return null
  }
}

const calculateAltcoinIndex = async (): Promise<AltcoinIndexData | null> => {
  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=false&price_change_percentage=30d'
    )
    if (!response.ok) return null

    const coins = await response.json() as Array<{
      id?: string
      symbol?: string
      price_change_percentage_30d_in_currency?: number | null
    }>

    const btcEntry = coins.find(c => c.symbol?.toUpperCase() === 'BTC')
    const btcChange = btcEntry?.price_change_percentage_30d_in_currency
    if (btcChange === undefined || btcChange === null) return null

    const altcoins = coins.filter(c => {
      const sym = (c.symbol ?? '').toUpperCase()
      return sym !== 'BTC' && !STABLE_SYMBOLS.has(sym)
    })

    if (altcoins.length < 10) return null

    let valid = 0
    let outperform = 0

    for (const coin of altcoins) {
      const change = coin.price_change_percentage_30d_in_currency
      if (change === undefined || change === null) continue
      valid += 1
      if (change > btcChange) outperform += 1
    }

    if (valid < 10) return null

    return {
      score: Math.round((outperform / valid) * 100),
      source: 'live'
    }
  } catch {
    return null
  }
}

const SparklineArea: Component<{
  data: number[]
  stroke: string
  fill: string
}> = (props) => {
  const width = 280
  const height = 112
  const min = Math.min(...props.data)
  const max = Math.max(...props.data)
  const range = max - min || 1

  const points = props.data.map((value, index) => {
    const x = (index / Math.max(props.data.length - 1, 1)) * width
    const y = height - ((value - min) / range) * height
    return `${x},${y}`
  })

  const linePath = `M${points.join(' L')}`
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`

  return (
    <svg viewBox={`0 0 ${width} ${height}`} class="macro-cards__sparkline" preserveAspectRatio="none">
      <path d={areaPath} fill={props.fill} />
      <path d={linePath} fill="none" stroke={props.stroke} stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  )
}

const FearGreedGauge: Component<{ score: number }> = (props) => {
  const centerX = 110
  const centerY = 110
  const radius = 78
  const markerAngle = 180 - clamp(props.score, 0, 100) * 1.8

  const polarToCartesian = (angleDeg: number) => {
    const angle = (Math.PI / 180) * angleDeg
    return {
      x: centerX + radius * Math.cos(angle),
      y: centerY - radius * Math.sin(angle)
    }
  }

  const describeArc = (startAngle: number, endAngle: number) => {
    const start = polarToCartesian(startAngle)
    const end = polarToCartesian(endAngle)
    const largeArc = Math.abs(endAngle - startAngle) > 180 ? 1 : 0
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`
  }

  const marker = polarToCartesian(markerAngle)

  return (
    <svg viewBox="0 0 220 130" class="macro-cards__gauge" preserveAspectRatio="xMidYMid meet">
      <path d={describeArc(180, 120)} class="macro-cards__gauge-segment macro-cards__gauge-segment--fear" stroke-width="16" fill="none" stroke-linecap="round" />
      <path d={describeArc(120, 60)} class="macro-cards__gauge-segment macro-cards__gauge-segment--neutral" stroke-width="16" fill="none" stroke-linecap="round" />
      <path d={describeArc(60, 0)} class="macro-cards__gauge-segment macro-cards__gauge-segment--greed" stroke-width="16" fill="none" stroke-linecap="round" />
      <circle cx={marker.x} cy={marker.y} r="7" class="macro-cards__gauge-marker" />
      <circle cx={marker.x} cy={marker.y} r="3" class="macro-cards__gauge-marker-dot" />
    </svg>
  )
}

export const MacroDashboardSection: Component = () => {
  const [marketData, setMarketData] = createSignal<MarketOverviewData>(MOCK_MARKET_OVERVIEW)
  const [fearGreed, setFearGreed] = createSignal<FearGreedData>(MOCK_FEAR_GREED)
  const [altcoinIndex, setAltcoinIndex] = createSignal<AltcoinIndexData>(MOCK_ALTCOIN_INDEX)
  const [macroData, setMacroData] = createSignal<MacroData>(MOCK_MACRO)
  const [tokenUnlocks] = createSignal<TokenUnlockEntry[]>(buildUnlockMock())

  onMount(async () => {
    const [global, fng, macro, altIndex] = await Promise.all([
      fetchCoinGeckoGlobal(),
      fetchFearGreed(),
      fetchMacroData(),
      calculateAltcoinIndex()
    ])

    if (global) setMarketData(global)
    if (fng) setFearGreed(fng)
    if (macro) setMacroData(macro)
    if (altIndex) setAltcoinIndex(altIndex)
  })

  const unlockMax = () => Math.max(...tokenUnlocks().map(item => item.value), 1)

  return (
    <section class="macro-cards">
      <article class="macro-cards__card">
        <div class="macro-cards__head">
          <h3>Market Cap</h3>
          <span>{marketData().timeframe}</span>
        </div>
        <div class="macro-cards__value">{formatTrillions(marketData().totalMarketCap)}</div>
        <div class={`macro-cards__change ${marketData().marketCapChange7d >= 0 ? 'macro-cards__change--up' : 'macro-cards__change--down'}`}>
          {formatPercent(marketData().marketCapChange7d)}
        </div>
        <SparklineArea
          data={marketData().marketCapTrend7d}
          stroke="#ff6b8a"
          fill="url(#marketCapGradient)"
        />
      </article>

      <article class="macro-cards__card">
        <div class="macro-cards__head">
          <h3>Token Unlock Dynamics</h3>
          <span>24H</span>
        </div>
        <div class="macro-cards__bars">
          <For each={tokenUnlocks()}>
            {(item) => {
              const heightPercent = (item.value / unlockMax()) * 100
              return (
                <div class="macro-cards__bar-item">
                  <span class="macro-cards__bar-value">{formatCompactMillions(item.value)}</span>
                  <div
                    class={`macro-cards__bar macro-cards__bar--${item.bucket}`}
                    style={{ height: `${Math.max(heightPercent, 12)}%` }}
                  />
                  <span class="macro-cards__bar-day">{item.dayLabel}</span>
                  <span class="macro-cards__bar-date">{item.dateLabel}</span>
                </div>
              )
            }}
          </For>
        </div>
      </article>

      <article class="macro-cards__card">
        <div class="macro-cards__head">
          <h3>Fear &amp; Greed Index</h3>
        </div>
        <div class="macro-cards__gauge-wrap">
          <FearGreedGauge score={fearGreed().score} />
          <div class="macro-cards__gauge-score">{fearGreed().score}</div>
          <div class="macro-cards__gauge-label">{fearGreed().label}</div>
        </div>
      </article>

      <article class="macro-cards__card">
        <div class="macro-cards__head">
          <h3>Bitcoin Dominance</h3>
          <span>{marketData().timeframe}</span>
        </div>
        <div class="macro-cards__value">{marketData().btcDominance.toFixed(2)}%</div>
        <div class={`macro-cards__change ${marketData().btcDominanceChange7d >= 0 ? 'macro-cards__change--up' : 'macro-cards__change--down'}`}>
          {formatPercent(marketData().btcDominanceChange7d)}
        </div>
        <SparklineArea
          data={marketData().btcDominanceTrend7d}
          stroke="#f9b14f"
          fill="url(#dominanceGradient)"
        />
      </article>

      <article class="macro-cards__card">
        <div class="macro-cards__head">
          <h3>Altcoin Index</h3>
          <span>{altcoinIndex().source === 'live' ? 'Live' : 'Mock'}</span>
        </div>
        <div class="macro-cards__value">{altcoinIndex().score}/100</div>
        <div class="macro-cards__season-wrap">
          <div class="macro-cards__season-track" />
          <div class="macro-cards__season-marker" style={{ left: `${clamp(altcoinIndex().score, 0, 100)}%` }} />
          <div class="macro-cards__season-labels">
            <span>Bitcoin Season</span>
            <span>Altcoin Season</span>
          </div>
        </div>
      </article>

      <article class="macro-cards__card">
        <div class="macro-cards__head">
          <h3>Macro (S&amp;P 500 &amp; Gold)</h3>
          <span>{macroData().timeframe}</span>
        </div>
        <div class="macro-cards__macro-list">
          <div class="macro-cards__macro-item">
            <span class="macro-cards__asset-id">
              <span class="macro-cards__badge macro-cards__badge--sp">{macroData().sp500.badge}</span>
              <span>{macroData().sp500.name}</span>
            </span>
            <span>{formatMacroPrice(macroData().sp500.price)}</span>
            <span class={macroData().sp500.change24h >= 0 ? 'macro-cards__change macro-cards__change--up' : 'macro-cards__change macro-cards__change--down'}>
              {formatPercent(macroData().sp500.change24h)}
            </span>
          </div>
          <div class="macro-cards__macro-item">
            <span class="macro-cards__asset-id">
              <span class="macro-cards__badge macro-cards__badge--gold">{macroData().gold.badge}</span>
              <span>{macroData().gold.name}</span>
            </span>
            <span>{formatMacroPrice(macroData().gold.price)}</span>
            <span class={macroData().gold.change24h >= 0 ? 'macro-cards__change macro-cards__change--up' : 'macro-cards__change macro-cards__change--down'}>
              {formatPercent(macroData().gold.change24h)}
            </span>
          </div>
        </div>
      </article>

      <svg width="0" height="0" aria-hidden="true">
        <defs>
          <linearGradient id="marketCapGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="rgba(255, 107, 138, 0.36)" />
            <stop offset="100%" stop-color="rgba(255, 107, 138, 0)" />
          </linearGradient>
          <linearGradient id="dominanceGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="rgba(249, 177, 79, 0.34)" />
            <stop offset="100%" stop-color="rgba(249, 177, 79, 0)" />
          </linearGradient>
        </defs>
      </svg>
    </section>
  )
}

export default MacroDashboardSection
