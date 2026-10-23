import { SectionHeader } from '../../design-system/SectionHeader'
import { Check, Minus } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { DetailList } from '../../design-system/DetailList'
import { ENVIRONMENTAL_CATEGORIES, environmentalMethodLabel, sampleTypeLabel } from './laboratoryCloudService'
import { computeTurnaroundHours, formatTurnaround } from './model/laboratoryModel'
import { sampleSourceLabel } from './laboratoryReferenceData'

function subjectLabel(subjectType, language) {
  if (subjectType === 'employee') return language === 'en' ? 'Employee' : 'Εργαζόμενος'
  if (subjectType === 'environment') return language === 'en' ? 'Sampling point / location' : 'Σημείο / χώρος δειγματοληψίας'
  return language === 'en' ? 'Patient' : 'Ασθενής'
}

// One card for the sample's own identity and logistics. The clinical result,
// organisms and AMR live exclusively on the Result tab so the two never
// duplicate each other. Actions sit behind the card's ⋯ menu, matching the
// record cards in Prevention, Quality and Controls.
export function LaboratorySampleSummary({ sample, t, language, fmt, menu, banners }) {
  const en = language === 'en'
  const fields = sampleSummaryFields({ sample, t, language, fmt })
  return <section className="lab-record-card lab-summary-card">
    <SectionHeader title={en ? 'Sample details' : 'Στοιχεία δείγματος'} actions={menu}/>
    {banners}
    <DetailList sections={sampleSummarySections(fields, language)}/>
  </section>
}

// The summary fields in two groups (Sampling · Receipt) for the shared DetailList.
export function sampleSummarySections(fields, language) {
  const en = language === 'en'
  const item = field => ({ key: field.id, label: field.label, value: field.meta ? <>{field.value || '—'}<small>{field.meta}</small></> : field.value })
  const receipt = ['received', 'turnaround', 'surveillance']
  const visible = fields.filter(field => !field.hidden)
  return [
    { key: 'sampling', title: en ? 'Sampling' : 'Δειγματοληψία', items: visible.filter(field => !receipt.includes(field.id)).map(item) },
    { key: 'receipt', title: en ? 'Receipt' : 'Παραλαβή', items: visible.filter(field => receipt.includes(field.id)).map(item) },
  ]
}

// The sample's own identity and logistics as label/value fields (the card and the printed report).
export function sampleSummaryFields({ sample, t, language, fmt }) {
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
    { id: 'priority', label: t('priority'), value: sample.priority ? t(sample.priority) : '—' },
    { id: 'collected', label: t('collectedLabel'), value: fmt(sample.collectedAt) },
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
