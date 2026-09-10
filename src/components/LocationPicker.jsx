import { useState, useRef, useEffect, useMemo } from 'react'
import { Search, MapPin, Loader2, Bookmark, History, X } from 'lucide-react'
import { inputClass } from './ui'
import { hasGooglePlaces, fetchSuggestions, newSessionToken, resolveSuggestion } from '../lib/places'

// ONE box for a place: name + address + coordinates behind a single field.
//
// The event form used to ask twice — a Location name and an Address — and then
// tried to guess each from the other. Now the member types once and picks from
// three ranked groups:
//   1. Saved locations (the `locations` table)  — bookmark icon, always on top
//   2. Places the club has been before (past events), newest first — history icon
//   3. Live place search (Google Places, OpenStreetMap fallback) — pin icon
// Each row shows the name large with its address as the subtitle, so two
// branches of the same library are told apart before picking.
//
// `value` is { location, address, latitude, longitude }; `onChange` gets the
// same shape back. The box itself holds the *name*; the resolved address sits
// under it, which is what makes one field enough.
const BAY = '-122.6,37.7,-121.5,36.9'

const norm = (s) => (s || '').trim().toLowerCase()

export default function LocationPicker({ value, onChange, saved = [], pastEvents = [], placeholder }) {
  const [results, setResults] = useState([])
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const timer = useRef(null)
  const box = useRef(null)
  const token = useRef(null)
  const query = value?.location ?? ''

  useEffect(() => {
    function onDoc(e) {
      if (box.current && !box.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])
  useEffect(() => () => clearTimeout(timer.current), [])

  // Saved spots first, then every distinct place the club has run an event at,
  // most recent first. Undated events sort last (they have no date to rank on).
  const savedRows = useMemo(
    () =>
      saved.map((s) => ({
        kind: 'saved',
        key: `saved-${s.id}`,
        name: s.name ?? '',
        address: s.address ?? '',
        lat: s.latitude ?? null,
        lng: s.longitude ?? null,
      })),
    [saved],
  )

  const recentRows = useMemo(() => {
    const savedNames = new Set(savedRows.map((r) => norm(r.name)))
    const seen = new Set()
    return [...pastEvents]
      .filter((e) => (e.location || '').trim())
      .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
      .filter((e) => {
        const k = norm(e.location)
        if (savedNames.has(k) || seen.has(k)) return false
        seen.add(k)
        return true
      })
      .map((e) => ({
        kind: 'recent',
        key: `recent-${e.id}`,
        name: e.location,
        address: e.address ?? '',
        lat: e.latitude ?? null,
        lng: e.longitude ?? null,
      }))
  }, [pastEvents, savedRows])

  const q = norm(query)
  const matches = (r) => !q || norm(r.name).includes(q) || norm(r.address).includes(q)
  const shownSaved = savedRows.filter(matches).slice(0, 5)
  const shownRecent = recentRows.filter(matches).slice(0, 6)
  const hasRows = shownSaved.length + shownRecent.length + results.length > 0

  function type(name) {
    // Typing a new name invalidates the address that belonged to the old one.
    onChange({ location: name, address: '', latitude: null, longitude: null })
    setOpen(true)
    clearTimeout(timer.current)
    if (name.trim().length < 3) {
      setResults([])
      return
    }
    timer.current = setTimeout(async () => {
      setBusy(true)
      // A referrer-restricted key (preview deploys never match the production
      // referrer) would leave the picker silently dead, so any Google failure
      // drops back to OpenStreetMap for that search.
      let hits = []
      if (hasGooglePlaces) hits = await googleSearch(name).catch(() => null)
      if (!hits) hits = await osmSearch(name).catch(() => [])
      setResults(hits)
      setBusy(false)
    }, 350)
  }

  async function googleSearch(text) {
    if (!token.current) token.current = await newSessionToken()
    const hits = await fetchSuggestions(text, token.current)
    return hits.map((h) => ({ kind: 'place', source: 'google', key: `g-${h.id}`, name: h.name, address: h.secondary, hit: h }))
  }

  async function osmSearch(text) {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&countrycodes=us&viewbox=${BAY}&bounded=0&q=${encodeURIComponent(text)}`,
    )
    const data = await res.json()
    return data.map((r) => ({
      kind: 'place',
      source: 'osm',
      key: `o-${r.place_id}`,
      name: r.display_name.split(',')[0],
      address: r.display_name,
      hit: r,
    }))
  }

  async function pick(row) {
    setOpen(false)
    setResults([])
    clearTimeout(timer.current)
    if (row.kind !== 'place') {
      onChange({ location: row.name, address: row.address, latitude: row.lat, longitude: row.lng })
      return
    }
    if (row.source === 'google') {
      // Resolving ends the free autocomplete session (one Essentials lookup).
      const place = await resolveSuggestion(row.hit).catch(() => null)
      token.current = null
      onChange(
        place
          ? { location: place.name, address: place.address, latitude: place.lat, longitude: place.lng }
          : { location: row.name, address: row.address, latitude: null, longitude: null },
      )
      return
    }
    const r = row.hit
    onChange({ location: row.name, address: r.display_name, latitude: Number(r.lat), longitude: Number(r.lon) })
  }

  return (
    <div className="relative" ref={box}>
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
        <input
          className={`${inputClass} pl-9`}
          value={query}
          placeholder={placeholder}
          autoComplete="off"
          onChange={(e) => type(e.target.value)}
          onFocus={() => setOpen(true)}
        />
        {busy && <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-ink-400" />}
      </div>

      {/* The address the picked place resolved to — the second half of the one
          field, and the member's confirmation they picked the right branch. */}
      {value?.address && (
        <p className="mt-1.5 flex items-start gap-1.5 text-xs text-ink-500">
          <MapPin size={12} className="mt-0.5 shrink-0 text-green-600" />
          <span className="min-w-0 flex-1 break-words">{value.address}</span>
          <button
            type="button"
            onClick={() => onChange({ ...value, address: '', latitude: null, longitude: null })}
            className="shrink-0 rounded p-0.5 text-ink-400 transition-colors hover:bg-coral-50 hover:text-coral-600"
            title="Clear the address"
            aria-label="Clear the address"
          >
            <X size={12} />
          </button>
        </p>
      )}

      {open && hasRows && (
        <ul className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-md border border-ink-200 bg-surface py-1 shadow-lg">
          {shownSaved.length > 0 && <Group label="Saved spots" />}
          {shownSaved.map((r) => <Row key={r.key} row={r} onPick={pick} />)}
          {shownRecent.length > 0 && <Group label="Used before" />}
          {shownRecent.map((r) => <Row key={r.key} row={r} onPick={pick} />)}
          {results.length > 0 && <Group label="Search results" />}
          {results.map((r) => <Row key={r.key} row={r} onPick={pick} />)}
        </ul>
      )}
    </div>
  )
}

function Group({ label }) {
  return (
    <li className="px-3 pb-1 pt-2 font-mono text-2xs font-semibold uppercase tracking-[0.08em] text-ink-400">
      {label}
    </li>
  )
}

const icons = { saved: Bookmark, recent: History, place: MapPin }
const iconTones = { saved: 'text-gold-600', recent: 'text-blue-500', place: 'text-green-600' }

function Row({ row, onPick }) {
  const Icon = icons[row.kind] ?? MapPin
  return (
    <li>
      <button
        type="button"
        onClick={() => onPick(row)}
        className="flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors hover:bg-ink-50"
      >
        <Icon size={15} className={`mt-0.5 shrink-0 ${iconTones[row.kind] ?? 'text-green-600'}`} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-ink-900">{row.name}</span>
          {row.address && <span className="block truncate text-xs text-ink-500">{row.address}</span>}
        </span>
      </button>
    </li>
  )
}
