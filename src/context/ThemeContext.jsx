import { createContext, useContext, useLayoutEffect, useEffect, useState } from 'react'
import { applyCustomTheme, loadCustomTheme } from '../lib/customTheme'

// 'light' | 'dark' | 'system' | 'custom'. Default 'system' follows the OS setting;
// 'custom' applies the saved per-user image theme.
const ThemeContext = createContext(null)
const KEY = 'janyaa-theme'

function prefersDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

// Apply the resolved theme to the document. 'custom' applies the saved image theme
// (falling back to system if none exists yet). Returns whether the result is dark
// (so the map can pick a matching basemap).
function apply(theme) {
  const el = document.documentElement
  if (theme === 'custom') {
    const cfg = loadCustomTheme()
    if (cfg) {
      applyCustomTheme(cfg)
      const dark = cfg.base === 'dark'
      if (dark) el.setAttribute('data-theme', 'dark')
      else el.removeAttribute('data-theme')
      return dark
    }
    theme = 'system' // no image set yet
  }
  applyCustomTheme(null) // clear any custom overrides
  const dark = theme === 'dark' || (theme === 'system' && prefersDark())
  if (dark) el.setAttribute('data-theme', 'dark')
  else el.removeAttribute('data-theme')
  return dark
}

function resolveDark(theme) {
  if (theme === 'custom') {
    const cfg = loadCustomTheme()
    if (cfg) return cfg.base === 'dark'
  }
  return theme === 'dark' || ((theme === 'system' || theme === 'custom') && prefersDark())
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => localStorage.getItem(KEY) || 'system')
  const [isDark, setIsDark] = useState(() => resolveDark(localStorage.getItem(KEY) || 'system'))

  // useLayoutEffect so the theme is applied before paint (no flash).
  useLayoutEffect(() => {
    setIsDark(apply(theme))
  }, [theme])

  // When following the system, re-apply if the OS preference changes live.
  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setIsDark(apply('system'))
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])

  const setTheme = (t) => {
    localStorage.setItem(KEY, t)
    setThemeState(t)
  }
  // Re-apply the active theme — used to revert a custom-theme live preview.
  const reapply = () => setIsDark(apply(theme))

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDark, reapply }}>{children}</ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>')
  return ctx
}
