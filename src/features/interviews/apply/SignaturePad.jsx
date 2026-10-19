import { useEffect, useRef, useState } from 'react'
import { Eraser } from 'lucide-react'

// A signature drawn with the finger, a stylus or the mouse (pointer events). The image
// is kept as a PNG data URL; a saved one (the autosave) is drawn back on mount.
export function SignaturePad({ value, onChange, label, clearLabel, emptyText }) {
  const canvas = useRef(null)
  const drawing = useRef(null)
  const [empty, setEmpty] = useState(!value)
  useEffect(() => {
    const el = canvas.current
    const ctx = el?.getContext?.('2d')
    if (!ctx) return
    const ratio = Math.max(1, Math.min(2, window.devicePixelRatio || 1))
    const { width, height } = el.getBoundingClientRect()
    el.width = Math.round((width || 640) * ratio)
    el.height = Math.round((height || 200) * ratio)
    ctx.scale(ratio, ratio)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 2.6
    ctx.strokeStyle = '#0f2233'
    if (value) { const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0, width || 640, height || 200); img.src = value }
    // Drawn once at mount: later values come from this pad itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const point = event => { const rect = canvas.current.getBoundingClientRect(); return [event.clientX - rect.left, event.clientY - rect.top] }
  function start(event) {
    const ctx = canvas.current?.getContext?.('2d')
    if (!ctx) return
    event.preventDefault()
    canvas.current.setPointerCapture?.(event.pointerId)
    const [x, y] = point(event)
    drawing.current = { ctx, x, y }
    ctx.beginPath(); ctx.arc(x, y, 1.2, 0, Math.PI * 2); ctx.fillStyle = '#0f2233'; ctx.fill()
    setEmpty(false)
  }
  function move(event) {
    const current = drawing.current
    if (!current) return
    event.preventDefault()
    const [x, y] = point(event)
    current.ctx.beginPath(); current.ctx.moveTo(current.x, current.y)
    current.ctx.quadraticCurveTo(current.x, current.y, (current.x + x) / 2, (current.y + y) / 2)
    current.ctx.lineTo(x, y); current.ctx.stroke()
    current.x = x; current.y = y
  }
  function end() {
    if (!drawing.current) return
    drawing.current = null
    onChange(canvas.current.toDataURL('image/png'))
  }
  function clear() {
    const el = canvas.current
    el?.getContext?.('2d')?.clearRect(0, 0, el.width, el.height)
    setEmpty(true)
    onChange('')
  }
  return <div className={`apply-signature ${empty ? 'is-empty' : ''}`}>
    <canvas ref={canvas} aria-label={label} role="img" onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onPointerLeave={end} />
    {empty && <span className="apply-signature-hint">{emptyText}</span>}
    <button type="button" className="apply-link-button apply-signature-clear" onClick={clear} disabled={empty}><Eraser size={18} />{clearLabel}</button>
  </div>
}
