import { useCallback, useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'

const KEY = 'infynix-theme'
const listeners = new Set<() => void>()

function stored(): Theme | null {
  try {
    const value = localStorage.getItem(KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null
  }
}

function system(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function currentTheme(): Theme {
  return stored() ?? system()
}

/** Puts the theme on <html>. Called before React renders to avoid a flash. */
export function applyTheme(theme: Theme = currentTheme()) {
  document.documentElement.dataset.theme = theme
}

function setTheme(theme: Theme) {
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    // Private mode: the choice lasts for this page only.
  }
  applyTheme(theme)
  listeners.forEach((l) => l())
}

// Follow the OS while the person hasn't picked a theme themselves.
window
  .matchMedia('(prefers-color-scheme: dark)')
  .addEventListener('change', () => {
    if (!stored()) {
      applyTheme()
      listeners.forEach((l) => l())
    }
  })

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, currentTheme)
  const toggle = useCallback(
    () => setTheme(currentTheme() === 'dark' ? 'light' : 'dark'),
    [],
  )
  return { theme, toggle }
}
