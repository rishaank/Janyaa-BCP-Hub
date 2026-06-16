// Supabase Edge Function: calendar
// Serves all Janyaa events AND club meetings as one iCalendar (.ics) feed.
// Personal calendars (Google / Apple / Outlook) subscribe to this URL and
// re-poll it, so the club's schedule stays in sync automatically. Public
// (verify_jwt = false) and reads via the service role so it works without a
// user session.
//
// Reliability: a DB hiccup still returns a valid (possibly empty) calendar
// instead of a 500 that would make subscribers drop the feed; lines are folded
// on UTF-8 byte boundaries per RFC 5545; every entry has a stable UID +
// LAST-MODIFIED so clients reconcile edits instead of duplicating.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const pad = (n: number) => String(n).padStart(2, '0')

// Escape per RFC 5545 (text values).
const esc = (s: string) =>
  (s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

// Fold lines to ≤75 octets, never splitting a UTF-8 multibyte sequence.
const ENC = new TextEncoder()
const DEC = new TextDecoder()
function fold(line: string) {
  const bytes = ENC.encode(line)
  if (bytes.length <= 75) return line
  const chunks: Uint8Array[] = []
  let i = 0
  let limit = 75 // first line: 75 octets; continuations: 74 + a leading space
  while (i < bytes.length) {
    let end = Math.min(i + limit, bytes.length)
    if (end < bytes.length) {
      // Back up off any continuation byte so we cut on a char boundary.
      while (end > i && (bytes[end] & 0b1100_0000) === 0b1000_0000) end--
    }
    chunks.push(bytes.slice(i, end))
    i = end
    limit = 74
  }
  return chunks.map((c, idx) => (idx === 0 ? '' : ' ') + DEC.decode(c)).join('\r\n')
}

const ymd = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`
const utcStamp = (d: Date) =>
  `${ymd(d)}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`

// "2026-06-07" + "15:00:00" → "20260607T150000" (local wall-clock, paired with a TZID).
const localDT = (date: string, time: string) =>
  `${date.replace(/-/g, '')}T${time.replace(/:/g, '').padEnd(6, '0').slice(0, 6)}`

// Add whole hours to a wall-clock time → "HHMMSS". Used to derive an end time when
// only a start was given. Crossing midnight is ignored (club events don't).
function addHoursHMS(time: string, hrs: number) {
  const [h, m] = time.split(':').map(Number)
  const d = new Date(Date.UTC(2000, 0, 1, h, m))
  d.setUTCHours(d.getUTCHours() + Math.max(1, Math.ceil(hrs)))
  return `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00`
}

type Entry = {
  uid: string
  date: string
  start_time?: string | null
  end_time?: string | null
  hours?: number | null
  summary: string
  location?: string | null
  description: string
  tentative?: boolean
  category: 'Event' | 'Meeting'
  lastModified?: string | null
}

// One VEVENT block. Shared by events and meetings.
function vevent(e: Entry, stamp: string): string[] {
  const lines = ['BEGIN:VEVENT', `UID:${e.uid}`, `DTSTAMP:${stamp}`]
  if (e.lastModified) {
    const d = new Date(e.lastModified)
    if (!isNaN(d.getTime())) lines.push(`LAST-MODIFIED:${utcStamp(d)}`)
  }
  lines.push(`STATUS:${e.tentative ? 'TENTATIVE' : 'CONFIRMED'}`)
  if (e.start_time) {
    const endHMS = e.end_time
      ? e.end_time.replace(/:/g, '').padEnd(6, '0').slice(0, 6)
      : addHoursHMS(e.start_time, Number(e.hours) || 1)
    lines.push(`DTSTART;TZID=America/Los_Angeles:${localDT(e.date, e.start_time)}`)
    lines.push(`DTEND;TZID=America/Los_Angeles:${e.date.replace(/-/g, '')}T${endHMS}`)
  } else {
    const start = new Date(e.date + 'T00:00:00Z')
    const end = new Date(start)
    end.setUTCDate(end.getUTCDate() + 1)
    lines.push(`DTSTART;VALUE=DATE:${ymd(start)}`)
    lines.push(`DTEND;VALUE=DATE:${ymd(end)}`)
  }
  lines.push(fold(`SUMMARY:${esc((e.tentative ? '[Tentative] ' : '') + e.summary)}`))
  if (e.location) lines.push(fold(`LOCATION:${esc(e.location)}`))
  lines.push(fold(`DESCRIPTION:${esc(e.description)}`))
  lines.push(`CATEGORIES:${e.category}`)
  lines.push('END:VEVENT')
  return lines
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } })
  }

  const entries: Entry[] = []
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const [{ data: events }, { data: meetings }] = await Promise.all([
      supabase
        .from('events')
        .select('id,name,date,location,address,notes,hours,start_time,end_time,is_tentative,created_at')
        .order('date'),
      supabase
        .from('meetings')
        .select('id,title,date,location,notes,start_time,end_time,canceled,created_at')
        .order('date'),
    ])

    for (const e of events ?? []) {
      if (!e.date) continue // tentative event with no date yet — can't place it on a calendar
      const desc: string[] = []
      if (e.hours) desc.push(`${e.hours} hrs each`)
      if (e.notes) desc.push(e.notes)
      if (e.is_tentative) desc.push('Tentative — not yet confirmed.')
      desc.push('via the Janyaa BCP Hub')
      entries.push({
        uid: `${e.id}@janyaa-bcp-hub`,
        date: e.date,
        start_time: e.start_time,
        end_time: e.end_time,
        hours: e.hours,
        summary: e.name,
        location: e.address || e.location,
        description: desc.join('\n'),
        tentative: e.is_tentative,
        category: 'Event',
        lastModified: e.created_at,
      })
    }

    for (const m of meetings ?? []) {
      if (!m.date || m.canceled) continue // cancelled occurrences stay out of the feed
      const desc: string[] = []
      if (m.notes) desc.push(m.notes)
      desc.push('Club meeting · via the Janyaa BCP Hub')
      entries.push({
        uid: `meeting-${m.id}@janyaa-bcp-hub`,
        date: m.date,
        start_time: m.start_time,
        end_time: m.end_time,
        hours: 1,
        summary: m.title || 'Club meeting',
        location: m.location,
        description: desc.join('\n'),
        category: 'Meeting',
        lastModified: m.created_at,
      })
    }
  } catch (_err) {
    // Fall through with whatever we have — an empty but valid calendar keeps
    // subscribers connected rather than dropping a feed that 500s.
  }

  const stamp = utcStamp(new Date())

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Janyaa BCP Hub//Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Janyaa BCP',
    'X-WR-CALDESC:Janyaa BCP events and club meetings',
    'X-WR-TIMEZONE:America/Los_Angeles',
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
    'X-PUBLISHED-TTL:PT6H',
    // Timezone definition so timed entries render in America/Los_Angeles everywhere.
    'BEGIN:VTIMEZONE',
    'TZID:America/Los_Angeles',
    'X-LIC-LOCATION:America/Los_Angeles',
    'BEGIN:DAYLIGHT',
    'TZOFFSETFROM:-0800',
    'TZOFFSETTO:-0700',
    'TZNAME:PDT',
    'DTSTART:19700308T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
    'END:DAYLIGHT',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:-0700',
    'TZOFFSETTO:-0800',
    'TZNAME:PST',
    'DTSTART:19701101T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
    'END:STANDARD',
    'END:VTIMEZONE',
  ]

  for (const e of entries) lines.push(...vevent(e, stamp))
  lines.push('END:VCALENDAR')

  return new Response(lines.join('\r\n') + '\r\n', {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="janyaa.ics"',
      'Access-Control-Allow-Origin': '*',
      // Short edge cache; clients honor REFRESH-INTERVAL for re-polling.
      'Cache-Control': 'public, max-age=900',
    },
  })
})
