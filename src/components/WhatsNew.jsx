import { useState, useRef, useEffect } from 'react'
import { Bell, X } from 'lucide-react'
import { useGithubCommits } from '../lib/useGithubCommits'

const SEEN_KEY = 'janyaa-seen-update'

// Member-facing "what's new" bell at the foot of the sidebar: recent GitHub
// commit messages as plain-English website updates, with an unread dot.
export default function WhatsNew() {
  const { commits } = useGithubCommits(15)
  const [open, setOpen] = useState(false)
  const [seen, setSeen] = useState(() => localStorage.getItem(SEEN_KEY) || '')
  const ref = useRef(null)

  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const latest = commits[0]?.sha
  const hasUnread = latest && latest !== seen

  function toggle() {
    setOpen((v) => {
      const next = !v
      if (next && latest) {
        localStorage.setItem(SEEN_KEY, latest)
        setSeen(latest)
      }
      return next
    })
  }

  return (
    <div className="relative px-3 pt-1" ref={ref}>
      {open && (
        <div className="absolute inset-x-3 bottom-full mb-2 overflow-hidden rounded-xl border border-ink-200 bg-surface shadow-lg">
          <div className="flex items-center justify-between border-b border-ink-100 px-3 py-2">
            <p className="text-sm font-semibold text-ink-900">What&rsquo;s new</p>
            <button onClick={() => setOpen(false)} className="rounded p-1 text-ink-400 hover:bg-ink-100" aria-label="Close">
              <X size={14} />
            </button>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {commits.length === 0 ? (
              <p className="px-3 py-4 text-xs text-ink-400">No updates to show.</p>
            ) : (
              commits.map((c) => (
                <a
                  key={c.sha}
                  href={c.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block border-b border-ink-50 px-3 py-2 last:border-0 hover:bg-ink-50"
                >
                  <p className="text-sm text-ink-800">{c.message}</p>
                  <p className="mt-0.5 font-mono text-2xs text-ink-400">
                    {c.date && new Date(c.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </a>
              ))
            )}
          </div>
        </div>
      )}

      <button
        onClick={toggle}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-ink-600 transition-colors hover:bg-ink-50 hover:text-ink-900"
      >
        <span className="relative">
          <Bell size={18} />
          {hasUnread && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-coral-500 ring-2 ring-surface" />}
        </span>
        What&rsquo;s new
      </button>
    </div>
  )
}
