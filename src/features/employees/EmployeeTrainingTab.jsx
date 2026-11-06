import { useEffect, useMemo, useRef, useState } from 'react'
import { normalizeTrainingQuestion } from '../training/trainingAssessment'
import { formatActiveTime, loadProgramMaterialTimes } from '../training/trainingMaterialTime'
import { Button } from '../../design-system/Button'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { ExcelFieldsDialog, pickColumns, tableFields } from '../../design-system/ExcelFieldsDialog'
import { printReport } from '../../core/export/reportDocument'
import { exportRegistry } from '../../core/export/registryExports'
import { employeeTrainingDoc } from '../training/trainingReports'
import { RegistryTotals } from '../../design-system/RegistryTotals'
import { useContextualNavigation } from '../../core/navigation/useContextualNavigation'
import { useEmployeeSubRecords } from './useEmployeeSubRecords'
import { loadEmployeeTrainingAsync } from './employeeSubRecordsService'
import {
  SectionTitle,
  Empty,
  State,
  Pager,
  RegistryFilter,
  useRegistryRows,
  statusClass,
  label,
} from './employeeRecordShared'

// Training tab of the employee record: programmes, attendance and questionnaire answers.

export function EmployeeTrainingTab({
  employee,
  t,
  language,
  fmt,
  organizationId,
  canOpenProgram = false,
  onExportItems,
}) {
  const { goTo } = useContextualNavigation('/training')
  const state = useEmployeeSubRecords(
    loadEmployeeTrainingAsync,
    organizationId,
    employee.dbId,
    employee.id,
  )
  const [selected, setSelected] = useState(null)
  // The active time the employee spent on the programme's files (only the personal link records it; imported
  // attendance has none, so «—»).
  const [watched, setWatched] = useState(null)
  useEffect(() => {
    setWatched(null)
    if (!selected?.programDbId || !selected?.assignmentDbId) return undefined
    let live = true
    loadProgramMaterialTimes(selected.programDbId)
      .then(rows => { if (live) setWatched(rows.filter(row => row.assignment_id === selected.assignmentDbId).reduce((sum, row) => sum + (row.active_seconds || 0), 0)) })
      .catch(() => {})
    return () => { live = false }
  }, [selected?.programDbId, selected?.assignmentDbId])
  // Newest first; the print and the Excel carry the same rows.
  const rows = useMemo(() => [...(state.data || [])].sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))), [state.data])
  const registry = useRegistryRows(rows)
  const [excelOpen, setExcelOpen] = useState(false)
  const en = language === 'en'
  const titleOf = row => (en ? row.titleEn || row.titleEl : row.titleEl || row.titleEn)
  const hoursText = value => (value ? String(Math.round(Number(value) * 10) / 10).replace('.', ',') : '')
  const historyRows = () => registry.filtered.map(row => ({ title: titleOf(row), organiser: row.organiser, date: row.date, hours: row.hours, done: row.status === 'completed', statusLabel: label(row.status, t), score: row.score != null ? `${row.score}%` : '' }))
  const employeeName = en ? `${employee.firstNameEn || employee.firstName} ${employee.lastNameEn || employee.lastName}` : `${employee.lastName} ${employee.firstName}`
  const historyTable = () => ({ name: `${en ? 'training' : 'ekpaideusi'}-${employee.id}`, headers: en ? ['Training', 'Organiser', 'Date', 'Hours', 'Status', 'Score'] : ['Εκπαίδευση', 'Διοργανωτής', 'Ημερομηνία', 'Ώρες', 'Κατάσταση', 'Βαθμολογία'], rows: historyRows().map(r => [r.title, r.organiser || '', fmt(r.date), hoursText(r.hours), r.statusLabel, r.score]) })
  const exportItems = [
    { id: 'training-history-print', kind: 'print', disabled: !registry.filtered.length, label: en ? 'Print: training' : 'Εκτύπωση: εκπαιδεύσεις', onClick: () => printReport(employeeTrainingDoc({ employeeName, employeeCode: employee.id, department: en ? employee.departmentEn || employee.department : employee.department, rows: historyRows(), language })) },
    { id: 'training-history-excel', kind: 'excel', disabled: !registry.filtered.length, label: en ? 'Excel: training' : 'Excel: εκπαιδεύσεις', onClick: () => setExcelOpen(true) },
  ]
  // The items go to the page's single «Εξαγωγή» (header), not to a second menu here.
  const exportRef = useRef(exportItems)
  exportRef.current = exportItems
  useEffect(() => {
    onExportItems?.(exportRef.current.map(item => ({ ...item, onClick: () => exportRef.current.find(current => current.id === item.id)?.onClick() })))
    return () => onExportItems?.([])
  }, [onExportItems, registry.filtered.length, language])
  const paging = registry.paging
  // A column that is empty for every training (e.g. no scores in imported history) is not shown.
  const hasOrganiser = rows.some(row => row.organiser)
  const hasHours = rows.some(row => Number(row.hours) > 0)
  const hasScore = rows.some(row => row.score != null)
  return (
    <section className="record-section record-secondary-registry">
      <SectionTitle
        title={language === 'en' ? 'Training' : 'Εκπαίδευση'}
        subtitle={
          language === 'en'
            ? 'Assignments and completion data come directly from Training programmes.'
            : 'Οι αναθέσεις και οι ολοκληρώσεις αντλούνται απευθείας από τα προγράμματα Εκπαίδευσης.'
        }
      />
      {excelOpen && <ExcelFieldsDialog storageKey="limoxis.employee.training.excel" fields={tableFields(historyTable())} onClose={() => setExcelOpen(false)} onConfirm={keys => { exportRegistry(pickColumns(historyTable(), keys)); setExcelOpen(false) }} />}
      <State {...state} language={language} onRetry={state.reload} />
      {!state.loading && !state.error && (
        <RegistryFilter
          query={registry.query}
          setQuery={registry.setQuery}
          language={language}
          count={registry.filtered.length}
          end={<><RegistryTotals label={en ? 'Totals' : 'Σύνολα'} items={[
            { key: 'all', always: true, value: registry.filtered.length, label: en ? 'trainings' : 'εκπαιδεύσεις' },
            { key: 'done', value: registry.filtered.filter(row => row.status === 'completed').length, label: en ? 'completed' : 'ολοκληρωμένες' },
            { key: 'hours', value: Math.round(registry.filtered.filter(row => row.status === 'completed').reduce((sum, row) => sum + (Number(row.hours) || 0), 0)), label: en ? 'hours' : 'ώρες' },
          ]} /></>}
        />
      )}
      {!state.loading &&
        !state.error &&
        (registry.filtered.length ? (
          <>
            <div className="scroll-table">
              <table className="data-table sticky-table record-table-clickable">
                <thead>
                  <tr>
                    <th>{language === 'en' ? 'Training' : 'Εκπαίδευση'}</th>
                    {hasOrganiser && <th>{language === 'en' ? 'Organiser' : 'Διοργανωτής'}</th>}
                    <th>{language === 'en' ? 'Date' : 'Ημερομηνία'}</th>
                    {hasHours && <th>{language === 'en' ? 'Hours' : 'Ώρες'}</th>}
                    <th>{language === 'en' ? 'Status' : 'Κατάσταση'}</th>
                    {hasScore && <th>{language === 'en' ? 'Score' : 'Βαθμολογία'}</th>}
                  </tr>
                </thead>
                <tbody>
                  {paging.paged.map(row => (
                    <tr
                      key={row.id}
                      tabIndex={0}
                      onClick={() => setSelected(row)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setSelected(row)
                        }
                      }}
                    >
                      <td>
                        <strong>
                          {language === 'el'
                            ? row.titleEl || row.titleEn
                            : row.titleEn || row.titleEl}
                        </strong>
                      </td>
                      {hasOrganiser && <td>{row.organiser || '—'}</td>}
                      <td>{fmt(row.date)}</td>
                      {hasHours && <td>{hoursText(row.hours) || '—'}</td>}
                      <td>
                        <span className={`status-badge ${statusClass(row.status)}`}>
                          {label(row.status, t)}
                        </span>
                      </td>
                      {hasScore && <td>{row.score != null ? `${row.score}%` : '—'}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager paging={paging} total={registry.filtered.length} language={language} />
          </>
        ) : (
          <Empty
            language={language}
            title={language === 'en' ? 'No training records' : 'Δεν υπάρχουν εκπαιδεύσεις'}
          />
        ))}
      {selected && (
        <ObserverDialog
          width="wide"
          eyebrow={language === 'en' ? 'Employee training' : 'Εκπαίδευση εργαζομένου'}
          title={
            language === 'el'
              ? selected.titleEl || selected.titleEn
              : selected.titleEn || selected.titleEl
          }
          subtitle={fmt(selected.date)}
          onClose={() => setSelected(null)}
          footer={
            canOpenProgram && selected.programId ? (
              <Button
                onClick={() =>
                  goTo(`/training/${selected.programId}`, {
                    tab: 'training',
                    returnTo: `/employees/${encodeURIComponent(employee.id)}`,
                    returnTab: 'training',
                  })
                }
              >
                {language === 'en' ? 'Open training programme' : 'Άνοιγμα εκπαίδευσης'}
              </Button>
            ) : undefined
          }
        >
          <dl className="employee-training-facts">
            <div><dt>{language === 'en' ? 'Status' : 'Κατάσταση'}</dt><dd><span className={`status-badge ${statusClass(selected.status)}`}>{label(selected.status, t)}</span></dd></div>
            {selected.organiser && <div><dt>{language === 'en' ? 'Organiser' : 'Διοργανωτής'}</dt><dd>{selected.organiser}</dd></div>}
            {Number(selected.hours) > 0 && <div><dt>{language === 'en' ? 'Hours' : 'Ώρες'}</dt><dd>{hoursText(selected.hours)}</dd></div>}
            <div><dt>{language === 'en' ? 'Assigned' : 'Ανάθεση'}</dt><dd>{fmt(selected.assignedDate)}</dd></div>
            <div><dt>{language === 'en' ? 'Completed' : 'Ολοκλήρωση'}</dt><dd>{fmt(selected.completedDate)}</dd></div>
            {selected.dueDate && <div><dt>{language === 'en' ? 'Due' : 'Προθεσμία'}</dt><dd>{fmt(selected.dueDate)}</dd></div>}
            {selected.score != null && <div><dt>{language === 'en' ? 'Knowledge assessment' : 'Αξιολόγηση γνώσεων'}</dt><dd>{selected.score}% · {selected.score >= 80 ? (language === 'en' ? 'Successful' : 'Επιτυχής') : (language === 'en' ? 'Review required' : 'Απαιτείται επανέλεγχος')}</dd></div>}
            {watched > 0 && <div><dt>{language === 'en' ? 'Time on the material' : 'Χρόνος παρακολούθησης'}</dt><dd>{formatActiveTime(watched, language === 'en')}</dd></div>}
            {selected.materialCount > 0 && <div><dt>{language === 'en' ? 'Material' : 'Υλικό'}</dt><dd>{selected.materialCount} {language === 'en' ? (selected.materialCount === 1 ? 'file' : 'files') : (selected.materialCount === 1 ? 'αρχείο' : 'αρχεία')}</dd></div>}
          </dl>
        </ObserverDialog>
      )}
    </section>
  )
}

export function trainingAnswerText(question, answer, en) {
  const q = normalizeTrainingQuestion(question)
  if (answer === undefined || answer === null || answer === '') return '—'
  if (q.type === 'single_choice')
    return q.options.find(option => option.id === answer)?.text || String(answer)
  if (q.type === 'multiple_choice')
    return (
      (Array.isArray(answer) ? answer : [])
        .map(value => q.options.find(option => option.id === value)?.text || String(value))
        .join(', ') || '—'
    )
  if (q.type === 'true_false') {
    const value = answer === true || answer === 'true' || answer === 1 || answer === '1'
    return value ? (en ? 'True' : 'Σωστό') : en ? 'False' : 'Λάθος'
  }
  return String(answer)
}
