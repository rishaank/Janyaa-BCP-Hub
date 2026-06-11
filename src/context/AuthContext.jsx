import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)
const PROFILE_CACHE = 'janyaa-profile'

// Holds the current Supabase session + the matching profile row, and exposes
// sign in / sign up / sign out. Wrap the app in <AuthProvider> (see App.jsx).
//
// Smoothness: the app doesn't render until the session is read (a fast local
// localStorage lookup), so a signed-in user never flashes the logged-out UI.
// The profile row needs a network round-trip, so the last one is cached and
// hydrated immediately — role badges / admin nav don't pop in late.
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfileState] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(PROFILE_CACHE) || 'null')
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState(true)

  const setProfile = (p) => {
    setProfileState(p)
    try {
      if (p) localStorage.setItem(PROFILE_CACHE, JSON.stringify(p))
      else localStorage.removeItem(PROFILE_CACHE)
    } catch {
      /* storage blocked/full — the cache is best-effort */
    }
  }

  // Load the existing session on mount and subscribe to future changes.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // Whenever the session changes, fetch that user's profile row.
  useEffect(() => {
    if (loading) return // session not resolved yet — keep the hydrated cache
    if (!session?.user) {
      setProfile(null)
      return
    }
    // A cached profile from a different account (account switch) is stale.
    if (profile && profile.id !== session.user.id) setProfileState(null)
    supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        if (data) setProfile(data)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, loading])

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    signIn: (email, password) =>
      supabase.auth.signInWithPassword({ email, password }),
    signUp: (email, password, name) =>
      supabase.auth.signUp({ email, password, options: { data: { name } } }),
    signOut: () => supabase.auth.signOut(),
    // Update the current user's own profile row (e.g. their role) and reflect it locally.
    updateProfile: async (fields) => {
      if (!session?.user) return { error: new Error('Not signed in') }
      const { data, error } = await supabase
        .from('profiles')
        .update(fields)
        .eq('id', session.user.id)
        .select()
        .single()
      if (!error) setProfile(data)
      return { data, error }
    },
  }

  return (
    <AuthContext.Provider value={value}>
      {loading ? <Splash /> : children}
    </AuthContext.Provider>
  )
}

// Sub-second brand splash while the session resolves from localStorage —
// prevents the guest UI from flashing for signed-in members.
function Splash() {
  return (
    <div className="grid min-h-screen place-items-center bg-paper">
      <img src="/janyaa-logo.png" alt="" className="h-12 w-12 animate-pulse" />
    </div>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
