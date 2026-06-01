import { useEffect, useState } from 'react'
import { Users, Clock, Award, Pencil, Shield } from 'lucide-react'
import {
  PageHeader,
  Card,
  StatCard,
  Badge,
  Avatar,
  Button,
  Modal,
  FormField,
  inputClass,
  Skeleton,
  roleLabels,
  roleOptions,
  roleTones,
  formatDate,
} from '../components/ui'
import { getMembersWithHours, adminUpdateProfile } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useRealtime } from '../lib/useRealtime'

export default function Members() {
  const { profile } = useAuth()
  const isAdmin = !!profile?.is_admin
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)

  const load = () =>
    getMembersWithHours().then((data) => {
      setMembers(data)
      setLoading(false)
    })

  useEffect(() => {
    load()
  }, [])
  useRealtime(['profiles', 'event_signups'], load)

  const totalHours = members.reduce((s, m) => s + m.hours, 0)
  const topMember = members.reduce((top, m) => (m.hours > (top?.hours ?? -1) ? m : top), null)

  return (
    <>
      <PageHeader
        title="Members"
        subtitle="Everyone signed in to the Hub, with hours earned from events."
        action={isAdmin ? <Badge tone="blue"><Shield size={12} /> Admin</Badge> : null}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {loading ? (
          [0, 1, 2].map((i) => (
            <Card key={i} className="p-5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-3 h-8 w-16" />
            </Card>
          ))
        ) : (
          <>
            <StatCard icon={Users} label="Members" value={members.length} />
            <StatCard icon={Clock} label="Total hours" value={totalHours} tone="blue" />
            <StatCard icon={Award} label="Most hours" value={topMember ? `${topMember.hours}h` : '—'} tone="green" hint={topMember?.name} />
          </>
        )}
      </div>

      <Card className="mt-6 overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="ml-auto h-4 w-16" />
              </div>
            ))}
          </div>
        ) : members.length === 0 ? (
          <p className="p-6 text-sm text-ink-500">No members yet. The first person to sign up shows up here.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-200 font-mono text-2xs uppercase tracking-[0.08em] text-ink-500">
                  <th className="px-5 py-3 font-semibold">Member</th>
                  <th className="px-5 py-3 font-semibold">Role</th>
                  <th className="px-5 py-3 font-semibold">Joined</th>
                  <th className="px-5 py-3 font-semibold">Hours</th>
                  {isAdmin && <th className="px-5 py-3 font-semibold" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {members.map((m) => (
                  <tr key={m.id} className="hover:bg-ink-50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar initials={m.avatar} tone={roleTones[m.role]} />
                        <div>
                          <p className="font-medium text-ink-900">{m.name || '—'}</p>
                          <p className="text-xs text-ink-500">{m.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge tone={roleTones[m.role] ?? 'ink'}>{roleLabels[m.role] ?? 'Member'}</Badge>
                        {m.is_admin && (
                          <Badge tone="blue"><Shield size={11} /> Admin</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-ink-600">{m.joined_date ? formatDate(m.joined_date) : '—'}</td>
                    <td className="px-5 py-3 font-mono font-semibold tabular-nums text-ink-900">{m.hours} hrs</td>
                    {isAdmin && (
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => setEditing(m)}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
                        >
                          <Pencil size={13} /> Edit
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {isAdmin && (
        <EditMemberModal member={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />
      )}
    </>
  )
}

function EditMemberModal({ member, onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', role: 'member', hours_adjustment: 0, is_admin: false })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (member) {
      setForm({
        name: member.name ?? '',
        role: member.role ?? 'member',
        hours_adjustment: member.hours_adjustment ?? 0,
        is_admin: member.is_admin ?? false,
      })
    }
  }, [member])

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    await adminUpdateProfile(member.id, {
      name: form.name,
      role: form.role,
      hours_adjustment: Number(form.hours_adjustment),
      is_admin: form.is_admin,
    })
    setBusy(false)
    onSaved()
  }

  return (
    <Modal open={!!member} onClose={onClose} title="Edit member">
      <form onSubmit={save} className="space-y-3">
        <FormField label="Name">
          <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </FormField>
        <FormField label="Role">
          <select className={inputClass} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="member">Member (unassigned)</option>
            {roleOptions.map((r) => (
              <option key={r} value={r}>{roleLabels[r]}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Hours adjustment">
          <input
            type="number"
            step="0.5"
            className={inputClass}
            value={form.hours_adjustment}
            onChange={(e) => setForm({ ...form, hours_adjustment: e.target.value })}
          />
          <span className="mt-1 block text-xs text-ink-500">Added on top of hours earned from event sign-ups (can be negative).</span>
        </FormField>
        <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-ink-200 px-3 py-2.5">
          <input
            type="checkbox"
            checked={form.is_admin}
            onChange={(e) => setForm({ ...form, is_admin: e.target.checked })}
            className="h-4 w-4 rounded border-ink-300 accent-green-600"
          />
          <span className="text-sm font-medium text-ink-800">Admin — can manage all members, events &amp; settings</span>
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="soft" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</Button>
        </div>
      </form>
    </Modal>
  )
}
