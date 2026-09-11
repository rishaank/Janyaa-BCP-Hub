import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, Camera, Loader2, Shield, Crown, Plus, Pencil, Trash2, AlertTriangle, Download, Check,
  Sparkles, ArrowUpRight, ChevronDown, ChevronUp, KeyRound, CopyPlus, Search,
} from 'lucide-react'
import {
  Card,
  Badge,
  Avatar,
  Button,
  ProgressBar,
  FormField,
  Modal,
  inputClass,
  roleLabels,
  roleOptions,
  roleTones,
  formatDate,
  timeAgo,
  EditAccessChip,
  AccessChip,
} from '../components/ui'
import { toneMeta } from '../components/InsightCard'
import { generateTempPassword } from '../lib/tempPassword'
import { supabase } from '../lib/supabase'
import {
  getProfileDetails,
  adminUpdateProfile,
  uploadAvatar,
  removeAvatar,
  adminSetPassword,
  adminSetEmail,
  adminSendReset,
  getRecoveryEmail,
  setRecoveryEmail,
  adminDeleteUser,
  deleteOwnAccount,
  addHoursEntry,
  updateHoursEntry,
  deleteHoursEntry,
  copyHoursEntry,
  getEventsBrief,
  submitHoursRequest,
  generateMemberInsight,
  periodLabel,
  getMembersBrief,
} from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useIsDesktop } from '../lib/useMediaQuery'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { useRealtime } from '../lib/useRealtime'
import MemberChip from '../components/MemberChip'
import Linkify from '../components/Linkify'
import AvatarCropper from '../components/AvatarCropper'
import { exportMemberHours } from '../lib/exportHours'
import { laNow, hasEnded } from '../lib/time'
import { num } from '../lib/format'
import { useDraftRescue } from '../lib/useDraftRescue'
import { useToast } from '../context/ToastContext'

export default function ProfilePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, profile: me, signOut } = useAuth()
  const isAdmin = !!me?.is_admin
  const isOpsLead = me?.role === 'operations_lead'
  const isOwn = user?.id === id
  const isDesktop = useIsDesktop()

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [opsLead, setOpsLead] = useState(null) // current operations lead, shown on the request-hours hint

  const load = () =>
    getProfileDetails(id).then((d) => {
      setData(d)
      setLoading(false)
    })

  useEffect(() => {
    setLoading(true)
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    getMembersBrief().then((ms) => setOpsLead(ms.find((m) => m.role === 'operations_lead') ?? null))
  }, [])

  // Every card on this page is downstream of one of these. Without it an admin
  // adding this member to an event (or logging hours for them) left the profile
  // showing stale totals until a manual reload.
  useRealtime(['profiles', 'event_signups', 'event_todos', 'hours_grants', 'goals'], load)

  useDocumentTitle(data?.profile?.name)

  if (loading) return <p className="text-sm text-ink-500">Loading…</p>
  if (!data?.profile) return <p className="text-sm text-ink-500">Member not found.</p>

  const p = data.profile
  const now = laNow()
  // A tentative event has no date yet, so it sorts last rather than being
  // dereferenced — `hasEnded` puts undated events in `upcoming`, and reading
  // `.date` off one of them used to crash the whole page.
  const upcoming = data.events
    .filter((e) => !hasEnded(e, now))
    .sort((a, b) => (a.date ?? '9999-12-31').localeCompare(b.date ?? '9999-12-31'))
  const past = data.events.filter((e) => hasEnded(e, now)).sort((a, b) => b.date.localeCompare(a.date))

  return (
    <>
      <button
        onClick={() => navigate(-1)}
        data-nav-guard
        className="mb-4 -ml-2.5 inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800"
      >
        <ArrowLeft size={16} /> Back
      </button>

      {/* Header */}
      {isDesktop ? (
        <Card className="p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <ProfilePhoto profile={p} canEdit={isOwn || isAdmin} onChange={load} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-h2 font-bold text-ink-900">{p.name || '—'}</h1>
                <Badge tone={roleTones[p.role] ?? 'ink'}>{roleLabels[p.role] ?? 'Member'}</Badge>
                {p.is_founder && (
                  <Badge tone="gold"><Crown size={11} /> Founder</Badge>
                )}
                {p.is_admin && (
                  <Badge tone="blue"><Shield size={11} /> Admin</Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-ink-500">
                {p.email}
                {p.joined_date && ` · joined ${formatDate(p.joined_date)}`}
              </p>
            </div>
            <div className="text-center sm:text-right">
              <p className="font-mono text-4xl font-bold tabular-nums text-ink-900">{num(data.hours)}</p>
              <p className="text-xs text-ink-500">volunteer hours</p>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="p-6">
          <div className="flex flex-col items-center text-center">
            <ProfilePhoto profile={p} canEdit={isOwn || isAdmin} onChange={load} />
            <h1 className="mt-3 font-display text-h3 font-bold text-ink-900">{p.name || '—'}</h1>
            <p className="mt-1 text-sm text-ink-500">
              {p.email}
              {p.joined_date && ` · joined ${formatDate(p.joined_date)}`}
            </p>
            <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2">
              <Badge tone={roleTones[p.role] ?? 'ink'}>{roleLabels[p.role] ?? 'Member'}</Badge>
              {p.is_founder && <Badge tone="gold"><Crown size={11} /> Founder</Badge>}
              {p.is_admin && <Badge tone="blue"><Shield size={11} /> Admin</Badge>}
            </div>
            <div className="mt-4 flex items-baseline gap-1.5">
              <span className="font-mono text-3xl font-bold tabular-nums text-ink-900">{num(data.hours)}</span>
              <span className="text-xs text-ink-500">volunteer hours</span>
            </div>
          </div>
        </Card>
      )}

      <MemberInsightCard profile={p} canRefresh={isOwn || isAdmin} onChanged={load} />

      <HoursBreakdown
        breakdown={data.breakdown}
        canDirectEdit={isOpsLead}
        canRequest={!isOpsLead && (isOwn || isAdmin)}
        isOwn={isOwn}
        memberId={id}
        memberName={p.name}
        opsLead={opsLead}
        onChange={load}
      />

      {/* Upcoming + attended events + claimed to-dos, side by side at equal height.
          `min-w-0`: grid items floor at min-content, and these cards' rows are
          `truncate` (white-space: nowrap), so without it the single mobile column
          is sized to the longest untruncated row and the page scrolls sideways. */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3 lg:items-stretch">
        <EventList title="Upcoming Events" events={upcoming} empty="Not signed up for anything upcoming." className="h-full min-w-0" />
        <EventList title="Attended Events" events={past} empty="No past events yet." className="h-full min-w-0" />
        <ToDosCard todos={data.todos} className="h-full min-w-0" />
      </div>

      {data.goals?.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-3 font-semibold text-ink-900">Goals · {data.goals.length}</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.goals.map((g) => (
              <ProfileGoalCard key={g.id} goal={g} />
            ))}
          </div>
        </div>
      )}

      {isAdmin && (
        <AdminControls
          member={p}
          isSelf={user?.id === p.id}
          onSaved={load}
          onDeleted={() => navigate('/members')}
        />
      )}

      {/* You're already signed in, so changing your own password needs no email
          round trip — that's what the recovery address below is for, and only
          when you can't get in at all. */}
      {isOwn && <ChangePasswordCard />}

      {/* Admins edit their recovery email inside Admin Controls instead. */}
      {isOwn && !isAdmin && <RecoveryEmailCard memberId={p.id} />}

      {isOwn && (
        <SelfDangerZone
          onDeleted={async () => {
            await signOut()
            navigate('/', { replace: true })
          }}
        />
      )}
    </>
  )
}

// One personal AI insight — progress + areas to improve — cached on the profile
// and auto-refreshed monthly (the Edge Function ignores fresh caches, so the
// background call on mount is free). Refresh = the member themself or an admin.
function MemberInsightCard({ profile: p, canRefresh, onChanged }) {
  const ins = p.ai_insight
  const [busy, setBusy] = useState(false)

  // Monthly auto-refresh: quietly regenerate when missing or >30 days old.
  useEffect(() => {
    const ageDays = p.ai_insight_at ? (Date.now() - new Date(p.ai_insight_at).getTime()) / 86400000 : Infinity
    if (p.ai_insight && ageDays < 30) return
    let alive = true
    setBusy(true)
    generateMemberInsight(p.id, false).then(({ data }) => {
      if (!alive) return
      setBusy(false)
      if (data?.ok && !data.cached) onChanged()
    })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.id])

  const meta = toneMeta[ins?.tone] ?? toneMeta.neutral
  const Icon = meta.icon

  return (
    <Card className="mt-6 p-5">
      <div className="flex items-start gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-md ${meta.iconBg}`}>
          {busy && !ins ? <Loader2 size={20} className="animate-spin" /> : <Icon size={20} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="min-w-0">
            {ins ? (
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-h4 font-semibold text-ink-900">{ins.title}</h3>
                {ins.metric && <Badge tone={meta.chip}>{ins.metric}</Badge>}
                <Sparkles size={13} className="text-ink-300" aria-label="AI-generated" />
              </div>
            ) : (
              <h3 className="flex items-center gap-1.5 font-display text-h4 font-semibold text-ink-900">
                AI insight <Sparkles size={13} className="text-ink-300" />
              </h3>
            )}
          </div>
          {ins ? (
            <>
              <p className="mt-1 text-sm text-ink-600">{ins.detail}</p>
              {ins.improve && (
                <p className="mt-2 flex items-start gap-1.5 text-sm text-ink-700">
                  <ArrowUpRight size={15} className="mt-0.5 shrink-0 text-green-600" />
                  <span><span className="font-semibold">Try next:</span> {ins.improve}</span>
                </p>
              )}
            </>
          ) : (
            <p className="mt-1 text-sm text-ink-500">
              {busy
                ? 'Reading the volunteering history — this takes ~10 seconds.'
                : 'A personal look at progress and what to try next appears here once generated.'}
            </p>
          )}
        </div>
      </div>
      {canRefresh && ins && p.ai_insight_at && !busy && (
        <p className="mt-3 text-right text-xs text-ink-400">
          Auto-refreshes monthly · updated {timeAgo(p.ai_insight_at)}
        </p>
      )}
    </Card>
  )
}


// Change your own password, in place. A signed-in member has already proved who
// they are, so mailing them a link would just be a slower way to reach the same
// updateUser call. The current password is still asked for: it's what stops
// someone who walks up to an unlocked laptop from taking the account over.
function ChangePasswordCard() {
  const [searchParams, setSearchParams] = useSearchParams()
  // The Layout nudge links here with ?password=1 so "Change password" lands on
  // the open form, not on the page with the form somewhere down it.
  const [open, setOpen] = useState(searchParams.get('password') === '1')
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState(false)
  const { user } = useAuth()

  function close() {
    setOpen(false)
    setCurrent('')
    setNext('')
    setConfirm('')
    setErr('')
    if (searchParams.get('password')) {
      searchParams.delete('password')
      setSearchParams(searchParams, { replace: true })
    }
  }

  async function submit(e) {
    e.preventDefault()
    setErr('')
    if (next.length < 8) return setErr('Use at least 8 characters.')
    if (next !== confirm) return setErr('The new passwords don’t match.')
    setBusy(true)
    // Re-authenticate first. Same user, so this only refreshes the session.
    const { error: authErr } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: current,
    })
    if (authErr) {
      setBusy(false)
      return setErr('That current password isn’t right.')
    }
    const { error } = await supabase.auth.updateUser({
      password: next,
      data: { must_set_password: false },
    })
    setBusy(false)
    if (error) return setErr(error.message)
    setDone(true)
    setTimeout(() => setDone(false), 4000)
    close()
  }

  return (
    <Card className="mt-6 p-5">
      <div className="mb-2 flex items-center gap-2">
        <KeyRound size={16} className="text-blue-600" />
        <h3 className="font-display text-h4 font-semibold text-ink-900">Password</h3>
      </div>
      <p className="text-sm text-ink-600">
        Change the password you sign in with. No email needed — you're already signed in.
      </p>
      <div className="mt-3 flex items-center gap-3">
        <Button variant="soft" type="button" onClick={() => setOpen(true)}>
          Change password
        </Button>
        {done && <span className="text-sm font-medium text-green-700">Password updated</span>}
      </div>

      <Modal open={open} onClose={close} title="Change your password">
        <form onSubmit={submit} className="space-y-3">
          <FormField label="Current password">
            <input
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className={inputClass}
              autoFocus
            />
          </FormField>
          <FormField label="New password">
            <input
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              placeholder="At least 8 characters"
              className={inputClass}
            />
          </FormField>
          <FormField label="Confirm new password">
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={inputClass}
            />
          </FormField>
          {err && <p className="text-sm text-coral-700">{err}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="soft" type="button" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Change password'}
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  )
}

// Self-service account + data deletion, shown on your own profile (SB 568 eraser).
// A personal address to receive password-reset links at. School Microsoft
// mailboxes quarantine or badly delay our mail, so members set a second inbox
// here — they still SIGN IN with the school email. Own-row + admin readable.
function RecoveryEmailCard({ memberId }) {
  const [email, setEmail] = useState('')
  const [saved, setSaved] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    getRecoveryEmail(memberId).then((e) => {
      setEmail(e)
      setSaved(e)
    })
  }, [memberId])

  async function save() {
    const next = email.trim()
    setErr('')
    setMsg('')
    if (next && !next.includes('@')) return setErr('Enter a valid email address.')
    setBusy(true)
    const { error } = await setRecoveryEmail(memberId, next)
    setBusy(false)
    if (error) return setErr(error.message)
    setSaved(next.toLowerCase())
    setEmail(next.toLowerCase())
    setMsg(next ? 'Recovery email saved.' : 'Recovery email removed.')
  }

  return (
    <Card className="mt-6 p-5">
      <div className="mb-2 flex items-center gap-2">
        <KeyRound size={16} className="text-blue-600" />
        <h3 className="font-display text-h4 font-semibold text-ink-900">Recovery Email</h3>
      </div>
      <p className="text-sm text-ink-600">
        For the day you're locked out. <b>Forgot password?</b> on the sign-in screen mails a reset
        link here — never to your school email, which quarantines our mail. You still sign in with
        the school address, and while you're signed in you change your password above, not by email.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@gmail.com"
          className={`${inputClass} sm:flex-1`}
        />
        <Button variant="soft" type="button" onClick={save} disabled={busy || email.trim() === saved}>
          {busy ? 'Saving…' : saved && !email.trim() ? 'Remove' : 'Save'}
        </Button>
      </div>
      {msg && <p className="mt-2 text-xs font-medium text-green-700">{msg}</p>}
      {err && <p className="mt-2 text-xs text-coral-700">{err}</p>}
      {!saved && !msg && (
        <p className="mt-2 text-xs text-gold-700">
          No recovery email set — if you forget your password, nobody can mail you a reset link.
        </p>
      )}
    </Card>
  )
}

function SelfDangerZone({ onDeleted }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function remove() {
    if (
      !window.confirm(
        'Delete your account and all your data? This removes your profile, photo, event sign-ups, and meeting attendance. This cannot be undone.',
      )
    )
      return
    setBusy(true)
    setErr('')
    const res = await deleteOwnAccount()
    if (!res.ok) {
      setBusy(false)
      setErr(res.error || 'Could not delete your account. Please try again or contact a club lead.')
      return
    }
    await onDeleted()
  }

  return (
    <Card className="mt-6 border-coral-200 p-5">
      <div className="mb-2 flex items-center gap-2">
        <AlertTriangle size={16} className="text-coral-600" />
        <h3 className="font-display text-h4 font-semibold text-ink-900">Delete Your Account</h3>
      </div>
      <p className="text-sm text-ink-600">
        Permanently delete your account and personal data — your profile, photo, event sign-ups, and
        meeting attendance. This can&rsquo;t be undone.
      </p>
      {err && <p className="mt-2 text-xs text-coral-700">{err}</p>}
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-coral-200 bg-surface px-3.5 py-2 text-sm font-semibold text-coral-700 transition-colors hover:bg-coral-50 disabled:opacity-60"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
        {busy ? 'Deleting…' : 'Delete my account'}
      </button>
    </Card>
  )
}

function ProfilePhoto({ profile, canEdit, onChange }) {
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [cropSrc, setCropSrc] = useState(null)

  function onFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setCropSrc(URL.createObjectURL(file)) // open the cropper instead of uploading raw
    e.target.value = '' // let the same file be re-picked later
  }
  async function onCropped(file) {
    const url = cropSrc
    setCropSrc(null)
    setBusy(true)
    await uploadAvatar(profile.id, file)
    setBusy(false)
    if (url) URL.revokeObjectURL(url)
    onChange()
  }
  function cancelCrop() {
    if (cropSrc) URL.revokeObjectURL(cropSrc)
    setCropSrc(null)
  }
  async function useDefault() {
    setBusy(true)
    await removeAvatar(profile.id)
    setBusy(false)
    onChange()
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative">
        <Avatar size="lg" initials={profile.avatar} tone={roleTones[profile.role] ?? 'blue'} src={profile.avatar_url} />
        {canEdit && (
          <button
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            title="Upload photo"
            className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-green-600 text-white ring-2 ring-surface transition-colors hover:bg-green-700 disabled:opacity-60"
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
          </button>
        )}
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
      </div>
      {canEdit && profile.avatar_url && (
        <button onClick={useDefault} className="text-xs text-ink-400 transition-colors hover:text-ink-700">
          Use default
        </button>
      )}
      <AvatarCropper open={!!cropSrc} src={cropSrc} onCancel={cancelCrop} onSave={onCropped} />
    </div>
  )
}

const kindMeta = {
  event: { label: 'Event', tone: 'green' },
  // A ledger row written for attending an event dated before the hours cutoff
  // (migration 0034) — same thing to the member as a derived `event` row.
  signup: { label: 'Event', tone: 'green' },
  meeting: { label: 'Meeting', tone: 'blue' },
  // The meeting counterpart of `signup` (migration 0036).
  attendance: { label: 'Meeting', tone: 'blue' },
  role_monthly: { label: 'Role · monthly', tone: 'gold' },
  role_event: { label: 'Role · per event', tone: 'gold' },
  manual: { label: 'Manual', tone: 'ink' },
  import: { label: 'Logged', tone: 'ink' },
}

// Itemized hours history (Feature 3) — every entry that makes up the total, with
// an Excel export. Admins can add, edit, or remove ledger entries (event hours,
// imported rows, role/manual grants) inline; derived event sign-ups and meeting
// attendance (no grant_id) are read-only here and managed on their own pages.
function HoursBreakdown({ breakdown, canDirectEdit, canRequest, isOwn, memberId, memberName, opsLead, onChange }) {
  const entries = breakdown?.entries ?? []
  const [modalOpen, setModalOpen] = useState(false)
  const [editEntry, setEditEntry] = useState(null)
  const [requestOpen, setRequestOpen] = useState(false)
  const [copyEntry, setCopyEntry] = useState(null) // entry being copied onto other members
  const [showAll, setShowAll] = useState(false)
  const shownEntries = showAll ? entries : entries.slice(0, 5)

  function openAdd() {
    setEditEntry(null)
    setModalOpen(true)
  }
  function openEdit(entry) {
    setEditEntry(entry)
    setModalOpen(true)
  }
  async function remove(entry) {
    if (!window.confirm(`Remove "${entry.description}" (${num(entry.hours)}h)? This can't be undone.`)) return
    await deleteHoursEntry(entry.grant_id)
    onChange()
  }

  return (
    <Card className="mt-6 p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold text-ink-900">
          Hours Breakdown
          {canDirectEdit && <EditAccessChip />}
        </h3>
        <div className="flex items-center gap-3">
          {entries.length > 0 && (
            <Button variant="soft" icon={Download} onClick={() => exportMemberHours(breakdown)}>Export</Button>
          )}
          {canDirectEdit && <Button icon={Plus} onClick={openAdd}>Add Hours</Button>}
          {canRequest && <Button icon={Plus} onClick={() => setRequestOpen(true)}>Request Hours</Button>}
        </div>
      </div>
      {canRequest && (
        <p className="mb-3 rounded-lg bg-blue-50 px-3 py-2 text-xs leading-relaxed text-blue-700">
          {isOwn
            ? 'Request hours for activities outside events & meetings — the operations lead'
            : `Submit a request on ${memberName || 'this member'}’s behalf — the operations lead`}
          {opsLead && (
            <>
              {' '}
              <span className="inline-flex items-center align-middle">(<MemberChip id={opsLead.id} name={opsLead.name} role={opsLead.role} />)</span>
            </>
          )}
          {' '}
          {isOwn ? 'approves them.' : 'approves it.'}
        </p>
      )}
      {entries.length === 0 ? (
        <p className="text-sm text-ink-400">No hours logged yet.</p>
      ) : (
        <>
        <ul className="divide-y divide-ink-100">
          {shownEntries.map((e, i) => {
            const meta = kindMeta[e.kind] ?? { label: e.kind, tone: 'ink' }
            const editable = canDirectEdit && !!e.grant_id
            return (
              <li key={e.grant_id ?? i} className="group flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  {e.event_id ? (
                    <Link to={`/events/${e.event_id}`} className="block truncate text-sm font-medium text-ink-800 transition-colors hover:text-green-700">
                      {e.description}
                    </Link>
                  ) : e.meeting_id ? (
                    <Link to={`/meetings/${e.meeting_id}`} className="block truncate text-sm font-medium text-ink-800 transition-colors hover:text-green-700">
                      {e.description}
                    </Link>
                  ) : (
                    <p className="truncate text-sm text-ink-800">{e.description}</p>
                  )}
                  <p className="text-xs text-ink-400">{e.date ? formatDate(e.date) : 'Multiple / undated'}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                  <span className="w-14 text-right font-mono text-sm font-semibold tabular-nums text-ink-700">{num(e.hours)}h</span>
                  {canDirectEdit && (
                    <button
                      onClick={() => setCopyEntry(e)}
                      title="Copy these hours to another member"
                      aria-label="Copy these hours to another member"
                      className="rounded-md p-1.5 text-ink-400 transition-all hover:bg-green-50 hover:text-green-700 focus-visible:opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                    >
                      <CopyPlus size={13} />
                    </button>
                  )}
                  {editable && (
                    <span className="flex items-center gap-0.5">
                      <button
                        onClick={() => openEdit(e)}
                        className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-blue-600"
                        aria-label="Edit entry"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => remove(e)}
                        className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-coral-50 hover:text-coral-600"
                        aria-label="Delete entry"
                      >
                        <Trash2 size={13} />
                      </button>
                    </span>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
        {entries.length > 5 && <ShowMore expanded={showAll} total={entries.length} onToggle={() => setShowAll((v) => !v)} />}
        </>
      )}
      {canDirectEdit && (
        <p className="mt-3 text-xs text-ink-400">
          Logged, role, and imported entries can be edited here. Event sign-ups and meeting attendance
          are managed on the Events &amp; Meetings page. Hover any row to copy those hours onto another
          member — handy when several people did the same thing.
        </p>
      )}
      <HoursEntryModal
        open={modalOpen}
        entry={editEntry}
        memberId={memberId}
        onClose={() => setModalOpen(false)}
        onReopen={() => setModalOpen(true)}
        onSaved={() => {
          setModalOpen(false)
          onChange()
        }}
      />
      <HoursRequestModal
        open={requestOpen}
        requesterId={memberId}
        targetName={memberName}
        onBehalf={!isOwn}
        onClose={() => setRequestOpen(false)}
        onReopen={() => setRequestOpen(true)}
        onSaved={() => setRequestOpen(false)}
      />
      <CopyHoursModal
        entry={copyEntry}
        fromId={memberId}
        fromName={memberName}
        onClose={() => setCopyEntry(null)}
        onCopied={() => {
          setCopyEntry(null)
          onChange()
        }}
      />
    </Card>
  )
}

// Member request form — sends an hours request to the operations lead (who
// approves or denies it). Used in place of "Add hours" for non-admins.
function HoursRequestModal({ open, requesterId, targetName, onBehalf = false, onClose, onReopen, onSaved }) {
  const [activity, setActivity] = useState('')
  const [hours, setHours] = useState('')
  const [contribution, setContribution] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState(false)
  // Closing a half-filled request says so and offers Undo instead of binning it.
  const draft = { activity, hours, contribution }
  const rescue = useDraftRescue({ label: 'Request', value: draft, onClose, reopen: onReopen ?? onClose, enabled: !done })

  useEffect(() => {
    if (!open) return // never wipe the fields on the way out — Undo still needs them
    if (rescue.consumeRestore()) return // Undo — keep the rescued draft on screen
    setActivity('')
    setHours('')
    setContribution('')
    setErr('')
    setDone(false)
    rescue.setBaseline({ activity: '', hours: '', contribution: '' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function submit(e) {
    e.preventDefault()
    setErr('')
    setBusy(true)
    const res = await submitHoursRequest({
      requesterId,
      activity: activity.trim(),
      hours,
      contribution: contribution.trim(),
    })
    setBusy(false)
    if (!res.ok) return setErr(res.error || 'Could not send your request.')
    setDone(true)
    setTimeout(onSaved, 1600)
  }

  return (
    <Modal open={open} onClose={rescue.close} title={onBehalf ? `Request hours for ${targetName || 'member'}` : 'Request hours'}>
      {done ? (
        <div className="py-4 text-center">
          <div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full bg-green-50 text-green-600">
            <Check size={20} />
          </div>
          <p className="font-semibold text-ink-900">Request sent</p>
          <p className="mt-1 text-sm text-ink-600">
            The operations lead will review it. The hours show up here once they&rsquo;re approved.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
            {onBehalf
              ? `You’re submitting this on ${targetName || 'this member'}’s behalf. It goes to the operations lead to approve.`
              : 'Your request goes to the operations lead to approve. If it’s denied, you’ll see why on your dashboard.'}
          </p>
          <FormField label="Activity">
            <input className={inputClass} value={activity} onChange={(e) => setActivity(e.target.value)} required placeholder="e.g. Sunday Friends outreach" />
          </FormField>
          <FormField label="Hours">
            <input type="number" min="0" step="0.5" className={inputClass} value={hours} onChange={(e) => setHours(e.target.value)} required />
          </FormField>
          <FormField label="Clarify contribution · optional">
            <textarea
              className={inputClass}
              rows={3}
              value={contribution}
              onChange={(e) => setContribution(e.target.value)}
              placeholder="What did you do? Anything that helps the review."
            />
          </FormField>
          {err && <p className="text-sm text-coral-700">{err}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="soft" type="button" onClick={rescue.close}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? 'Sending…' : 'Request'}</Button>
          </div>
        </form>
      )}
    </Modal>
  )
}

// Admin add/edit form for a single hours ledger entry. Optionally links the entry
// to an event (so it shows on the event page and in exports).
function HoursEntryModal({ open, entry, memberId, onClose, onReopen, onSaved }) {
  const editing = Boolean(entry)
  const [hours, setHours] = useState('')
  const [date, setDate] = useState('')
  const [note, setNote] = useState('')
  const [eventId, setEventId] = useState('')
  const [events, setEvents] = useState([])
  const [busy, setBusy] = useState(false)
  // Closing a half-filled form says so and offers Undo instead of binning it.
  const draft = { hours, date, note, eventId }
  const rescue = useDraftRescue({ label: 'Hours', value: draft, onClose, reopen: onReopen ?? onClose })

  useEffect(() => {
    if (open) getEventsBrief().then(setEvents)
  }, [open])

  useEffect(() => {
    if (!open) return // never wipe the fields on the way out — Undo still needs them
    if (rescue.consumeRestore()) return // Undo — keep the rescued draft on screen
    const next = entry
      ? {
          hours: String(entry.hours ?? ''),
          date: entry.date ?? '',
          note: entry.description === 'Hours' ? '' : entry.description ?? '',
          eventId: entry.event_id ?? '',
        }
      : { hours: '', date: '', note: '', eventId: '' }
    setHours(next.hours)
    setDate(next.date)
    setNote(next.note)
    setEventId(next.eventId)
    rescue.setBaseline(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry, open])

  // Picking an event pre-fills a blank description/date from it.
  function pickEvent(id) {
    setEventId(id)
    const ev = events.find((e) => e.id === id)
    if (ev) {
      if (!note.trim()) setNote(ev.name)
      if (!date && ev.date) setDate(ev.date)
    }
  }

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    if (editing) {
      await updateHoursEntry(entry.grant_id, {
        hours: Number(hours),
        entry_date: date || null,
        note: note || null,
        event_id: eventId || null,
      })
    } else {
      await addHoursEntry({ memberId, hours, note, entryDate: date, eventId })
    }
    setBusy(false)
    onSaved()
  }

  return (
    <Modal open={open} onClose={rescue.close} title={editing ? 'Edit hours entry' : 'Add hours'}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 min-[22rem]:grid-cols-2">
          <FormField label="Hours">
            <input type="number" min="0" step="0.5" className={inputClass} value={hours} onChange={(e) => setHours(e.target.value)} required />
          </FormField>
          <FormField label="Date · optional">
            <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
          </FormField>
        </div>
        <FormField label="Description">
          <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Sunday Friends outreach" required />
        </FormField>
        <FormField label="Link to an event · optional">
          <select className={inputClass} value={eventId} onChange={(e) => pickEvent(e.target.value)}>
            <option value="">No linked event</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name}{ev.date ? ` · ${formatDate(ev.date)}` : ''}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-ink-500">Links the entry to an event so it shows on the event view and in exports.</span>
        </FormField>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="soft" type="button" onClick={rescue.close}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save Changes' : 'Add Hours'}</Button>
        </div>
      </form>
    </Modal>
  )
}

// Copy one hours entry onto other members (operations lead). The same activity
// often covers several people — a shift someone logged for the whole group, an
// imported row that was only credited to one of them — and re-typing it on every
// profile is where the ledger drifts. Each pick gets its own editable `manual`
// row carrying the original's hours, date, description and event/meeting link.
function CopyHoursModal({ entry, fromId, fromName, onClose, onCopied }) {
  const { showToast } = useToast()
  const [members, setMembers] = useState([])
  const [picked, setPicked] = useState([])
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const open = Boolean(entry)

  useEffect(() => {
    if (!open) return
    setPicked([])
    setQuery('')
    setErr('')
    getMembersBrief().then((ms) => setMembers(ms.filter((m) => m.id !== fromId)))
  }, [open, fromId])

  const shown = members.filter((m) => (m.name ?? '').toLowerCase().includes(query.trim().toLowerCase()))
  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  async function copy() {
    setErr('')
    setBusy(true)
    const res = await copyHoursEntry({ entry, memberIds: picked })
    setBusy(false)
    if (!res.ok) return setErr(res.error || 'Could not copy those hours.')
    const names = picked.map((id) => members.find((m) => m.id === id)?.name).filter(Boolean)
    showToast({
      tone: 'green',
      message: `Copied to ${picked.length} member${picked.length === 1 ? '' : 's'}`,
      detail: `${num(entry.hours)}h · ${names.join(', ')}`,
    })
    onCopied()
  }

  return (
    <Modal open={open} onClose={onClose} title="Copy hours to another member">
      <div className="space-y-3">
        <div className="rounded-lg border border-ink-200 bg-ink-50/60 px-3 py-2.5">
          <p className="truncate text-sm font-semibold text-ink-900">{entry?.description}</p>
          <p className="mt-0.5 text-xs text-ink-500">
            {num(entry?.hours)}h · {entry?.date ? formatDate(entry.date) : 'Undated'}
            {fromName ? ` · from ${fromName}` : ''}
          </p>
        </div>
        <p className="text-xs text-ink-500">
          Each member picked gets their own editable entry — worth a glance that they aren&rsquo;t already
          credited for it.
        </p>
        <FormField label="Copy to">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              className={`${inputClass} pl-9`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search members…"
            />
          </div>
        </FormField>
        <ul className="max-h-64 space-y-1 overflow-y-auto">
          {shown.length === 0 && <li className="py-4 text-center text-sm text-ink-400">No members match.</li>}
          {shown.map((m) => (
            <li key={m.id}>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-ink-200 px-3 py-2 transition-colors hover:bg-ink-50">
                <input
                  type="checkbox"
                  checked={picked.includes(m.id)}
                  onChange={() => toggle(m.id)}
                  className="h-4 w-4 shrink-0 accent-green-600"
                />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-800">{m.name}</span>
                <Badge tone={roleTones[m.role] ?? 'ink'}>{roleLabels[m.role] ?? 'Member'}</Badge>
              </label>
            </li>
          ))}
        </ul>
        {err && <p className="text-sm text-coral-700">{err}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="soft" type="button" onClick={onClose}>Cancel</Button>
          <Button type="button" icon={CopyPlus} onClick={copy} disabled={busy || picked.length === 0}>
            {busy ? 'Copying…' : `Copy to ${picked.length || ''} ${picked.length === 1 ? 'member' : 'members'}`.replace('  ', ' ')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// "Show all (N) ▾ / Show less ▴" toggle shared by the profile list cards.
function ShowMore({ expanded, total, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-semibold text-ink-500 transition-colors hover:bg-ink-50 hover:text-ink-800"
    >
      {expanded ? <>Show Less <ChevronUp size={14} /></> : <>Show All {total} <ChevronDown size={14} /></>}
    </button>
  )
}

function EventList({ title, events, empty, className = '' }) {
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? events : events.slice(0, 5)
  return (
    <Card className={`flex flex-col p-5 ${className}`}>
      <h3 className="mb-3 font-semibold text-ink-900">{title} · {events.length}</h3>
      {events.length === 0 ? (
        <p className="grid flex-1 place-items-center py-6 text-center text-sm text-ink-400">{empty}</p>
      ) : (
        <>
          <ul className="divide-y divide-ink-100">
            {shown.map((e) => (
              <li key={e.id} className="first:pt-0 last:pb-0">
                <Link to={`/events/${e.id}`} className="group flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink-800 transition-colors group-hover:text-green-700">{e.name}</p>
                    <p className="truncate text-xs text-ink-400">
                      {e.date ? formatDate(e.date) : 'Date TBD'}
                      {e.location ? ` · ${e.location}` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-xs text-ink-500">{num(e.hours)} hrs</span>
                </Link>
              </li>
            ))}
          </ul>
          {events.length > 5 && <ShowMore expanded={expanded} total={events.length} onToggle={() => setExpanded((v) => !v)} />}
        </>
      )}
    </Card>
  )
}

// Claimed to-dos, styled to match the event lists so the three sit side by side.
function ToDosCard({ todos, className = '' }) {
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? todos : todos.slice(0, 5)
  return (
    <Card className={`flex flex-col p-5 ${className}`}>
      <h3 className="mb-3 font-semibold text-ink-900">To-Dos Claimed · {todos.length}</h3>
      {todos.length === 0 ? (
        <p className="grid flex-1 place-items-center py-6 text-center text-sm text-ink-400">No to-do items claimed.</p>
      ) : (
        <>
          <ul className="divide-y divide-ink-100">
            {shown.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-2.5 text-sm first:pt-0 last:pb-0">
                <span className="min-w-0 truncate text-ink-800">{t.item}</span>
                {t.events?.id ? (
                  <Link to={`/events/${t.events.id}`} className="shrink-0 text-xs text-ink-400 transition-colors hover:text-green-700">
                    {t.events.name}
                  </Link>
                ) : (
                  <span className="shrink-0 text-xs text-ink-400">{t.events?.name}</span>
                )}
              </li>
            ))}
          </ul>
          {todos.length > 5 && <ShowMore expanded={expanded} total={todos.length} onToggle={() => setExpanded((v) => !v)} />}
        </>
      )}
    </Card>
  )
}

// A leadership goal owned by this member, shown on their profile (term/month grid model).
function ProfileGoalCard({ goal }) {
  const done = (goal.progress || 0) >= 100
  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-2">
        <h4 className="whitespace-pre-wrap break-words font-display text-h4 font-semibold text-ink-900"><Linkify>{goal.title}</Linkify></h4>
        {done && <Badge tone="green">Done</Badge>}
      </div>
      <div className="mt-auto pt-4">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="font-mono text-2xs font-semibold uppercase tracking-[0.06em] text-ink-500">{periodLabel(goal.period)}</span>
          <span className="font-mono text-xs font-semibold tabular-nums text-ink-700">{num(goal.progress)}%</span>
        </div>
        <ProgressBar value={goal.progress} max={100} tone={done ? 'green' : 'gold'} />
      </div>
    </Card>
  )
}

// Whole enough to send to the auth API — not a spec-complete check, just the
// difference between a finished address and one still being typed.
const looksLikeEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)

function AdminControls({ member, isSelf, onSaved, onDeleted }) {
  const [name, setName] = useState(member.name ?? '')
  const [role, setRole] = useState(member.role ?? 'member')
  const [admin, setAdmin] = useState(!!member.is_admin)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [email, setEmail] = useState(member.email ?? '')
  const [recovery, setRecovery] = useState('')
  // Passwords are committed by their own modal, never by "Save changes" — a
  // generated password that sits in a draft field looks set but isn't, and the
  // admin finds out when the member can't sign in.
  const [pwModal, setPwModal] = useState('') // '' | 'set' | 'generate'
  const [linkSent, setLinkSent] = useState(false)
  const [acctBusy, setAcctBusy] = useState('')
  const [acctErr, setAcctErr] = useState('')
  // What's currently in the database — everything else on this card is a draft
  // until "Save changes" is pressed.
  const [base, setBase] = useState({ name: member.name ?? '', role: member.role ?? 'member', admin: !!member.is_admin, email: member.email ?? '', recovery: '' })

  useEffect(() => {
    setName(member.name ?? '')
    setRole(member.role ?? 'member')
    setAdmin(!!member.is_admin)
    setEmail(member.email ?? '')
    setLinkSent(false)
    getRecoveryEmail(member.id).then((e) => {
      setRecovery(e)
      setBase({ name: member.name ?? '', role: member.role ?? 'member', admin: !!member.is_admin, email: member.email ?? '', recovery: e })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member.id])

  const dirty =
    name !== base.name ||
    role !== base.role ||
    admin !== base.admin ||
    email.trim() !== base.email ||
    recovery.trim() !== base.recovery

  // Auto-save: there's no Save button to forget. A short pause after the last
  // keystroke commits the card, and an address that isn't whole yet just waits —
  // half of "name@bcp.org" is a plausible-looking "name@bcp" that would
  // otherwise be written to the account mid-type.
  useEffect(() => {
    if (!dirty || busy) return
    const nextEmail = email.trim().toLowerCase()
    const nextRecovery = recovery.trim().toLowerCase()
    if (nextEmail !== base.email && !looksLikeEmail(nextEmail)) return
    if (nextRecovery !== base.recovery && nextRecovery && !looksLikeEmail(nextRecovery)) return
    const t = setTimeout(save, 1200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, busy, name, role, admin, email, recovery])

  // Commits the whole card — profile fields, login email, recovery address —
  // each only when it actually changed. Passwords aren't here: they have their
  // own modal, because a password has to be written the moment it's shown.
  async function save() {
    setAcctErr('')
    setLinkSent(false)
    const nextEmail = email.trim().toLowerCase()
    const nextRecovery = recovery.trim().toLowerCase()
    if (nextEmail !== base.email && !looksLikeEmail(nextEmail)) return setAcctErr('Enter a valid email address.')
    if (nextRecovery && !looksLikeEmail(nextRecovery)) return setAcctErr('Enter a valid recovery email.')

    setBusy(true)
    if (name !== base.name || role !== base.role || admin !== base.admin) {
      await adminUpdateProfile(member.id, { name, role, is_admin: admin })
    }
    if (nextEmail !== base.email) {
      const res = await adminSetEmail(member.id, nextEmail)
      if (!res.ok) return finish(res.error || 'Could not change the email.')
    }
    if (nextRecovery !== base.recovery) {
      const { error } = await setRecoveryEmail(member.id, nextRecovery)
      if (error) return finish(error.message)
    }
    setBusy(false)
    setEmail(nextEmail)
    setRecovery(nextRecovery)
    setBase({ name, role, admin, email: nextEmail, recovery: nextRecovery })
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
    onSaved()
  }
  function finish(message) {
    setBusy(false)
    setAcctErr(message)
  }

  async function doSendReset() {
    setAcctErr('')
    setAcctBusy('reset')
    const res = await adminSendReset(member.id)
    setAcctBusy('')
    if (!res.ok) return setAcctErr(res.error || 'Could not send the reset email.')
    setLinkSent(true)
  }
  async function doDelete() {
    if (!window.confirm(`Permanently delete ${member.name || 'this member'}'s account? This can't be undone.`)) return
    setAcctErr('')
    setAcctBusy('delete')
    const res = await adminDeleteUser(member.id)
    setAcctBusy('')
    if (!res.ok) return setAcctErr(res.error || 'Could not delete the account.')
    onDeleted()
  }

  return (
    <Card className="mt-6 border-blue-200 p-5">
      <div className="mb-4 flex items-center gap-2">
        <Shield size={16} className="text-blue-600" />
        <h3 className="font-display text-h4 font-semibold text-ink-900">Admin Controls</h3>
        <AccessChip mode="edit" />
      </div>
      <div className="space-y-5">
        {/* Identity */}
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Name">
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
          </FormField>
          <FormField label="Role">
            <select className={inputClass} value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="member">Member (unassigned)</option>
              {roleOptions.map((r) => (
                <option key={r} value={r}>{roleLabels[r]}</option>
              ))}
            </select>
          </FormField>
        </div>

        {/* Permission */}
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-ink-200 p-3">
          <input
            type="checkbox"
            checked={admin}
            onChange={(e) => setAdmin(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-ink-300 accent-green-600"
          />
          <span>
            <span className="block text-sm font-medium text-ink-800">Admin access</span>
            <span className="block text-xs text-ink-500">Full control over members, events, fundraising, and settings.</span>
          </span>
        </label>

        {/* Account */}
        <div className="border-t border-ink-200 pt-4">
          <p className="mb-3 text-sm font-semibold text-ink-800">Account</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Login email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="member@bcp.org"
                className={inputClass}
              />
            </FormField>
            {/* The only inbox reset links are ever sent to — school mailboxes
                quarantine ours, so there's deliberately no fallback to one. */}
            <FormField label="Recovery email">
              <input
                type="email"
                value={recovery}
                onChange={(e) => setRecovery(e.target.value)}
                placeholder="Personal (non-BCP) address"
                className={inputClass}
              />
            </FormField>
          </div>

          {/* Password controls. Each button commits on its own — nothing here is
              a draft waiting on Save changes. */}
          <p className="mb-2 mt-4 text-sm font-semibold text-ink-800">Password controls</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="soft" type="button" onClick={() => setPwModal('set')}>
              Set new
            </Button>
            <Button variant="soft" type="button" onClick={() => setPwModal('generate')}>
              Generate temporary
            </Button>
          </div>
          {!isSelf && (
            <p className="mt-1 text-xs text-ink-500">Set a temporary password to login with.</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {/* Reset mail only ever goes to a SAVED recovery address, so this is
                off until one exists in the database (a typed-but-unsaved one
                won't do). Copying the link always works. */}
            <Button
              variant="soft"
              type="button"
              onClick={doSendReset}
              disabled={acctBusy === 'reset' || !base.recovery}
            >
              {acctBusy === 'reset' ? 'Sending…' : 'Email reset link (legacy)'}
            </Button>
            {!base.recovery && (
              <span className="text-xs text-ink-500">Needs recovery email.</span>
            )}
          </div>
          {acctErr && <p className="mt-2 text-xs text-coral-700">{acctErr}</p>}
          {!isSelf && (
            <button
              type="button"
              onClick={doDelete}
              disabled={acctBusy === 'delete'}
              className="mt-3 text-sm font-medium text-coral-700 transition-colors hover:text-coral-800 disabled:opacity-60"
            >
              {acctBusy === 'delete' ? 'Deleting…' : 'Delete this account'}
            </button>
          )}
        </div>
      </div>
      <div className="mt-4 flex h-5 items-center justify-end gap-3">
        {linkSent && <span className="text-sm font-medium text-green-700">Link sent</span>}
        {busy && <span className="text-sm text-ink-500">Saving…</span>}
        {saved && !busy && <span className="text-sm font-medium text-green-700">Saved</span>}
      </div>
      <PasswordModal
        mode={pwModal}
        member={member}
        isSelf={isSelf}
        onClose={() => setPwModal('')}
      />
    </Card>
  )
}

// Both password actions, each committing the moment it's confirmed. Keeping
// them out of the card's draft is the point: a password you can see but that
// hasn't been written is indistinguishable from one that has, until the member
// tries to sign in with it.
function PasswordModal({ mode, member, isSelf, onClose }) {
  const [typed, setTyped] = useState('')
  const [generated, setGenerated] = useState('')
  const [applied, setApplied] = useState('')
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const open = mode === 'set' || mode === 'generate'

  useEffect(() => {
    if (!open) return
    setTyped('')
    setGenerated(mode === 'generate' ? generateTempPassword() : '')
    setApplied('')
    setCopied(false)
    setError('')
    setBusy(false)
  }, [open, mode])

  async function apply(value) {
    if (value.length < 8) return setError('Use at least 8 characters.')
    setError('')
    setBusy(true)
    const res = await adminSetPassword(member.id, value)
    setBusy(false)
    if (!res.ok) return setError(res.error || 'Could not set the password.')
    setApplied(value)
    if (mode === 'set') onClose()
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(applied || generated)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Clipboard blocked — copy it by hand from above.')
    }
  }

  const note = isSelf
    ? 'This replaces your own password straight away.'
    : 'This replaces their password straight away. Send it with their login email.'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'generate' ? 'Temporary password' : 'Set a new password'}
    >
      {mode === 'set' ? (
        <div className="space-y-3">
          <FormField label="New password">
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="At least 8 characters"
              className={`${inputClass} font-mono tracking-wide`}
              autoFocus
            />
          </FormField>
          <p className="text-xs text-ink-500">{note}</p>
          {error && <p className="text-sm text-coral-700">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="soft" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" onClick={() => apply(typed)} disabled={busy}>
              {busy ? 'Setting…' : 'Set password'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="break-all rounded-lg border border-ink-200 bg-ink-50 p-3 text-center font-mono text-lg tracking-widest text-ink-900">
            {applied || generated}
          </p>
          <p className="text-xs text-ink-500">
            {applied
              ? 'This password is live — send it over with the login email.'
              : 'Nothing changes until you set it. Then send it over with their login email.'}
          </p>
          {error && <p className="text-sm text-coral-700">{error}</p>}
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            {!applied && (
              <Button variant="soft" type="button" onClick={() => setGenerated(generateTempPassword())}>
                Regenerate
              </Button>
            )}
            <Button variant="soft" type="button" onClick={copy}>
              {copied ? 'Copied!' : 'Copy'}
            </Button>
            {applied ? (
              <Button type="button" onClick={onClose}>
                Done
              </Button>
            ) : (
              <Button type="button" onClick={() => apply(generated)} disabled={busy}>
                {busy ? 'Setting…' : 'Set this password'}
              </Button>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
