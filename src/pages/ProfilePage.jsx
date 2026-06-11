import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, Camera, Loader2, Shield, Crown, Plus, Pencil, Trash2, AlertTriangle, Download, Check,
  Sparkles, RefreshCw, ArrowUpRight,
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
} from '../components/ui'
import { toneMeta } from '../components/InsightCard'
import {
  getProfileDetails,
  adminUpdateProfile,
  uploadAvatar,
  removeAvatar,
  adminSetPassword,
  adminSetEmail,
  adminSendReset,
  adminDeleteUser,
  deleteOwnAccount,
  addHoursEntry,
  updateHoursEntry,
  deleteHoursEntry,
  getEventsBrief,
  submitHoursRequest,
  generateMemberInsight,
} from '../lib/api'
import { useAuth } from '../context/AuthContext'
import AvatarCropper from '../components/AvatarCropper'
import { exportMemberHours } from '../lib/exportHours'

const TODAY = new Date().toISOString().slice(0, 10)

export default function ProfilePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, profile: me, signOut } = useAuth()
  const isAdmin = !!me?.is_admin
  const isOpsLead = me?.role === 'operations_lead'
  const isOwn = user?.id === id

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

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

  if (loading) return <p className="text-sm text-ink-500">Loading…</p>
  if (!data?.profile) return <p className="text-sm text-ink-500">Member not found.</p>

  const p = data.profile
  const upcoming = data.events.filter((e) => e.date >= TODAY).sort((a, b) => a.date.localeCompare(b.date))
  const past = data.events.filter((e) => e.date < TODAY).sort((a, b) => b.date.localeCompare(a.date))

  return (
    <>
      <button
        onClick={() => navigate(-1)}
        className="mb-4 -ml-2.5 inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800"
      >
        <ArrowLeft size={16} /> Back
      </button>

      {/* Header */}
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
            <p className="font-mono text-4xl font-bold tabular-nums text-ink-900">{data.hours}</p>
            <p className="text-xs text-ink-500">volunteer hours</p>
          </div>
        </div>
      </Card>

      <MemberInsightCard profile={p} canRefresh={isOwn || isAdmin} onChanged={load} />

      <HoursBreakdown
        breakdown={data.breakdown}
        canDirectEdit={isOpsLead}
        canRequest={!isOpsLead && (isOwn || isAdmin)}
        isOwn={isOwn}
        memberId={id}
        memberName={p.name}
        onChange={load}
      />

      {/* Upcoming + attended events + claimed to-dos, side by side at equal height */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3 lg:items-stretch">
        <EventList title="Upcoming Events" events={upcoming} empty="Not signed up for anything upcoming." className="h-full" />
        <EventList title="Attended Events" events={past} empty="No past events yet." className="h-full" />
        <ToDosCard todos={data.todos} className="h-full" />
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
  const [error, setError] = useState('')

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

  async function refresh() {
    setBusy(true)
    setError('')
    const { data, error } = await generateMemberInsight(p.id, true)
    setBusy(false)
    if (error || data?.ok === false) {
      const msg = data?.error || error?.message || 'Could not refresh the insight.'
      setError(msg.includes('GEMINI_API_KEY') ? 'AI is not set up yet — an admin needs to add the Gemini key.' : msg)
      return
    }
    onChanged()
  }

  const meta = toneMeta[ins?.tone] ?? toneMeta.neutral
  const Icon = meta.icon

  return (
    <Card className="mt-6 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-md ${meta.iconBg}`}>
            {busy && !ins ? <Loader2 size={20} className="animate-spin" /> : <Icon size={20} />}
          </span>
          <div className="min-w-0 flex-1">
            {ins ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display text-h4 font-semibold text-ink-900">{ins.title}</h3>
                  {ins.metric && <Badge tone={meta.chip}>{ins.metric}</Badge>}
                  <Sparkles size={13} className="text-ink-300" aria-label="AI-generated" />
                </div>
                <p className="mt-1 text-sm text-ink-600">{ins.detail}</p>
                {ins.improve && (
                  <p className="mt-2 flex items-start gap-1.5 text-sm text-ink-700">
                    <ArrowUpRight size={15} className="mt-0.5 shrink-0 text-green-600" />
                    <span><span className="font-semibold">Try next:</span> {ins.improve}</span>
                  </p>
                )}
              </>
            ) : (
              <>
                <h3 className="flex items-center gap-1.5 font-display text-h4 font-semibold text-ink-900">
                  AI insight <Sparkles size={13} className="text-ink-300" />
                </h3>
                <p className="mt-1 text-sm text-ink-500">
                  {busy
                    ? 'Reading the volunteering history — this takes ~10 seconds.'
                    : 'A personal look at progress and what to try next appears here once generated.'}
                </p>
              </>
            )}
            {error && <p className="mt-2 text-xs text-coral-700">{error}</p>}
          </div>
        </div>
        {canRefresh && (
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Button variant="soft" icon={busy ? Loader2 : RefreshCw} loading={busy} onClick={refresh} disabled={busy}>
              {busy ? 'Thinking…' : ins ? 'Refresh' : 'Generate'}
            </Button>
            {ins && p.ai_insight_at && !busy && (
              <span className="text-xs text-ink-400">Auto-refreshes monthly · updated {timeAgo(p.ai_insight_at)}</span>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}

// Self-service account + data deletion, shown on your own profile (SB 568 eraser).
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
        <h3 className="font-display text-h4 font-semibold text-ink-900">Delete your account</h3>
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
  meeting: { label: 'Meeting', tone: 'blue' },
  role_monthly: { label: 'Role · monthly', tone: 'gold' },
  role_event: { label: 'Role · per event', tone: 'gold' },
  manual: { label: 'Manual', tone: 'ink' },
  import: { label: 'Logged', tone: 'ink' },
}

// Itemized hours history (Feature 3) — every entry that makes up the total, with
// an Excel export. Admins can add, edit, or remove ledger entries (event hours,
// imported rows, role/manual grants) inline; derived event sign-ups and meeting
// attendance (no grant_id) are read-only here and managed on their own pages.
function HoursBreakdown({ breakdown, canDirectEdit, canRequest, isOwn, memberId, memberName, onChange }) {
  const entries = breakdown?.entries ?? []
  const [modalOpen, setModalOpen] = useState(false)
  const [editEntry, setEditEntry] = useState(null)
  const [requestOpen, setRequestOpen] = useState(false)

  function openAdd() {
    setEditEntry(null)
    setModalOpen(true)
  }
  function openEdit(entry) {
    setEditEntry(entry)
    setModalOpen(true)
  }
  async function remove(entry) {
    if (!window.confirm(`Remove "${entry.description}" (${entry.hours}h)? This can't be undone.`)) return
    await deleteHoursEntry(entry.grant_id)
    onChange()
  }

  return (
    <Card className="mt-6 p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold text-ink-900">
          Hours breakdown
          {canDirectEdit && <EditAccessChip />}
        </h3>
        <div className="flex items-center gap-3">
          {entries.length > 0 && (
            <Button variant="soft" icon={Download} onClick={() => exportMemberHours(breakdown)}>Export</Button>
          )}
          {canDirectEdit && <Button icon={Plus} onClick={openAdd}>Add hours</Button>}
          {canRequest && <Button icon={Plus} onClick={() => setRequestOpen(true)}>Request hours</Button>}
        </div>
      </div>
      {canRequest && (
        <p className="mb-3 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
          {isOwn
            ? 'Request hours for activities outside events & meetings — the operations lead approves them.'
            : `Submit a request on ${memberName || 'this member'}’s behalf — the operations lead approves it.`}
        </p>
      )}
      {entries.length === 0 ? (
        <p className="text-sm text-ink-400">No hours logged yet.</p>
      ) : (
        <ul className="divide-y divide-ink-100">
          {entries.map((e, i) => {
            const meta = kindMeta[e.kind] ?? { label: e.kind, tone: 'ink' }
            const editable = canDirectEdit && !!e.grant_id
            return (
              <li key={e.grant_id ?? i} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  {e.event_id ? (
                    <Link to={`/events/${e.event_id}`} className="block truncate text-sm font-medium text-ink-800 transition-colors hover:text-green-700">
                      {e.description}
                    </Link>
                  ) : (
                    <p className="truncate text-sm text-ink-800">{e.description}</p>
                  )}
                  <p className="text-xs text-ink-400">{e.date ? formatDate(e.date) : 'Multiple / undated'}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                  <span className="w-12 text-right font-mono text-sm font-semibold tabular-nums text-ink-700">{e.hours}h</span>
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
      )}
      {canDirectEdit && (
        <p className="mt-3 text-xs text-ink-400">
          Logged, role, and imported entries can be edited here. Event sign-ups and meeting attendance
          are managed on the Events &amp; Meetings page.
        </p>
      )}
      <HoursEntryModal
        open={modalOpen}
        entry={editEntry}
        memberId={memberId}
        onClose={() => setModalOpen(false)}
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
        onSaved={() => setRequestOpen(false)}
      />
    </Card>
  )
}

// Member request form — sends an hours request to the operations lead (who
// approves or denies it). Used in place of "Add hours" for non-admins.
function HoursRequestModal({ open, requesterId, targetName, onBehalf = false, onClose, onSaved }) {
  const [activity, setActivity] = useState('')
  const [hours, setHours] = useState('')
  const [contribution, setContribution] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (open) {
      setActivity('')
      setHours('')
      setContribution('')
      setErr('')
      setDone(false)
    }
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
    <Modal open={open} onClose={onClose} title={onBehalf ? `Request hours for ${targetName || 'member'}` : 'Request hours'}>
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
            <Button variant="soft" type="button" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? 'Sending…' : 'Request'}</Button>
          </div>
        </form>
      )}
    </Modal>
  )
}

// Admin add/edit form for a single hours ledger entry. Optionally links the entry
// to an event (so it shows on the event page and in exports).
function HoursEntryModal({ open, entry, memberId, onClose, onSaved }) {
  const editing = Boolean(entry)
  const [hours, setHours] = useState('')
  const [date, setDate] = useState('')
  const [note, setNote] = useState('')
  const [eventId, setEventId] = useState('')
  const [events, setEvents] = useState([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) getEventsBrief().then(setEvents)
  }, [open])

  useEffect(() => {
    if (entry) {
      setHours(String(entry.hours ?? ''))
      setDate(entry.date ?? '')
      setNote(entry.description === 'Hours' ? '' : entry.description ?? '')
      setEventId(entry.event_id ?? '')
    } else {
      setHours('')
      setDate('')
      setNote('')
      setEventId('')
    }
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
    <Modal open={open} onClose={onClose} title={editing ? 'Edit hours entry' : 'Add hours'}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
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
          <Button variant="soft" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Add hours'}</Button>
        </div>
      </form>
    </Modal>
  )
}

function EventList({ title, events, empty, className = '' }) {
  return (
    <Card className={`flex flex-col p-5 ${className}`}>
      <h3 className="mb-3 font-semibold text-ink-900">{title} · {events.length}</h3>
      {events.length === 0 ? (
        <p className="grid flex-1 place-items-center py-6 text-center text-sm text-ink-400">{empty}</p>
      ) : (
        <ul className="divide-y divide-ink-100">
          {events.map((e) => (
            <li key={e.id} className="first:pt-0 last:pb-0">
              <Link to={`/events/${e.id}`} className="group flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink-800 transition-colors group-hover:text-green-700">{e.name}</p>
                  <p className="truncate text-xs text-ink-400">
                    {formatDate(e.date)}
                    {e.location ? ` · ${e.location}` : ''}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-xs text-ink-500">{e.hours} hrs</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

// Claimed to-dos, styled to match the event lists so the three sit side by side.
function ToDosCard({ todos, className = '' }) {
  return (
    <Card className={`flex flex-col p-5 ${className}`}>
      <h3 className="mb-3 font-semibold text-ink-900">To-dos claimed · {todos.length}</h3>
      {todos.length === 0 ? (
        <p className="grid flex-1 place-items-center py-6 text-center text-sm text-ink-400">No to-do items claimed.</p>
      ) : (
        <ul className="divide-y divide-ink-100">
          {todos.map((t) => (
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
      )}
    </Card>
  )
}

// A leadership goal owned by this member, shown on their profile.
function ProfileGoalCard({ goal }) {
  const done = goal.status === 'done'
  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-display text-h4 font-semibold text-ink-900">{goal.title}</h4>
        {done && <Badge tone="green">Done</Badge>}
      </div>
      {goal.detail && <p className="mt-1 line-clamp-2 text-sm text-ink-600">{goal.detail}</p>}
      <div className="mt-auto pt-4">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs text-ink-500">{goal.target_date ? formatDate(goal.target_date) : 'No target date'}</span>
          <span className="font-mono text-xs font-semibold tabular-nums text-ink-700">{goal.progress}%</span>
        </div>
        <ProgressBar value={goal.progress} max={100} tone={done ? 'green' : 'gold'} />
      </div>
    </Card>
  )
}

function AdminControls({ member, isSelf, onSaved, onDeleted }) {
  const [name, setName] = useState(member.name ?? '')
  const [role, setRole] = useState(member.role ?? 'member')
  const [admin, setAdmin] = useState(!!member.is_admin)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [pw, setPw] = useState('')
  const [email, setEmail] = useState(member.email ?? '')
  const [acctBusy, setAcctBusy] = useState('')
  const [acctMsg, setAcctMsg] = useState('')
  const [acctErr, setAcctErr] = useState('')

  useEffect(() => {
    setName(member.name ?? '')
    setRole(member.role ?? 'member')
    setAdmin(!!member.is_admin)
    setEmail(member.email ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member.id])

  async function save() {
    setBusy(true)
    await adminUpdateProfile(member.id, {
      name,
      role,
      is_admin: admin,
    })
    setBusy(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
    onSaved()
  }

  async function doSetPassword() {
    setAcctErr('')
    setAcctMsg('')
    if (pw.length < 8) return setAcctErr('Password must be at least 8 characters.')
    setAcctBusy('pw')
    const res = await adminSetPassword(member.id, pw)
    setAcctBusy('')
    if (!res.ok) return setAcctErr(res.error || 'Could not set the password.')
    setPw('')
    setAcctMsg('Password updated.')
  }
  async function doSendReset() {
    setAcctErr('')
    setAcctMsg('')
    setAcctBusy('reset')
    const res = await adminSendReset(member.email)
    setAcctBusy('')
    if (!res.ok) return setAcctErr(res.error || 'Could not send the reset email.')
    setAcctMsg('Reset email sent.')
  }
  async function doSetEmail() {
    setAcctErr('')
    setAcctMsg('')
    if (!email.includes('@') || email.trim() === (member.email ?? '')) {
      return setAcctErr(email.trim() === (member.email ?? '') ? 'That is already the email.' : 'Enter a valid email address.')
    }
    setAcctBusy('email')
    const res = await adminSetEmail(member.id, email.trim())
    setAcctBusy('')
    if (!res.ok) return setAcctErr(res.error || 'Could not change the email.')
    setAcctMsg('Email updated.')
    onSaved()
  }
  async function doDelete() {
    if (!window.confirm(`Permanently delete ${member.name || 'this member'}'s account? This can't be undone.`)) return
    setAcctErr('')
    setAcctMsg('')
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
        <h3 className="font-display text-h4 font-semibold text-ink-900">Admin controls</h3>
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
          <p className="mb-2 text-sm font-semibold text-ink-800">Account</p>
          <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="member@bcp.org"
              className={`${inputClass} sm:flex-1`}
            />
            <Button variant="soft" type="button" onClick={doSetEmail} disabled={acctBusy === 'email'}>
              {acctBusy === 'email' ? 'Updating…' : 'Change email'}
            </Button>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="text"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="New password (min 8)"
              className={`${inputClass} sm:flex-1`}
            />
            <Button variant="soft" type="button" onClick={doSetPassword} disabled={acctBusy === 'pw'}>
              {acctBusy === 'pw' ? 'Setting…' : 'Set password'}
            </Button>
            <Button variant="soft" type="button" onClick={doSendReset} disabled={acctBusy === 'reset'}>
              {acctBusy === 'reset' ? 'Sending…' : 'Email reset link'}
            </Button>
          </div>
          {acctMsg && <p className="mt-2 text-xs font-medium text-green-700">{acctMsg}</p>}
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
      <div className="mt-4 flex items-center justify-end gap-3">
        {saved && <span className="text-sm font-medium text-green-700">Saved</span>}
        <Button onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</Button>
      </div>
    </Card>
  )
}
