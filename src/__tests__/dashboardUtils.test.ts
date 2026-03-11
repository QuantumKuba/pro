import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Replicate the pure utility functions from CryptoDashboard for unit testing.

const formatPrice = (price: number): string => {
  if (price >= 1000) return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  if (price >= 1) return `$${price.toFixed(4)}`
  if (price >= 0.01) return `$${price.toFixed(6)}`
  return `$${price.toFixed(8)}`
}

const formatCompactCurrency = (value: number): string => {
  if (!Number.isFinite(value)) return '$0'
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

const formatChange = (change: number): string => {
  const sign = change >= 0 ? '+' : ''
  return `${sign}${change.toFixed(2)}%`
}

const formatRelativeTime = (timestamp: number): string => {
  if (!Number.isFinite(timestamp)) return ''
  const diffMs = Date.now() - timestamp
  const mins = Math.floor(diffMs / 60000)
  const hours = Math.floor(mins / 60)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

interface ScreenerRow {
  ticker: string
  symbol: string
  price: number
}

const toSymbolInfo = (row: ScreenerRow) => ({
  ticker: row.ticker,
  name: `${row.symbol} / USDT`,
  shortName: row.symbol,
  exchange: 'Binance',
  market: 'crypto',
  pricePrecision: row.price >= 1000 ? 2 : row.price >= 1 ? 4 : 6,
  volumePrecision: 2
})

describe('formatPrice', () => {
  it('formats prices >= 1000 with 2 decimals', () => {
    const result = formatPrice(65432.10)
    expect(result).toMatch(/^\$65/)
    expect(result).toContain('.')
  })

  it('formats prices >= 1 with 4 decimals', () => {
    expect(formatPrice(1.23456)).toBe('$1.2346')
  })

  it('formats prices >= 0.01 with 6 decimals', () => {
    expect(formatPrice(0.0123)).toBe('$0.012300')
  })

  it('formats tiny prices with 8 decimals', () => {
    expect(formatPrice(0.00001234)).toBe('$0.00001234')
  })

  it('formats exactly 1000', () => {
    const result = formatPrice(1000)
    expect(result).toMatch(/^\$1,000\.00$/)
  })

  it('formats exactly 1', () => {
    expect(formatPrice(1)).toBe('$1.0000')
  })

  it('formats exactly 0.01', () => {
    expect(formatPrice(0.01)).toBe('$0.010000')
  })
})

describe('formatCompactCurrency', () => {
  it('formats trillions', () => {
    expect(formatCompactCurrency(2.5e12)).toBe('$2.50T')
  })

  it('formats billions', () => {
    expect(formatCompactCurrency(1.23e9)).toBe('$1.23B')
  })

  it('formats millions', () => {
    expect(formatCompactCurrency(45.6e6)).toBe('$45.60M')
  })

  it('formats smaller values', () => {
    const result = formatCompactCurrency(12345)
    expect(result).toMatch(/^\$12/)
  })

  it('handles zero', () => {
    expect(formatCompactCurrency(0)).toBe('$0')
  })

  it('handles NaN', () => {
    expect(formatCompactCurrency(NaN)).toBe('$0')
  })

  it('handles Infinity', () => {
    expect(formatCompactCurrency(Infinity)).toBe('$0')
  })

  it('handles negative Infinity', () => {
    expect(formatCompactCurrency(-Infinity)).toBe('$0')
  })
})

describe('formatChange', () => {
  it('adds + sign for positive changes', () => {
    expect(formatChange(5.25)).toBe('+5.25%')
  })

  it('shows + for zero', () => {
    expect(formatChange(0)).toBe('+0.00%')
  })

  it('shows - for negative changes', () => {
    expect(formatChange(-3.14)).toBe('-3.14%')
  })

  it('handles large positive changes', () => {
    expect(formatChange(150.5)).toBe('+150.50%')
  })

  it('handles very small changes', () => {
    expect(formatChange(0.001)).toBe('+0.00%')
  })
})

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-10T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "just now" for recent timestamps', () => {
    const ts = Date.now() - 30_000 // 30 seconds ago
    expect(formatRelativeTime(ts)).toBe('just now')
  })

  it('returns minutes for < 60 min', () => {
    const ts = Date.now() - 5 * 60_000
    expect(formatRelativeTime(ts)).toBe('5m ago')
  })

  it('returns hours for < 24 hours', () => {
    const ts = Date.now() - 3 * 3600_000
    expect(formatRelativeTime(ts)).toBe('3h ago')
  })

  it('returns days for >= 24 hours', () => {
    const ts = Date.now() - 48 * 3600_000
    expect(formatRelativeTime(ts)).toBe('2d ago')
  })

  it('handles future timestamps gracefully', () => {
    const ts = Date.now() + 60_000 // 1 minute in future
    expect(formatRelativeTime(ts)).toBe('just now')
  })

  it('returns empty string for NaN', () => {
    expect(formatRelativeTime(NaN)).toBe('')
  })

  it('returns empty string for Infinity', () => {
    expect(formatRelativeTime(Infinity)).toBe('')
  })
})

describe('toSymbolInfo', () => {
  it('sets 2 precision for high-price coins', () => {
    const info = toSymbolInfo({ ticker: 'BTCUSDT', symbol: 'BTC', price: 65000 })
    expect(info.pricePrecision).toBe(2)
    expect(info.name).toBe('BTC / USDT')
    expect(info.shortName).toBe('BTC')
    expect(info.exchange).toBe('Binance')
    expect(info.market).toBe('crypto')
  })

  it('sets 4 precision for mid-range prices', () => {
    const info = toSymbolInfo({ ticker: 'SOLUSDT', symbol: 'SOL', price: 150 })
    expect(info.pricePrecision).toBe(4)
  })

  it('sets 6 precision for low-price coins', () => {
    const info = toSymbolInfo({ ticker: 'SHIBUSDT', symbol: 'SHIB', price: 0.00001 })
    expect(info.pricePrecision).toBe(6)
  })

  it('boundary: price exactly 1000 gets 2 precision', () => {
    const info = toSymbolInfo({ ticker: 'TEST', symbol: 'T', price: 1000 })
    expect(info.pricePrecision).toBe(2)
  })

  it('boundary: price exactly 1 gets 4 precision', () => {
    const info = toSymbolInfo({ ticker: 'TEST', symbol: 'T', price: 1 })
    expect(info.pricePrecision).toBe(4)
  })

  it('always sets volumePrecision to 2', () => {
    const info = toSymbolInfo({ ticker: 'X', symbol: 'X', price: 50 })
    expect(info.volumePrecision).toBe(2)
  })
})
