import { useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { linkMeta } from '../lib/links'

// A pill that shows a tagged link with the site's favicon + friendly name
// (e.g. an agenda doc, a Meet link). Used on meeting cards + the meeting view.
// `size="lg"` is the roomier variant for the full-screen meeting view.
export default function LinkChip({ url, label, size = 'sm' }) {
  const { href, name, favicon } = linkMeta(url)
  const [broken, setBroken] = useState(false)
  const lg = size === 'lg'
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title={href}
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border border-ink-200 bg-surface font-medium text-ink-700 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 ${
        lg ? 'px-3 py-1.5 text-sm' : 'px-2.5 py-1 text-xs'
      }`}
    >
      {favicon && !broken ? (
        <img
          src={favicon}
          alt=""
          width={lg ? 16 : 14}
          height={lg ? 16 : 14}
          className="shrink-0 rounded-sm"
          onError={() => setBroken(true)}
        />
      ) : (
        <ExternalLink size={lg ? 15 : 13} className="shrink-0 text-ink-400" />
      )}
      <span className="truncate">{label || name}</span>
    </a>
  )
}
