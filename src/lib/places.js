// Google Places Autocomplete (New), session-token based.
//
// Cost model — this file is deliberately written to stay inside the free tier:
//   • Autocomplete billed *per session* is free and unlimited, so keystrokes
//     cost nothing as long as every session carries a token.
//   • A session ends on the one fetchFields() call, which bills a single
//     Place Details. We only ever ask for `formattedAddress` + `location`,
//     both **Essentials** tier (10k/month free). We never request
//     `displayName`, which is **Pro** tier (only 5k/month) — the place name
//     comes from the suggestion's structuredFormat.mainText instead, which is
//     part of the free autocomplete response.
//   • Importing the `places` library does not instantiate a Map, so this
//     never bills the Dynamic Maps SKU. Leaflet still draws every map.
//
// With no key configured the app falls back to Nominatim (see
// LocationAutocomplete), so dev and preview builds keep working.

const KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

export const hasGooglePlaces = Boolean(KEY)

// Bias (not restrict) results toward the Bay Area, matching the old Nominatim
// viewbox — a member can still find an out-of-area address.
const BAY_AREA = { west: -122.6, south: 36.9, east: -121.5, north: 37.7 }

let bootstrap

// Load the Maps JS bootstrap once, then pull in just the Places library.
function loadMaps() {
  if (bootstrap) return bootstrap
  bootstrap = new Promise((resolve, reject) => {
    if (window.google?.maps?.importLibrary) {
      resolve()
      return
    }
    const cb = '__janyaaMapsReady'
    window[cb] = () => {
      delete window[cb]
      resolve()
    }
    const s = document.createElement('script')
    s.async = true
    s.src = `https://maps.googleapis.com/maps/api/js?key=${KEY}&v=weekly&loading=async&callback=${cb}`
    s.onerror = () => reject(new Error('Google Maps failed to load'))
    document.head.appendChild(s)
  })
  return bootstrap
}

async function placesLib() {
  await loadMaps()
  return window.google.maps.importLibrary('places')
}

// One token groups a whole type-and-pick interaction into a single free session.
export async function newSessionToken() {
  const { AutocompleteSessionToken } = await placesLib()
  return new AutocompleteSessionToken()
}

// Suggestions for what the member has typed. Free — no Place Details yet.
export async function fetchSuggestions(input, sessionToken) {
  const { AutocompleteSuggestion } = await placesLib()
  const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
    input,
    sessionToken,
    locationBias: BAY_AREA,
    includedRegionCodes: ['us'],
  })
  return suggestions
    .filter((s) => s.placePrediction)
    .map((s) => {
      const p = s.placePrediction
      // The JS library puts these straight on the prediction as FormattableText
      // (the nested `structuredFormat` shape is the REST API's, not this one).
      // mainText = the place name, secondaryText = the rest of the address;
      // mainText is optional, so fall back to the full prediction text.
      return {
        id: p.placeId,
        name: p.mainText?.text ?? p.text?.text ?? '',
        secondary: p.secondaryText?.text ?? '',
        prediction: p,
      }
    })
}

// Ends the session and bills one Essentials Place Details. Returns the shape
// LocationAutocomplete's onSelect already expects.
export async function resolveSuggestion(suggestion) {
  const place = suggestion.prediction.toPlace()
  await place.fetchFields({ fields: ['formattedAddress', 'location'] })
  return {
    name: suggestion.name,
    address: place.formattedAddress ?? [suggestion.name, suggestion.secondary].filter(Boolean).join(', '),
    lat: place.location?.lat() ?? null,
    lng: place.location?.lng() ?? null,
  }
}

// Best single match for a raw address string — powers the event form's
// "address typed → fill in the location name" autofill. One session, one
// Place Details, and only when the Location field is still empty.
export async function lookupAddress(address) {
  const token = await newSessionToken()
  const [top] = await fetchSuggestions(address, token)
  return top ? resolveSuggestion(top) : null
}
