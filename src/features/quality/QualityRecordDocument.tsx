import { formatDateTime, formatDay } from '../../core/i18n/formatDay'
import { useLibraries } from '../management/useLibraries'
import { AUDIT_TYPES, CAPA_TYPES, EFFECTIVENESS, FINDING_SOURCES, IMPACTS, INCIDENT_CLASSES, REPORT_KINDS, harmLevel, incidentCategoryLabel, qualityCode, reportKindOf, reporterText, visibleSourceId, vocabularyLabel } from './qualityVocabulary'
import { recordOwners } from './qualityRecordRules'
import { AFFECTS, odipyGroupOf, odipyItem, odipyLabel } from './odipyCategories'
import { ISHIKAWA_CATEGORIES, normalizeAnalysis } from './rootCauseAnalysis'
import { glanceItems } from './QualityGlance'
import { incidentDetailFacts } from './incidentDetails'
import type { AnyRecord } from '../../types/featureTypes'
import type { ReactNode, RefObject } from 'react'

const KIND: Record<string, string[]> = { incidents: ['Συμβάν', 'Incident'], findings: ['Εύρημα', 'Finding'], capas: ['Διορθωτική ενέργεια', 'Corrective action'], audits: ['Επιθεώρηση', 'Audit'] }
const ANSWER: Record<string, string[]> = { yes: ['Ναι', 'Yes'], no: ['Όχι', 'No'], na: ['Δ/Ε', 'N/A'] }

// A Quality record as a document, for «Download» (PDF): what it is, where it
// stands, its details and texts, what follows it and its history. Rendered off
// screen; its HTML is printed on the shared document layout (reportDocument),
// which adds the hospital band, the signatures and the page footer.
export function QualityRecordDocument({ recordType, record, linked = [], language, t: translate, documentRef }: { recordType: string, record: AnyRecord, linked?: AnyRecord[], language: string, t: (key: string) => string, documentRef: RefObject<HTMLDivElement> }) {
  // Missing values (no priority, an event without a name) read as «—», never as an error.
  const t = (value: string) => (value ? translate(value) : '—')
  const en = language === 'en'
  const L = (el: string, enText: string) => (en ? enText : el)
  const text = (el: string, enText?: string) => (en ? enText || el : el) || ''
  const day = (value: string) => formatDay(value, language) || '—'
  const { libraries } = useLibraries()
  const figures: AnyRecord[] = glanceItems(recordType, record, { language, t, linked })
  // Complaints and suggestions have no patient outcome: those rows are left out.
  const reachesPatient = ['clinical', 'nonClinical'].includes(reportKindOf(record))
  const voided = record.lifecycleStatus === 'voided'
  const owners = recordOwners(record).join(', ')
  const details = ({
    incidents: [
      [L('Είδος', 'Kind'), vocabularyLabel(REPORT_KINDS, reportKindOf(record), language)],
      [L('Κατηγορία', 'Category'), incidentCategoryLabel(record.category || 'clinical', libraries.incidentCategories || [], language)],
      reachesPatient && record.incidentClass && [L('Έφτασε στον ασθενή', 'Reached the patient'), vocabularyLabel(INCIDENT_CLASSES, record.incidentClass, language)],
      reachesPatient && [L('Βλάβη (WHO)', 'Harm (WHO)'), vocabularyLabel(IMPACTS, harmLevel(record.impact), language)],
      [t('severity'), t(record.severity)],
      [L('Ημερομηνία και ώρα', 'Date and time'), [day(record.date), record.eventTime].filter(Boolean).join(' · ')],
      [L('Αναφέρθηκε από', 'Reported by'), reporterText(record, en) || '—'],
      [L('Υπεύθυνος', 'Responsible'), owners],
      record.sentinel && [L('Συμβάν-φρουρός: ανάλυση έως', 'Sentinel: analysis due'), day(record.rcaDueDate)],
      ...(reachesPatient ? incidentDetailFacts(record, language) : []),
    ],
    findings: [
      [t('severity'), t(record.severity)],
      [L('Ημερομηνία', 'Date'), day(record.date)],
      [L('Πηγή', 'Source'), [vocabularyLabel(FINDING_SOURCES, record.source || 'manual', language), visibleSourceId(record.sourceId)].filter(Boolean).join(' · ')],
      [L('Υπεύθυνος', 'Responsible'), owners],
    ],
    capas: [
      [L('Τύπος', 'Type'), vocabularyLabel(CAPA_TYPES, record.actionType || 'corrective', language)],
      [L('Προτεραιότητα', 'Priority'), t(record.priority)],
      [L('Υπεύθυνος', 'Responsible'), owners],
      [L('Προθεσμία', 'Due'), day(record.dueDate)],
      [L('Έλεγχος αποτελεσματικότητας έως', 'Effectiveness check by'), day(record.effectivenessDue)],
      [L('Αποτελεσματικότητα', 'Effectiveness'), vocabularyLabel(EFFECTIVENESS, record.effectivenessStatus || 'pending', language)],
      visibleSourceId(record.sourceId) && [L('Προέλευση', 'Source'), record.sourceId],
    ],
    audits: [
      [L('Τύπος', 'Type'), vocabularyLabel(AUDIT_TYPES, record.auditType || 'internal', language)],
      [L('Επικεφαλής επιθεωρητής', 'Lead auditor'), record.leadAuditor],
      [L('Προγραμματισμένη', 'Planned'), day(record.plannedDate)],
      [L('Ολοκληρώθηκε', 'Completed'), day(record.completedDate)],
    ],
  } as Record<string, ([string, ReactNode] | false)[]>)[recordType]?.filter(Boolean) as [string, ReactNode][] || []
  const texts = [
    [recordType === 'audits' ? L('Εύρος επιθεώρησης', 'Audit scope') : L('Περιγραφή', 'Description'), recordType === 'audits' ? text(record.scope, record.scopeEn) : text(record.description, record.descriptionEn)],
    recordType === 'incidents' && [L('Άμεσες ενέργειες', 'Immediate actions'), text(record.immediateActions, record.immediateActionsEn)],
    recordType === 'incidents' && [L('Βασική αιτία', 'Root cause'), text(record.rootCause, record.rootCauseEn)],
    recordType === 'incidents' && [L('Συνεισφέροντες παράγοντες', 'Contributing factors'), text(record.contributingFactors, record.contributingFactorsEn)],
    recordType === 'incidents' && [L('Εμπλεκόμενοι', 'People involved'), record.involvedPeople],
    recordType === 'incidents' && [L('Κωδικός ασθενή / θάλαμος', 'Patient record / room'), [record.patientReference, record.room].filter(Boolean).join(' · ')],
    recordType === 'incidents' && [L('Σημειώσεις', 'Notes'), record.notes],
  ].filter(item => item && String(item[1] || '').trim()) as [string, ReactNode][]
  const steps = recordType === 'capas' ? record.subActions || [] : []
  const progress = recordType === 'capas' ? record.progress || [] : []
  const analysis = recordType === 'capas' && record.rootCauseAnalysis ? normalizeAnalysis(record.rootCauseAnalysis) : null
  const checklist = recordType === 'audits' ? record.checklist || [] : []
  // The whole audit trail, as in the History tab.
  const history = [...(record.history || [])].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
  const linkedTitle = recordType === 'audits' ? L('Ευρήματα', 'Findings') : L('Διορθωτικές ενέργειες', 'Corrective actions')

  // An incident: the ΟΔΙΠΥ «Αναφορά Συμβάντος» — the report, the event, its description, the people involved,
  // the actions after it and Quality's review (the three signatures are added by the print layout).
  if (recordType === 'incidents') {
    const group = odipyGroupOf(record.category)
    const reportFacts = [
      [L('Α/Α αναφοράς', 'Report no.'), qualityCode(record, language)],
      [L('Ημερομηνία αναφοράς', 'Report date'), formatDateTime(record.createdAt, language) || day(record.date)],
      [L('Η αναφορά έγινε από', 'Reported by'), reporterText(record, en) || '—'],
      [L('Αφορά σε', 'Concerns'), vocabularyLabel(AFFECTS, record.affects, language) || '—'],
    ]
    const eventFacts = [
      [L('Ημερομηνία συμβάντος', 'Date of the event'), day(record.date)],
      [L('Ώρα συμβάντος', 'Time of the event'), record.eventTime || '—'],
      [L('Τμήμα που συνέβη', 'Department'), (en ? record.departmentEn || record.department : record.department) || '—'],
      [L('Κατηγορία συμβάντος', 'Category'), group ? `${en ? group.en : group.el} · ${odipyLabel(odipyItem(record.category)?.key as string, language, false)}` : incidentCategoryLabel(record.category, libraries.incidentCategories || [], language) || '—'],
      ...(reachesPatient ? incidentDetailFacts(record, language) : []),
    ]
    const people = [record.involvedPeople, [record.patientReference && `${L('Αρ. μητρώου ασθενή', 'Patient record no.')}: ${record.patientReference}`, record.room && `${L('Θάλαμος', 'Room')}: ${record.room}`].filter(Boolean).join(' · ')].filter(Boolean).join('\n')
    const review = [
      record.rootCause && `${L('Αίτια', 'Causes')}: ${text(record.rootCause, record.rootCauseEn)}`,
      record.contributingFactors && `${L('Συνεισφέροντες παράγοντες', 'Contributing factors')}: ${text(record.contributingFactors, record.contributingFactorsEn)}`,
      record.notes,
    ].filter(Boolean).join('\n')
    const block = (title: string, value: unknown, hint?: string) => <section><h3>{title}</h3>{hint && <p className="quality-document-hint">{hint}</p>}{String(value || '—').split(/\n+/).filter(Boolean).map((line, index) => <p key={index}>{line}</p>)}</section>
    const factList = (list: [string, ReactNode][]) => <dl className="quality-document-details">{list.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || '—'}</dd></div>)}</dl>
    return <div className="quality-record-document" ref={documentRef} aria-hidden="true">
      <p className="quality-document-eyebrow">{L('Αναφορά συμβάντος', 'Incident report')} · {qualityCode(record, language)}</p>
      <h1>{text(record.title, record.titleEn)}</h1>
      {voided && <p className="quality-document-voided">{L('Ακυρώθηκε', 'Voided')} {formatDateTime(record.voidedAt, language)}{record.voidReason ? ` · ${L('Λόγος', 'Reason')}: ${record.voidReason}` : ''}</p>}
      {factList(reportFacts as [string, ReactNode][])}
      <h3>{L('Πληροφορίες που αφορούν το συμβάν', 'About the event')}</h3>
      {factList(eventFacts as [string, ReactNode][])}
      {block(L('Περιγραφή συμβάντος', 'Description of the event'), text(record.description, record.descriptionEn))}
      {block(L('Ονοματεπώνυμο και ιδιότητες εμπλεκομένων', 'People involved'), people)}
      {block(L('Δράσεις μετά το συμβάν', 'Actions after the event'), text(record.immediateActions, record.immediateActionsEn), L('Συμπληρώνεται από τον Προϊστάμενο ή Τομεάρχη', 'Completed by the head of the department or sector'))}
      {block(L('Ανασκόπηση από το Γραφείο Ποιότητας', 'Review by the Quality Office'), review)}
      {linked.length > 0 && <>
        <h3>{L('Διορθωτικές ενέργειες', 'Corrective actions')}</h3>
        <table><thead><tr><th>{L('Κωδικός', 'Code')}</th><th>{L('Τίτλος', 'Title')}</th><th>{L('Κατάσταση', 'Status')}</th></tr></thead>
          <tbody>{linked.map(item => <tr key={item.id}><td>{qualityCode(item, language)}</td><td>{text(item.title, item.titleEn)}</td><td>{t(item.status)}</td></tr>)}</tbody></table>
      </>}
      <p className="quality-document-hint">{L('Η συμπλήρωση της αναφοράς δεν αποτελεί αποδοχή ευθύνης οποιουδήποτε είδους για οποιοδήποτε άτομο. Οποιοδήποτε υλικό ή εξοπλισμός που ενεπλάκη στο συμβάν πρέπει να κρατηθεί για εξέταση.', 'Completing this report is not an acceptance of liability of any kind by anyone. Any material or equipment involved in the event must be kept for examination.')}</p>
    </div>
  }

  return <div className="quality-record-document" ref={documentRef} aria-hidden="true">
    <p className="quality-document-eyebrow">{KIND[recordType]?.[en ? 1 : 0]} · {qualityCode(record, language)}</p>
    <h1>{text(record.title, record.titleEn)}</h1>
    <p className="quality-document-sub">{[en ? record.departmentEn || record.department : record.department, voided ? L('Ακυρωμένη εγγραφή', 'Voided record') : t(record.status)].filter(Boolean).join(' · ')}</p>
    {voided && <p className="quality-document-voided">{L('Ακυρώθηκε', 'Voided')} {formatDateTime(record.voidedAt, language)}{record.voidedBy ? ` · ${record.voidedBy}` : ''}{record.voidReason ? ` · ${L('Λόγος', 'Reason')}: ${record.voidReason}` : ''}</p>}
    {figures.length > 0 && <dl className="quality-document-figures">{figures.map(item => <div key={item.id}><dt>{item.label}</dt><dd>{item.value}{item.unit ? ` ${item.unit}` : ''}{item.note && <small>{item.note}</small>}</dd></div>)}</dl>}
    <h3>{L('Στοιχεία', 'Details')}</h3>
    <dl className="quality-document-details">{details.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || '—'}</dd></div>)}</dl>
    {texts.map(([label, value]) => <section key={label}><h3>{label}</h3>{String(value).split(/\n+/).filter(Boolean).map((line, index) => <p key={index}>{line}</p>)}</section>)}
    {checklist.length > 0 && <>
      <h3>{L('Λίστα ελέγχου', 'Checklist')}</h3>
      <table><thead><tr><th>#</th><th>{L('Σημείο ελέγχου', 'Item')}</th><th>{L('Απάντηση', 'Answer')}</th><th>{L('Τι βρέθηκε', 'What was found')}</th><th>{L('Εύρημα', 'Finding')}</th></tr></thead>
        <tbody>{checklist.map((row: AnyRecord, index: number) => <tr key={row.id || index}><td>{index + 1}</td><td>{text(row.item, row.itemEn)}</td><td>{row.answer ? ANSWER[row.answer]?.[en ? 1 : 0] : '—'}</td><td>{row.note || ''}</td><td>{row.findingId || ''}</td></tr>)}</tbody></table>
    </>}
    {steps.length > 0 && <>
      <h3>{L('Βήματα', 'Steps')}</h3>
      <table><thead><tr><th>{L('Βήμα', 'Step')}</th><th>{L('Υπεύθυνος', 'Owner')}</th><th>{L('Προθεσμία', 'Due')}</th><th>{L('Ολοκλήρωση', 'Done')}</th></tr></thead>
        <tbody>{steps.map((step: AnyRecord, index: number) => <tr key={step.id || index}><td>{step.title}</td><td>{step.owner || '—'}</td><td>{day(step.dueDate)}</td><td>{step.done ? `✓ ${formatDay(step.doneAt, language) || ''}` : '—'}</td></tr>)}</tbody></table>
    </>}
    {progress.length > 0 && <>
      <h3>{L('Πρόοδος', 'Progress')}</h3>
      <table><tbody>{progress.map((entry: AnyRecord, index: number) => <tr key={entry.id || index}><td>{day(entry.date)}</td><td>{entry.note}</td><td>{entry.author || '—'}</td></tr>)}</tbody></table>
    </>}
    {analysis && (analysis.problem || analysis.rootCause || analysis.whys.some(Boolean) || ISHIKAWA_CATEGORIES.some(([key]) => analysis.causes[key].length)) && <>
      <h3>{L('Ανάλυση αιτιών', 'Root cause analysis')}</h3>
      {analysis.problem && <p><strong>{L('Πρόβλημα', 'Problem')}:</strong> {analysis.problem}</p>}
      {analysis.whys.some(Boolean) && <ol>{analysis.whys.filter(Boolean).map((why, index: number) => <li key={index}>{why}</li>)}</ol>}
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
  </div>
}
