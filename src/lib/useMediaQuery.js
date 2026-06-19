import { useState, useEffect } from 'react'

// Subscribe to a CSS media query. Initialises synchronously from matchMedia so the
// first paint is already correct (no flash) — safe because this is a client-only SPA.
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  )
  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])
  return matches
}

// The mobile redesign activates below `lg` (1024px) — the same breakpoint where the
// desktop sidebar appears. At/above it the original desktop layout renders unchanged.
export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)')
