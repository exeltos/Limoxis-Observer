const SAMPLE_SUBJECT_TYPES = new Set(['patient', 'employee', 'environment'])
const SAMPLE_STATUSES = new Set(['requested', 'collected', 'received', 'processing', 'completed', 'rejected'])

export function normalizeLaboratorySample(row = {}) {
  const recordId = row.recordId ?? row.record_id ?? row.uuid ?? null
  const code = String(row.code ?? row.sampleCode ?? row.sample_code ?? row.id ?? '').trim()
  const subjectType = SAMPLE_SUBJECT_TYPES.has(row.subjectType ?? row.subject_type) ? (row.subjectType ?? row.subject_type) : 'patient'
  const rawStatus = row.status ?? 'requested'
  return {
    recordId,
    id: code,
    code,
    organizationId: row.organizationId ?? row.organization_id ?? null,
    subjectType,
    subjectId: row.subjectId ?? row.subject_id ?? row.patientId ?? row.patient_id ?? null,
    subjectName: row.subjectName ?? row.subject_name ?? row.patient ?? '',
    subjectNameEn: row.subjectNameEn ?? row.subject_name_en ?? row.patientEn ?? row.patient ?? '',
    subjectCode: row.subjectCode ?? row.subject_code ?? row.patientCode ?? row.patient_code ?? '',
    departmentId: row.departmentId ?? row.department_id ?? row.department ?? null,
    department: row.department ?? row.departmentName ?? row.department_name ?? '',
    departmentEn: row.departmentEn ?? row.departmentNameEn ?? row.department_name_en ?? row.department ?? row.departmentName ?? row.department_name ?? '',
    sampleType: row.sampleType ?? row.sample_type ?? row.type ?? 'other',
    source: row.source ?? row.collectionSource ?? row.collection_source ?? '',
    sourceEn: row.sourceEn ?? row.collectionSourceEn ?? row.collection_source_en ?? row.source ?? '',
    status: SAMPLE_STATUSES.has(rawStatus) ? rawStatus : 'requested',
    result: row.result ?? row.resultStatus ?? row.result_status ?? null,
    organism: row.organism ?? null,
    resistance: row.resistance ?? row.resistanceClass ?? row.resistance_class ?? null,
    critical: Boolean(row.critical ?? row.is_critical),
    requestedAt: row.requestedAt ?? row.requested_at ?? null,
    collectedAt: row.collectedAt ?? row.collected_at ?? null,
    resultedAt: row.resultedAt ?? row.resulted_at ?? null,
    surveillanceCase: row.surveillanceCase ?? row.surveillance_case ?? row.surveillanceCaseId ?? row.surveillance_case_id ?? null,
    employeeSurveillanceId: row.employeeSurveillanceId ?? row.employee_surveillance_id ?? null,
    employeeSurveillanceBatchId: row.employeeSurveillanceBatchId ?? row.employee_surveillance_batch_id ?? null,
  }
}

export function normalizeLaboratorySamples(rows) {
  if (!Array.isArray(rows)) throw new Error('INVALID_LABORATORY_SAMPLE_COLLECTION')
  return rows.map(normalizeLaboratorySample)
}

export function validateLaboratorySample(sample) {
  const errors = []
  if (!sample?.code) errors.push('code')
  if (!SAMPLE_SUBJECT_TYPES.has(sample?.subjectType)) errors.push('subjectType')
  if (!SAMPLE_STATUSES.has(sample?.status)) errors.push('status')
  return { valid: errors.length === 0, errors }
}
