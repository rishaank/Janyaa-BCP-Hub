// Shared URL helpers: auto-hyperlinking + site favicon/name recognition.

// Matches http(s):// URLs and bare www. URLs. Global for split(); test with a
// fresh non-global RegExp to avoid lastIndex statefulness.
export const URL_RE = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi
const SINGLE_URL_RE = /^(https?:\/\/[^\s<]+|www\.[^\s<]+)$/i

export function isUrl(s) {
  return SINGLE_URL_RE.test(s || '')
}

// Trailing punctuation that's almost never part of a real link.
const TRAILING = /[.,;:!?)\]}'"]+$/

// Split a URL token into the real href and any trailing punctuation to keep
// as plain text (so "see foo.com." doesn't swallow the period).
export function splitTrailing(token) {
  let url = token
  let trail = ''
  const m = url.match(TRAILING)
  if (m) {
    // keep a closing paren if the URL also contains an opening one (e.g. wiki links)
    trail = m[0]
    url = url.slice(0, url.length - trail.length)
  }
  return { url, trail }
}

export function hrefFor(url) {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

// Friendly names for sites we link a lot; otherwise fall back to the host.
const SITE_NAMES = {
  'instagram.com': 'Instagram',
  'docs.google.com': 'Google Docs',
  'drive.google.com': 'Google Drive',
  'sheets.google.com': 'Google Sheets',
  'slides.google.com': 'Google Slides',
  'forms.google.com': 'Google Forms',
  'meet.google.com': 'Google Meet',
  'calendar.google.com': 'Google Calendar',
  'youtube.com': 'YouTube',
  'youtu.be': 'YouTube',
  'zoom.us': 'Zoom',
  'github.com': 'GitHub',
  'figma.com': 'Figma',
  'notion.so': 'Notion',
  'canva.com': 'Canva',
  'discord.com': 'Discord',
  'discord.gg': 'Discord',
  'gofundme.com': 'GoFundMe',
  'linktr.ee': 'Linktree',
  'maps.google.com': 'Google Maps',
}

// Parse a URL into { href, host, name, favicon } for chips/previews. Recognizes
// the site and supplies its favicon via Google's favicon service.
export function linkMeta(raw) {
  const href = hrefFor((raw || '').trim())
  let host = ''
  try {
    host = new URL(href).hostname.replace(/^www\./, '')
  } catch {
    host = (raw || '').replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
  }
  // google docs/forms etc. live under docs.google.com — map by the leading host,
  // then by the registrable domain (last two labels) as a fallback.
  const domain = host.split('.').slice(-2).join('.')
  const name = SITE_NAMES[host] || SITE_NAMES[domain] || host
  const favicon = host ? `https://www.google.com/s2/favicons?domain=${host}&sz=64` : null
  return { href, host, name, favicon }
}
