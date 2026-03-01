/**
 * EarningsService - Fetches earnings calendar data from Polygon API
 * Tracks upcoming earnings for watchlist symbols
 */

export interface EarningsEvent {
  symbol: string
  reportDate: string
  fiscalQuarter: string
  fiscalYear: string
  epsEstimate: number | null
  epsActual: number | null
  revenueEstimate: number | null
  revenueActual: number | null
  hour: 'bmo' | 'amc' | 'unknown' // before market open / after market close
}

const CACHE_KEY = 'klinecharts_pro_earnings_cache'
const CACHE_DURATION = 30 * 60 * 1000 // 30 minutes

interface CacheEntry {
  events: EarningsEvent[]
  timestamp: number
}

class EarningsService {
  private cache: Map<string, CacheEntry> = new Map()
  private apiKey: string = ''

  setApiKey(key: string): void {
    this.apiKey = key
  }

  /**
   * Fetch upcoming earnings for a list of symbols
   */
  async getUpcomingEarnings(symbols: string[], daysAhead: number = 30): Promise<EarningsEvent[]> {
    if (symbols.length === 0 || !this.apiKey) return []

    const cacheKey = `earnings_${symbols.sort().join('_')}_${daysAhead}`
    const cached = this.cache.get(cacheKey)

    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.events
    }

    const events: EarningsEvent[] = []

    // Fetch earnings for each symbol (Polygon doesn't have a batch endpoint)
    for (const symbol of symbols) {
      try {
        const earnings = await this.fetchEarningsForSymbol(symbol)
        events.push(...earnings)
      } catch (e) {
        console.error(`Failed to fetch earnings for ${symbol}:`, e)
      }
    }

    // Sort by date, upcoming first
    events.sort((a, b) => new Date(a.reportDate).getTime() - new Date(b.reportDate).getTime())

    // Filter to only upcoming events within the specified range
    const now = new Date()
    const cutoff = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000)

    const upcomingEvents = events.filter(e => {
      const date = new Date(e.reportDate)
      return date >= now && date <= cutoff
    })

    this.cache.set(cacheKey, { events: upcomingEvents, timestamp: Date.now() })
    return upcomingEvents
  }

  private async fetchEarningsForSymbol(symbol: string): Promise<EarningsEvent[]> {
    try {
      const response = await fetch(
        `https://api.polygon.io/vX/reference/financials?ticker=${encodeURIComponent(symbol)}&limit=4&sort=period_of_report_date&order=desc&apiKey=${this.apiKey}`
      )
      const result = await response.json()

      return (result.results || []).map((item: any) => ({
        symbol: symbol.toUpperCase(),
        reportDate: item.filing_date || item.period_of_report_date || '',
        fiscalQuarter: `Q${item.fiscal_period || ''}`,
        fiscalYear: item.fiscal_year || '',
        epsEstimate: null,
        epsActual: item.financials?.income_statement?.basic_earnings_per_share?.value ?? null,
        revenueEstimate: null,
        revenueActual: item.financials?.income_statement?.revenues?.value ?? null,
        hour: 'unknown' as const
      }))
    } catch (e) {
      console.error(`Failed to fetch earnings for ${symbol}:`, e)
      return []
    }
  }

  /**
   * Format earnings date relative to today
   */
  formatEarningsDate(dateString: string): string {
    const date = new Date(dateString)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const earningsDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const diffTime = earningsDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Tomorrow'
    if (diffDays > 0 && diffDays < 7) return `In ${diffDays} days`

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    })
  }

  /**
   * Format hour indicator
   */
  formatHour(hour: string): string {
    switch (hour) {
      case 'bmo': return 'Before Market Open'
      case 'amc': return 'After Market Close'
      default: return ''
    }
  }

  clearCache(): void {
    this.cache.clear()
  }
}

const earningsService = new EarningsService()
export default earningsService
export { EarningsService }
