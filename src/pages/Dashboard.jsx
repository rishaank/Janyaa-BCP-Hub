import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, Clock, DollarSign, CalendarDays, ArrowRight } from 'lucide-react'
import {
  StatCard,
  Card,
  PageHeader,
  Avatar,
  ProgressBar,
  Skeleton,
  roleTones,
} from '../components/ui'
import { getMembersWithHours, getEvents, getSettings } from '../lib/api'
import { CURRENT_TERM } from '../data/mockData'
import AiInsightsCard from '../components/AiInsightsCard'

const TODAY = new Date().toISOString().slice(0, 10)

export default function Dashboard() {
  const [members, setMembers] = useState([])
  const [events, setEvents] = useState([])
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getMembersWithHours(), getEvents(), getSettings()]).then(([m, e, s]) => {
      setMembers(m)
      setEvents(e)
      setSettings(s)
      setLoading(false)
    })
  }, [])

  const totalHours = members.reduce((sum, m) => sum + m.hours, 0)
  const target = Number(settings?.raise_target ?? 500)
  const raised = settings?.gofundme_raised != null ? Number(settings.gofundme_raised) : 0
  const upcoming = events.filter((e) => e.date >= TODAY)
  const leaderboard = [...members].sort((a, b) => b.hours - a.hours).slice(0, 5)
  const topHours = Math.max(1, leaderboard[0]?.hours ?? 1)

  return (
    <>
      <PageHeader title="Dashboard" subtitle={`${CURRENT_TERM} term at a glance`} />

      {loading ? (
        <DashboardSkeleton />
      ) : (
        <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Users} label="Members" value={members.length} />
        <StatCard icon={Clock} label="Hours this term" value={totalHours} tone="sky" hint="across all members" />
        <StatCard icon={DollarSign} label="Raised" value={`$${raised.toLocaleString()}`} tone="emerald" hint={`of $${target.toLocaleString()} goal`} />
        <StatCard icon={CalendarDays} label="Upcoming events" value={upcoming.length} tone="amber" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Upcoming events + fundraising progress */}
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Upcoming events</h3>
              <Link to="/events" className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-500">
                View all <ArrowRight size={14} />
              </Link>
            </div>
            {upcoming.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">No upcoming events scheduled.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {upcoming.map((e) => (
                  <li key={e.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-indigo-50 text-center">
                      <span className="text-xs font-bold leading-none text-indigo-600">
                        {new Date(e.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
                      </span>
                      <span className="text-sm font-bold leading-tight text-indigo-700">
                        {new Date(e.date + 'T00:00:00').getDate()}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-900">{e.name}</p>
                      <p className="truncate text-sm text-slate-500">{e.location}</p>
                    </div>
                    <span className="shrink-0 text-sm text-slate-500">
                      {e.event_signups.length} signed up
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Fundraising goal</h3>
              <span className="text-sm text-slate-500">${raised.toLocaleString()} / ${target.toLocaleString()}</span>
            </div>
            <ProgressBar value={raised} max={target} tone="emerald" />
            <p className="mt-2 text-sm text-slate-500">
              {raised >= target
                ? '🎉 Goal reached!'
                : `$${(target - raised).toLocaleString()} to go to hit the goal.`}
            </p>
          </Card>
        </div>

        {/* Hours leaderboard */}
        <Card className="p-5">
          <h3 className="mb-4 font-semibold text-slate-900">Hours leaderboard</h3>
          {leaderboard.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">No hours logged yet.</p>
          ) : (
            <ul className="space-y-3">
              {leaderboard.map((m, i) => (
                <li key={m.id} className="flex items-center gap-3">
                  <span className="w-4 text-sm font-semibold text-slate-400">{i + 1}</span>
                  <Avatar initials={m.avatar} tone={roleTones[m.role]} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{m.name}</p>
                    <ProgressBar value={m.hours} max={topHours} />
                  </div>
                  <span className="text-sm font-semibold text-slate-700">{m.hours}h</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-6">
        <AiInsightsCard compact insights={settings?.ai_insights} />
      </div>
        </>
      )}
    </>
  )
}

function DashboardSkeleton() {
  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="p-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-3 h-8 w-16" />
          </Card>
        ))}
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-5">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="mt-4 h-28 w-full" />
          </Card>
          <Card className="p-5">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-3 h-3 w-full" />
          </Card>
        </div>
        <Card className="p-5">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="mt-4 h-44 w-full" />
        </Card>
      </div>
    </>
  )
}
