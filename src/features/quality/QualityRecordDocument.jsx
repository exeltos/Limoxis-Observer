import { formatDateTime, formatDay } from '../../core/i18n/formatDay'
import { AUDIT_TYPES, CAPA_TYPES, EFFECTIVENESS, FINDING_SOURCES, IMPACTS, INCIDENT_CLASSES, REPORT_KINDS, harmLevel, qualityCode, reportKindOf, vocabularyLabel } from './qualityVocabulary'
import { recordOwners } from './qualityRecordRules'
import { ISHIKAWA_CATEGORIES, normalizeAnalysis } from './rootCauseAnalysis'
import { glanceItems } from './QualityGlance'

const KIND = { incidents: ['Συμβάν', 'Incident'], findings: ['Εύρημα', 'Finding'], capas: ['Διορθωτική ενέργεια', 'Corrective action'], audits: ['Επιθεώρηση', 'Audit'] }
const ANSWER = { yes: ['Ναι', 'Yes'], no: ['Όχι', 'No'], na: ['Δ/Ε', 'N/A'] }

// A Quality record as a document, for «Download» (PDF): what it is, where it
// stands, its details and texts, what follows it and its history. Rendered off
// screen and captured by exportElementAsPdf, which adds the hospital header.
export function QualityRecordDocument({ recordType, record, linked = [], language, t: translate, documentRef }) {
  // Missing values (no priority, an event without a name) read as «—», never as an error.
  const t = value => (value ? translate(value) : '—')
  const en = language === 'en'
  const L = (el, enText) => (en ? enText : el)
  const text = (el, enText) => (en ? enText || el : el) || ''
  const day = value => formatDay(value, language) || '—'
  const figures = glanceItems(recordType, record, { language, t, linked })
  const owners = recordOwners(record).join(', ')
  const details = {
    incidents: [
      [L('Είδος', 'Kind'), vocabularyLabel(REPORT_KINDS, reportKindOf(record), language)],
      [L('Έφτασε στον ασθενή', 'Reached the patient'), vocabularyLabel(INCIDENT_CLASSES, record.incidentClass || 'nearMiss', language)],
      [L('Βλάβη (WHO)', 'Harm (WHO)'), vocabularyLabel(IMPACTS, harmLevel(record.impact), language)],
      [t('severity'), t(record.severity)],
      [L('Ημερομηνία και ώρα', 'Date and time'), [day(record.date), record.eventTime].filter(Boolean).join(' · ')],
      [L('Αναφέρθηκε από', 'Reported by'), record.anonymous ? L('Ανώνυμη αναφορά', 'Anonymous report') : record.reportedBy],
      [L('Υπεύθυνος', 'Responsible'), owners],
      record.sentinel && [L('Συμβάν-φρουρός: ανάλυση έως', 'Sentinel: analysis due'), day(record.rcaDueDate)],
    ],
    findings: [
      [t('severity'), t(record.severity)],
      [L('Ημερομηνία', 'Date'), day(record.date)],
      [L('Πηγή', 'Source'), [vocabularyLabel(FINDING_SOURCES, record.source || 'manual', language), record.sourceId].filter(Boolean).join(' · ')],
      [L('Υπεύθυνος', 'Responsible'), owners],
    ],
    capas: [
      [L('Τύπος', 'Type'), vocabularyLabel(CAPA_TYPES, record.actionType || 'corrective', language)],
      [L('Προτεραιότητα', 'Priority'), t(record.priority)],
      [L('Υπεύθυνος', 'Responsible'), owners],
      [L('Προθεσμία', 'Due'), day(record.dueDate)],
      [L('Έλεγχος αποτελεσματικότητας έως', 'Effectiveness check by'), day(record.effectivenessDue)],
      [L('Αποτελεσματικότητα', 'Effectiveness'), vocabularyLabel(EFFECTIVENESS, record.effectivenessStatus || 'pending', language)],
      record.sourceId && [L('Προέλευση', 'Source'), record.sourceId],
    ],
    audits: [
      [L('Τύπος', 'Type'), vocabularyLabel(AUDIT_TYPES, record.auditType || 'internal', language)],
      [L('Επικεφαλής επιθεωρητής', 'Lead auditor'), record.leadAuditor],
      [L('Προγραμματισμένη', 'Planned'), day(record.plannedDate)],
      [L('Ολοκληρώθηκε', 'Completed'), day(record.completedDate)],
    ],
  }[recordType]?.filter(Boolean) || []
  const texts = [
    [recordType === 'audits' ? L('Εύρος επιθεώρησης', 'Audit scope') : L('Περιγραφή', 'Description'), recordType === 'audits' ? text(record.scope, record.scopeEn) : text(record.description, record.descriptionEn)],
    recordType === 'incidents' && [L('Άμεσες ενέργειες', 'Immediate actions'), text(record.immediateActions, record.immediateActionsEn)],
    recordType === 'incidents' && [L('Βασική αιτία', 'Root cause'), text(record.rootCause, record.rootCauseEn)],
    recordType === 'incidents' && [L('Συνεισφέροντες παράγοντες', 'Contributing factors'), text(record.contributingFactors, record.contributingFactorsEn)],
  ].filter(item => item && String(item[1] || '').trim())
  const steps = recordType === 'capas' ? record.subActions || [] : []
  const analysis = recordType === 'capas' && record.rootCauseAnalysis ? normalizeAnalysis(record.rootCauseAnalysis) : null
  const checklist = recordType === 'audits' ? record.checklist || [] : []
  const history = [...(record.history || [])].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 15)
  const linkedTitle = recordType === 'audits' ? L('Ευρήματα', 'Findings') : L('Διορθωτικές ενέργειες', 'Corrective actions')

  return <div className="quality-record-document" ref={documentRef} aria-hidden="true">
    <p className="quality-document-eyebrow">{KIND[recordType]?.[en ? 1 : 0]} · {qualityCode(record, language)}</p>
    <h1>{text(record.title, record.titleEn)}</h1>
    <p className="quality-document-sub">{[en ? record.departmentEn || record.department : record.department, t(record.status)].filter(Boolean).join(' · ')}</p>
    {figures.length > 0 && <dl className="quality-document-figures">{figures.map(item => <div key={item.id}><dt>{item.label}</dt><dd>{item.value}{item.unit ? ` ${item.unit}` : ''}{item.note && <small>{item.note}</small>}</dd></div>)}</dl>}
    <h3>{L('Στοιχεία', 'Details')}</h3>
    <dl className="quality-document-details">{details.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || '—'}</dd></div>)}</dl>
    {texts.map(([label, value]) => <section key={label}><h3>{label}</h3>{String(value).split(/\n+/).filter(Boolean).map((line, index) => <p key={index}>{line}</p>)}</section>)}
    {checklist.length > 0 && <>
      <h3>{L('Λίστα ελέγχου', 'Checklist')}</h3>
      <table><thead><tr><th>#</th><th>{L('Σημείο ελέγχου', 'Item')}</th><th>{L('Απάντηση', 'Answer')}</th><th>{L('Τι βρέθηκε', 'What was found')}</th><th>{L('Εύρημα', 'Finding')}</th></tr></thead>
        <tbody>{checklist.map((row, index) => <tr key={row.id || index}><td>{index + 1}</td><td>{text(row.item, row.itemEn)}</td><td>{row.answer ? ANSWER[row.answer]?.[en ? 1 : 0] : '—'}</td><td>{row.note || ''}</td><td>{row.findingId || ''}</td></tr>)}</tbody></table>
    </>}
    {steps.length > 0 && <>
      <h3>{L('Βήματα', 'Steps')}</h3>
      <table><thead><tr><th>{L('Βήμα', 'Step')}</th><th>{L('Υπεύθυνος', 'Owner')}</th><th>{L('Προθεσμία', 'Due')}</th><th>{L('Ολοκλήρωση', 'Done')}</th></tr></thead>
        <tbody>{steps.map((step, index) => <tr key={step.id || index}><td>{step.title}</td><td>{step.owner || '—'}</td><td>{day(step.dueDate)}</td><td>{step.done ? `✓ ${formatDay(step.doneAt, language) || ''}` : '—'}</td></tr>)}</tbody></table>
    </>}
    {analysis && (analysis.problem || analysis.rootCause) && <>
      <h3>{L('Ανάλυση αιτιών', 'Root cause analysis')}</h3>
      {analysis.problem && <p><strong>{L('Πρόβλημα', 'Problem')}:</strong> {analysis.problem}</p>}
      {analysis.whys.some(Boolean) && <ol>{analysis.whys.filter(Boolean).map((why, index) => <li key={index}>{why}</li>)}</ol>}
      {ISHIKAWA_CATEGORIES.some(([key]) => analysis.causes[key].length) && <p>{ISHIKAWA_CATEGORIES.filter(([key]) => analysis.causes[key].length).map(([key, el, enLabel]) => `${en ? enLabel : el}: ${analysis.causes[key].join(', ')}`).join(' · ')}</p>}
      {analysis.rootCause && <p><strong>{L('Βασική αιτία', 'Root cause')}:</strong> {analysis.rootCause}</p>}
    </>}
    {['incidents', 'findings', 'audits'].includes(recordType) && <>
      <h3>{linkedTitle}</h3>
      {linked.length ? <table><thead><tr><th>{L('Κωδικός', 'Code')}</th><th>{L('Τίτλος', 'Title')}</th><th>{L('Κατάσταση', 'Status')}</th></tr></thead>
        <tbody>{linked.map(item => <tr key={item.id}><td>{qualityCode(item, language)}</td><td>{text(item.title, item.titleEn)}</td><td>{t(item.status)}</td></tr>)}</tbody></table> : <p>—</p>}
    </>}
    {history.length > 0 && <>
      <h3>{L('Ιστορικό', 'History')}</h3>
      <table><tbody>{history.map((event, index) => <tr key={`${event.at}-${index}`}><td>{formatDateTime(event.at, language)}</td><td>{t(event.action)}</td><td>{event.actor || '—'}</td></tr>)}</tbody></table>
    </>}
    <p className="quality-document-printed">{L('Εκτύπωση', 'Printed')} {formatDateTime(new Date().toISOString(), language)}</p>
  </div>
}
