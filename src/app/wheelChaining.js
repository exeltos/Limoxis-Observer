// A table wider than its box scrolls sideways; the browser then gives the
// mouse wheel to the table, which has nowhere to go vertically, and the page
// under it does not move. When the wheel turns over such a box, scroll the
// first real vertical scroll area around it instead.
const SLACK = 24 // px of vertical scroll that only come from a horizontal scrollbar

const scrolls = (el, axis) => /(auto|scroll)/.test(getComputedStyle(el)[axis === 'y' ? 'overflowY' : 'overflowX'])

export function handleWheel(event) {
  if (event.defaultPrevented || event.ctrlKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return
  let skipped = false
  for (let el = event.target instanceof Element ? event.target : null; el && el !== document.documentElement; el = el.parentElement) {
    const slack = el.scrollHeight - el.clientHeight
    // A box that scrolls sideways (with at most a scrollbar's worth of height
    // to spare) keeps the wheel from the page: skip it.
    if (scrolls(el, 'x') && el.scrollWidth > el.clientWidth && slack <= SLACK) {
      skipped = true
      continue
    }
    if (!scrolls(el, 'y') || slack <= 0) continue
    if (!skipped) return
    const lines = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? el.clientHeight : 1
    el.scrollTop += event.deltaY * lines
    event.preventDefault()
    return
  }
}

export function watchWheelChaining(root = document) {
  root.addEventListener('wheel', handleWheel, { passive: false })
  return () => root.removeEventListener('wheel', handleWheel)
}
