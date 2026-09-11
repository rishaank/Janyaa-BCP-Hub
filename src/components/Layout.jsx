import { useState, useEffect } from 'react'
import { Outlet, useLocation, Link, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import MobileShell from './mobile/MobileShell'
import { useIsDesktop } from '../lib/useMediaQuery'
import { useAuth } from '../context/AuthContext'
import { Button, Modal } from './ui'
import { getRecoveryEmail } from '../lib/api'

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


// Shown once per sign-in to a member who hasn't finished setting their account
// up — no recovery email saved, or still on a password an admin handed them.
//
// The recovery check is what makes this reliable. The admin-set flag lives in
// auth user_metadata and only the admin-users Edge Function can write it, so it
// is silently absent whenever that function lags the app; a member with no
// recovery address is the same population and the app can see it for itself.
// Either signal is enough, and both point at the same two tasks.
const NUDGE_KEY = 'janyaa-setup-nudge'

function SetupNudge() {
  const navigate = useNavigate()
  const { user, loading, mustSetPassword } = useAuth()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (loading || !user) return
    let cancelled = false
    try {
      if (sessionStorage.getItem(NUDGE_KEY) === 'dismissed') return
    } catch {
      /* storage blocked — fall through and just show it */
    }
    getRecoveryEmail(user.id).then((recovery) => {
      if (!cancelled && (mustSetPassword || !recovery)) setOpen(true)
    })
    return () => {
      cancelled = true
    }
  }, [user, loading, mustSetPassword])

  function close() {
    setOpen(false)
    try {
      sessionStorage.setItem(NUDGE_KEY, 'dismissed')
    } catch {
      /* best effort */
    }
  }

  if (!open) return null

  return (
    <Modal open onClose={close} title="Finish setting up your account">
      <p className="text-sm text-ink-700">
        Two things worth doing once: pick a password only you know, and add a recovery email so you
        can get back in if you ever forget it.
      </p>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button variant="soft" type="button" onClick={close}>
          Not now
        </Button>
        <Button
          type="button"
          onClick={() => {
            close()
            navigate(`/members/${user.id}`)
          }}
        >
          Take me there
        </Button>
      </div>
    </Modal>
  )
}
