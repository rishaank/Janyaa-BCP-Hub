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
    .select('id,name,date,location,address,notes,hours')
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

  for (const e of events ?? []) {
    const start = new Date(e.date + 'T00:00:00Z')
    const end = new Date(start)
    end.setUTCDate(end.getUTCDate() + 1)
    const desc = []
    if (e.hours) desc.push(`${e.hours} hrs each`)
    if (e.notes) desc.push(e.notes)
    desc.push('via the Janyaa BCP Hub')

    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${e.id}@janyaa-bcp-hub`)
    lines.push(`DTSTAMP:${stamp}`)
    lines.push(`DTSTART;VALUE=DATE:${ymd(start)}`)
    lines.push(`DTEND;VALUE=DATE:${ymd(end)}`)
    lines.push(fold(`SUMMARY:${esc(e.name)}`))
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
