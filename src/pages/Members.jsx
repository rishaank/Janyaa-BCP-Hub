import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Clock, Award, Shield, UserPlus, Crown, Download, Loader2 } from 'lucide-react'
import { PageHeader, Card, StatCard, Badge, Avatar, Skeleton, Button, Modal, FormField, inputClass, roleLabels, roleTones, formatDate } from '../components/ui'
import { getMembersWithHours, getHoursBreakdowns, adminCreateUser, adminInviteUser } from '../lib/api'
import { exportAllHours } from '../lib/exportHours'
import { useAuth } from '../context/AuthContext'
import { useRealtime } from '../lib/useRealtime'

export default function Members() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const isAdmin = !!profile?.is_admin
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [exporting, setExporting] = useState(false)

  async function exportAll() {
    setExporting(true)
    await exportAllHours(await getHoursBreakdowns(null))
    setExporting(false)
  }

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
        action={
          <div className="flex items-center gap-2">
            <Button variant="soft" icon={exporting ? Loader2 : Download} loading={exporting} onClick={exportAll} disabled={exporting}>
              {exporting ? 'Exporting…' : 'Export hours'}
            </Button>
            {isAdmin && <Button icon={UserPlus} onClick={() => setAddOpen(true)}>Add member</Button>}
          </div>
        }
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
                        {m.is_founder && <Badge tone="gold"><Crown size={11} /> Founder</Badge>}
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

      <AddMemberModal open={addOpen} onClose={() => setAddOpen(false)} onAdded={load} />
    </>
  )
}

const tab = (active) =>
  `rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
    active ? 'border-green-500 bg-green-50 text-green-700' : 'border-ink-200 text-ink-600 hover:bg-ink-50'
  }`

function AddMemberModal({ open, onClose, onAdded }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [mode, setMode] = useState('invite') // 'invite' | 'password'
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [okMsg, setOkMsg] = useState('')

  function reset() {
    setName('')
    setEmail('')
    setPassword('')
    setMode('invite')
    setError('')
    setOkMsg('')
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    setOkMsg('')
    if (!email.trim()) return setError('Email is required.')
    if (mode === 'password' && password.length < 8) return setError('Password must be at least 8 characters.')
    setBusy(true)
    const res =
      mode === 'password'
        ? await adminCreateUser({ email: email.trim(), name: name.trim(), password })
        : await adminInviteUser({ email: email.trim(), name: name.trim() })
    setBusy(false)
    if (!res.ok) return setError(res.error || 'Something went wrong.')
    setOkMsg(mode === 'password' ? 'Account created.' : 'Invite email sent.')
    onAdded()
    setTimeout(() => {
      reset()
      onClose()
    }, 1200)
  }

  return (
    <Modal open={open} onClose={onClose} title="Add a member">
      <form onSubmit={submit} className="space-y-3">
        <FormField label="Name">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
        </FormField>
        <FormField label="School email">
          <input
            type="email"
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@bcp.org"
            required
          />
        </FormField>

        <div>
          <span className="mb-1 block text-sm font-semibold text-ink-800">How should they get in?</span>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setMode('invite')} className={tab(mode === 'invite')}>
              Send invite email
            </button>
            <button type="button" onClick={() => setMode('password')} className={tab(mode === 'password')}>
              Set a password
            </button>
          </div>
        </div>

        {mode === 'password' ? (
          <FormField label="Temporary password">
            <input
              type="text"
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
            <span className="mt-1 block text-xs text-ink-500">Share this with the member; they can change it later.</span>
          </FormField>
        ) : (
          <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
            We’ll email them a link to set their own password. (Requires SMTP to be configured.)
          </p>
        )}

        {error && <p className="text-sm text-coral-700">{error}</p>}
        {okMsg && <p className="text-sm font-medium text-green-700">{okMsg}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="soft" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Working…' : mode === 'password' ? 'Create account' : 'Send invite'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
