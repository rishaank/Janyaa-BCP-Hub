import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Card } from './ui'

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const TODAY = new Date().toISOString().slice(0, 10)
const ymd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// Month-grid calendar of events AND meetings, color-coded (green = event, blue =
// meeting, gold = tentative). Click an item to open it. Pairs with the list view
// on the Events & Meetings page — the calendar always shows both at once.
export default function EventsCalendar({ events = [], meetings = [], onSelectEvent, onSelectMeeting }) {
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })

  // Merge events + meetings into one per-day bucket of normalized items.
  const byDate = {}
  for (const e of events) {
    if (!e.date) continue
    ;(byDate[e.date] ??= []).push({ kind: 'event', id: e.id, date: e.date, label: e.name, tentative: e.is_tentative, raw: e })
  }
  for (const m of meetings) {
    if (!m.date) continue
    ;(byDate[m.date] ??= []).push({ kind: 'meeting', id: m.id, date: m.date, label: m.title, canceled: m.canceled, raw: m })
  }

  // Grid: back up to the Sunday on/before the 1st, then 6 weeks (42 cells).
  const start = new Date(month)
  start.setDate(1 - month.getDay())
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })

  const go = (delta) => setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1))
  const monthLabel = month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  function toneFor(item) {
    const past = item.date < TODAY
    if (item.kind === 'meeting') {
      if (item.canceled) return 'bg-ink-100 text-ink-400 line-through hover:bg-ink-200'
      return past ? 'bg-blue-50 text-blue-600 hover:bg-blue-100' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
    }
    if (item.tentative) return 'bg-gold-100 text-gold-800 hover:bg-gold-200'
    return past ? 'bg-ink-100 text-ink-600 hover:bg-ink-200' : 'bg-green-100 text-green-700 hover:bg-green-200'
  }
  function select(item) {
    if (item.kind === 'meeting') onSelectMeeting?.(item.raw)
    else onSelectEvent?.(item.raw)
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-y-2">
        <h2 className="font-display text-h4 font-semibold text-ink-900">{monthLabel}</h2>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2.5 sm:flex">
            <Legend dot="bg-green-500" label="Event" />
            <Legend dot="bg-blue-500" label="Meeting" />
            <Legend dot="bg-gold-400" label="Tentative" />
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => go(-1)} className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100" aria-label="Previous month">
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}
              className="rounded-lg px-2.5 py-1 text-xs font-medium text-ink-600 hover:bg-ink-100"
            >
              Today
            </button>
            <button onClick={() => go(1)} className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100" aria-label="Next month">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {DOW.map((d) => (
          <div key={d} className="pb-1 text-center font-mono text-2xs font-semibold uppercase tracking-wide text-ink-400">
            {d}
          </div>
        ))}
        {days.map((d) => {
          const key = ymd(d)
          const inMonth = d.getMonth() === month.getMonth()
          const isToday = key === TODAY
          const items = byDate[key] ?? []
          return (
            <div
              key={key}
              className={`min-h-[86px] rounded-lg border p-1 ${
                inMonth ? 'border-ink-150 bg-surface' : 'border-transparent bg-ink-50/50'
              }`}
            >
              <div className={`mb-1 flex justify-end text-xs ${inMonth ? 'text-ink-500' : 'text-ink-300'}`}>
                {isToday ? (
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-green-600 text-[11px] font-bold text-white">
                    {d.getDate()}
                  </span>
                ) : (
                  <span className="px-1">{d.getDate()}</span>
                )}
              </div>
              <div className="space-y-0.5">
                {items.slice(0, 3).map((it) => (
                  <button
                    key={`${it.kind}-${it.id}`}
                    onClick={() => select(it)}
                    title={it.kind === 'meeting' ? `${it.label} (meeting)` : it.tentative ? `${it.label} (tentative)` : it.label}
                    className={`block w-full truncate rounded px-1.5 py-0.5 text-left text-2xs font-medium transition-colors ${toneFor(it)}`}
                  >
                    {it.kind === 'event' && it.tentative ? '~ ' : ''}{it.label}
                  </button>
                ))}
                {items.length > 3 && (
                  <p className="px-1 text-2xs text-ink-400">+{items.length - 3} more</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function Legend({ dot, label }) {
  return (
    <span className="flex items-center gap-1 text-2xs font-medium text-ink-500">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {label}
    </span>
  )
}
