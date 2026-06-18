import { useEffect, useState } from 'react'
import { X, Plus, Search } from 'lucide-react'
import { Modal } from './ui'
import MemberChip from './MemberChip'
import { getMembersBrief } from '../lib/api'

// Admin-only: add or remove attendees on an event or meeting.
//   current    = [{ member_id, role?, profiles? }] (the live attendee rows)
//   withRoles  = meetings can be attendee | contributor (affects hours)
//   onAdd(id, role) / onRemove(id) / onSetRole(id, role) hit the API + reload.
export default function ManageAttendeesModal({
  open,
  onClose,
  title,
  current,
  withRoles = false,
  onAdd,
  onRemove,
  onSetRole,
}) {
  const [members, setMembers] = useState([])
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState('')

  useEffect(() => {
    if (open) {
      setQ('')
      getMembersBrief().then(setMembers)
    }
  }, [open])

  const currentIds = new Set(current.map((a) => a.member_id))
  const term = q.trim().toLowerCase()
  const available = members.filter(
    (m) => !currentIds.has(m.id) && (!term || m.name?.toLowerCase().includes(term)),
  )

  async function run(id, fn) {
    setBusy(id)
    await fn()
    setBusy('')
  }

  return (
    <Modal open={open} onClose={onClose} title="Manage attendees">
      <div className="space-y-4">
        <p className="text-sm text-ink-600">
          Add or remove anyone for <span className="font-medium text-ink-800">{title}</span>. Changes
          apply immediately.
        </p>

        <div>
          <p className="mb-2 font-mono text-2xs font-semibold uppercase tracking-[0.08em] text-ink-500">
            Attending · {current.length}
          </p>
          {current.length > 0 ? (
            <ul className="space-y-1.5">
              {current.map((a) => (
                <li
                  key={a.member_id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-ink-200 bg-surface px-2.5 py-1.5"
                >
                  <span className="min-w-0">
                    <MemberChip id={a.member_id} name={a.profiles?.name} role={a.profiles?.role} />
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {withRoles && (
                      <button
                        type="button"
                        disabled={busy === a.member_id}
                        onClick={() =>
                          run(a.member_id, () =>
                            onSetRole(a.member_id, a.role === 'contributor' ? 'attendee' : 'contributor'),
                          )
                        }
                        className={`rounded-md px-2 py-1 text-2xs font-semibold transition-colors disabled:opacity-50 ${
                          a.role === 'contributor'
                            ? 'bg-gold-100 text-gold-700 hover:bg-gold-200'
                            : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
                        }`}
                        title={a.role === 'contributor' ? 'Contributor (+1 hr)' : 'Attendee'}
                      >
                        {a.role === 'contributor' ? 'Contributor +1' : 'Attendee'}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busy === a.member_id}
                      onClick={() => run(a.member_id, () => onRemove(a.member_id))}
                      className="rounded-md p-1 text-ink-400 transition-colors hover:bg-coral-50 hover:text-coral-600 disabled:opacity-50"
                      aria-label="Remove"
                    >
                      <X size={15} />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-ink-400">Nobody yet.</p>
          )}
        </div>

        <div>
          <p className="mb-2 font-mono text-2xs font-semibold uppercase tracking-[0.08em] text-ink-500">
            Add a member
          </p>
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search members…"
              className="w-full rounded-lg border border-ink-200 bg-surface py-2 pl-9 pr-3 text-sm text-ink-900 outline-none focus:border-green-400"
            />
          </div>
          <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto">
            {available.length > 0 ? (
              available.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-2 rounded-lg px-1 py-0.5 hover:bg-ink-50"
                >
                  <span className="min-w-0">
                    <MemberChip id={m.id} name={m.name} role={m.role} />
                  </span>
                  <button
                    type="button"
                    disabled={busy === m.id}
                    onClick={() => run(m.id, () => onAdd(m.id, 'attendee'))}
                    className="flex shrink-0 items-center gap-1 rounded-md bg-green-50 px-2 py-1 text-xs font-semibold text-green-700 transition-colors hover:bg-green-100 disabled:opacity-50"
                  >
                    <Plus size={13} /> Add
                  </button>
                </li>
              ))
            ) : (
              <li className="px-1 py-2 text-xs text-ink-400">
                {members.length === 0 ? 'Loading members…' : 'Everyone is already added.'}
              </li>
            )}
          </ul>
        </div>
      </div>
    </Modal>
  )
}
