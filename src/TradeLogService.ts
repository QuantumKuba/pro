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

/**
 * Trade interface for storing position data
 */
export interface Trade {
  id: string
  type: 'long' | 'short'
  symbol: string
  entryPrice: number
  exitPrice?: number
  stopLoss: number
  takeProfit: number
  quantity: number
  entryTime: number
  exitTime?: number
  status: 'open' | 'closed' | 'cancelled'
  pnl?: number
  pnlPercent?: number
  rrRatio: number
  notes?: string
  isReplay?: boolean
}

/**
 * Trade statistics summary
 */
export interface TradeStats {
  totalTrades: number
  openTrades: number
  closedTrades: number
  winCount: number
  lossCount: number
  winRate: number
  totalPnL: number
  avgWin: number
  avgLoss: number
  profitFactor: number
  bestTrade: Trade | null
  worstTrade: Trade | null
  avgRR: number
}

const STORAGE_KEY = 'klinecharts_pro_trade_log'

/**
 * Generate unique ID for trades
 */
function generateId(): string {
  return `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Trade Log Service
 * 
 * Manages trade records with localStorage persistence
 */
class TradeLogService {
  private trades: Trade[] = []
  private listeners: Array<() => void> = []

  constructor() {
    this.loadFromStorage()
  }

  /**
   * Load trades from localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        this.trades = JSON.parse(stored)
      }
    } catch (e) {
      console.error('Failed to load trade log from storage:', e)
      this.trades = []
    }
  }

  /**
   * Save trades to localStorage
   */
  private saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.trades))
    } catch (e) {
      console.error('Failed to save trade log to storage:', e)
    }
  }

  /**
   * Notify all listeners of changes
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener())
  }

  /**
   * Subscribe to trade log changes
   */
  subscribe(listener: () => void): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }

  /**
   * Create a new trade
   */
  createTrade(trade: Omit<Trade, 'id'>): Trade {
    const newTrade: Trade = {
      ...trade,
      id: generateId()
    }
    this.trades.push(newTrade)
    this.saveToStorage()
    this.notifyListeners()
    return newTrade
  }

  /**
   * Update an existing trade
   */
  updateTrade(id: string, updates: Partial<Trade>): Trade | null {
    const index = this.trades.findIndex(t => t.id === id)
    if (index === -1) return null

    this.trades[index] = { ...this.trades[index], ...updates }
    this.saveToStorage()
    this.notifyListeners()
    return this.trades[index]
  }

  /**
   * Close a trade with exit price and calculate P&L
   */
  closeTrade(id: string, exitPrice: number, exitTime?: number): Trade | null {
    const trade = this.trades.find(t => t.id === id)
    if (!trade || trade.status !== 'open') return null

    const pnl = trade.type === 'long'
      ? (exitPrice - trade.entryPrice) * trade.quantity
      : (trade.entryPrice - exitPrice) * trade.quantity

    const pnlPercent = trade.type === 'long'
      ? ((exitPrice - trade.entryPrice) / trade.entryPrice) * 100
      : ((trade.entryPrice - exitPrice) / trade.entryPrice) * 100

    return this.updateTrade(id, {
      status: 'closed',
      exitPrice,
      exitTime: exitTime ?? Date.now(),
      pnl,
      pnlPercent
    })
  }

  /**
   * Cancel a trade
   */
  cancelTrade(id: string): Trade | null {
    return this.updateTrade(id, { status: 'cancelled' })
  }

  /**
   * Delete a trade
   */
  deleteTrade(id: string): boolean {
    const initialLength = this.trades.length
    this.trades = this.trades.filter(t => t.id !== id)
    if (this.trades.length !== initialLength) {
      this.saveToStorage()
      this.notifyListeners()
      return true
    }
    return false
  }

  /**
   * Get all trades
   */
  getTrades(): Trade[] {
    return [...this.trades]
  }

  /**
   * Get trades filtered by status
   */
  getTradesByStatus(status: Trade['status']): Trade[] {
    return this.trades.filter(t => t.status === status)
  }

  /**
   * Get trades filtered by symbol
   */
  getTradesBySymbol(symbol: string): Trade[] {
    return this.trades.filter(t => t.symbol === symbol)
  }

  /**
   * Calculate trade statistics
   */
  getStats(): TradeStats {
    const closedTrades = this.trades.filter(t => t.status === 'closed')
    const openTrades = this.trades.filter(t => t.status === 'open')

    const wins = closedTrades.filter(t => (t.pnl ?? 0) > 0)
    const losses = closedTrades.filter(t => (t.pnl ?? 0) < 0)

    const totalWin = wins.reduce((sum, t) => sum + (t.pnl ?? 0), 0)
    const totalLoss = Math.abs(losses.reduce((sum, t) => sum + (t.pnl ?? 0), 0))

    const avgRR = closedTrades.length > 0
      ? closedTrades.reduce((sum, t) => sum + t.rrRatio, 0) / closedTrades.length
      : 0

    const sortedByPnl = [...closedTrades].sort((a, b) => (b.pnl ?? 0) - (a.pnl ?? 0))

    return {
      totalTrades: this.trades.length,
      openTrades: openTrades.length,
      closedTrades: closedTrades.length,
      winCount: wins.length,
      lossCount: losses.length,
      winRate: closedTrades.length > 0 ? (wins.length / closedTrades.length) * 100 : 0,
      totalPnL: closedTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0),
      avgWin: wins.length > 0 ? totalWin / wins.length : 0,
      avgLoss: losses.length > 0 ? totalLoss / losses.length : 0,
      profitFactor: totalLoss > 0 ? totalWin / totalLoss : totalWin > 0 ? Infinity : 0,
      bestTrade: sortedByPnl[0] ?? null,
      worstTrade: sortedByPnl[sortedByPnl.length - 1] ?? null,
      avgRR
    }
  }

  /**
   * Export trades to CSV format
   */
  exportToCSV(): string {
    const headers = [
      'ID', 'Type', 'Symbol', 'Entry Price', 'Exit Price',
      'Stop Loss', 'Take Profit', 'Quantity', 'Entry Time',
      'Exit Time', 'Status', 'P&L', 'P&L %', 'R/R Ratio', 'Notes'
    ]

    const rows = this.trades.map(t => [
      t.id,
      t.type,
      t.symbol,
      t.entryPrice,
      t.exitPrice ?? '',
      t.stopLoss,
      t.takeProfit,
      t.quantity,
      new Date(t.entryTime).toISOString(),
      t.exitTime ? new Date(t.exitTime).toISOString() : '',
      t.status,
      t.pnl?.toFixed(2) ?? '',
      t.pnlPercent?.toFixed(2) ?? '',
      t.rrRatio.toFixed(2),
      t.notes ?? ''
    ])

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
  }

  /**
   * Clear all trades
   */
  clearAll(): void {
    this.trades = []
    this.saveToStorage()
    this.notifyListeners()
  }
}

// Singleton instance
const tradeLogService = new TradeLogService()

export default tradeLogService
export { TradeLogService }
