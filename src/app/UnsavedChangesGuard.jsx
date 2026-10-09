import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useFeedback } from '../core/feedback/FeedbackContext'

// Typing into a screen's fields marks it as having unsaved changes until the next
// successful save (any "success" notification) or the next screen. While it does,
// following a link in the app asks first, and closing or reloading the tab warns.
// Search boxes, filters, pagination and dialogs (which guard themselves) do not count.
export const SAVED_EVENT = 'limoxis:saved'
const IGNORED = '.filter-primary-row, .filter-popover, .filter-search, .registry-pagination, [role=search], .observer-dialog, .confirm-dialog'
const isSearchField = el => el?.type === 'search' || /search|αναζήτ/i.test(`${el?.className || ''} ${el?.placeholder || ''}`)

export function UnsavedChangesGuard({ language }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { confirm } = useFeedback()
  const dirty = useRef(false)

  useEffect(() => { dirty.current = false }, [pathname])

  useEffect(() => {
    const en = language === 'en'
    const markDirty = event => {
      const el = event.target
      if (!el?.closest?.('.content') || el.closest(IGNORED) || isSearchField(el)) return
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable) dirty.current = true
    }
    const clear = () => { dirty.current = false }
    const warnUnload = event => { if (dirty.current) { event.preventDefault(); event.returnValue = '' } }
    const guardLinks = async event => {
      if (!dirty.current || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const link = event.target?.closest?.('a[href]')
      if (!link || link.target === '_blank' || link.hasAttribute('download')) return
      const url = new URL(link.href, window.location.href)
      if (url.origin !== window.location.origin || url.pathname + url.search === window.location.pathname + window.location.search) return
      event.preventDefault()
      event.stopPropagation()
      const leave = await confirm({
        title: en ? 'Leave without saving?' : 'Έξοδος χωρίς αποθήκευση;',
        message: en ? 'The changes you made on this screen have not been saved.' : 'Οι αλλαγές που κάνατε σε αυτή την οθόνη δεν έχουν αποθηκευτεί.',
        confirmLabel: en ? 'Leave' : 'Έξοδος',
        danger: true,
      })
      if (!leave) return
      dirty.current = false
      navigate(url.pathname + url.search + url.hash)
    }
    document.addEventListener('input', markDirty, true)
    document.addEventListener('change', markDirty, true)
    document.addEventListener('click', guardLinks, true)
    window.addEventListener(SAVED_EVENT, clear)
    window.addEventListener('beforeunload', warnUnload)
    return () => {
      document.removeEventListener('input', markDirty, true)
      document.removeEventListener('change', markDirty, true)
      document.removeEventListener('click', guardLinks, true)
      window.removeEventListener(SAVED_EVENT, clear)
      window.removeEventListener('beforeunload', warnUnload)
    }
  }, [confirm, navigate, language])

  return null
}
