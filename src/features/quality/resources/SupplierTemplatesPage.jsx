import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ListChecks, Plus, Trash2 } from 'lucide-react'
import { Page } from '../../../design-system/Page'
import { BackButton } from '../../../design-system/BackButton'
import { RegistryTable } from '../../../design-system/RegistryTable'
import { StatusBadge } from '../../../design-system/StatusBadge'
import { ExportMenu } from '../../../design-system/ExportMenu'
import { Button } from '../../../design-system/Button'
import { IconButton } from '../../../design-system/IconButton'
import { ObserverDialog, DialogActions } from '../../../design-system/ObserverDialog'
import { FormGrid } from '../../../design-system/FormCard'
import { Field } from '../../../design-system/Field'
import { ChoiceField } from '../../../design-system/ChoiceField'
import { MultiSelect } from '../../../design-system/MultiSelect'
import { CheckboxField } from '../../../design-system/CheckboxField'
import { SectionHeader } from '../../../design-system/SectionHeader'
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

const comma = (value, en) => (en ? String(value) : String(value).replace('.', ','))

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
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const reload = useCallback(() => {
    setLoading(true)
    return loadTemplates(tenant?.id).then(setTemplates).catch(error => { console.error(error); setTemplates([]) }).finally(() => setLoading(false))
  }, [tenant?.id])
  useEffect(() => { void reload() }, [reload])
  const rows = useMemo(() => [...templates].sort((a, b) => Number(b.active !== false) - Number(a.active !== false) || String(a.name).localeCompare(String(b.name), 'el')), [templates])
  const locked = !access.canManage

  async function save() {
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
    if (!ok) return
    try { await removeTemplate(tenant?.id, editing.draft.id); notify(en ? 'Template deleted.' : 'Το πρότυπο διαγράφηκε.', 'success'); setEditing(null); await reload() } catch (error) { console.error(error); notify(en ? 'The template could not be deleted.' : 'Δεν ήταν δυνατή η διαγραφή.', 'error') }
  }
  const exportTemplates = () => exportRegistry({
    name: en ? 'supplier-evaluation-templates' : 'protypa-axiologisis-promitheftwn',
    headers: en ? ['Template', 'Categories', 'Approved from %', 'Conditional from %', 'Every (months)', 'Scale', 'Version', 'Active', '#', 'Criterion', 'Description', 'Weight'] : ['Πρότυπο', 'Κατηγορίες', 'Εγκεκριμένος από %', 'Υπό όρους από %', 'Κάθε (μήνες)', 'Κλίμακα', 'Έκδοση', 'Ενεργό', '#', 'Κριτήριο', 'Περιγραφή', 'Βάρος'],
    rows: rows.flatMap(template => (template.criteria || []).map((criterion, index) => [template.name, (template.categories || []).map(value => supplierCategoryLabel(value, language)).join(', '), template.passThreshold, template.conditionalThreshold, template.frequencyMonths, template.scoreScale === 10 ? '0–10' : '1–5', template.version, template.active !== false ? (en ? 'Yes' : 'Ναι') : (en ? 'No' : 'Όχι'), index + 1, criterion.label, criterion.description || '', criterion.weight])),
  })
  const open = template => setEditing({ draft: structuredClone(template), before: template.id ? template : null })

  return <Page fill className="supplier-templates-page" navigation={<BackButton onClick={goBack} label={en ? 'Back to suppliers' : 'Πίσω στους προμηθευτές'} />}
    title={en ? 'Supplier evaluation templates' : 'Πρότυπα αξιολόγησης προμηθευτών'}
    subtitle={en ? 'Each kind of supplier is evaluated on its own criteria and weights. A new evaluation takes the template of the supplier’s category.' : 'Κάθε είδος προμηθευτή αξιολογείται με τα δικά του κριτήρια και βάρη. Μια νέα αξιολόγηση παίρνει το πρότυπο της κατηγορίας του προμηθευτή.'}
    actions={<div className="row-actions"><ExportMenu disabled={!rows.length} onExcel={exportTemplates} />{!locked && <Button onClick={() => open(newTemplate())}><Plus size={15} />{en ? 'New template' : 'Νέο πρότυπο'}</Button>}</div>}>
    <div className="scroll-table">
      <RegistryTable bare className="quality-table quality-register-table" rows={rows} rowKey={row => row.id} empty={!loading && !rows.length}
        columns={[{ key: 'name', label: en ? 'Template' : 'Πρότυπο' }, { key: 'categories', label: en ? 'Supplier categories' : 'Κατηγορίες προμηθευτών' }, { key: 'criteria', label: en ? 'Criteria' : 'Κριτήρια' }, { key: 'thresholds', label: en ? 'Approved / conditional' : 'Εγκεκριμένος / υπό όρους' }, { key: 'frequency', label: en ? 'Frequency' : 'Συχνότητα' }, { key: 'status', label: en ? 'Status' : 'Κατάσταση' }]}
        emptyTitle={en ? 'No templates' : 'Δεν υπάρχουν πρότυπα'} emptyText={en ? 'Add a template for each kind of supplier: products, services, kitchen, laboratory.' : 'Προσθέστε ένα πρότυπο για κάθε είδος προμηθευτή: προϊόντα, υπηρεσίες, κουζίνα, εργαστήριο.'}
        rowProps={row => ({ className: 'registry-row-clickable', onClick: () => open(row) })}
        renderRow={row => <>
          <td><strong>{row.name}</strong><small>{en ? 'version' : 'έκδοση'} {row.version}{row.description ? ` · ${row.description}` : ''}</small></td>
          <td>{(row.categories || []).length ? <span className="resource-notes">{row.categories.map(value => <StatusBadge key={value} tone="neutral">{supplierCategoryLabel(value, language)}</StatusBadge>)}</span> : (en ? 'Every supplier' : 'Όλοι οι προμηθευτές')}</td>
          <td className="nowrap-cell">{(row.criteria || []).length}<small>{en ? 'weights' : 'βάρη'} {comma(weightTotal(row.criteria), en)} · {row.scoreScale === 10 ? '0–10' : '1–5'}</small></td>
          <td className="nowrap-cell">{comma(row.passThreshold, en)}% / {comma(row.conditionalThreshold, en)}%</td>
          <td className="nowrap-cell">{en ? `every ${row.frequencyMonths} months` : `κάθε ${row.frequencyMonths} μήνες`}</td>
          <td><StatusBadge tone={row.active !== false ? 'success' : 'neutral'}>{row.active !== false ? (en ? 'Active' : 'Ενεργό') : (en ? 'Inactive' : 'Ανενεργό')}</StatusBadge></td>
        </>} />
    </div>
    {editing && <TemplateEditor editing={editing} setEditing={setEditing} saving={saving} locked={locked} language={language} onSave={save} onRemove={editing.draft.id && !locked ? remove : null} />}
  </Page>
}

function TemplateEditor({ editing, setEditing, saving, locked, language, onSave, onRemove }) {
  const en = language === 'en'
  const draft = editing.draft
  const set = next => setEditing(current => ({ ...current, draft: { ...current.draft, ...next } }))
  const setCriterion = (index, next) => set({ criteria: draft.criteria.map((item, at) => (at === index ? { ...item, ...next } : item)) })
  const total = weightTotal(draft.criteria)
  return <ObserverDialog width="wide" fixedHeight title={draft.id ? draft.name || (en ? 'Template' : 'Πρότυπο') : (en ? 'New template' : 'Νέο πρότυπο')} subtitle={draft.id ? `${en ? 'version' : 'έκδοση'} ${draft.version}` : undefined} onClose={() => setEditing(null)}
    footer={!locked && <DialogActions onSave={onSave} saveLabel={en ? 'Save' : 'Αποθήκευση'} disabled={saving}>{onRemove && <Button variant="secondary" onClick={onRemove}><Trash2 size={15} />{en ? 'Delete template' : 'Διαγραφή προτύπου'}</Button>}</DialogActions>}>
    <div className="resource-evaluation supplier-template-editor">
      <FormGrid columns={3}>
        <Field label={en ? 'Name *' : 'Όνομα *'}><input value={draft.name} disabled={locked} onChange={e => set({ name: e.target.value })} /></Field>
        <MultiSelect label={en ? 'Supplier categories' : 'Κατηγορίες προμηθευτών'} disabled={locked} tags options={SUPPLIER_CATEGORIES.map(item => ({ value: item.value, label: item.label[en ? 1 : 0] }))} selected={draft.categories || []} onChange={value => set({ categories: value })}
          placeholder={en ? 'Every supplier' : 'Όλοι οι προμηθευτές'} searchPlaceholder={en ? 'Search category' : 'Αναζήτηση κατηγορίας'} emptyLabel={en ? 'No match' : 'Δεν βρέθηκε'} selectAllLabel={en ? 'Select all' : 'Επιλογή όλων'} clearAllLabel={en ? 'Clear' : 'Καθαρισμός'} />
        <ChoiceField label={en ? 'Scale' : 'Κλίμακα'} value={Number(draft.scoreScale) === 10 ? 10 : 5} disabled={locked} options={[{ value: 5, label: en ? '1–5 (house scale)' : '1–5 (κλίμακα Limoxis)' }, { value: 10, label: en ? '0–10 (as in FileMaker)' : '0–10 (όπως στο FileMaker)' }]} onChange={value => set({ scoreScale: value })} />
        <Field label={en ? 'Approved from (%)' : 'Εγκεκριμένος από (%)'}><input type="number" min="0" max="100" step="0.5" value={draft.passThreshold} disabled={locked} onChange={e => set({ passThreshold: e.target.value })} /></Field>
        <Field label={en ? 'Conditional from (%)' : 'Υπό όρους από (%)'}><input type="number" min="0" max="100" step="0.5" value={draft.conditionalThreshold} disabled={locked} onChange={e => set({ conditionalThreshold: e.target.value })} /></Field>
        <Field label={en ? 'Evaluate every (months)' : 'Αξιολόγηση κάθε (μήνες)'}><input type="number" min="1" max="60" value={draft.frequencyMonths} disabled={locked} onChange={e => set({ frequencyMonths: e.target.value === '' ? '' : Number(e.target.value) })} /></Field>
        <CheckboxField label={en ? 'Active (offered for new evaluations)' : 'Ενεργό (προτείνεται σε νέες αξιολογήσεις)'} checked={draft.active !== false} disabled={locked} onChange={value => set({ active: value })} />
      </FormGrid>
      <Field label={en ? 'Description' : 'Περιγραφή'}><textarea rows={2} value={draft.description || ''} disabled={locked} onChange={e => set({ description: e.target.value })} /></Field>
      <SectionHeader title={en ? `Criteria ${draft.criteria.length}` : `Κριτήρια ${draft.criteria.length}`} subtitle={en ? `Weights add up to ${comma(total, en)}; the result is the weighted share of the points, so they need not add up to 1.` : `Τα βάρη αθροίζουν ${comma(total, en)}· το αποτέλεσμα είναι το σταθμισμένο ποσοστό, οπότε δεν χρειάζεται να αθροίζουν 1.`}
        actions={!locked && <Button variant="secondary" onClick={() => set({ criteria: [...draft.criteria, newCriterion()] })}><Plus size={15} />{en ? 'Criterion' : 'Κριτήριο'}</Button>} />
      <ol className="supplier-template-criteria">
        {draft.criteria.map((item, index) => <li key={item.id || index}>
          <span className="supplier-template-index">{index + 1}</span>
          <Field label={en ? 'Criterion *' : 'Κριτήριο *'}><input value={item.label} disabled={locked} onChange={e => setCriterion(index, { label: e.target.value })} /></Field>
          <Field label={en ? 'Description' : 'Περιγραφή'}><input value={item.description || ''} disabled={locked} onChange={e => setCriterion(index, { description: e.target.value })} /></Field>
          <Field label={en ? 'Weight *' : 'Βάρος *'}><input type="number" min="0" step="0.01" value={item.weight} disabled={locked} onChange={e => setCriterion(index, { weight: e.target.value })} /></Field>
          {!locked && <div className="row-actions supplier-template-moves">
            <IconButton size="sm" label={en ? 'Move up' : 'Μετακίνηση πάνω'} disabled={index === 0} onClick={() => set({ criteria: moveCriterion(draft.criteria, index, -1) })}><ArrowUp size={14} /></IconButton>
            <IconButton size="sm" label={en ? 'Move down' : 'Μετακίνηση κάτω'} disabled={index === draft.criteria.length - 1} onClick={() => set({ criteria: moveCriterion(draft.criteria, index, 1) })}><ArrowDown size={14} /></IconButton>
            <IconButton size="sm" tone="danger" label={en ? 'Remove criterion' : 'Αφαίρεση κριτηρίου'} onClick={() => set({ criteria: draft.criteria.filter((_, at) => at !== index) })}><Trash2 size={14} /></IconButton>
          </div>}
        </li>)}
      </ol>
      {!draft.criteria.length && <p className="inline-empty"><ListChecks size={15} /> {en ? 'Add the criteria of the template.' : 'Προσθέστε τα κριτήρια του προτύπου.'}</p>}
    </div>
  </ObserverDialog>
}
