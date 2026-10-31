import { SectionHeader } from '../../design-system/SectionHeader'
import { Check, Minus } from 'lucide-react'
import { OUTCOME_RESULTS } from './LaboratoryStatus'
import { Button } from '../../design-system/Button'
import { DetailList } from '../../design-system/DetailList'
import { ENVIRONMENTAL_CATEGORIES, environmentalMethodLabel, sampleTypeLabel } from './laboratoryCloudService'
import { computeTurnaroundHours, formatTurnaround } from './model/laboratoryModel'
import { sampleSourceLabel } from './laboratoryReferenceData'
import { Link } from 'react-router-dom'

function subjectLabel(subjectType, language) {
  if (subjectType === 'employee') return language === 'en' ? 'Employee' : 'Εργαζόμενος'
  if (subjectType === 'environment') return language === 'en' ? 'Sampling point / location' : 'Σημείο / χώρος δειγματοληψίας'
  return language === 'en' ? 'Patient' : 'Ασθενής'
}

// One card for the sample's own identity and logistics. The clinical result,
// organisms and AMR live exclusively on the Result tab so the two never
// duplicate each other. Actions sit behind the card's ⋯ menu, matching the
// record cards in Prevention, Quality and Controls.
export function LaboratorySampleSummary({ sample, t, language, fmt, menu, banners, extras }) {
  const en = language === 'en'
  const fields = sampleSummaryFields({ sample, t, language, fmt, extras })
  return <section className="lab-record-card lab-summary-card">
    <SectionHeader title={en ? 'Sample details' : 'Στοιχεία δείγματος'} actions={menu}/>
    {banners}
    <DetailList sections={sampleSummarySections(fields, language)}/>
    <DetailList sections={resultSummarySections(sample, t)}/>
  </section>
}

// The outcome at a glance (full detail stays on the Result tab): outcome, organism, count, critical communication.
export function resultSummarySections(sample, t) {
  if (!OUTCOME_RESULTS.includes(sample.result)) return []
  const communicated = (sample.microbiologyResults || []).some(result => (result.communications || []).length > 0)
  const items = [
    { key: 'outcome', label: t('result'), value: t(sample.result) },
    sample.organism && { key: 'organism', label: t('organism'), value: sample.organism },
    sample.cfuCount != null && { key: 'cfu', label: 'CFU', value: sample.cfuLimit != null ? `${sample.cfuCount} / ${sample.cfuLimit}` : String(sample.cfuCount) },
    sample.critical && { key: 'critical', label: t('criticalResult'), value: communicated ? t('communicated') : t('laboratoryRecords.uncommunicatedCritical') },
  ].filter(Boolean)
  return [{ key: 'result', title: t('result'), items }]
}

// The summary fields in two groups (Sampling · Receipt) for the shared DetailList.
export function sampleSummarySections(fields, language) {
  const en = language === 'en'
  const item = field => ({ key: field.id, label: field.label, value: field.meta ? <>{field.value || '—'}<small>{field.meta}</small></> : field.value })
  const receipt = ['requestedBy', 'received', 'turnaround', 'surveillance']
  const visible = fields.filter(field => !field.hidden)
  return [
    { key: 'sampling', title: en ? 'Sampling' : 'Δειγματοληψία', items: visible.filter(field => !receipt.includes(field.id)).map(item) },
    { key: 'receipt', title: en ? 'Receipt' : 'Παραλαβή', items: visible.filter(field => receipt.includes(field.id)).map(item) },
  ]
}

// The sample's own identity and logistics as label/value fields (the card and the printed report).
export function sampleSummaryFields({ sample, t, language, fmt, extras = {} }) {
  const en = language === 'en'
  const isEnvironmental = sample.subjectType === 'environment' || ENVIRONMENTAL_CATEGORIES.includes(sample.type)
  const rawSurveillance = sample.surveillanceCase || sample.employeeSurveillanceId || sample.environmentalBatchId || ''
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(rawSurveillance))
  const surveillance = !rawSurveillance ? '' : isUuid ? (en ? 'Linked record' : 'Συνδεδεμένη εγγραφή') : rawSurveillance

  const fields = [
    { id: 'subject', label: subjectLabel(sample.subjectType, language), value: (en ? sample.subjectNameEn : sample.subjectName) || sample.patient, meta: sample.subjectCode || sample.patientId || '' },
    { id: 'department', label: t('department'), value: (en ? sample.departmentEn : sample.department) || sample.department },
    { id: 'sampleType', label: t('sampleType'), value: sampleTypeLabel(sample, t, language) },
    isEnvironmental
      ? { id: 'method', label: en ? 'Sampling method' : 'Μέθοδος δειγματοληψίας', value: environmentalMethodLabel(sample.environmentalMethod, t) || sample.source }
      : { id: 'source', label: t('clinicalSource'), value: sampleSourceLabel((en ? sample.sourceEn : sample.source) || sample.source, language) },
    // The culture plate and the spot on it, to match the plate in hand with the point it was taken at.
    { id: 'plate', label: t('clinicalRecords.envPlate'), value: sample.environmentalPlate, hidden: !sample.environmentalPlate },
    { id: 'position', label: t('clinicalRecords.envPosition'), value: sample.environmentalPosition, hidden: !sample.environmentalPosition },
    { id: 'priority', label: t('priority'), value: sample.priority ? t(sample.priority) : '—' },
    { id: 'collected', label: t('collectedLabel'), value: fmt(sample.collectedAt) },
    // Admission screening: the sample was taken to check the patient for resistant organisms on admission.
    { id: 'admissionScreening', label: t('labSampleFlow.screening'), value: t('labSampleFlow.admissionScreeningYes'), hidden: !sample.clinicalContext?.admissionScreening },
    { id: 'mdrOnAdmission', label: t('labSampleFlow.mdrOnAdmission'), value: extras.mdrOnAdmissionDate ? fmt(extras.mdrOnAdmissionDate) : t('labSampleFlow.admissionScreeningYes'), hidden: !extras.mdrOnAdmission },
    { id: 'requestedBy', label: t('labSampleFlow.requestedBy'), value: extras.requesterName, meta: sample.requestedAt ? fmt(sample.requestedAt) : '', hidden: !extras.requesterName },
    { id: 'received', label: t('received'), value: fmt(sample.receivedAt) },
    { id: 'turnaround', label: t('laboratoryRecords.turnaroundTime'), value: formatTurnaround(computeTurnaroundHours(sample), language) },
    { id: 'surveillance', label: t('laboratoryRecords.linkedSurveillance'), value: surveillance, hidden: !surveillance },
  ]
  return fields
}

// Guided flow: every step of the laboratory lifecycle in order, with the
// single next action surfaced as a primary button so the user never has to
// hunt through tabs to find what is left to do.
// Only the steps that apply are numbered and counted: «not required» steps show a dash.
export function workflowProgress(steps) {
  const applicable = steps.filter(step => step.state !== 'na')
  return { applicable, total: applicable.length, done: applicable.filter(step => step.state === 'done').length, numberOf: step => applicable.indexOf(step) + 1 }
}

export function LaboratoryWorkflow({ steps, language, closedNote }) {
  const en = language === 'en'
  const { total, done, numberOf } = workflowProgress(steps)
  const next = steps.find(step => step.state === 'next')
  return <section className="lab-record-card lab-workflow-card">
    <SectionHeader title={en ? 'Sample progress' : 'Πρόοδος δείγματος'} actions={<span className="lab-workflow-count">{done}/{total}</span>}/>
    <ol className="lab-workflow-steps">
      {steps.map(step => <li key={step.id} className={`lab-workflow-step is-${step.state}`}>
        <span className="lab-workflow-marker">{step.state === 'done' ? <Check size={14}/> : step.state === 'na' ? <Minus size={14}/> : numberOf(step)}</span>
        <div><strong>{step.label}</strong><small>{step.meta || (step.state === 'na' ? (en ? 'Not required' : 'Δεν απαιτείται') : step.state === 'done' ? (en ? 'Completed' : 'Ολοκληρώθηκε') : (en ? 'Pending' : 'Εκκρεμεί'))}</small></div>
      </li>)}
    </ol>
    {closedNote ? <div className="lab-workflow-next is-closed">{closedNote}</div>
      : next ? <div className="lab-workflow-next" data-demo-step={`microbiology_mdro:${next.id}`}><div><span>{en ? 'Next step' : 'Επόμενο βήμα'}</span><strong>{next.hint || next.label}</strong></div>{next.action && <Button onClick={next.action.onClick}>{next.action.icon && <next.action.icon size={15}/>}{next.action.label}</Button>}</div>
        : null}
  </section>
}

// The samples that belong together: taken at the same time from the same patient, or the other points of the same plate.
export function LaboratoryRelatedSamples({ related, hrefFor, t, language, sample }) {
  const groups = [
    related.visit.length > 0 && { key: 'visit', title: t('labSampleFlow.sameVisit'), hint: t('labSampleFlow.sameVisitHint'), items: related.visit },
    related.plate.length > 0 && { key: 'plate', title: t('labSampleFlow.samePlate').replace('{plate}', sample.environmentalPlate), hint: t('labSampleFlow.samePlateHint'), items: related.plate },
  ].filter(Boolean)
  if (!groups.length) return null
  return <section className="lab-record-card lab-related-card">
    {groups.map(group => <div key={group.key} className="lab-related-group">
      <SectionHeader title={group.title}/>
      <small className="lab-related-hint">{group.hint}</small>
      <ul className="lab-related-list">
        {group.items.map(item => <li key={item.id}>
          <Link to={hrefFor(item)}><strong>{item.id}</strong></Link>
          <span>{group.key === 'plate' ? [item.environmentalPosition && t('labSampleFlow.positionShort').replace('{pos}', item.environmentalPosition), item.location, item.point].filter(Boolean).join(' · ') : sampleTypeLabel(item, t, language)}</span>
          {item.result && OUTCOME_RESULTS.includes(item.result) && <small>{t(item.result)}</small>}
        </li>)}
      </ul>
    </div>)}
  </section>
}
