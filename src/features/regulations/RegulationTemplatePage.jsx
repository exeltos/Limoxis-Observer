import { useCallback, useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { BookOpen, Library, PencilLine, Send } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { RecordTabPanel } from '../../design-system/RecordTabPanel'
import { ExportMenu } from '../../design-system/ExportMenu'
import { ObserverDialog, DialogActions } from '../../design-system/ObserverDialog'
import { FormCard, FormGrid } from '../../design-system/FormCard'
import { Field } from '../../design-system/Field'
import { Button } from '../../design-system/Button'
import { StatusBadge } from '../../design-system/StatusBadge'
import { RouteLoading } from '../../design-system/RouteLoading'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useContextualNavigation } from '../../core/navigation/useContextualNavigation'
import { formatDay } from '../../core/i18n/formatDay'
import { categoryLabel, contentFromTemplate } from './regulationModel'
import { sanitizeHtml } from './regulationHtml'
import { loadTemplate, publishTemplate } from './regulationService'
import { useRegulationAccess } from './regulationAccess'
import { downloadRegulationWord } from './regulationDocument'
import { RegulationBook } from './RegulationBook'
import { RegulationEditor } from './RegulationEditor'
import './regulations.css'

// A platform template, kept by the platform owner. Publishing makes it the next
// version: every hospital whose regulation follows it sees what changed and
// takes what it wants. {hospital} in the text becomes each hospital's name.
export function RegulationTemplatePage() {
  const { templateKey } = useParams()
  const { goBack } = useContextualNavigation('/documents?tab=regulations')
  const { language } = useLanguage()
  const en = language === 'en'
  const { notify, confirm } = useFeedback()
  const { isPlatformOwner } = useRegulationAccess()
  const [template, setTemplate] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [tab, setTab] = useState('edit')
  const [publishing, setPublishing] = useState(null)
  const [saving, setSaving] = useState(false)

  const reload = useCallback(async () => {
    try { const found = await loadTemplate(templateKey); setTemplate(found ? structuredClone(found) : false); setDirty(false) } catch { setTemplate(false) }
  }, [templateKey])
  useEffect(() => { void reload() }, [reload])

  if (!isPlatformOwner) return <Navigate to="/documents?tab=regulations" replace />
  if (template === null) return <RouteLoading />
  if (template === false) return <Page title={en ? 'Template' : 'Πρότυπο'}><div className="data-access-state error" role="alert"><span>{en ? 'The template was not found.' : 'Το πρότυπο δεν βρέθηκε.'}</span><Button variant="secondary" onClick={goBack}>{en ? 'Back' : 'Πίσω'}</Button></div></Page>

  const set = changes => { setTemplate(current => ({ ...current, ...changes })); setDirty(true) }
  async function publish() {
    setSaving(true)
    try {
      const content = { chapters: template.content.chapters.map(chapter => ({ ...chapter, sections: chapter.sections.map(section => ({ ...section, html: sanitizeHtml(section.html) })) })) }
      const version = await publishTemplate({ ...template, content }, publishing.changeNote)
      setPublishing(null)
      notify(en ? `Version ${version} is published to every hospital.` : `Η έκδοση ${version} δημοσιεύτηκε σε όλα τα νοσοκομεία.`, 'success')
      await reload()
    } catch { notify(en ? 'The template could not be published.' : 'Το πρότυπο δεν δημοσιεύτηκε.', 'error') } finally { setSaving(false) }
  }
  const preview = contentFromTemplate(template, { hospital: en ? 'Example Hospital' : 'Νοσοκομείο Παράδειγμα' })
  const meta = { title: template.title, organization: en ? 'Example Hospital' : 'Νοσοκομείο Παράδειγμα', code: template.key, category: categoryLabel(template.category, language), edition: '', editionLabel: '', issued: '', approvedBy: '', status: `${en ? 'Template' : 'Πρότυπο'} v${template.version}`, template: '', draft: true }

  return <Page fill><EntityRecordShell className="reg-record-shell workspace-fill" avatar={<Library size={19} />} eyebrow={`${en ? 'Platform template' : 'Πρότυπο πλατφόρμας'} · ${categoryLabel(template.category, language)}`} title={template.title}
    subtitle={`v${template.version} · ${formatDay(template.publishedAt, language)}${template.changeNote ? ` · ${template.changeNote}` : ''}`}
    status={<StatusBadge tone={dirty ? 'warning' : 'success'}>{dirty ? (en ? 'Unpublished changes' : 'Μη δημοσιευμένες αλλαγές') : (en ? 'Published' : 'Δημοσιευμένο')}</StatusBadge>}
    headerActions={<ExportMenu onWord={() => downloadRegulationWord(preview, meta)} />}
    tabs={[{ id: 'edit', label: en ? 'Edit' : 'Επεξεργασία', icon: PencilLine }, { id: 'preview', label: en ? 'Preview' : 'Προεπισκόπηση', icon: BookOpen }]} activeTab={tab} onTabChange={setTab}
    onBack={async () => { if (!dirty || await confirm({ title: en ? 'Leave without publishing?' : 'Έξοδος χωρίς δημοσίευση;', message: en ? 'The changes are lost.' : 'Οι αλλαγές θα χαθούν.', danger: true })) goBack() }}>
    {tab === 'edit' && <RecordTabPanel className="reg-edit-panel" title={en ? 'Template' : 'Πρότυπο'} subtitle={en ? 'Write {hospital} where the hospital’s name goes; a paragraph «Fill in:» marks what each hospital completes.' : 'Γράψτε {hospital} όπου μπαίνει το όνομα του νοσοκομείου· μια παράγραφος «Συμπληρώστε:» δείχνει τι συμπληρώνει κάθε νοσοκομείο.'}
      actions={<Button disabled={!dirty} onClick={() => setPublishing({ changeNote: '' })}><Send size={15} />{en ? `Publish v${template.version + 1}` : `Δημοσίευση v${template.version + 1}`}</Button>}>
      <FormCard wide title={en ? 'About the template' : 'Στοιχεία προτύπου'}>
        <FormGrid columns={2}>
          <Field label={en ? 'Title' : 'Τίτλος'}><input value={template.title} onChange={event => set({ title: event.target.value })} /></Field>
          <Field label={en ? 'Sources' : 'Πηγές'}><input value={template.sources || ''} onChange={event => set({ sources: event.target.value })} /></Field>
        </FormGrid>
        <Field label={en ? 'Description' : 'Περιγραφή'}><textarea rows={2} value={template.description || ''} onChange={event => set({ description: event.target.value })} /></Field>
      </FormCard>
      <RegulationEditor content={template.content} onChange={content => set({ content })} language={language} onConfirm={options => confirm({ ...options, danger: true })} />
    </RecordTabPanel>}
    {tab === 'preview' && <RecordTabPanel className="reg-read-panel" title={en ? 'As a hospital receives it' : 'Όπως το παραλαμβάνει ένα νοσοκομείο'}>
      <RegulationBook content={preview} meta={meta} language={language} />
    </RecordTabPanel>}
    {publishing && <ObserverDialog title={en ? `Publish version ${template.version + 1}` : `Δημοσίευση έκδοσης ${template.version + 1}`} subtitle={en ? 'Every hospital following this template sees the update.' : 'Κάθε νοσοκομείο που ακολουθεί το πρότυπο βλέπει την ενημέρωση.'} onClose={() => setPublishing(null)}
      footer={<DialogActions onCancel={() => setPublishing(null)} onSave={publish} saveLabel={en ? 'Publish' : 'Δημοσίευση'} disabled={saving || !publishing.changeNote.trim()} />}>
      <Field label={en ? 'What changed (shown to the hospitals) *' : 'Τι άλλαξε (το βλέπουν τα νοσοκομεία) *'}><textarea rows={3} value={publishing.changeNote} onChange={event => setPublishing({ changeNote: event.target.value })} /></Field>
    </ObserverDialog>}
  </EntityRecordShell></Page>
}
