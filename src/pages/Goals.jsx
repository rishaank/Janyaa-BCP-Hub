import { useEffect, useRef, useState } from 'react'
import { Target, Plus, Pencil, Trash2, Check, RotateCcw, CalendarClock } from 'lucide-react'
import { PageHeader, Card, Button, Badge, ProgressBar, Modal, FormField, inputClass, EmptyState } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { getGoals, createGoal, updateGoal, deleteGoal, getMembersWithHours } from '../lib/api'
import MemberChip from '../components/MemberChip'
import { useRealtime } from '../lib/useRealtime'

const fmtDate = (iso) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export default function Goals() {
  const { user } = useAuth()
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editGoal, setEditGoal] = useState(null)

  const load = () =>
    getGoals().then((d) => {
      setGoals(d)
      setLoading(false)
    })

  useEffect(() => {
    load()
  }, [])
  useRealtime(['goals'], load)

  const active = goals.filter((g) => g.status !== 'done')
  const done = goals.filter((g) => g.status === 'done')

  function openCreate() {
    setEditGoal(null)
    setFormOpen(true)
  }
  function openEdit(g) {
    setEditGoal(g)
    setFormOpen(true)
  }

  return (
    <>
      <PageHeader
        title="Leadership goals"
        subtitle="Set the club's priorities for the term and track progress toward them."
        action={<Button icon={Plus} onClick={openCreate}>Add goal</Button>}
      />

      {loading ? (
        <LoadingRows />
      ) : goals.length === 0 ? (
        <EmptyState icon={Target} title="No goals yet">
          Add the club's leadership goals — fundraising targets, outreach pushes, recruiting — and track
          progress here. They show up on the dashboard too.
        </EmptyState>
      ) : (
        <>
          <Section title="In progress" count={active.length}>
            {active.map((g) => (
              <GoalCard key={g.id} goal={g} onChange={load} onEdit={openEdit} />
            ))}
          </Section>
          {done.length > 0 && (
            <Section title="Completed" count={done.length}>
              {done.map((g) => (
                <GoalCard key={g.id} goal={g} onChange={load} onEdit={openEdit} />
              ))}
            </Section>
          )}
        </>
      )}

      <GoalFormModal
        open={formOpen}
        goal={editGoal}
        myId={user?.id}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false)
          load()
        }}
      />
    </>
  )
}

function Section({ title, count, children }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 font-mono text-2xs font-semibold uppercase tracking-[0.08em] text-ink-500">
        {title} · {count}
      </h2>
      {count === 0 ? (
        <p className="text-sm text-ink-400">Nothing here yet.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">{children}</div>
      )}
    </section>
  )
}

function LoadingRows() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {[0, 1].map((i) => (
        <Card key={i} className="h-44 animate-pulse bg-ink-50" />
      ))}
    </div>
  )
}

function GoalCard({ goal, onChange, onEdit }) {
  const done = goal.status === 'done'
  const [busy, setBusy] = useState(false)
  const [prog, setProg] = useState(goal.progress)
  const progRef = useRef(goal.progress)

  useEffect(() => {
    setProg(goal.progress)
    progRef.current = goal.progress
  }, [goal.progress])

  function onSlide(e) {
    const v = Number(e.target.value)
    setProg(v)
    progRef.current = v
  }

  // Commit once the user releases the slider, not on every tick.
  async function commitProgress() {
    const p = progRef.current
    if (p === goal.progress) return
    setBusy(true)
    await updateGoal(goal.id, { progress: p, status: p >= 100 ? 'done' : 'active' })
    await onChange()
    setBusy(false)
  }

  async function toggleDone() {
    setBusy(true)
    await updateGoal(goal.id, done ? { status: 'active' } : { status: 'done', progress: 100 })
    await onChange()
    setBusy(false)
  }

  async function remove() {
    if (!window.confirm(`Delete the goal "${goal.title}"? This can't be undone.`)) return
    await deleteGoal(goal.id)
    await onChange()
  }

  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="break-words font-display text-h4 font-semibold text-ink-900">{goal.title}</h3>
            {done && <Badge tone="green">Done</Badge>}
          </div>
          {goal.detail && <p className="mt-1 text-sm text-ink-600">{goal.detail}</p>}
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            onClick={() => onEdit(goal)}
            className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-blue-600"
            aria-label="Edit goal"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={remove}
            className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-coral-50 hover:text-coral-600"
            aria-label="Delete goal"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="font-mono text-2xs font-semibold uppercase tracking-[0.08em] text-ink-500">Progress</span>
          <span className="font-mono text-sm font-semibold tabular-nums text-ink-700">{prog}%</span>
        </div>
        <ProgressBar value={prog} max={100} tone={done ? 'green' : 'gold'} />
        {!done && (
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={prog}
            onChange={onSlide}
            onMouseUp={commitProgress}
            onTouchEnd={commitProgress}
            onKeyUp={commitProgress}
            disabled={busy}
            className="ja-range mt-2"
            aria-label="Update progress"
          />
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3 text-xs text-ink-500">
          {goal.owner ? (
            <span className="flex items-center gap-1">
              Owner <MemberChip id={goal.owner.id} name={goal.owner.name} role={goal.owner.role} />
            </span>
          ) : (
            <span className="text-ink-400">Unassigned</span>
          )}
          {goal.target_date && (
            <span className="flex items-center gap-1">
              <CalendarClock size={13} className="text-ink-400" /> {fmtDate(goal.target_date)}
            </span>
          )}
        </div>
        <button
          onClick={toggleDone}
          disabled={busy}
          className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-50 ${
            done ? 'bg-ink-100 text-ink-600 hover:bg-ink-200' : 'bg-green-50 text-green-700 hover:bg-green-100'
          }`}
        >
          {done ? (
            <>
              <RotateCcw size={13} /> Reopen
            </>
          ) : (
            <>
              <Check size={13} /> Mark done
            </>
          )}
        </button>
      </div>
    </Card>
  )
}

const blankGoal = { title: '', detail: '', owner_id: '', target_date: '', progress: 0, status: 'active' }

function GoalFormModal({ open, goal, myId, onClose, onSaved }) {
  const [form, setForm] = useState(blankGoal)
  const [members, setMembers] = useState([])
  const [busy, setBusy] = useState(false)
  const editing = Boolean(goal)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  useEffect(() => {
    if (open) getMembersWithHours().then(setMembers)
  }, [open])

  useEffect(() => {
    if (goal) {
      setForm({
        title: goal.title ?? '',
        detail: goal.detail ?? '',
        owner_id: goal.owner_id ?? '',
        target_date: goal.target_date ?? '',
        progress: goal.progress ?? 0,
        status: goal.status ?? 'active',
      })
    } else {
      setForm(blankGoal)
    }
  }, [goal, open])

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    const fields = {
      title: form.title,
      detail: form.detail || null,
      owner_id: form.owner_id || null,
      target_date: form.target_date || null,
      progress: Number(form.progress),
      status: form.status,
    }
    if (editing) await updateGoal(goal.id, fields)
    else await createGoal({ ...fields, created_by: myId })
    setBusy(false)
    onSaved()
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit goal' : 'Add goal'}>
      <form onSubmit={submit} className="space-y-3">
        <FormField label="Goal">
          <input className={inputClass} value={form.title} onChange={set('title')} required placeholder="Raise $2,000 this term" />
        </FormField>
        <FormField label="Details">
          <textarea className={inputClass} rows={2} value={form.detail} onChange={set('detail')} placeholder="What does success look like?" />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Owner">
            <select className={inputClass} value={form.owner_id} onChange={set('owner_id')}>
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Target date">
            <input type="date" className={inputClass} value={form.target_date} onChange={set('target_date')} />
          </FormField>
        </div>
        <FormField label={`Progress · ${form.progress}%`}>
          <input type="range" min="0" max="100" step="5" value={form.progress} onChange={set('progress')} className="ja-range" />
        </FormField>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="soft" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Add goal'}</Button>
        </div>
      </form>
    </Modal>
  )
}
