import { useState, useRef, useEffect } from 'react'
import { Menu, LogOut, ChevronDown, Sun, Moon, Monitor } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { Avatar, roleLabels } from './ui'
import { initials } from '../lib/api'

// Top bar: mobile menu trigger + the signed-in user with a sign-out menu.
export default function Topbar({ onMenu }) {
  const { profile, user, signOut } = useAuth()
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  // Close the menu on any outside click.
  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const name = profile?.name || user?.email?.split('@')[0] || 'Member'
  const role = roleLabels[profile?.role] || 'Member'

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-surface/80 px-4 backdrop-blur sm:px-6">
      <button
        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
        onClick={onMenu}
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      <div className="ml-auto" ref={ref}>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2.5 rounded-xl py-1 pl-1 pr-2.5 hover:bg-slate-50"
        >
          <Avatar initials={initials(name)} tone="sky" />
          <div className="hidden text-left sm:block">
            <p className="text-sm font-semibold leading-tight text-slate-900">{name}</p>
            <p className="text-xs leading-tight text-slate-500">{role}</p>
          </div>
          <ChevronDown size={16} className="text-slate-400" />
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-xl border border-slate-200 bg-surface py-1 shadow-lg">
            <div className="border-b border-slate-100 px-3 py-2">
              <p className="truncate text-sm font-medium text-slate-900">{name}</p>
              <p className="truncate text-xs text-slate-500">{user?.email}</p>
            </div>
            <div className="border-b border-slate-100 px-3 py-2">
              <p className="mb-1.5 text-xs font-medium text-ink-500">Theme</p>
              <div className="flex gap-0.5 rounded-lg bg-ink-100 p-0.5">
                {[['light', Sun, 'Light'], ['dark', Moon, 'Dark'], ['system', Monitor, 'System']].map(([val, Icon, label]) => (
                  <button
                    key={val}
                    onClick={() => setTheme(val)}
                    title={label}
                    aria-label={label}
                    className={`flex flex-1 items-center justify-center rounded-md py-1.5 transition-colors ${
                      theme === val ? 'bg-surface text-ink-900 shadow-xs' : 'text-ink-500 hover:text-ink-800'
                    }`}
                  >
                    <Icon size={14} />
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => signOut()}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              <LogOut size={16} /> Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
