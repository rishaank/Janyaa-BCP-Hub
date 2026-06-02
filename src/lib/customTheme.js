// Per-user custom image theme: an uploaded background image + a palette
// (auto-extracted from the image, every colour overridable) applied as inline CSS
// variable overrides on <html>. Stored per browser in localStorage, like the
// light/dark theme. Inline overrides beat the stylesheet, so this wins over
// whatever light/dark tokens are active; removing it falls back cleanly.

const KEY = 'janyaa-custom-theme'

export function loadCustomTheme() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null')
    return raw && raw.image ? raw : null
  } catch {
    return null
  }
}

export function storeCustomTheme(cfg) {
  try {
    if (cfg && cfg.image) localStorage.setItem(KEY, JSON.stringify(cfg))
    else localStorage.removeItem(KEY)
  } catch {
    /* quota — ignore */
  }
}

// Downscale + JPEG-compress a picked file to a data URL small enough for localStorage.
export function fileToThemeImage(file, maxW = 1600, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width)
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const c = document.createElement('canvas')
        c.width = w
        c.height = h
        c.getContext('2d').drawImage(img, 0, 0, w, h)
        resolve(c.toDataURL('image/jpeg', quality))
      }
      img.onerror = reject
      img.src = reader.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

const toHex = (r, g, b) => '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')

// Average luminance (→ light/dark base) + most vibrant mid-bright colour (→ accent).
export function analyzeImage(dataUrl) {
  return new Promise((resolve) => {
    const fallback = { base: 'light', accent: '#2a943b', surface: '#ffffff', text: '#1c1917' }
    const img = new Image()
    img.onload = () => {
      const w = 64
      const h = Math.max(1, Math.round((64 * img.height) / img.width))
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      const ctx = c.getContext('2d')
      ctx.drawImage(img, 0, 0, w, h)
      const { data } = ctx.getImageData(0, 0, w, h)
      let r = 0, g = 0, b = 0, n = 0
      let best = { score: -1, hex: '#2a943b' }
      for (let i = 0; i < data.length; i += 4) {
        const R = data[i], G = data[i + 1], B = data[i + 2], A = data[i + 3]
        if (A < 128) continue
        r += R; g += G; b += B; n++
        const max = Math.max(R, G, B), min = Math.min(R, G, B)
        const sat = max === 0 ? 0 : (max - min) / max
        const lum = (0.299 * R + 0.587 * G + 0.114 * B) / 255
        const score = sat * (1 - Math.abs(lum - 0.55)) // vibrant + mid-bright
        if (score > best.score) best = { score, hex: toHex(R, G, B) }
      }
      if (!n) return resolve(fallback)
      const avgLum = (0.299 * (r / n) + 0.587 * (g / n) + 0.114 * (b / n)) / 255
      const base = avgLum < 0.5 ? 'dark' : 'light'
      resolve({
        base,
        accent: best.hex,
        surface: base === 'dark' ? '#1f2024' : '#ffffff',
        text: base === 'dark' ? '#f4f4f3' : '#1c1917',
      })
    }
    img.onerror = () => resolve(fallback)
    img.src = dataUrl
  })
}

// ink ramp steps: [css var, % of text mixed toward surface]
const INK = [
  ['--color-ink-900', 100], ['--color-ink-800', 92], ['--color-ink-700', 82],
  ['--color-ink-600', 70], ['--color-ink-500', 58], ['--color-ink-400', 46],
  ['--color-ink-300', 34], ['--color-ink-200', 22], ['--color-ink-150', 16],
  ['--color-ink-100', 12], ['--color-ink-50', 7],
]
const ALL_VARS = [
  '--ja-bg-image', '--ja-veil', '--color-paper', '--color-surface',
  ...INK.map((x) => x[0]),
  '--color-green-500', '--color-green-600', '--color-green-700',
  '--color-blue-50', '--color-blue-600', '--color-blue-700',
]

export function applyCustomTheme(cfg) {
  const root = document.documentElement
  if (!cfg || !cfg.image) {
    ALL_VARS.forEach((v) => root.style.removeProperty(v))
    root.style.removeProperty('color-scheme')
    root.removeAttribute('data-custom-theme')
    return
  }
  const dark = cfg.base === 'dark'
  const surface = cfg.surface || (dark ? '#1f2024' : '#ffffff')
  const text = cfg.text || (dark ? '#f4f4f3' : '#1c1917')
  const accent = cfg.accent || '#2a943b'
  const mix = (p) => `color-mix(in srgb, ${text} ${p}%, ${surface})`
  const s = root.style
  s.setProperty('--ja-bg-image', `url("${cfg.image}")`)
  s.setProperty('--ja-veil', dark ? 'rgba(8,8,11,0.5)' : 'rgba(255,255,255,0.42)')
  s.setProperty('--color-paper', 'transparent')
  s.setProperty('--color-surface', surface)
  for (const [v, p] of INK) s.setProperty(v, p === 100 ? text : mix(p))
  s.setProperty('--color-green-500', accent)
  s.setProperty('--color-green-600', accent)
  s.setProperty('--color-green-700', accent)
  s.setProperty('--color-blue-600', accent)
  s.setProperty('--color-blue-700', accent)
  s.setProperty('--color-blue-50', `color-mix(in srgb, ${accent} 16%, ${surface})`)
  s.colorScheme = dark ? 'dark' : 'light'
  root.setAttribute('data-custom-theme', 'on')
}
