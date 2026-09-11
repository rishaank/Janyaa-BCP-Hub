import { useState } from 'react'
import { Outlet, useLocation, Link, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import MobileShell from './mobile/MobileShell'
import { useIsDesktop } from '../lib/useMediaQuery'
import { useAuth } from '../context/AuthContext'
import { Button, Modal } from './ui'

// App shell. Desktop (lg+) keeps the fixed sidebar + top bar; below lg it swaps to
// the mobile redesign's bottom-tab shell. Both render the active page via <Outlet />.
export default function Layout() {
  const isDesktop = useIsDesktop()
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const { mustSetPassword } = useAuth()

  // Signed in on a password an admin chose. This is a RECOMMENDATION, not a
  // gate: the admin who set that password had a reason to, so the member is
  // asked, not forced.
  const nudge = mustSetPassword ? <PasswordNudge /> : null

  if (!isDesktop)
    return (
      <>
        {nudge}
        <MobileShell />
      </>
    )

  return (
    <div className="min-h-screen bg-paper">
      {nudge}
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


// Shown once per sign-in to a member whose password was set by an admin. It
// recommends they take the account over — their own password, plus the recovery
// email that lets them reset it later without asking anyone. Dismissable: the
// admin-set password keeps working either way.
const NUDGE_KEY = 'janyaa-password-nudge'

function PasswordNudge() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(() => {
    try {
      return sessionStorage.getItem(NUDGE_KEY) !== 'dismissed'
    } catch {
      return true // storage blocked — showing it twice beats never showing it
    }
  })

  function close() {
    setOpen(false)
    try {
      sessionStorage.setItem(NUDGE_KEY, 'dismissed')
    } catch {
      /* best effort */
    }
  }

  return (
    <Modal open={open} onClose={close} title="Make this account yours">
      <p className="text-sm text-ink-700">
        You're signed in with a password an admin set for you. Choose your own so nobody else knows
        it, and add a recovery email on your profile so you can reset it yourself later.
      </p>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button variant="soft" type="button" onClick={close}>
          Not now
        </Button>
        <Button
          type="button"
          onClick={() => {
            close()
            navigate('/set-password')
          }}
        >
          Change password
        </Button>
      </div>
    </Modal>
  )
}
