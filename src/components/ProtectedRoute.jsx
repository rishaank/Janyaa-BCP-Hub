import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Logo } from './ui'

// Gate for the app shell: shows a brief loader while the session resolves,
// then either renders the page (signed in) or bounces to /login.
export default function ProtectedRoute() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Logo />
          <p className="text-sm text-slate-400">Loading…</p>
        </div>
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  return <Outlet />
}
