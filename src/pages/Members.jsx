import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Clock, Trophy, Shield, UserPlus, Crown, Download, Loader2 } from 'lucide-react'
import { PageHeader, Card, StatPill, Badge, Avatar, Skeleton, Button, Modal, FormField, inputClass, roleLabels, roleTones, formatDate } from '../components/ui'
import { getMembersWithHours, getHoursBreakdowns, adminCreateUser, adminInviteUser } from '../lib/api'
import { exportAllHours } from '../lib/exportHours'
import { useAuth } from '../context/AuthContext'
import { useRealtime } from '../lib/useRealtime'
import { useIsDesktop } from '../lib/useMediaQuery'
import { useDocumentTitle } from '../lib/useDocumentTitle'

// Gold / silver / bronze for the top-3 hours leaders.
const TROPHY = ['#eab308', '#9ca3af', '#cd7f32']

export default function Members() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const isAdmin = !!profile?.is_admin
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const isDesktop = useIsDesktop()
  const [sortBy, setSortBy] = useState('total') // mobile list sort: 'total' | 'term'
  useDocumentTitle('Members & Hours')

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

  const totalHours = Math.round(members.reduce((s, m) => s + m.hours, 0) * 10) / 10
  const totalTermHours = Math.round(members.reduce((s, m) => s + (m.term_hours ?? 0), 0) * 10) / 10
  // Ranked most → least hours, so the list order + trophies line up.
  const ranked = [...members].sort((a, b) => b.hours - a.hours)

  if (!isDesktop)
    return (
      <MembersMobile
        members={members}
        loading={loading}
        isAdmin={isAdmin}
        exporting={exporting}
        onExport={exportAll}
        addOpen={addOpen}
        setAddOpen={setAddOpen}
        onAdded={load}
        sortBy={sortBy}
        setSortBy={setSortBy}
        totalHours={totalHours}
        totalTermHours={totalTermHours}
      />
    )

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
            {isAdmin && <Button icon={UserPlus} onClick={() => setAddOpen(true)}>Add Member</Button>}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        {loading ? (
          [0, 1].map((i) => <Skeleton key={i} className="h-11 w-40 rounded-full" />)
        ) : (
          <>
            <StatPill icon={Users} value={members.length} label="members" />
            <StatPill icon={Clock} value={`${totalTermHours}h`} label="term hours" tone="gold" />
            <StatPill icon={Clock} value={`${totalHours}h`} label="total hours" tone="blue" />
          </>
        )}
      </div>

      <div className="mt-6">
        <div className="ja-stagger grid gap-4 sm:grid-cols-2">
          <AccessCard
            icon={Users}
            title="Every member"
            tone="green"
            active={!isAdmin}
            items={[
              'Sign up for events & meetings',
              'Add & edit events, meetings, goals',
              'Claim to-dos · pin AI cards',
              'View, export & request hours',
            ]}
          />
          <AccessCard
            icon={Shield}
            title="Admins only"
            tone="blue"
            active={isAdmin}
            items={[
              'Add & remove members',
              'Edit roles, hours, names & emails',
              'Reset passwords · auto-hours rules',
              'See the full audit log',
            ]}
          />
        </div>
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
                  <th className="px-5 py-3 font-semibold">Term hours</th>
                  <th className="px-5 py-3 font-semibold">Total hours</th>
                </tr>
              </thead>
              <tbody className="ja-stagger divide-y divide-ink-100">
                {ranked.map((m, i) => (
                  <tr
                    key={m.id}
                    onClick={() => navigate(`/members/${m.id}`)}
                    className="cursor-pointer hover:bg-ink-50"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex w-5 shrink-0 justify-center">
                          {i < 3 ? (
                            <Trophy size={16} style={{ color: TROPHY[i] }} aria-label={`Rank ${i + 1}`} />
                          ) : (
                            <span className="font-mono text-xs font-semibold text-ink-400">{i + 1}</span>
                          )}
                        </span>
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
                    <td className="px-5 py-3 font-mono tabular-nums text-ink-600">{m.term_hours} hrs</td>
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

/* ============================================================
   MOBILE MEMBERS — bottom-tab shell layout (below lg)
   ============================================================ */
function MemberPill({ icon: Icon, val, lab, tone }) {
  return (
    <div className="jh-pill">
      <span className={'jh-pill-ic tone-' + tone}><Icon size={17} /></span>
      <span className="jh-pill-val">{val}</span>
      <span className="jh-pill-lab">{lab}</span>
    </div>
  )
}

function AccessCardMobile({ icon: Icon, tone, title, active, items }) {
  return (
    <div className={`acc-card ${tone === 'blue' ? 'blue ' : ''}${active ? 'on' : ''}`}>
      <div className="acc-head">
        <span className={`acc-title ${tone}`}><Icon size={13} /> {title}</span>
      </div>
      <div className="acc-list">
        {items.map((t) => <span className="acc-li" key={t}>{t}</span>)}
      </div>
    </div>
  )
}

function MembersMobile({ members, loading, isAdmin, exporting, onExport, addOpen, setAddOpen, onAdded, sortBy, setSortBy, totalHours, totalTermHours }) {
  const navigate = useNavigate()
  const ranked = [...members].sort((a, b) =>
    sortBy === 'total' ? b.hours - a.hours : (b.term_hours ?? 0) - (a.term_hours ?? 0),
  )

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="jh-action-btn" onClick={onExport} disabled={exporting}>
          {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} {exporting ? 'Exporting…' : 'Export'}
        </button>
      </div>

      <div className="jh-statrow">
        <MemberPill icon={Users} val={members.length} lab="members" tone="green" />
        <MemberPill icon={Clock} val={`${totalTermHours}h`} lab="term hours" tone="gold" />
        <MemberPill icon={Clock} val={`${totalHours}h`} lab="total hours" tone="blue" />
      </div>

      <div className="acc-grid">
        <AccessCardMobile
          icon={Users}
          tone="green"
          title="Every member"
          active={!isAdmin}
          items={['Sign up for events & meetings', 'Add & edit events, meetings, goals', 'Claim to-dos · pin AI cards', 'View, export & request hours']}
        />
        <AccessCardMobile
          icon={Shield}
          tone="blue"
          title="Admins only"
          active={isAdmin}
          items={['Add & remove members', 'Edit roles, hours, names & emails', 'Reset passwords · auto-hours rules', 'See the full audit log']}
        />
      </div>

      <div className="jh-card jh-card-pad" style={{ marginTop: 16 }}>
        <div className="jh-card-head" style={{ marginBottom: 6 }}>
          <span className="jh-card-title">All members</span>
          <span className="jh-seg">
            <button className={sortBy === 'total' ? 'on' : ''} onClick={() => setSortBy('total')}>Total</button>
            <button className={sortBy === 'term' ? 'on' : ''} onClick={() => setSortBy('term')}>This term</button>
          </span>
        </div>
        {loading ? (
          <p style={{ padding: '14px 0', fontSize: 13, color: 'var(--ink-400)' }}>Loading…</p>
        ) : members.length === 0 ? (
          <p style={{ padding: '14px 0', fontSize: 13, color: 'var(--ink-500)' }}>No members yet. The first person to sign up shows up here.</p>
        ) : (
          ranked.map((m, i) => (
            <button key={m.id} className="mem-row" onClick={() => navigate(`/members/${m.id}`)}>
              <span className="mem-rank">
                {i < 3 ? <Trophy size={18} style={{ color: TROPHY[i] }} /> : <span className="num">{i + 1}</span>}
              </span>
              {m.avatar_url
                ? <img className="jh-avatar" src={m.avatar_url} alt="" />
                : <span className={'jh-avatar av-' + (roleTones[m.role] ?? 'ink')}>{m.avatar}</span>}
              <div className="mem-main">
                <div className="mem-name">{m.name || '—'}</div>
                <div className="mem-roles">
                  <span className={'badge badge-' + (roleTones[m.role] ?? 'ink')}>{roleLabels[m.role] ?? 'Member'}</span>
                  {m.is_founder && <span className="badge badge-gold"><Crown size={11} /> Founder</span>}
                  {m.is_admin && <span className="badge badge-blue"><Shield size={11} /> Admin</span>}
                </div>
              </div>
              <div className="mem-hrs">
                <div className="mem-hrs-v">{sortBy === 'total' ? m.hours : (m.term_hours ?? 0)}h</div>
                <div className="mem-hrs-l">{sortBy === 'total' ? `${m.term_hours ?? 0}h term` : `${m.hours}h total`}</div>
              </div>
            </button>
          ))
        )}
      </div>

      {isAdmin && (
        <button className="jh-fab" onClick={() => setAddOpen(true)} aria-label="Add member">
          <UserPlus size={24} /> Add
        </button>
      )}
      <AddMemberModal open={addOpen} onClose={() => setAddOpen(false)} onAdded={onAdded} />
    </>
  )
}

// One access tier in "Who can do what". The tier that applies to the current
// user is highlighted with a tinted ring + a "Your access" chip.
function AccessCard({ icon: Icon, title, tone, active, items }) {
  const tones = {
    green: { ring: 'ring-green-300 bg-green-50/60', text: 'text-green-700', chip: 'green' },
    blue: { ring: 'ring-blue-300 bg-blue-50/60', text: 'text-blue-600', chip: 'blue' },
  }
  const t = tones[tone] ?? tones.green
  return (
    <div className={`rounded-xl border border-ink-200 p-4 ${active ? `bg-surface ring-1 ${t.ring}` : 'bg-surface'}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className={`flex items-center gap-1.5 font-mono text-2xs font-semibold uppercase tracking-[0.08em] ${t.text}`}>
          <Icon size={13} /> {title}
        </p>
        {active && <Badge tone={t.chip}>Your access</Badge>}
      </div>
      <ul className="space-y-1.5 text-sm text-ink-600">
        {items.map((it) => (
          <li key={it} className="flex items-start gap-2">
            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-ink-300" />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
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
