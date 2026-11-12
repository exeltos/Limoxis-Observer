import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ChevronRight, Eye, Megaphone, Pause, Paperclip, Play, Plus, Save, Trash2, Wrench, X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../core/auth/AuthContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { Page } from '../../design-system/Page'
import { Button } from '../../design-system/Button'
import { RegistryTable } from '../../design-system/RegistryTable'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { StatusBadge } from '../../design-system/StatusBadge'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { FieldLabelText } from '../../design-system/FormValidation'
import { ManualDateField } from '../../design-system/ManualDateField'
import { ModeSwitch } from '../../design-system/ModeSwitch'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import { MultiSelect } from '../../design-system/MultiSelect'
import { useSortedPaging } from '../quality/useSortedPaging'
import { PlatformAnnouncementDialog } from './PlatformAnnouncementGate'
import { PlatformRecordActions } from './PlatformRecordActions'
import { getPlatformSettings, updatePlatformSettings } from './platformSettingsService'
import {
  DOCUMENT_ACCEPT,
  IMAGE_ACCEPT,
  audienceSummary,
  deletePlatformAnnouncement,
  uploadAnnouncementAttachment,
  uploadAnnouncementDocument,
  loadAnnouncementTargets,
  loadPlatformAnnouncements,
  savePlatformAnnouncement,
  setPlatformAnnouncementStatus,
} from './platformAnnouncementsService'
import './platformAnnouncements.css'
import './platformSettings.css'
import type { AnyRecord } from '../../types/featureTypes'

// Settings › Announcements (owner, 8/11/2026): the platform owner's announcements and product promotions to the
// hospital administrators — which hospitals, which period, once or at every visit, and who has seen each. The form
// opens in the page (not a window), takes an uploaded image or file, and can show the announcement in the demo too.
// (owner, 10/11/2026) The form is a record screen with Back: «Δημοσίευση» and «Προεπισκόπηση» in its header, Stop /
// Delete in its «⋯»; a row opens it (no «⋯» on the row). The maintenance message, the band over every screen, is the
// first, pinned item of the list and opens its own small editor.
const day = value => (value ? String(value).slice(0, 10) : '')
const fmt = value => (value ? new Date(value).toLocaleDateString('el-GR') : '—')
// The two shortcuts of the «Where it shows» list: every registered hospital, every demo.
const ALL_HOSPITALS = '__all_hospitals__'
const ALL_DEMOS = '__all_demos__'
const EMPTY = { kind: 'announcement', titleEl: '', titleEn: '', bodyEl: '', bodyEn: '', ctaLabelEl: '', ctaUrl: '', imageUrl: '', attachmentPath: '', attachmentName: '', attachmentType: '', imagePosition: 'top', documentPath: '', documentName: '', documentType: '', showInDemo: false, startsAt: '', endsAt: '', audience: [], frequency: 'once', status: 'active' }
const SORT = { title: (row: AnyRecord) => row.titleEl, kind: (row: AnyRecord) => row.kind, period: (row: AnyRecord) => day(row.startsAt), seen: (row: AnyRecord) => row.seenCount, status: (row: AnyRecord) => row.status }

export function PlatformAnnouncementsPage() {
  const { user } = useAuth()
  const { memberships } = useTenant()
  const { language } = useLanguage()
  const { notify, notifyError, confirm } = useFeedback()
  const en = language === 'en'
  const tx = (elText: string, enText: string) => (en ? enText : elText)
  const [rows, setRows] = useState<AnyRecord[]>([])
  const [loading, setLoading] = useState(true)
  const location = useLocation()
  // «Νέα ανακοίνωση» of the Overview's quick actions opens the form at once.
  const [draft, setDraft] = useState(() => (location.state?.newAnnouncement ? { ...EMPTY } : null))
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<AnyRecord | null>(null)
  const [settings, setSettings] = useState<AnyRecord | null>(null)
  const [maintenance, setMaintenance] = useState<AnyRecord | null>(null)
  const imageInput = useRef(null)
  const documentInput = useRef(null)
  const navigate = useNavigate()
  // Hospitals and demo hospitals together (owner, 12/11/2026): one list to choose from, a demo marked «Demo».
  const [targets, setTargets] = useState<AnyRecord[]>([])
  useEffect(() => {
    let alive = true
    loadAnnouncementTargets().then(list => alive && setTargets(list)).catch(() => {})
    return () => { alive = false }
  }, [])
  const organizations = useMemo(() => {
    const own = memberships.map(item => item.organization).filter(org => org?.id)
    const byId = new Map([...own, ...targets].map(org => [org.id, org]))
    // Hospitals first, then the demos; each group by name.
    const isDemo = (org: AnyRecord) => Boolean(org.is_demo || org.mode === 'demo')
    return [...byId.values()].sort((a, b) => Number(isDemo(a)) - Number(isDemo(b)) || String(a.name || '').localeCompare(String(b.name || ''), 'el'))
  }, [memberships, targets])
  const everyone = (item: AnyRecord) => item.allHospitals && item.showInDemo && !item.audience.length
  const orgName = (id: string) => organizations.find(org => org.id === id)?.name || id
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
  useEffect(() => {
    let active = true
    getPlatformSettings().then(value => active && setSettings(value)).catch(() => {})
    return () => { active = false }
  }, [])
  // The request is used once: a reload or a step back does not open the form again.
  useEffect(() => {
    if (location.state?.newAnnouncement) navigate(location.pathname, { replace: true, state: null })
  }, [location.state, location.pathname, navigate])
  const paging = useSortedPaging(rows, rows.length, SORT)
  const set = (key: string, value) => setDraft(current => ({ ...current, [key]: value }))
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
  async function toggle(row: AnyRecord) {
    try {
      const next = row.status === 'active' ? 'stopped' : 'active'
      await setPlatformAnnouncementStatus(row.id, next)
      setDraft(current => (current?.id === row.id ? { ...current, status: next } : current))
      await reload()
    } catch (error) {
      notifyError(error, 'save', { operation: 'platform_announcement_status' })
    }
  }
  async function remove(row: AnyRecord) {
    const ok = await confirm({
      title: tx('Διαγραφή ανακοίνωσης', 'Delete announcement'),
      message: tx('Η ανακοίνωση και το ποιοι την είδαν διαγράφονται οριστικά.', 'The announcement and who saw it are deleted for good.'),
      confirmLabel: tx('Διαγραφή', 'Delete'),
      danger: true,
    })
    if (!ok) return
    try {
      await deletePlatformAnnouncement(row.id)
      setDraft(null)
      await reload()
    } catch (error) {
      notifyError(error, 'delete', { operation: 'platform_announcement_delete' })
    }
  }
  // The image and the attached file (PDF, Word, PowerPoint, Excel) are two separate uploads.
  const upload = (upload, patch: AnyRecord) => async event => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      const uploaded = await upload(file)
      setDraft(current => ({ ...current, ...uploaded, ...patch }))
    } catch (error) {
      if ((error as Error)?.message === 'ATTACHMENT_TOO_LARGE') notify(tx('Το αρχείο ξεπερνά τα 10 MB.', 'The file is over 10 MB.'), 'warning')
      else notifyError(error, 'save', { operation: 'platform_announcement_upload' })
    } finally {
      setUploading(false)
    }
  }
  const attachImage = upload(uploadAnnouncementAttachment, { imageUrl: '' })
  const attachDocument = upload(uploadAnnouncementDocument, {})
  const edit = (row: AnyRecord) => setDraft({ ...EMPTY, ...row, startsAt: day(row.startsAt), endsAt: day(row.endsAt) })
  const openRowProps = (row: AnyRecord) => ({
    className: 'registry-row-clickable',
    tabIndex: 0,
    onClick: () => edit(row),
    onKeyDown: event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        edit(row)
      }
    },
  })

  if (maintenance) return <MaintenanceEditor settings={maintenance} language={language} onBack={() => setMaintenance(null)} onSaved={value => { setSettings(value); setMaintenance(null) }} />

  if (draft) {
    const stopped = draft.status !== 'active'
    const actions = (
      <PlatformRecordActions
        label={tx('Ενέργειες ανακοίνωσης', 'Announcement actions')}
        moreLabel={tx('Περισσότερες ενέργειες', 'More actions')}
        actions={[
          { id: 'preview', placement: 'secondary', icon: <Eye size={16} />, label: tx('Προεπισκόπηση', 'Preview'), disabled: !valid, onClick: () => setPreview(draft) },
          { id: 'publish', placement: 'primary', icon: <Save size={16} />, label: saving ? tx('Δημοσίευση…', 'Publishing…') : tx('Δημοσίευση', 'Publish'), disabled: !valid || uploading || saving, onClick: save },
          draft.id && { id: 'toggle', placement: 'menu', icon: stopped ? <Play size={16} /> : <Pause size={16} />, title: stopped ? tx('Επανενεργοποίηση', 'Resume') : tx('Διακοπή', 'Stop'), onClick: () => toggle(draft) },
          draft.id && { id: 'delete', placement: 'menu', danger: true, icon: <Trash2 size={16} />, title: tx('Διαγραφή', 'Delete'), onClick: () => remove(draft) },
        ]}
      />
    )
    return (
      <>
        <EntityRecordShell
          className="platform-owner-record-shell platform-announcement-record"
          avatar={<Megaphone size={20} />}
          eyebrow={tx('ΑΝΑΚΟΙΝΩΣΗ', 'ANNOUNCEMENT')}
          title={draft.id ? tx('Επεξεργασία ανακοίνωσης', 'Edit announcement') : tx('Νέα ανακοίνωση', 'New announcement')}
          status={draft.id ? <StatusBadge tone={stopped ? 'neutral' : 'success'}>{stopped ? tx('Σταματημένη', 'Stopped') : tx('Ενεργή', 'Active')}</StatusBadge> : null}
          headerActions={actions}
          onBack={() => setDraft(null)}
          backLabel={tx('Πίσω', 'Back')}
        >
          <div className="platform-owner-details">
            <div className="platform-announcement-editor">
              <label className="field platform-announcement-wide">
                <span className="lo-field-label"><FieldLabelText label={tx('Τίτλος', 'Title')} required /></span>
                <input value={draft.titleEl} onChange={event => set('titleEl', event.target.value)} />
              </label>
              <label className="field platform-announcement-wide">
                <span className="lo-field-label"><FieldLabelText label={tx('Κείμενο', 'Text')} required /></span>
                <textarea rows="3" value={draft.bodyEl} onChange={event => set('bodyEl', event.target.value)} />
              </label>
              <div className="field">
                <span className="lo-field-label">{tx('Είδος', 'Type')}</span>
                <ModeSwitch
                  ariaLabel={tx('Είδος', 'Type')}
                  value={draft.kind}
                  onChange={value => set('kind', value)}
                  options={[{ value: 'announcement', label: tx('Ανακοίνωση', 'Announcement') }, { value: 'promotion', label: tx('Προώθηση', 'Promotion') }]}
                />
              </div>
              <div className="field">
                <span className="lo-field-label">{tx('Εμφάνιση', 'Show')}</span>
                <ModeSwitch
                  ariaLabel={tx('Εμφάνιση', 'Show')}
                  value={draft.frequency}
                  onChange={value => set('frequency', value)}
                  options={[{ value: 'once', label: tx('Μία φορά', 'Once') }, { value: 'every_visit', label: tx('Σε κάθε είσοδο', 'Every visit') }]}
                />
              </div>
              <ManualDateField label={tx('Από', 'From')} value={draft.startsAt} onChange={value => set('startsAt', value)} optional />
              <ManualDateField label={tx('Έως', 'Until')} value={draft.endsAt} onChange={value => set('endsAt', value)} optional error={draft.endsAt && draft.startsAt && draft.endsAt < draft.startsAt ? tx('Η λήξη είναι πριν την έναρξη.', 'The end is before the start.') : ''} />
              <div className="platform-announcement-wide">
                <MultiSelect
                  label={tx('Πού εμφανίζεται', 'Where it shows')}
                  tags
                  options={[
                    { value: ALL_HOSPITALS, label: tx('Όλα τα νοσοκομεία (εγγεγραμμένα)', 'Every registered hospital') },
                    { value: ALL_DEMOS, label: tx('Όλα τα demo', 'Every demo') },
                    ...organizations.map(org => ({ value: org.id, label: (org.is_demo || org.mode === 'demo') ? `${org.name} · Demo` : org.name })),
                  ]}
                  selected={everyone(draft) ? [] : [...(draft.allHospitals ? [ALL_HOSPITALS] : []), ...(draft.showInDemo ? [ALL_DEMOS] : []), ...draft.audience]}
                  onChange={value => {
                    set('allHospitals', value.includes(ALL_HOSPITALS))
                    set('showInDemo', value.includes(ALL_DEMOS))
                    set('audience', value.filter(id => id !== ALL_HOSPITALS && id !== ALL_DEMOS))
                  }}
                  placeholder={tx('Όλα τα νοσοκομεία και τα demo', 'Every hospital and demo')}
                  hint={tx('Κενό = όλα τα νοσοκομεία και όλα τα demo.', 'Empty = every hospital and every demo.')}
                />
              </div>
              <label className="field">
                <span className="lo-field-label"><FieldLabelText label={tx('Κουμπί', 'Button')} optional optionalLabel={tx('Προαιρετικό', 'Optional')} /></span>
                <input value={draft.ctaLabelEl} placeholder={tx('Δείτε περισσότερα', 'Learn more')} onChange={event => set('ctaLabelEl', event.target.value)} />
              </label>
              <label className="field">
                <span className="lo-field-label">{tx('Σύνδεσμος κουμπιού', 'Button link')}</span>
                <input value={draft.ctaUrl} placeholder={tx('π.χ. /about ή https://…', 'e.g. /about or https://…')} onChange={event => set('ctaUrl', event.target.value)} />
              </label>
              <div className="field">
                <span className="lo-field-label"><FieldLabelText label={tx('Εικόνα', 'Image')} optional optionalLabel={tx('Προαιρετικό · έως 10 MB', 'Optional · up to 10 MB')} /></span>
                <div className="platform-announcement-upload">
                  {draft.attachmentPath || draft.imageUrl ? (
                    <span className="platform-announcement-attached">
                      <Paperclip size={15} aria-hidden="true" />
                      {draft.attachmentName || draft.imageUrl}
                      <button type="button" aria-label={tx('Αφαίρεση εικόνας', 'Remove the image')} onClick={() => setDraft(current => ({ ...current, attachmentPath: '', attachmentName: '', attachmentType: '', imageUrl: '' }))}>
                        <X size={14} aria-hidden="true" />
                      </button>
                    </span>
                  ) : (
                    <>
                      <Button variant="secondary" className="platform-announcement-pick" disabled={uploading} onClick={() => imageInput.current?.click()}>
                        <Paperclip size={15} aria-hidden="true" />
                        {uploading ? tx('Ανέβασμα…', 'Uploading…') : tx('Ανέβασμα εικόνας', 'Upload an image')}
                      </Button>
                      <input ref={imageInput} className="platform-announcement-file-input" type="file" accept={IMAGE_ACCEPT} tabIndex={-1} aria-hidden="true" onChange={attachImage} />
                    </>
                  )}
                </div>
              </div>
              <SearchableSelect
                label={tx('Θέση εικόνας', 'Image position')}
                value={draft.imagePosition}
                onChange={value => set('imagePosition', value || 'top')}
                options={[
                  { value: 'top', label: tx('Πάνω από το κείμενο', 'Above the text') },
                  { value: 'left', label: tx('Αριστερά του κειμένου', 'Left of the text') },
                  { value: 'right', label: tx('Δεξιά του κειμένου', 'Right of the text') },
                  { value: 'bottom', label: tx('Κάτω από το κείμενο', 'Below the text') },
                ]}
              />
              <div className="field platform-announcement-wide">
                <span className="lo-field-label"><FieldLabelText label={tx('Συνημμένο αρχείο', 'Attached file')} optional optionalLabel={tx('Προαιρετικό · PDF, Word, PowerPoint, Excel · έως 10 MB', 'Optional · PDF, Word, PowerPoint, Excel · up to 10 MB')} /></span>
                <div className="platform-announcement-upload">
                  {draft.documentPath ? (
                    <span className="platform-announcement-attached">
                      <Paperclip size={15} aria-hidden="true" />
                      {draft.documentName}
                      <button type="button" aria-label={tx('Αφαίρεση αρχείου', 'Remove the file')} onClick={() => setDraft(current => ({ ...current, documentPath: '', documentName: '', documentType: '' }))}>
                        <X size={14} aria-hidden="true" />
                      </button>
                    </span>
                  ) : (
                    <>
                      <Button variant="secondary" className="platform-announcement-pick" disabled={uploading} onClick={() => documentInput.current?.click()}>
                        <Paperclip size={15} aria-hidden="true" />
                        {uploading ? tx('Ανέβασμα…', 'Uploading…') : tx('Επισύναψη αρχείου', 'Attach a file')}
                      </Button>
                      <input ref={documentInput} className="platform-announcement-file-input" type="file" accept={DOCUMENT_ACCEPT} tabIndex={-1} aria-hidden="true" onChange={attachDocument} />
                    </>
                  )}
                  <small>{tx('Στην ανακοίνωση εμφανίζεται ως σύνδεσμος που ανοίγει σε νέα καρτέλα.', 'It shows in the announcement as a link that opens in a new tab.')}</small>
                </div>
              </div>
            </div>
          </div>
        </EntityRecordShell>
        {preview && <PlatformAnnouncementDialog announcement={preview} onClose={() => setPreview(null)} language={language} navigate={navigate} large />}
      </>
    )
  }

  const columns = [
    { key: 'title', label: tx('Τίτλος', 'Title'), sortable: true },
    { key: 'kind', label: tx('Είδος', 'Type'), sortable: true },
    { key: 'period', label: tx('Περίοδος', 'Period'), sortable: true },
    { key: 'audience', label: tx('Πού εμφανίζεται', 'Where it shows') },
    { key: 'seen', label: tx('Το είδαν', 'Seen by'), sortable: true },
    { key: 'status', label: tx('Κατάσταση', 'Status'), sortable: true },
  ]
  const noticeOn = Boolean(settings?.maintenanceNoticeEnabled)
  return (
    <Page
      title={tx('Ανακοινώσεις', 'Announcements')}
      actions={
        <Button onClick={() => setDraft({ ...EMPTY })}>
          <Plus size={15} aria-hidden="true" />
          {tx('Νέα ανακοίνωση', 'New announcement')}
        </Button>
      }
    >
      <div className="platform-registry-shell platform-announcements-page workspace-column">
        <button type="button" className="platform-maintenance-item" disabled={!settings} onClick={() => setMaintenance(settings)}>
          <span className="platform-maintenance-item-icon" aria-hidden="true"><Wrench size={16} /></span>
          <span className="platform-maintenance-item-copy">
            <strong>{tx('Μήνυμα συντήρησης', 'Maintenance message')}</strong>
            <small>{tx('Λωρίδα πάνω σε όλες τις οθόνες', 'A band over every screen')}</small>
          </span>
          <StatusBadge tone={noticeOn ? 'warning' : 'neutral'}>{noticeOn ? tx('Ενεργό', 'On') : tx('Ανενεργό', 'Off')}</StatusBadge>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
        <div className="platform-center-section platform-registry-card workspace-column">
          <RegistryTable
            columns={columns}
            rows={paging.rows}
            sort={paging.sort}
            onSort={paging.onSort}
            rowKey={row => row.id}
            loading={loading}
            emptyTitle={tx('Δεν υπάρχουν ανακοινώσεις', 'No announcements')}
            emptyText={tx('Η «Νέα ανακοίνωση» εμφανίζεται στους διαχειριστές μόλις ανοίξουν την εφαρμογή.', '«New announcement» is shown to the administrators when they open the application.')}
            rowProps={openRowProps}
            renderRow={row => (
              <>
                <td><strong>{en && row.titleEn ? row.titleEn : row.titleEl}</strong></td>
                <td>{row.kind === 'promotion' ? tx('Προώθηση', 'Promotion') : tx('Ανακοίνωση', 'Announcement')}</td>
                <td className="platform-announcement-period">{fmt(row.startsAt)} – {row.endsAt ? fmt(row.endsAt) : tx('χωρίς λήξη', 'no end')}</td>
                <td className="platform-announcement-audience">{audienceSummary(row, orgName, tx)}</td>
                <td>{row.seenCount}</td>
                <td>
                  <StatusBadge tone={row.status === 'active' ? 'success' : 'neutral'}>{row.status === 'active' ? tx('Ενεργή', 'Active') : tx('Σταματημένη', 'Stopped')}</StatusBadge>
                </td>
              </>
            )}
          />
          <RegistryPagination language={language} {...paging.props} />
        </div>
      </div>
    </Page>
  )
}

// The maintenance message (platform_settings): on / off, the language being written and the text, with the band as it
// will show. A single language is enough; without a translation the available text is shown.
function MaintenanceEditor({ settings, language, onBack, onSaved }) {
  const en = language === 'en'
  const tx = (elText: string, enText: string) => (en ? enText : elText)
  const { notify, notifyError } = useFeedback()
  const [draft, setDraft] = useState(settings)
  const [noticeLanguage, setNoticeLanguage] = useState(() => (en ? (settings.maintenanceNoticeEn || !settings.maintenanceNoticeEl ? 'en' : 'el') : (settings.maintenanceNoticeEl || !settings.maintenanceNoticeEn ? 'el' : 'en')))
  const [saving, setSaving] = useState(false)
  const key = noticeLanguage === 'en' ? 'maintenanceNoticeEn' : 'maintenanceNoticeEl'
  const text = draft[key] || ''
  const shown = text.trim() || (noticeLanguage === 'en' ? draft.maintenanceNoticeEl : draft.maintenanceNoticeEn) || ''
  const valid = !draft.maintenanceNoticeEnabled || Boolean(String(draft.maintenanceNoticeEl || '').trim() || String(draft.maintenanceNoticeEn || '').trim())
  async function save() {
    if (!valid || saving) return
    setSaving(true)
    try {
      const value = await updatePlatformSettings(draft)
      notify(tx('Το μήνυμα συντήρησης αποθηκεύτηκε.', 'The maintenance message was saved.'), 'success', { operation: 'platform_settings_update' })
      onSaved(value)
    } catch (error) {
      notifyError(error, 'save', { operation: 'platform_settings_update' })
    } finally {
      setSaving(false)
    }
  }
  const actions = (
    <PlatformRecordActions
      label={tx('Ενέργειες', 'Actions')}
      actions={[{ id: 'save', placement: 'primary', icon: <Save size={16} />, label: saving ? tx('Αποθήκευση…', 'Saving…') : tx('Αποθήκευση', 'Save'), disabled: !valid || saving, onClick: save }]}
    />
  )
  return (
    <EntityRecordShell
      className="platform-owner-record-shell platform-announcement-record"
      avatar={<Wrench size={20} />}
      eyebrow={tx('ΑΝΑΚΟΙΝΩΣΕΙΣ', 'ANNOUNCEMENTS')}
      title={tx('Μήνυμα συντήρησης', 'Maintenance message')}
      status={<StatusBadge tone={draft.maintenanceNoticeEnabled ? 'warning' : 'neutral'}>{draft.maintenanceNoticeEnabled ? tx('Ενεργό', 'On') : tx('Ανενεργό', 'Off')}</StatusBadge>}
      headerActions={actions}
      onBack={onBack}
      backLabel={tx('Πίσω', 'Back')}
    >
      <div className="platform-owner-details">
        <div className="platform-announcement-editor">
          <div className="field">
            <span className="lo-field-label">{tx('Κατάσταση', 'Status')}</span>
            <ModeSwitch
              ariaLabel={tx('Κατάσταση', 'Status')}
              value={draft.maintenanceNoticeEnabled ? 'on' : 'off'}
              onChange={value => setDraft(current => ({ ...current, maintenanceNoticeEnabled: value === 'on' }))}
              options={[{ value: 'off', label: tx('Ανενεργό', 'Off') }, { value: 'on', label: tx('Ενεργό', 'On') }]}
            />
          </div>
          <div className="field">
            <span className="lo-field-label">{tx('Γλώσσα κειμένου', 'Text language')}</span>
            <ModeSwitch
              ariaLabel={tx('Γλώσσα κειμένου', 'Text language')}
              value={noticeLanguage}
              onChange={setNoticeLanguage}
              options={[{ value: 'el', label: 'Ελληνικά' }, { value: 'en', label: 'English' }]}
            />
          </div>
          <label className="field platform-announcement-wide">
            <span className="lo-field-label">{tx('Μήνυμα', 'Message')}</span>
            <textarea rows="4" value={text} onChange={event => setDraft(current => ({ ...current, [key]: event.target.value }))} placeholder={noticeLanguage === 'en' ? 'Type the maintenance message…' : 'Γράψτε το μήνυμα συντήρησης…'} />
            <small className={valid ? 'field-hint' : 'field-error'}>{valid ? tx('Αρκεί μία γλώσσα· χωρίς μετάφραση εμφανίζεται το διαθέσιμο κείμενο.', 'One language is enough; without a translation the available text is shown.') : tx('Για ενεργό μήνυμα χρειάζεται κείμενο σε μία γλώσσα τουλάχιστον.', 'An active message needs text in at least one language.')}</small>
          </label>
          <div className="field platform-announcement-wide">
            <span className="lo-field-label">{tx('Προεπισκόπηση', 'Preview')}</span>
            {shown.trim()
              ? <div className="platform-maintenance-banner platform-settings-preview-banner"><AlertTriangle size={16} /><span>{shown}</span></div>
              : <div className="platform-settings-preview-empty">{tx('Γράψτε μήνυμα για να δείτε πώς θα εμφανιστεί.', 'Type a message to see how it will show.')}</div>}
          </div>
        </div>
      </div>
    </EntityRecordShell>
  )
}
