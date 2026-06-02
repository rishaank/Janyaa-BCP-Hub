// Supabase Edge Function: calendar
// Serves all Janyaa events as an iCalendar (.ics) feed. Personal calendars
// (Google / Apple / Outlook) subscribe to this URL and re-poll it, so the
// club's events stay in sync automatically. Public (verify_jwt = false) and
// reads via the service role so it works without a user session.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const pad = (n: number) => String(n).padStart(2, '0')

// Escape per RFC 5545.
const esc = (s: string) =>
  (s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

// Fold lines longer than 75 octets.
function fold(line: string) {
  if (line.length <= 74) return line
  const out = [line.slice(0, 74)]
  let rest = line.slice(74)
  while (rest.length > 73) {
    out.push(' ' + rest.slice(0, 73))
    rest = rest.slice(73)
  }
  out.push(' ' + rest)
  return out.join('\r\n')
}

const ymd = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
  const { data: events } = await supabase
    .from('events')
    .select('id,name,date,location,address,notes,hours,start_time,end_time,is_tentative')
    .order('date')

  const now = new Date()
  const stamp = `${ymd(now)}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Janyaa BCP Hub//Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Janyaa BCP Events',
    'X-WR-TIMEZONE:America/Los_Angeles',
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
    'X-PUBLISHED-TTL:PT6H',
  ]

  // Timezone definition so timed events render in America/Los_Angeles everywhere.
  lines.push(
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
  )

  for (const e of events ?? []) {
    if (!e.date) continue // tentative event with an undecided date — skip the feed

    const desc = []
    if (e.hours) desc.push(`${e.hours} hrs each`)
    if (e.notes) desc.push(e.notes)
    if (e.is_tentative) desc.push('Tentative — not yet confirmed.')
    desc.push('via the Janyaa BCP Hub')

    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${e.id}@janyaa-bcp-hub`)
    lines.push(`DTSTAMP:${stamp}`)
    lines.push(`STATUS:${e.is_tentative ? 'TENTATIVE' : 'CONFIRMED'}`)
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
    lines.push(fold(`SUMMARY:${esc((e.is_tentative ? '[Tentative] ' : '') + e.name)}`))
    if (e.address || e.location) lines.push(fold(`LOCATION:${esc(e.address || e.location)}`))
    lines.push(fold(`DESCRIPTION:${esc(desc.join('\n'))}`))
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')

  return new Response(lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="janyaa-events.ics"',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  })
})
