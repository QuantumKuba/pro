/**
 * WatchlistService - localStorage-based watchlist persistence
 * Manages multiple watchlists with symbols, inspired by TradeTally
 */

export interface WatchlistItem {
  id: string
  symbol: string
  notes: string
  addedAt: number
  currentPrice?: number
  priceChange?: number
  percentChange?: number
}

export interface Watchlist {
  id: string
  name: string
  description: string
  isDefault: boolean
  items: WatchlistItem[]
  createdAt: number
  updatedAt: number
}

const STORAGE_KEY = 'klinecharts_pro_watchlists'

function generateId(): string {
  return `wl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

function generateItemId(): string {
  return `wli_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

class WatchlistService {
  private watchlists: Watchlist[] = []
  private listeners: Array<() => void> = []

  constructor() {
    this.loadFromStorage()
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        this.watchlists = JSON.parse(stored)
      }
    } catch (e) {
      console.error('Failed to load watchlists from storage:', e)
      this.watchlists = []
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.watchlists))
    } catch (e) {
      console.error('Failed to save watchlists to storage:', e)
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener())
  }

  subscribe(listener: () => void): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }

  getWatchlists(): Watchlist[] {
    return [...this.watchlists]
  }

  getWatchlist(id: string): Watchlist | null {
    return this.watchlists.find(w => w.id === id) ?? null
  }

  getDefaultWatchlist(): Watchlist | null {
    return this.watchlists.find(w => w.isDefault) ?? this.watchlists[0] ?? null
  }

  createWatchlist(name: string, description: string = '', isDefault: boolean = false): Watchlist {
    if (isDefault) {
      this.watchlists.forEach(w => { w.isDefault = false })
    }
    const watchlist: Watchlist = {
      id: generateId(),
      name,
      description,
      isDefault,
      items: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    this.watchlists.push(watchlist)
    this.saveToStorage()
    this.notifyListeners()
    return watchlist
  }

  updateWatchlist(id: string, updates: Partial<Pick<Watchlist, 'name' | 'description' | 'isDefault'>>): Watchlist | null {
    const watchlist = this.watchlists.find(w => w.id === id)
    if (!watchlist) return null

    if (updates.isDefault) {
      this.watchlists.forEach(w => { w.isDefault = false })
    }

    Object.assign(watchlist, updates, { updatedAt: Date.now() })
    this.saveToStorage()
    this.notifyListeners()
    return watchlist
  }

  deleteWatchlist(id: string): boolean {
    const index = this.watchlists.findIndex(w => w.id === id)
    if (index === -1) return false
    this.watchlists.splice(index, 1)
    this.saveToStorage()
    this.notifyListeners()
    return true
  }

  addSymbol(watchlistId: string, symbol: string, notes: string = ''): WatchlistItem | null {
    const watchlist = this.watchlists.find(w => w.id === watchlistId)
    if (!watchlist) return null

    // Don't add duplicates
    if (watchlist.items.some(item => item.symbol.toUpperCase() === symbol.toUpperCase())) {
      return null
    }

    const item: WatchlistItem = {
      id: generateItemId(),
      symbol: symbol.toUpperCase(),
      notes,
      addedAt: Date.now()
    }
    watchlist.items.push(item)
    watchlist.updatedAt = Date.now()
    this.saveToStorage()
    this.notifyListeners()
    return item
  }

  removeSymbol(watchlistId: string, itemId: string): boolean {
    const watchlist = this.watchlists.find(w => w.id === watchlistId)
    if (!watchlist) return false

    const index = watchlist.items.findIndex(i => i.id === itemId)
    if (index === -1) return false

    watchlist.items.splice(index, 1)
    watchlist.updatedAt = Date.now()
    this.saveToStorage()
    this.notifyListeners()
    return true
  }

  updateItemNotes(watchlistId: string, itemId: string, notes: string): WatchlistItem | null {
    const watchlist = this.watchlists.find(w => w.id === watchlistId)
    if (!watchlist) return null

    const item = watchlist.items.find(i => i.id === itemId)
    if (!item) return null

    item.notes = notes
    watchlist.updatedAt = Date.now()
    this.saveToStorage()
    this.notifyListeners()
    return item
  }

  updateItemPrice(watchlistId: string, symbol: string, price: number, change: number, percentChange: number): void {
    const watchlist = this.watchlists.find(w => w.id === watchlistId)
    if (!watchlist) return

    const item = watchlist.items.find(i => i.symbol === symbol)
    if (!item) return

    item.currentPrice = price
    item.priceChange = change
    item.percentChange = percentChange
    // Don't save to storage on price updates to avoid excessive writes
  }

  getAllSymbols(): string[] {
    const symbols = new Set<string>()
    this.watchlists.forEach(w => {
      w.items.forEach(i => symbols.add(i.symbol))
    })
    return Array.from(symbols)
  }
}

const watchlistService = new WatchlistService()
export default watchlistService
export { WatchlistService }
