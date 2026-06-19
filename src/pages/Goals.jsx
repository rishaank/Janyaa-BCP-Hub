import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Target, Plus, Pencil, Trash2, Check, X, GripVertical, ChevronDown, ChevronRight } from 'lucide-react'
import { PageHeader, Card, Button, Modal, FormField, inputClass, Avatar, roleTones, roleLabels, AccessChip } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import {
  getGoals, createGoal, updateGoal, deleteGoal, getMembersWithHours,
  getSettings, setTermTargets, getCurrentTermStart, currentTermStart,
} from '../lib/api'
import { useRealtime } from '../lib/useRealtime'
import Linkify from '../components/Linkify'

const MONTH_ABBR = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

// The current term's month columns (3 seasonal months from the term start).
function termMonths(termStartIso) {
  const [y, m] = termStartIso.split('-').map(Number)
  return [0, 1, 2].map((i) => {
    const d = new Date(y, m - 1 + i, 1)
    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      abbr: MONTH_ABBR[d.getMonth()],
      long: MONTH_LONG[d.getMonth()],
    }
  })
}

const tierOf = (role) => (role && role !== 'member' ? 'Leadership' : 'Members')
const tierLabel = { Leadership: 'Leadership', Members: 'Non-Leadership' }
const toneOf = (role) => roleTones[role] ?? 'ink'
const ROLE_ORDER = ['operations_lead', 'event_lead', 'pr_lead', 'outreach_lead', 'secretary', 'education_lead', 'member']

// Grid columns — member is fixed; the term + month columns flex to fill the tab.
const COL = {
  member: 'w-[200px] shrink-0',
  term: 'min-w-[210px] flex-[1.4]',
  mon: 'min-w-[150px] flex-1',
}

// Select with extra right padding so text clears the native dropdown arrow.
const selectClass =
  'w-full rounded-md border border-ink-300 bg-surface py-2.5 pl-3 pr-9 text-sm text-ink-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100'

export default function Goals() {
  const { user, profile } = useAuth()
  const isAdmin = !!profile?.is_admin
  const myId = user?.id
  // Admins edit everyone; members edit only their own row (set goals for themselves).
  const canEditMember = (id) => isAdmin || id === myId
  const [goals, setGoals] = useState([])
  const [members, setMembers] = useState([])
  const [targets, setTargets] = useState([])
  const [termStart, setTermStartState] = useState(currentTermStart())
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState(null) // { goal? , owner_id?, period? } | null
  const [targetsOpen, setTargetsOpen] = useState(false)
  const [collapsedRows, setCollapsedRows] = useState(() => new Set()) // member ids
  const [collapsedTiers, setCollapsedTiers] = useState(() => new Set()) // tier keys

  const toggleRow = (id) =>
    setCollapsedRows((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleTier = (t) =>
    setCollapsedTiers((s) => { const n = new Set(s); n.has(t) ? n.delete(t) : n.add(t); return n })

  const loadGoals = () => getGoals().then(setGoals)
  const loadTargets = () => getSettings().then((s) => setTargets(Array.isArray(s?.term_targets) ? s.term_targets : []))

  useEffect(() => {
    getCurrentTermStart().then(setTermStartState)
    Promise.all([loadGoals(), getMembersWithHours().then(setMembers), loadTargets()]).then(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useRealtime(['goals'], loadGoals)
  useRealtime(['club_settings'], loadTargets)

  const months = useMemo(() => termMonths(termStart), [termStart])

  // goals indexed by `${owner_id}|${period}`
  const byCell = useMemo(() => {
    const map = {}
    for (const g of goals) {
      if (!g.owner_id) continue
      const k = `${g.owner_id}|${g.period || 'TERM'}`
      ;(map[k] ||= []).push(g)
    }
    for (const k in map) map[k].sort((a, b) => (a.sort - b.sort) || (a.created_at < b.created_at ? -1 : 1))
    return map
  }, [goals])

  const ordered = useMemo(() => {
    const sorted = [...members].sort((a, b) => {
      const ti = (tierOf(a.role) === 'Leadership' ? 0 : 1) - (tierOf(b.role) === 'Leadership' ? 0 : 1)
      if (ti) return ti
      const ri = ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role)
      if (ri) return ri
      return (a.name || '').localeCompare(b.name || '')
    })
    return { Leadership: sorted.filter((m) => tierOf(m.role) === 'Leadership'), Members: sorted.filter((m) => tierOf(m.role) === 'Members') }
  }, [members])

  // Drag a card to another cell → reassign its owner + period.
  async function moveGoal(goalId, ownerId, period) {
    const g = goals.find((x) => x.id === goalId)
    if (!g || (g.owner_id === ownerId && (g.period || 'TERM') === period)) return
    await updateGoal(goalId, { owner_id: ownerId, period })
    await loadGoals()
  }

  async function saveTargets(next) {
    await setTermTargets(next)
    setTargets(next)
  }

  if (loading) return <><PageHeader title="Leadership goals" /><LoadingGrid /></>

  return (
    <>
      <PageHeader
        title="Leadership goals"
        subtitle={isAdmin
          ? 'Set the club’s priorities for the term and track progress — one row per person, one column per month.'
          : 'The club’s priorities for the term — set your own goals on your row.'}
        badge={isAdmin ? <AccessChip mode="edit" /> : null}
        action={<Button icon={Plus} onClick={() => setEdit(isAdmin ? {} : { owner_id: myId })}>Add Goal</Button>}
      />

      {/* Semester targets strip */}
      <TargetsStrip targets={targets} editable={isAdmin} onEdit={() => setTargetsOpen(true)} />

      {/* Desktop grid — fills the tab width; the term + month columns flex to share the space. */}
      <div className="ja-fade mt-6 hidden overflow-x-auto rounded-2xl border border-ink-200 bg-surface shadow-sm lg:block">
        <div className="min-w-[860px]">
            {/* Header */}
            <div className="flex border-b border-ink-200 bg-ink-50">
              <HCell col={COL.member} className="justify-start pl-4">Member</HCell>
              <HCell col={COL.term}>
                <span className="font-mono text-[11px] font-bold uppercase tracking-[0.09em] text-gold-700">Term goal</span>
              </HCell>
              {months.map((mo) => (
                <HCell key={mo.key} col={COL.mon}>
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.09em] text-ink-500">{mo.abbr}</span>
                </HCell>
              ))}
            </div>

            {['Leadership', 'Members'].map((tier) => {
              const rows = ordered[tier]
              if (rows.length === 0) return null
              const tierCollapsed = collapsedTiers.has(tier)
              return (
                <div key={tier}>
                  <GroupBand tier={tier} rows={rows} byCell={byCell} collapsed={tierCollapsed} onToggle={() => toggleTier(tier)} />
                  {!tierCollapsed && rows.map((m, i) => (
                    <PersonRow
                      key={m.id}
                      m={m}
                      months={months}
                      byCell={byCell}
                      zebra={i % 2 === 1}
                      canEdit={canEditMember(m.id)}
                      collapsed={collapsedRows.has(m.id)}
                      onToggleRow={() => toggleRow(m.id)}
                      onAdd={(period) => setEdit({ owner_id: m.id, period })}
                      onOpen={(goal) => setEdit({ goal })}
                      onMove={moveGoal}
                    />
                  ))}
                </div>
              )
            })}
        </div>
      </div>

      {/* Mobile cards */}
      <div className="mt-6 lg:hidden">
        {['Leadership', 'Members'].map((tier) =>
          ordered[tier].length > 0 ? (
            <div key={tier} className="mb-6">
              <div className="mb-3 flex items-center gap-2">
                <span className="font-mono text-2xs font-semibold uppercase tracking-[0.08em] text-ink-700">{tierLabel[tier] ?? tier}</span>
                <span className="font-mono text-2xs text-ink-400">· {ordered[tier].length}</span>
              </div>
              <div className="ja-stagger space-y-3">
                {ordered[tier].map((m) => (
                  <MobilePersonCard
                    key={m.id}
                    m={m}
                    months={months}
                    byCell={byCell}
                    canEdit={canEditMember(m.id)}
                    onAdd={(period) => setEdit({ owner_id: m.id, period })}
                    onOpen={(goal) => setEdit({ goal })}
                  />
                ))}
              </div>
            </div>
          ) : null,
        )}
      </div>

      {edit && (
        <GoalEditModal
          state={edit}
          members={members}
          months={months}
          myId={myId}
          isAdmin={isAdmin}
          onClose={() => setEdit(null)}
          onSaved={() => { setEdit(null); loadGoals() }}
        />
      )}
      <TargetsEditorModal open={targetsOpen} targets={targets} onClose={() => setTargetsOpen(false)} onSave={saveTargets} />
    </>
  )
}

// ---- desktop grid pieces -------------------------------------------------

function HCell({ col = '', className = '', children, title }) {
  return (
    <div className={`flex h-[46px] items-center justify-center border-r border-ink-200 px-2.5 last:border-r-0 ${col} ${className}`} title={title}>
      {typeof children === 'string'
        ? <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.09em] text-ink-500">{children}</span>
        : children}
    </div>
  )
}

function GroupBand({ tier, rows, byCell, collapsed, onToggle }) {
  // Collect every goal's progress for this tier (for the "N goals set · X% avg" stat).
  const all = []
  rows.forEach((m) => {
    Object.keys(byCell).forEach((k) => {
      if (k.startsWith(`${m.id}|`)) byCell[k].forEach((g) => all.push(g.progress || 0))
    })
  })
  const avg = all.length ? Math.round(all.reduce((a, b) => a + b, 0) / all.length) : 0
  const Chev = collapsed ? ChevronRight : ChevronDown
  return (
    <div className="flex items-center gap-1.5 border-b border-ink-200 bg-ink-100 py-2 pl-2 pr-4">
      <button
        onClick={onToggle}
        className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-ink-500 transition-colors hover:bg-ink-200 hover:text-ink-800"
        aria-label={collapsed ? `Expand ${tierLabel[tier] ?? tier}` : `Collapse ${tierLabel[tier] ?? tier}`}
      >
        <Chev size={15} />
      </button>
      <span className="font-mono text-2xs font-semibold uppercase tracking-[0.08em] text-ink-700">{tierLabel[tier] ?? tier}</span>
      <span className="font-mono text-2xs text-ink-400">· {rows.length}</span>
      <span className="flex-1" />
      <span className="font-mono text-2xs text-ink-500">{all.length} goals set · {avg}% avg</span>
    </div>
  )
}

function PersonRow({ m, months, byCell, zebra, canEdit, collapsed, onToggleRow, onAdd, onOpen, onMove }) {
  const Chev = collapsed ? ChevronRight : ChevronDown
  const showRole = m.role && m.role !== 'member'
  return (
    <div className={`flex border-b border-ink-200 last:border-b-0 ${zebra ? 'bg-ink-50/60' : ''}`}>
      <div className={`${COL.member} flex items-center gap-2 border-r border-ink-200 py-3 pl-2 pr-3`}>
        <button
          onClick={onToggleRow}
          className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-ink-400 transition-colors hover:bg-ink-200 hover:text-ink-700"
          aria-label={collapsed ? `Expand ${m.name}` : `Collapse ${m.name}`}
        >
          <Chev size={15} />
        </button>
        <Avatar size="sm" initials={initialsOf(m.name)} tone={toneOf(m.role)} src={m.avatar_url} />
        <div className="min-w-0">
          <Link to={`/members/${m.id}`} className="block truncate text-sm font-semibold text-ink-900 transition-colors hover:text-green-700">{m.name}</Link>
          {showRole && <p className="truncate font-mono text-[10px] uppercase tracking-[0.06em] text-ink-500">{roleLabels[m.role] ?? m.role}</p>}
        </div>
      </div>
      <GridCell col={COL.term} isTerm goals={byCell[`${m.id}|TERM`]} period="TERM" memberId={m.id} canEdit={canEdit} collapsed={collapsed} onAdd={onAdd} onOpen={onOpen} onMove={onMove} />
      {months.map((mo) => (
        <GridCell key={mo.key} col={COL.mon} goals={byCell[`${m.id}|${mo.key}`]} period={mo.key} memberId={m.id} canEdit={canEdit} collapsed={collapsed} onAdd={onAdd} onOpen={onOpen} onMove={onMove} />
      ))}
    </div>
  )
}

function GridCell({ col, goals = [], isTerm, period, memberId, canEdit, collapsed, onAdd, onOpen, onMove }) {
  const [over, setOver] = useState(false)
  // Collapsed rows just show the goal count per column at member-row height.
  if (collapsed) {
    return (
      <div className={`${col} flex items-center justify-center border-r border-ink-200 px-2 py-2 last:border-r-0`}>
        {goals.length ? (
          <span className="font-mono text-xs font-semibold tabular-nums text-ink-600">{goals.length} {goals.length === 1 ? 'goal' : 'goals'}</span>
        ) : (
          <span className="text-ink-300">—</span>
        )}
      </div>
    )
  }
  const dropProps = canEdit
    ? {
        onDragOver: (e) => { e.preventDefault(); setOver(true) },
        onDragLeave: () => setOver(false),
        onDrop: (e) => {
          e.preventDefault()
          setOver(false)
          const id = e.dataTransfer.getData('text/goal')
          if (id) onMove(id, memberId, period)
        },
      }
    : {}
  return (
    <div
      className={`${col} border-r border-ink-200 p-1.5 last:border-r-0 ${over ? 'bg-green-500/10 ring-2 ring-inset ring-green-400' : ''}`}
      {...dropProps}
    >
      {goals.length === 0 ? (
        canEdit ? (
          <button
            onClick={() => onAdd(period)}
            className="group/add grid h-full min-h-[92px] w-full place-items-center rounded-xl border border-dashed border-ink-200 text-ink-300 opacity-40 transition hover:border-green-500 hover:text-green-600 hover:opacity-100"
            aria-label="Add goal"
          >
            <Plus size={20} />
          </button>
        ) : (
          <div className="grid h-full min-h-[92px] place-items-center text-ink-300">—</div>
        )
      ) : (
        <div className="flex h-full flex-col gap-1.5">
          {goals.map((g) => (
            <GoalChipCard key={g.id} goal={g} isTerm={isTerm} canEdit={canEdit} onOpen={onOpen} />
          ))}
        </div>
      )}
    </div>
  )
}

function GoalChipCard({ goal, isTerm, canEdit, onOpen }) {
  const done = (goal.progress || 0) >= 100
  const [expanded, setExpanded] = useState(false)
  const [clipped, setClipped] = useState(false)
  const textRef = useRef(null)

  // The text fills whatever height the cell has (a taller row — e.g. a sibling
  // column with two goals — reveals more lines). Show the expand affordance + a
  // bottom fade only when text is actually clipped; re-check when the row resizes.
  useEffect(() => {
    const el = textRef.current
    if (!el || expanded) return
    const check = () => setClipped(el.scrollHeight - el.clientHeight > 2)
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [goal.title, expanded])

  return (
    <div
      draggable={canEdit && !expanded}
      onDragStart={(e) => e.dataTransfer.setData('text/goal', goal.id)}
      onClick={() => canEdit && onOpen(goal)}
      className={`flex flex-1 flex-col gap-2 rounded-xl border p-3 shadow-xs transition ${
        isTerm ? 'border-gold-200 bg-gold-50/70' : 'border-ink-200 bg-surface'
      } ${canEdit ? 'cursor-grab hover:shadow-card active:cursor-grabbing' : ''}`}
    >
      <p
        ref={textRef}
        className={`whitespace-pre-wrap break-words text-[13px] leading-snug text-ink-700 ${
          expanded ? '' : `min-h-[4.5rem] flex-1 overflow-hidden ${clipped ? 'goal-fade-mask' : ''}`
        }`}
      >
        <Linkify>{goal.title}</Linkify>
      </p>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1"><ProgressLine value={goal.progress || 0} done={done} /></div>
        {(clipped || expanded) && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v) }}
            aria-label={expanded ? 'Collapse goal' : 'Expand goal'}
            aria-expanded={expanded}
            className="-mr-1 grid h-6 w-6 shrink-0 place-items-center rounded-md text-ink-400 transition-colors hover:bg-ink-150 hover:text-ink-700"
          >
            <ChevronDown size={14} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>
    </div>
  )
}

function ProgressLine({ value, done }) {
  const pct = Math.max(0, Math.min(100, value || 0))
  return (
    <div className="flex items-center gap-2">
      <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-ink-150">
        <div className={`h-full rounded-full ${done ? 'bg-green-600' : 'bg-gold-500'}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="min-w-[30px] text-right font-mono text-[11.5px] font-bold tabular-nums text-ink-600">{pct}%</span>
    </div>
  )
}

// ---- mobile -------------------------------------------------------------

function MobilePersonCard({ m, months, byCell, canEdit, onAdd, onOpen }) {
  const cells = [{ key: 'TERM', label: 'Term', isTerm: true }, ...months.map((mo) => ({ key: mo.key, label: mo.long, isTerm: false }))]
  const filled = cells.filter((c) => (byCell[`${m.id}|${c.key}`] ?? []).length > 0)
  const showRole = m.role && m.role !== 'member'
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <Avatar size="sm" initials={initialsOf(m.name)} tone={toneOf(m.role)} src={m.avatar_url} />
        <div className="min-w-0 flex-1">
          <Link to={`/members/${m.id}`} className="block truncate font-semibold text-ink-900 transition-colors hover:text-green-700">{m.name}</Link>
          {showRole && <p className="truncate font-mono text-[10px] uppercase tracking-[0.06em] text-ink-500">{roleLabels[m.role] ?? m.role}</p>}
        </div>
      </div>

      {filled.length > 0 ? (
        <div className="mt-2">
          {filled.map((c) =>
            (byCell[`${m.id}|${c.key}`] ?? []).map((g) => (
              <button
                key={g.id}
                onClick={() => canEdit && onOpen(g)}
                className="flex w-full gap-3 border-t border-ink-150 py-3 text-left first:border-t-0"
              >
                <span className={`w-10 shrink-0 pt-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.06em] ${c.isTerm ? 'text-gold-700' : 'text-ink-500'}`}>{c.isTerm ? 'Term' : MONTH_ABBR[Number(c.key.split('-')[1]) - 1]}</span>
                <span className="min-w-0 flex-1">
                  <span className="mb-2 block whitespace-pre-wrap break-words text-sm leading-snug text-ink-800"><Linkify>{g.title}</Linkify></span>
                  <ProgressLine value={g.progress || 0} done={(g.progress || 0) >= 100} />
                </span>
              </button>
            )),
          )}
        </div>
      ) : canEdit ? (
        <button
          onClick={() => onAdd('TERM')}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-ink-200 py-2.5 text-sm font-semibold text-ink-400 transition hover:border-green-500 hover:text-green-600"
        >
          <Plus size={15} /> Add a Goal
        </button>
      ) : (
        <div className="mt-3 rounded-xl bg-ink-50 py-2.5 text-center text-xs text-ink-400">No goals set yet</div>
      )}
    </Card>
  )
}

// ---- semester targets ----------------------------------------------------

function TargetsStrip({ targets, editable, onEdit }) {
  if (!targets.length && !editable) return null
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-ink-200 bg-ink-50 px-4 py-3">
      <span className="font-mono text-2xs font-semibold uppercase tracking-[0.08em] text-green-700">Semester targets</span>
      <div className="flex flex-1 flex-wrap items-center gap-x-4 gap-y-2">
        {targets.length === 0 ? (
          <span className="text-sm text-ink-400">None yet — add the club’s term targets.</span>
        ) : (
          targets.map((t, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-700">
              <Target size={13} className="text-green-600" />
              {t.label}
              {t.sub && <span className="text-ink-400">· {t.sub}</span>}
            </span>
          ))
        )}
      </div>
      {editable && (
        <button
          onClick={onEdit}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-ink-200 bg-surface text-ink-500 transition hover:border-green-400 hover:bg-green-50 hover:text-green-600"
          aria-label="Edit semester targets"
          title="Edit semester targets"
        >
          <Pencil size={15} />
        </button>
      )}
    </div>
  )
}

function TargetsEditorModal({ open, targets, onClose, onSave }) {
  const [items, setItems] = useState([])
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (open) setItems((targets || []).map((t) => ({ label: t.label ?? '', sub: t.sub ?? '' })))
  }, [open, targets])

  async function save() {
    setBusy(true)
    await onSave(items.map((t) => ({ label: t.label.trim(), sub: t.sub.trim() || undefined })).filter((t) => t.label))
    setBusy(false)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit Semester Targets">
      <div className="space-y-3">
        <p className="text-sm text-ink-600">Club-wide goals for the term. These also show on the dashboard.</p>
        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={i} className="flex items-center gap-2">
              <GripVertical size={15} className="shrink-0 text-ink-300" />
              <input
                className={inputClass}
                value={it.label}
                onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                placeholder="e.g. $2,000 raised"
              />
              <input
                className={`${inputClass} max-w-[38%]`}
                value={it.sub}
                onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, sub: e.target.value } : x)))}
                placeholder="note (optional)"
              />
              <button
                onClick={() => setItems(items.filter((_, j) => j !== i))}
                className="shrink-0 rounded-lg p-2 text-ink-400 transition hover:bg-coral-50 hover:text-coral-600"
                aria-label="Remove target"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={() => setItems([...items, { label: '', sub: '' }])}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-ink-300 py-2.5 text-sm font-semibold text-ink-500 transition hover:border-green-500 hover:text-green-600"
        >
          <Plus size={15} /> Add Target
        </button>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="soft" onClick={onClose}>Cancel</Button>
          <Button icon={Check} onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save Targets'}</Button>
        </div>
      </div>
    </Modal>
  )
}

// ---- add / edit a single goal cell --------------------------------------

function GoalEditModal({ state, members, months, myId, isAdmin, onClose, onSaved }) {
  const goal = state.goal
  const editing = !!goal
  const [ownerId, setOwnerId] = useState(goal?.owner_id ?? state.owner_id ?? (isAdmin ? '' : myId))
  const [period, setPeriod] = useState(goal?.period ?? state.period ?? 'TERM')
  const [text, setText] = useState(goal?.title ?? '')
  const [progress, setProgress] = useState(goal?.progress ?? 0)
  const [busy, setBusy] = useState(false)

  const periodOptions = [{ key: 'TERM', label: 'Term goal' }, ...months.map((mo) => ({ key: mo.key, label: `${mo.long} goal` }))]

  async function submit(e) {
    e.preventDefault()
    if (!ownerId || !text.trim()) return
    setBusy(true)
    const fields = {
      owner_id: ownerId,
      period,
      title: text.trim(),
      progress: Number(progress),
      status: Number(progress) >= 100 ? 'done' : 'active',
    }
    if (editing) await updateGoal(goal.id, fields)
    else await createGoal({ ...fields, detail: null, created_by: myId })
    setBusy(false)
    onSaved()
  }

  async function remove() {
    if (!window.confirm('Delete this goal? This can’t be undone.')) return
    setBusy(true)
    await deleteGoal(goal.id)
    setBusy(false)
    onSaved()
  }

  return (
    <Modal open onClose={onClose} title={editing ? 'Edit Goal' : 'Add Goal'}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Member">
            <select
              className={selectClass}
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              required
              disabled={!isAdmin}
              title={!isAdmin ? 'You can only set goals for yourself' : undefined}
            >
              <option value="">Pick a member…</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </FormField>
          <FormField label="When">
            <select className={selectClass} value={period} onChange={(e) => setPeriod(e.target.value)}>
              {periodOptions.map((p) => (
                <option key={p.key} value={p.key}>{p.label}</option>
              ))}
            </select>
          </FormField>
        </div>
        <FormField label="Goal">
          <textarea className={inputClass} rows={3} value={text} onChange={(e) => setText(e.target.value)} required placeholder="What does success look like?" />
        </FormField>
        <FormField label={`Progress · ${progress}%${Number(progress) >= 100 ? ' · done' : ''}`}>
          <input type="range" min="0" max="100" step="5" value={progress} onChange={(e) => setProgress(e.target.value)} className="ja-range" />
        </FormField>
        <div className="flex items-center justify-between pt-1">
          {editing ? (
            <button type="button" onClick={remove} disabled={busy} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-sm font-medium text-coral-700 transition hover:bg-coral-50 disabled:opacity-50">
              <Trash2 size={15} /> Delete
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="soft" type="button" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save' : 'Add Goal'}</Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

function LoadingGrid() {
  return (
    <div className="mt-6 space-y-3">
      {[0, 1, 2].map((i) => <Card key={i} className="h-24 animate-pulse bg-ink-50" />)}
    </div>
  )
}

function initialsOf(name) {
  return (name || '')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}
