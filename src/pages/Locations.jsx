import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Search, MapPin, Trash2, Pencil, Plus, Loader2, LocateFixed } from 'lucide-react'
import {
  PageHeader,
  Card,
  Badge,
  Modal,
  FormField,
  Button,
  inputClass,
  statusTones,
  statusLabels,
  formatDate,
} from '../components/ui'
import { getLocations, getEvents, saveLocation, updateLocation, deleteLocation } from '../lib/api'
import { useRealtime } from '../lib/useRealtime'
import { locationPerformance } from '../lib/planning'

// Green dot for a not-yet-saved pin.
const pendingIcon = L.divIcon({
  className: '',
  html: '<div style="width:18px;height:18px;border-radius:50%;background:#10b981;border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

// Pulsing blue dot for the user's live location.
const userIcon = L.divIcon({
  className: '',
  html: '<div class="ja-userdot"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

// Numbered teardrop pin for a saved location. Gold = the top-earning spot.
const pinIcon = (n, gold = false) =>
  L.divIcon({
    className: '',
    html: `<div style="display:grid;place-items:center;width:${gold ? 28 : 26}px;height:${gold ? 28 : 26}px;border-radius:50% 50% 50% 0;transform:rotate(45deg);background:${gold ? '#fba631' : '#2a943b'};border:2px solid #fff;box-shadow:0 2px ${gold ? 8 : 6}px rgba(0,0,0,.35)"><span style="transform:rotate(-45deg);color:${gold ? '#3a2e10' : '#fff'};font:700 12px/1 system-ui,sans-serif">${n}</span></div>`,
    iconSize: gold ? [28, 28] : [26, 26],
    iconAnchor: gold ? [14, 28] : [13, 26],
    popupAnchor: [0, -24],
  })

const SAN_JOSE = [37.3015, -121.848]
const statusOptions = ['prospect', 'contacted', 'approved', 'declined', 'recurring_partner']

// Look up a street address + a best-guess name for a lat/lng (OpenStreetMap, free).
async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
      { headers: { Accept: 'application/json' } },
    )
    const d = await res.json()
    const a = d.address ?? {}
    const name = d.name || a.amenity || a.shop || a.leisure || a.building || a.road || ''
    return { name, address: d.display_name || '' }
  } catch {
    return { name: '', address: '' }
  }
}

export default function Locations() {
  const [locations, setLocations] = useState([])
  const [events, setEvents] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [pending, setPending] = useState(null) // {lat, lng, name, address}
  const [editing, setEditing] = useState(null) // saved location being edited
  const [flyTo, setFlyTo] = useState(null)
  const [userLoc, setUserLoc] = useState(null)
  const [locating, setLocating] = useState(false)

  const load = () =>
    getLocations().then((d) => {
      setLocations(d)
      setLoaded(true)
    })

  // Drop a pin, open the save modal, and auto-fill name + address from the map.
  async function dropPin(lat, lng) {
    setPending({ lat, lng, name: '', address: '' })
    setFlyTo([lat, lng])
    const info = await reverseGeocode(lat, lng)
    setPending((p) => (p && p.lat === lat && p.lng === lng ? { ...p, ...info } : p))
  }

  function locate() {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLoc([pos.coords.latitude, pos.coords.longitude])
        setLocating(false)
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 },
    )
  }

  useEffect(() => {
    load()
    locate()
    getEvents().then(setEvents)
  }, [])
  useRealtime('locations', load)

  // Which saved spots have earned the most across past events.
  const perf = locationPerformance(events, locations)
  const topId = Object.entries(perf)
    .filter(([, p]) => p.count > 0)
    .sort((a, b) => b[1].raised - a[1].raised)[0]?.[0]

  const pinPoints = locations
    .filter((l) => l.latitude != null)
    .map((l) => [Number(l.latitude), Number(l.longitude)])

  return (
    <>
      <PageHeader
        title="Locations"
        subtitle="Search or drop a pin to save fundraising spots — the address fills in automatically."
        action={
          <Button variant="soft" icon={locating ? Loader2 : LocateFixed} onClick={locate} disabled={locating}>
            {locating ? 'Locating…' : 'Use my location'}
          </Button>
        }
      />

      <SearchBar
        onPick={(r) => {
          const lat = Number(r.lat)
          const lng = Number(r.lon)
          setPending({ lat, lng, name: r.display_name.split(',')[0], address: r.display_name })
          setFlyTo([lat, lng])
        }}
      />

      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        {/* Map */}
        <Card className="relative z-0 overflow-hidden lg:col-span-2">
          <div className="relative z-0 h-[460px] w-full isolate">
            <MapContainer center={SAN_JOSE} zoom={10} className="h-full w-full" scrollWheelZoom>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FlyTo target={flyTo} />
              <ClickToPin onPin={dropPin} />
              {/* Fit to the user + every saved pin once data is loaded. */}
              <FitBounds ready={loaded} points={[userLoc, ...pinPoints]} />

              {userLoc && (
                <Marker position={userLoc} icon={userIcon}>
                  <Popup>
                    <p className="font-semibold">You're here</p>
                    <button
                      onClick={() => dropPin(userLoc[0], userLoc[1])}
                      className="mt-1 rounded-md bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700"
                    >
                      Save this spot
                    </button>
                  </Popup>
                </Marker>
              )}

              {locations.map((loc, i) =>
                loc.latitude != null ? (
                  <Marker key={loc.id} position={[Number(loc.latitude), Number(loc.longitude)]} icon={pinIcon(i + 1, loc.id === topId)}>
                    <Popup>
                      <p className="font-semibold">{loc.name}</p>
                      <p className="text-xs text-slate-500">{statusLabels[loc.status]}</p>
                      {loc.description && <p className="mt-1 text-xs">{loc.description}</p>}
                    </Popup>
                  </Marker>
                ) : null,
              )}

              {pending && <Marker position={[pending.lat, pending.lng]} icon={pendingIcon} />}
            </MapContainer>
          </div>
          <p className="px-4 py-2 text-xs text-ink-400">
            Tip: search above, click anywhere to drop a pin, or use the blue dot to save where you are.
          </p>
        </Card>

        {/* Saved list — capped + scrollable so it never stretches the map */}
        <div>
          <h3 className="mb-3 font-mono text-2xs font-semibold uppercase tracking-[0.08em] text-ink-500">
            Saved · {locations.length}
          </h3>
          <div className="space-y-3 lg:max-h-[420px] lg:overflow-y-auto lg:pr-1">
            {locations.length === 0 && <p className="text-sm text-ink-400">No saved locations yet.</p>}
            {locations.map((loc, i) => (
              <Card key={loc.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <button
                    className="flex items-start gap-2 text-left font-semibold text-ink-900 hover:text-green-700"
                    onClick={() => loc.latitude != null && setFlyTo([Number(loc.latitude), Number(loc.longitude)])}
                  >
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-green-600 text-[11px] font-bold text-white">
                      {i + 1}
                    </span>
                    {loc.name}
                  </button>
                  <span className="shrink-0">
                    <Badge tone={statusTones[loc.status]}>{statusLabels[loc.status]}</Badge>
                  </span>
                </div>
                {loc.address && (
                  <p className="mt-1 flex items-start gap-1.5 text-xs text-ink-500">
                    <MapPin size={13} className="mt-0.5 shrink-0 text-ink-400" /> {loc.address}
                  </p>
                )}
                {loc.description && <p className="mt-2 text-sm text-ink-600">{loc.description}</p>}
                {perf[loc.id]?.count > 0 && (
                  <p className="mt-2 text-xs font-semibold text-green-700">
                    ${perf[loc.id].raised.toLocaleString()} raised · {perf[loc.id].count} event
                    {perf[loc.id].count === 1 ? '' : 's'} here{loc.id === topId ? ' · top earner' : ''}
                  </p>
                )}
                <div className="mt-2 flex items-center justify-between border-t border-ink-100 pt-2 text-xs text-ink-400">
                  <span>{loc.contact_person || 'No contact'} · {formatDate(loc.saved_at.slice(0, 10))}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditing(loc)}
                      className="rounded p-1 text-ink-400 hover:bg-blue-50 hover:text-blue-600"
                      aria-label="Edit location"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={async () => {
                        await deleteLocation(loc.id)
                        load()
                      }}
                      className="rounded p-1 text-ink-400 hover:bg-coral-50 hover:text-coral-600"
                      aria-label="Delete location"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>

      <SaveLocationModal
        pending={pending}
        onClose={() => setPending(null)}
        onSaved={() => {
          setPending(null)
          load()
        }}
      />
      <EditLocationModal
        location={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null)
          load()
        }}
      />
    </>
  )
}

// Search OpenStreetMap (Nominatim) and let the user pick a result.
function SearchBar({ onPick }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [busy, setBusy] = useState(false)

  async function search(e) {
    e.preventDefault()
    if (!query.trim()) return
    setBusy(true)
    const bayArea = '-122.6,37.7,-121.5,36.9' // left,top,right,bottom — local bias
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=6&countrycodes=us&viewbox=${bayArea}&bounded=0&q=${encodeURIComponent(query)}`,
    )
    setResults(await res.json())
    setBusy(false)
  }

  return (
    <div className="relative mb-4">
      <form onSubmit={search} className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a place, address, or business…"
            className={`${inputClass} pl-9`}
          />
        </div>
        <Button type="submit" disabled={busy} icon={busy ? Loader2 : Search}>
          {busy ? 'Searching…' : 'Search'}
        </Button>
      </form>

      {results.length > 0 && (
        <ul className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-ink-200 bg-surface shadow-lg">
          {results.map((r) => (
            <li key={r.place_id}>
              <button
                onClick={() => {
                  onPick(r)
                  setResults([])
                  setQuery(r.display_name.split(',')[0])
                }}
                className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-ink-50"
              >
                <MapPin size={15} className="mt-0.5 shrink-0 text-green-600" />
                <span className="text-ink-700">{r.display_name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function FlyTo({ target }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.flyTo(target, 14, { duration: 0.8 })
  }, [target, map])
  return null
}

function ClickToPin({ onPin }) {
  useMapEvents({
    click(e) {
      onPin(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

// Fit the map so the user's location and every saved pin are visible.
// Waits for data (`ready`) and re-measures the container first, so the very
// first load fits everything instead of snapping to a single point.
function FitBounds({ points, ready }) {
  const map = useMap()
  const valid = points.filter(Boolean)
  const key = valid.map((p) => p.join(',')).join('|')
  useEffect(() => {
    if (!ready || valid.length === 0) return
    const t = setTimeout(() => {
      map.invalidateSize()
      if (valid.length === 1) map.setView(valid[0], 13)
      else map.fitBounds(valid, { padding: [60, 60], maxZoom: 14 })
    }, 150)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready])
  return null
}

const blankLoc = { name: '', address: '', status: 'prospect', contact_person: '', contact_email: '', description: '' }

function LocationFields({ form, set }) {
  return (
    <>
      <FormField label="Name / title">
        <input className={inputClass} value={form.name} onChange={set('name')} required placeholder="Evergreen Village Square" />
      </FormField>
      <FormField label="Address">
        <input className={inputClass} value={form.address} onChange={set('address')} placeholder="Street, city" />
      </FormField>
      <FormField label="Status">
        <select className={inputClass} value={form.status} onChange={set('status')}>
          {statusOptions.map((s) => (
            <option key={s} value={s}>{statusLabels[s]}</option>
          ))}
        </select>
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Contact person">
          <input className={inputClass} value={form.contact_person} onChange={set('contact_person')} placeholder="Manager" />
        </FormField>
        <FormField label="Contact email">
          <input type="email" className={inputClass} value={form.contact_email} onChange={set('contact_email')} placeholder="name@place.com" />
        </FormField>
      </div>
      <FormField label="Description / notes">
        <textarea className={inputClass} rows={2} value={form.description} onChange={set('description')} placeholder="Why this spot is worth it, permit info, best days…" />
      </FormField>
    </>
  )
}

function SaveLocationModal({ pending, onClose, onSaved }) {
  const [form, setForm] = useState(blankLoc)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  useEffect(() => {
    if (pending) setForm((f) => ({ ...f, name: pending.name || '', address: pending.address || '' }))
  }, [pending])

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    await saveLocation({ ...form, latitude: pending.lat, longitude: pending.lng })
    setBusy(false)
    setForm(blankLoc)
    onSaved()
  }

  return (
    <Modal open={Boolean(pending)} onClose={onClose} title="Save location">
      <form onSubmit={submit} className="space-y-3">
        <p className="rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-500">
          📍 {pending ? `${pending.lat.toFixed(4)}, ${pending.lng.toFixed(4)}` : ''} — address auto-filled from the map
        </p>
        <LocationFields form={form} set={set} />
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="soft" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" icon={Plus} disabled={busy}>{busy ? 'Saving…' : 'Save location'}</Button>
        </div>
      </form>
    </Modal>
  )
}

function EditLocationModal({ location, onClose, onSaved }) {
  const [form, setForm] = useState(blankLoc)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  useEffect(() => {
    if (location) {
      setForm({
        name: location.name ?? '',
        address: location.address ?? '',
        status: location.status ?? 'prospect',
        contact_person: location.contact_person ?? '',
        contact_email: location.contact_email ?? '',
        description: location.description ?? '',
      })
    }
  }, [location])

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    await updateLocation(location.id, form)
    setBusy(false)
    onSaved()
  }

  return (
    <Modal open={Boolean(location)} onClose={onClose} title="Edit location">
      <form onSubmit={submit} className="space-y-3">
        <LocationFields form={form} set={set} />
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="soft" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</Button>
        </div>
      </form>
    </Modal>
  )
}
