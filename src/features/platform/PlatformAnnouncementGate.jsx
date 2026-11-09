import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Megaphone } from 'lucide-react'
import { useAuth } from '../../core/auth/AuthContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { Button } from '../../design-system/Button'
import { announcementAttachmentUrl, isImageAttachment, loadDemoAnnouncements, loadPendingAnnouncements, markAnnouncementSeen } from './platformAnnouncementsService'
import './platformAnnouncements.css'

// The platform owner's announcement or promotion, shown to a hospital administrator when they open the application
// (owner, 8/11/2026): the hospital administrator in production, and whoever is in a demo hospital for the ones marked
// «show in the demo too» (once per browser session, nothing recorded); one at a time. An «every visit» one comes
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
  const [queue, setQueue] = useState([])
  const demo = Boolean(user?.id && isDemo)
  const eligible = demo || Boolean(user?.id && tenant?.id && !isDemo && !isRolePreview && actualRole === 'hospital_admin')
  useEffect(() => {
    if (!eligible) return undefined
    let alive = true
    ;(demo ? loadDemoAnnouncements() : loadPendingAnnouncements(tenant.id, user.id))
      .then(list => {
        const shown = shownThisSession()
        if (alive) setQueue(list.filter(item => !shown.has(item.id)))
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [eligible, demo, tenant?.id, user?.id])
  const current = queue[0]
  if (!eligible || hold || !current) return null
  const close = () => {
    rememberShown(current.id)
    if (!demo) markAnnouncementSeen(current.id, tenant.id, user.id).catch(() => {})
    setQueue(list => list.slice(1))
  }
  return <PlatformAnnouncementDialog announcement={current} onClose={close} language={language} navigate={navigate} />
}

// The announcement itself: the gate shows it to the administrator, the owner's page as a preview.
export function PlatformAnnouncementDialog({ announcement: current, onClose: close, language, navigate }) {
  const en = language === 'en'
  const [fileUrl, setFileUrl] = useState('')
  useEffect(() => {
    let alive = true
    setFileUrl('')
    if (current.attachmentPath) announcementAttachmentUrl(current.attachmentPath).then(url => alive && setFileUrl(url)).catch(() => {})
    return () => {
      alive = false
    }
  }, [current.attachmentPath])
  const pick = (el, enText) => (en && enText ? enText : el)
  const title = pick(current.titleEl, current.titleEn)
  const image = isImageAttachment(current) ? fileUrl : current.imageUrl
  const cta = current.ctaUrl ? pick(current.ctaLabelEl, current.ctaLabelEn) || (en ? 'Learn more' : 'Δείτε περισσότερα') : ''
  const follow = () => {
    close()
    if (current.ctaUrl.startsWith('/')) navigate?.(current.ctaUrl)
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
      {image ? (
        <img className="platform-announcement-image" src={image} alt="" />
      ) : (
        <div className="platform-announcement-band" aria-hidden="true">
          <Megaphone size={22} />
        </div>
      )}
      <p className="platform-announcement-body">{pick(current.bodyEl, current.bodyEn)}</p>
      {current.attachmentPath && !isImageAttachment(current) && fileUrl && (
        <a className="platform-announcement-file" href={fileUrl} target="_blank" rel="noopener noreferrer">
          <FileText size={16} aria-hidden="true" />
          {current.attachmentName || (en ? 'Open the file' : 'Άνοιγμα αρχείου')}
        </a>
      )}
    </ObserverDialog>
  )
}
