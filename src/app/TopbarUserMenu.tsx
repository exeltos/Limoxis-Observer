import { useEffect, useRef, useState } from 'react'
import { BookOpen, ChevronDown, Eye, Languages, LogOut, UserRound } from 'lucide-react'

// The user's button in the top bar: one menu for the account, the role preview
// (Owner / Administrator), help, the language and signing out. Arrow keys move
// between the items, Escape closes and returns to the button.
export function TopbarUserMenu({ t, name, roleName, language, onAccount, onPreview, onHelp, onToggleLanguage, onLogout }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)
  const items = () => [...(menuRef.current?.querySelectorAll('[role="menuitem"]') ?? [])]
  useEffect(() => {
    if (!open) return undefined
    items()[0]?.focus()
    const onPointer = event => { if (!rootRef.current?.contains(event.target)) setOpen(false) }
    document.addEventListener('mousedown', onPointer)
    return () => document.removeEventListener('mousedown', onPointer)
  }, [open])
  const close = () => { setOpen(false); triggerRef.current?.focus() }
  const choose = action => () => { setOpen(false); action?.() }
  function onMenuKey(event) {
    const list = items(); const index = list.indexOf(document.activeElement)
    const move = next => { event.preventDefault(); list[(next + list.length) % list.length]?.focus() }
    if (event.key === 'ArrowDown') move(index + 1)
    else if (event.key === 'ArrowUp') move(index - 1)
    else if (event.key === 'Home') move(0)
    else if (event.key === 'End') move(list.length - 1)
    else if (event.key === 'Escape') { event.preventDefault(); close() }
    else if (event.key === 'Tab') setOpen(false)
  }
  function onTriggerKey(event) {
    if (event.key === 'ArrowDown' && !open) { event.preventDefault(); setOpen(true) }
  }
  const initials = (name || 'U').slice(0, 2).toUpperCase()
  const otherLanguage = language === 'el' ? 'English' : 'Ελληνικά'
  return <div ref={rootRef} className="topbar-user-menu">
    <button ref={triggerRef} type="button" className="user-chip user-chip-button" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? 'topbar-user-menu-list' : undefined} title={t('userMenu.label')} onClick={() => setOpen(value => !value)} onKeyDown={onTriggerKey}><div className="avatar">{initials}</div><div><strong>{name || 'User'}</strong><span>{roleName}</span></div><ChevronDown size={14} aria-hidden="true" /></button>
    {open && <div id="topbar-user-menu-list" ref={menuRef} className="topbar-user-menu-list" role="menu" aria-label={t('userMenu.label')} onKeyDown={onMenuKey}>
      <button type="button" role="menuitem" tabIndex={-1} onClick={choose(onAccount)}><UserRound size={15} aria-hidden="true" /><span>{t('userMenu.account')}</span></button>
      {onPreview && <button type="button" role="menuitem" tabIndex={-1} onClick={choose(onPreview)}><Eye size={15} aria-hidden="true" /><span>{t('userMenu.preview')}</span></button>}
      <button type="button" role="menuitem" tabIndex={-1} onClick={choose(onHelp)}><BookOpen size={15} aria-hidden="true" /><span>{t('userMenu.help')}</span></button>
      <button type="button" role="menuitem" tabIndex={-1} onClick={choose(onToggleLanguage)}><Languages size={15} aria-hidden="true" /><span>{t('userMenu.language')}: {otherLanguage}</span><b className="topbar-user-menu-tag">{language === 'el' ? 'EN' : 'EL'}</b></button>
      <div className="topbar-user-menu-separator" role="separator" />
      <button type="button" role="menuitem" tabIndex={-1} className="topbar-user-menu-logout" onClick={choose(onLogout)}><LogOut size={15} aria-hidden="true" /><span>{t('userMenu.logout')}</span></button>
    </div>}
  </div>
}
