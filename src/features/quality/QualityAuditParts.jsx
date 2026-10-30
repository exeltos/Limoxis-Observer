import { useEffect, useMemo, useState } from 'react'
import { ListChecks, Plus } from 'lucide-react'
import { PeriodStepper } from '../../design-system/PeriodStepper'
import { useDepartments } from '../management/useLibraries'
import { ChoiceField } from '../../design-system/ChoiceField'
import { Field } from '../../design-system/Field'
import { FormCard } from '../../design-system/FormCard'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import { formatDay } from '../../core/i18n/formatDay'
import { loadControlProgramme } from '../controls/controlCloudService'
import { auditChecklistFromControl, auditChecklistFromText, auditCompliance, auditMatrix, checklistTemplates } from './qualityAudit'
import { standardShort } from './audits/auditStandards'
import { AuditRounds } from './audits/AuditRounds'

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
export function AuditProgramme({ audits = [], language, onOpen, onPlan = null, onRound = null }) {
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
  const byDepartment = useMemo(() => {
    const map = new Map()
    audits.forEach(audit => { const key = String(audit.department || '').trim(); if (key) map.set(key, [...(map.get(key) || []), audit]) })
    return map
  }, [audits])
  const detail = row => {
    const list = (byDepartment.get(row.key) || []).filter(audit => audit.status !== 'cancelled' && audit.lifecycleStatus !== 'voided')
    const last = list.filter(audit => audit.status === 'completed').sort((a, b) => String(b.completedDate || b.plannedDate).localeCompare(String(a.completedDate || a.plannedDate)))[0]
    const next = list.filter(audit => ['planned', 'in_progress', 'inProgress'].includes(audit.status)).sort((a, b) => String(a.plannedDate).localeCompare(String(b.plannedDate)))[0]
    return { last, next, inYear: row.months.flat().filter(cell => cell.state !== 'cancelled').length }
  }
  const when = audit => (audit.plannedMonthOnly ? new Intl.DateTimeFormat(en ? 'en-GB' : 'el-GR', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${String(audit.plannedDate).slice(0, 7)}-15T12:00:00Z`)) : formatDay(audit.plannedDate, language))
  return <div className="quality-programme">
    <div className="quality-programme-summary">
     {/* Back to any earlier year; forward up to next year, to plan it. */}
     <PeriodStepper label={year} onPrevious={() => setYear(String(Number(year) - 1))} onNext={() => setYear(String(Number(year) + 1))} nextDisabled={Number(year) >= now.getFullYear() + 1} />
     <span className="quality-programme-progress"><strong>{done}</strong> {en ? `of ${active} completed` : `από ${active} ολοκληρώθηκαν`}</span>
     <ul className="quality-programme-legend">{STATE_ORDER.filter(state => matrix.totals[state] > 0).map(state => <li key={state}><span className={`quality-programme-dot is-${state}`} aria-hidden="true" />{STATE_LABELS[state][en ? 1 : 0]}<strong>{matrix.totals[state]}</strong></li>)}</ul>
     {departments.length > 0 && <button type="button" className={`quality-programme-coverage${uncovered.length ? ' is-gap' : ''}`} onClick={() => setScope(scope === 'all' ? 'audited' : 'all')} aria-pressed={scope === 'all'}>
      {uncovered.length ? (en ? `${uncovered.length} departments without an audit in ${year}` : `${uncovered.length} τμήματα χωρίς επιθεώρηση το ${year}`) : (en ? `Every department has an audit in ${year}` : `Όλα τα τμήματα έχουν επιθεώρηση το ${year}`)}
      <small>{scope === 'all' ? (en ? 'Show audited only' : 'Μόνο με επιθεώρηση') : (en ? 'Show all departments' : 'Όλα τα τμήματα')}</small>
     </button>}
    </div>
    <AuditRounds audits={audits} year={Number(year)} language={language} onRound={onRound} />
    <div className="quality-programme-scroll">
     <table className="quality-programme-table">
      <thead><tr>
       <th scope="col">{en ? 'Department' : 'Τμήμα'}</th>
       <th scope="col">{en ? 'Standard' : 'Πρότυπο'}</th>
       <th scope="col">{en ? 'Last audit' : 'Τελευταία'}</th>
       <th scope="col">{en ? 'Next audit' : 'Επόμενη'}</th>
       <th scope="col">{year}</th>
       <th scope="col">{en ? 'Months' : 'Μήνες'}</th>
       <th scope="col">{en ? 'Lead auditor' : 'Επικεφαλής'}</th>
      </tr></thead>
      <tbody>
       {rows.map(row => {
        const { last, next, inYear } = detail(row)
        const open = next || last
        const late = next && !next.plannedMonthOnly && next.plannedDate < todayIso
        const score = last ? auditCompliance(last) : null
        return <tr key={row.key || 'org'} className={`${row.key && !row.covered ? 'is-gap' : ''}${open ? ' is-clickable' : ''}`.trim()} onClick={open ? () => onOpen?.(open) : undefined}>
         <th scope="row"><span>{row.key ? (en ? row.nameEn : row.name) : (en ? 'Whole organization' : 'Όλος ο οργανισμός')}</span></th>
         <td className="nowrap-cell">{(open && open.standard) ? standardShort(open.standard) : '—'}</td>
         <td className="nowrap-cell">{last ? <>{formatDay(last.completedDate || last.plannedDate, language)}{score?.rate != null && <small>{score.rate}%</small>}</> : '—'}</td>
         <td className={`nowrap-cell${late ? ' quality-overdue' : ''}`}>{next ? <>{when(next)}{late && <small>{en ? 'Overdue' : 'Εκπρόθεσμη'}</small>}</> : (onPlan && row.key ? <button type="button" className="quality-programme-plan" onClick={event => { event.stopPropagation(); plan(row, Number(year) === now.getFullYear() ? Math.min(11, now.getMonth() + 1) : 0) }}><Plus size={13} aria-hidden="true" />{en ? 'Plan' : 'Προγραμματισμός'}</button> : <span className="quality-overdue-text">{en ? 'none planned' : 'δεν υπάρχει'}</span>)}</td>
         <td className={inYear >= 2 ? '' : 'quality-overdue-text'}><strong>{inYear}/2</strong></td>
         <td><span className="quality-programme-months" aria-hidden="true">{row.months.map((cell, month) => <span key={month} className={`quality-programme-dot${cell.length ? ` is-${cell[0].state}` : ' is-empty'}${month === currentMonth ? ' is-now' : ''}`} title={`${monthName(month, 'long')}${cell.length ? ` · ${STATE_LABELS[cell[0].state][en ? 1 : 0]}` : ''}`} />)}</span></td>
         <td>{open?.leadAuditor || '—'}</td>
        </tr>
       })}
       {!rows.length && <tr><td colSpan={7} className="quality-programme-empty">{en ? `No audit in ${year} yet.` : `Καμία επιθεώρηση το ${year} ακόμη.`}{onPlan && (en ? ' Show all departments to plan one.' : ' Δείτε όλα τα τμήματα για να προγραμματίσετε.')}</td></tr>}
      </tbody>
     </table>
    </div>
  </div>
}
