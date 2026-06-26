import { useEffect, useState, useCallback, memo } from 'react'
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  ArrowLeft, Share2, Check, MapPin, Clock, Hourglass, DollarSign, Users, ExternalLink, Instagram, CalendarDays,
  Pencil, Trash2, UserCog, LogIn,
} from 'lucide-react'
import { Logo, Avatar, Badge, Button, roleTones } from '../components/ui'
import { getPublicEvent, getEvent, signUpForEvent, leaveEvent, deleteEvent, initials } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import Linkify from '../components/Linkify'
import ManageAttendeesModal from '../components/ManageAttendeesModal'
import { EventFormModal } from './Events'

const TODAY = new Date().toISOString().slice(0, 10)

const pin = L.divIcon({
  className: '',
  html: '<div style="display:grid;place-items:center;width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(45deg);background:#2a943b;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35)"></div>',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
})

const fmtTime = (t) => {
  if (!t) return ''
  const [h, m] = t.split(':')
  return new Date(2000, 0, 1, Number(h), Number(m)).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}
const fmtDate = (iso) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

// Normalize an Instagram post/reel URL to its canonical permalink (drops query
// params like ?img_index) so the official embed renders the full post.
function cleanIg(url) {
  const m = (url || '').match(/instagram\.com\/(p|reel|tv)\/([A-Za-z0-9_-]+)/)
  return m ? `https://www.instagram.com/${m[1]}/${m[2]}/` : null
}

// Renders Instagram posts via the official embed.js (shows the full carousel +
// caption). Memoized so it isn't reprocessed on parent re-renders.
const InstagramEmbeds = memo(function InstagramEmbeds({ urls }) {
  useEffect(() => {
    const process = () => window.instgrm?.Embeds?.process()
    if (window.instgrm?.Embeds) {
      process()
      return
    }
    let s = document.getElementById('ig-embed-js')
    if (!s) {
      s = document.createElement('script')
      s.id = 'ig-embed-js'
      s.async = true
      s.src = 'https://www.instagram.com/embed.js'
      document.body.appendChild(s)
    }
    s.addEventListener('load', process)
    const t = setTimeout(process, 1000) // in case the script was already cached
    return () => {
      s?.removeEventListener('load', process)
      clearTimeout(t)
    }
  }, [urls])

  return (
    <div className="grid items-start gap-4 sm:grid-cols-2">
      {urls.map((url, i) => {
        const permalink = cleanIg(url)
        return (
          <div key={i} className="overflow-hidden rounded-xl border border-ink-200 bg-surface">
            <blockquote
              className="instagram-media"
              data-instgrm-permalink={permalink}
              data-instgrm-version="14"
              style={{ background: '#FFF', border: 0, margin: 0, width: '100%', minWidth: 0 }}
            >
              <a href={permalink} target="_blank" rel="noreferrer" className="block p-4 text-sm font-medium text-blue-600">
                View this post on Instagram
              </a>
            </blockquote>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-1.5 border-t border-ink-200 py-2.5 text-xs font-medium text-ink-600 transition-colors hover:text-blue-700"
            >
              <ExternalLink size={12} /> View / share on Instagram
            </a>
          </div>
        )
      })}
    </div>
  )
})

export default function EventView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { isDark } = useTheme()
  const { session, user, profile } = useAuth()
  const isAdmin = !!profile?.is_admin
  const [event, setEvent] = useState(undefined) // undefined = loading, null = not found
  const [copied, setCopied] = useState(false)
  // Admin edit/manage modal state.
  const [editEvent, setEditEvent] = useState(null) // full row for the form, or null
  const [editOpen, setEditOpen] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)
  // Loading → base title; not found → "Event not found"; loaded → the event name.
  useDocumentTitle(event === undefined ? null : event?.name || 'Event not found')

  const reload = useCallback(() => getPublicEvent(id).then(setEvent), [id])
  useEffect(() => {
    reload()
  }, [reload])

  // The public RPC omits min/max-people, so pull the full row for the edit form.
  async function openEdit() {
    const full = await getEvent(id)
    setEditEvent(full)
    setEditOpen(true)
  }
  async function removeEvent() {
    if (!window.confirm(`Delete "${event?.name}"? This can't be undone.`)) return
    await deleteEvent(id)
    goBack()
  }

  async function share() {
    const url = window.location.href
    // Native share sheet on mobile (and any browser that supports it); fall
    // back to copying the link on desktop / unsupported browsers.
    if (navigator.share) {
      try {
        await navigator.share({ title: event?.name || 'Janyaa BCP event', url })
        return
      } catch (err) {
        if (err?.name === 'AbortError') return // user dismissed the sheet
        // otherwise fall through to clipboard
      }
    }
    navigator.clipboard?.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  // Back to wherever they came from (usually Events); fall back to the public
  // dashboard for direct/shared links (location.key === 'default' on first load).
  const goBack = () => (location.key !== 'default' ? navigate(-1) : navigate('/'))

  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-[500] border-b border-ink-200 bg-surface/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link to="/" aria-label="Janyaa BCP Hub"><Logo /></Link>
          <button onClick={goBack} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800">
            <ArrowLeft size={16} /> Back
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {event === undefined ? (
          <div className="space-y-4">
            <div className="h-8 w-2/3 animate-pulse rounded-md bg-ink-100" />
            <div className="h-64 w-full animate-pulse rounded-xl bg-ink-100" />
          </div>
        ) : event === null ? (
          <div className="py-24 text-center">
            <h1 className="font-display text-h2 font-bold text-ink-900">Event not found</h1>
            <p className="mt-2 text-sm text-ink-500">This event may have been removed.</p>
            <Link to="/" className="mt-4 inline-block text-sm font-medium text-blue-600 hover:text-blue-700">← Back to the dashboard</Link>
          </div>
        ) : (
          <EventBody
            event={event}
            isDark={isDark}
            copied={copied}
            onShare={share}
            session={session}
            userId={user?.id}
            isAdmin={isAdmin}
            reload={reload}
            onEdit={openEdit}
            onDelete={removeEvent}
            onManage={() => setManageOpen(true)}
          />
        )}
      </main>

      {/* Admin edit + manage (loaded from the full row so min/max-people survive). */}
      {isAdmin && event && (
        <>
          <EventFormModal
            open={editOpen}
            event={editEvent}
            onClose={() => setEditOpen(false)}
            onSaved={() => { setEditOpen(false); reload() }}
          />
          <ManageAttendeesModal
            open={manageOpen}
            onClose={() => setManageOpen(false)}
            title={event.name}
            current={(event.attendees ?? []).map((a) => ({ member_id: a.id, profiles: { name: a.name, role: a.role } }))}
            onAdd={async (mid) => { await signUpForEvent(id, mid); await reload() }}
            onRemove={async (mid) => { await leaveEvent(id, mid); await reload() }}
          />
        </>
      )}
    </div>
  )
}

function EventBody({ event, isDark, copied, onShare, session, userId, isAdmin, reload, onEdit, onDelete, onManage }) {
  const attendees = event.attendees ?? []
  const igUrls = (event.instagram_urls ?? []).filter((u) => cleanIg(u))
  const timeRange = event.start_time
    ? (event.end_time
        ? `${fmtTime(event.start_time)}–${fmtTime(event.end_time)}`
        : fmtTime(event.start_time)) + ' PST'
    : ''
  const mapsUrl = event.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.address)}`
    : null
  const raised = Number(event.raised) || 0

  return (
    <>
      {/* Hero */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="break-words font-display text-h1 font-bold tracking-tight text-ink-900">{event.name}</h1>
            {event.is_tentative && <Badge tone="gold">Tentative</Badge>}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-600">
            <span className="flex items-center gap-1.5">
              <CalendarDays size={15} className="text-ink-400" />
              {event.date ? fmtDate(event.date) : 'Date TBD'}
            </span>
            {timeRange ? (
              <span className="flex items-center gap-1.5"><Clock size={15} className="text-ink-400" /> {timeRange}</span>
            ) : event.is_tentative ? (
              <span className="flex items-center gap-1.5 text-ink-400"><Clock size={15} /> Time TBD</span>
            ) : null}
            {event.location && (
              <span className="flex items-center gap-1.5"><MapPin size={15} className="text-ink-400" /> {event.location}</span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {isAdmin && (
            <>
              <Button variant="soft" icon={Pencil} onClick={onEdit}>Edit</Button>
              <Button variant="danger" icon={Trash2} onClick={onDelete}>Delete</Button>
            </>
          )}
          <button
            onClick={onShare}
            className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700"
          >
            {copied ? <Check size={16} /> : <Share2 size={16} />}
            {copied ? 'Link copied' : 'Share'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        <Stat icon={Hourglass} tone="green" label="Hours each" value={event.hours} />
        <Stat icon={DollarSign} tone="gold" label="Raised" value={`$${raised.toLocaleString()}`} />
        <Stat icon={Users} tone="blue" label={event.date && event.date < new Date().toISOString().slice(0, 10) ? 'Attendees' : 'Signed up'} value={attendees.length} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Map + address */}
        {(event.latitude != null || event.address) && (
          <div className="overflow-hidden rounded-xl border border-ink-200 bg-surface">
            <div className="relative z-0 h-64 w-full isolate">
              <EventMap lat={event.latitude} lng={event.longitude} address={event.address} isDark={isDark} />
            </div>
            {event.address && (
              <div className="flex items-center justify-between gap-2 px-4 py-3">
                <p className="min-w-0 truncate text-sm text-ink-600">{event.address}</p>
                {mapsUrl && (
                  <a href={mapsUrl} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700">
                    <ExternalLink size={13} /> Maps
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        {/* Crew — interactive: sign up / leave, hours note, admin manage. */}
        <CrewCard
          event={event}
          attendees={attendees}
          session={session}
          userId={userId}
          isAdmin={isAdmin}
          reload={reload}
          onManage={onManage}
        />
      </div>

      {/* Notes / timeline */}
      {event.notes && (
        <div className="mt-6 rounded-xl border border-ink-200 bg-surface p-5">
          <h2 className="mb-2 font-semibold text-ink-900">Details</h2>
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-600"><Linkify>{event.notes}</Linkify></p>
        </div>
      )}

      {/* Instagram */}
      {igUrls.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-3 flex items-center gap-1.5 font-semibold text-ink-900">
            <Instagram size={16} className="text-ink-400" /> On Instagram
          </h2>
          <InstagramEmbeds urls={igUrls} />
        </div>
      )}

      <footer className="mt-12 flex items-center gap-2 border-t border-ink-200 pt-6 text-sm text-ink-500">
        <span>Janyaa BCP</span>
        <span aria-hidden>·</span>
        <Link to="/privacy" className="hover:text-ink-800">Privacy</Link>
        <span aria-hidden>·</span>
        <Link to="/terms" className="hover:text-ink-800">Terms</Link>
      </footer>
    </>
  )
}

function Stat({ icon: Icon, label, value, tone }) {
  const tones = { green: 'bg-green-50 text-green-600', gold: 'bg-gold-100 text-gold-700', blue: 'bg-blue-50 text-blue-500' }
  return (
    <div className="rounded-xl border border-ink-200 bg-surface p-4">
      <span className={`grid h-9 w-9 place-items-center rounded-md ${tones[tone] ?? tones.green}`}>
        <Icon size={18} />
      </span>
      <p className="mt-3 font-display text-2xl font-bold tabular-nums text-ink-900">{value}</p>
      <p className="text-xs text-ink-500">{label}</p>
    </div>
  )
}

// Crew list + the interactive bits: sign up / leave (upcoming, non-tentative),
// the hours explanation, and the admin Manage button. Guests get a sign-in CTA.
function CrewCard({ event, attendees, session, userId, isAdmin, reload, onManage }) {
  const isPast = event.date && event.date < TODAY
  const isSignedUp = attendees.some((a) => a.id === userId)
  const [busy, setBusy] = useState(false)

  async function toggle() {
    setBusy(true)
    if (isSignedUp) await leaveEvent(event.id, userId)
    else await signUpForEvent(event.id, userId)
    await reload()
    setBusy(false)
  }

  return (
    <div className="flex flex-col rounded-xl border border-ink-200 bg-surface p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 font-semibold text-ink-900">
          <Users size={16} className="text-ink-400" /> {isPast ? 'Attendees' : 'Crew'} · {attendees.length}
        </h2>
        {isAdmin && (
          <button
            onClick={onManage}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-ink-500 transition-colors hover:bg-ink-100 hover:text-blue-600"
          >
            <UserCog size={14} /> Manage
          </button>
        )}
      </div>

      {attendees.length === 0 ? (
        <p className="text-sm text-ink-400">{isPast ? 'No attendance recorded.' : 'Nobody signed up yet.'}</p>
      ) : (
        <div className="flex flex-wrap gap-x-4 gap-y-3">
          {attendees.map((a) => (
            <div key={a.id} className="flex items-center gap-2">
              <Avatar size="sm" initials={initials(a.name)} tone={roleTones[a.role] ?? 'blue'} src={a.avatar_url} />
              <span className="text-sm text-ink-700">{a.name}</span>
            </div>
          ))}
        </div>
      )}

      {!isPast && !event.is_tentative && (
        session ? (
          <button
            onClick={toggle}
            disabled={busy}
            className={`mt-4 w-full rounded-lg py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
              isSignedUp ? 'bg-surface text-ink-700 ring-1 ring-ink-200 hover:bg-ink-50' : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {isSignedUp ? 'Leave event' : 'Sign up'}
          </button>
        ) : (
          <Link
            to="/login"
            className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg bg-green-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700"
          >
            <LogIn size={15} /> Sign in to sign up
          </Link>
        )
      )}

      {!event.is_tentative && (
        <p className="mt-3 text-xs text-ink-400">
          {isPast
            ? `${event.hours} hrs counted automatically for everyone who attended.`
            : `Everyone who signs up earns ${event.hours} hrs — added automatically once the event has taken place.`}
        </p>
      )}
    </div>
  )
}

// Map with the event's coordinates, geocoding the address if none were stored.
function EventMap({ lat, lng, address, isDark }) {
  const [coords, setCoords] = useState(lat != null && lng != null ? [Number(lat), Number(lng)] : null)

  useEffect(() => {
    if (coords || !address) return
    let alive = true
    fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`)
      .then((r) => r.json())
      .then((d) => {
        if (alive && d?.[0]) setCoords([Number(d[0].lat), Number(d[0].lon)])
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [address, coords])

  if (!coords) {
    return <div className="grid h-full w-full place-items-center bg-ink-50 text-sm text-ink-400">Map unavailable</div>
  }

  return (
    <MapContainer center={coords} zoom={15} className="h-full w-full" scrollWheelZoom={false} dragging={false} attributionControl={false}>
      <TileLayer
        key={isDark ? 'dark' : 'light'}
        url={isDark ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png' : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'}
      />
      <Marker position={coords} icon={pin} />
    </MapContainer>
  )
}
