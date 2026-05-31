import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

// Holds the current Supabase session + the matching profile row, and exposes
// sign in / sign up / sign out. Wrap the app in <AuthProvider> (see App.jsx).
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

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
    if (!session?.user) {
      setProfile(null)
      return
    }
    supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => setProfile(data))
  }, [session])

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

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
