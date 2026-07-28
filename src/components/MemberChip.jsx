import { Link } from 'react-router-dom'
import { Avatar, roleTones } from './ui'
import { initials } from '../lib/api'

// Consistent, clickable inline reference to a member: initials in their role
// color + name, links to the full profile. Used wherever a name appears inline
// (event attendees, to-do owners, etc.). `highlight` tints the whole chip gold —
// how meeting contributors are marked, in place of a separate "+1" badge.
export default function MemberChip({ id, name, role, highlight = false, title }) {
  return (
    <Link
      to={`/members/${id}`}
      onClick={(e) => e.stopPropagation()}
      title={title ?? name}
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-2 text-xs font-medium transition-colors ${
        highlight ? 'bg-gold-100 text-gold-800 hover:bg-gold-200' : 'text-ink-700 hover:bg-ink-100'
      }`}
    >
      <Avatar size="xs" initials={initials(name)} tone={roleTones[role] ?? 'blue'} />
      <span className="truncate">{name ?? 'Member'}</span>
    </Link>
  )
}
