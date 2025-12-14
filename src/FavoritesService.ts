/**
 * FavoritesService - Cookie-based favorites persistence
 * Stores user's favorite trading pairs for quick access
 */

const COOKIE_NAME = 'klinecharts_favorites'
const COOKIE_EXPIRY_DAYS = 365

/**
 * Set a cookie with the given name, value, and expiry days
 */
function setCookie(name: string, value: string, days: number): void {
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires};path=/;SameSite=Lax`
}

/**
 * Get a cookie value by name
 */
function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
  return match ? decodeURIComponent(match[2]) : null
}

/**
 * Get the list of favorite ticker symbols
 */
export function getFavorites(): string[] {
  const raw = getCookie(COOKIE_NAME)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * Save favorites to cookie
 */
function saveFavorites(favorites: string[]): void {
  setCookie(COOKIE_NAME, JSON.stringify(favorites), COOKIE_EXPIRY_DAYS)
}

/**
 * Add a ticker to favorites
 */
export function addFavorite(ticker: string): void {
  const favorites = getFavorites()
  if (!favorites.includes(ticker)) {
    favorites.unshift(ticker) // Add to beginning for recent-first ordering
    saveFavorites(favorites)
  }
}

/**
 * Remove a ticker from favorites
 */
export function removeFavorite(ticker: string): void {
  const favorites = getFavorites()
  const index = favorites.indexOf(ticker)
  if (index > -1) {
    favorites.splice(index, 1)
    saveFavorites(favorites)
  }
}

/**
 * Check if a ticker is in favorites
 */
export function isFavorite(ticker: string): boolean {
  return getFavorites().includes(ticker)
}

/**
 * Toggle a ticker's favorite status
 * Returns the new favorite state
 */
export function toggleFavorite(ticker: string): boolean {
  if (isFavorite(ticker)) {
    removeFavorite(ticker)
    return false
  } else {
    addFavorite(ticker)
    return true
  }
}
