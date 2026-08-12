import { useState, useRef, useEffect } from 'react'
import { Search, MapPin, Loader2 } from 'lucide-react'
import { inputClass } from './ui'
import { hasGooglePlaces, fetchSuggestions, newSessionToken, resolveSuggestion } from '../lib/places'

// Debounced place search. Uses Google Places Autocomplete (free per session)
// when VITE_GOOGLE_MAPS_API_KEY is set, otherwise falls back to OpenStreetMap
// so dev/preview builds without the key still work.
// onSelect gets { name, address, lat, lng } for the chosen result.
const BAY = '-122.6,37.7,-121.5,36.9'

export default function LocationAutocomplete({ value, onChange, onSelect, placeholder }) {
  const [results, setResults] = useState([])
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const timer = useRef(null)
  const box = useRef(null)
  // One Google session token spans a whole type-and-pick; cleared on select so
  // the next search starts a fresh (still free) session.
  const token = useRef(null)

  useEffect(() => {
    function onDoc(e) {
      if (box.current && !box.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  function handle(q) {
    onChange(q)
    clearTimeout(timer.current)
    if (q.trim().length < 3) {
      setResults([])
      return
    }
    timer.current = setTimeout(async () => {
      setBusy(true)
      // A referrer-restricted key (Vercel preview deploys never match the
      // production referrer) would otherwise leave the picker silently dead,
      // so any Google failure drops back to OpenStreetMap for that search.
      let hits = []
      if (hasGooglePlaces) hits = await googleSearch(q).catch(() => null)
      if (!hits) hits = await osmSearch(q).catch(() => [])
      setResults(hits)
      setOpen(true)
      setBusy(false)
    }, 350)
  }

  async function googleSearch(q) {
    if (!token.current) token.current = await newSessionToken()
    const hits = await fetchSuggestions(q, token.current)
    return hits.map((h) => ({
      source: 'google',
      key: h.id,
      label: [h.name, h.secondary].filter(Boolean).join(', '),
      hit: h,
    }))
  }

  async function osmSearch(q) {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&countrycodes=us&viewbox=${BAY}&bounded=0&q=${encodeURIComponent(q)}`,
    )
    const data = await res.json()
    return data.map((r) => ({ source: 'osm', key: r.place_id, label: r.display_name, hit: r }))
  }

  // Branch on where the result actually came from, not on whether a key exists
  // — after a Google failure the list holds OSM rows.
  async function pick(result) {
    setOpen(false)
    setResults([])
    if (result.source === 'google') {
      // Resolving ends the session (one Essentials Place Details).
      const place = await resolveSuggestion(result.hit).catch(() => null)
      token.current = null
      if (place) onSelect(place)
      return
    }
    const r = result.hit
    onSelect({
      name: r.display_name.split(',')[0],
      address: r.display_name,
      lat: Number(r.lat),
      lng: Number(r.lon),
    })
  }

  return (
    <div className="relative" ref={box}>
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
        <input
          className={`${inputClass} pl-9`}
          value={value}
          placeholder={placeholder}
          autoComplete="off"
          onChange={(e) => handle(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
        />
        {busy && <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-ink-400" />}
      </div>
      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border border-ink-200 bg-surface shadow-lg">
          {results.map((r) => (
            <li key={r.key}>
              <button
                type="button"
                onClick={() => pick(r)}
                className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-ink-50"
              >
                <MapPin size={15} className="mt-0.5 shrink-0 text-green-600" />
                <span className="text-ink-700">{r.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
