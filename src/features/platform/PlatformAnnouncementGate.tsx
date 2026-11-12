import { Component, useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, LoaderCircle, Megaphone } from 'lucide-react'
import { useAuth } from '../../core/auth/AuthContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { Button } from '../../design-system/Button'
import { announcementAttachmentUrl, isImageAttachment, loadDemoAnnouncements, loadPendingAnnouncements, markAnnouncementSeen } from './platformAnnouncementsService'
import '../../design-system/LoadingSkeleton.css'
import './platformAnnouncements.css'
import type { AnyRecord } from '../../types/featureTypes'

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
const rememberShown = (id: string) => {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify([...shownThisSession(), id]))
  } catch {
    // Storage is a convenience: without it an «every visit» one may show again in this session.
  }
}

export function PlatformAnnouncementGate({ hold = false }: { hold?: boolean }) {
  const { user } = useAuth()
  const { tenant, actualRole, isDemo, isRolePreview } = useTenant()
  const { language } = useLanguage()
  const navigate = useNavigate()
  const [queue, setQueue] = useState<AnyRecord[]>([])
  const demo = Boolean(user?.id && isDemo)
  const eligible = demo || Boolean(user?.id && tenant?.id && !isDemo && !isRolePreview && actualRole === 'hospital_admin')
  useEffect(() => {
    if (!eligible) return undefined
    let alive = true
    ;(demo ? loadDemoAnnouncements(tenant?.id) : loadPendingAnnouncements(tenant?.id as string, user?.id as string))
      .then(list => {
        const shown = shownThisSession()
        if (alive) setQueue(list.filter((item: AnyRecord) => !shown.has(item.id)))
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
    if (!demo) markAnnouncementSeen(current.id, tenant!.id, user!.id).catch(() => {})
    setQueue(list => list.slice(1))
  }
  // In the hospital the card is large; whatever it carries (a broken image, odd text), it never stops the application.
  return (
    <AnnouncementBoundary onError={close}>
      <PlatformAnnouncementDialog announcement={current} onClose={close} language={language} navigate={navigate} large />
    </AnnouncementBoundary>
  )
}

class AnnouncementBoundary extends Component<{ onError?: () => void, children?: ReactNode }, { failed: boolean }> {
  constructor(props: { onError?: () => void, children?: ReactNode }) {
    super(props)
    this.state = { failed: false }
  }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch() {
    this.props.onError?.()
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

// The announcement itself: the gate shows it to the administrator, the owner's page as a preview.
export function PlatformAnnouncementDialog({ announcement: current, onClose: close, language, navigate, large = false }: { announcement: AnyRecord, onClose: () => void, language: string, navigate: (to: string) => void, large?: boolean }) {
  const en = language === 'en'
  // The card appears once, whole: its image and its file are fetched first (a signed link, then the picture itself), so it
  // does not show the green band, then the image, then change size. A slow or broken image never holds it for more than 6 s.
  const wantsMedia = Boolean(current.attachmentPath || current.documentPath || current.imageUrl)
  const [media, setMedia] = useState({ ready: !wantsMedia, image: '', documentUrl: '' })
  useEffect(() => {
    let alive = true
    if (!wantsMedia) {
      setMedia({ ready: true, image: '', documentUrl: '' })
      return undefined
    }
    setMedia({ ready: false, image: '', documentUrl: '' })
    const sign = (path: string) => (path ? announcementAttachmentUrl(path).catch(() => '') : Promise.resolve(''))
    const preload = (src: string) =>
      new Promise<string>(resolve => {
        if (!src) return resolve('')
        const picture = new Image()
        const done = (ok: boolean) => {
          clearTimeout(timer)
          resolve(ok ? src : '')
        }
        const timer = setTimeout(() => done(false), 6000)
        picture.onload = () => done(true)
        picture.onerror = () => done(false)
        picture.src = src
      })
    Promise.all([isImageAttachment(current) ? sign(current.attachmentPath) : Promise.resolve(current.imageUrl || ''), sign(current.documentPath)]).then(async ([imageSrc, documentSrc]) => {
      const image = await preload(imageSrc)
      if (alive) setMedia({ ready: true, image, documentUrl: documentSrc })
    })
    return () => {
      alive = false
    }
  }, [wantsMedia, current.attachmentPath, current.attachmentType, current.imageUrl, current.documentPath]) // eslint-disable-line react-hooks/exhaustive-deps
  const pick = (el: string, enText: string) => (en && enText ? enText : el)
  const title = pick(current.titleEl, current.titleEn)
  const { image, documentUrl } = media
  const ctaUrl = typeof current.ctaUrl === 'string' ? current.ctaUrl.trim() : ''
  const cta = ctaUrl ? pick(current.ctaLabelEl, current.ctaLabelEn) || (en ? 'Learn more' : 'Δείτε περισσότερα') : ''
  const follow = () => {
    close()
    if (ctaUrl.startsWith('/')) navigate?.(ctaUrl)
    else window.open(ctaUrl, '_blank', 'noopener,noreferrer')
  }
  if (!media.ready) {
    return (
      <div className="modal-backdrop observer-dialog-backdrop observer-dialog-backdrop-modal" role="status" aria-busy="true" aria-label={en ? 'Loading' : 'Φόρτωση'}>
        <LoaderCircle className="loading-spinner platform-announcement-loading" size={34} aria-hidden="true" />
      </div>
    )
  }
  return (
    <ObserverDialog
      title={title}
      eyebrow={current.kind === 'promotion' ? (en ? 'New in Limoxis' : 'Νέο στο Limoxis') : en ? 'Announcement' : 'Ανακοίνωση'}
      width={large ? 'wide' : 'compact'}
      className={`platform-announcement-dialog is-${current.kind}${large ? ' is-large' : ''}`}
      onClose={close}
      closeOnBackdrop={false}
      footer={cta ? <Button onClick={follow}>{cta}</Button> : undefined}
    >
      <div className={`platform-announcement-layout is-${image ? current.imagePosition || 'top' : 'top'}`}>
        {image ? (
          <img className="platform-announcement-image" src={image} alt="" onError={() => setMedia(current => ({ ...current, image: '' }))} />
        ) : (
          <div className="platform-announcement-band" aria-hidden="true">
            <Megaphone size={22} />
          </div>
        )}
        <div className="platform-announcement-text">
          <p className="platform-announcement-body">{pick(current.bodyEl, current.bodyEn) || ''}</p>
          {current.documentPath && documentUrl && (
            <a className="platform-announcement-file" href={documentUrl} target="_blank" rel="noopener noreferrer">
              <FileText size={16} aria-hidden="true" />
              {current.documentName || (en ? 'Open the file' : 'Άνοιγμα αρχείου')}
            </a>
          )}
        </div>
      </div>
    </ObserverDialog>
  )
}
