// Lightweight, instant (no-AI) analytics that help plan events from real history.

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const today = () => new Date().toISOString().slice(0, 10)

// Average $ raised + crew per weekday, from PAST events. Indexed Sun..Sat.
export function bestDays(events = []) {
  const acc = DAYS.map((day) => ({ day, raised: 0, crew: 0, count: 0 }))
  for (const e of events) {
    if (!e.date || e.date >= today()) continue
    const i = new Date(e.date + 'T00:00:00').getDay()
    acc[i].raised += Number(e.raised) || 0
    acc[i].crew += e.event_signups?.length || 0
    acc[i].count += 1
  }
  return acc.map((a) => ({
    day: a.day,
    avgRaised: a.count ? Math.round(a.raised / a.count) : 0,
    avgCrew: a.count ? Math.round((a.crew / a.count) * 10) / 10 : 0,
    count: a.count,
  }))
}

// The weekday that has raised the most on average.
export function topDay(days) {
  return [...days].filter((d) => d.count > 0).sort((a, b) => b.avgRaised - a.avgRaised)[0] || null
}

// Match past events to saved locations by name and total their $ raised + count.
// Returns { [locationId]: { raised, count } }.
export function locationPerformance(events = [], locations = []) {
  const perf = {}
  for (const loc of locations) {
    const name = (loc.name || '').toLowerCase().split(',')[0].trim()
    let raised = 0
    let count = 0
    if (name.length > 3) {
      for (const e of events) {
        if (!e.date || e.date >= today()) continue
        const hay = `${e.location || ''} ${e.address || ''}`.toLowerCase()
        if (hay.includes(name)) {
          raised += Number(e.raised) || 0
          count += 1
        }
      }
    }
    perf[loc.id] = { raised, count }
  }
  return perf
}
