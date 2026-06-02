import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Gate for the non-public pages. Renders inside the app shell (Layout), so it
// only fills the content area: a brief loader while the session resolves, then
// the page (signed in) or a bounce to /login (the sign-in prompt).
export default function ProtectedRoute() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="grid place-items-center py-24">
        <p className="text-sm text-ink-400">Loading…</p>
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  return <Outlet />
}
