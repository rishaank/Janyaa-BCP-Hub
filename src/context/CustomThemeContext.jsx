import { createContext, useContext, useEffect, useState } from 'react'
import { loadCustomTheme, storeCustomTheme, applyCustomTheme } from '../lib/customTheme'

const CustomThemeContext = createContext(null)

// Holds the saved custom image theme (or null) and applies it. `preview` applies a
// draft live without saving; `restore` snaps back to the saved theme.
export function CustomThemeProvider({ children }) {
  const [config, setConfigState] = useState(() => loadCustomTheme())

  useEffect(() => {
    applyCustomTheme(config)
  }, [config])

  const setConfig = (cfg) => {
    storeCustomTheme(cfg)
    setConfigState(cfg)
  }

  const value = {
    config,
    setConfig,
    remove: () => setConfig(null),
    preview: (cfg) => applyCustomTheme(cfg),
    restore: () => applyCustomTheme(config),
  }

  return <CustomThemeContext.Provider value={value}>{children}</CustomThemeContext.Provider>
}

export function useCustomTheme() {
  const ctx = useContext(CustomThemeContext)
  if (!ctx) throw new Error('useCustomTheme must be used inside <CustomThemeProvider>')
  return ctx
}
