// "To-dos · who brings what" — shared by the desktop EventCard (src/pages/Events.jsx)
// and the full-screen event view (src/pages/EventView.jsx), which is the only place
// mobile can reach them: the mobile list shows compact glance cards that open /events/:id.
import { useCallback, useEffect, useState } from 'react'
import { Hand, X } from 'lucide-react'
import MemberChip from './MemberChip'
import { addTodo, deleteTodo, getEventTodos, setTodoAssignee } from '../lib/api'
import { useRealtime } from '../lib/useRealtime'

export default function EventTodos({ eventId, todos, myId, onChange }) {
  const [newTodo, setNewTodo] = useState('')

  async function submit(e) {
    e.preventDefault()
    if (!newTodo.trim()) return
    await addTodo(eventId, newTodo.trim())
    setNewTodo('')
    await onChange()
  }

  return (
    <>
      <p className="mb-2 font-mono text-2xs font-semibold uppercase tracking-[0.08em] text-ink-500">
        To-dos · who brings what
      </p>
      <ul className="space-y-2">
        {todos.map((t) => (
          <TodoRow key={t.id} todo={t} myId={myId} onChange={onChange} />
        ))}
        {todos.length === 0 && <li className="text-xs text-ink-400">No items yet.</li>}
      </ul>
      <form onSubmit={submit} className="mt-3 flex gap-2">
        <input
          value={newTodo}
          onChange={(e) => setNewTodo(e.target.value)}
          placeholder="Add an item (e.g. Tables)"
          className="min-w-0 flex-1 rounded-lg border border-ink-200 bg-surface px-3 py-2 text-sm outline-none focus:border-green-400"
        />
        <button
          type="submit"
          className="shrink-0 rounded-lg bg-ink-100 px-3.5 py-2 text-sm font-medium text-ink-600 transition-colors hover:bg-ink-200"
        >
          Add
        </button>
      </form>
    </>
  )
}

// Self-loading variant for the full-screen view: the public get_public_event RPC
// omits to-dos, so signed-in members fetch them separately (and stay live-synced).
export function EventTodosPanel({ eventId, myId }) {
  const [todos, setTodos] = useState([])
  const load = useCallback(() => getEventTodos(eventId).then(setTodos), [eventId])

  useEffect(() => {
    load()
  }, [load])
  useRealtime('event_todos', load)

  return (
    <div className="mt-6 rounded-xl border border-ink-200 bg-surface p-5">
      <EventTodos eventId={eventId} todos={todos} myId={myId} onChange={load} />
    </div>
  )
}

// The item wraps onto its own line on narrow screens so the claim/delete
// controls never squeeze the text on a phone.
function TodoRow({ todo, myId, onChange }) {
  const owner = todo.profiles
  const mine = todo.assignee_id === myId

  async function claim() {
    await setTodoAssignee(todo.id, mine ? null : myId)
    await onChange()
  }
  async function remove() {
    await deleteTodo(todo.id)
    await onChange()
  }

  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
      <span className="flex min-w-0 flex-1 basis-full items-center gap-2 text-sm sm:basis-auto">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ink-300" />
        <span className="min-w-0 break-words text-ink-700">{todo.item}</span>
      </span>

      <span className="ml-3.5 flex shrink-0 items-center gap-2 sm:ml-0">
        {owner ? (
          <MemberChip id={owner.id} name={owner.name} role={owner.role} />
        ) : (
          <span className="text-xs text-gold-700">unclaimed</span>
        )}
        <button
          onClick={claim}
          className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
            mine ? 'bg-ink-100 text-ink-600 hover:bg-ink-200' : 'bg-green-50 text-green-700 hover:bg-green-100'
          }`}
        >
          {mine ? 'Drop' : owner ? 'Take' : <span className="flex items-center gap-1"><Hand size={11} /> Claim</span>}
        </button>
        <button
          onClick={remove}
          className="rounded p-1.5 text-ink-300 transition-colors hover:bg-coral-50 hover:text-coral-600"
          aria-label={`Delete to-do: ${todo.item}`}
        >
          <X size={14} />
        </button>
      </span>
    </li>
  )
}
