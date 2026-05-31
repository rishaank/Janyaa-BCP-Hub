import { createClient } from '@supabase/supabase-js'

// Read credentials from .env.local (VITE_ vars are exposed to the browser).
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anonKey)

if (!isSupabaseConfigured) {
  // The app still loads so you can see the UI; any data/auth call will just fail
  // until you add real values to .env.local and restart `npm run dev`.
  console.warn(
    '[Janyaa Hub] Supabase is not configured. Create .env.local with ' +
      'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
  )
}

export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  anonKey || 'placeholder-anon-key',
)
