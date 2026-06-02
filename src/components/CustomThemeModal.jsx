import { useEffect, useState } from 'react'
import { Loader2, Upload, Trash2 } from 'lucide-react'
import { Modal, Button } from './ui'
import { useCustomTheme } from '../context/CustomThemeContext'
import { fileToThemeImage, analyzeImage } from '../lib/customTheme'

const baseBtn = (active) =>
  `flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
    active ? 'border-green-500 bg-green-50 text-green-700' : 'border-ink-200 text-ink-600 hover:bg-ink-50'
  }`

function Swatch({ label, value, onChange }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-ink-200 px-3 py-2">
      <span className="text-sm font-medium text-ink-800">{label}</span>
      <span className="flex items-center gap-2">
        <span className="font-mono text-xs uppercase text-ink-500">{value}</span>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-9 cursor-pointer rounded border border-ink-200 bg-transparent"
        />
      </span>
    </label>
  )
}

export default function CustomThemeModal({ open, onClose }) {
  const { config, setConfig, remove, preview, restore } = useCustomTheme()
  const [draft, setDraft] = useState(null)
  const [busy, setBusy] = useState(false)

  // Seed the editor from the saved theme whenever it opens.
  useEffect(() => {
    if (open) setDraft(config)
  }, [open, config])

  // Live-preview the draft while open; on close, snap back to the saved theme.
  useEffect(() => {
    if (open && draft?.image) preview(draft)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, draft])
  useEffect(() => {
    if (!open) restore()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function onFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    const image = await fileToThemeImage(file)
    const palette = await analyzeImage(image)
    setBusy(false)
    setDraft({ image, ...palette })
    e.target.value = ''
  }

  const update = (k) => (v) => setDraft((d) => ({ ...d, [k]: v }))

  function apply() {
    setConfig(draft) // saves + applies for real
    onClose()
  }
  function clearTheme() {
    remove()
    setDraft(null)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Custom theme">
      <div className="space-y-4">
        <p className="text-sm text-ink-600">
          Upload a background image — we&rsquo;ll pick matching colors for the best contrast, and you can fine-tune each one.
        </p>

        {!draft?.image ? (
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-ink-300 p-8 text-center transition-colors hover:border-green-400">
            {busy ? <Loader2 className="animate-spin text-ink-400" /> : <Upload className="text-ink-400" />}
            <span className="text-sm font-medium text-ink-700">{busy ? 'Processing…' : 'Upload a background image'}</span>
            <span className="text-xs text-ink-400">PNG or JPG</span>
            <input type="file" accept="image/*" className="hidden" onChange={onFile} disabled={busy} />
          </label>
        ) : (
          <>
            <div
              className="relative h-32 overflow-hidden rounded-xl border border-ink-200"
              style={{ backgroundImage: `url(${draft.image})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
            >
              <label className="absolute bottom-2 right-2 cursor-pointer rounded-lg bg-ink-950/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur transition-colors hover:bg-ink-950/80">
                {busy ? 'Processing…' : 'Replace'}
                <input type="file" accept="image/*" className="hidden" onChange={onFile} disabled={busy} />
              </label>
            </div>

            <div className="flex gap-2">
              <button type="button" onClick={() => update('base')('light')} className={baseBtn(draft.base === 'light')}>
                Light base
              </button>
              <button type="button" onClick={() => update('base')('dark')} className={baseBtn(draft.base === 'dark')}>
                Dark base
              </button>
            </div>

            <div className="space-y-2">
              <Swatch label="Accent (buttons & links)" value={draft.accent} onChange={update('accent')} />
              <Swatch label="Cards" value={draft.surface} onChange={update('surface')} />
              <Swatch label="Text" value={draft.text} onChange={update('text')} />
            </div>
          </>
        )}

        <div className="flex items-center justify-between pt-1">
          {config ? (
            <Button variant="danger" icon={Trash2} onClick={clearTheme}>Remove theme</Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="soft" type="button" onClick={onClose}>Cancel</Button>
            <Button type="button" onClick={apply} disabled={!draft?.image}>Apply theme</Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
