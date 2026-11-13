import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { ArrowDown, ArrowUp, ClipboardList, ListChecks, Plus, Trash2 } from 'lucide-react'
import { Page } from '../../../design-system/Page'
import { BackButton } from '../../../design-system/BackButton'
import { RegistryTable } from '../../../design-system/RegistryTable'
import { StatusBadge } from '../../../design-system/StatusBadge'
import { ExportMenu } from '../../../design-system/ExportMenu'
import { Button } from '../../../design-system/Button'
import { IconButton } from '../../../design-system/IconButton'
import { EntityRecordShell } from '../../../design-system/EntityRecordShell'
import { RecordTabPanel } from '../../../design-system/RecordTabPanel'
import { SaveButton } from '../../../design-system/SaveButton'
import { FormGrid } from '../../../design-system/FormCard'
import { Field } from '../../../design-system/Field'
import { ChoiceField } from '../../../design-system/ChoiceField'
import { MultiSelect } from '../../../design-system/MultiSelect'
import { CheckboxField } from '../../../design-system/CheckboxField'
import { useLanguage } from '../../../core/i18n/LanguageContext'
import { useFeedback } from '../../../core/feedback/FeedbackContext'
import { useTenant } from '../../../core/tenant/TenantContext'
import { exportRegistry } from '../../../core/export/registryExports'
import { useContextualNavigation } from '../../../core/navigation/useContextualNavigation'
import { useResourceAccess } from './ResourcesPanel'
import { loadTemplates, removeTemplate, saveTemplate } from './resourceService'
import { SUPPLIER_CATEGORIES, supplierCategoryLabel } from './resourceModel'
import { moveCriterion, newCriterion, newTemplate, templateProblems, weightTotal } from './supplierTemplates'
import '../quality.css'
import './resources.css'
import type { EvaluationTemplate, TemplateCriterion, TemplateEditing } from './resourceTypes'

const comma = (value: unknown, en: boolean) => (en ? String(value) : String(value).replace('.', ','))

// Quality → Resources → Suppliers → «Evaluation templates»: one template per kind
// of supplier, with its criteria and weights, thresholds and frequency. Saving a
// change raises the template's version; earlier evaluations keep theirs.
export function SupplierTemplatesPage() {
  const { language } = useLanguage()
  const en = language === 'en'
  const { notify, confirm } = useFeedback()
  const { tenant } = useTenant()
  const access = useResourceAccess()
  const { goBack } = useContextualNavigation('/quality')
  const [templates, setTemplates] = useState<EvaluationTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<TemplateEditing | null>(null)
  const [saving, setSaving] = useState(false)
  const reload = useCallback(() => {
    setLoading(true)
    return loadTemplates(tenant?.id).then(setTemplates).catch(error => { console.error(error); setTemplates([]) }).finally(() => setLoading(false))
  }, [tenant?.id])
  useEffect(() => { void reload() }, [reload])
  const rows = useMemo(() => [...templates].sort((a, b) => Number(b.active !== false) - Number(a.active !== false) || String(a.name).localeCompare(String(b.name), 'el')), [templates])
  const locked = !access.canManage

  async function save() {
    if (!editing) return
    const problems = templateProblems(editing.draft, language)
    if (problems.length) { notify(`${en ? 'Fill in:' : 'Συμπληρώστε:'} ${problems.join(' · ')}`, 'error'); return }
    setSaving(true)
    try {
      await saveTemplate(tenant?.id, editing.draft, editing.before)
      notify(en ? 'Template saved.' : 'Το πρότυπο αποθηκεύτηκε.', 'success')
      setEditing(null)
      await reload()
    } catch (error) { console.error(error); notify(en ? 'The template could not be saved.' : 'Δεν ήταν δυνατή η αποθήκευση του προτύπου.', 'error') } finally { setSaving(false) }
  }
  async function remove() {
    const ok = await confirm({ title: en ? 'Delete template' : 'Διαγραφή προτύπου', message: en ? 'The template is deleted; evaluations made on it keep its name, criteria and weights. A template no longer used is better made inactive.' : 'Το πρότυπο διαγράφεται· οι αξιολογήσεις που έγιναν με αυτό κρατούν το όνομα, τα κριτήρια και τα βάρη του. Για πρότυπο που δεν χρησιμοποιείται πια, προτιμήστε να το κάνετε ανενεργό.', confirmLabel: en ? 'Delete' : 'Διαγραφή', danger: true })
    if (!ok || !editing) return
    try { await removeTemplate(tenant?.id, editing.draft.id); notify(en ? 'Template deleted.' : 'Το πρότυπο διαγράφηκε.', 'success'); setEditing(null); await reload() } catch (error) { console.error(error); notify(en ? 'The template could not be deleted.' : 'Δεν ήταν δυνατή η διαγραφή.', 'error') }
  }
  const exportTemplates = () => exportRegistry({
    name: en ? 'supplier-evaluation-templates' : 'protypa-axiologisis-promitheftwn',
    headers: en ? ['Template', 'Categories', 'Approved from %', 'Conditional from %', 'Every (months)', 'Scale', 'Version', 'Active', '#', 'Criterion', 'Description', 'Weight'] : ['Πρότυπο', 'Κατηγορίες', 'Εγκεκριμένος από %', 'Υπό όρους από %', 'Κάθε (μήνες)', 'Κλίμακα', 'Έκδοση', 'Ενεργό', '#', 'Κριτήριο', 'Περιγραφή', 'Βάρος'],
    rows: rows.flatMap(template => (template.criteria || []).map((criterion, index: number) => [template.name, (template.categories || []).map((value: string) => supplierCategoryLabel(value, language)).join(', '), template.passThreshold, template.conditionalThreshold, template.frequencyMonths, template.scoreScale === 10 ? '0–10' : '1–5', template.version, template.active !== false ? (en ? 'Yes' : 'Ναι') : (en ? 'No' : 'Όχι'), index + 1, criterion.label, criterion.description || '', criterion.weight])),
  })
  const open = (template: EvaluationTemplate) => setEditing({ draft: structuredClone(template), before: template.id ? template : null })

  // A template opens as a page of its own, as the other records (back returns to the list).
  if (editing) return <TemplateEditor editing={editing} setEditing={setEditing} saving={saving} locked={locked} language={language} onSave={save} onRemove={editing.draft.id && !locked ? remove : null} />
  return <Page fill icon={<ListChecks size={19} />} className="supplier-templates-page" navigation={<BackButton onClick={goBack} label={en ? 'Back to suppliers' : 'Πίσω στους προμηθευτές'} />}
    title={en ? 'Supplier evaluation templates' : 'Πρότυπα αξιολόγησης προμηθευτών'}
    subtitle={en ? 'Each kind of supplier is evaluated on its own criteria and weights. A new evaluation takes the template of the supplier’s category.' : 'Κάθε είδος προμηθευτή αξιολογείται με τα δικά του κριτήρια και βάρη. Μια νέα αξιολόγηση παίρνει το πρότυπο της κατηγορίας του προμηθευτή.'}
    actions={<div className="row-actions"><ExportMenu disabled={!rows.length} onExcel={exportTemplates} />{!locked && <Button onClick={() => open(newTemplate())}><Plus size={15} />{en ? 'New template' : 'Νέο πρότυπο'}</Button>}</div>}>
    <div className="scroll-table">
      <RegistryTable bare className="quality-table quality-register-table" rows={rows} rowKey={row => row.id} empty={!loading && !rows.length}
        columns={[{ key: 'name', label: en ? 'Template' : 'Πρότυπο' }, { key: 'categories', label: en ? 'Supplier categories' : 'Κατηγορίες προμηθευτών' }, { key: 'criteria', label: en ? 'Criteria' : 'Κριτήρια' }, { key: 'thresholds', label: en ? 'Approval threshold' : 'Όριο έγκρισης' }, { key: 'frequency', label: en ? 'Frequency' : 'Συχνότητα' }, { key: 'status', label: en ? 'Status' : 'Κατάσταση' }]}
        emptyTitle={en ? 'No templates' : 'Δεν υπάρχουν πρότυπα'} emptyText={en ? 'Add a template for each kind of supplier: products, services, kitchen, laboratory.' : 'Προσθέστε ένα πρότυπο για κάθε είδος προμηθευτή: προϊόντα, υπηρεσίες, κουζίνα, εργαστήριο.'}
        rowProps={row => ({ className: 'registry-row-clickable', onClick: () => open(row) })}
        renderRow={row => <>
          <td><strong>{row.name}</strong><small>{en ? 'version' : 'έκδοση'} {row.version}{row.description ? ` · ${row.description}` : ''}</small></td>
          <td>{(row.categories || []).length ? <span className="resource-notes">{row.categories.map((value: string) => <StatusBadge key={value} tone="neutral">{supplierCategoryLabel(value, language)}</StatusBadge>)}</span> : (en ? 'Every supplier' : 'Όλοι οι προμηθευτές')}</td>
          <td className="nowrap-cell">{(row.criteria || []).length}<small>{en ? 'weights' : 'βάρη'} {comma(weightTotal(row.criteria), en)} · {row.scoreScale === 10 ? '0–10' : '1–5'}</small></td>
          <td className="nowrap-cell">{comma(row.passThreshold, en)}%{Number(row.conditionalThreshold) < Number(row.passThreshold) ? ` / ${comma(row.conditionalThreshold, en)}%` : ''}</td>
          <td className="nowrap-cell">{en ? `every ${row.frequencyMonths} months` : `κάθε ${row.frequencyMonths} μήνες`}</td>
          <td><StatusBadge tone={row.active !== false ? 'success' : 'neutral'}>{row.active !== false ? (en ? 'Active' : 'Ενεργό') : (en ? 'Inactive' : 'Ανενεργό')}</StatusBadge></td>
        </>} />
    </div>
  </Page>
}

function TemplateEditor({ editing, setEditing, saving, locked, language, onSave, onRemove }: { editing: TemplateEditing, setEditing: Dispatch<SetStateAction<TemplateEditing | null>>, saving: boolean, locked: boolean, language: string, onSave: () => void | Promise<void>, onRemove: (() => void | Promise<void>) | null }) {
  const en = language === 'en'
  const draft = editing.draft
  const set = (next: Partial<EvaluationTemplate>) => setEditing(current => ({ ...current, draft: { ...current?.draft, ...next } }) as TemplateEditing)
  const setCriterion = (index: number, next: Partial<TemplateCriterion>) => set({ criteria: draft.criteria.map((item, at: number) => (at === index ? { ...item, ...next } : item)) })
  const total = weightTotal(draft.criteria)
  const [tab, setTab] = useState('details')
  const title = draft.id ? draft.name || (en ? 'Template' : 'Πρότυπο') : (en ? 'New template' : 'Νέο πρότυπο')
  const footer = !locked && <div className="inline-edit-footer"><SaveButton loading={saving} disabled={saving} onClick={onSave}>{en ? 'Save' : 'Αποθήκευση'}</SaveButton></div>
  const headerActions = onRemove && <div className="row-actions"><IconButton tone="danger" label={en ? 'Delete template' : 'Διαγραφή προτύπου'} onClick={onRemove}><Trash2 size={16} /></IconButton></div>
  return <Page fill><EntityRecordShell className="quality-record-shell resource-record-shell workspace-fill" avatar={<ListChecks size={19} />}
    eyebrow={en ? 'Supplier evaluation template' : 'Πρότυπο αξιολόγησης προμηθευτών'} title={title}
    subtitle={[draft.id && `${en ? 'version' : 'έκδοση'} ${draft.version}`, (draft.categories || []).map((value: string) => supplierCategoryLabel(value, language)).join(', ')].filter(Boolean).join(' · ')}
    status={<StatusBadge tone={draft.active !== false ? 'success' : 'neutral'}>{draft.active !== false ? (en ? 'Active' : 'Ενεργό') : (en ? 'Inactive' : 'Ανενεργό')}</StatusBadge>}
    onBack={() => setEditing(null)} backLabel={en ? 'Templates' : 'Πρότυπα'} headerActions={headerActions}
    tabs={[{ id: 'details', label: en ? 'Details' : 'Στοιχεία', icon: ClipboardList }, { id: 'criteria', label: en ? `Criteria ${draft.criteria.length}` : `Κριτήρια ${draft.criteria.length}`, icon: ListChecks }]}
    activeTab={tab} onTabChange={setTab}>
    {tab === 'details' && <RecordTabPanel title={en ? 'Details' : 'Στοιχεία'} footer={footer}>
    <div className="resource-evaluation supplier-template-editor">
      <FormGrid columns={3}>
        <Field label={en ? 'Name *' : 'Όνομα *'}><input value={draft.name} disabled={locked} onChange={e => set({ name: e.target.value })} /></Field>
        <MultiSelect label={en ? 'Supplier categories' : 'Κατηγορίες προμηθευτών'} disabled={locked} tags options={SUPPLIER_CATEGORIES.map(item => ({ value: item.value, label: item.label[en ? 1 : 0] }))} selected={draft.categories || []} onChange={value => set({ categories: value })}
          placeholder={en ? 'Every supplier' : 'Όλοι οι προμηθευτές'} searchPlaceholder={en ? 'Search category' : 'Αναζήτηση κατηγορίας'} emptyLabel={en ? 'No match' : 'Δεν βρέθηκε'} selectAllLabel={en ? 'Select all' : 'Επιλογή όλων'} clearAllLabel={en ? 'Clear' : 'Καθαρισμός'} />
        <ChoiceField label={en ? 'Scale' : 'Κλίμακα'} value={Number(draft.scoreScale) === 10 ? 10 : 5} disabled={locked} options={[{ value: 5, label: en ? '1–5 (not satisfactory … excellent)' : '1–5 (καθόλου ικανοποιητικό … εξαίρετο)' }, { value: 10, label: en ? '0–10' : '0–10' }]} onChange={value => set({ scoreScale: value })} />
        <Field label={en ? 'Approved from (%)' : 'Εγκεκριμένος από (%)'}><input type="number" min="0" max="100" step="0.5" value={draft.passThreshold} disabled={locked} onChange={e => set({ passThreshold: e.target.value, ...(Number(draft.conditionalThreshold) >= Number(draft.passThreshold) ? { conditionalThreshold: e.target.value } : {}) })} /></Field>
        {/* The hospital's form approves or not; «conditional» is a band of its own only when chosen. */}
        <CheckboxField label={en ? 'Also «conditional» (between two thresholds)' : 'Και «υπό όρους» (ανάμεσα σε δύο όρια)'} checked={Number(draft.conditionalThreshold) < Number(draft.passThreshold)} disabled={locked} onChange={value => set({ conditionalThreshold: value ? Math.max(0, Number(draft.passThreshold) - 20) : draft.passThreshold })} />
        {Number(draft.conditionalThreshold) < Number(draft.passThreshold) && <Field label={en ? 'Conditional from (%)' : 'Υπό όρους από (%)'}><input type="number" min="0" max="100" step="0.5" value={draft.conditionalThreshold} disabled={locked} onChange={e => set({ conditionalThreshold: e.target.value })} /></Field>}
        <Field label={en ? 'Evaluate every (months)' : 'Αξιολόγηση κάθε (μήνες)'}><input type="number" min="1" max="60" value={draft.frequencyMonths} disabled={locked} onChange={e => set({ frequencyMonths: e.target.value === '' ? '' : Number(e.target.value) })} /></Field>
        <CheckboxField label={en ? 'Active (offered for new evaluations)' : 'Ενεργό (προτείνεται σε νέες αξιολογήσεις)'} checked={draft.active !== false} disabled={locked} onChange={value => set({ active: value })} />
      </FormGrid>
      <Field label={en ? 'Description' : 'Περιγραφή'}><textarea rows={2} value={draft.description || ''} disabled={locked} onChange={e => set({ description: e.target.value })} /></Field>
    </div></RecordTabPanel>}
    {tab === 'criteria' && <RecordTabPanel title={en ? 'Criteria' : 'Κριτήρια'} footer={footer}
      subtitle={en ? `Weights add up to ${comma(total, en)}; the result is the weighted share of the points.` : `Τα βάρη αθροίζουν ${comma(total, en)}· το αποτέλεσμα είναι το σταθμισμένο ποσοστό.`}
      actions={!locked && <Button variant="secondary" onClick={() => set({ criteria: [...draft.criteria, newCriterion()] })}><Plus size={15} />{en ? 'Criterion' : 'Κριτήριο'}</Button>}><div className="resource-evaluation supplier-template-editor">
      {/* The criteria as one table: a line each, the column names once on top. */}
      {draft.criteria.length > 0 && <div className="supplier-template-criteria" role="table" aria-label={en ? 'Criteria' : 'Κριτήρια'}>
        <div className="supplier-template-row supplier-template-head" role="row">
          <span role="columnheader">#</span>
          <span role="columnheader">{en ? 'Criterion *' : 'Κριτήριο *'}</span>
          <span role="columnheader">{en ? 'Question / guidance' : 'Ερώτηση / οδηγία'}</span>
          <span role="columnheader">{en ? 'Weight *' : 'Βάρος *'}</span>
          <span role="columnheader">{en ? 'Optional' : 'Προαιρετικό'}</span>
          <span role="columnheader" aria-label={en ? 'Actions' : 'Ενέργειες'} />
        </div>
        {draft.criteria.map((item, index: number) => <div className="supplier-template-row" role="row" key={item.id || index}>
          <span className="supplier-template-index" role="cell">{index + 1}</span>
          <input role="cell" aria-label={`${en ? 'Criterion' : 'Κριτήριο'} ${index + 1}`} value={item.label} disabled={locked} onChange={e => setCriterion(index, { label: e.target.value })} />
          <input role="cell" aria-label={`${en ? 'Question / guidance' : 'Ερώτηση / οδηγία'} ${index + 1}`} value={item.description || ''} placeholder={en ? 'What the evaluator checks' : 'Τι ελέγχει ο αξιολογητής'} disabled={locked} onChange={e => setCriterion(index, { description: e.target.value })} />
          <input role="cell" aria-label={`${en ? 'Weight' : 'Βάρος'} ${index + 1}`} type="number" min="0" step="0.01" value={item.weight} disabled={locked} onChange={e => setCriterion(index, { weight: e.target.value })} />
          <span className="supplier-template-optional" role="cell"><CheckboxField label="" ariaLabel={`${en ? 'Optional' : 'Προαιρετικό'} ${index + 1}`} checked={Boolean(item.optional)} disabled={locked} onChange={value => setCriterion(index, { optional: value })} /></span>
          <span className="row-actions supplier-template-moves" role="cell">{!locked && <>
            <IconButton size="sm" label={en ? 'Move up' : 'Μετακίνηση πάνω'} disabled={index === 0} onClick={() => set({ criteria: moveCriterion(draft.criteria, index, -1) })}><ArrowUp size={14} /></IconButton>
            <IconButton size="sm" label={en ? 'Move down' : 'Μετακίνηση κάτω'} disabled={index === draft.criteria.length - 1} onClick={() => set({ criteria: moveCriterion(draft.criteria, index, 1) })}><ArrowDown size={14} /></IconButton>
            <IconButton size="sm" tone="danger" label={en ? 'Remove criterion' : 'Αφαίρεση κριτηρίου'} onClick={() => set({ criteria: draft.criteria.filter((_, at: number) => at !== index) })}><Trash2 size={14} /></IconButton>
          </>}</span>
        </div>)}
      </div>}
      {!draft.criteria.length && <p className="inline-empty"><ListChecks size={15} /> {en ? 'Add the criteria of the template.' : 'Προσθέστε τα κριτήρια του προτύπου.'}</p>}
    </div></RecordTabPanel>}
  </EntityRecordShell></Page>
}
