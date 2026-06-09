import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Users, Clock, ArrowRight, Sparkles, Target, LogIn, AlertTriangle, X,
} from 'lucide-react'
import {
  StatPill, Card, PageHeader, Avatar, ProgressBar, Button, Skeleton, roleTones,
} from '../components/ui'
import {
  getPublicDashboard, initials, getPins, addPin, removePin,
  getMyDeniedRequests, dismissHoursRequest,
} from '../lib/api'
import { CURRENT_TERM } from '../data/mockData'
import { useAuth } from '../context/AuthContext'
import { useRealtime } from '../lib/useRealtime'
import InsightCard from '../components/InsightCard'

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
  const [denied, setDenied] = useState([]) // my denied hours requests (red cards)
  const navigate = useNavigate()

  useEffect(() => {
    getPublicDashboard().then((data) => {
      setD(data)
      setLoading(false)
    })
  }, [])

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

  // Denied hours-request cards — persist until the requester dismisses them.
  const loadDenied = () => (user?.id ? getMyDeniedRequests(user.id).then(setDenied) : setDenied([]))
  useEffect(() => {
    loadDenied()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])
  useRealtime(['hours_requests'], loadDenied)
  async function dismissDenial(id) {
    await dismissHoursRequest(id)
    loadDenied()
  }

  if (loading) {
    return (
      <>
        <PageHeader title="Dashboard" subtitle={`${CURRENT_TERM} term at a glance`} />
        <DashboardSkeleton />
      </>
    )
  }

  if (!d) {
    return (
      <>
        <PageHeader title="Dashboard" subtitle={`${CURRENT_TERM} term at a glance`} />
        <Card className="p-6 text-sm text-ink-500">Couldn’t load the dashboard. Try again in a moment.</Card>
      </>
    )
  }

  const fundRaised = Number(d.fundraising?.raised ?? 0)
  const fundTarget = Number(d.fundraising?.target ?? 500)
  const insights = Array.isArray(d.insights) ? d.insights : []
  const pinnedTitles = new Set(pins.map((p) => p.payload?.title))
  const goals = Array.isArray(d.goals) ? d.goals : []
  const events = d.upcoming_events_list ?? []
  const meetings = d.upcoming_meetings_list ?? []

  const leaderboard = [...(d.leaderboard ?? [])]
    .sort((a, b) => (lbView === 'term' ? b.term_hours - a.term_hours : b.hours - a.hours))
    .slice(0, 5)
  const termEmpty = lbView === 'term' && Number(d.term_hours) === 0

  return (
    <>
      <PageHeader title="Dashboard" subtitle={`${CURRENT_TERM} term at a glance`} />

      {/* Denied hours-request cards — stay until dismissed */}
      {denied.map((r) => (
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
            onClick={() => dismissDenial(r.id)}
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
        <StatPill icon={Users} value={d.members_count} label="members" />
        <StatPill
          icon={Clock}
          value={`${Number(d.term_hours)}h`}
          label="this term"
          hint={`${Number(d.total_hours)}h all-time`}
          tone="blue"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Upcoming events + meetings + fundraising */}
        <div className="space-y-6 lg:col-span-2">
          <div className="grid gap-6 sm:grid-cols-2">
            <ListCard title="Upcoming events" to="/events" empty="No upcoming events scheduled.">
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

            <ListCard title="Upcoming meetings" to="/events?tab=meetings" empty="No meetings on the schedule.">
              {meetings.map((m) => (
                <li key={m.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <DateTile iso={m.date} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink-900">{m.title}</p>
                    <p className="truncate text-sm text-ink-500">{m.start_time ? fmtTime(m.start_time) : 'Time TBD'}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-600">{m.attendees} in</span>
                </li>
              ))}
            </ListCard>
          </div>

          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-ink-900">Fundraising goal</h3>
              <span className="text-sm text-ink-500 tabular-nums">
                ${fundRaised.toLocaleString()} / ${fundTarget.toLocaleString()}
              </span>
            </div>
            <ProgressBar value={fundRaised} max={fundTarget} tone="gold" />
            <p className="mt-2 text-sm text-ink-500">
              {fundRaised >= fundTarget
                ? '🎉 Goal reached!'
                : `$${(fundTarget - fundRaised).toLocaleString()} to go to hit the goal.`}
            </p>
          </Card>
        </div>

        {/* Hours leaderboard with term / all-time toggle */}
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h3 className="font-semibold text-ink-900">Hours leaderboard</h3>
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

      {/* Leadership goals */}
      {goals.length > 0 && (
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 font-semibold text-ink-900">
              <Target size={16} className="text-green-600" /> Leadership goals
            </h3>
            <Link to="/goals" className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {goals.slice(0, 3).map((g) => (
              <Card key={g.id} className="flex flex-col p-5">
                <h4 className="font-display text-h4 font-semibold text-ink-900">{g.title}</h4>
                {g.detail && <p className="mt-1 line-clamp-2 text-sm text-ink-600">{g.detail}</p>}
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
            <Link to="/insights" className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
function ListCard({ title, to, empty, children }) {
  const hasItems = Array.isArray(children) ? children.length > 0 : Boolean(children)
  return (
    <Card className="p-5">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold text-ink-900">{title}</h3>
        <Link to={to} className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700">
          View all <ArrowRight size={14} />
        </Link>
      </div>
      {hasItems ? (
        <ul className="divide-y divide-ink-100">{children}</ul>
      ) : (
        <p className="py-6 text-center text-sm text-ink-400">{empty}</p>
      )}
    </Card>
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
