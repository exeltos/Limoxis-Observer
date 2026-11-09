import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Eye, Pause, Paperclip, Pencil, Play, Plus, Trash2, X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../core/auth/AuthContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { Page } from '../../design-system/Page'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { RegistryTable } from '../../design-system/RegistryTable'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { StatusBadge } from '../../design-system/StatusBadge'
import { InlineDialogContext, ObserverDialog } from '../../design-system/ObserverDialog'
import { Field } from '../../design-system/Field'
import { CheckboxField } from '../../design-system/CheckboxField'
import { ManualDateField } from '../../design-system/ManualDateField'
import { ModeSwitch } from '../../design-system/ModeSwitch'
import { MultiSelect } from '../../design-system/MultiSelect'
import { PlatformAnnouncementDialog } from './PlatformAnnouncementGate'
import {
  ATTACHMENT_ACCEPT,
  deletePlatformAnnouncement,
  uploadAnnouncementAttachment,
  loadPlatformAnnouncements,
  savePlatformAnnouncement,
  setPlatformAnnouncementStatus,
} from './platformAnnouncementsService'
import './platformAnnouncements.css'

// Settings › Announcements (owner, 8/11/2026): the platform owner's announcements and product promotions to the
// hospital administrators — which hospitals, which period, once or at every visit, and who has seen each. The form
// opens in the page (not a window), takes an uploaded image or file, and can show the announcement in the demo too.
const day = value => (value ? String(value).slice(0, 10) : '')
const fmt = value => (value ? new Date(value).toLocaleDateString('el-GR') : '—')
const EMPTY = { kind: 'announcement', titleEl: '', titleEn: '', bodyEl: '', bodyEn: '', ctaLabelEl: '', ctaUrl: '', imageUrl: '', attachmentPath: '', attachmentName: '', attachmentType: '', showInDemo: false, startsAt: '', endsAt: '', audience: [], frequency: 'once', status: 'active' }

export function PlatformAnnouncementsPage() {
  const { user } = useAuth()
  const { memberships } = useTenant()
  const { language } = useLanguage()
  const { notify, notifyError, confirm } = useFeedback()
  const en = language === 'en'
  const tx = (elText, enText) => (en ? enText : elText)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const location = useLocation()
  // «Νέα ανακοίνωση» of the Overview's quick actions opens the form at once.
  const [draft, setDraft] = useState(() => (location.state?.newAnnouncement ? { ...EMPTY } : null))
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(null)
  const fileInput = useRef(null)
  const navigate = useNavigate()
  const organizations = useMemo(
    () => memberships.map(item => item.organization).filter(org => org?.id && org.mode !== 'demo'),
    [memberships],
  )
  const orgName = id => organizations.find(org => org.id === id)?.name || id
  const reload = useCallback(() => {
    setLoading(true)
    return loadPlatformAnnouncements()
      .then(setRows)
      .catch(error => notifyError(error, 'load', { operation: 'platform_announcements_load' }))
      .finally(() => setLoading(false))
  }, [notifyError])
  useEffect(() => {
    void reload()
  }, [reload])
  // The request is used once: a reload or a step back does not open the form again.
  useEffect(() => {
    if (location.state?.newAnnouncement) navigate(location.pathname, { replace: true, state: null })
  }, [location.state, location.pathname, navigate])
  const set = (key, value) => setDraft(current => ({ ...current, [key]: value }))
  const valid = draft && draft.titleEl.trim() && draft.bodyEl.trim() && (!draft.endsAt || !draft.startsAt || draft.endsAt >= draft.startsAt)
  async function save() {
    if (!valid) return
    setSaving(true)
    try {
      await savePlatformAnnouncement(draft, user?.id)
      notify(tx('Η ανακοίνωση αποθηκεύτηκε.', 'The announcement was saved.'), 'success')
      setDraft(null)
      await reload()
    } catch (error) {
      notifyError(error, 'save', { operation: 'platform_announcement_save' })
    } finally {
      setSaving(false)
    }
  }
  async function toggle(row) {
    try {
      await setPlatformAnnouncementStatus(row.id, row.status === 'active' ? 'stopped' : 'active')
      await reload()
    } catch (error) {
      notifyError(error, 'save', { operation: 'platform_announcement_status' })
    }
  }
  async function remove(row) {
    const ok = await confirm({
      title: tx('Διαγραφή ανακοίνωσης', 'Delete announcement'),
      message: tx('Η ανακοίνωση και το ποιοι την είδαν διαγράφονται οριστικά.', 'The announcement and who saw it are deleted for good.'),
      confirmLabel: tx('Διαγραφή', 'Delete'),
      danger: true,
    })
    if (!ok) return
    try {
      await deletePlatformAnnouncement(row.id)
      await reload()
    } catch (error) {
      notifyError(error, 'delete', { operation: 'platform_announcement_delete' })
    }
  }
  async function attach(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      const uploaded = await uploadAnnouncementAttachment(file)
      setDraft(current => ({ ...current, ...uploaded, imageUrl: '' }))
    } catch (error) {
      if (error?.message === 'ATTACHMENT_TOO_LARGE') notify(tx('Το αρχείο ξεπερνά τα 10 MB.', 'The file is over 10 MB.'), 'warning')
      else notifyError(error, 'save', { operation: 'platform_announcement_upload' })
    } finally {
      setUploading(false)
    }
  }
  const edit = row => setDraft({ ...EMPTY, ...row, startsAt: day(row.startsAt), endsAt: day(row.endsAt) })
  const columns = [
    { key: 'title', label: tx('Τίτλος', 'Title') },
    { key: 'kind', label: tx('Είδος', 'Type') },
    { key: 'period', label: tx('Περίοδος', 'Period') },
    { key: 'audience', label: tx('Νοσοκομεία', 'Hospitals') },
    { key: 'seen', label: tx('Το είδαν', 'Seen by') },
    { key: 'status', label: tx('Κατάσταση', 'Status') },
    { key: 'menu', label: '' },
  ]
  return (
    <Page
      title={tx('Ανακοινώσεις', 'Announcements')}
      actions={
        !draft && (
          <Button onClick={() => setDraft({ ...EMPTY })}>
            <Plus size={15} aria-hidden="true" />
            {tx('Νέα ανακοίνωση', 'New announcement')}
          </Button>
        )
      }
    >
      {!draft && <div className="platform-registry-shell platform-announcements-page">
        <RegistryTable
          columns={columns}
          rows={rows}
          rowKey={row => row.id}
          emptyTitle={loading ? tx('Φόρτωση…', 'Loading…') : tx('Δεν υπάρχουν ανακοινώσεις', 'No announcements')}
          emptyText={loading ? '' : tx('Η «Νέα ανακοίνωση» εμφανίζεται στους διαχειριστές μόλις ανοίξουν την εφαρμογή.', '«New announcement» is shown to the administrators when they open the application.')}
          rowProps={row => ({ className: 'clickable-row', onClick: event => !event.target.closest('button') && edit(row) })}
          renderRow={row => (
            <>
              <td><strong>{en && row.titleEn ? row.titleEn : row.titleEl}</strong></td>
              <td>{row.kind === 'promotion' ? tx('Προώθηση', 'Promotion') : tx('Ανακοίνωση', 'Announcement')}</td>
              <td className="platform-announcement-period">{fmt(row.startsAt)} – {row.endsAt ? fmt(row.endsAt) : tx('χωρίς λήξη', 'no end')}</td>
              <td className="platform-announcement-audience">{row.audience.length ? row.audience.map(orgName).join(', ') : tx('Όλα', 'All')}</td>
              <td>{row.seenCount}</td>
              <td>
                <StatusBadge tone={row.status === 'active' ? 'success' : 'neutral'}>{row.status === 'active' ? tx('Ενεργή', 'Active') : tx('Σταματημένη', 'Stopped')}</StatusBadge>
              </td>
              <td className="open-record-cell">
                <OverflowMenu
                  label={tx('Ενέργειες', 'Actions')}
                  items={[
                    { id: 'edit', label: tx('Επεξεργασία', 'Edit'), icon: Pencil, onClick: () => edit(row) },
                    { id: 'preview', label: tx('Προεπισκόπηση', 'Preview'), icon: Eye, onClick: () => setPreview(row) },
                    { id: 'toggle', label: row.status === 'active' ? tx('Διακοπή', 'Stop') : tx('Επανενεργοποίηση', 'Resume'), icon: row.status === 'active' ? Pause : Play, onClick: () => toggle(row) },
                    { id: 'delete', label: tx('Διαγραφή', 'Delete'), icon: Trash2, tone: 'danger', separatorBefore: true, onClick: () => remove(row) },
                  ]}
                />
              </td>
            </>
          )}
        />
      </div>}
      {draft && (
        <InlineDialogContext.Provider value>
        <ObserverDialog
          title={draft.id ? tx('Επεξεργασία ανακοίνωσης', 'Edit announcement') : tx('Νέα ανακοίνωση', 'New announcement')}
          width="wide"
          className="platform-announcement-form"
          onClose={() => setDraft(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setPreview(draft)} disabled={!valid}>
                <Eye size={15} aria-hidden="true" />
                {tx('Προεπισκόπηση', 'Preview')}
              </Button>
              <SaveButton onClick={save} loading={saving} disabled={!valid || uploading}>{tx('Δημοσίευση', 'Publish')}</SaveButton>
            </>
          }
        >
          <div className="entry-grid">
            <Field className="entry-span-2" label={tx('Τίτλος', 'Title')} required>
              <input value={draft.titleEl} onChange={event => set('titleEl', event.target.value)} />
            </Field>
            <Field className="entry-span-2" label={tx('Κείμενο', 'Text')} required>
              <textarea rows="3" value={draft.bodyEl} onChange={event => set('bodyEl', event.target.value)} />
            </Field>
            <Field label={tx('Είδος', 'Type')}>
              <ModeSwitch
                ariaLabel={tx('Είδος', 'Type')}
                value={draft.kind}
                onChange={value => set('kind', value)}
                options={[{ value: 'announcement', label: tx('Ανακοίνωση', 'Announcement') }, { value: 'promotion', label: tx('Προώθηση', 'Promotion') }]}
              />
            </Field>
            <Field label={tx('Εμφάνιση', 'Show')}>
              <ModeSwitch
                ariaLabel={tx('Εμφάνιση', 'Show')}
                value={draft.frequency}
                onChange={value => set('frequency', value)}
                options={[{ value: 'once', label: tx('Μία φορά', 'Once') }, { value: 'every_visit', label: tx('Σε κάθε είσοδο', 'Every visit') }]}
              />
            </Field>
            <ManualDateField label={tx('Από', 'From')} value={draft.startsAt} onChange={value => set('startsAt', value)} optional />
            <ManualDateField label={tx('Έως', 'Until')} value={draft.endsAt} onChange={value => set('endsAt', value)} optional />
            <div className="entry-span-2">
              <MultiSelect
                label={tx('Νοσοκομεία (κενό = όλα)', 'Hospitals (empty = all)')}
                tags
                options={organizations.map(org => ({ value: org.id, label: org.name }))}
                selected={draft.audience}
                onChange={value => set('audience', value)}
                placeholder={tx('Όλα τα νοσοκομεία', 'Every hospital')}
              />
            </div>
            <Field label={tx('Κουμπί (προαιρετικό)', 'Button (optional)')}>
              <input value={draft.ctaLabelEl} placeholder={tx('Δείτε περισσότερα', 'Learn more')} onChange={event => set('ctaLabelEl', event.target.value)} />
            </Field>
            <Field label={tx('Σύνδεσμος κουμπιού', 'Button link')} hint={tx('π.χ. /about ή https://…', 'e.g. /about or https://…')}>
              <input value={draft.ctaUrl} onChange={event => set('ctaUrl', event.target.value)} />
            </Field>
            <Field className="entry-span-2" label={tx('Εικόνα ή αρχείο (προαιρετικό)', 'Image or file (optional)')} hint={tx('Εικόνα, PDF, Word, PowerPoint ή Excel έως 10 MB. Η εικόνα εμφανίζεται στην ανακοίνωση· το αρχείο ως σύνδεσμος.', 'Image, PDF, Word, PowerPoint or Excel up to 10 MB. An image shows in the announcement; a file as a link.')}>
              <div className="platform-announcement-upload">
                {draft.attachmentPath || draft.imageUrl ? (
                  <span className="platform-announcement-attached">
                    <Paperclip size={15} aria-hidden="true" />
                    {draft.attachmentName || draft.imageUrl}
                    <button type="button" aria-label={tx('Αφαίρεση', 'Remove')} onClick={() => setDraft(current => ({ ...current, attachmentPath: '', attachmentName: '', attachmentType: '', imageUrl: '' }))}>
                      <X size={14} aria-hidden="true" />
                    </button>
                  </span>
                ) : (
                  <>
                    <Button variant="secondary" className="platform-announcement-pick" disabled={uploading} onClick={() => fileInput.current?.click()}>
                      <Paperclip size={15} aria-hidden="true" />
                      {uploading ? tx('Ανέβασμα…', 'Uploading…') : tx('Ανέβασμα εικόνας ή αρχείου', 'Upload an image or file')}
                    </Button>
                    <input ref={fileInput} className="platform-announcement-file-input" type="file" accept={ATTACHMENT_ACCEPT} tabIndex={-1} aria-hidden="true" onChange={attach} />
                  </>
                )}
              </div>
            </Field>
            <CheckboxField
              className="entry-span-2"
              label={tx('Εμφάνιση και στο demo (σε όποιον μπαίνει στα demo νοσοκομεία)', 'Show in the demo too (to whoever opens the demo hospitals)')}
              checked={draft.showInDemo}
              onChange={value => set('showInDemo', value)}
            />
          </div>
        </ObserverDialog>
        </InlineDialogContext.Provider>
      )}
      {preview && <PlatformAnnouncementDialog announcement={preview} onClose={() => setPreview(null)} language={language} navigate={navigate} large />}
    </Page>
  )
}
