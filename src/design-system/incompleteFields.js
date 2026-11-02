// What is missing behind a faded «Save»: the required fields (a label that ends with «*», or a control marked required)
// that are still empty, found in the form around the button. A button that is faded for another reason
// (nothing changed, no permission) finds none and says nothing.
const FIELD = 'input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]), select, textarea'
const isEmpty = control => !String(control.value ?? '').trim()
const cleanLabel = text => String(text || '').replace(/\*/g, '').replace(/\s+/g, ' ').trim()

function containerOf(button) {
  return button.closest('[role=dialog], form, .record-section, .surface, main') || document.body
}

export function missingRequiredFields(button) {
  const root = containerOf(button)
  const found = new Map()
  const add = (control, label) => { if (control && !control.disabled && !control.readOnly && isEmpty(control) && !found.has(control)) found.set(control, cleanLabel(label) || control.getAttribute('aria-label') || '') }
  // A label ending with «*» holds (or points to) its control.
  for (const label of root.querySelectorAll('label')) {
    // The caption is the label's first line («Τίτλος *»); a hint or a description may follow it inside the label.
    const caption = (label.querySelector('.field-label, .lo-field-label') || label.querySelector('span') || label).textContent || ''
    if (!/\*\s*$/.test(caption.trim()) && !/\*\s*$/.test((label.textContent || '').trim())) continue
    const control = label.querySelector(FIELD) || (label.htmlFor ? root.querySelector(`#${CSS.escape(label.htmlFor)}`) : null)
    add(control, caption)
  }
  // Controls that declare themselves required.
  for (const control of root.querySelectorAll('[required], [aria-required="true"]')) {
    if (!control.matches(FIELD)) continue
    add(control, control.closest('label')?.textContent || control.getAttribute('aria-label') || '')
  }
  return [...found].map(([control, label]) => ({ control, label })).filter(item => item.label)
}

// Marks the missing fields for a few seconds and takes the first into view.
export function highlightFields(items) {
  const marked = items.map(item => item.control.closest('label, .field') || item.control)
  marked.forEach(element => element.classList.add('field-missing'))
  items[0]?.control.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
  items[0]?.control.focus?.({ preventScroll: true })
  window.setTimeout(() => marked.forEach(element => element.classList.remove('field-missing')), 5000)
}
