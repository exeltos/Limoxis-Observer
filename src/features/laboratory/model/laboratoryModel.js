const SAMPLE_SUBJECT_TYPES = new Set(['patient', 'employee', 'environment'])
const SAMPLE_STATUSES = new Set(['requested', 'collected', 'received', 'processing', 'completed', 'rejected'])

export function normalizeLaboratorySample(row = {}) {
  const recordId = row.recordId ?? row.record_id ?? row.uuid ?? row.id ?? null
  const code = String(row.code ?? row.sampleCode ?? row.sample_code ?? row.id ?? '').trim()
  const subjectType = SAMPLE_SUBJECT_TYPES.has(row.subjectType ?? row.subject_type) ? (row.subjectType ?? row.subject_type) : 'patient'
  const rawStatus = row.status ?? 'requested'
  const microbiologyResults = row.microbiologyResults ?? (row.result || row.resultStatus ? [{
    id: row.resultId ?? `${code}-result`,
    result: row.result ?? null,
    resultStatus: row.resultStatus ?? 'draft',
    organism: row.organism ?? null,
    resistance: row.resistance ?? null,
    critical: Boolean(row.critical),
    resultedAt: row.resultedAt ?? null,
    method: row.method ?? '',
    ast: row.ast ?? [],
    communications: row.communications ?? [],
  }] : [])
  const sampleType = row.sampleType ?? row.sample_type ?? row.type ?? 'other'
  const subjectName = row.subjectName ?? row.subject_name ?? row.patient ?? ''
  const subjectNameEn = row.subjectNameEn ?? row.subject_name_en ?? row.patientEn ?? row.patient ?? ''
  const subjectCode = row.subjectCode ?? row.subject_code ?? row.patientCode ?? row.patient_code ?? ''
  return {
    recordId,
    id: code,
    code,
    organizationId: row.organizationId ?? row.organization_id ?? null,
    subjectType,
    subjectId: row.subjectId ?? row.subject_id ?? row.patientId ?? row.patient_id ?? null,
    subjectName,
    subjectNameEn,
    subjectCode,
    patient: subjectName,
    patientEn: subjectNameEn,
    patientId: subjectCode,
    departmentId: row.departmentId ?? row.department_id ?? row.department ?? null,
    department: row.department ?? row.departmentName ?? row.department_name ?? '',
    departmentEn: row.departmentEn ?? row.departmentNameEn ?? row.department_name_en ?? row.department ?? row.departmentName ?? row.department_name ?? '',
    sampleType,
    type: sampleType,
    source: row.source ?? row.collectionSource ?? row.collection_source ?? '',
    sourceEn: row.sourceEn ?? row.collectionSourceEn ?? row.collection_source_en ?? row.source ?? '',
    status: SAMPLE_STATUSES.has(rawStatus) ? rawStatus : 'requested',
    result: row.result ?? row.resultStatus ?? row.result_status ?? null,
    organism: row.organism ?? null,
    resistance: row.resistance ?? row.resistanceClass ?? row.resistance_class ?? null,
    critical: Boolean(row.critical ?? row.is_critical),
    priority: row.priority ?? 'routine',
    requestedAt: row.requestedAt ?? row.requested_at ?? null,
    collectedAt: row.collectedAt ?? row.collected_at ?? null,
    receivedAt: row.receivedAt ?? row.received_at ?? null,
    rejectedAt: row.rejectedAt ?? row.rejected_at ?? null,
    rejectionReason: row.rejectionReason ?? row.rejection_reason ?? '',
    resultedAt: row.resultedAt ?? row.resulted_at ?? null,
    surveillanceCase: row.surveillanceCase ?? row.surveillance_case ?? row.surveillanceCaseId ?? row.surveillance_case_id ?? null,
    employeeSurveillanceId: row.employeeSurveillanceId ?? row.employee_surveillance_id ?? null,
    employeeSurveillanceBatchId: row.employeeSurveillanceBatchId ?? row.employee_surveillance_batch_id ?? null,
    environmentalMethod: row.environmentalMethod ?? row.environmental_method ?? '',
    microbiologyResults,
    documentsReviewedAt: row.documentsReviewedAt ?? row.documents_reviewed_at ?? null,
    finalizedAt: row.finalizedAt ?? row.finalized_at ?? null,
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
