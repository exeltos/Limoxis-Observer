// Mouse wheel over nested scroll areas.
//
// The browser gives the wheel to the innermost scroll box under the pointer.
// When that box cannot move any further in the wheel's direction (a table that
// only scrolls sideways, a list already at its end, a box with nothing left to
// scroll) some browsers stop there instead of passing the wheel on, and the
// page under the pointer does not move. The rule here: an inner box takes the
// wheel only while it still has room in that direction; otherwise the nearest
// box around it that does have room scrolls, up to the page itself.
//
// Dialogs keep the wheel: it is never passed from a dialog to the page behind.
const SLACK = 24 // px of vertical scroll that only come from a horizontal scrollbar
const DIALOG = '[role="dialog"],dialog,.observer-dialog'

const overflowOf = (el, axis) => getComputedStyle(el)[axis === 'y' ? 'overflowY' : 'overflowX']
const scrolls = (el, axis) => /(auto|scroll)/.test(overflowOf(el, axis))

// Room left to scroll `el` by `deltaY` (sign gives the direction).
export function roomToScroll(el, deltaY) {
  const max = el.scrollHeight - el.clientHeight
  if (max <= 0) return false
  // A box that scrolls sideways, with at most a scrollbar's worth of height to
  // spare, is not a vertical scroller.
  if (scrolls(el, 'x') && el.scrollWidth > el.clientWidth && max <= SLACK) return false
  return deltaY > 0 ? el.scrollTop < max - 1 : el.scrollTop > 0
}

function lineHeight(event, el) {
  return event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? el.clientHeight : 1
}

export function handleWheel(event) {
  if (event.defaultPrevented || event.ctrlKey || !event.deltaY || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return
  const root = document.scrollingElement || document.documentElement
  // True once the wheel has passed a scroll box that cannot move this way: the
  // browser may keep the wheel there, so the next box is scrolled here.
  let blocked = false
  for (let el = event.target instanceof Element ? event.target : null; el; el = el.parentElement) {
    if (el === root || el === document.body || el === document.documentElement) break
    if (scrolls(el, 'y') || scrolls(el, 'x')) {
      if (scrolls(el, 'y') && roomToScroll(el, event.deltaY)) {
        if (!blocked) return // the browser scrolls it
        el.scrollTop += event.deltaY * lineHeight(event, el)
        event.preventDefault()
        return
      }
      blocked = true
    }
    if (el.matches?.(DIALOG)) return
  }
  if (blocked && root && roomToScroll(root, event.deltaY)) {
    root.scrollTop += event.deltaY * lineHeight(event, root)
    event.preventDefault()
  }
}

export function watchWheelChaining(root = document) {
  root.addEventListener('wheel', handleWheel, { passive: false })
  return () => root.removeEventListener('wheel', handleWheel)
}
