import { RecordDetailsGrid } from '../../design-system/RecordDetailsGrid'
import { ENVIRONMENTAL_CATEGORIES, environmentalMethodLabel, sampleTypeLabel } from './laboratoryCloudService'
import { computeTurnaroundHours, formatTurnaround } from './model/laboratoryModel'

function subjectLabel(subjectType, language) {
  if (subjectType === 'employee') return language === 'en' ? 'Employee' : 'Εργαζόμενος'
  if (subjectType === 'environment') return language === 'en' ? 'Sampling point / location' : 'Σημείο / χώρος δειγματοληψίας'
  return language === 'en' ? 'Patient' : 'Ασθενής'
}

export function LaboratorySampleSummary({ sample, t, language, fmt }) {
  const isEnvironmental = sample.subjectType === 'environment' || ENVIRONMENTAL_CATEGORIES.includes(sample.type)
  const rawSurveillance = sample.surveillanceCase || sample.employeeSurveillanceId || sample.environmentalBatchId || ''
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(rawSurveillance))
  const surveillance = !rawSurveillance ? '—' : isUuid ? (language === 'en' ? 'Linked record' : 'Συνδεδεμένη εγγραφή') : rawSurveillance
  const result = sample.result ? t(sample.result) : '—'
  const organism = sample.organism || '—'
  const resistance = sample.resistance || '—'
  const fields = [
    { id: 'subject', label: subjectLabel(sample.subjectType, language), value: sample.subjectName || sample.patient },
    { id: 'department', label: t('department'), value: sample.department },
    { id: 'sampleType', label: t('sampleType'), value: sampleTypeLabel(sample.type, t) },
    isEnvironmental
      ? { id: 'method', label: language === 'en' ? 'Sampling method' : 'Μέθοδος δειγματοληψίας', value: environmentalMethodLabel(sample.environmentalMethod, t) || sample.source }
      : { id: 'source', label: t('clinicalSource'), value: sample.source },
    { id: 'priority', label: t('priority'), value: sample.priority ? t(sample.priority) : '—' },
    { id: 'collected', label: t('collectedLabel'), value: fmt(sample.collectedAt) },
    { id: 'received', label: t('received'), value: fmt(sample.receivedAt) },
    { id: 'turnaround', label: t('laboratoryRecords.turnaroundTime'), value: formatTurnaround(computeTurnaroundHours(sample), language) },
    { id: 'result', label: t('result'), value: result },
    { id: 'organism', label: language === 'en' ? 'Organism' : 'Μικροοργανισμός', value: organism },
    { id: 'resistance', label: language === 'en' ? 'AMR classification' : 'Κατάταξη AMR', value: resistance },
    { id: 'surveillance', label: t('surveillance'), value: surveillance },
  ]
  return <RecordDetailsGrid fields={fields}/>
}
