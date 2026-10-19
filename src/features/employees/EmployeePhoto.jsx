import { useEffect, useMemo, useRef, useState } from 'react'
import { Camera, ImagePlus, Trash2, UserRound } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import {
  PHOTO_ACCEPT,
  employeeInitials,
  employeePhotoUrls,
  removeEmployeePhoto,
  uploadEmployeePhoto,
  validatePhotoFile,
} from './employeePhotoService'
import './employeePhoto.css'

// Signed URLs for the photos of the given employees (one request per batch).
export function useEmployeePhotoUrls(rows) {
  const key = useMemo(() => [...new Set((rows || []).map(row => row?.photoPath).filter(Boolean))].sort().join('|'), [rows])
  const [urls, setUrls] = useState({})
  useEffect(() => {
    if (!key) return undefined
    let active = true
    employeePhotoUrls(key.split('|'))
      .then(next => { if (active) setUrls(current => ({ ...current, ...next })) })
      .catch(() => {})
    return () => { active = false }
  }, [key])
  return urls
}

// The employee's photo, or their initials when there is none (or it cannot load).
export function EmployeeAvatar({ employee, url, size = 'sm', className = '' }) {
  const { t, language } = useLanguage()
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [url])
  const initials = employeeInitials(employee, language)
  const name = language === 'el'
    ? `${employee?.lastName || ''} ${employee?.firstName || ''}`.trim()
    : `${employee?.firstNameEn || employee?.firstName || ''} ${employee?.lastNameEn || employee?.lastName || ''}`.trim()
  const showPhoto = Boolean(url) && !failed
  return <span className={`employee-avatar employee-avatar-${size}${showPhoto ? ' has-photo' : ''} ${className}`.trim()} aria-hidden={showPhoto ? undefined : true}>
    {showPhoto
      ? <img src={url} alt={t('employeePhoto.alt').replace('{name}', name)} loading="lazy" decoding="async" onError={() => setFailed(true)}/>
      : initials || <UserRound size={size === 'lg' ? 20 : 14}/>}
  </span>
}

// Record header avatar. Whoever may edit the employee opens the photo window from it.
export function EmployeeHeaderPhoto({ employee, organizationId, canEdit = false, onChange }) {
  const { t } = useLanguage()
  const urls = useEmployeePhotoUrls(useMemo(() => [employee], [employee]))
  const url = employee?.photoPath ? urls[employee.photoPath] : ''
  const [open, setOpen] = useState(false)
  const avatar = <EmployeeAvatar employee={employee} url={url} size="lg"/>
  if (!canEdit) return avatar
  return <>
    <button type="button" className="employee-photo-trigger" aria-label={t('employeePhoto.change')} title={t('employeePhoto.change')} onClick={() => setOpen(true)}>
      {avatar}
      <span className="employee-photo-trigger-badge" aria-hidden="true"><Camera size={11}/></span>
    </button>
    {open && <EmployeePhotoDialog employee={employee} url={url} organizationId={organizationId} onClose={() => setOpen(false)} onChange={onChange}/>}
  </>
}

export function EmployeePhotoDialog({ employee, url, organizationId, onClose, onChange }) {
  const { t } = useLanguage()
  const { notify, confirm } = useFeedback()
  const fileRef = useRef(null)
  const [busy, setBusy] = useState('')
  const hasPhoto = Boolean(employee?.photoPath)

  function errorText(error) {
    const code = String(error?.message || '')
    if (code === 'PHOTO_TYPE') return t('employeePhoto.typeError')
    if (code === 'PHOTO_TOO_LARGE') return t('employeePhoto.sizeError')
    return t('employeePhoto.saveFailed')
  }

  async function pick(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const invalid = validatePhotoFile(file)
    if (invalid) { notify(errorText(new Error(invalid)), 'error'); return }
    setBusy('upload')
    try {
      const next = await uploadEmployeePhoto(organizationId, employee, file)
      onChange?.(next)
      notify(t('employeePhoto.saved'), 'success')
      onClose?.()
    } catch (error) {
      notify(errorText(error), 'error')
    } finally {
      setBusy('')
    }
  }

  async function remove() {
    const ok = await confirm({ title: t('employeePhoto.remove'), message: t('employeePhoto.confirmRemove'), confirmLabel: t('employeePhoto.remove'), danger: true })
    if (!ok) return
    setBusy('remove')
    try {
      const next = await removeEmployeePhoto(organizationId, employee)
      onChange?.(next)
      notify(t('employeePhoto.removed'), 'success')
      onClose?.()
    } catch (error) {
      notify(errorText(error), 'error')
    } finally {
      setBusy('')
    }
  }

  return <ObserverDialog width="compact" title={t('employeePhoto.title')} subtitle={t('employeePhoto.visibility')} onClose={onClose} className="employee-photo-dialog"
    footer={<>
      {hasPhoto && <Button variant="secondary" onClick={() => void remove()} loading={busy === 'remove'} disabled={Boolean(busy)}><Trash2 size={15}/>{t('employeePhoto.remove')}</Button>}
      <Button onClick={() => fileRef.current?.click()} loading={busy === 'upload'} disabled={Boolean(busy)}><ImagePlus size={15}/>{hasPhoto ? t('employeePhoto.replace') : t('employeePhoto.choose')}</Button>
    </>}>
    <div className="employee-photo-dialog-body">
      <EmployeeAvatar employee={employee} url={url} size="xl"/>
      <p>{hasPhoto ? t('employeePhoto.hint') : `${t('employeePhoto.none')} ${t('employeePhoto.hint')}`}</p>
      <input ref={fileRef} type="file" accept={PHOTO_ACCEPT} hidden onChange={event => void pick(event)} data-testid="employee-photo-input"/>
    </div>
  </ObserverDialog>
}
