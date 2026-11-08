import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pause, Pencil, Play, Plus, Trash2 } from 'lucide-react'
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
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { Field } from '../../design-system/Field'
import { ManualDateField } from '../../design-system/ManualDateField'
import { ModeSwitch } from '../../design-system/ModeSwitch'
import { MultiSelect } from '../../design-system/MultiSelect'
import { PlatformLibrariesTabs } from './PlatformLibrariesTabs'
import {
  deletePlatformAnnouncement,
  loadPlatformAnnouncements,
  savePlatformAnnouncement,
  setPlatformAnnouncementStatus,
} from './platformAnnouncementsService'
import './platformAnnouncements.css'

// Settings › Announcements (owner, 8/11/2026): the platform owner's announcements and product promotions to the
// hospital administrators — which hospitals, which period, once or at every visit, and who has seen each.
const day = value => (value ? String(value).slice(0, 10) : '')
const fmt = value => (value ? new Date(value).toLocaleDateString('el-GR') : '—')
const EMPTY = { kind: 'announcement', titleEl: '', titleEn: '', bodyEl: '', bodyEn: '', ctaLabelEl: '', ctaUrl: '', imageUrl: '', startsAt: '', endsAt: '', audience: [], frequency: 'once', status: 'active' }

export function PlatformAnnouncementsPage() {
  const { user } = useAuth()
  const { memberships } = useTenant()
  const { language } = useLanguage()
  const { notify, notifyError, confirm } = useFeedback()
  const en = language === 'en'
  const tx = (elText, enText) => (en ? enText : elText)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
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
      title={tx('Ρυθμίσεις', 'Settings')}
      subtitle={tx('Ανακοινώσεις και προωθήσεις προς τους διαχειριστές των νοσοκομείων.', 'Announcements and promotions to the hospital administrators.')}
      actions={
        <Button onClick={() => setDraft({ ...EMPTY })}>
          <Plus size={15} aria-hidden="true" />
          {tx('Νέα ανακοίνωση', 'New announcement')}
        </Button>
      }
    >
      <PlatformLibrariesTabs />
      <div className="platform-registry-shell platform-announcements-page">
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
                    { id: 'toggle', label: row.status === 'active' ? tx('Διακοπή', 'Stop') : tx('Επανενεργοποίηση', 'Resume'), icon: row.status === 'active' ? Pause : Play, onClick: () => toggle(row) },
                    { id: 'delete', label: tx('Διαγραφή', 'Delete'), icon: Trash2, tone: 'danger', separatorBefore: true, onClick: () => remove(row) },
                  ]}
                />
              </td>
            </>
          )}
        />
      </div>
      {draft && (
        <ObserverDialog
          title={draft.id ? tx('Επεξεργασία ανακοίνωσης', 'Edit announcement') : tx('Νέα ανακοίνωση', 'New announcement')}
          width="wide"
          className="platform-announcement-form"
          onClose={() => setDraft(null)}
          footer={<SaveButton onClick={save} loading={saving} disabled={!valid}>{tx('Δημοσίευση', 'Publish')}</SaveButton>}
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
            <Field className="entry-span-2" label={tx('Εικόνα (προαιρετικό, https://…)', 'Image (optional, https://…)')}>
              <input value={draft.imageUrl} onChange={event => set('imageUrl', event.target.value)} />
            </Field>
          </div>
        </ObserverDialog>
      )}
    </Page>
  )
}
