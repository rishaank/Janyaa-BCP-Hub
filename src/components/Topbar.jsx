import { Menu } from 'lucide-react'
import { Logo } from './ui'

// Mobile-only header: just the menu trigger + brand, so the off-canvas sidebar
// can be opened. On desktop there's no top bar — the account card lives at the
// bottom of the (always-visible) sidebar.
export default function Topbar({ onMenu }) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-ink-200 bg-surface/80 px-4 backdrop-blur lg:hidden">
      <button
        onClick={onMenu}
        className="rounded-lg p-2 text-ink-500 hover:bg-ink-100"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>
      <Logo />
    </header>
  )
}
