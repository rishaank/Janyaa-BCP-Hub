import { useEffect, useState } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts'
import {
  DollarSign,
  TrendingUp,
  Calendar,
  Target,
  Sparkles,
  ExternalLink,
  RefreshCw,
  Loader2,
  Pencil,
  Check,
} from 'lucide-react'
import { PageHeader, Card, StatCard, Button, Skeleton, formatDate, timeAgo } from '../components/ui'
import {
  getFundraisingEvents, getSettings, updateRaiseTarget, syncGoFundme, autoGenerateInsights,
  currentTermStart, getCurrentTermStart,
} from '../lib/api'
import { useRealtime } from '../lib/useRealtime'
import BestDaysChart from '../components/BestDaysChart'
import { bestDays, topDay } from '../lib/planning'

const DAY = 86400000
const ts = (iso) => new Date(iso + 'T00:00:00').getTime()
const shortLabel = (iso) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: '2-digit' })

// Least-squares slope/intercept for points (x days, y dollars).
function linearFit(xs, ys) {
  const n = xs.length
  const sx = xs.reduce((a, b) => a + b, 0)
  const sy = ys.reduce((a, b) => a + b, 0)
  const sxy = xs.reduce((a, x, i) => a + x * ys[i], 0)
  const sxx = xs.reduce((a, x) => a + x * x, 0)
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx || 1)
  const intercept = (sy - slope * sx) / n
  return { slope, intercept }
}

// Themed chart tooltip — uses brand tokens so it adapts to light/dark instead of
// the default white box. Shows the date + the single relevant dollar value.
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const pt = payload.find((p) => p.value != null)
  if (!pt) return null
  return (
    <div className="rounded-xl border border-ink-200 bg-surface px-3 py-2 shadow-lg">
      <p className="text-xs font-semibold text-ink-900">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-green-700">${Number(pt.value).toLocaleString()}</p>
    </div>
  )
}

export default function Fundraising() {
  const [events, setEvents] = useState([])
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  // Seasonal mirror as the instant value; the terms-table-aware RPC corrects it.
  const [termStart, setTermStart] = useState(currentTermStart())

  const loadSettings = () => getSettings().then(setSettings)

  useEffect(() => {
    getCurrentTermStart().then(setTermStart)
    getFundraisingEvents().then((data) => {
      setEvents(data)
      setLoading(false)
    })
    // Sync GoFundMe; if the amount actually changed, refresh AI insights (throttled).
    ;(async () => {
      const before = await getSettings()
      setSettings(before)
      const { error } = await syncGoFundme()
      if (error) return
      const after = await getSettings()
      setSettings(after)
      if (before && after && Number(before.gofundme_raised) !== Number(after.gofundme_raised)) {
        autoGenerateInsights()
      }
    })()
  }, [])
  useRealtime(['club_settings', 'events'], () => {
    loadSettings()
    getFundraisingEvents().then(setEvents)
  })

  async function handleSync() {
    setSyncing(true)
    const { error } = await syncGoFundme()
    if (!error) await loadSettings()
    setSyncing(false)
  }

  const target = Number(settings?.raise_target ?? 500)
  const gfmRaised = settings?.gofundme_raised != null ? Number(settings.gofundme_raised) : null
  const pctFunded = target > 0 && gfmRaised != null ? Math.round((gfmRaised / target) * 100) : 0
  const bestDay = topDay(bestDays(events))

  // Cumulative running total of in-person events over time.
  let cum = 0
  const history = events.map((e) => {
    cum += Number(e.raised)
    return { date: e.date, label: shortLabel(e.date), value: cum }
  })
  const total = cum
  const thisTerm = events.filter((e) => e.date >= termStart).reduce((s, e) => s + Number(e.raised), 0)
  const avg = events.length ? Math.round(total / events.length) : 0
  const thisYear = new Date().getFullYear()

  // ---- Projection: fit a trend line and extend it. ----
  let chartData = history.map((h) => ({ label: h.label, actual: h.value, projected: null }))
  let perMonth = 0
  let projectedYearEnd = total
  const canProject = history.length >= 2

  if (canProject) {
    const first = ts(history[0].date)
    const xs = history.map((h) => (ts(h.date) - first) / DAY)
    const ys = history.map((h) => h.value)
    const { slope } = linearFit(xs, ys)
    perMonth = Math.round(slope * 30)

    const last = history[history.length - 1]
    const lastTs = ts(last.date)
    chartData[chartData.length - 1].projected = last.value
    for (const d of [30, 60, 90]) {
      const iso = new Date(lastTs + d * DAY).toISOString().slice(0, 10)
      chartData.push({ label: shortLabel(iso), actual: null, projected: Math.round(last.value + slope * d) })
    }
    projectedYearEnd = Math.round(last.value + slope * ((ts(`${thisYear}-12-31`) - lastTs) / DAY))
  }

  return (
    <>
      <PageHeader title="Fundraising" subtitle="Live GoFundMe total, the shared goal, and in-person events over time." />

      {/* GoFundMe live hero + editable shared goal */}
      <Card className="mb-6 overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-gold-100 bg-gradient-to-r from-gold-50 to-green-50 px-6 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-green-700">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
            </span>
            GoFundMe campaign · live
            {settings?.gofundme_url && (
              <a
                href={settings.gofundme_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-medium text-green-600/70 hover:text-green-700"
              >
                view <ExternalLink size={12} />
              </a>
            )}
          </div>
          <Button variant="soft" icon={syncing ? Loader2 : RefreshCw} loading={syncing} onClick={handleSync} disabled={syncing}>
            {syncing ? 'Syncing…' : 'Sync now'}
          </Button>
        </div>

        <div className="p-6">
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
            <div>
              <p className="text-sm font-medium text-ink-500">Raised so far</p>
              <p className="mt-0.5 font-display text-5xl font-bold tracking-tight tabular-nums text-green-700">
                {gfmRaised != null ? `$${gfmRaised.toLocaleString()}` : '—'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-ink-500">Shared goal</p>
              <div className="mt-0.5 text-2xl font-bold text-ink-900">
                <EditableGoal target={target} editable={!!settings} onSaved={loadSettings} />
              </div>
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-ink-500">
              <span>{pctFunded}% funded</span>
              <span>
                {settings?.gofundme_donations != null ? `${settings.gofundme_donations} donations · ` : ''}
                synced {timeAgo(settings?.gofundme_synced_at) || 'never'}
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-ink-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-gold-400 to-gold-600 transition-all"
                style={{ width: `${Math.min(100, pctFunded)}%` }}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* In-person event stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {loading ? (
          [0, 1, 2, 3].map((i) => (
            <Card key={i} className="p-5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-3 h-8 w-16" />
            </Card>
          ))
        ) : (
          <>
            <StatCard icon={DollarSign} label="Events · this term" value={`$${thisTerm}`} tone="green" />
            <StatCard icon={TrendingUp} label="Events · all time" value={`$${total}`} />
            <StatCard icon={Calendar} label="Fundraisers" value={events.length} tone="blue" />
            <StatCard icon={Target} label="Avg / event" value={`$${avg}`} tone="gold" />
          </>
        )}
      </div>

      {/* Cumulative graph + projection */}
      <Card className="mt-6 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-ink-900">In-person fundraising over time</h3>
          <div className="flex items-center gap-4 text-xs text-ink-500">
            <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-green-600" /> Actual</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full border border-dashed border-gold-500" /> Projected</span>
          </div>
        </div>

        {loading ? (
          <p className="py-16 text-center text-sm text-ink-400">Loading…</p>
        ) : history.length === 0 ? (
          <p className="py-16 text-center text-sm text-ink-400">No in-person fundraising recorded yet.</p>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(140,132,117,0.18)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#8c8475' }} tickLine={false} axisLine={{ stroke: 'rgba(140,132,117,0.3)' }} />
                <YAxis
                  tickFormatter={(v) => `$${v}`}
                  tick={{ fontSize: 12, fill: '#8c8475' }}
                  tickLine={false}
                  axisLine={false}
                  width={56}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(140,132,117,0.45)' }} />
                {target <= Math.max(...chartData.map((d) => d.projected ?? d.actual ?? 0)) && (
                  <ReferenceLine
                    y={target}
                    stroke="rgba(140,132,117,0.45)"
                    strokeDasharray="4 4"
                    label={{ value: `Goal $${target}`, position: 'insideTopRight', fontSize: 11, fill: '#8c8475' }}
                  />
                )}
                <Line type="monotone" dataKey="actual" stroke="#2a943b" strokeWidth={2.5} dot={{ r: 3, fill: '#2a943b' }} connectNulls={false} />
                <Line type="monotone" dataKey="projected" stroke="#fba631" strokeWidth={2} strokeDasharray="6 5" dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {canProject && (
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-blue-50 p-3 text-sm text-ink-700">
            <Sparkles size={16} className="mt-0.5 shrink-0 text-blue-500" />
            <p>
              At the current pace (~<span className="font-semibold text-ink-900">${perMonth}/month</span>), in-person events are on track for about{' '}
              <span className="font-semibold text-ink-900">${projectedYearEnd.toLocaleString()}</span> by the end of {thisYear}.
            </p>
          </div>
        )}
      </Card>

      {/* Best days to fundraise — peak times for planning */}
      <Card className="mt-6 p-5">
        <h3 className="mb-1 font-semibold text-ink-900">Best days to fundraise</h3>
        <p className="mb-3 text-sm text-ink-500">
          Average raised per weekday from past events.
          {bestDay && ` ${bestDay.day} leads at about $${bestDay.avgRaised} per event.`}
        </p>
        <BestDaysChart events={events} />
      </Card>

      {/* Per-event breakdown */}
      <Card className="mt-6 p-5">
        <h3 className="mb-4 font-semibold text-ink-900">By event</h3>
        {events.length === 0 ? (
          <p className="py-4 text-center text-sm text-ink-400">No fundraising events yet.</p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {[...events].reverse().map((e) => (
              <li key={e.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium text-ink-800">{e.name}</p>
                  <p className="text-xs text-ink-400">{formatDate(e.date)} · {e.location}</p>
                </div>
                <span className="font-semibold text-ink-900">${e.raised}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}

// Inline-editable shared goal. Any signed-in member can change it for everyone.
function EditableGoal({ target, editable, onSaved }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(target)
  const [busy, setBusy] = useState(false)

  useEffect(() => setVal(target), [target])

  async function save() {
    setBusy(true)
    await updateRaiseTarget(Number(val))
    setBusy(false)
    setEditing(false)
    onSaved()
  }

  if (!editable) {
    return <span className="text-ink-900">${Number(target).toLocaleString()}</span>
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1 align-baseline text-ink-900 hover:text-green-600"
        title="Edit the shared goal"
      >
        ${Number(target).toLocaleString()}
        <Pencil size={14} className="text-ink-400" />
      </button>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 align-baseline text-2xl">
      <span className="text-ink-400">$</span>
      <input
        type="number"
        min="0"
        value={val}
        autoFocus
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && save()}
        className="w-28 rounded-lg border border-ink-200 px-2 py-0.5 text-2xl font-bold text-ink-900 outline-none focus:border-green-400"
      />
      <button
        onClick={save}
        disabled={busy}
        className="rounded-lg bg-green-500 p-1.5 text-white hover:bg-green-600 disabled:opacity-50"
        aria-label="Save goal"
      >
        <Check size={16} />
      </button>
    </span>
  )
}
