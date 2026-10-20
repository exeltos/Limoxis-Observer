import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FilePlus2, ListChecks, Plus } from 'lucide-react'

// «+ Αναφορά συμβάντος», pinned at the foot of the sidebar for everyone who may
// report: a new report or the user's own reports. It opens upwards, above the button.
export function SidebarIncidentReport({ t, onNavigate }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    const onPointer = event => { if (!rootRef.current?.contains(event.target)) setOpen(false) }
    const onKey = event => { if (event.key === 'Escape') { setOpen(false); triggerRef.current?.focus() } }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onPointer); document.removeEventListener('keydown', onKey) }
  }, [open])
  const go = path => { setOpen(false); onNavigate?.(); navigate(path) }
  const label = t('sidebarNav.reportIncident')
  return <div ref={rootRef} className={`sidebar-incident ${open ? 'open' : ''}`.trim()}>
    {open && <div id="sidebar-incident-menu" className="sidebar-incident-menu" role="menu" aria-label={label}>
      <button type="button" role="menuitem" autoFocus onClick={() => go('/quality/report')}><FilePlus2 size={15} aria-hidden="true" /><span>{t('sidebarNav.newIncidentReport')}</span></button>
      <button type="button" role="menuitem" onClick={() => go('/quality/my-reports')}><ListChecks size={15} aria-hidden="true" /><span>{t('sidebarNav.myIncidentReports')}</span></button>
    </div>}
    <button ref={triggerRef} type="button" className="sidebar-incident-trigger" title={label} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? 'sidebar-incident-menu' : undefined} onClick={() => setOpen(value => !value)}><Plus size={17} aria-hidden="true" /><span>{label}</span></button>
  </div>
}
