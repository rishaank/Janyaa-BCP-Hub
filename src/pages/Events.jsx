// Event pieces shared by the merged Events & Meetings page (src/pages/EventsMeetings.jsx):
// the event card, the create/edit form modal, and the calendar-subscribe modal.
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, MapPin, Users, DollarSign, Clock, Hourglass, Copy, X, CalendarPlus, Check, TrendingUp, ExternalLink, Link2, Pencil } from 'lucide-react'
import { Card, Button, Badge, ProgressBar, Modal, FormField, inputClass } from '../components/ui'
import {
  getLocations,
  signUpForEvent,
  leaveEvent,
  createEvent,
  updateEvent,
  getEventPlaces,
} from '../lib/api'
import LocationPicker from '../components/LocationPicker'
import MemberChip from '../components/MemberChip'
import LinkChip from '../components/LinkChip'
import EventTodos from '../components/EventTodos'
import { lookupAddress } from '../lib/places'
import ManageAttendeesModal from '../components/ManageAttendeesModal'
import { bestDays, topDay } from '../lib/planning'
import { hasEnded } from '../lib/time'
import { useDraftRescue } from '../lib/useDraftRescue'
import { num, money } from '../lib/format'

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
  return (end ? `${fmtTime(start)}–${fmtTime(end)}` : fmtTime(start)) + ' PST'
}

export function CalendarSubscribeModal({ open, onClose }) {
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
          Add every Janyaa <span className="font-medium text-ink-800">event and club meeting</span> to your own
          calendar. It stays in sync — new items and changes show up automatically, no re-adding.
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

export function EventCard({ event, myId, isAdmin = false, onChange }) {
  const isPast = hasEnded(event)
  const signups = event.event_signups ?? []
  const todos = event.event_todos ?? []
  const isSignedUp = signups.some((s) => s.member_id === myId)
  const atCapacity = event.max_people && signups.length >= event.max_people
  const understaffed = signups.length < event.min_people
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState('')
  const [manage, setManage] = useState(false)
  const timeRange = timeRangeOf(event.start_time, event.end_time)
  // Instagram posts live in `links` since migration 0037; older rows kept them
  // in the legacy column.
  const eventLinks = event.links?.length ? event.links : event.instagram_urls ?? []
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

  return (
    <Card className="flex min-w-0 flex-col p-5 transition-shadow hover:shadow-card sm:p-6">
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
          {(event.location || event.is_tentative) && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-500">
              <MapPin size={14} className="text-ink-400" />{' '}
              {event.location || <span className="text-ink-400">Location TBD</span>}
            </p>
          )}
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
        {/* Edit / delete now live on the full-screen view (open via the title). */}
        <Link
          to={`/events/${event.id}`}
          className="shrink-0 rounded-xl bg-ink-50 px-3 py-1.5 text-center transition-colors hover:bg-ink-100"
          aria-label="Open full view"
        >
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
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-500">
        {timeRange ? (
          <span className="flex items-center gap-1.5"><Clock size={14} className="text-ink-400" /> {timeRange}</span>
        ) : event.is_tentative ? (
          <span className="flex items-center gap-1.5 text-ink-400"><Clock size={14} className="text-ink-400" /> Time TBD</span>
        ) : null}
        <span className="flex items-center gap-1.5"><Hourglass size={14} className="text-ink-400" /> {num(event.hours)} hrs each</span>
        {Number(event.raised) > 0 && (
          <span className="flex items-center gap-1.5"><DollarSign size={14} className="text-green-600" /> {money(event.raised)} raised</span>
        )}
      </div>

      {eventLinks.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {eventLinks.map((url, i) => (
            <LinkChip key={i} url={url} />
          ))}
        </div>
      )}

      {/* Spacer pushes the crew box to the card bottom on past events while keeping a gap above. */}
      {isPast && <div aria-hidden className="flex-1" />}
      {/* Crew / capacity */}
      <div className="mt-5 rounded-xl bg-ink-50 p-4">
        <div className="mb-2.5 flex items-center justify-between">
          <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-ink-700">
            {isSignedUp ? <Check size={15} className="shrink-0 text-green-600" /> : <Users size={15} className="shrink-0 text-ink-400" />}
            <span className={understaffed && !isPast ? 'text-gold-700' : undefined}>
              {signups.length} Attendees
            </span>
            {!isPast && (
              <span className="truncate font-normal text-ink-400">
                · max {event.max_people ?? '∞'} · min {event.min_people}
              </span>
            )}
          </span>
          {isAdmin && (
            <button
              onClick={() => setManage(true)}
              className="shrink-0 rounded-md p-1 text-ink-400 transition-colors hover:bg-ink-100 hover:text-blue-600"
              title="Add or remove crew"
              aria-label="Add or remove crew"
            >
              <Pencil size={14} />
            </button>
          )}
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
        <div className="mt-5">
          <EventTodos eventId={event.id} todos={todos} myId={myId} onChange={onChange} />
        </div>
      )}

      {isAdmin && (
        <ManageAttendeesModal
          open={manage}
          onClose={() => setManage(false)}
          title={event.name}
          current={signups}
          onAdd={async (id) => { await signUpForEvent(event.id, id); await onChange() }}
          onRemove={async (id) => { await leaveEvent(event.id, id); await onChange() }}
        />
      )}
    </Card>
  )
}

const blank = { name: '', date: '', start_time: '', end_time: '', location: '', address: '', latitude: null, longitude: null, hours: 3, min_people: 2, max_people: 6, raised: 0, notes: '', links: [], is_tentative: false }

// Which optional fields a saved event already uses — those open straight away so
// an edit never hides data behind an Add button.
const extrasFor = (e) => ({ raised: Number(e?.raised) > 0, notes: Boolean((e?.notes ?? '').trim()) })

export function EventFormModal({ open, event, events = [], onClose, onReopen, onSaved }) {
  const [form, setForm] = useState(blank)
  const [busy, setBusy] = useState(false)
  // Amount raised + notes stay out of the way until asked for (same pattern as
  // the link rows) — most events are created with neither.
  const [extras, setExtras] = useState(extrasFor(null))
  // Closing a half-filled form says so and offers Undo instead of binning it.
  const rescue = useDraftRescue({ label: 'Event', value: form, onClose, reopen: onReopen ?? onClose })
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const editing = Boolean(event)
  const [saved, setSaved] = useState([])
  const [places, setPlaces] = useState([]) // every place the club has used before

  const planDays = bestDays(events)
  const planBest = topDay(planDays)
  const picked = form.date ? planDays[new Date(form.date + 'T00:00:00').getDay()] : null

  useEffect(() => {
    if (!open) return
    getLocations().then(setSaved)
    getEventPlaces().then(setPlaces)
  }, [open])

  useEffect(() => {
    if (!open) return // never wipe the form on the way out — Undo still needs it
    if (rescue.consumeRestore()) return // Undo — keep the rescued draft on screen
    if (event) {
      const next = {
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
        // Instagram posts folded into the general link list (migration 0037);
        // older rows still carry them under the legacy column.
        links: event.links?.length ? event.links : event.instagram_urls ?? [],
        is_tentative: event.is_tentative ?? false,
      }
      setForm(next)
      rescue.setBaseline(next)
    } else {
      setForm(blank)
      rescue.setBaseline(blank)
    }
    setExtras(extrasFor(event))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, open])

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    // One box holds the place, so fill in the other half here: a name typed
    // without picking a suggestion gets resolved to a real address + pin on the
    // way to the database, which is what the event view's map needs.
    let { location, address, latitude, longitude } = form
    if (location.trim() && !address.trim()) {
      const place = await lookupAddress(location).catch(() => null)
      if (place) {
        address = place.address ?? ''
        latitude = place.lat ?? null
        longitude = place.lng ?? null
      }
    }
    const fields = {
      name: form.name,
      date: form.date || null,
      is_tentative: form.is_tentative,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      location,
      address,
      latitude,
      longitude,
      hours: Number(form.hours),
      min_people: Number(form.min_people),
      max_people: Number(form.max_people),
      raised: Number(form.raised),
      notes: form.notes,
      links: (form.links ?? []).map((s) => s.trim()).filter(Boolean),
    }
    if (editing) await updateEvent(event.id, fields)
    else await createEvent({ ...fields, type: 'other' })
    setBusy(false)
    onSaved()
  }

  // Hiding an optional field clears it, so a collapsed box never saves a value
  // nobody can see.
  function dropExtra(key) {
    setExtras((x) => ({ ...x, [key]: false }))
    setForm((f) => ({ ...f, [key]: key === 'raised' ? 0 : '' }))
  }

  return (
    <Modal open={open} onClose={rescue.close} title={editing ? 'Edit Event' : 'Add Event'}>
      <form onSubmit={submit} className="space-y-3">
        <FormField label="Event name">
          <input className={inputClass} value={form.name} onChange={set('name')} required placeholder="Library STEM session" />
        </FormField>
        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-ink-200 bg-ink-50/60 px-3 py-2.5">
          <input
            type="checkbox"
            checked={form.is_tentative}
            onChange={(e) => setForm({ ...form, is_tentative: e.target.checked })}
            className="h-4 w-4 shrink-0 accent-green-600"
          />
          <span className="text-sm font-semibold text-ink-800">Tentative event</span>
        </label>
        <FormField label={form.is_tentative ? 'Date · optional' : 'Date'}>
          <input type="date" className={inputClass} value={form.date} onChange={set('date')} required={!form.is_tentative} />
        </FormField>
        {/* Native date/time controls have a wide minimum, so two columns only
            appear once there's room — below that they stack instead of clipping. */}
        <div className="grid grid-cols-1 gap-3 min-[26rem]:grid-cols-2">
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
                ? `Past ${picked.day} events averaged ${money(picked.avgRaised)} across ${picked.count}.`
                : `No past ${picked.day} events yet.`}{' '}
              Best day so far: <b>{planBest.day}</b> (~{money(planBest.avgRaised)}).
            </span>
          </div>
        )}
        <FormField label="Location">
          <LocationPicker
            value={form}
            onChange={(place) => setForm((f) => ({ ...f, ...place }))}
            saved={saved}
            pastEvents={places}
            placeholder="Search a place, or pick one you've used…"
          />
        </FormField>
        <div className="grid grid-cols-2 gap-3 min-[26rem]:grid-cols-3">
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
        {extras.raised && (
          <FormField label="Amount raised ($)">
            <div className="flex gap-2">
              <input type="number" min="0" step="1" className={inputClass} value={form.raised} onChange={set('raised')} />
              <RemoveFieldButton label="Remove amount raised" onClick={() => dropExtra('raised')} />
            </div>
          </FormField>
        )}
        {extras.notes && (
          <FormField label="Notes">
            <div className="flex gap-2">
              <textarea className={inputClass} rows={2} value={form.notes} onChange={set('notes')} />
              <RemoveFieldButton label="Remove notes" onClick={() => dropExtra('notes')} />
            </div>
          </FormField>
        )}
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
                  placeholder="Instagram post, sign-up sheet, flyer…"
                />
                <RemoveFieldButton label="Remove link" onClick={() => setForm({ ...form, links: form.links.filter((_, j) => j !== i) })} />
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
        {(!extras.raised || !extras.notes) && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {!extras.raised && (
              <button
                type="button"
                onClick={() => setExtras((x) => ({ ...x, raised: true }))}
                className="flex items-center gap-1 text-sm font-medium text-blue-600 transition-colors hover:text-blue-700"
              >
                <Plus size={14} /> Add Amount Raised
              </button>
            )}
            {!extras.notes && (
              <button
                type="button"
                onClick={() => setExtras((x) => ({ ...x, notes: true }))}
                className="flex items-center gap-1 text-sm font-medium text-blue-600 transition-colors hover:text-blue-700"
              >
                <Plus size={14} /> Add Notes
              </button>
            )}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="soft" type="button" onClick={rescue.close}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save Changes' : 'Add Event'}</Button>
        </div>
      </form>
    </Modal>
  )
}

// The square X beside a removable row — shared by links and the optional fields.
function RemoveFieldButton({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 self-start rounded-lg border border-ink-300 px-2.5 py-2.5 text-ink-500 transition-colors hover:bg-coral-50 hover:text-coral-600"
      aria-label={label}
      title={label}
    >
      <X size={15} />
    </button>
  )
}
