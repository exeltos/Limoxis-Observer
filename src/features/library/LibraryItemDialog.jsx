import { useState } from 'react'
import { Archive, RotateCcw } from 'lucide-react'
import { ObserverDialog, DialogActions } from '../../design-system/ObserverDialog'
import { Field } from '../../design-system/Field'
import { ChoiceField } from '../../design-system/ChoiceField'
import { ChoiceChips } from '../../design-system/ChoiceChips'
import { CheckboxField } from '../../design-system/CheckboxField'
import { ManualDateField } from '../../design-system/ManualDateField'
import { Button } from '../../design-system/Button'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { LIBRARY_TOPICS, LINK_GROUPS } from './libraryCatalogue'
import { DESCRIPTION_LIMIT, EXCERPT_LIMIT, HOSPITAL_KINDS, INTERVALS, PLATFORM_KINDS, blankDraft, errorText, initials, intervalLabel, kindLabel, logoTone, validateDraft } from './libraryModel'
import { saveAnnouncement, saveItem, saveSource, setItemStatus } from './libraryService'

const ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp'
const MAX_FILE = 10 * 1024 * 1024

// «Διαχείριση βιβλιοθήκης»: add or edit one entry. scope 'platform' (Platform
// Owner: what every hospital sees) or 'hospital' (Hospital Admin / Quality
// Manager: only their hospital). `item` is an existing entry (a library item,
// a news source or an announcement), or null for a new one of `kind`.
export function LibraryItemDialog({ scope, organizationId = null, item = null, kind = 'link', source = null, language, onClose, onSaved }) {
  const en = language === 'en'
  const L = (el, english) => (en ? english : el)
  const { notify, notifyError, confirm } = useFeedback()
  const platform = scope === 'platform'
  const [draft, setDraft] = useState(() => {
    const base = blankDraft(item?.kind || kind, scope)
    if (!item) return base
    // A news source arrives as { ...source, kind: 'news_source', sourceKind: source.kind }.
    if (item.kind === 'news_source') return { ...base, ...item, news: { ...base.news, keywords: (item.keywords || []).join(', ') }, sourceKind: item.sourceKind || 'rss' }
    return { ...base, ...item, year: item.year ? String(item.year) : '', publishedAt: item.publishedAt ? String(item.publishedAt).slice(0, 10) : '', news: source ? { enabled: source.active !== false, id: source.id, url: source.url, kind: source.kind, intervalHours: source.intervalHours, keywords: (source.keywords || []).join(', ') } : base.news }
  })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const set = (key, value) => setDraft(current => ({ ...current, [key]: value }))
  const setNews = (key, value) => setDraft(current => ({ ...current, news: { ...current.news, [key]: value } }))
  const kinds = platform ? PLATFORM_KINDS : HOSPITAL_KINDS
  const k = draft.kind
  const isNew = !item?.id
  const err = key => (errors[key] ? errorText(errors[key], language) : '')

  async function save() {
    const found = validateDraft(draft)
    if (draft.file && draft.file.size > MAX_FILE) found.file = 'long'
    setErrors(found)
    if (Object.keys(found).length) return
    setBusy(true)
    try {
      if (k === 'news_source') await saveSource({ id: item?.id || '', name: draft.name, abbreviation: draft.abbreviation, url: draft.url, kind: draft.sourceKind || 'rss', intervalHours: draft.intervalHours || 2, keywords: draft.news.keywords, active: draft.active !== false })
      else if (k === 'announcement') await saveAnnouncement(draft, organizationId)
      else await saveItem(draft, platform ? null : organizationId)
      notify(L('Η εγγραφή αποθηκεύτηκε.', 'The entry was saved.'), 'success')
      onSaved?.()
      onClose?.()
    } catch (error) {
      notifyError(error, 'save', { operation: 'library_save' })
    } finally { setBusy(false) }
  }

  async function toggleArchive() {
    const archiving = draft.status !== 'archived'
    if (archiving && !await confirm({ title: L('Απόσυρση εγγραφής;', 'Withdraw the entry?'), message: platform ? L('Δεν θα εμφανίζεται πλέον στη «Βιβλιοθήκη» κανενός νοσοκομείου. Μένει εδώ και μπορεί να δημοσιευτεί ξανά.', 'It will no longer show in any hospital\'s Library. It stays here and can be published again.') : L('Δεν θα εμφανίζεται πλέον στη «Βιβλιοθήκη» του νοσοκομείου. Μπορεί να δημοσιευτεί ξανά.', 'It will no longer show in the hospital\'s Library. It can be published again.'), confirmLabel: L('Απόσυρση', 'Withdraw'), danger: true })) return
    setBusy(true)
    try {
      await setItemStatus(item, archiving ? 'archived' : 'published')
      notify(archiving ? L('Η εγγραφή αποσύρθηκε.', 'The entry was withdrawn.') : L('Η εγγραφή δημοσιεύτηκε ξανά.', 'The entry was published again.'), 'success')
      onSaved?.()
      onClose?.()
    } catch (error) { notifyError(error, 'save', { operation: 'library_archive' }) } finally { setBusy(false) }
  }

  const nameLabel = k === 'link' ? L('Φορέας / Όνομα *', 'Organisation / name *') : k === 'news_source' ? L('Όνομα πηγής *', 'Source name *') : L('Τίτλος *', 'Title *')
  const urlLabel = k === 'clinical_guide' ? L('Σύνδεσμος (αν δεν ανεβάσετε αρχείο)', 'Link (if you do not upload a file)') : k === 'news_source' ? L('Feed (RSS / Atom) ή σελίδα *', 'Feed (RSS / Atom) or page *') : k === 'announcement' ? L('Σύνδεσμος (προαιρετικά)', 'Link (optional)') : L('Διεύθυνση (URL) *', 'Address (URL) *')
  const readAs = [{ value: 'rss', label: 'RSS / Atom' }, { value: 'page', label: L('Σελίδα με συνδέσμους', 'Page of links') }]
  const intervals = INTERVALS.map(hours => ({ value: String(hours), label: intervalLabel(hours, language) }))
  const footer = <>
    {!isNew && k !== 'news_source' && k !== 'announcement' && <Button variant="secondary" className="button-destructive" disabled={busy} onClick={toggleArchive}>{draft.status === 'archived' ? <RotateCcw size={16} /> : <Archive size={16} />}{draft.status === 'archived' ? L('Νέα δημοσίευση', 'Publish again') : L('Απόσυρση', 'Withdraw')}</Button>}
    <DialogActions onSave={save} disabled={busy} />
  </>

  return <ObserverDialog width="wide" eyebrow={platform ? L('Διαχείριση βιβλιοθήκης', 'Library management') : L('Βιβλιοθήκη του νοσοκομείου', "Hospital's library")} title={isNew ? L('Νέα εγγραφή', 'New entry') : L('Επεξεργασία εγγραφής', 'Edit entry')}
    subtitle={platform ? L('Ό,τι αποθηκεύεται εδώ εμφανίζεται στη «Βιβλιοθήκη» όλων των νοσοκομείων.', 'Whatever is saved here shows in the Library of every hospital.') : L('Ό,τι αποθηκεύεται εδώ εμφανίζεται μόνο στη «Βιβλιοθήκη» του νοσοκομείου σας, με την ένδειξη «Του νοσοκομείου».', "Whatever is saved here shows only in your hospital's Library, marked «Hospital's own».")}
    onClose={onClose} footer={footer}>
    <div className="lib-form">
      {isNew && <div className="lib-span"><ChoiceChips label={L('Τύπος', 'Type')} options={kinds.map(value => ({ value, label: kindLabel(value, language) }))} selected={[k]} onToggle={value => setDraft(current => ({ ...blankDraft(value, scope), name: current.name, url: current.url }))} /></div>}
      <Field label={nameLabel} error={err('name')}><input value={draft.name} onChange={e => set('name', e.target.value)} /></Field>
      {(k === 'link' || k === 'news_source' || k === 'announcement') && <Field label={L('Συντομογραφία (για το εικονίδιο)', 'Abbreviation (for the icon)')} error={err('abbreviation')}>
        <span className="lib-abbr"><span className={`lib-logo tone-${logoTone({ ...draft, organizationId: platform ? null : organizationId || 'hospital' })}${initials(draft).length > 4 ? ' is-long' : ''}`} aria-hidden="true">{initials(draft)}</span><input value={draft.abbreviation} maxLength={8} onChange={e => set('abbreviation', e.target.value)} placeholder={L('π.χ. ECDC', 'e.g. ECDC')} /></span>
      </Field>}
      {(k === 'guideline' || k === 'clinical_guide') && <Field label={L('Φορέας', 'Organisation')}><input value={draft.organisation} onChange={e => set('organisation', e.target.value)} placeholder={L('π.χ. WHO, CDC / HICPAC, ΕΟΔΥ', 'e.g. WHO, CDC / HICPAC, ΕΟΔΥ')} /></Field>}
      <Field label={urlLabel} error={err(k === 'news_source' ? 'newsUrl' : 'url')}><input value={draft.url} inputMode="url" placeholder="https://" onChange={e => set('url', e.target.value)} /></Field>
      {k === 'link' && platform && <ChoiceField label={L('Ομάδα', 'Group')} value={draft.group} options={LINK_GROUPS.filter(group => group.value !== 'hospital').map(group => ({ value: group.value, label: group[en ? 'en' : 'el'] }))} onChange={value => set('group', value)} />}
      {(k === 'guideline' || k === 'clinical_guide') && <Field label={L('Έτος', 'Year')} error={err('year')}><input value={draft.year} inputMode="numeric" maxLength={4} onChange={e => set('year', e.target.value.replace(/\D/g, ''))} placeholder="2021" /></Field>}
      {k === 'guideline' && <ChoiceField label={L('Γλώσσα', 'Language')} value={draft.language} options={[{ value: 'el', label: L('Ελληνικά', 'Greek') }, { value: 'en', label: L('Αγγλικά', 'English') }, { value: 'other', label: L('Άλλη', 'Other') }]} onChange={value => set('language', value)} />}
      {k === 'news_source' && <>
        <ChoiceField label={L('Ανάγνωση ως', 'Read as')} value={draft.sourceKind || 'rss'} options={readAs} onChange={value => set('sourceKind', value)} />
        <ChoiceField label={L('Συχνότητα ελέγχου', 'How often it is checked')} value={String(draft.intervalHours || 2)} options={intervals} onChange={value => set('intervalHours', Number(value))} />
        <Field label={L('Λέξεις-κλειδιά (προαιρετικά, με κόμμα)', 'Keywords (optional, comma separated)')}><input value={draft.news.keywords} onChange={e => setNews('keywords', e.target.value)} placeholder="healthcare-associated, AMR" /></Field>
        <CheckboxField label={L('Ελέγχεται αυτόματα', 'Checked automatically')} checked={draft.active !== false} onChange={value => set('active', value)} />
      </>}
      {k === 'announcement' && <>
        <ManualDateField label={L('Ημερομηνία', 'Date')} value={draft.publishedAt} onChange={value => set('publishedAt', value)} />
        <Field label={L(`Σύντομο κείμενο (έως ${EXCERPT_LIMIT} χαρακτήρες)`, `Short text (up to ${EXCERPT_LIMIT} characters)`)} error={err('excerpt')}><textarea rows={3} maxLength={EXCERPT_LIMIT} value={draft.excerpt} onChange={e => set('excerpt', e.target.value)} /></Field>
      </>}
      {k !== 'news_source' && k !== 'announcement' && <>
        <div className="lib-span"><Field label={L(`Περιγραφή στα ελληνικά${k === 'link' ? ' *' : ''}`, `Description in Greek${k === 'link' ? ' *' : ''}`)} hint={L(`Έως ${DESCRIPTION_LIMIT} χαρακτήρες · εμφανίζεται στην κάρτα`, `Up to ${DESCRIPTION_LIMIT} characters · shown on the card`)} error={err('descriptionEl')}><textarea rows={2} maxLength={DESCRIPTION_LIMIT} value={draft.descriptionEl} onChange={e => set('descriptionEl', e.target.value)} /></Field></div>
        <div className="lib-span"><Field label={L('Περιγραφή στα αγγλικά', 'Description in English')}><textarea rows={2} maxLength={DESCRIPTION_LIMIT} value={draft.descriptionEn} onChange={e => set('descriptionEn', e.target.value)} /></Field></div>
      </>}
      {k === 'guideline' && <>
        <Field label={L('Τι λέει, σύντομα (ελληνικά · ένα σημείο ανά γραμμή)', 'In short (Greek · one point per line)')}><textarea rows={4} value={draft.summaryEl} onChange={e => set('summaryEl', e.target.value)} /></Field>
        <Field label={L('Τι λέει, σύντομα (αγγλικά)', 'In short (English)')}><textarea rows={4} value={draft.summaryEn} onChange={e => set('summaryEn', e.target.value)} /></Field>
      </>}
      {k === 'clinical_guide' && <div className="lib-span"><Field label={L('Αρχείο (εικόνα ή PDF, έως 10 MB)', 'File (image or PDF, up to 10 MB)')} hint={draft.file ? draft.file.name : draft.fileName || L('Ανεβάστε το infographic ή δώστε σύνδεσμο παραπάνω.', 'Upload the infographic or give a link above.')} error={errors.file ? L('Το αρχείο ξεπερνά τα 10 MB.', 'The file is larger than 10 MB.') : ''}><input type="file" accept={ACCEPT} onChange={e => set('file', e.target.files?.[0] || null)} /></Field></div>}
      {k === 'link' && platform && draft.group === 'archive' && <>
        <Field label={L('Σημείωση (ελληνικά)', 'Note (Greek)')}><input value={draft.noteEl} onChange={e => set('noteEl', e.target.value)} placeholder={L('π.χ. συγχωνεύθηκε στην …', 'e.g. merged into …')} /></Field>
        <Field label={L('Σημείωση (αγγλικά)', 'Note (English)')}><input value={draft.noteEn} onChange={e => set('noteEn', e.target.value)} /></Field>
      </>}
      {k !== 'news_source' && k !== 'announcement' && <div className="lib-span"><ChoiceChips label={L('Θέματα', 'Topics')} options={LIBRARY_TOPICS.map(topic => ({ value: topic.value, label: topic[en ? 'en' : 'el'] }))} selected={draft.tags} onToggle={value => set('tags', draft.tags.includes(value) ? draft.tags.filter(tag => tag !== value) : [...draft.tags, value])} /></div>}
      {k !== 'news_source' && <Field label={L('Ορατότητα', 'Visibility')}><span className="lib-form-static">{platform ? L('Όλα τα νοσοκομεία', 'Every hospital') : L('Μόνο το νοσοκομείο σας', 'Your hospital only')}</span></Field>}
      {platform && k !== 'news_source' && <Field label={L('Σήμανση', 'Mark')}><CheckboxField label={L('«Προτεινόμενο» από την πλατφόρμα', '«Suggested» by the platform')} checked={draft.proposed} onChange={value => set('proposed', value)} /></Field>}
      {platform && k === 'link' && <div className="lib-span lib-form-box">
        <CheckboxField label={L('Αυτόματη λήψη νέων από αυτή την πηγή (καρτέλα «Νέα»)', 'Fetch news from this source automatically («News» tab)')} checked={draft.news.enabled} onChange={value => setNews('enabled', value)} />
        {draft.news.enabled && <div className="lib-form">
          <Field label={L('Feed (RSS / Atom) ή σελίδα', 'Feed (RSS / Atom) or page')} error={err('newsUrl')} hint={L('Μένει «μη επαληθευμένο» μέχρι τον πρώτο επιτυχή έλεγχο.', 'Stays «unverified» until its first successful check.')}><input value={draft.news.url} inputMode="url" placeholder="https://" onChange={e => setNews('url', e.target.value)} /></Field>
          <ChoiceField label={L('Συχνότητα ελέγχου', 'How often it is checked')} value={String(draft.news.intervalHours || 2)} options={intervals} onChange={value => setNews('intervalHours', Number(value))} />
          <ChoiceField label={L('Ανάγνωση ως', 'Read as')} value={draft.news.kind} options={readAs} onChange={value => setNews('kind', value)} />
          <Field label={L('Λέξεις-κλειδιά (προαιρετικά, με κόμμα)', 'Keywords (optional, comma separated)')}><input value={draft.news.keywords} onChange={e => setNews('keywords', e.target.value)} placeholder="healthcare-associated, AMR, Candida auris" /></Field>
        </div>}
      </div>}
    </div>
  </ObserverDialog>
}
