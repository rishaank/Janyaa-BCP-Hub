import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Users, Clock, ArrowRight, Sparkles, Target, LogIn, AlertTriangle, X, Check, PiggyBank,
  CalendarDays, Presentation,
} from 'lucide-react'
import {
  StatPill, Card, PageHeader, Avatar, ProgressBar, Button, Skeleton, roleTones,
} from '../components/ui'
import {
  getPublicDashboard, initials, getPins, addPin, removePin, getRecoveryEmail,
  getMyHoursRequests, dismissHoursRequest, currentTerm, periodLabel,
} from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useRealtime } from '../lib/useRealtime'
import { useIsDesktop } from '../lib/useMediaQuery'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import InsightCard from '../components/InsightCard'
import Linkify from '../components/Linkify'

const monthOf = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
const dayOf = (iso) => new Date(iso + 'T00:00:00').getDate()
const fmtTime = (t) => {
  if (!t) return ''
  const [h, m] = t.split(':')
  return new Date(2000, 0, 1, Number(h), Number(m)).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export default function Dashboard() {
  const { session, user } = useAuth()
  const isGuest = !session
  const [d, setD] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lbView, setLbView] = useState('term') // 'term' | 'all'
  const [pins, setPins] = useState([])
  const [requests, setRequests] = useState([]) // my hours-request status cards
  const navigate = useNavigate()
  const isDesktop = useIsDesktop()
  useDocumentTitle('Dashboard')

  useEffect(() => {
    getPublicDashboard().then((data) => {
      setD(data)
      setLoading(false)
    })
  }, [])

  // Nudge signed-in members who can't reset their own password yet — reset
  // links are only ever emailed to a recovery address.
  const [needsRecovery, setNeedsRecovery] = useState(false)
  useEffect(() => {
    if (!user?.id) return setNeedsRecovery(false)
    getRecoveryEmail(user.id).then((e) => setNeedsRecovery(!e))
  }, [user?.id])

  const loadPins = () => (session ? getPins('dashboard').then(setPins) : setPins([]))
  useEffect(() => {
    loadPins()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  async function pinIns(ins) {
    await addPin({ surface: 'dashboard', kind: 'insight', payload: ins, by: user?.id })
    loadPins()
  }
  async function unpinIns(pinId) {
    await removePin(pinId)
    loadPins()
  }

  // My hours-request status — pending (always) + undismissed approved/denied.
  const loadRequests = () => (user?.id ? getMyHoursRequests(user.id).then(setRequests) : setRequests([]))
  useEffect(() => {
    loadRequests()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])
  useRealtime(['hours_requests'], loadRequests)
  async function dismissRequest(id) {
    await dismissHoursRequest(id)
    loadRequests()
  }

  if (loading) {
    if (!isDesktop) return <MobileDashSkeleton />
    return (
      <>
        <PageHeader title="Dashboard" subtitle={`${currentTerm()} term at a glance`} />
        <DashboardSkeleton />
      </>
    )
  }

  if (!d) {
    if (!isDesktop)
      return (
        <>
          <h1 className="jh-h1">Dashboard</h1>
          <p className="jh-sub">{currentTerm()} term at a glance</p>
          <div className="jh-card jh-card-pad" style={{ marginTop: 16, color: 'var(--ink-500)', fontSize: 13.5 }}>
            Couldn’t load the dashboard. Try again in a moment.
          </div>
        </>
      )
    return (
      <>
        <PageHeader title="Dashboard" subtitle={`${currentTerm()} term at a glance`} />
        <Card className="p-6 text-sm text-ink-500">Couldn’t load the dashboard. Try again in a moment.</Card>
      </>
    )
  }

  const fundRaised = Number(d.fundraising?.raised ?? 0)
  const fundTarget = Number(d.fundraising?.target ?? 500)
  const insights = Array.isArray(d.insights) ? d.insights : []
  const pinnedTitles = new Set(pins.map((p) => p.payload?.title))
  const goals = Array.isArray(d.goals) ? d.goals : []
  const termTargets = Array.isArray(d.term_targets) ? d.term_targets : []
  const events = d.upcoming_events_list ?? []
  const meetings = d.upcoming_meetings_list ?? []

  const pendingReqs = requests.filter((r) => r.status === 'pending')
  const approvedReqs = requests.filter((r) => r.status === 'approved')
  const deniedReqs = requests.filter((r) => r.status === 'denied')

  const leaderboard = [...(d.leaderboard ?? [])]
    .sort((a, b) => (lbView === 'term' ? b.term_hours - a.term_hours : b.hours - a.hours))
    .slice(0, 5)
  const termEmpty = lbView === 'term' && Number(d.term_hours) === 0

  if (!isDesktop)
    return (
      <DashboardMobile
        d={d}
        isGuest={isGuest}
        pendingReqs={pendingReqs}
        approvedReqs={approvedReqs}
        deniedReqs={deniedReqs}
        onDismiss={dismissRequest}
        pins={pins}
        insights={insights}
        pinnedTitles={pinnedTitles}
        onPin={pinIns}
        onUnpin={unpinIns}
        needsRecovery={needsRecovery}
        userId={user?.id}
      />
    )

  return (
    <>
      <PageHeader title="Dashboard" subtitle={`${currentTerm()} term at a glance`} />

      {/* My hours-request status — pending + approved as small chips */}
      {(pendingReqs.length > 0 || approvedReqs.length > 0) && (
        <div className="mb-4 flex flex-wrap gap-2">
          {pendingReqs.map((r) => (
            <span
              key={r.id}
              className="inline-flex items-center gap-2 rounded-full border border-gold-200 bg-gold-50 px-3 py-1.5 text-sm text-gold-700"
            >
              <Clock size={14} className="shrink-0" />
              <span>Hours request pending — <b className="tabular-nums">{Number(r.hours)}h</b> for {r.activity}</span>
            </span>
          ))}
          {approvedReqs.map((r) => (
            <span
              key={r.id}
              className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 py-1.5 text-sm text-green-700"
            >
              <Check size={14} className="shrink-0" />
              <span>Hours request approved — <b className="tabular-nums">{Number(r.hours)}h</b> for {r.activity}</span>
              <button
                onClick={() => dismissRequest(r.id)}
                className="-mr-1 shrink-0 rounded-full p-0.5 text-green-700/70 transition-colors hover:bg-green-100 hover:text-green-700"
                aria-label="Dismiss"
              >
                <X size={14} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Denied hours-request cards — stay until dismissed */}
      {deniedReqs.map((r) => (
        <Card key={r.id} className="mb-4 flex items-start gap-3 border-coral-200 bg-coral-50/60 p-4">
          <span className="mt-0.5 shrink-0 text-coral-600"><AlertTriangle size={18} /></span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-ink-900">Hours request denied</p>
            <p className="mt-0.5 text-sm text-ink-700">
              Your request for <span className="font-medium">{Number(r.hours)}h</span> ({r.activity}) was denied
              {r.reviewer?.name ? ` by ${r.reviewer.name}` : ''}.
            </p>
            {r.denial_reason && (
              <p className="mt-1 text-sm text-ink-600">
                <span className="font-medium text-ink-700">Reason:</span> {r.denial_reason}
              </p>
            )}
          </div>
          <button
            onClick={() => dismissRequest(r.id)}
            className="shrink-0 rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-coral-100 hover:text-coral-700"
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>
        </Card>
      ))}

      {isGuest && (
        <Card className="mb-6 flex flex-col items-start justify-between gap-3 border-blue-200 bg-blue-50/60 p-4 sm:flex-row sm:items-center">
          <p className="text-sm text-ink-700">
            You’re viewing the <span className="font-semibold">public dashboard</span>. Sign in to sign up for
            events, log hours, manage meetings, and more.
          </p>
          <Link to="/login" className="shrink-0">
            <Button icon={LogIn}>Sign in</Button>
          </Link>
        </Card>
      )}

      {/* Compact stat chips */}
      <div className="flex flex-wrap items-center gap-3">
        <StatPill
          icon={Clock}
          value={`${Number(d.term_hours)}h`}
          label="this term"
          hint={`${Number(d.total_hours)}h all-time`}
          tone="blue"
        />
        <StatPill
          icon={CalendarDays}
          value={Number(d.events_term ?? 0)}
          label="events this term"
          hint={`${Number(d.events_count ?? 0)} all-time`}
          tone="green"
        />
        <StatPill
          icon={Presentation}
          value={Number(d.meetings_term ?? 0)}
          label="meetings this term"
          hint={`${Number(d.meetings_count ?? 0)} all-time`}
          tone="blue"
        />
        <FundraisingPill raised={fundRaised} target={fundTarget} />
        {needsRecovery && (
          <Link
            to={`/members/${user.id}`}
            className="inline-flex items-center gap-2.5 rounded-full border border-gold-200 bg-gold-50 py-1.5 pl-1.5 pr-4 shadow-sm transition-colors hover:bg-gold-100"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gold-100 text-gold-700">
              <AlertTriangle size={16} />
            </span>
            <span className="text-sm font-medium text-gold-700">Set a recovery email</span>
          </Link>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-stretch">
        {/* Upcoming events + meetings */}
        <div className="grid gap-6 sm:grid-cols-2 lg:col-span-2">
          <ListCard title="Upcoming Events" to="/events" empty="No upcoming events scheduled." className="h-full">
              {events.map((e) => (
                <li key={e.id} className="first:pt-0 last:pb-0">
                  <Link to={`/events/${e.id}`} className="group flex items-center gap-3 py-2.5">
                    <DateTile iso={e.date} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink-900 group-hover:text-green-700">{e.name}</p>
                      <p className="truncate text-sm text-ink-500">{e.location || 'Location TBD'}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-600">{e.signups} in</span>
                  </Link>
                </li>
              ))}
            </ListCard>

          <ListCard title="Upcoming Meetings" to="/events?tab=meetings" empty="No meetings on the schedule." className="h-full">
              {meetings.map((m) => (
                <li key={m.id} className="first:pt-0 last:pb-0">
                  <Link to={`/meetings/${m.id}`} className="group flex items-center gap-3 py-2.5">
                    <DateTile iso={m.date} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink-900 group-hover:text-green-700">{m.title}</p>
                      <p className="truncate text-sm text-ink-500">{m.start_time ? `${fmtTime(m.start_time)} PST` : 'Time TBD'}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-600">{m.attendees} in</span>
                  </Link>
                </li>
              ))}
          </ListCard>
        </div>

        {/* Hours leaderboard with term / all-time toggle */}
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h3 className="font-semibold text-ink-900">Hours Leaderboard</h3>
            <div className="inline-flex rounded-lg border border-ink-200 bg-surface p-0.5">
              {[['term', 'This term'], ['all', 'All time']].map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setLbView(val)}
                  className={`rounded-md px-2 py-1 text-xs font-semibold transition-colors ${
                    lbView === val ? 'bg-green-600 text-white shadow-xs' : 'text-ink-500 hover:text-ink-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {termEmpty ? (
            <div className="py-6 text-center">
              <p className="text-sm text-ink-500">No hours logged yet this term.</p>
              <button onClick={() => setLbView('all')} className="mt-1 text-xs font-medium text-blue-600 hover:text-blue-700">
                See all-time hours →
              </button>
            </div>
          ) : leaderboard.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-400">No hours logged yet.</p>
          ) : (
            <ul className="space-y-3">
              {leaderboard.map((m, i) => {
                const hrs = lbView === 'term' ? m.term_hours : m.hours
                const row = (
                  <>
                    <span className="w-4 text-sm font-semibold text-ink-400">{i + 1}</span>
                    <Avatar initials={initials(m.name)} tone={roleTones[m.role]} src={m.avatar_url} />
                    <p className="min-w-0 flex-1 truncate text-sm font-medium text-ink-900">{m.name}</p>
                    <span className="text-sm font-semibold tabular-nums text-ink-700">{hrs}h</span>
                  </>
                )
                return isGuest ? (
                  <li key={m.id} className="flex items-center gap-3 px-1 py-0.5">{row}</li>
                ) : (
                  <li
                    key={m.id}
                    onClick={() => navigate(`/members/${m.id}`)}
                    className="flex cursor-pointer items-center gap-3 rounded-lg px-1 py-0.5 hover:bg-ink-50"
                  >
                    {row}
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>

      {/* Leadership goals + semester targets */}
      {(goals.length > 0 || termTargets.length > 0) && (
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 font-semibold text-ink-900">
              <Target size={16} className="text-green-600" /> Leadership Goals
            </h3>
            <Link to="/goals" className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700">
              View all <ArrowRight size={14} />
            </Link>
          </div>

          {termTargets.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-green-200 bg-green-50/60 px-4 py-3">
              <span className="font-mono text-2xs font-semibold uppercase tracking-[0.08em] text-green-700">Semester Targets</span>
              {termTargets.map((t, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-700">
                  <Target size={13} className="text-green-600" />
                  {t.label}
                  {t.sub && <span className="text-ink-400">· {t.sub}</span>}
                </span>
              ))}
            </div>
          )}

          <div className="ja-stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {goals.slice(0, 3).map((g) => (
              <Card key={g.id} className="flex flex-col p-5">
                <span className="mb-1 font-mono text-2xs font-semibold uppercase tracking-[0.06em] text-ink-400">{periodLabel(g.period)}</span>
                <h4 className="whitespace-pre-wrap font-display text-h4 font-semibold text-ink-900"><Linkify>{g.title}</Linkify></h4>
                {g.detail && <p className="mt-1 whitespace-pre-wrap text-sm text-ink-600"><Linkify>{g.detail}</Linkify></p>}
                <div className="mt-auto pt-4">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-xs text-ink-500">
                      {g.owner_name ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Avatar size="xs" initials={initials(g.owner_name)} tone={roleTones[g.owner_role] ?? 'blue'} src={g.owner_avatar} />
                          {g.owner_name}
                        </span>
                      ) : (
                        'Unassigned'
                      )}
                    </span>
                    <span className="font-mono text-xs font-semibold tabular-nums text-ink-700">{g.progress}%</span>
                  </div>
                  <ProgressBar value={g.progress} max={100} tone="gold" />
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* AI Insights */}
      {(insights.length > 0 || pins.length > 0) && (
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 font-semibold text-ink-900">
              <Sparkles size={16} className="text-blue-500" /> AI Insights
            </h3>
            <Link to="/ai-planning" className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          <div className="ja-stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pins.map((p) => (
              <InsightCard key={p.id} ins={p.payload} hideAiMark pin={{ pinned: true, onToggle: () => unpinIns(p.id) }} />
            ))}
            {insights.filter((i) => !pinnedTitles.has(i.title)).slice(0, 3).map((ins, i) => (
              <InsightCard key={i} ins={ins} hideAiMark pin={isGuest ? undefined : { pinned: false, onToggle: () => pinIns(ins) }} />
            ))}
          </div>
        </div>
      )}
    </>
  )
}

// Compact month/day tile — matches the neutral date tiles on the Events page.
function DateTile({ iso }) {
  return (
    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ink-50 text-center">
      <span className="font-mono text-[10px] font-semibold uppercase leading-none text-ink-500">
        {iso ? monthOf(iso) : 'TBD'}
      </span>
      {iso && <span className="font-display text-base font-bold leading-tight text-ink-900">{dayOf(iso)}</span>}
    </div>
  )
}

// A small card wrapping a titled list with a "View all" link and empty state.
function ListCard({ title, to, empty, className = '', children }) {
  const hasItems = Array.isArray(children) ? children.length > 0 : Boolean(children)
  return (
    <Card className={`flex flex-col p-5 ${className}`}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold text-ink-900">{title}</h3>
        <Link to={to} className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700">
          View all <ArrowRight size={14} />
        </Link>
      </div>
      {hasItems ? (
        <ul className="divide-y divide-ink-100">{children}</ul>
      ) : (
        <p className="grid flex-1 place-items-center py-6 text-center text-sm text-ink-400">{empty}</p>
      )}
    </Card>
  )
}

// Stat pill with a circular progress ring around the icon — fundraising % to goal.
function FundraisingPill({ raised, target }) {
  const pct = target > 0 ? Math.min(100, Math.round((raised / target) * 100)) : 0
  const C = 2 * Math.PI * 14 // r = 14
  return (
    <div className="inline-flex items-center gap-2.5 rounded-full border border-ink-200 bg-surface py-1.5 pl-1.5 pr-4 shadow-sm">
      <span className="relative grid h-8 w-8 shrink-0 place-items-center">
        <svg className="absolute inset-0 h-8 w-8 -rotate-90" viewBox="0 0 32 32">
          <circle cx="16" cy="16" r="14" fill="none" stroke="var(--color-ink-150)" strokeWidth="3" />
          <circle
            cx="16" cy="16" r="14" fill="none" stroke="var(--color-gold-500)" strokeWidth="3"
            strokeLinecap="round" strokeDasharray={`${(pct / 100) * C} ${C}`}
          />
        </svg>
        <PiggyBank size={15} className="text-gold-700" />
      </span>
      <span className="flex items-baseline gap-1.5">
        <span className="font-display text-lg font-bold leading-none tabular-nums text-ink-900">{pct}%</span>
        <span className="text-sm text-ink-500">to goal</span>
        <span className="text-xs text-ink-400">· ${raised.toLocaleString()} / ${target.toLocaleString()}</span>
      </span>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <>
      <div className="flex flex-wrap gap-3">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-11 w-40 rounded-full" />
        ))}
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="grid gap-6 sm:grid-cols-2">
            <Card className="p-5"><Skeleton className="h-5 w-32" /><Skeleton className="mt-4 h-24 w-full" /></Card>
            <Card className="p-5"><Skeleton className="h-5 w-32" /><Skeleton className="mt-4 h-24 w-full" /></Card>
          </div>
          <Card className="p-5"><Skeleton className="h-5 w-40" /><Skeleton className="mt-3 h-3 w-full" /></Card>
        </div>
        <Card className="p-5"><Skeleton className="h-5 w-28" /><Skeleton className="mt-4 h-44 w-full" /></Card>
      </div>
    </>
  )
}

/* ============================================================
   MOBILE DASHBOARD — bottom-tab shell layout (below lg)
   ============================================================ */

// Stat pill — icon chip + value + label, in the design's pill style.
function MPill({ icon: Icon, val, lab, tone }) {
  return (
    <div className="jh-pill">
      <span className={'jh-pill-ic tone-' + tone}><Icon size={17} /></span>
      <span className="jh-pill-val">{val}</span>
      <span className="jh-pill-lab">{lab}</span>
    </div>
  )
}

// Fundraising pill with a gold progress ring around the piggy-bank.
function MFundPill({ raised, target }) {
  const pct = target > 0 ? Math.min(100, Math.round((raised / target) * 100)) : 0
  const C = 2 * Math.PI * 13
  return (
    <div className="jh-pill">
      <span className="jh-pill-ic" style={{ position: 'relative', background: 'transparent' }}>
        <svg width="32" height="32" viewBox="0 0 32 32" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
          <circle cx="16" cy="16" r="13" fill="none" stroke="var(--ink-150)" strokeWidth="3" />
          <circle cx="16" cy="16" r="13" fill="none" stroke="var(--gold-500)" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${(pct / 100) * C} ${C}`} />
        </svg>
        <PiggyBank size={15} style={{ color: 'var(--gold-text)' }} />
      </span>
      <span className="jh-pill-val">{pct}%</span>
      <span className="jh-pill-lab">to goal</span>
    </div>
  )
}

function MobileDashSkeleton() {
  return (
    <>
      <h1 className="jh-h1">Dashboard</h1>
      <p className="jh-sub">{currentTerm()} term at a glance</p>
      <div className="jh-statrow">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-11 w-32 shrink-0 rounded-full" />)}
      </div>
      <Skeleton className="mt-5 h-44 w-full rounded-2xl" />
      <Skeleton className="mt-4 h-56 w-full rounded-2xl" />
    </>
  )
}

function DashboardMobile({ d, isGuest, pendingReqs, approvedReqs, deniedReqs, onDismiss, pins, insights, pinnedTitles, onPin, onUnpin, needsRecovery, userId }) {
  const navigate = useNavigate()
  const [lbView, setLbView] = useState('term')

  const fundRaised = Number(d.fundraising?.raised ?? 0)
  const fundTarget = Number(d.fundraising?.target ?? 500)
  const events = d.upcoming_events_list ?? []
  const meetings = d.upcoming_meetings_list ?? []
  const goals = Array.isArray(d.goals) ? d.goals : []
  const leaderboard = [...(d.leaderboard ?? [])]
    .sort((a, b) => (lbView === 'term' ? b.term_hours - a.term_hours : b.hours - a.hours))
    .slice(0, 4)
  const termEmpty = lbView === 'term' && Number(d.term_hours) === 0
  const liveInsights = (insights ?? []).filter((i) => !pinnedTitles.has(i.title)).slice(0, 3)

  return (
    <>
      <h1 className="jh-h1">Dashboard</h1>
      <p className="jh-sub">{currentTerm()} term at a glance</p>

      {isGuest && (
        <div className="jh-card jh-card-pad" style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ fontSize: 13, color: 'var(--ink-700)', lineHeight: 1.5 }}>
            You’re viewing the public dashboard. Sign in to sign up for events, log hours, and more.
          </p>
          <Link to="/login" className="jh-btn-primary"><LogIn size={16} /> Sign in</Link>
        </div>
      )}

      {needsRecovery && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 14 }}>
          <Link to={`/members/${userId}`} className="badge badge-gold" style={{ padding: '6px 11px', fontSize: 12 }}>
            <AlertTriangle size={13} /> Set a recovery email
          </Link>
        </div>
      )}

      {/* My hours-request status */}
      {(pendingReqs.length > 0 || approvedReqs.length > 0) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 14 }}>
          {pendingReqs.map((r) => (
            <span key={r.id} className="badge badge-gold" style={{ padding: '6px 11px', fontSize: 12 }}>
              <Clock size={13} /> Pending — {Number(r.hours)}h · {r.activity}
            </span>
          ))}
          {approvedReqs.map((r) => (
            <span key={r.id} className="badge badge-green" style={{ padding: '6px 11px', fontSize: 12 }}>
              <Check size={13} /> Approved — {Number(r.hours)}h
              <button onClick={() => onDismiss(r.id)} aria-label="Dismiss" style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', display: 'inline-flex', marginLeft: 2 }}><X size={12} /></button>
            </span>
          ))}
        </div>
      )}
      {deniedReqs.map((r) => (
        <div key={r.id} className="jh-card jh-card-pad" style={{ marginTop: 12, display: 'flex', gap: 10, borderColor: 'var(--coral-200)' }}>
          <span style={{ color: 'var(--coral-500)', flex: 'none' }}><AlertTriangle size={18} /></span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ fontWeight: 700, color: 'var(--ink-900)' }}>Hours request denied</p>
            <p style={{ marginTop: 2, fontSize: 13, color: 'var(--ink-700)' }}>
              Your request for {Number(r.hours)}h ({r.activity}) was denied{r.reviewer?.name ? ` by ${r.reviewer.name}` : ''}.
            </p>
            {r.denial_reason && <p style={{ marginTop: 4, fontSize: 13, color: 'var(--ink-600)' }}>Reason: {r.denial_reason}</p>}
          </div>
          <button onClick={() => onDismiss(r.id)} aria-label="Dismiss" style={{ background: 'none', border: 'none', color: 'var(--ink-400)', cursor: 'pointer', flex: 'none' }}><X size={16} /></button>
        </div>
      ))}

      {/* Stat pills */}
      <div className="jh-statrow">
        <MPill icon={Users} val={Number(d.members_count ?? 0)} lab="members" tone="green" />
        <MPill icon={Clock} val={`${Number(d.term_hours)}h`} lab="this term" tone="blue" />
        <MPill icon={CalendarDays} val={Number(d.events_term ?? 0)} lab="events" tone="green" />
        <MFundPill raised={fundRaised} target={fundTarget} />
      </div>

      {/* Upcoming */}
      <div className="jh-card jh-card-pad" style={{ marginTop: 18 }}>
        <div className="jh-card-head">
          <span className="jh-card-title">Upcoming</span>
          <Link to="/events" className="jh-viewall">View all <ArrowRight size={13} /></Link>
        </div>
        {events.length === 0 && meetings.length === 0 ? (
          <p style={{ padding: '14px 0 4px', fontSize: 13, color: 'var(--ink-400)' }}>No upcoming events or meetings.</p>
        ) : (
          <>
            {events.slice(0, 2).map((e) => (
              <Link key={e.id} to={`/events/${e.id}`} className="jh-row">
                <div className="jh-date">
                  <span className="jh-date-m">{e.date ? monthOf(e.date) : 'TBD'}</span>
                  {e.date && <span className="jh-date-d">{dayOf(e.date)}</span>}
                </div>
                <div className="jh-row-main">
                  <div className="jh-row-t">{e.name}</div>
                  <div className="jh-row-s">{e.location || 'Location TBD'}</div>
                </div>
                <span className="jh-count">{e.signups} in</span>
              </Link>
            ))}
            {meetings.slice(0, 1).map((m) => (
              <Link key={m.id} to={`/meetings/${m.id}`} className="jh-row">
                <div className="jh-date" style={{ background: 'var(--blue-soft)' }}>
                  <span className="jh-date-m" style={{ color: 'var(--blue-text)' }}>{m.date ? monthOf(m.date) : 'TBD'}</span>
                  {m.date && <span className="jh-date-d" style={{ color: 'var(--blue-text)' }}>{dayOf(m.date)}</span>}
                </div>
                <div className="jh-row-main">
                  <div className="jh-row-t">{m.title}</div>
                  <div className="jh-row-s">{m.start_time ? `${fmtTime(m.start_time)} PST · Meeting` : 'Meeting'}</div>
                </div>
                <span className="jh-count">{m.attendees} in</span>
              </Link>
            ))}
          </>
        )}
      </div>

      {/* Hours leaderboard */}
      <div className="jh-card jh-card-pad" style={{ marginTop: 14 }}>
        <div className="jh-card-head" style={{ marginBottom: 8 }}>
          <span className="jh-card-title">Hours leaderboard</span>
          <span className="jh-seg">
            <button className={lbView === 'term' ? 'on' : ''} onClick={() => setLbView('term')}>This term</button>
            <button className={lbView === 'all' ? 'on' : ''} onClick={() => setLbView('all')}>All time</button>
          </span>
        </div>
        {termEmpty ? (
          <div style={{ padding: '14px 0', textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: 'var(--ink-500)' }}>No hours logged yet this term.</p>
            <button onClick={() => setLbView('all')} className="jh-viewall" style={{ marginTop: 4 }}>See all-time hours</button>
          </div>
        ) : leaderboard.length === 0 ? (
          <p style={{ padding: '14px 0', textAlign: 'center', fontSize: 13, color: 'var(--ink-400)' }}>No hours logged yet.</p>
        ) : (
          leaderboard.map((m, i) => (
            <button key={m.id} className="jh-lb" onClick={() => !isGuest && navigate(`/members/${m.id}`)}>
              <span className="jh-rank">{i + 1}</span>
              {m.avatar_url
                ? <img className="jh-avatar" src={m.avatar_url} alt="" />
                : <span className={'jh-avatar av-' + (roleTones[m.role] ?? 'blue')}>{initials(m.name)}</span>}
              <span className="jh-lb-name">{m.name}</span>
              <span className="jh-lb-h">{lbView === 'term' ? m.term_hours : m.hours}h</span>
            </button>
          ))
        )}
      </div>

      {/* Leadership goals */}
      {goals.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div className="jh-card-head">
            <span className="jh-sec-title"><Target size={16} style={{ color: 'var(--green-text)' }} /> Leadership goals</span>
            <Link to="/goals" className="jh-viewall">View all <ArrowRight size={13} /></Link>
          </div>
          <div className="jh-goals">
            {goals.slice(0, 4).map((g) => (
              <div className="jh-card jh-goal" key={g.id}>
                <span className="jh-overline">{periodLabel(g.period)}</span>
                <div className="jh-goal-t"><Linkify>{g.title}</Linkify></div>
                {g.detail && <div className="jh-goal-d">{g.detail}</div>}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '12px 0 8px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-500)' }}>
                    {g.owner_name ? (
                      <>
                        <span className={'jh-avatar av-' + (roleTones[g.owner_role] ?? 'blue')} style={{ width: 20, height: 20, fontSize: 9 }}>{initials(g.owner_name)}</span>
                        {g.owner_name.split(' ')[0]}
                      </>
                    ) : 'Unassigned'}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--ink-700)' }}>{g.progress}%</span>
                </div>
                <div className="jh-prog"><i style={{ width: g.progress + '%' }} /></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI insights */}
      {(liveInsights.length > 0 || pins.length > 0) && (
        <div style={{ marginTop: 22 }}>
          <div className="jh-card-head">
            <span className="jh-sec-title"><Sparkles size={16} style={{ color: 'var(--blue-text)' }} /> AI insights</span>
            <Link to="/ai-planning" className="jh-viewall">View all <ArrowRight size={13} /></Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginTop: 4 }}>
            {pins.map((p) => (
              <InsightCard key={p.id} ins={p.payload} hideAiMark pin={{ pinned: true, onToggle: () => onUnpin(p.id) }} />
            ))}
            {liveInsights.map((ins, i) => (
              <InsightCard key={i} ins={ins} hideAiMark pin={isGuest ? undefined : { pinned: false, onToggle: () => onPin(ins) }} />
            ))}
          </div>
        </div>
      )}
    </>
  )
}
