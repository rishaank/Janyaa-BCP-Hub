import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Users, CalendarDays, PiggyBank, Loader2 } from 'lucide-react'
import { Logo } from '../components/ui'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { session, signIn, signUp } = useAuth()
  const navigate = useNavigate()

  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  // Already signed in? Skip the form.
  if (session) return <Navigate to="/" replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setNotice('')
    setBusy(true)

    const { data, error } =
      mode === 'signin'
        ? await signIn(email, password)
        : await signUp(email, password, name)

    setBusy(false)

    if (error) {
      setError(error.message)
      return
    }
    // If email confirmation is on, sign-up returns no session yet.
    if (mode === 'signup' && !data.session) {
      setNotice('Account created. Check your email to confirm, then sign in.')
      setMode('signin')
      return
    }
    navigate('/')
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-blue-700 to-green-700 p-12 text-white lg:flex">
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
          <p className="mt-3 max-w-md text-indigo-100">
            Members, events, and fundraising in one place — so the club can scale its STEM impact
            without drowning in spreadsheets.
          </p>
          <div className="mt-8 flex flex-wrap gap-6 text-sm text-indigo-100">
            <span className="flex items-center gap-2"><Users size={16} /> Member hours</span>
            <span className="flex items-center gap-2"><CalendarDays size={16} /> Event ops</span>
            <span className="flex items-center gap-2"><PiggyBank size={16} /> Fundraising</span>
          </div>
        </div>
        <p className="relative text-xs text-indigo-200">A Janyaa Foundation chapter · Bellarmine College Prep</p>
      </div>

      {/* Auth form */}
      <div className="flex items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            {mode === 'signin' ? 'Sign in' : 'Create your account'}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {mode === 'signin'
              ? 'Welcome back to the Janyaa Hub.'
              : 'Join the club workspace with your email.'}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-3">
            {mode === 'signup' && (
              <Field
                label="Full name"
                type="text"
                value={name}
                onChange={setName}
                placeholder="Krishna Rao"
                required
              />
            )}
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
            {notice && (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 disabled:opacity-60"
            >
              {busy && <Loader2 size={16} className="animate-spin" />}
              {mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-slate-500">
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin')
                setError('')
                setNotice('')
              }}
              className="font-semibold text-indigo-600 hover:text-indigo-500"
            >
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </button>
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
        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
      />
    </label>
  )
}
