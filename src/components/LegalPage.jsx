import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Logo } from './ui'

// Public reading layout for the Privacy Policy + Terms pages. Works logged in or
// out (these must be reachable by anyone, e.g. from the Login page).
export default function LegalPage({ title, updated, children }) {
  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-10 border-b border-ink-200 bg-surface/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link to="/" aria-label="Janyaa BCP Hub">
            <Logo />
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-sm font-medium text-ink-500 transition-colors hover:text-ink-800"
          >
            <ArrowLeft size={16} /> Dashboard
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="font-display text-h1 font-bold tracking-tight text-ink-900">{title}</h1>
        {updated && <p className="mt-1 text-sm text-ink-500">Last updated: {updated}</p>}
        <div className="mt-8 space-y-7">{children}</div>
        <footer className="mt-12 flex items-center gap-2 border-t border-ink-200 pt-6 text-sm text-ink-500">
          <Link to="/privacy" className="transition-colors hover:text-ink-800">Privacy Policy</Link>
          <span>·</span>
          <Link to="/terms" className="transition-colors hover:text-ink-800">Terms of Service</Link>
        </footer>
      </main>
    </div>
  )
}

// One titled section of body copy.
export function Section({ title, children }) {
  return (
    <section>
      <h2 className="font-display text-lg font-semibold text-ink-900">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-ink-600">{children}</div>
    </section>
  )
}
