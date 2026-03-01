/**
 * NewsService - Fetches news for symbols from Polygon API
 * Provides news enrichment for traded/watched symbols
 */

export interface NewsArticle {
  id: string
  title: string
  summary: string
  url: string
  source: string
  publishedAt: number
  symbols: string[]
  imageUrl?: string
}

const CACHE_KEY = 'klinecharts_pro_news_cache'
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

interface CacheEntry {
  articles: NewsArticle[]
  timestamp: number
}

class NewsService {
  private cache: Map<string, CacheEntry> = new Map()
  private apiKey: string = ''

  setApiKey(key: string): void {
    this.apiKey = key
  }

  /**
   * Fetch news for a specific symbol
   */
  async getNewsForSymbol(symbol: string, limit: number = 10): Promise<NewsArticle[]> {
    const cacheKey = `${symbol}_${limit}`
    const cached = this.cache.get(cacheKey)

    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.articles
    }

    if (!this.apiKey) {
      return []
    }

    try {
      const response = await fetch(
        `https://api.polygon.io/v2/reference/news?ticker=${encodeURIComponent(symbol)}&limit=${limit}&apiKey=${this.apiKey}`
      )
      const result = await response.json()

      const articles: NewsArticle[] = (result.results || []).map((item: any) => ({
        id: item.id || `news_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        title: item.title || '',
        summary: item.description || '',
        url: item.article_url || '',
        source: item.publisher?.name || 'Unknown',
        publishedAt: new Date(item.published_utc).getTime(),
        symbols: item.tickers || [symbol],
        imageUrl: item.image_url || undefined
      }))

      this.cache.set(cacheKey, { articles, timestamp: Date.now() })
      return articles
    } catch (e) {
      console.error('Failed to fetch news:', e)
      return []
    }
  }

  /**
   * Fetch news for multiple symbols
   */
  async getNewsForSymbols(symbols: string[], limit: number = 20): Promise<NewsArticle[]> {
    if (symbols.length === 0 || !this.apiKey) return []

    const cacheKey = `multi_${symbols.sort().join('_')}_${limit}`
    const cached = this.cache.get(cacheKey)

    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.articles
    }

    try {
      const tickerParam = symbols.join(',')
      const response = await fetch(
        `https://api.polygon.io/v2/reference/news?ticker=${encodeURIComponent(tickerParam)}&limit=${limit}&apiKey=${this.apiKey}`
      )
      const result = await response.json()

      const articles: NewsArticle[] = (result.results || []).map((item: any) => ({
        id: item.id || `news_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        title: item.title || '',
        summary: item.description || '',
        url: item.article_url || '',
        source: item.publisher?.name || 'Unknown',
        publishedAt: new Date(item.published_utc).getTime(),
        symbols: item.tickers || [],
        imageUrl: item.image_url || undefined
      }))

      this.cache.set(cacheKey, { articles, timestamp: Date.now() })
      return articles
    } catch (e) {
      console.error('Failed to fetch news for symbols:', e)
      return []
    }
  }

  /**
   * Format a timestamp as a relative time string
   */
  formatRelativeTime(timestamp: number): string {
    const now = Date.now()
    const diffMs = now - timestamp
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffHours / 24)

    if (diffHours < 1) return 'Just now'
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`

    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
  }

  clearCache(): void {
    this.cache.clear()
  }
}

const newsService = new NewsService()
export default newsService
export { NewsService }
