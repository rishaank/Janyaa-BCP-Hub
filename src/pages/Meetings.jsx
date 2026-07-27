// Meeting pieces shared by the merged Events & Meetings page (src/pages/EventsMeetings.jsx):
// the meeting card, the create/edit form modal, and the recurring-series modal.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Clock, MapPin, Users, Trash2, Check, UserCog, X, Link2 } from 'lucide-react'
import { Card, Button, Badge, Modal, FormField, inputClass } from '../components/ui'
import {
  getMeetingSeries, ensureUpcomingMeetings,
  createMeeting, updateMeeting,
  createMeetingSeries, updateMeetingSeries, deleteMeetingSeries, deleteSeriesUpcomingMeetings,
  registerMeeting, unmarkAttendance,
} from '../lib/api'
import MemberChip from '../components/MemberChip'
import ManageAttendeesModal from '../components/ManageAttendeesModal'
import Linkify from '../components/Linkify'
import LinkChip from '../components/LinkChip'
import { hasEnded } from '../lib/time'

const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function fmtTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':')
  return new Date(2000, 0, 1, Number(h), Number(m)).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}
function timeRangeOf(start, end) {
  if (!start) return ''
  return (end ? `${fmtTime(start)}–${fmtTime(end)}` : fmtTime(start)) + ' PST'
}
// Meeting length in hours (default 1 if untimed). Attendees earn this; contributors earn +1.
function meetingLength(m) {
  if (m.start_time && m.end_time) {
    const [sh, sm] = m.start_time.split(':').map(Number)
    const [eh, em] = m.end_time.split(':').map(Number)
    const d = (eh * 60 + em - (sh * 60 + sm)) / 60
    if (d > 0) return Math.round(d * 10) / 10
  }
  return 1
}

export function MeetingCard({ meeting, myId, isAdmin = false, isPast: isPastProp, onChange }) {
  const isPast = isPastProp ?? hasEnded(meeting)
  const canceled = meeting.canceled
  const attendees = meeting.meeting_attendees ?? []
  const myReg = attendees.find((a) => a.member_id === myId)
  const [busy, setBusy] = useState(false)
  const [manage, setManage] = useState(false)
  const timeRange = timeRangeOf(meeting.start_time, meeting.end_time)
  const len = meetingLength(meeting)

  async function register(role) {
    setBusy(true)
    await registerMeeting(meeting.id, myId, role)
    await onChange()
    setBusy(false)
  }
  async function leave() {
    setBusy(true)
    await unmarkAttendance(meeting.id, myId)
    await onChange()
    setBusy(false)
  }

  return (
    <Card className={`flex min-w-0 flex-col p-5 transition-shadow hover:shadow-card sm:p-6 ${canceled ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={`/meetings/${meeting.id}`}
              className={`break-words font-display text-h4 font-semibold text-ink-900 transition-colors hover:text-green-700 ${canceled ? 'line-through' : ''}`}
            >
              {meeting.title}
            </Link>
            {meeting.series_id && <Badge tone="blue">Weekly</Badge>}
            {canceled && <Badge tone="coral">Canceled</Badge>}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-500">
            {timeRange && (
              <span className="flex items-center gap-1.5"><Clock size={14} className="text-ink-400" /> {timeRange}</span>
            )}
            {meeting.location && (
              <span className="flex min-w-0 max-w-full items-center gap-1.5">
                <MapPin size={14} className="shrink-0 text-ink-400" />
                <span className="min-w-0 break-all"><Linkify>{meeting.location}</Linkify></span>
              </span>
            )}
          </div>
        </div>
        {/* Edit / cancel / delete now live on the full-screen view (open via the title). */}
        <Link
          to={`/meetings/${meeting.id}`}
          className="shrink-0 rounded-xl bg-ink-50 px-3 py-1.5 text-center transition-colors hover:bg-ink-100"
          aria-label="Open full view"
        >
          <p className="font-mono text-2xs font-semibold uppercase text-ink-500">
            {new Date(meeting.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}
          </p>
          <p className="font-display text-lg font-bold leading-tight text-ink-900">
            {new Date(meeting.date + 'T00:00:00').getDate()}
          </p>
        </Link>
      </div>

      {meeting.notes && (
        <p className="mt-4 whitespace-pre-wrap break-words text-sm text-ink-600">
          <Linkify>{meeting.notes}</Linkify>
        </p>
      )}

      {meeting.links?.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {meeting.links.map((url, i) => (
            <LinkChip key={i} url={url} />
          ))}
        </div>
      )}

      <div className="mt-auto pt-5">
       <div className="rounded-xl bg-ink-50 p-4">
        <div className="mb-2.5 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-sm font-medium text-ink-700">
            <Users size={15} className="text-ink-400" />
            {isPast ? 'Attended' : 'Attending'}
          </span>
          <span className="flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={() => setManage(true)}
                className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-2xs font-semibold text-ink-500 transition-colors hover:bg-ink-100 hover:text-blue-600"
                title="Add or remove attendees"
              >
                <UserCog size={13} /> Manage
              </button>
            )}
            <span className="font-mono text-sm font-semibold tabular-nums text-ink-700">{attendees.length}</span>
          </span>
        </div>
        {attendees.length > 0 ? (
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            {attendees.map((a) => (
              <span key={a.member_id} className="inline-flex items-center">
                <MemberChip id={a.member_id} name={a.profiles?.name} role={a.profiles?.role} />
                {a.role === 'contributor' && (
                  <span className="ml-0.5 rounded-full bg-gold-100 px-1.5 py-0.5 text-[10px] font-bold text-gold-700" title="Contributor (+1 hr)">+1</span>
                )}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-ink-400">{isPast ? 'No attendance recorded.' : 'Nobody registered yet.'}</p>
        )}

        {/* Attendance is a member's own call while the meeting is still to come,
            and an admin's record afterwards (RLS enforces the same split,
            migration 0036) — so a past meeting keeps the "you attended" line but
            loses the buttons. */}
        {!canceled &&
          (myReg ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-ink-700">
                You&rsquo;re {myReg.role === 'contributor' ? 'contributing' : 'attending'} ·{' '}
                {myReg.role === 'contributor' ? len + 1 : len}h
              </span>
              {!isPast && (
                <>
                  <button
                    onClick={() => register(myReg.role === 'contributor' ? 'attendee' : 'contributor')}
                    disabled={busy}
                    className="rounded-md bg-ink-100 px-2 py-1 text-xs font-medium text-ink-600 transition-colors hover:bg-ink-200 disabled:opacity-50"
                  >
                    Switch to {myReg.role === 'contributor' ? 'attendee' : 'contributor'}
                  </button>
                  <button
                    onClick={leave}
                    disabled={busy}
                    className="rounded-md px-2 py-1 text-xs font-medium text-coral-700 transition-colors hover:bg-coral-50 disabled:opacity-50"
                  >
                    Leave
                  </button>
                </>
              )}
            </div>
          ) : (
            !isPast && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={() => register('attendee')}
                  disabled={busy}
                  className="rounded-lg bg-green-600 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-50"
                >
                  Attend · {len}h
                </button>
                <button
                  onClick={() => register('contributor')}
                  disabled={busy}
                  className="rounded-lg border border-blue-300 bg-surface py-2 text-sm font-semibold text-blue-600 transition-colors hover:bg-blue-50 disabled:opacity-50"
                >
                  Contribute · {len + 1}h
                </button>
              </div>
            )
          ))}
        {!canceled && (
          <p className="mt-2 text-2xs text-ink-400">
            Contributors earn the meeting length + 1 hr; attendees earn the length.{' '}
            {isPast
              ? 'Attendance is final once a meeting ends — ask an admin to correct it.'
              : 'Hours are added automatically once the meeting ends (PST).'}
          </p>
        )}
       </div>
      </div>

      {isAdmin && (
        <ManageAttendeesModal
          open={manage}
          onClose={() => setManage(false)}
          title={meeting.title}
          current={attendees}
          withRoles
          onAdd={async (id, role) => { await registerMeeting(meeting.id, id, role); await onChange() }}
          onRemove={async (id) => { await unmarkAttendance(meeting.id, id); await onChange() }}
          onSetRole={async (id, role) => { await registerMeeting(meeting.id, id, role); await onChange() }}
        />
      )}
    </Card>
  )
}

const blankMeeting = { title: '', date: '', start_time: '', end_time: '', location: '', notes: '', links: [] }

export function MeetingFormModal({ open, meeting, onClose, onSaved }) {
  const [form, setForm] = useState(blankMeeting)
  const [repeat, setRepeat] = useState(false)
  const [busy, setBusy] = useState(false)
  const editing = Boolean(meeting)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const repeatDay = form.date ? DOW[new Date(form.date + 'T00:00:00').getDay()] : null

  useEffect(() => {
    setRepeat(false)
    if (meeting) {
      setForm({
        title: meeting.title ?? '',
        date: meeting.date ?? '',
        start_time: (meeting.start_time ?? '').slice(0, 5),
        end_time: (meeting.end_time ?? '').slice(0, 5),
        location: meeting.location ?? '',
        notes: meeting.notes ?? '',
        links: meeting.links ?? [],
      })
    } else {
      setForm(blankMeeting)
    }
  }, [meeting, open])

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    const links = (form.links ?? []).map((s) => s.trim()).filter(Boolean)
    if (!editing && repeat && form.date) {
      // Recurring: spin up a weekly schedule on the chosen date's weekday; the
      // Hub materializes the upcoming occurrences (replaces the old Recurring button).
      await createMeetingSeries({
        title: form.title,
        weekday: new Date(form.date + 'T00:00:00').getDay(),
        start_time: form.start_time || null,
        end_time: form.end_time || null,
        location: form.location || null,
        notes: form.notes || null,
      })
      await ensureUpcomingMeetings()
    } else {
      const fields = {
        title: form.title,
        date: form.date,
        start_time: form.start_time || null,
        end_time: form.end_time || null,
        location: form.location || null,
        notes: form.notes || null,
        links,
      }
      if (editing) await updateMeeting(meeting.id, fields)
      else await createMeeting(fields)
    }
    setBusy(false)
    onSaved()
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Meeting' : 'Add Meeting'}>
      <form onSubmit={submit} className="space-y-3">
        <FormField label="Title">
          <input className={inputClass} value={form.title} onChange={set('title')} required placeholder="Weekly officer sync" />
        </FormField>
        <FormField label="Date">
          <input type="date" className={inputClass} value={form.date} onChange={set('date')} required />
        </FormField>
        {!editing && (
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-ink-200 bg-ink-50/60 px-3 py-2.5">
            <input
              type="checkbox"
              checked={repeat}
              onChange={(e) => setRepeat(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-green-600"
            />
            <span>
              <span className="block text-sm font-semibold text-ink-800">Repeat weekly</span>
              <span className="mt-0.5 block text-xs text-ink-500">
                {form.date
                  ? `Auto-creates this meeting every ${repeatDay} for the next two months. You can still cancel or edit any single one.`
                  : 'Pick a date first — it repeats on that weekday.'}
              </span>
            </span>
          </label>
        )}
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Start time">
            <input type="time" className={inputClass} value={form.start_time} onChange={set('start_time')} />
          </FormField>
          <FormField label="End time">
            <input type="time" className={inputClass} value={form.end_time} onChange={set('end_time')} />
          </FormField>
        </div>
        <FormField label="Location">
          <input className={inputClass} value={form.location} onChange={set('location')} placeholder="Room 204 / Zoom" />
        </FormField>
        <FormField label="Notes">
          <textarea className={inputClass} rows={3} value={form.notes} onChange={set('notes')} placeholder="Agenda, decisions, action items…" />
        </FormField>
        <FormField label="Links">
          <div className="space-y-2">
            {(form.links ?? []).map((url, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className={inputClass}
                  value={url}
                  onChange={(e) => {
                    const next = [...form.links]
                    next[i] = e.target.value
                    setForm({ ...form, links: next })
                  }}
                  placeholder="Agenda doc, Meet link, slides…"
                />
                <button
                  type="button"
                  onClick={() => setForm({ ...form, links: form.links.filter((_, j) => j !== i) })}
                  className="shrink-0 rounded-lg border border-ink-300 px-2.5 text-ink-500 transition-colors hover:bg-coral-50 hover:text-coral-600"
                  aria-label="Remove link"
                >
                  <X size={15} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setForm({ ...form, links: [...(form.links ?? []), ''] })}
              className="flex items-center gap-1 text-sm font-medium text-blue-600 transition-colors hover:text-blue-700"
            >
              <Link2 size={14} /> Add a Link
            </button>
          </div>
        </FormField>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="soft" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save Changes' : 'Add Meeting'}</Button>
        </div>
      </form>
    </Modal>
  )
}

const blankSeries = { title: '', weekday: 4, start_time: '', end_time: '', location: '', notes: '' }

export function SeriesModal({ open, onClose, onChange }) {
  const [series, setSeries] = useState([])
  const [form, setForm] = useState(blankSeries)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const load = () => getMeetingSeries().then(setSeries)
  useEffect(() => {
    if (open) load()
  }, [open])

  async function add(e) {
    e.preventDefault()
    setBusy(true)
    await createMeetingSeries({
      title: form.title,
      weekday: Number(form.weekday),
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      location: form.location || null,
      notes: form.notes || null,
    })
    await ensureUpcomingMeetings()
    setForm(blankSeries)
    setBusy(false)
    await load()
    onChange()
  }

  async function toggleActive(s) {
    await updateMeetingSeries(s.id, { active: !s.active })
    if (!s.active) await ensureUpcomingMeetings()
    await load()
    onChange()
  }

  async function removeSeries(s) {
    if (!window.confirm(`Delete the weekly "${s.title}" schedule? Upcoming auto-created meetings are removed too; past ones stay.`)) return
    await deleteSeriesUpcomingMeetings(s.id)
    await deleteMeetingSeries(s.id)
    await load()
    onChange()
  }

  return (
    <Modal open={open} onClose={onClose} title="Recurring Meetings">
      <div className="space-y-4">
        <p className="text-sm text-ink-600">
          Set a weekly schedule (like every Thursday) and the Hub auto-creates the meetings for the next two
          months. You can still cancel or edit any single one on the Meetings page.
        </p>

        {series.length > 0 && (
          <ul className="space-y-2">
            {series.map((s) => (
              <li key={s.id} className="flex items-center gap-2 rounded-lg border border-ink-200 bg-surface px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm font-semibold ${s.active ? 'text-ink-900' : 'text-ink-400 line-through'}`}>
                    {s.title}
                  </p>
                  <p className="truncate text-xs text-ink-500">
                    Every {DOW[s.weekday]}{s.start_time ? ` · ${fmtTime(s.start_time)}` : ''}
                    {s.location ? ` · ${s.location}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => toggleActive(s)}
                  className={`shrink-0 rounded-md px-2 py-1 text-xs font-semibold transition-colors ${
                    s.active ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
                  }`}
                  title={s.active ? 'Pause (stop creating new ones)' : 'Resume'}
                >
                  {s.active ? 'Active' : 'Paused'}
                </button>
                <button
                  onClick={() => removeSeries(s)}
                  className="shrink-0 rounded p-1 text-ink-300 transition-colors hover:bg-coral-50 hover:text-coral-600"
                  aria-label="Delete schedule"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={add} className="space-y-3 rounded-xl border border-ink-200 bg-ink-50/50 p-3">
          <p className="flex items-center gap-1.5 font-mono text-2xs font-semibold uppercase tracking-[0.08em] text-ink-500">
            <Plus size={13} /> New Weekly Schedule
          </p>
          <FormField label="Title">
            <input className={inputClass} value={form.title} onChange={set('title')} required placeholder="Thursday club meeting" />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Day">
              <select className={inputClass} value={form.weekday} onChange={set('weekday')}>
                {DOW.map((d, i) => (
                  <option key={i} value={i}>{d}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Location">
              <input className={inputClass} value={form.location} onChange={set('location')} placeholder="Room 204" />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Start time">
              <input type="time" className={inputClass} value={form.start_time} onChange={set('start_time')} />
            </FormField>
            <FormField label="End time">
              <input type="time" className={inputClass} value={form.end_time} onChange={set('end_time')} />
            </FormField>
          </div>
          <div className="flex justify-end">
            <Button type="submit" icon={Check} disabled={busy}>{busy ? 'Adding…' : 'Add Schedule'}</Button>
          </div>
        </form>
      </div>
    </Modal>
  )
}
