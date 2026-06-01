import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Clock, Award, Shield } from 'lucide-react'
import { PageHeader, Card, StatCard, Badge, Avatar, Skeleton, roleLabels, roleTones, formatDate } from '../components/ui'
import { getMembersWithHours } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useRealtime } from '../lib/useRealtime'

export default function Members() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const isAdmin = !!profile?.is_admin
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)

  const load = () =>
    getMembersWithHours().then((data) => {
      setMembers(data)
      setLoading(false)
    })

  useEffect(() => {
    load()
  }, [])
  useRealtime(['profiles', 'event_signups'], load)

  const totalHours = members.reduce((s, m) => s + m.hours, 0)
  const topMember = members.reduce((top, m) => (m.hours > (top?.hours ?? -1) ? m : top), null)

  return (
    <>
      <PageHeader
        title="Members"
        subtitle="Everyone in the Hub — click anyone to see their full profile."
        action={isAdmin ? <Badge tone="blue"><Shield size={12} /> Admin</Badge> : null}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {loading ? (
          [0, 1, 2].map((i) => (
            <Card key={i} className="p-5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-3 h-8 w-16" />
            </Card>
          ))
        ) : (
          <>
            <StatCard icon={Users} label="Members" value={members.length} />
            <StatCard icon={Clock} label="Total hours" value={totalHours} tone="blue" />
            <StatCard icon={Award} label="Most hours" value={topMember ? `${topMember.hours}h` : '—'} tone="green" hint={topMember?.name} />
          </>
        )}
      </div>

      <Card className="mt-6 overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="ml-auto h-4 w-16" />
              </div>
            ))}
          </div>
        ) : members.length === 0 ? (
          <p className="p-6 text-sm text-ink-500">No members yet. The first person to sign up shows up here.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-200 font-mono text-2xs uppercase tracking-[0.08em] text-ink-500">
                  <th className="px-5 py-3 font-semibold">Member</th>
                  <th className="px-5 py-3 font-semibold">Role</th>
                  <th className="px-5 py-3 font-semibold">Joined</th>
                  <th className="px-5 py-3 font-semibold">Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {members.map((m) => (
                  <tr
                    key={m.id}
                    onClick={() => navigate(`/members/${m.id}`)}
                    className="cursor-pointer hover:bg-ink-50"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar initials={m.avatar} tone={roleTones[m.role]} src={m.avatar_url} />
                        <div>
                          <p className="font-medium text-ink-900">{m.name || '—'}</p>
                          <p className="text-xs text-ink-500">{m.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge tone={roleTones[m.role] ?? 'ink'}>{roleLabels[m.role] ?? 'Member'}</Badge>
                        {m.is_admin && <Badge tone="blue"><Shield size={11} /> Admin</Badge>}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-ink-600">{m.joined_date ? formatDate(m.joined_date) : '—'}</td>
                    <td className="px-5 py-3 font-mono font-semibold tabular-nums text-ink-900">{m.hours} hrs</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}
