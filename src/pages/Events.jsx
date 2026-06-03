import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, MapPin, Users, DollarSign, Clock, Hourglass, Hand, Copy, Pencil, Trash2, X, CalendarPlus, Check, TrendingUp, ExternalLink, Mail, Instagram, List, CalendarDays, Maximize2 } from 'lucide-react'
import { PageHeader, Card, Button, Badge, ProgressBar, Modal, FormField, inputClass } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import {
  getEvents,
  getLocations,
  signUpForEvent,
  leaveEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  addTodo,
  setTodoAssignee,
  deleteTodo,
  autoGenerateInsights,
  sendRemindersNow,
} from '../lib/api'
import LocationAutocomplete from '../components/LocationAutocomplete'
import MemberChip from '../components/MemberChip'
import EventsCalendar from '../components/EventsCalendar'
import { useRealtime } from '../lib/useRealtime'
import { bestDays, topDay } from '../lib/planning'

const TODAY = new Date().toISOString().slice(0, 10)

// "15:00:00" → "3:00 PM"
function fmtTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':')
  return new Date(2000, 0, 1, Number(h), Number(m)).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
}
function timeRangeOf(start, end) {
  if (!start) return ''
  return end ? `${fmtTime(start)}–${fmtTime(end)}` : fmtTime(start)
}

const segBtn = (active) =>
  `flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
    active ? 'bg-green-600 text-white shadow-xs' : 'text-ink-600 hover:text-ink-900'
  }`

export default function Events() {
  const { user, profile } = useAuth()
  const isAdmin = !!profile?.is_admin
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editEvent, setEditEvent] = useState(null)
  const [showCal, setShowCal] = useState(false)
  const [reminding, setReminding] = useState('')
  const [view, setView] = useState('list')

  async function remindNow() {
    setReminding('Sending…')
    const { data, error } = await sendRemindersNow()
    if (error || !data?.ok) setReminding('Failed')
    else setReminding(data.sent > 0 ? `Sent ${data.sent}` : 'Nothing due')
    setTimeout(() => setReminding(''), 2500)
  }

  const load = () =>
    getEvents().then((data) => {
      setEvents(data)
      setLoading(false)
    })

  useEffect(() => {
    load()
  }, [])
  useRealtime(['events', 'event_signups', 'event_todos'], load)

  const tentative = events.filter((e) => e.is_tentative)
  const upcoming = events.filter((e) => !e.is_tentative && e.date && e.date >= TODAY)
  const past = events.filter((e) => !e.is_tentative && e.date && e.date < TODAY).reverse()

  function openCreate() {
    setEditEvent(null)
    setFormOpen(true)
  }
  function openEdit(ev) {
    setEditEvent(ev)
    setFormOpen(true)
  }

  return (
    <>
      <PageHeader
        title="Events"
        subtitle="Sign up for events to earn hours, and divide up who brings what."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-ink-200 bg-surface p-0.5">
              <button onClick={() => setView('list')} className={segBtn(view === 'list')}>
                <List size={15} /> List
              </button>
              <button onClick={() => setView('calendar')} className={segBtn(view === 'calendar')}>
                <CalendarDays size={15} /> Calendar
              </button>
            </div>
            {isAdmin && (
              <Button variant="soft" icon={Mail} onClick={remindNow} disabled={reminding === 'Sending…'}>
                {reminding || 'Email reminders'}
              </Button>
            )}
            <Button variant="soft" icon={CalendarPlus} onClick={() => setShowCal(true)}>Subscribe</Button>
            <Button icon={Plus} onClick={openCreate}>Add event</Button>
          </div>
        }
      />

      {loading ? (
        <LoadingRows />
      ) : view === 'calendar' ? (
        <EventsCalendar events={events} onSelect={openEdit} />
      ) : (
        <>
          <Section title="Upcoming" count={upcoming.length}>
            {upcoming.map((e) => (
              <EventCard key={e.id} event={e} myId={user?.id} onChange={load} onEdit={openEdit} />
            ))}
          </Section>

          {tentative.length > 0 && (
            <Section title="Tentative" count={tentative.length}>
              {tentative.map((e) => (
                <EventCard key={e.id} event={e} myId={user?.id} onChange={load} onEdit={openEdit} />
              ))}
            </Section>
          )}

          <Section title="Past" count={past.length}>
            {past.map((e) => (
              <EventCard key={e.id} event={e} myId={user?.id} onChange={load} onEdit={openEdit} />
            ))}
          </Section>
        </>
      )}

      <EventFormModal
        open={formOpen}
        event={editEvent}
        events={events}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false)
          load()
          autoGenerateInsights() // new/edited event → refresh AI insights (throttled)
        }}
      />
      <CalendarSubscribeModal open={showCal} onClose={() => setShowCal(false)} />
    </>
  )
}

function CalendarSubscribeModal({ open, onClose }) {
  const httpsUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/calendar`
  const webcalUrl = httpsUrl.replace(/^https?:\/\//, 'webcal://')
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard?.writeText(httpsUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Modal open={open} onClose={onClose} title="Subscribe to the Janyaa calendar">
      <div className="space-y-4">
        <p className="text-sm text-ink-600">
          Add every Janyaa event to your own calendar. It stays in sync — new events and changes
          show up automatically, no re-adding.
        </p>
        <a
          href={webcalUrl}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700"
        >
          <CalendarPlus size={16} /> Add to calendar (Apple / Outlook)
        </a>
        <div>
          <p className="mb-1 text-sm font-semibold text-ink-800">Or copy the link</p>
          <div className="flex gap-2">
            <input
              readOnly
              value={httpsUrl}
              onFocus={(e) => e.target.select()}
              className={`${inputClass} text-xs`}
            />
            <Button variant="soft" icon={copied ? Check : Copy} onClick={copy}>
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </div>
        <div className="space-y-1.5 rounded-lg bg-ink-50 p-3 text-xs text-ink-600">
          <p><span className="font-semibold text-ink-700">Google Calendar:</span> Other calendars → From URL → paste the link → Add calendar.</p>
          <p><span className="font-semibold text-ink-700">Apple / Outlook:</span> tap the green button, or File → New Calendar Subscription → paste the link.</p>
        </div>
      </div>
    </Modal>
  )
}

function LoadingRows() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {[0, 1, 2, 3].map((i) => (
        <Card key={i} className="h-40 animate-pulse bg-ink-50" />
      ))}
    </div>
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

function EventCard({ event, myId, onChange, onEdit }) {
  const isPast = event.date < TODAY
  const signups = event.event_signups ?? []
  const todos = event.event_todos ?? []
  const isSignedUp = signups.some((s) => s.member_id === myId)
  const atCapacity = event.max_people && signups.length >= event.max_people
  const understaffed = signups.length < event.min_people
  const [busy, setBusy] = useState(false)
  const [newTodo, setNewTodo] = useState('')
  const [copied, setCopied] = useState('')
  const timeRange = timeRangeOf(event.start_time, event.end_time)
  const mapsUrl = event.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.address)}`
    : null

  function copy(text, key) {
    navigator.clipboard?.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(''), 1500)
  }

  async function toggleSignup() {
    setBusy(true)
    if (isSignedUp) await leaveEvent(event.id, myId)
    else await signUpForEvent(event.id, myId)
    await onChange()
    setBusy(false)
  }

  async function submitTodo(e) {
    e.preventDefault()
    if (!newTodo.trim()) return
    await addTodo(event.id, newTodo.trim())
    setNewTodo('')
    await onChange()
  }

  async function removeEvent() {
    if (!window.confirm(`Delete "${event.name}"? This can't be undone.`)) return
    await deleteEvent(event.id)
    await onChange()
  }

  return (
    <Card className="flex min-w-0 flex-col p-5 transition-shadow hover:shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={`/events/${event.id}`}
              className="break-words font-display text-h4 font-semibold text-ink-900 transition-colors hover:text-green-700"
            >
              {event.name}
            </Link>
            {event.is_tentative && <Badge tone="gold">Tentative</Badge>}
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-500">
            <MapPin size={14} className="text-ink-400" />{' '}
            {event.location || (event.is_tentative ? <span className="text-ink-400">Location TBD</span> : '')}
          </p>
          {event.address && (
            <>
              <button
                type="button"
                onClick={() => copy(event.address, 'addr')}
                className="mt-1 flex max-w-full items-center gap-1.5 text-xs text-ink-500 transition-colors hover:text-green-700"
                title="Copy address"
              >
                {copied === 'addr' ? (
                  <Check size={12} className="shrink-0 text-green-600" />
                ) : (
                  <Copy size={12} className="shrink-0" />
                )}
                <span className="truncate">{event.address}</span>
              </button>
              <div className="mt-1 flex items-center gap-3 text-xs">
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 font-medium text-blue-600 transition-colors hover:text-blue-700"
                >
                  <ExternalLink size={12} className="shrink-0" /> Open in Google Maps
                </a>
                <button
                  type="button"
                  onClick={() => copy(mapsUrl, 'maps')}
                  className="flex items-center gap-1 text-ink-500 transition-colors hover:text-green-700"
                  title="Copy Google Maps link"
                >
                  {copied === 'maps' ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                  {copied === 'maps' ? 'Copied link' : 'Copy link'}
                </button>
              </div>
            </>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <div className="rounded-xl bg-ink-50 px-3 py-1.5 text-center">
            {event.date ? (
              <>
                <p className="font-mono text-2xs font-semibold uppercase text-ink-500">
                  {new Date(event.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}
                </p>
                <p className="font-display text-lg font-bold leading-tight text-ink-900">
                  {new Date(event.date + 'T00:00:00').getDate()}
                </p>
              </>
            ) : (
              <>
                <p className="font-mono text-2xs font-semibold uppercase text-ink-500">Date</p>
                <p className="font-display text-sm font-bold leading-tight text-ink-500">TBD</p>
              </>
            )}
          </div>
          <div className="flex gap-1">
            <Link
              to={`/events/${event.id}`}
              className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-blue-600"
              aria-label="Open full view"
              title="Open shareable view"
            >
              <Maximize2 size={14} />
            </Link>
            <button
              onClick={() => onEdit(event)}
              className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-blue-600"
              aria-label="Edit event"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={removeEvent}
              className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-coral-50 hover:text-coral-600"
              aria-label="Delete event"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-500">
        {timeRange ? (
          <span className="flex items-center gap-1.5"><Clock size={14} className="text-ink-400" /> {timeRange}</span>
        ) : event.is_tentative ? (
          <span className="flex items-center gap-1.5 text-ink-400"><Clock size={14} className="text-ink-400" /> Time TBD</span>
        ) : null}
        <span className="flex items-center gap-1.5"><Hourglass size={14} className="text-ink-400" /> {event.hours} hrs each</span>
        {Number(event.raised) > 0 && (
          <span className="flex items-center gap-1.5"><DollarSign size={14} className="text-green-600" /> ${Number(event.raised).toLocaleString()} raised</span>
        )}
      </div>

      {event.instagram_urls?.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {event.instagram_urls.map((url, i) => (
            <a
              key={i}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-full bg-ink-50 px-2.5 py-1 text-xs font-medium text-ink-700 transition-colors hover:bg-blue-50 hover:text-blue-700"
            >
              <Instagram size={13} /> {event.instagram_urls.length > 1 ? `Post ${i + 1}` : 'Instagram'}
            </a>
          ))}
        </div>
      )}

      {/* Crew / capacity */}
      <div className="mt-4 rounded-xl bg-ink-50 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-sm font-medium text-ink-700">
            <Users size={15} className="text-ink-400" />
            {isPast ? 'Attended' : 'Crew'}
          </span>
          <span className={`font-mono text-sm font-semibold tabular-nums ${understaffed && !isPast ? 'text-gold-700' : 'text-ink-700'}`}>
            {signups.length}
            {!isPast && (
              <span className="font-normal text-ink-400">
                {' '}/ {event.max_people ?? '∞'} · min {event.min_people}
              </span>
            )}
          </span>
        </div>

        {!isPast && event.max_people > 0 && (
          <ProgressBar value={signups.length} max={event.max_people} tone={understaffed ? 'gold' : 'green'} />
        )}

        {signups.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-x-1 gap-y-0.5">
            {signups.map((s) => (
              <MemberChip key={s.member_id} id={s.member_id} name={s.profiles?.name} role={s.profiles?.role} />
            ))}
          </div>
        ) : (
          <p className="mt-1 text-xs text-ink-400">{isPast ? 'No attendance recorded.' : 'Nobody signed up yet.'}</p>
        )}

        {!isPast && (
          <button
            onClick={toggleSignup}
            disabled={busy || (atCapacity && !isSignedUp)}
            className={`mt-3 w-full rounded-lg py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${
              isSignedUp
                ? 'bg-surface text-ink-700 ring-1 ring-ink-200 hover:bg-ink-50'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {isSignedUp ? 'Leave event' : atCapacity ? 'Event full' : 'Sign up'}
          </button>
        )}
      </div>

      {/* To-dos (upcoming only) */}
      {!isPast && (
        <div className="mt-4">
          <p className="mb-2 font-mono text-2xs font-semibold uppercase tracking-[0.08em] text-ink-500">
            To-dos · who brings what
          </p>
          <ul className="space-y-1.5">
            {todos.map((t) => (
              <TodoRow key={t.id} todo={t} myId={myId} onChange={onChange} />
            ))}
            {todos.length === 0 && <li className="text-xs text-ink-400">No items yet.</li>}
          </ul>
          <form onSubmit={submitTodo} className="mt-2 flex gap-2">
            <input
              value={newTodo}
              onChange={(e) => setNewTodo(e.target.value)}
              placeholder="Add an item (e.g. Tables)"
              className="flex-1 rounded-lg border border-ink-200 px-3 py-1.5 text-sm outline-none focus:border-green-400"
            />
            <button type="submit" className="rounded-lg bg-ink-100 px-3 text-sm font-medium text-ink-600 transition-colors hover:bg-ink-200">
              Add
            </button>
          </form>
        </div>
      )}
    </Card>
  )
}

function TodoRow({ todo, myId, onChange }) {
  const owner = todo.profiles
  const mine = todo.assignee_id === myId

  async function claim() {
    await setTodoAssignee(todo.id, mine ? null : myId)
    await onChange()
  }
  async function remove() {
    await deleteTodo(todo.id)
    await onChange()
  }

  return (
    <li className="group flex items-center gap-2 text-sm">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ink-300" />
      <span className="min-w-0 flex-1 break-words text-ink-700">{todo.item}</span>

      <span className="flex shrink-0 items-center gap-2">
        {owner ? (
          <MemberChip id={owner.id} name={owner.name} role={owner.role} />
        ) : (
          <span className="text-xs text-gold-700">unclaimed</span>
        )}
        <button
          onClick={claim}
          className={`rounded-md px-2 py-0.5 text-xs font-medium transition-colors ${
            mine ? 'bg-ink-100 text-ink-600 hover:bg-ink-200' : 'bg-green-50 text-green-700 hover:bg-green-100'
          }`}
        >
          {mine ? 'Drop' : owner ? 'Take' : <span className="flex items-center gap-1"><Hand size={11} /> Claim</span>}
        </button>
        <button
          onClick={remove}
          className="rounded p-0.5 text-ink-300 transition-colors hover:bg-coral-50 hover:text-coral-600"
          aria-label="Delete to-do"
        >
          <X size={13} />
        </button>
      </span>
    </li>
  )
}

const blank = { name: '', date: '', start_time: '', end_time: '', location: '', address: '', latitude: null, longitude: null, hours: 3, min_people: 2, max_people: 6, raised: 0, notes: '', instagram_urls: [], is_tentative: false }

function EventFormModal({ open, event, events = [], onClose, onSaved }) {
  const [form, setForm] = useState(blank)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const editing = Boolean(event)
  const [saved, setSaved] = useState([])

  const planDays = bestDays(events)
  const planBest = topDay(planDays)
  const picked = form.date ? planDays[new Date(form.date + 'T00:00:00').getDay()] : null

  useEffect(() => {
    if (open) getLocations().then(setSaved)
  }, [open])

  useEffect(() => {
    if (event) {
      setForm({
        name: event.name ?? '',
        date: event.date ?? '',
        start_time: (event.start_time ?? '').slice(0, 5),
        end_time: (event.end_time ?? '').slice(0, 5),
        location: event.location ?? '',
        address: event.address ?? '',
        latitude: event.latitude ?? null,
        longitude: event.longitude ?? null,
        hours: event.hours ?? 3,
        min_people: event.min_people ?? 2,
        max_people: event.max_people ?? 6,
        raised: event.raised ?? 0,
        notes: event.notes ?? '',
        instagram_urls: event.instagram_urls ?? [],
        is_tentative: event.is_tentative ?? false,
      })
    } else {
      setForm(blank)
    }
  }, [event, open])

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    const fields = {
      name: form.name,
      date: form.date || null,
      is_tentative: form.is_tentative,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      location: form.location,
      address: form.address,
      latitude: form.latitude,
      longitude: form.longitude,
      hours: Number(form.hours),
      min_people: Number(form.min_people),
      max_people: Number(form.max_people),
      raised: Number(form.raised),
      notes: form.notes,
      instagram_urls: (form.instagram_urls ?? []).map((s) => s.trim()).filter(Boolean),
    }
    if (editing) await updateEvent(event.id, fields)
    else await createEvent({ ...fields, type: 'other' })
    setBusy(false)
    onSaved()
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit event' : 'Add event'}>
      <form onSubmit={submit} className="space-y-3">
        <FormField label="Event name">
          <input className={inputClass} value={form.name} onChange={set('name')} required placeholder="Library STEM session" />
        </FormField>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-ink-200 bg-ink-50/60 px-3 py-2.5">
          <input
            type="checkbox"
            checked={form.is_tentative}
            onChange={(e) => setForm({ ...form, is_tentative: e.target.checked })}
            className="mt-0.5 h-4 w-4 shrink-0 accent-green-600"
          />
          <span>
            <span className="block text-sm font-semibold text-ink-800">Tentative event</span>
            <span className="mt-0.5 block text-xs text-ink-500">
              Not locked in yet. Leave the date, time, location, or anything else blank and it shows as “TBD”.
              AI Insights will treat it as unconfirmed.
            </span>
          </span>
        </label>
        <FormField label={form.is_tentative ? 'Date · optional' : 'Date'}>
          <input type="date" className={inputClass} value={form.date} onChange={set('date')} required={!form.is_tentative} />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Start time">
            <input type="time" className={inputClass} value={form.start_time} onChange={set('start_time')} />
          </FormField>
          <FormField label="End time">
            <input type="time" className={inputClass} value={form.end_time} onChange={set('end_time')} />
          </FormField>
        </div>
        {picked && planBest && (
          <div className="-mt-1 flex items-start gap-2 rounded-lg bg-gold-50 px-3 py-2 text-xs text-gold-800">
            <TrendingUp size={14} className="mt-0.5 shrink-0" />
            <span>
              {picked.count > 0
                ? `Past ${picked.day} events averaged $${picked.avgRaised} across ${picked.count}.`
                : `No past ${picked.day} events yet.`}{' '}
              Best day so far: <b>{planBest.day}</b> (~${planBest.avgRaised}).
            </span>
          </div>
        )}
        {saved.length > 0 && (
          <FormField label="Use a saved spot">
            <select
              className={inputClass}
              value=""
              onChange={(e) => {
                const loc = saved.find((s) => s.id === e.target.value)
                if (loc) setForm({ ...form, location: loc.name, address: loc.address || '', latitude: loc.latitude ?? null, longitude: loc.longitude ?? null })
              }}
            >
              <option value="">Pick a saved location…</option>
              {saved.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </FormField>
        )}
        <FormField label="Location">
          <LocationAutocomplete
            value={form.location}
            placeholder="Search a place…"
            onChange={(v) => setForm({ ...form, location: v })}
            onSelect={({ name, address, lat, lng }) => setForm({ ...form, location: name, address, latitude: lat ?? null, longitude: lng ?? null })}
          />
        </FormField>
        <FormField label="Address">
          <input className={inputClass} value={form.address} onChange={set('address')} placeholder="Auto-fills from the search above" />
        </FormField>
        <div className="grid grid-cols-3 gap-3">
          <FormField label="Hours each">
            <input type="number" min="0" step="0.5" className={inputClass} value={form.hours} onChange={set('hours')} />
          </FormField>
          <FormField label="Min people">
            <input type="number" min="0" className={inputClass} value={form.min_people} onChange={set('min_people')} />
          </FormField>
          <FormField label="Max people">
            <input type="number" min="0" className={inputClass} value={form.max_people} onChange={set('max_people')} />
          </FormField>
        </div>
        <FormField label="Amount raised ($)">
          <input type="number" min="0" step="1" className={inputClass} value={form.raised} onChange={set('raised')} />
          <span className="mt-1 block text-xs text-ink-500">In-person money raised at this event — feeds the fundraising graph.</span>
        </FormField>
        <FormField label="Notes">
          <textarea className={inputClass} rows={2} value={form.notes} onChange={set('notes')} />
        </FormField>
        <FormField label="Instagram posts">
          <div className="space-y-2">
            {(form.instagram_urls ?? []).map((url, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className={inputClass}
                  value={url}
                  onChange={(e) => {
                    const next = [...form.instagram_urls]
                    next[i] = e.target.value
                    setForm({ ...form, instagram_urls: next })
                  }}
                  placeholder="https://www.instagram.com/p/…"
                />
                <button
                  type="button"
                  onClick={() => setForm({ ...form, instagram_urls: form.instagram_urls.filter((_, j) => j !== i) })}
                  className="shrink-0 rounded-lg border border-ink-300 px-2.5 text-ink-500 transition-colors hover:bg-coral-50 hover:text-coral-600"
                  aria-label="Remove link"
                >
                  <X size={15} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setForm({ ...form, instagram_urls: [...(form.instagram_urls ?? []), ''] })}
              className="flex items-center gap-1 text-sm font-medium text-blue-600 transition-colors hover:text-blue-700"
            >
              <Plus size={14} /> Add Instagram link
            </button>
          </div>
        </FormField>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="soft" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Add event'}</Button>
        </div>
      </form>
    </Modal>
  )
}
