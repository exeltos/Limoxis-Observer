import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Megaphone } from 'lucide-react'
import { useAuth } from '../../core/auth/AuthContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { Button } from '../../design-system/Button'
import { loadPendingAnnouncements, markAnnouncementSeen } from './platformAnnouncementsService'
import './platformAnnouncements.css'

// The platform owner's announcement or promotion, shown to a hospital administrator when they open the application
// (owner, 8/11/2026): only the hospital administrator, only in production, one at a time. An «every visit» one comes
// back on the next visit (a new browser session), a «once» one never again.
const SESSION_KEY = 'lo-platform-announcements-shown'
const shownThisSession = () => {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(SESSION_KEY) || '[]'))
  } catch {
    return new Set()
  }
}
const rememberShown = id => {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify([...shownThisSession(), id]))
  } catch {
    // Storage is a convenience: without it an «every visit» one may show again in this session.
  }
}

export function PlatformAnnouncementGate({ hold = false }) {
  const { user } = useAuth()
  const { tenant, actualRole, isDemo, isRolePreview } = useTenant()
  const { language } = useLanguage()
  const navigate = useNavigate()
  const en = language === 'en'
  const [queue, setQueue] = useState([])
  const eligible = Boolean(user?.id && tenant?.id && !isDemo && !isRolePreview && actualRole === 'hospital_admin')
  useEffect(() => {
    if (!eligible) return undefined
    let alive = true
    loadPendingAnnouncements(tenant.id, user.id)
      .then(list => {
        const shown = shownThisSession()
        if (alive) setQueue(list.filter(item => !shown.has(item.id)))
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [eligible, tenant?.id, user?.id])
  const current = queue[0]
  if (!eligible || hold || !current) return null
  const pick = (el, enText) => (en && enText ? enText : el)
  const title = pick(current.titleEl, current.titleEn)
  const close = () => {
    rememberShown(current.id)
    markAnnouncementSeen(current.id, tenant.id, user.id).catch(() => {})
    setQueue(list => list.slice(1))
  }
  const cta = current.ctaUrl ? pick(current.ctaLabelEl, current.ctaLabelEn) || (en ? 'Learn more' : 'Δείτε περισσότερα') : ''
  const follow = () => {
    close()
    if (current.ctaUrl.startsWith('/')) navigate(current.ctaUrl)
    else window.open(current.ctaUrl, '_blank', 'noopener,noreferrer')
  }
  return (
    <ObserverDialog
      title={title}
      eyebrow={current.kind === 'promotion' ? (en ? 'New in Limoxis' : 'Νέο στο Limoxis') : en ? 'Announcement' : 'Ανακοίνωση'}
      width="compact"
      className={`platform-announcement-dialog is-${current.kind}`}
      onClose={close}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            {en ? 'Close' : 'Κλείσιμο'}
          </Button>
          {cta && <Button onClick={follow}>{cta}</Button>}
        </>
      }
    >
      {current.imageUrl ? (
        <img className="platform-announcement-image" src={current.imageUrl} alt="" />
      ) : (
        <div className="platform-announcement-band" aria-hidden="true">
          <Megaphone size={22} />
        </div>
      )}
      <p className="platform-announcement-body">{pick(current.bodyEl, current.bodyEn)}</p>
    </ObserverDialog>
  )
}
