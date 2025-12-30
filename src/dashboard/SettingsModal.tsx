/**
 * Settings Modal Component
 * macOS-style settings panel with switch toggles
 */

import { createSignal, For, Show, type Component } from 'solid-js'

// All available coins for selection
const AVAILABLE_COINS = [
  { symbol: 'BTCUSDT', name: 'Bitcoin', icon: '₿' },
  { symbol: 'ETHUSDT', name: 'Ethereum', icon: 'Ξ' },
  { symbol: 'BNBUSDT', name: 'BNB', icon: '◆' },
  { symbol: 'SOLUSDT', name: 'Solana', icon: '◎' },
  { symbol: 'XRPUSDT', name: 'XRP', icon: '✕' },
  { symbol: 'DOGEUSDT', name: 'Dogecoin', icon: 'Ð' },
  { symbol: 'ADAUSDT', name: 'Cardano', icon: '₳' },
  { symbol: 'AVAXUSDT', name: 'Avalanche', icon: '▲' },
  { symbol: 'DOTUSDT', name: 'Polkadot', icon: '●' },
  { symbol: 'MATICUSDT', name: 'Polygon', icon: '⬡' },
  { symbol: 'LINKUSDT', name: 'Chainlink', icon: '⬢' },
  { symbol: 'LTCUSDT', name: 'Litecoin', icon: 'Ł' },
]

const STORAGE_KEY = 'dashboard_selected_coins'
const DEFAULT_COINS = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT']

export const loadSelectedCoins = (): string[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (e) {
    console.warn('Failed to load selected coins from localStorage:', e)
  }
  return DEFAULT_COINS
}

export const saveSelectedCoins = (coins: string[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(coins))
  } catch (e) {
    console.warn('Failed to save selected coins to localStorage:', e)
  }
}

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  selectedCoins: string[]
  onSave: (coins: string[]) => void
}

export const SettingsModal: Component<SettingsModalProps> = (props) => {
  const [localSelection, setLocalSelection] = createSignal<string[]>([...props.selectedCoins])

  const toggleCoin = (symbol: string) => {
    setLocalSelection(prev => {
      if (prev.includes(symbol)) {
        return prev.filter(s => s !== symbol)
      } else {
        return [...prev, symbol]
      }
    })
  }

  const handleSave = () => {
    props.onSave(localSelection())
    props.onClose()
  }

  const handleCancel = () => {
    setLocalSelection([...props.selectedCoins])
    props.onClose()
  }

  const handleOverlayClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleCancel()
    }
  }

  return (
    <Show when={props.isOpen}>
      <div class="settings-modal-overlay" onClick={handleOverlayClick}>
        <div class="settings-modal">
          <div class="settings-modal__header">
            <h2 class="settings-modal__title">Customize Dashboard</h2>
          </div>
          
          <div class="settings-modal__body">
            <div class="settings-modal__section">
              <h3 class="settings-modal__section-title">Featured Assets</h3>
              <p class="settings-modal__description">
                Toggle the assets you want to see in your charts.
              </p>
            
              <div class="settings-modal__list">
                <For each={AVAILABLE_COINS}>
                  {(coin) => (
                    <div class="settings-item">
                      <div class="settings-item__info">
                        <span class="settings-item__icon">{coin.icon}</span>
                        <span class="settings-item__name">{coin.name}</span>
                      </div>
                      <label class="mac-switch">
                        <input 
                          type="checkbox" 
                          checked={localSelection().includes(coin.symbol)}
                          onChange={() => toggleCoin(coin.symbol)}
                        />
                        <span class="mac-switch__slider"></span>
                      </label>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </div>
          
          <div class="settings-modal__footer">
            <button class="mac-btn mac-btn--secondary" onClick={handleCancel}>
              Cancel
            </button>
            <button 
              class="mac-btn mac-btn--primary" 
              onClick={handleSave}
              disabled={localSelection().length === 0}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </Show>
  )
}

export default SettingsModal
