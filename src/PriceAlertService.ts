/**
 * PriceAlertService - localStorage-based price alert management
 * Supports browser notifications, inspired by TradeTally
 */

export type AlertType = 'above' | 'below' | 'change_percent'

export interface PriceAlert {
  id: string
  symbol: string
  alertType: AlertType
  targetPrice: number | null
  changePercent: number | null
  currentPrice: number | null
  isActive: boolean
  triggeredAt: number | null
  emailEnabled: boolean
  browserEnabled: boolean
  repeatEnabled: boolean
  createdAt: number
  updatedAt: number
}

const STORAGE_KEY = 'klinecharts_pro_price_alerts'

function generateId(): string {
  return `pa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

class PriceAlertService {
  private alerts: PriceAlert[] = []
  private listeners: Array<() => void> = []
  private notificationPermission: NotificationPermission = 'default'
  private priceCheckInterval: ReturnType<typeof setInterval> | null = null

  constructor() {
    this.loadFromStorage()
    if ('Notification' in window) {
      this.notificationPermission = Notification.permission
    }
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        this.alerts = JSON.parse(stored)
      }
    } catch (e) {
      console.error('Failed to load price alerts from storage:', e)
      this.alerts = []
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.alerts))
    } catch (e) {
      console.error('Failed to save price alerts to storage:', e)
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

  async requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) return false
    const permission = await Notification.requestPermission()
    this.notificationPermission = permission
    return permission === 'granted'
  }

  hasNotificationPermission(): boolean {
    return this.notificationPermission === 'granted'
  }

  getAlerts(activeOnly: boolean = false): PriceAlert[] {
    if (activeOnly) {
      return this.alerts.filter(a => a.isActive)
    }
    return [...this.alerts]
  }

  getAlertsBySymbol(symbol: string): PriceAlert[] {
    return this.alerts.filter(a => a.symbol.toUpperCase() === symbol.toUpperCase())
  }

  createAlert(params: {
    symbol: string
    alertType: AlertType
    targetPrice?: number | null
    changePercent?: number | null
    emailEnabled?: boolean
    browserEnabled?: boolean
    repeatEnabled?: boolean
  }): PriceAlert {
    const alert: PriceAlert = {
      id: generateId(),
      symbol: params.symbol.toUpperCase(),
      alertType: params.alertType,
      targetPrice: params.targetPrice ?? null,
      changePercent: params.changePercent ?? null,
      currentPrice: null,
      isActive: true,
      triggeredAt: null,
      emailEnabled: params.emailEnabled ?? false,
      browserEnabled: params.browserEnabled ?? true,
      repeatEnabled: params.repeatEnabled ?? false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    this.alerts.push(alert)
    this.saveToStorage()
    this.notifyListeners()
    return alert
  }

  updateAlert(id: string, updates: Partial<Pick<PriceAlert, 'symbol' | 'alertType' | 'targetPrice' | 'changePercent' | 'emailEnabled' | 'browserEnabled' | 'repeatEnabled'>>): PriceAlert | null {
    const alert = this.alerts.find(a => a.id === id)
    if (!alert) return null

    Object.assign(alert, updates, { updatedAt: Date.now() })
    this.saveToStorage()
    this.notifyListeners()
    return alert
  }

  toggleActive(id: string): PriceAlert | null {
    const alert = this.alerts.find(a => a.id === id)
    if (!alert) return null

    alert.isActive = !alert.isActive
    alert.updatedAt = Date.now()
    this.saveToStorage()
    this.notifyListeners()
    return alert
  }

  deleteAlert(id: string): boolean {
    const index = this.alerts.findIndex(a => a.id === id)
    if (index === -1) return false
    this.alerts.splice(index, 1)
    this.saveToStorage()
    this.notifyListeners()
    return true
  }

  /**
   * Check a price update against all alerts for a symbol
   */
  checkPrice(symbol: string, price: number, previousPrice?: number): void {
    const matchingAlerts = this.alerts.filter(
      a => a.isActive && a.symbol === symbol.toUpperCase()
    )

    for (const alert of matchingAlerts) {
      alert.currentPrice = price
      let triggered = false

      switch (alert.alertType) {
        case 'above':
          if (alert.targetPrice !== null && price >= alert.targetPrice) {
            triggered = true
          }
          break
        case 'below':
          if (alert.targetPrice !== null && price <= alert.targetPrice) {
            triggered = true
          }
          break
        case 'change_percent':
          if (alert.changePercent !== null && previousPrice && previousPrice > 0) {
            const change = Math.abs(((price - previousPrice) / previousPrice) * 100)
            if (change >= Math.abs(alert.changePercent)) {
              triggered = true
            }
          }
          break
      }

      if (triggered) {
        this.triggerAlert(alert, price)
      }
    }

    this.saveToStorage()
  }

  private triggerAlert(alert: PriceAlert, price: number): void {
    alert.triggeredAt = Date.now()

    if (!alert.repeatEnabled) {
      alert.isActive = false
    }

    if (alert.browserEnabled && this.notificationPermission === 'granted') {
      this.showBrowserNotification(alert, price)
    }

    this.notifyListeners()
  }

  private showBrowserNotification(alert: PriceAlert, price: number): void {
    const title = `Price Alert: ${alert.symbol}`
    let body = ''

    switch (alert.alertType) {
      case 'above':
        body = `${alert.symbol} reached $${price.toFixed(2)} (target: $${alert.targetPrice?.toFixed(2)})`
        break
      case 'below':
        body = `${alert.symbol} dropped to $${price.toFixed(2)} (target: $${alert.targetPrice?.toFixed(2)})`
        break
      case 'change_percent':
        body = `${alert.symbol} moved ${alert.changePercent}% - Current: $${price.toFixed(2)}`
        break
    }

    try {
      new Notification(title, {
        body,
        icon: '/favicon.ico',
        tag: alert.id
      })
    } catch (e) {
      console.error('Failed to show notification:', e)
    }
  }

  deactivateAlert(id: string): PriceAlert | null {
    const alert = this.alerts.find(a => a.id === id)
    if (!alert) return null
    alert.isActive = false
    alert.updatedAt = Date.now()
    this.saveToStorage()
    this.notifyListeners()
    return alert
  }

  getActiveAlertCount(): number {
    return this.alerts.filter(a => a.isActive).length
  }

  getAlertedSymbols(): string[] {
    return [...new Set(this.alerts.filter(a => a.isActive).map(a => a.symbol))]
  }
}

const priceAlertService = new PriceAlertService()
export default priceAlertService
export { PriceAlertService }
