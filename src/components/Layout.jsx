import { useState, useEffect } from 'react'
import { Outlet, useLocation, Link, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import MobileShell from './mobile/MobileShell'
import { useIsDesktop } from '../lib/useMediaQuery'
import { useAuth } from '../context/AuthContext'
import { Button, Modal } from './ui'
import { getRecoveryEmail } from '../lib/api'
import { supabase } from '../lib/supabase'

// App shell. Desktop (lg+) keeps the fixed sidebar + top bar; below lg it swaps to
// the mobile redesign's bottom-tab shell. Both render the active page via <Outlet />.
export default function Layout() {
  const isDesktop = useIsDesktop()
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  if (!isDesktop)
    return (
      <>
        <SetupNudge />
        <MobileShell />
      </>
    )

  return (
    <div className="min-h-screen bg-paper">
      <SetupNudge />
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="lg:pl-64">
        <Topbar onMenu={() => setMenuOpen(true)} />
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          <div key={location.pathname} className="ja-fade">
            <Outlet />
          </div>
        </main>
        <footer className="mx-auto max-w-6xl px-4 pb-8 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-ink-200 pt-4 text-xs text-ink-400">
            <span>© {new Date().getFullYear()} Janyaa BCP</span>
            <span aria-hidden>·</span>
            <Link to="/privacy" className="transition-colors hover:text-ink-700">Privacy</Link>
            <span aria-hidden>·</span>
            <Link to="/terms" className="transition-colors hover:text-ink-700">Terms</Link>
          </div>
        </footer>
      </div>
    </div>
  )
}


// Shown to a member who hasn't finished setting their account up — no recovery
// email saved, or still on a password an admin handed them.
//
// Every rule here is scar tissue from a nudge that never appeared:
//   - The dismissal is keyed PER MEMBER. sessionStorage is scoped to the tab,
//     not to the account, so one shared key meant an admin dismissing it in the
//     tab they then signed out of silenced it for the member who signed in next.
//   - It reads user_metadata from getUser() (the server), not from the session
//     in localStorage. An admin setting a member's password does not revoke that
//     member's sessions, so a phone already signed in holds a snapshot of the
//     metadata from whenever its token was issued — and never sees the flag.
//   - The veil does not dismiss it. This is the app's only popup that appears
//     unprompted, and on iOS the click that trails a touch arrives ~300ms later,
//     lands on a veil that wasn't there when the finger went down, and would arm
//     a dismissal the member never made.
//   - The recovery lookup can't hang the decision. iOS suspends in-flight
//     requests when the app is backgrounded — which is exactly what a member does
//     to copy the password out of Messages — so an unsettled promise used to mean
//     the nudge silently never opened.
const NUDGE_KEY = 'janyaa-setup-nudge'
const LOOKUP_TIMEOUT_MS = 5000

function SetupNudge() {
  const navigate = useNavigate()
  const { user, loading } = useAuth()
  const [open, setOpen] = useState(false)
  const uid = user?.id
  const key = uid ? `${NUDGE_KEY}:${uid}` : null

  useEffect(() => {
    if (loading || !uid) return
    let cancelled = false
    try {
      if (sessionStorage.getItem(key) === 'dismissed') return
    } catch {
      /* storage blocked — fall through and just decide */
    }

    // Never let one slow answer decide for both. Whichever the lookups produce,
    // the fallbacks stand in so the effect always reaches a decision.
    const withTimeout = (promise, fallback) =>
      Promise.race([
        promise.catch(() => fallback),
        new Promise((resolve) => setTimeout(() => resolve(fallback), LOOKUP_TIMEOUT_MS)),
      ])

    Promise.all([
      withTimeout(getRecoveryEmail(uid), null),
      withTimeout(
        supabase.auth.getUser().then(({ data }) => data?.user?.user_metadata ?? null),
        null,
      ),
    ]).then(([recovery, meta]) => {
      if (cancelled) return
      // null = we never found out; don't nag on a guess.
      const needsRecovery = recovery === '' 
      const adminSet = Boolean(meta?.must_set_password)
      if (needsRecovery || adminSet) setOpen(true)
    })

    return () => {
      cancelled = true
    }
    // Depend on the id, not the user object: a sign-in fires several auth events
    // in a row, each handing us a new object identity, and each re-run used to
    // cancel the lookup the previous one had in flight.
  }, [uid, loading, key])

  function close() {
    setOpen(false)
    try {
      sessionStorage.setItem(key, 'dismissed')
    } catch {
      /* best effort */
    }
  }

  if (!open) return null

  return (
    <Modal open onClose={close} closeOnVeil={false} title="Finish setting up your account">
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="soft" type="button" onClick={close}>
          Not now
        </Button>
        <Button
          type="button"
          onClick={() => {
            close()
            navigate(`/members/${uid}`)
          }}
        >
          Take me there
        </Button>
      </div>
    </Modal>
  )
}
