import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { Eraser } from 'lucide-react'

// A handwritten signature, drawn with the finger, a pen or the mouse, and
// returned as a PNG trimmed to the ink (null while nothing is drawn).

const WIDTH = 640, HEIGHT = 220
// The 2D context of a mounted canvas (always present for a canvas element).
const draw = (canvas: HTMLCanvasElement | null) => (canvas as HTMLCanvasElement).getContext('2d') as CanvasRenderingContext2D

function trimmed(canvas: HTMLCanvasElement) {
  const context = draw(canvas)
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
  let top = canvas.height, left = canvas.width, right = -1, bottom = -1
  for (let y = 0; y < canvas.height; y += 1) for (let x = 0; x < canvas.width; x += 1) {
    if (data[(y * canvas.width + x) * 4 + 3] < 10) continue
    if (x < left) left = x
    if (x > right) right = x
    if (y < top) top = y
    if (y > bottom) bottom = y
  }
  if (right < 0) return null
  const pad = 8
  const out = document.createElement('canvas')
  out.width = Math.min(canvas.width, right - left + pad * 2)
  out.height = Math.min(canvas.height, bottom - top + pad * 2)
  draw(out).drawImage(canvas, Math.max(0, left - pad), Math.max(0, top - pad), out.width, out.height, 0, 0, out.width, out.height)
  return out.toDataURL('image/png')
}

export function SignaturePad({ onChange, language = 'el' }: { onChange?: (image: string | null) => void, language?: string }) {
  const en = language === 'en'
  const canvas = useRef<HTMLCanvasElement>(null)
  const last = useRef<{ x: number, y: number } | null>(null)
  const [empty, setEmpty] = useState(true)

  useEffect(() => {
    const context = draw(canvas.current)
    context.lineWidth = 2.6
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.strokeStyle = '#0f2a4a'
  }, [])

  const point = (event: PointerEvent<HTMLCanvasElement>) => {
    const box = (canvas.current as HTMLCanvasElement).getBoundingClientRect()
    return { x: (event.clientX - box.left) * (WIDTH / box.width), y: (event.clientY - box.top) * (HEIGHT / box.height) }
  }
  const down = (event: PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault()
    canvas.current?.setPointerCapture?.(event.pointerId)
    last.current = point(event)
    const context = draw(canvas.current)
    context.beginPath(); context.arc(last.current.x, last.current.y, 1.2, 0, Math.PI * 2); context.fillStyle = '#0f2a4a'; context.fill()
  }
  const move = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!last.current) return
    const next = point(event)
    const context = draw(canvas.current)
    context.beginPath(); context.moveTo(last.current.x, last.current.y); context.lineTo(next.x, next.y); context.stroke()
    last.current = next
  }
  const up = () => {
    if (!last.current) return
    last.current = null
    setEmpty(false)
    onChange?.(trimmed(canvas.current as HTMLCanvasElement))
  }
  const clear = () => {
    draw(canvas.current).clearRect(0, 0, WIDTH, HEIGHT)
    setEmpty(true)
    onChange?.(null)
  }

  return <div className="reg-signpad">
    <canvas ref={canvas} width={WIDTH} height={HEIGHT} aria-label={en ? 'Signature' : 'Υπογραφή'} role="img"
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up} />
    {empty && <span className="reg-signpad-hint">{en ? 'Sign here' : 'Υπογράψτε εδώ'}</span>}
    <i className="reg-signpad-line" aria-hidden="true" />
    <button type="button" className="reg-link" onClick={clear} disabled={empty}><Eraser size={13} /> {en ? 'Clear' : 'Καθαρισμός'}</button>
  </div>
}
