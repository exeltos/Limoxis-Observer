import { RecordDetailsGrid } from '../../design-system/RecordDetailsGrid'
import { ENVIRONMENTAL_CATEGORIES, environmentalMethodLabel, sampleTypeLabel } from './laboratoryCloudService'

function subjectLabel(subjectType, language) {
  if (subjectType === 'employee') return language === 'en' ? 'Employee' : 'Εργαζόμενος'
  if (subjectType === 'environment') return language === 'en' ? 'Sampling point / location' : 'Σημείο / χώρος δειγματοληψίας'
  return language === 'en' ? 'Patient' : 'Ασθενής'
}

export function LaboratorySampleSummary({ sample, t, language, fmt }) {
  const isEnvironmental = sample.subjectType === 'environment' || ENVIRONMENTAL_CATEGORIES.includes(sample.type)
  const surveillance = sample.surveillanceCase || sample.employeeSurveillanceId || sample.environmentalBatchId || '—'
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
    { id: 'surveillance', label: t('surveillance'), value: surveillance },
  ]
  return <RecordDetailsGrid fields={fields}/>
}
