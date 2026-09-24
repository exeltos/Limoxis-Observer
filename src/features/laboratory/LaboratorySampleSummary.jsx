import { Clock3, FlaskConical, Link2 } from 'lucide-react'
import { RecordDetailsGrid } from '../../design-system/RecordDetailsGrid'
import { ENVIRONMENTAL_CATEGORIES, environmentalMethodLabel, sampleTypeLabel } from './laboratoryCloudService'
import { computeTurnaroundHours, formatTurnaround } from './model/laboratoryModel'

function subjectLabel(subjectType, language) {
  if (subjectType === 'employee') return language === 'en' ? 'Employee' : 'Εργαζόμενος'
  if (subjectType === 'environment') return language === 'en' ? 'Sampling point / location' : 'Σημείο / χώρος δειγματοληψίας'
  return language === 'en' ? 'Patient' : 'Ασθενής'
}

// The sample/result/organism/AMR fields used to be duplicated here and on
// the "Microbiology result" tab. User-reported: the two screens felt
// redundant and the summary was a single flat wall of 11 small fields with
// no grouping. Summary now owns only the sample's own identity/logistics —
// who/what it is, when it moved through the lab, and what it's linked to —
// grouped into purposeful cards; the clinical result lives exclusively on
// the Microbiology result tab.
export function LaboratorySampleSummary({ sample, t, language, fmt, action, banners }) {
  const en = language === 'en'
  const isEnvironmental = sample.subjectType === 'environment' || ENVIRONMENTAL_CATEGORIES.includes(sample.type)
  const rawSurveillance = sample.surveillanceCase || sample.employeeSurveillanceId || sample.environmentalBatchId || ''
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(rawSurveillance))
  const surveillance = !rawSurveillance ? '' : isUuid ? (en ? 'Linked record' : 'Συνδεδεμένη εγγραφή') : rawSurveillance

  const identityFields = [
    { id: 'subject', label: subjectLabel(sample.subjectType, language), value: sample.subjectName || sample.patient },
    { id: 'department', label: t('department'), value: sample.department },
    { id: 'sampleType', label: t('sampleType'), value: sampleTypeLabel(sample.type, t) },
    isEnvironmental
      ? { id: 'method', label: en ? 'Sampling method' : 'Μέθοδος δειγματοληψίας', value: environmentalMethodLabel(sample.environmentalMethod, t) || sample.source }
      : { id: 'source', label: t('clinicalSource'), value: sample.source },
  ]
  const timelineFields = [
    { id: 'priority', label: t('priority'), value: sample.priority ? t(sample.priority) : '—' },
    { id: 'collected', label: t('collectedLabel'), value: fmt(sample.collectedAt) },
    { id: 'received', label: t('received'), value: fmt(sample.receivedAt) },
    { id: 'turnaround', label: t('laboratoryRecords.turnaroundTime'), value: formatTurnaround(computeTurnaroundHours(sample), language) },
  ]

  return <>
    <section className="clinical-panel full-panel lab-record-card lab-summary-card">
      <div className="record-section-header"><div><span className="eyebrow">{en ? 'Sample' : 'Δείγμα'}</span><h3><FlaskConical size={15}/> {en ? 'Sample & origin' : 'Δείγμα & προέλευση'}</h3></div>{action}</div>
      {banners}
      <RecordDetailsGrid fields={identityFields} className="laboratory-summary-grid"/>
    </section>
    <section className="clinical-panel full-panel lab-record-card lab-summary-card">
      <div className="record-section-header"><div><span className="eyebrow">{en ? 'Timeline' : 'Χρονοδιάγραμμα'}</span><h3><Clock3 size={15}/> {en ? 'Timeline & priority' : 'Χρονοδιάγραμμα & προτεραιότητα'}</h3></div></div>
      <RecordDetailsGrid fields={timelineFields} className="laboratory-summary-grid"/>
      {surveillance && <div className="lab-summary-linked-row"><Link2 size={14}/><span>{t('surveillance')}</span><strong>{surveillance}</strong></div>}
    </section>
  </>
}
