import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Clock, CalendarDays, ListChecks, Camera, Loader2, Shield, Crown, Minus, Plus, Trash2, AlertTriangle } from 'lucide-react'
import {
  Card,
  Badge,
  Avatar,
  Button,
  FormField,
  inputClass,
  roleLabels,
  roleOptions,
  roleTones,
  formatDate,
} from '../components/ui'
import {
  getProfileDetails,
  adminUpdateProfile,
  uploadAvatar,
  removeAvatar,
  adminSetPassword,
  adminSendReset,
  adminDeleteUser,
  deleteOwnAccount,
} from '../lib/api'
import { useAuth } from '../context/AuthContext'
import AvatarCropper from '../components/AvatarCropper'

const TODAY = new Date().toISOString().slice(0, 10)

export default function ProfilePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, profile: me, signOut } = useAuth()
  const isAdmin = !!me?.is_admin
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
  const derivedHours = data.hours - Number(p.hours_adjustment ?? 0)

  return (
    <>
      <button
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-ink-500 transition-colors hover:text-ink-800"
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

      {/* Quick stats */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        <StatTile icon={Clock} label="Hours" value={data.hours} />
        <StatTile icon={CalendarDays} label="Events" value={data.events.length} />
        <StatTile icon={ListChecks} label="To-dos owned" value={data.todos.length} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <EventList title="Signed up — upcoming" events={upcoming} empty="Not signed up for anything upcoming." />
        <EventList title="Attended" events={past} empty="No past events yet." />
      </div>

      {/* To-dos they own */}
      <Card className="mt-6 p-5">
        <h3 className="mb-3 font-semibold text-ink-900">Responsible for · {data.todos.length}</h3>
        {data.todos.length === 0 ? (
          <p className="text-sm text-ink-400">No to-do items claimed.</p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {data.todos.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-2.5 text-sm first:pt-0 last:pb-0">
                <span className="text-ink-800">{t.item}</span>
                <span className="shrink-0 text-xs text-ink-400">{t.events?.name}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {isAdmin && (
        <AdminControls
          member={p}
          derivedHours={derivedHours}
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

function StatTile({ icon: Icon, label, value }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <Icon size={16} className="text-ink-400" />
        <span className="font-mono text-2xl font-bold tabular-nums text-ink-900">{value}</span>
      </div>
      <p className="mt-1 text-xs text-ink-500">{label}</p>
    </Card>
  )
}

function EventList({ title, events, empty }) {
  return (
    <Card className="p-5">
      <h3 className="mb-3 font-semibold text-ink-900">{title} · {events.length}</h3>
      {events.length === 0 ? (
        <p className="text-sm text-ink-400">{empty}</p>
      ) : (
        <ul className="divide-y divide-ink-100">
          {events.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink-800">{e.name}</p>
                <p className="truncate text-xs text-ink-400">
                  {formatDate(e.date)}
                  {e.location ? ` · ${e.location}` : ''}
                </p>
              </div>
              <span className="shrink-0 font-mono text-xs text-ink-500">{e.hours} hrs</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function AdminControls({ member, derivedHours, isSelf, onSaved, onDeleted }) {
  const [name, setName] = useState(member.name ?? '')
  const [role, setRole] = useState(member.role ?? 'member')
  const [admin, setAdmin] = useState(!!member.is_admin)
  const [hours, setHours] = useState(derivedHours + Number(member.hours_adjustment ?? 0))
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [pw, setPw] = useState('')
  const [acctBusy, setAcctBusy] = useState('')
  const [acctMsg, setAcctMsg] = useState('')
  const [acctErr, setAcctErr] = useState('')

  useEffect(() => {
    setName(member.name ?? '')
    setRole(member.role ?? 'member')
    setAdmin(!!member.is_admin)
    setHours(derivedHours + Number(member.hours_adjustment ?? 0))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member.id])

  async function save() {
    setBusy(true)
    await adminUpdateProfile(member.id, {
      name,
      role,
      is_admin: admin,
      // Store the delta needed to reach the chosen total (signup hours stay live).
      hours_adjustment: Number(hours) - derivedHours,
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

        {/* Hours */}
        <div>
          <p className="mb-1.5 text-sm font-semibold text-ink-800">Volunteer hours</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setHours((h) => Math.max(0, Number(h) - 1))}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-ink-300 text-ink-700 transition-colors hover:bg-ink-50"
              aria-label="Decrease hours"
            >
              <Minus size={15} />
            </button>
            <input
              type="number"
              min="0"
              step="1"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              className={`${inputClass} w-24 text-center`}
            />
            <button
              type="button"
              onClick={() => setHours((h) => Number(h) + 1)}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-ink-300 text-ink-700 transition-colors hover:bg-ink-50"
              aria-label="Increase hours"
            >
              <Plus size={15} />
            </button>
            <span className="ml-1 text-xs text-ink-400">total, incl. event sign-ups</span>
          </div>
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
