import { useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import { Modal, Button } from './ui'

function createImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.addEventListener('load', () => resolve(img))
    img.addEventListener('error', reject)
    img.src = url
  })
}

// Render the chosen crop region to a square canvas → a JPEG File ready to upload.
async function getCroppedFile(src, area, size = 512) {
  const image = await createImage(src)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, size, size)
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.9))
  return new File([blob], 'avatar.jpg', { type: 'image/jpeg' })
}

// Round-crop dialog shown after a member picks a photo. Returns a square File via
// onSave; the caller uploads it with the existing uploadAvatar().
export default function AvatarCropper({ open, src, onCancel, onSave }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [areaPixels, setAreaPixels] = useState(null)
  const [busy, setBusy] = useState(false)

  const onCropComplete = useCallback((_area, areaPx) => setAreaPixels(areaPx), [])

  async function save() {
    if (!areaPixels) return
    setBusy(true)
    const file = await getCroppedFile(src, areaPixels)
    setBusy(false)
    onSave(file)
  }

  return (
    <Modal open={open} onClose={onCancel} title="Crop your photo">
      <div className="space-y-4">
        <div className="relative h-64 w-full overflow-hidden rounded-xl bg-ink-900">
          {src && (
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-ink-500">Zoom</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="h-1.5 flex-1 cursor-pointer accent-green-600"
            aria-label="Zoom"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="soft" type="button" onClick={onCancel}>Cancel</Button>
          <Button type="button" onClick={save} disabled={busy || !areaPixels}>
            {busy ? 'Saving…' : 'Save photo'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
