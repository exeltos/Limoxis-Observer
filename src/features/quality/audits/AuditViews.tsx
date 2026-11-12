import { useMemo, useState } from 'react'
import { AlertTriangle, BarChart3, Grid3X3 } from 'lucide-react'
import { MoreSection } from '../../../design-system/MoreSection'
import { formatDay } from '../../../core/i18n/formatDay'
import { PeriodStepper } from '../../../design-system/PeriodStepper'
import { FilterSelect } from '../../../design-system/FilterBar'
import { RecordMetricStrip } from '../../../design-system/RecordMetricStrip'
import { SectionHeader } from '../../../design-system/SectionHeader'
import { StatusBadge } from '../../../design-system/StatusBadge'
import { Meter, Sparkline, meterTone } from '../../../design-system/MiniCharts'
import { useDepartments } from '../../management/useLibraries'
import { useTenant } from '../../../core/tenant/TenantContext'
import { useAuditTemplates } from './useAuditTemplates'
import { FINDING_CLASSES, findingClassTone, standardLabel, standardShort } from './auditStandards'
import { auditDashboard, auditReadiness, clauseCoverage } from './auditModel'
import './audits.css'

const L = (en, el, english) => (en ? english : el)
const thisYear = () => new Date().getFullYear()

// The year's clause coverage of one standard: its questionnaire's chapters
// across, the departments audited for it down; a cell is the chapter's
// compliance where it was audited, «planned» where an audit to come covers it,
// a gap otherwise. Chapters no department covered are named above the grid.
export function AuditCoverage({ audits = [], language }) {
  const en = language === 'en'
  const { tenant } = useTenant()
  const { templates } = useAuditTemplates(tenant?.id)
  const { departments } = useDepartments()
  const [year, setYear] = useState(thisYear)
  const standards = useMemo(() => [...new Set(templates.map(item => item.standard))], [templates])
  const used = [...new Set(audits.map(audit => audit.standard).filter(Boolean))]
  const [standard, setStandard] = useState(() => used[0] || 'iso9001')
  // The questionnaire of the standard: the one the year's audits used most, else the library's.
  const template = useMemo(() => {
    const counts = new Map()
    for (const audit of audits) if (audit.standard === standard && audit.templateId) counts.set(audit.templateId, (counts.get(audit.templateId) || 0) + 1)
    const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
    return templates.find(item => item.id === best) || templates.find(item => item.standard === standard && item.isSystem) || templates.find(item => item.standard === standard) || null
  }, [audits, templates, standard])
  const coverage = useMemo(() => (template ? clauseCoverage(audits, template, year, departments) : null), [audits, template, year, departments])
  return <div className="audit-view">
    <div className="audit-view-head">
      <div className="quality-programme-title"><Grid3X3 size={16} aria-hidden="true" /><strong>{L(en, 'Κάλυψη άρθρων', 'Clause coverage')}</strong></div>
      <FilterSelect label={L(en, 'Πρότυπο', 'Standard')} value={standard} onChange={setStandard}>{(standards.length ? standards : ['iso9001']).map(value => <option key={value} value={value}>{standardLabel(value, language)}</option>)}</FilterSelect>
      <PeriodStepper label={String(year)} onPrevious={() => setYear(year - 1)} onNext={() => setYear(year + 1)} nextDisabled={year >= thisYear() + 1} />
    </div>
    {!coverage ? <div className="inline-empty">{L(en, 'Δεν υπάρχει ερωτηματολόγιο για αυτό το πρότυπο.', 'No questionnaire for this standard.')}</div> : <>
      <p className="audit-view-hint">{template.title} · {L(en, `${coverage.chapters.length} κεφάλαια, ${coverage.rows.length} τμήματα με επιθεώρηση ${standardShort(standard)} το ${year}`, `${coverage.chapters.length} chapters, ${coverage.rows.length} departments audited for ${standardShort(standard)} in ${year}`)}</p>
      {coverage.uncovered.length > 0 && coverage.rows.length > 0 && <div className="governance-banner warning"><AlertTriangle size={16} aria-hidden="true" /><span>{L(en, `Κεφάλαια χωρίς επιθεώρηση φέτος: ${coverage.uncovered.join(', ')}.`, `Chapters not audited this year: ${coverage.uncovered.join(', ')}.`)}</span></div>}
      {coverage.rows.length ? <div className="quality-programme-scroll">
        <table className="audit-coverage-grid">
          <thead><tr><th scope="col">{L(en, 'Τμήμα', 'Department')}</th>{coverage.chapters.map(chapter => <th key={chapter.ref} scope="col" title={chapter.title}>{chapter.ref}<small>{chapter.title}</small></th>)}</tr></thead>
          <tbody>
            {coverage.rows.map(row => <tr key={row.department || 'org'}>
              <th scope="row"><span>{row.department ? (en ? row.departmentEn : row.department) : L(en, 'Όλος ο οργανισμός', 'Whole organization')}</span><small>{L(en, `${row.audits} επιθεωρήσεις`, `${row.audits} audits`)}</small></th>
              {row.cells.map(cell => <td key={cell.ref} className={`is-${cell.state}${cell.state === 'audited' ? ` is-${meterTone(cell.rate)}` : ''}`} title={cell.state === 'audited' ? `${cell.answered} ${L(en, 'απαντήσεις', 'answers')}` : undefined}>
                {cell.state === 'audited' ? `${cell.rate ?? '—'}%` : cell.state === 'planned' ? L(en, 'Προγρ.', 'Planned') : '—'}
              </td>)}
            </tr>)}
          </tbody>
          <tfoot><tr><th scope="row">{L(en, 'Τμήματα με επιθεώρηση', 'Departments audited')}</th>{coverage.totals.map(total => <td key={total.ref} className={total.audited ? '' : 'is-gap'}>{total.audited}/{coverage.rows.length}</td>)}</tr></tfoot>
        </table>
      </div> : <div className="inline-empty">{L(en, `Καμία επιθεώρηση ${standardShort(standard)} το ${year}.`, `No ${standardShort(standard)} audit in ${year}.`)}</div>}
      <ul className="quality-programme-legend"><li><span className="audit-coverage-dot is-audited" />{L(en, 'Επιθεωρήθηκε (συμμόρφωση)', 'Audited (compliance)')}</li><li><span className="audit-coverage-dot is-planned" />{L(en, 'Προγραμματίστηκε', 'Planned')}</li><li><span className="audit-coverage-dot is-gap" />{L(en, 'Κενό', 'Gap')}</li></ul>
    </>}
  </div>
}

// The audit dashboard: the year's compliance by standard, department and
// chapter, the trend of the last twelve months and the open findings by class.
export function AuditDashboard({ audits = [], findings = [], language }) {
  const en = language === 'en'
  const [year, setYear] = useState(thisYear)
  const used = [...new Set(audits.map(audit => audit.standard).filter(Boolean))]
  const [standard, setStandard] = useState(() => used.includes('jci') ? 'jci' : used[0] || '')
  const data = useMemo(() => auditDashboard(audits, findings, { year, standard }), [audits, findings, year, standard])
  const bars = (items, labelOf) => items.length ? <ul className="audit-bars">{items.map(item => <li key={item.key ?? item.ref}><span>{labelOf(item)}</span><Meter value={item.rate} tone={meterTone(item.rate)} label={`${labelOf(item)} ${item.rate ?? '—'}%`} /><strong>{item.rate == null ? '—' : `${item.rate}%`}</strong>{item.audits != null && <small>{item.audits}</small>}</li>)}</ul> : <p className="inline-empty">{L(en, 'Δεν υπάρχουν ολοκληρωμένες απαντήσεις.', 'No answers yet.')}</p>
  const monthName = value => new Intl.DateTimeFormat(en ? 'en-GB' : 'el-GR', { month: 'short' }).format(new Date(`${value}-15T12:00:00Z`)).replace('.', '')
  return <div className="audit-view">
    <div className="audit-view-head">
      <div className="quality-programme-title"><BarChart3 size={16} aria-hidden="true" /><strong>{L(en, 'Πίνακας επιθεωρήσεων', 'Audit dashboard')}</strong></div>
      <PeriodStepper label={String(year)} onPrevious={() => setYear(year - 1)} onNext={() => setYear(year + 1)} nextDisabled={year >= thisYear()} />
    </div>
    <RecordMetricStrip items={[
      { id: 'audits', label: L(en, 'Επιθεωρήσεις με απαντήσεις', 'Audits with answers'), value: data.audits },
      { id: 'rate', label: L(en, 'Μέση συμμόρφωση', 'Average compliance'), value: data.rate == null ? '—' : `${data.rate}%`, meter: data.rate, tone: data.rate == null ? undefined : meterTone(data.rate), primary: true },
      { id: 'findings', label: L(en, 'Ευρήματα επιθεωρήσεων', 'Audit findings'), value: data.findings },
      { id: 'open', label: L(en, 'Ανοιχτά ευρήματα', 'Open findings'), value: data.openFindings, tone: data.openFindings ? 'warning' : undefined },
      { id: 'overdue', label: L(en, 'Εκπρόθεσμα', 'Overdue'), value: data.overdueFindings, tone: data.overdueFindings ? 'danger' : undefined },
    ]} />
    <div className="audit-dashboard-grid">
      <section className="audit-panel"><SectionHeader title={L(en, 'Συμμόρφωση ανά πρότυπο', 'Compliance by standard')} />{bars(data.byStandard, item => standardShort(item.key) || L(en, 'Χωρίς πρότυπο', 'No standard'))}</section>
      <section className="audit-panel"><SectionHeader title={L(en, 'Συμμόρφωση ανά τμήμα', 'Compliance by department')} />{bars(data.byDepartment, item => item.key || L(en, 'Όλος ο οργανισμός', 'Whole organization'))}</section>
      <section className="audit-panel"><SectionHeader title={L(en, 'Συμμόρφωση ανά κεφάλαιο', 'Compliance by chapter')} actions={<FilterSelect label={L(en, 'Πρότυπο', 'Standard')} value={data.standard} onChange={setStandard}>{(used.length ? used : ['iso9001']).map(value => <option key={value} value={value}>{standardShort(value)}</option>)}</FilterSelect>} />{bars(data.byChapter, item => [item.ref, item.title].filter(Boolean).join(' · '))}</section>
      <section className="audit-panel"><SectionHeader title={L(en, 'Τάση 12 μηνών', '12-month trend')} subtitle={L(en, 'Μέση συμμόρφωση των επιθεωρήσεων που ολοκληρώθηκαν κάθε μήνα', 'Average compliance of the audits completed each month')} />
        <Sparkline points={data.trend.map(item => item.rate)} target={90} width={320} height={60} label={L(en, 'Τάση συμμόρφωσης', 'Compliance trend')} />
        <ol className="audit-trend">{data.trend.map(item => <li key={item.month} className={item.rate == null ? 'is-empty' : `is-${meterTone(item.rate)}`}><small>{monthName(item.month)}</small><strong>{item.rate == null ? '—' : `${item.rate}%`}</strong></li>)}</ol>
      </section>
      <section className="audit-panel"><SectionHeader title={L(en, 'Ανοιχτά ευρήματα ανά κατάταξη', 'Open findings by class')} />
        <ul className="audit-class-counts">{FINDING_CLASSES.map(item => <li key={item.value}><StatusBadge tone={findingClassTone(item.value)}>{item.label[en ? 1 : 0]}</StatusBadge><strong>{data.openByClass[item.value]}</strong></li>)}{data.openByClass.unclassified > 0 && <li><StatusBadge tone="neutral">{L(en, 'Χωρίς κατάταξη', 'Unclassified')}</StatusBadge><strong>{data.openByClass.unclassified}</strong></li>}</ul>
      </section>
    </div>
  </div>
}

// Readiness: every standard in one table (the latest audit of each department
// that covered it), what is still missing, and the detail (clause coverage and
// the dashboard) folded under it.
export function AuditReadiness({ audits = [], findings = [], language, onOpenFinding, onOpenAudit }) {
  const en = language === 'en'
  const data = useMemo(() => auditReadiness(audits, findings), [audits, findings])
  const { missing } = data
  const items = [
    missing.major.length > 0 && { id: 'major', tone: 'danger', text: (missing.major.length === 1 ? L(en, '1 ανοιχτό μείζον εύρημα', '1 open major finding') : L(en, `${missing.major.length} ανοιχτά μείζονα ευρήματα`, `${missing.major.length} open major findings`)), go: () => onOpenFinding?.(missing.major[0]) },
    missing.lateFindings.length > 0 && { id: 'late', tone: 'danger', text: (missing.lateFindings.length === 1 ? L(en, '1 εύρημα πέρασε την προθεσμία του', '1 finding past its due date') : L(en, `${missing.lateFindings.length} ευρήματα πέρασαν την προθεσμία τους`, `${missing.lateFindings.length} findings past their due date`)), go: () => onOpenFinding?.(missing.lateFindings[0]) },
    missing.lateAudits.length > 0 && { id: 'lateAudits', tone: 'danger', text: (missing.lateAudits.length === 1 ? L(en, '1 επιθεώρηση εκπρόθεσμη', '1 overdue audit') : L(en, `${missing.lateAudits.length} επιθεωρήσεις εκπρόθεσμες`, `${missing.lateAudits.length} overdue audits`)), go: () => onOpenAudit?.(missing.lateAudits[0]) },
    missing.noAuditThisYear.length > 0 && { id: 'none', tone: 'warning', text: L(en, `Χωρίς επιθεώρηση φέτος: ${missing.noAuditThisYear.join(', ')}`, `No audit this year: ${missing.noAuditThisYear.join(', ')}`) },
    missing.noNext.length > 0 && { id: 'next', tone: 'warning', text: L(en, `Χωρίς επόμενη επιθεώρηση: ${missing.noNext.join(', ')}`, `No next audit: ${missing.noNext.join(', ')}`) },
  ].filter(Boolean)
  return <div className="audit-view audit-readiness">
    {data.rows.length ? <div className="quality-programme-scroll">
      <table className="quality-programme-table audit-readiness-table">
        <thead><tr>
          <th scope="col">{L(en, 'Πρότυπο', 'Standard')}</th>
          <th scope="col">{L(en, 'Ετοιμότητα', 'Readiness')}</th>
          <th scope="col">{L(en, 'Τμήματα', 'Departments')}</th>
          <th scope="col">{L(en, 'Φέτος', 'This year')}</th>
          <th scope="col">{L(en, 'Ανοιχτά ευρήματα', 'Open findings')}</th>
          <th scope="col">{L(en, 'Πιο αδύναμα κεφάλαια', 'Weakest chapters')}</th>
          <th scope="col">{L(en, 'Τελευταία', 'Latest')}</th>
        </tr></thead>
        <tbody>{data.rows.map(row => <tr key={row.standard}>
          <th scope="row">{standardLabel(row.standard, language) || standardShort(row.standard)}</th>
          <td className="audit-readiness-rate">{row.rate == null ? '—' : <><strong>{row.rate}%</strong><Meter value={row.rate} tone={meterTone(row.rate)} label={`${standardShort(row.standard)} ${row.rate}%`} /></>}</td>
          <td>{row.departments}</td>
          <td className={row.thisYear < row.departments ? 'quality-overdue-text' : ''}>{row.thisYear}/{row.departments}</td>
          <td className={row.major ? 'quality-overdue-text' : ''}>{row.open}{row.major ? <small>{L(en, `${row.major} μείζονα`, `${row.major} major`)}</small> : null}</td>
          <td>{row.weakest.length ? row.weakest.map(chapter => <small key={chapter.key} className="audit-readiness-chapter" title={chapter.title}>{chapter.ref} · {chapter.title} <b>{chapter.rate}%</b></small>) : '—'}</td>
          <td className="nowrap-cell">{row.last ? formatDay(row.last, language) : '—'}</td>
        </tr>)}</tbody>
      </table>
    </div> : <div className="inline-empty">{L(en, 'Δεν υπάρχει ακόμη ολοκληρωμένη επιθεώρηση με απαντήσεις.', 'No completed audit with answers yet.')}</div>}
    <section className="audit-readiness-missing">
      <h4>{L(en, 'Τι λείπει', 'What is missing')}</h4>
      {items.length ? <ul>{items.map(item => <li key={item.id} className={`is-${item.tone}`}>{item.go ? <button type="button" onClick={item.go}>{item.text}</button> : item.text}</li>)}</ul> : <p>{L(en, 'Τίποτα: όλα τα τμήματα έχουν επιθεώρηση φέτος και επόμενη στο πρόγραμμα.', 'Nothing: every department was audited this year and has its next audit planned.')}</p>}
    </section>
    <MoreSection moreLabel={L(en, 'Κάλυψη άρθρων ανά πρότυπο', 'Clause coverage by standard')} lessLabel={L(en, 'Λιγότερα', 'Less')}><AuditCoverage audits={audits} language={language} /></MoreSection>
    <MoreSection moreLabel={L(en, 'Πίνακας και τάση 12 μηνών', 'Dashboard and 12-month trend')} lessLabel={L(en, 'Λιγότερα', 'Less')}><AuditDashboard audits={audits} findings={findings} language={language} /></MoreSection>
  </div>
}
