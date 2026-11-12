import { useEffect, useRef, useState } from 'react'
import { Eraser } from 'lucide-react'

// A handwritten signature, drawn with the finger, a pen or the mouse, and
// returned as a PNG trimmed to the ink (null while nothing is drawn).

const WIDTH = 640, HEIGHT = 220

function trimmed(canvas) {
  const context = canvas.getContext('2d')
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
  out.getContext('2d').drawImage(canvas, Math.max(0, left - pad), Math.max(0, top - pad), out.width, out.height, 0, 0, out.width, out.height)
  return out.toDataURL('image/png')
}

export function SignaturePad({ onChange, language = 'el' }) {
  const en = language === 'en'
  const canvas = useRef(null)
  const last = useRef(null)
  const [empty, setEmpty] = useState(true)

  useEffect(() => {
    const context = canvas.current.getContext('2d')
    context.lineWidth = 2.6
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.strokeStyle = '#0f2a4a'
  }, [])

  const point = event => {
    const box = canvas.current.getBoundingClientRect()
    return { x: (event.clientX - box.left) * (WIDTH / box.width), y: (event.clientY - box.top) * (HEIGHT / box.height) }
  }
  const down = event => {
    event.preventDefault()
    canvas.current.setPointerCapture?.(event.pointerId)
    last.current = point(event)
    const context = canvas.current.getContext('2d')
    context.beginPath(); context.arc(last.current.x, last.current.y, 1.2, 0, Math.PI * 2); context.fillStyle = '#0f2a4a'; context.fill()
  }
  const move = event => {
    if (!last.current) return
    const next = point(event)
    const context = canvas.current.getContext('2d')
    context.beginPath(); context.moveTo(last.current.x, last.current.y); context.lineTo(next.x, next.y); context.stroke()
    last.current = next
  }
  const up = () => {
    if (!last.current) return
    last.current = null
    setEmpty(false)
    onChange?.(trimmed(canvas.current))
  }
  const clear = () => {
    canvas.current.getContext('2d').clearRect(0, 0, WIDTH, HEIGHT)
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
