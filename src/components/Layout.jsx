import { useState } from 'react'
import { Outlet, useLocation, Link } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

// App shell: fixed sidebar + top bar, with the active page rendered into <Outlet />.
export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  return (
    <div className="min-h-screen bg-paper">
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
