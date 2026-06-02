import { createContext, useContext, useEffect, useState } from 'react'

// 'light' | 'dark' | 'system'. Default 'system' follows the OS setting.
const ThemeContext = createContext(null)
const KEY = 'janyaa-theme'

function prefersDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

// Apply the resolved theme to <html data-theme>. The dark token overrides in
// index.css key off this attribute.
function apply(theme) {
  const dark = theme === 'dark' || (theme === 'system' && prefersDark())
  const el = document.documentElement
  if (dark) el.setAttribute('data-theme', 'dark')
  else el.removeAttribute('data-theme')
  return dark
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => localStorage.getItem(KEY) || 'system')
  const [isDark, setIsDark] = useState(() => {
    const t = localStorage.getItem(KEY) || 'system'
    return t === 'dark' || (t === 'system' && prefersDark())
  })

  useEffect(() => {
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

  return <ThemeContext.Provider value={{ theme, setTheme, isDark }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>')
  return ctx
}
