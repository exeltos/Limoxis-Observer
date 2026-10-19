import { useState } from 'react'
import { ObserverDialog, DialogActions } from '../../../design-system/ObserverDialog'
import { FormGrid } from '../../../design-system/FormCard'
import { ChoiceField } from '../../../design-system/ChoiceField'
import { CheckboxField } from '../../../design-system/CheckboxField'
import { ManualDateField } from '../../../design-system/ManualDateField'
import { RecordDetailsGrid } from '../../../design-system/RecordDetailsGrid'
import { QualityPersonField } from '../QualityFields'
import { FINDING_CLASSES, resultLabel, standardShort } from './auditStandards'
import { classesFor, findingDraftFromAnswer } from './auditModel'

const L = (en, el, english) => (en ? english : el)

// One answer → a quality finding (class, owner, due date) and, when ticked, its
// corrective action with its own owner and due date. Both point back at the
// audit; the answer keeps the finding's code. Closes with the × only.
export function AuditFindingDialog({ row, audit, language, saving, onClose, onCreate }) {
  const en = language === 'en'
  const classes = classesFor(row.answer)
  const [values, setValues] = useState(() => {
    const draft = findingDraftFromAnswer(audit, row, { language })
    return { findingClass: row.findingClass || classes[0] || 'minor', owner: '', dueDate: draft.dueDate, withCapa: row.findingClass === 'major', capaOwner: '', capaDueDate: draft.dueDate }
  })
  const set = next => setValues(current => {
    const merged = { ...current, ...next }
    if (next.findingClass) { const due = findingDraftFromAnswer(audit, { ...row, findingClass: next.findingClass }, { language }).dueDate; merged.dueDate = due; merged.capaDueDate = due }
    return merged
  })
  return <ObserverDialog width="wide" title={L(en, 'Εύρημα από την επιθεώρηση', 'Finding from the audit')} subtitle={`${standardShort(audit.standard)} ${row.clauseRef || ''}`.trim()} onClose={onClose}
    footer={<DialogActions onSave={() => onCreate(values)} disabled={saving} saveLabel={values.withCapa ? L(en, 'Δημιουργία ευρήματος και CAPA', 'Create finding and CAPA') : L(en, 'Δημιουργία ευρήματος', 'Create finding')} />}>
    <RecordDetailsGrid fields={[
      { id: 'q', label: L(en, 'Ερώτηση', 'Question'), value: row.item, className: 'is-wide' },
      { id: 'a', label: L(en, 'Αποτέλεσμα', 'Result'), value: resultLabel(row.answer, language) },
      { id: 'n', label: L(en, 'Διαπίστωση', 'What was found'), value: row.note },
      { id: 'e', label: L(en, 'Τεκμήρια', 'Evidence'), value: row.evidence },
    ]} />
    <FormGrid columns={3}>
      <ChoiceField label={L(en, 'Κατάταξη', 'Class')} value={values.findingClass} options={FINDING_CLASSES.filter(item => classes.includes(item.value)).map(item => ({ value: item.value, label: item.label[en ? 1 : 0] }))} onChange={findingClass => set({ findingClass })} />
      <QualityPersonField label={L(en, 'Υπεύθυνος ευρήματος', 'Finding owner')} name={values.owner} department={audit.department} onChange={({ name }) => set({ owner: name })} />
      <ManualDateField label={L(en, 'Προθεσμία', 'Due date')} value={values.dueDate} onChange={dueDate => set({ dueDate })} />
      <CheckboxField label={L(en, 'Άνοιγμα διορθωτικής ενέργειας (CAPA)', 'Open a corrective action (CAPA)')} checked={values.withCapa} onChange={withCapa => set({ withCapa })} />
      {values.withCapa && <QualityPersonField label={L(en, 'Υπεύθυνος CAPA', 'CAPA owner')} name={values.capaOwner || values.owner} department={audit.department} onChange={({ name }) => set({ capaOwner: name })} />}
      {values.withCapa && <ManualDateField label={L(en, 'Προθεσμία CAPA', 'CAPA due date')} value={values.capaDueDate} onChange={capaDueDate => set({ capaDueDate })} />}
    </FormGrid>
  </ObserverDialog>
}
