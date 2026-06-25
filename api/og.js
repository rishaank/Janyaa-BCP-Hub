// Open Graph prerender for the two public, shareable full-screen views
// (/events/:id and /meetings/:id). vercel.json rewrites those paths here so that
// link-unfurlers (iMessage, Slack, Discord, WhatsApp, …) — which fetch the URL
// but DON'T run our client-only SPA — get a title + description that reflect the
// actual event/meeting, instead of the generic static index.html tags.
//
// Humans are served the very same index.html (just with richer <head> tags), so
// the React app still boots and takes over normally; `useDocumentTitle` then sets
// the live tab title. If anything here fails we fall back to the untouched
// index.html — a share link must never break the page.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://sgjcliwmzshhkhjlbdjy.supabase.co'
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || ''

const SITE_NAME = 'Janyaa BCP Hub'

// Escape a value for safe interpolation into HTML attributes / text.
function esc(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

const fmtDate = (iso) =>
  iso
    ? new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
      })
    : ''

const fmtTime = (t) => {
  if (!t) return ''
  const [h, m] = t.split(':')
  return new Date(2000, 0, 1, Number(h), Number(m)).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit',
  })
}

const timeRange = (start, end) =>
  start ? (end ? `${fmtTime(start)}–${fmtTime(end)}` : fmtTime(start)) + ' PST' : ''

// Trim a free-text note to a tidy single-line preview fallback.
function clip(text, max = 160) {
  const one = String(text).replace(/\s+/g, ' ').trim()
  return one.length > max ? one.slice(0, max - 1).trimEnd() + '…' : one
}

// Call a public (anon) Supabase RPC over REST. Returns the parsed JSON or null.
async function rpc(name, id) {
  if (!SUPABASE_KEY) return null
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_id: id }),
    })
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  }
}

// Build { title, description } for the preview from the loaded record.
function previewFor(type, rec) {
  if (type === 'event') {
    const name = rec.name || 'Event'
    const bits = []
    if (rec.is_tentative) bits.push('Tentative')
    if (rec.date) bits.push(fmtDate(rec.date))
    else if (rec.is_tentative) bits.push('Date TBD')
    const tr = timeRange(rec.start_time, rec.end_time)
    if (tr) bits.push(tr)
    if (rec.location) bits.push(rec.location)
    const desc = bits.join(' · ') || (rec.notes ? clip(rec.notes) : 'An event with Janyaa BCP.')
    return { title: name, description: desc }
  }
  // meeting
  const title = rec.title || 'Meeting'
  const bits = []
  if (rec.canceled) bits.push('Canceled')
  if (rec.date) bits.push(fmtDate(rec.date))
  const tr = timeRange(rec.start_time, rec.end_time)
  if (tr) bits.push(tr)
  if (rec.location) bits.push(rec.location)
  const desc = bits.join(' · ') || (rec.notes ? clip(rec.notes) : 'A Janyaa BCP meeting.')
  return { title, description: desc }
}

export default async function handler(req, res) {
  const type = req.query.type === 'meeting' ? 'meeting' : 'event'
  const id = req.query.id || ''

  // Always start from the deployed index.html so humans get the full SPA.
  const proto = req.headers['x-forwarded-proto'] || 'https'
  const host = req.headers.host
  let html
  try {
    const r = await fetch(`${proto}://${host}/index.html`)
    html = await r.text()
  } catch {
    res.status(302).setHeader('Location', '/')
    return res.end()
  }

  const send = (body, cache) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', cache)
    res.status(200).send(body)
  }

  const rec = id ? await rpc(type === 'event' ? 'get_public_event' : 'get_public_meeting', id) : null
  // Unknown / removed record → serve the plain SPA (it shows its own "not found").
  if (!rec) return send(html, 'public, max-age=60')

  const { title, description } = previewFor(type, rec)
  const fullTitle = `${SITE_NAME} | ${title}`
  // Reconstruct the public share path (req.url here is the rewritten /api/og one).
  const url = `${proto}://${host}/${type === 'event' ? 'events' : 'meetings'}/${id}`
  const image = `${proto}://${host}/janyaa-logo.png`

  const tags = [
    `<meta name="description" content="${esc(description)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${esc(SITE_NAME)}" />`,
    `<meta property="og:title" content="${esc(fullTitle)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:image" content="${esc(image)}" />`,
    `<meta name="twitter:card" content="summary" />`,
    `<meta name="twitter:title" content="${esc(fullTitle)}" />`,
    `<meta name="twitter:description" content="${esc(description)}" />`,
    `<meta name="twitter:image" content="${esc(image)}" />`,
  ].join('\n    ')

  const out = html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(fullTitle)}</title>`)
    .replace('</head>', `    ${tags}\n  </head>`)

  send(out, 'public, max-age=300, s-maxage=600')
}
