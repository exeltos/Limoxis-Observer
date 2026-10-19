import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ListChecks, Plus } from 'lucide-react'
import { Meter } from '../../design-system/MiniCharts'
import { PeriodStepper } from '../../design-system/PeriodStepper'
import { useDepartments } from '../management/useLibraries'
import { ChoiceField } from '../../design-system/ChoiceField'
import { Field } from '../../design-system/Field'
import { FormCard } from '../../design-system/FormCard'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import { formatDay } from '../../core/i18n/formatDay'
import { loadControlProgramme } from '../controls/controlCloudService'
import { auditChecklistFromControl, auditChecklistFromText, auditCompliance, auditMatrix, checklistTemplates } from './qualityAudit'
import { qualityCode } from './qualityVocabulary'
import { standardShort } from './audits/auditStandards'

// The controls that are checklists, offered as audit checklists.
function useChecklistTemplates(organizationId) {
  const [templates, setTemplates] = useState([])
  useEffect(() => {
    let active = true
    loadControlProgramme(organizationId, { summary: false }).then(controls => { if (active) setTemplates(checklistTemplates(controls)) }).catch(() => { if (active) setTemplates([]) })
    return () => { active = false }
  }, [organizationId])
  return templates
}

// New audit: the checklist from a control that is a checklist, or typed here.
export function AuditChecklistSource({ draft, setDraft, organizationId, language }) {
  const en = language === 'en'
  const templates = useChecklistTemplates(organizationId)
  const [mode, setMode] = useState(draft.checklistSource === 'manual' ? 'manual' : 'template')
  const [text, setText] = useState('')
  const templateId = String(draft.checklistSource || '').startsWith('control:') ? draft.checklistSource.slice(8) : ''
  const options = useMemo(() => templates.map(control => ({ value: String(control.id), label: en ? control.titleEn || control.title : control.title, description: `${control.responseConfig.checklist.length} ${en ? 'items' : 'σημεία'}` })), [templates, en])
  const chooseTemplate = id => {
    const control = templates.find(item => String(item.id) === id)
    setDraft(current => ({ ...current, checklistSource: control ? `control:${control.id}` : '', checklist: control ? auditChecklistFromControl(control) : [] }))
  }
  const typeItems = value => { setText(value); setDraft(current => ({ ...current, checklistSource: 'manual', checklist: auditChecklistFromText(value) })) }
  return <FormCard wide title={en ? 'Checklist' : 'Λίστα ελέγχου'} icon={ListChecks} hint={draft.checklist?.length ? (en ? `${draft.checklist.length} items` : `${draft.checklist.length} σημεία`) : en ? 'Optional; can be added later.' : 'Προαιρετικά· προστίθεται και αργότερα.'}>
    <ChoiceField label={en ? 'Items from' : 'Σημεία από'} value={mode} options={[{ value: 'template', label: en ? 'A checklist in Controls' : 'Λίστα ελέγχου των Ελέγχων' }, { value: 'manual', label: en ? 'Typed here' : 'Τα γράφω εδώ' }]} onChange={value => { setMode(value); setDraft(current => ({ ...current, checklistSource: '', checklist: [] })); setText('') }} />
    {mode === 'template'
      ? <SearchableSelect label={en ? 'Checklist' : 'Λίστα ελέγχου'} value={templateId} options={options} onChange={chooseTemplate} placeholder={templates.length ? (en ? 'Choose a checklist' : 'Επιλέξτε λίστα') : en ? 'No checklist in Controls yet' : 'Δεν υπάρχει ακόμη λίστα ελέγχου στους Ελέγχους'} emptyLabel={en ? 'No match' : 'Δεν βρέθηκε'} clearLabel={en ? 'Clear' : 'Καθαρισμός'} />
      : <Field label={en ? 'Items, one per line' : 'Σημεία, ένα ανά γραμμή'}><textarea rows={5} value={text} onChange={event => typeItems(event.target.value)} placeholder={en ? 'e.g. Hand rub available at the bedside' : 'π.χ. Διαθέσιμο αντισηπτικό δίπλα στην κλίνη'} /></Field>}
    {draft.checklist?.length > 0 && <ol className="quality-audit-preview">{draft.checklist.slice(0, 6).map(row => <li key={row.id}>{en ? row.itemEn || row.item : row.item}</li>)}{draft.checklist.length > 6 && <li className="is-more">{en ? `and ${draft.checklist.length - 6} more` : `και ${draft.checklist.length - 6} ακόμη`}</li>}</ol>}
  </FormCard>
}

const STATE_LABELS = { done: ['Ολοκληρώθηκε', 'Completed'], running: ['Σε εξέλιξη', 'In progress'], late: ['Εκπρόθεσμη', 'Overdue'], planned: ['Προγραμματισμένη', 'Planned'], cancelled: ['Ακυρώθηκε', 'Cancelled'] }
const STATE_ORDER = ['done', 'running', 'late', 'planned', 'cancelled']

// The year's programme (ISO 9001 §9.2): departments down, months across. Each
// audit is a chip coloured by where it stands (done with its compliance, late,
// planned); a department without an audit this year is flagged; an empty cell
// plans a new audit for that department and month.
export function AuditProgramme({ audits = [], language, onOpen, onPlan = null }) {
  const en = language === 'en'
  const { departments } = useDepartments()
  const now = new Date()
  const todayIso = now.toISOString().slice(0, 10)
  const [year, setYear] = useState(() => String(now.getFullYear()))
  const [scope, setScope] = useState('audited')
  const matrix = useMemo(() => auditMatrix(audits, Number(year), departments, todayIso), [audits, year, departments, todayIso])
  const monthName = (month, style) => new Intl.DateTimeFormat(en ? 'en-GB' : 'el-GR', { month: style }).format(new Date(Date.UTC(2026, month, 15)))
  const currentMonth = String(now.getFullYear()) === year ? now.getMonth() : -1
  const uncovered = matrix.rows.filter(row => row.key && !row.covered)
  const rows = scope === 'all' ? matrix.rows : matrix.rows.filter(row => row.covered)
  const done = matrix.totals.done, active = matrix.total - matrix.totals.cancelled
  const plan = (row, month) => onPlan?.({ department: row.name, departmentEn: row.nameEn, departmentId: row.id, plannedDate: `${year}-${String(month + 1).padStart(2, '0')}-15` })
  return <div className="quality-programme">
    <div className="quality-programme-head">
     <div className="quality-programme-title"><CalendarDays size={16} aria-hidden="true" /><strong>{en ? 'Audit programme' : 'Πρόγραμμα επιθεωρήσεων'}</strong></div>
     {/* Back to any earlier year; forward up to next year, to plan it. */}
     <PeriodStepper label={year} onPrevious={() => setYear(String(Number(year) - 1))} onNext={() => setYear(String(Number(year) + 1))} nextDisabled={Number(year) >= now.getFullYear() + 1} />
    </div>
    <div className="quality-programme-summary">
     <div className="quality-programme-progress">
      <span><strong>{done}</strong> {en ? `of ${active} completed` : `από ${active} ολοκληρώθηκαν`}</span>
      <Meter value={active ? done * 100 / active : 0} tone={done === active && active ? 'success' : 'neutral'} label={en ? `${done} of ${active} audits completed` : `${done} από ${active} επιθεωρήσεις ολοκληρώθηκαν`} />
     </div>
     <ul className="quality-programme-legend">{STATE_ORDER.map(state => <li key={state}><span className={`quality-programme-dot is-${state}`} aria-hidden="true" />{STATE_LABELS[state][en ? 1 : 0]}<strong>{matrix.totals[state]}</strong></li>)}</ul>
     {departments.length > 0 && <button type="button" className={`quality-programme-coverage${uncovered.length ? ' is-gap' : ''}`} onClick={() => setScope(scope === 'all' ? 'audited' : 'all')} aria-pressed={scope === 'all'}>
      {uncovered.length ? (en ? `${uncovered.length} departments without an audit in ${year}` : `${uncovered.length} τμήματα χωρίς επιθεώρηση το ${year}`) : (en ? `Every department has an audit in ${year}` : `Όλα τα τμήματα έχουν επιθεώρηση το ${year}`)}
      <small>{scope === 'all' ? (en ? 'Show audited only' : 'Μόνο με επιθεώρηση') : (en ? 'Show all departments' : 'Όλα τα τμήματα')}</small>
     </button>}
    </div>
    <div className="quality-programme-scroll">
     <table className="quality-programme-grid">
      <thead><tr><th scope="col">{en ? 'Department' : 'Τμήμα'}</th>{Array.from({ length: 12 }, (_, month) => <th key={month} scope="col" className={month === currentMonth ? 'is-now' : ''} title={monthName(month, 'long')}>{monthName(month, 'short').replace('.', '')}</th>)}</tr></thead>
      <tbody>
       {rows.map(row => <tr key={row.key || 'org'} className={row.key && !row.covered ? 'is-gap' : ''}>
        <th scope="row"><span>{row.key ? (en ? row.nameEn : row.name) : (en ? 'Whole organization' : 'Όλος ο οργανισμός')}</span><small>{row.covered ? (en ? `${row.count} ${row.count === 1 ? 'audit' : 'audits'}` : `${row.count} ${row.count === 1 ? 'επιθεώρηση' : 'επιθεωρήσεις'}`) : (en ? 'No audit this year' : 'Καμία φέτος')}</small></th>
        {row.months.map((cell, month) => <td key={month} className={month === currentMonth ? 'is-now' : ''}>
         {cell.map(({ audit, state }) => { const score = auditCompliance(audit); const title = en ? audit.titleEn || audit.title : audit.title
          return <button type="button" key={audit.id} className={`quality-programme-chip is-${state}`} onClick={() => onOpen?.(audit)} title={[qualityCode(audit, language), audit.standard && standardShort(audit.standard), title, audit.plannedMonthOnly ? (en ? 'day to be fixed' : 'η ημέρα θα οριστεί') : formatDay(audit.plannedDate, language), STATE_LABELS[state][en ? 1 : 0], score.rate != null && `${score.rate}%`].filter(Boolean).join(' · ')} aria-label={`${qualityCode(audit, language)} · ${title}`}>
           {/* A narrow cell holds the day (or the compliance) and the standard or code; the title is in the tooltip. */}
           <strong>{state === 'done' && score.rate != null ? `${score.rate}%` : audit.plannedMonthOnly ? (en ? 'month' : 'μήνας') : String(audit.plannedDate || '').slice(8, 10).replace(/^0/, '')}</strong><span className="quality-programme-code">{audit.standard ? standardShort(audit.standard) : qualityCode(audit, language)}</span>
          </button> })}
         {!cell.length && onPlan && row.key && <button type="button" className="quality-programme-add" onClick={() => plan(row, month)} aria-label={en ? `Plan an audit: ${row.nameEn}, ${monthName(month, 'long')}` : `Προγραμματισμός επιθεώρησης: ${row.name}, ${monthName(month, 'long')}`}><Plus size={13} aria-hidden="true" /></button>}
        </td>)}
       </tr>)}
       {!rows.length && <tr><td colSpan={13} className="quality-programme-empty">{en ? `No audit in ${year} yet.` : `Καμία επιθεώρηση το ${year} ακόμη.`}{onPlan && (en ? ' Show all departments to plan one.' : ' Δείτε όλα τα τμήματα για να προγραμματίσετε.')}</td></tr>}
      </tbody>
     </table>
    </div>
    <p className="quality-programme-hint">{en ? 'The number on a chip is the planned day; on a completed audit, its compliance. Select an empty cell to plan an audit for that department and month.' : 'Ο αριθμός είναι η ημέρα της επιθεώρησης· σε ολοκληρωμένη, η συμμόρφωσή της. Επιλέξτε κενό κελί για να προγραμματίσετε επιθεώρηση στο τμήμα και τον μήνα.'}</p>
  </div>
}
