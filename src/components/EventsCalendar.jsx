import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Card } from './ui'

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const TODAY = new Date().toISOString().slice(0, 10)
const ymd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// Month-grid calendar of events. Click an event to open it (onSelect). Pairs with
// the list view on the Events page via the List/Calendar toggle.
export default function EventsCalendar({ events, onSelect }) {
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })

  const byDate = {}
  for (const e of events) (byDate[e.date] ??= []).push(e)

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

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-h4 font-semibold text-ink-900">{monthLabel}</h2>
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
          const dayEvents = byDate[key] ?? []
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
                {dayEvents.slice(0, 3).map((e) => {
                  const past = e.date < TODAY
                  return (
                    <button
                      key={e.id}
                      onClick={() => onSelect(e)}
                      title={e.name}
                      className={`block w-full truncate rounded px-1.5 py-0.5 text-left text-2xs font-medium transition-colors ${
                        past
                          ? 'bg-ink-100 text-ink-600 hover:bg-ink-200'
                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      {e.name}
                    </button>
                  )
                })}
                {dayEvents.length > 3 && (
                  <p className="px-1 text-2xs text-ink-400">+{dayEvents.length - 3} more</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
