import { useEffect, useState } from 'react'
import { Plus, Repeat, Clock, MapPin, Users, Pencil, Trash2, Ban, RotateCcw, Check } from 'lucide-react'
import { PageHeader, Card, Button, Badge, Modal, FormField, inputClass } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import {
  getMeetings, getMeetingSeries, ensureUpcomingMeetings,
  createMeeting, updateMeeting, deleteMeeting, setMeetingCanceled,
  createMeetingSeries, updateMeetingSeries, deleteMeetingSeries, deleteSeriesUpcomingMeetings,
  markAttendance, unmarkAttendance,
} from '../lib/api'
import MemberChip from '../components/MemberChip'
import { useRealtime } from '../lib/useRealtime'

const TODAY = new Date().toISOString().slice(0, 10)
const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function fmtTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':')
  return new Date(2000, 0, 1, Number(h), Number(m)).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}
function timeRangeOf(start, end) {
  if (!start) return ''
  return end ? `${fmtTime(start)}–${fmtTime(end)}` : fmtTime(start)
}

export default function Meetings() {
  const { user } = useAuth()
  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editMeeting, setEditMeeting] = useState(null)
  const [seriesOpen, setSeriesOpen] = useState(false)

  const load = () =>
    getMeetings().then((data) => {
      setMeetings(data)
      setLoading(false)
    })

  // Materialize any missing recurring occurrences, then load.
  useEffect(() => {
    ensureUpcomingMeetings().then(load)
  }, [])
  useRealtime(['meetings', 'meeting_series', 'meeting_attendees'], load)

  const upcoming = meetings.filter((m) => m.date >= TODAY)
  const past = meetings.filter((m) => m.date < TODAY).reverse()

  function openCreate() {
    setEditMeeting(null)
    setFormOpen(true)
  }
  function openEdit(m) {
    setEditMeeting(m)
    setFormOpen(true)
  }

  return (
    <>
      <PageHeader
        title="Meetings"
        subtitle="Club meetings — keep the schedule, track who's there, and jot the notes."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="soft" icon={Repeat} onClick={() => setSeriesOpen(true)}>Recurring</Button>
            <Button icon={Plus} onClick={openCreate}>Add meeting</Button>
          </div>
        }
      />

      {loading ? (
        <LoadingRows />
      ) : (
        <>
          <Section title="Upcoming" count={upcoming.length}>
            {upcoming.map((m) => (
              <MeetingCard key={m.id} meeting={m} myId={user?.id} onChange={load} onEdit={openEdit} />
            ))}
          </Section>
          <Section title="Past" count={past.length}>
            {past.map((m) => (
              <MeetingCard key={m.id} meeting={m} myId={user?.id} onChange={load} onEdit={openEdit} />
            ))}
          </Section>
        </>
      )}

      <MeetingFormModal
        open={formOpen}
        meeting={editMeeting}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false)
          load()
        }}
      />
      <SeriesModal open={seriesOpen} onClose={() => setSeriesOpen(false)} onChange={load} />
    </>
  )
}

function Section({ title, count, children }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 font-mono text-2xs font-semibold uppercase tracking-[0.08em] text-ink-500">
        {title} · {count}
      </h2>
      {count === 0 ? (
        <p className="text-sm text-ink-400">Nothing here yet.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">{children}</div>
      )}
    </section>
  )
}

function LoadingRows() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {[0, 1].map((i) => (
        <Card key={i} className="h-36 animate-pulse bg-ink-50" />
      ))}
    </div>
  )
}

function MeetingCard({ meeting, myId, onChange, onEdit }) {
  const isPast = meeting.date < TODAY
  const canceled = meeting.canceled
  const attendees = meeting.meeting_attendees ?? []
  const iAmIn = attendees.some((a) => a.member_id === myId)
  const [busy, setBusy] = useState(false)
  const timeRange = timeRangeOf(meeting.start_time, meeting.end_time)

  async function toggleAttend() {
    setBusy(true)
    if (iAmIn) await unmarkAttendance(meeting.id, myId)
    else await markAttendance(meeting.id, myId)
    await onChange()
    setBusy(false)
  }
  async function toggleCancel() {
    await setMeetingCanceled(meeting.id, !canceled)
    await onChange()
  }
  async function remove() {
    if (!window.confirm(`Delete "${meeting.title}"? This can't be undone.`)) return
    await deleteMeeting(meeting.id)
    await onChange()
  }

  return (
    <Card className={`flex min-w-0 flex-col p-5 transition-shadow hover:shadow-card ${canceled ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={`break-words font-display text-h4 font-semibold text-ink-900 ${canceled ? 'line-through' : ''}`}>
              {meeting.title}
            </h3>
            {meeting.series_id && <Badge tone="blue">Weekly</Badge>}
            {canceled && <Badge tone="coral">Canceled</Badge>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-500">
            {timeRange && (
              <span className="flex items-center gap-1.5"><Clock size={14} className="text-ink-400" /> {timeRange}</span>
            )}
            {meeting.location && (
              <span className="flex items-center gap-1.5"><MapPin size={14} className="text-ink-400" /> {meeting.location}</span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <div className="rounded-xl bg-ink-50 px-3 py-1.5 text-center">
            <p className="font-mono text-2xs font-semibold uppercase text-ink-500">
              {new Date(meeting.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}
            </p>
            <p className="font-display text-lg font-bold leading-tight text-ink-900">
              {new Date(meeting.date + 'T00:00:00').getDate()}
            </p>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => onEdit(meeting)}
              className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-blue-600"
              aria-label="Edit meeting"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={toggleCancel}
              className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-gold-100 hover:text-gold-700"
              aria-label={canceled ? 'Restore meeting' : 'Cancel meeting'}
              title={canceled ? 'Restore' : 'Cancel'}
            >
              {canceled ? <RotateCcw size={14} /> : <Ban size={14} />}
            </button>
            <button
              onClick={remove}
              className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-coral-50 hover:text-coral-600"
              aria-label="Delete meeting"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>

      {meeting.notes && <p className="mt-3 whitespace-pre-wrap text-sm text-ink-600">{meeting.notes}</p>}

      <div className="mt-4 rounded-xl bg-ink-50 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-sm font-medium text-ink-700">
            <Users size={15} className="text-ink-400" />
            {isPast ? 'Attended' : 'Attending'}
          </span>
          <span className="font-mono text-sm font-semibold tabular-nums text-ink-700">{attendees.length}</span>
        </div>
        {attendees.length > 0 ? (
          <div className="flex flex-wrap gap-x-1 gap-y-0.5">
            {attendees.map((a) => (
              <MemberChip key={a.member_id} id={a.member_id} name={a.profiles?.name} role={a.profiles?.role} />
            ))}
          </div>
        ) : (
          <p className="text-xs text-ink-400">{isPast ? 'No attendance recorded.' : 'Nobody marked yet.'}</p>
        )}
        {!canceled && (
          <button
            onClick={toggleAttend}
            disabled={busy}
            className={`mt-3 w-full rounded-lg py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${
              iAmIn
                ? 'bg-surface text-ink-700 ring-1 ring-ink-200 hover:bg-ink-50'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {iAmIn ? (isPast ? 'Remove me' : "I'm out") : isPast ? 'I was there' : "I'll be there"}
          </button>
        )}
      </div>
    </Card>
  )
}

const blankMeeting = { title: '', date: '', start_time: '', end_time: '', location: '', notes: '' }

function MeetingFormModal({ open, meeting, onClose, onSaved }) {
  const [form, setForm] = useState(blankMeeting)
  const [busy, setBusy] = useState(false)
  const editing = Boolean(meeting)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  useEffect(() => {
    if (meeting) {
      setForm({
        title: meeting.title ?? '',
        date: meeting.date ?? '',
        start_time: (meeting.start_time ?? '').slice(0, 5),
        end_time: (meeting.end_time ?? '').slice(0, 5),
        location: meeting.location ?? '',
        notes: meeting.notes ?? '',
      })
    } else {
      setForm(blankMeeting)
    }
  }, [meeting, open])

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    const fields = {
      title: form.title,
      date: form.date,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      location: form.location || null,
      notes: form.notes || null,
    }
    if (editing) await updateMeeting(meeting.id, fields)
    else await createMeeting(fields)
    setBusy(false)
    onSaved()
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit meeting' : 'Add meeting'}>
      <form onSubmit={submit} className="space-y-3">
        <FormField label="Title">
          <input className={inputClass} value={form.title} onChange={set('title')} required placeholder="Weekly officer sync" />
        </FormField>
        <FormField label="Date">
          <input type="date" className={inputClass} value={form.date} onChange={set('date')} required />
        </FormField>
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
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="soft" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Add meeting'}</Button>
        </div>
      </form>
    </Modal>
  )
}

const blankSeries = { title: '', weekday: 4, start_time: '', end_time: '', location: '', notes: '' }

function SeriesModal({ open, onClose, onChange }) {
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
    <Modal open={open} onClose={onClose} title="Recurring meetings">
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
            <Plus size={13} /> New weekly schedule
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
            <Button type="submit" icon={Check} disabled={busy}>{busy ? 'Adding…' : 'Add schedule'}</Button>
          </div>
        </form>
      </div>
    </Modal>
  )
}
