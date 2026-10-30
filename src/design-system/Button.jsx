import { useEffect } from 'react'
import { highlightFields, missingRequiredFields } from './incompleteFields'
import './Button.css'

// A primary button that is faded because something is not filled in stays faded; pressing it says what is
// missing and marks those fields. One listener serves every button (the button itself is left as it is): a faded
// primary button lets the click through (see Button.css), and the click that lands on one asks what is missing.
// A button faded for another reason (nothing changed, no permission) finds nothing to say and does nothing.
let hint = null
let hintTimer = null
let installed = false
function closeHint() { window.clearTimeout(hintTimer); hint?.remove(); hint = null }
function showHint(button) {
  closeHint()
  const items = missingRequiredFields(button)
  if (!items.length) return
  highlightFields(items)
  const rect = button.getBoundingClientRect()
  hint = document.createElement('span')
  hint.className = 'button-incomplete-hint'
  hint.setAttribute('role', 'status')
  hint.textContent = `${document.documentElement.lang === 'en' ? 'Fill in: ' : 'Συμπληρώστε: '}${items.map(item => item.label).join(', ')}`
  hint.style.right = `${Math.max(8, window.innerWidth - rect.right)}px`
  hint.style.bottom = `${window.innerHeight - rect.top + 8}px`
  document.body.appendChild(hint)
  hintTimer = window.setTimeout(closeHint, 6000)
}
function onClick(event) {
  for (const button of document.querySelectorAll('button.button-primary:disabled:not(.button-loading)')) {
    const rect = button.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0 && event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) {
      event.stopPropagation()
      showHint(button)
      return
    }
  }
  closeHint()
}
function install() {
  if (installed || typeof document === 'undefined') return
  installed = true
  document.addEventListener('click', onClick, true)
}

export function Button({ variant = 'primary', className = '', type = 'button', loading = false, disabled, children, ...props }) {
  useEffect(install, [])
  return (
    <button
      type={type}
      className={`button button-${variant} ${loading ? 'button-loading' : ''} ${className}`.trim()}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <span className="button-spinner" aria-hidden="true" />}
      {children}
    </button>
  )
}
