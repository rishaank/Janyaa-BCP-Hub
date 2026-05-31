import { useState, useRef, useEffect } from 'react'
import { Search, MapPin, Loader2 } from 'lucide-react'
import { inputClass } from './ui'

// Debounced place search (OpenStreetMap, biased to the US + Bay Area).
// onSelect gets { name, address, lat, lng } for the chosen result.
const BAY = '-122.6,37.7,-121.5,36.9'

export default function LocationAutocomplete({ value, onChange, onSelect, placeholder }) {
  const [results, setResults] = useState([])
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const timer = useRef(null)
  const box = useRef(null)

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
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&countrycodes=us&viewbox=${BAY}&bounded=0&q=${encodeURIComponent(q)}`,
        )
        setResults(await res.json())
        setOpen(true)
      } catch {
        setResults([])
      }
      setBusy(false)
    }, 350)
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
            <li key={r.place_id}>
              <button
                type="button"
                onClick={() => {
                  onSelect({
                    name: r.display_name.split(',')[0],
                    address: r.display_name,
                    lat: Number(r.lat),
                    lng: Number(r.lon),
                  })
                  setOpen(false)
                  setResults([])
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
