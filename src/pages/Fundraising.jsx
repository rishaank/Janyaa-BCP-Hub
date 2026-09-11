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
  Target,
  Sparkles,
  ExternalLink,
  RefreshCw,
  Loader2,
  Pencil,
  Check,
  ChevronLeft,
  ChevronRight,
  Users,
  AlertTriangle,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader, Card, StatCard, Button, Skeleton, formatDate, timeAgo } from '../components/ui'
import {
  getFundraisingEvents, getSettings, updateRaiseTarget, syncDonations, autoGenerateInsights,
  currentTermStart, getCurrentTermStart,
} from '../lib/api'
import { useRealtime } from '../lib/useRealtime'
import { useIsDesktop } from '../lib/useMediaQuery'
import { useAuth } from '../context/AuthContext'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import BestDaysChart from '../components/BestDaysChart'
import { num, money } from '../lib/format'

// The Hub has now outlived two donation platforms. Label from the stored
// provider rather than hardcoding a name into the markup again.
const PROVIDER_LABELS = { givebutter: 'Givebutter', gofundme: 'GoFundMe' }

const DAY = 86400000
const ts = (iso) => new Date(iso + 'T00:00:00').getTime()
const shortLabel = (iso) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: '2-digit' })

// --- month-key helpers for the windowed monthly chart ('YYYY-MM') ---
const monthKeyOf = (iso) => iso.slice(0, 7)
const addMonths = (key, n) => {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const monthShort = (key) => {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

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
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-green-700">{money(pt.value)}</p>
    </div>
  )
}

export default function Fundraising() {
  useDocumentTitle('Fundraising')
  const [events, setEvents] = useState([])
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [viewEnd, setViewEnd] = useState(null) // window's last-month index (null = current month)
  const [chartView, setChartView] = useState('window') // 'window' (6-month) | 'all' (first month → now)
  // Seasonal mirror as the instant value; the terms-table-aware RPC corrects it.
  const [termStart, setTermStart] = useState(currentTermStart())
  const isDesktop = useIsDesktop()
  const { profile } = useAuth()
  const canEditGoal = !!profile?.is_admin

  const loadSettings = () => getSettings().then(setSettings)

  useEffect(() => {
    getCurrentTermStart().then(setTermStart)
    getFundraisingEvents().then((data) => {
      setEvents(data)
      setLoading(false)
    })
    // Sync the donation platform; if the amount actually changed, refresh AI
    // insights (throttled).
    ;(async () => {
      const before = await getSettings()
      setSettings(before)
      const { error } = await syncDonations()
      if (error) return
      const after = await getSettings()
      setSettings(after)
      if (before && after && Number(before.donations_raised) !== Number(after.donations_raised)) {
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
    const { error } = await syncDonations(true)
    if (!error) await loadSettings()
    setSyncing(false)
  }

  const target = Number(settings?.raise_target ?? 10000)

  // The club's online total = its own Givebutter page + the finished GoFundMe
  // run. The legacy figure is merged in so the headline number doesn't fall off a
  // cliff the day the platform changed; it stays a separate column so the two
  // platforms remain distinguishable in the data.
  const toNum = (v) => (v != null ? Number(v) : null)
  const teamRaised = toNum(settings?.donations_raised)
  const legacyRaised = toNum(settings?.donations_legacy_raised)
  const onlineRaised =
    teamRaised == null && legacyRaised == null ? null : (teamRaised ?? 0) + (legacyRaised ?? 0)
  const pctFunded = target > 0 && onlineRaised != null ? Math.round((onlineRaised / target) * 100) : 0

  // The whole Janyaa campaign the club's team sits inside.
  const campaignRaised = toNum(settings?.donations_campaign_raised)
  const campaignGoal = Number(settings?.donations_campaign_goal ?? 10000)
  const campaignPct =
    campaignGoal > 0 && campaignRaised != null ? Math.round((campaignRaised / campaignGoal) * 100) : 0

  const providerLabel = PROVIDER_LABELS[settings?.donations_provider] ?? 'Givebutter'
  const legacyLabel = settings?.donations_legacy_label || 'GoFundMe'
  const teamName = settings?.donations_team_name || 'Bellarmine Youth Chapter'
  // The club's own page: what members share, what the QR encodes, and what the
  // scraper reads for our figures. The parent campaign is context only.
  const clubUrl = settings?.donations_url
  const campaignUrl = settings?.donations_campaign_url
  const syncFailed = String(settings?.donations_sync_status || '').startsWith('error')

  const total = events.reduce((s, e) => s + Number(e.raised), 0)
  const thisTermEvents = events.filter((e) => e.date >= termStart)
  const thisTerm = thisTermEvents.reduce((s, e) => s + Number(e.raised), 0)
  const eventsThisTermCount = thisTermEvents.length
  const eventsAllTimeCount = events.length
  const avg = events.length ? Math.round(total / events.length) : 0
  const thisYear = new Date().getFullYear()

  // ---- Monthly cumulative timeline, shown 6 months at a time ----
  const todayKey = monthKeyOf(new Date().toISOString().slice(0, 10))
  const raisedByMonth = {}
  events.forEach((e) => { const k = monthKeyOf(e.date); raisedByMonth[k] = (raisedByMonth[k] || 0) + Number(e.raised) })
  const firstEventKey = events.length ? monthKeyOf(events[0].date) : todayKey
  const startKey = firstEventKey < addMonths(todayKey, -5) ? firstEventKey : addMonths(todayKey, -5)
  const endKey = addMonths(todayKey, 6)
  const timeline = []
  for (let k = startKey; k <= endKey; k = addMonths(k, 1)) timeline.push({ key: k, label: monthShort(k) })
  const currentIdx = Math.max(0, timeline.findIndex((t) => t.key === todayKey))
  let run = 0
  timeline.forEach((t) => { run += raisedByMonth[t.key] || 0; t.cum = run })
  const currentCum = timeline[currentIdx]?.cum ?? run

  // Per-month slope from actual months, used to project future months.
  const actualPts = timeline.slice(0, currentIdx + 1)
  const canProject = actualPts.length >= 2
  const slope = canProject ? linearFit(actualPts.map((_, i) => i), actualPts.map((t) => t.cum)).slope : 0
  const perMonth = Math.round(slope)
  timeline.forEach((t, i) => {
    if (i <= currentIdx) { t.actual = t.cum; t.projected = i === currentIdx ? t.cum : null }
    else { t.actual = null; t.projected = Math.round(currentCum + slope * (i - currentIdx)) }
  })
  const idxDec = timeline.findIndex((t) => t.key === `${thisYear}-12`)
  const projectedYearEnd = idxDec > currentIdx ? Math.round(currentCum + slope * (idxDec - currentIdx)) : total

  // 6-month sliding window (paged by the arrows; defaults to ending on the current month).
  const maxEnd = timeline.length - 1
  const defaultEnd = Math.min(maxEnd, Math.max(5, currentIdx))
  const effEnd = Math.min(maxEnd, Math.max(5, viewEnd ?? currentIdx))
  const windowData = timeline.slice(Math.max(0, effEnd - 5), effEnd + 1)
  const prevDisabled = effEnd <= 5
  const nextDisabled = effEnd >= maxEnd
  const atCurrent = effEnd === defaultEnd

  // "All time": first logged month on the left → current month on the right edge.
  const idxFirst = Math.max(0, timeline.findIndex((t) => t.key === firstEventKey))
  const allData = timeline.slice(idxFirst, currentIdx + 1)

  const isAll = chartView === 'all'
  const displayData = isAll ? allData : windowData
  const yearLines = displayData.filter((t) => t.key.endsWith('-01')).map((t) => ({ x: t.label, year: t.key.slice(0, 4) }))
  const currentInWindow = displayData.find((t) => t.key === todayKey)
  const chartMax = Math.max(...displayData.map((d) => d.projected ?? d.actual ?? 0), 0)

  if (!isDesktop)
    return (
      <>
        {/* Live online-donations hero + editable shared goal */}
        <div className="fund-hero">
          <div className="fund-hero-top">
            <span className="fund-hero-live"><span className="fund-hero-dot" /> {providerLabel} · live</span>
            <span style={{ display: 'flex', gap: 7 }}>
              {clubUrl && (
                <a className="fund-hero-btn" href={clubUrl} target="_blank" rel="noreferrer" aria-label={`Donate on ${providerLabel}`}>
                  <ExternalLink size={14} />
                </a>
              )}
              <button className="fund-hero-btn" onClick={handleSync} disabled={syncing}>
                {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Sync
              </button>
            </span>
          </div>
          <div className="fund-hero-body">
            <div className="fund-hero-raised-l">Raised online</div>
            <div className="fund-hero-raised">{onlineRaised != null ? money(onlineRaised) : '—'}</div>
            {legacyRaised != null && legacyRaised > 0 && (
              <div className="fund-hero-note">Includes {money(legacyRaised)} from {legacyLabel}</div>
            )}
            <div className="fund-hero-goal">
              <span>Shared goal</span>
              <b><EditableGoal target={target} editable={!!settings && canEditGoal} onSaved={loadSettings} /></b>
            </div>
            <div className="fund-hero-bar"><i style={{ width: `${Math.min(100, pctFunded)}%` }} /></div>
            <div className="fund-hero-meta">
              <span>{pctFunded}% funded</span>
              <span>
                {settings?.donations_count != null ? `${settings.donations_count} donations · ` : ''}
                synced {timeAgo(settings?.donations_synced_at) || 'never'}
              </span>
            </div>

            {/* Our own link credits the club automatically. On Janyaa's campaign
                page it does not, which is the whole reason to share ours. */}
            <div className="fund-hero-tip">
              <Users size={14} />
              <span>Share our link. On Janyaa's page, donors must pick <b>{teamName}</b>.</span>
            </div>

            {campaignRaised != null && (
              <div className="fund-hero-campaign">
                <div className="fund-hero-campaign-l">
                  <span>Janyaa campaign</span>
                  <b>{money(campaignRaised)} / {money(campaignGoal)}</b>
                </div>
                <div className="fund-hero-bar alt"><i style={{ width: `${Math.min(100, campaignPct)}%` }} /></div>
              </div>
            )}

            {syncFailed && (
              <div className="fund-hero-warn">
                <AlertTriangle size={14} />
                <span>Last sync failed. These figures may be out of date.</span>
              </div>
            )}
          </div>
        </div>

        {/* in-person event stats */}
        <div className="fund-stats">
          <div className="fund-stat"><DollarSign size={18} style={{ color: 'var(--green-text)' }} /><div className="v">${thisTerm}</div><div className="l">{eventsThisTermCount} events this term</div></div>
          <div className="fund-stat"><TrendingUp size={18} style={{ color: 'var(--ink-500)' }} /><div className="v">${total}</div><div className="l">{eventsAllTimeCount} events all time</div></div>
          <div className="fund-stat"><Target size={18} style={{ color: 'var(--gold-text)' }} /><div className="v">${avg}</div><div className="l">avg / event</div></div>
        </div>

        {/* cumulative graph + projection */}
        <div className="jh-card jh-card-pad" style={{ marginTop: 16 }}>
          <div className="jh-card-head" style={{ marginBottom: 10 }}>
            <span className="jh-card-title">Over time</span>
            <span className="chart-legend">
              <span><i style={{ background: 'var(--green-500)' }} /> Actual</span>
              <span><i style={{ background: 'var(--gold-500)' }} /> Projected</span>
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
            <span className="jh-seg">
              <button className={chartView === 'window' ? 'on' : ''} onClick={() => setChartView('window')}>6 months</button>
              <button className={chartView === 'all' ? 'on' : ''} onClick={() => setChartView('all')}>All time</button>
            </span>
            {!isAll && !atCurrent && (
              <button className="jh-action-btn" style={{ padding: '5px 11px' }} onClick={() => setViewEnd(currentIdx)}>Jump to current</button>
            )}
          </div>
          {loading ? (
            <p style={{ padding: '40px 0', textAlign: 'center', fontSize: 13, color: 'var(--ink-400)' }}>Loading…</p>
          ) : events.length === 0 ? (
            <p style={{ padding: '40px 0', textAlign: 'center', fontSize: 13, color: 'var(--ink-400)' }}>No in-person fundraising recorded yet.</p>
          ) : (
            <div style={{ display: 'flex', alignItems: 'stretch', gap: 2 }}>
              {!isAll && (
                <button onClick={() => setViewEnd(Math.max(5, effEnd - 6))} disabled={prevDisabled} aria-label="Earlier months"
                  style={{ width: 24, flex: 'none', border: 'none', background: 'none', color: 'var(--ink-400)', cursor: 'pointer', opacity: prevDisabled ? 0.25 : 1 }}>
                  <ChevronLeft size={18} />
                </button>
              )}
              <div style={{ height: 220, minWidth: 0, flex: 1 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={displayData} margin={{ top: 14, right: 10, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(140,132,117,0.18)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8c8475' }} tickLine={false} axisLine={{ stroke: 'rgba(140,132,117,0.3)' }} />
                    <YAxis tickFormatter={(v) => `$${v}`} tick={{ fontSize: 11, fill: '#8c8475' }} tickLine={false} axisLine={false} width={44} />
                    <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(140,132,117,0.45)' }} />
                    {yearLines.map((yl) => (
                      <ReferenceLine key={yl.year} x={yl.x} stroke="rgba(140,132,117,0.55)" strokeDasharray="4 4"
                        label={{ value: yl.year, position: 'insideTopLeft', fontSize: 10, fill: '#8c8475' }} />
                    ))}
                    {currentInWindow && (
                      <ReferenceLine x={currentInWindow.label} stroke="#2a943b" strokeDasharray="3 3"
                        label={{ value: 'This month', position: 'top', fontSize: 9, fill: '#2a943b' }} />
                    )}
                    {target <= chartMax && (
                      <ReferenceLine y={target} stroke="rgba(140,132,117,0.45)" strokeDasharray="4 4"
                        label={{ value: `Goal $${target}`, position: 'insideTopRight', fontSize: 10, fill: '#8c8475' }} />
                    )}
                    <Line type="monotone" dataKey="actual" stroke="#2a943b" strokeWidth={2.5} dot={{ r: 3, fill: '#2a943b' }} connectNulls={false} />
                    <Line type="monotone" dataKey="projected" stroke="#fba631" strokeWidth={2} strokeDasharray="6 5" dot={false} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {!isAll && (
                <button onClick={() => setViewEnd(Math.min(maxEnd, effEnd + 6))} disabled={nextDisabled} aria-label="Later months"
                  style={{ width: 24, flex: 'none', border: 'none', background: 'none', color: 'var(--ink-400)', cursor: 'pointer', opacity: nextDisabled ? 0.25 : 1 }}>
                  <ChevronRight size={18} />
                </button>
              )}
            </div>
          )}
          {canProject && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10, padding: 11, borderRadius: 12, background: 'var(--blue-soft)', fontSize: 12.5, color: 'var(--ink-700)', lineHeight: 1.45 }}>
              <Sparkles size={15} style={{ color: 'var(--blue-text)', flex: 'none', marginTop: 1 }} />
              <span>At ~<b>{money(perMonth)}/month</b>, in-person events are on track for about <b>{money(projectedYearEnd)}</b> by the end of {thisYear}.</span>
            </div>
          )}
        </div>

        {/* best days */}
        <div className="jh-card jh-card-pad" style={{ marginTop: 14 }}>
          <span className="jh-card-title" style={{ display: 'block', marginBottom: 12 }}>Best days to fundraise</span>
          <BestDaysChart events={events} />
        </div>

        {/* by event */}
        <div className="jh-card jh-card-pad" style={{ marginTop: 14 }}>
          <span className="jh-card-title" style={{ display: 'block', marginBottom: 4 }}>By event</span>
          {events.length === 0 ? (
            <p style={{ padding: '14px 0', textAlign: 'center', fontSize: 13, color: 'var(--ink-400)' }}>No fundraising events yet.</p>
          ) : (
            [...events].reverse().map((e) => (
              <Link key={e.id} to={`/events/${e.id}`} className="byevent-row">
                <div style={{ minWidth: 0 }}>
                  <div className="jh-row-t">{e.name}</div>
                  <div className="jh-row-s">{formatDate(e.date)} · {e.location}</div>
                </div>
                <span className="amt">{money(e.raised)}</span>
              </Link>
            ))
          )}
        </div>
      </>
    )

  return (
    <>
      <PageHeader title="Fundraising" />

      {/* Live online-donations hero + editable shared goal */}
      <Card className="mb-6 overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-gold-100 bg-gradient-to-r from-gold-50 to-green-50 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-green-700">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
            </span>
            <span className="truncate">{providerLabel} campaign · live</span>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            {clubUrl && (
              <a
                href={clubUrl}
                target="_blank"
                rel="noreferrer"
                title={`Donate on ${providerLabel}`}
                aria-label={`Donate on ${providerLabel}`}
                className="inline-flex items-center gap-1 rounded-lg p-2 text-green-700 transition-colors hover:bg-green-100 sm:px-2.5 sm:py-1.5 sm:text-sm sm:font-medium"
              >
                <ExternalLink size={16} className="shrink-0" />
                <span className="hidden sm:inline">Donate</span>
              </a>
            )}
            <button
              onClick={handleSync}
              disabled={syncing}
              title="Sync now"
              aria-label="Sync now"
              className="inline-flex items-center gap-1.5 rounded-lg border border-ink-300 bg-surface p-2 text-ink-800 transition-colors hover:bg-ink-50 disabled:opacity-60 sm:px-3.5 sm:py-2 sm:text-sm sm:font-semibold"
            >
              {syncing ? <Loader2 size={16} className="shrink-0 animate-spin" /> : <RefreshCw size={16} className="shrink-0" />}
              <span className="hidden sm:inline">{syncing ? 'Syncing…' : 'Sync Now'}</span>
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
            <div>
              <p className="text-sm font-medium text-ink-500">Raised Online</p>
              <p className="mt-0.5 font-display text-5xl font-bold tracking-tight tabular-nums text-green-700">
                {onlineRaised != null ? money(onlineRaised) : '—'}
              </p>
              {legacyRaised != null && legacyRaised > 0 && (
                <p className="mt-1 text-xs text-ink-400">Includes {money(legacyRaised)} from {legacyLabel}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-ink-500">Shared Goal</p>
              <div className="mt-0.5 text-2xl font-bold text-ink-900">
                <EditableGoal target={target} editable={!!settings && canEditGoal} onSaved={loadSettings} />
              </div>
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-ink-500">
              <span>{pctFunded}% funded</span>
              <span>
                {settings?.donations_count != null ? `${settings.donations_count} donations · ` : ''}
                synced {timeAgo(settings?.donations_synced_at) || 'never'}
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-ink-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-gold-400 to-gold-600 transition-all"
                style={{ width: `${Math.min(100, pctFunded)}%` }}
              />
            </div>
          </div>

          {/* Our own link credits the club automatically. Janyaa's campaign page
              does not, which is the whole reason to share ours. */}
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-blue-50 p-3 text-sm text-ink-700">
            <p>
              <Users size={16} className="mr-1.5 inline align-text-bottom text-blue-500" />
              Share our link above. It credits the club on its own.
              {campaignUrl && (
                <>
                  {' '}On Janyaa's main page, donors must pick{' '}
                  <span className="font-semibold text-ink-900">{teamName}</span> under Credit a team.
                </>
              )}
            </p>
          </div>

          {/* The club's team sits inside Janyaa's wider campaign — show both. */}
          {campaignRaised != null && (
            <div className="mt-4 rounded-xl border border-ink-200 p-3">
              <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-ink-500">
                <span>Janyaa campaign</span>
                <span className="tabular-nums">
                  {money(campaignRaised)} / {money(campaignGoal)} · {campaignPct}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-400 to-green-500 transition-all"
                  style={{ width: `${Math.min(100, campaignPct)}%` }}
                />
              </div>
            </div>
          )}

          {syncFailed && (
            <div className="mt-4 flex items-start gap-2 rounded-xl bg-gold-50 p-3 text-sm text-ink-700">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-gold-600" />
              <div>
                <p>Last sync failed. These figures may be out of date.</p>
                <p className="mt-1 text-xs text-ink-500">
                  <code className="rounded bg-ink-100 px-1">{settings?.donations_sync_status}</code>
                </p>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* In-person event stats */}
      <div className="ja-stagger grid grid-cols-2 gap-4 lg:grid-cols-3">
        {loading ? (
          [0, 1, 2].map((i) => (
            <Card key={i} className="p-5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-3 h-8 w-16" />
            </Card>
          ))
        ) : (
          <>
            <StatCard icon={DollarSign} label={`${eventsThisTermCount} Events this term`} value={`$${thisTerm}`} tone="green" />
            <StatCard icon={TrendingUp} label={`${eventsAllTimeCount} Events all time`} value={`$${total}`} />
            <StatCard icon={Target} label="Avg / event" value={`$${avg}`} tone="gold" />
          </>
        )}
      </div>

      {/* Cumulative graph + projection — 6-month windows, navigable */}
      <Card className="mt-6 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-ink-900">In-Person Fundraising Over Time</h3>
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-lg border border-ink-200 bg-surface p-0.5">
              {[['window', '6 months'], ['all', 'All time']].map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setChartView(val)}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                    chartView === val ? 'bg-green-600 text-white shadow-xs' : 'text-ink-500 hover:text-ink-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {!isAll && !atCurrent && (
              <button
                onClick={() => setViewEnd(currentIdx)}
                className="rounded-lg bg-ink-100 px-2.5 py-1 text-xs font-semibold text-ink-700 transition-colors hover:bg-ink-200"
              >
                Jump to current
              </button>
            )}
            <div className="flex items-center gap-4 text-xs text-ink-500">
              <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-green-600" /> Actual</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full border border-dashed border-gold-500" /> Projected</span>
            </div>
          </div>
        </div>

        {loading ? (
          <p className="py-16 text-center text-sm text-ink-400">Loading…</p>
        ) : events.length === 0 ? (
          <p className="py-16 text-center text-sm text-ink-400">No in-person fundraising recorded yet.</p>
        ) : (
          <div className="flex items-stretch gap-1">
            {!isAll && (
              <button
                onClick={() => setViewEnd(Math.max(5, effEnd - 6))}
                disabled={prevDisabled}
                aria-label="Earlier months"
                className="grid w-7 shrink-0 place-items-center rounded-lg text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700 disabled:opacity-25 disabled:hover:bg-transparent"
              >
                <ChevronLeft size={18} />
              </button>
            )}
            <div className="h-72 min-w-0 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={displayData} margin={{ top: 14, right: 12, bottom: 0, left: 4 }}>
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
                  {yearLines.map((yl) => (
                    <ReferenceLine
                      key={yl.year}
                      x={yl.x}
                      stroke="rgba(140,132,117,0.55)"
                      strokeDasharray="4 4"
                      label={{ value: yl.year, position: 'insideTopLeft', fontSize: 11, fill: '#8c8475' }}
                    />
                  ))}
                  {currentInWindow && (
                    <ReferenceLine
                      x={currentInWindow.label}
                      stroke="#2a943b"
                      strokeDasharray="3 3"
                      label={{ value: 'This month', position: 'top', fontSize: 10, fill: '#2a943b' }}
                    />
                  )}
                  {target <= chartMax && (
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
            {!isAll && (
              <button
                onClick={() => setViewEnd(Math.min(maxEnd, effEnd + 6))}
                disabled={nextDisabled}
                aria-label="Later months"
                className="grid w-7 shrink-0 place-items-center rounded-lg text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700 disabled:opacity-25 disabled:hover:bg-transparent"
              >
                <ChevronRight size={18} />
              </button>
            )}
          </div>
        )}

        {canProject && (
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-blue-50 p-3 text-sm text-ink-700">
            <Sparkles size={16} className="mt-0.5 shrink-0 text-blue-500" />
            <p>
              At the current pace (~<span className="font-semibold text-ink-900">{money(perMonth)}/month</span>), in-person events are on track for about{' '}
              <span className="font-semibold text-ink-900">{money(projectedYearEnd)}</span> by the end of {thisYear}.
            </p>
          </div>
        )}
      </Card>

      {/* Best days to fundraise — peak times for planning */}
      <Card className="mt-6 p-5">
        <h3 className="mb-3 font-semibold text-ink-900">Best Days to Fundraise</h3>
        <BestDaysChart events={events} />
      </Card>

      {/* Per-event breakdown */}
      <Card className="mt-6 p-5">
        <h3 className="mb-4 font-semibold text-ink-900">By Event</h3>
        {events.length === 0 ? (
          <p className="py-4 text-center text-sm text-ink-400">No fundraising events yet.</p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {[...events].reverse().map((e) => (
              <li key={e.id} className="first:pt-0 last:pb-0">
                <Link to={`/events/${e.id}`} className="group flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink-800 transition-colors group-hover:text-green-700">{e.name}</p>
                    <p className="truncate text-xs text-ink-400">{formatDate(e.date)} · {e.location}</p>
                  </div>
                  <span className="shrink-0 font-semibold text-ink-900">{money(e.raised)}</span>
                </Link>
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
    return <span className="text-ink-900">{money(target)}</span>
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1 align-baseline text-ink-900 hover:text-green-600"
        title="Edit the shared goal"
      >
        {money(target)}
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
