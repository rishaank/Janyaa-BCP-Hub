import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { getRecoveryEmail } from '../lib/api'
import { Card, Button } from '../components/ui'
import { useDocumentTitle } from '../lib/useDocumentTitle'

// An unlisted page that prints what the app actually sees for the signed-in
// member: the build it's running, the auth metadata, and the inputs to the
// setup prompt. Nothing links here — it exists so a question like "is the flag
// set?" or "is this phone on an old build?" can be answered from the device
// itself instead of inferred. Own data only, behind the same auth as everything.
export default function WhoAmI() {
  const { user, profile, mustSetPassword } = useAuth()
  const [recovery, setRecovery] = useState('(loading)')
  const [fresh, setFresh] = useState(null)
  useDocumentTitle('Account check')

  useEffect(() => {
    if (!user) return
    getRecoveryEmail(user.id).then((e) => setRecovery(e || '(none saved)'))
    // getUser() asks the server, unlike the session in localStorage — if these
    // two disagree, the browser is holding a stale copy.
    supabase.auth.getUser().then(({ data }) => setFresh(data?.user ?? null))
  }, [user])

  if (!user) {
    return (
      <Card className="p-5">
        <p className="text-sm text-ink-600">Sign in first.</p>
      </Card>
    )
  }

  const cached = user.user_metadata ?? {}
  const server = fresh?.user_metadata ?? null
  const wouldPrompt = mustSetPassword || recovery === '(none saved)'

  const rows = [
    ['App build', typeof __BUILD_SHA__ === 'string' ? __BUILD_SHA__ : 'unknown'],
    ['Signed in as', user.email],
    ['Member id', user.id],
    ['Admin', profile?.is_admin ? 'yes' : 'no'],
    ['Recovery email', recovery],
    ['must_set_password (this browser)', String(cached.must_set_password)],
    ['must_set_password (from server)', server ? String(server.must_set_password) : '(loading)'],
    ['Setup prompt would show', wouldPrompt ? 'yes' : 'no'],
  ]

  return (
    <div className="mx-auto max-w-xl">
      <Card className="p-5">
        <h1 className="font-display text-h3 font-bold text-ink-900">Account check</h1>
        <p className="mt-1 text-sm text-ink-600">
          What the app currently sees for your own account.
        </p>
        <dl className="mt-4 divide-y divide-ink-200 border-y border-ink-200">
          {rows.map(([label, value]) => (
            <div key={label} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
              <dt className="text-sm text-ink-500">{label}</dt>
              <dd className="break-all font-mono text-sm text-ink-900">{String(value)}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs text-ink-500">Full auth metadata:</p>
        <pre className="mt-1 overflow-x-auto rounded-lg border border-ink-200 bg-ink-50 p-3 font-mono text-[11px] text-ink-700">
          {JSON.stringify(server ?? cached, null, 2)}
        </pre>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="soft"
            type="button"
            onClick={() => {
              try {
                sessionStorage.removeItem('janyaa-setup-nudge')
              } catch {
                /* ignore */
              }
              window.location.href = '/'
            }}
          >
            Re-arm setup prompt
          </Button>
          <Link to="/">
            <Button variant="soft" type="button">
              Back to dashboard
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  )
}
