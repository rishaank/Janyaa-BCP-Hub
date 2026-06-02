import { useState } from 'react'
import { Navigate, useNavigate, Link } from 'react-router-dom'
import { Users, CalendarDays, PiggyBank, Loader2 } from 'lucide-react'
import { Logo } from '../components/ui'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { session, signIn } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Already signed in? Skip the form.
  if (session) return <Navigate to="/" replace />

  // Sign-in only — accounts are created by club admins (invite-only).
  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { error } = await signIn(email, password)
    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    navigate('/')
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-blue-800 to-green-800 p-12 text-white lg:flex">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgb(255 255 255 / 0.5) 1px, transparent 0)',
            backgroundSize: '28px 28px',
          }}
        />
        <div className="relative flex items-center gap-2.5">
          <img src="/janyaa-logo.png" alt="" className="h-11 w-11 rounded-lg bg-white p-0.5" />
          <span className="font-display text-lg font-bold">Janyaa BCP Hub</span>
        </div>
        <div className="relative">
          <h1 className="max-w-md text-3xl font-bold leading-tight">The operational home for Janyaa BCP.</h1>
          <p className="mt-3 max-w-md text-white/75">
            Members, events, and fundraising in one place — so the club can scale its STEM impact
            without drowning in spreadsheets.
          </p>
          <div className="mt-8 flex flex-wrap gap-6 text-sm text-white/75">
            <span className="flex items-center gap-2"><Users size={16} /> Member hours</span>
            <span className="flex items-center gap-2"><CalendarDays size={16} /> Event ops</span>
            <span className="flex items-center gap-2"><PiggyBank size={16} /> Fundraising</span>
          </div>
        </div>
        <p className="relative text-xs text-white/60">A Janyaa Foundation chapter · BCP</p>
      </div>

      {/* Auth form */}
      <div className="flex items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Sign in</h2>
          <p className="mt-1 text-sm text-slate-500">Welcome back to the Janyaa Hub.</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-3">
            <Field
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="you@bcp.org"
              required
            />
            <Field
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder="••••••••"
              required
            />

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 disabled:opacity-60"
            >
              {busy && <Loader2 size={16} className="animate-spin" />}
              Sign in
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-slate-500">
            Need an account? Ask a club lead to invite you.
          </p>

          <p className="mt-6 text-center text-xs text-slate-400">
            By signing in you agree to our{' '}
            <Link to="/terms" className="font-medium text-slate-500 hover:text-slate-700">Terms</Link>{' '}
            and{' '}
            <Link to="/privacy" className="font-medium text-slate-500 hover:text-slate-700">Privacy Policy</Link>.
          </p>

          <p className="mt-4 text-center text-sm">
            <Link to="/" className="text-slate-400 transition-colors hover:text-slate-600">
              ← Back to the dashboard
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

function Field({ label, type, value, onChange, placeholder, required }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-xl border border-slate-200 bg-surface px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
      />
    </label>
  )
}
