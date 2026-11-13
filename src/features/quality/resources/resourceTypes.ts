import type { Tables } from '../../../core/supabase/database.types'
import type { StoredAttachment } from '../../../core/attachments/attachmentService'

// The shapes the resource screens keep: equipment with its events, suppliers with
// their certificates, evaluations, nonconformities and contacts, the evaluation
// templates, and the renewal requests of certificates. resourceService and
// supplierRelations translate them to and from the database rows (database.types).

// A number typed in a field: a number, or text while it is typed ('' when empty).
export type NumberInput = number | string
// The score of a criterion: a number, or '' while it is not scored.
export type Score = number | string

// --- Equipment ---------------------------------------------------------------------

// The fields of a device that hold the interval (months) of each programme check.
export type ProgrammeField = 'maintenanceMonths' | 'calibrationMonths' | 'safetyMonths'

export interface Equipment {
  id: string
  code: string
  name: string
  equipmentType: string
  departmentId: string
  location: string
  manufacturer: string
  model: string
  serialNumber: string
  inventoryNumber: string
  supplierId: string
  criticality: string
  status: string
  installedOn: string
  warrantyEndsOn: string
  maintenanceMonths: NumberInput
  calibrationMonths: NumberInput
  safetyMonths: NumberInput
  notes: string
  createdAt?: string
  updatedAt?: string
}

// A check, failure or repair of a device as it is typed in the form.
export interface EventDraft {
  kind: string
  happenedOn: string
  result: string
  performedBy: string
  description: string
  certificate: string
  capaCode?: string
}
// A recorded event.
export interface EquipmentEvent extends EventDraft {
  id: string
  equipmentId: string
  capaCode: string
  recordedAt: string
}

// One check of a device's programme: when it was last done, when it is due.
export interface ProgrammeState {
  kind: string
  months: number
  last: EquipmentEvent | null
  nextDue: string
  state: string
  days: number | null
}
export interface EquipmentStatus {
  state: string
  programme: ProgrammeState[]
  next: ProgrammeState | null
  due: string
  downSince: string
  downEvent: EquipmentEvent | null
  lastEvent: EquipmentEvent | null
  failures: number
  warrantyActive: boolean
}
// A device as the lists show it: its state, and the names of its department and supplier.
export interface EquipmentRow extends Equipment, EquipmentStatus {
  eventCount: number
  department?: string
  departmentEn?: string
  supplierName?: string
  typeLabel?: string
}

export interface EquipmentFilters {
  query: string
  department: string
  state: string
  due: string
  criticality: string
  quick: string | null
}

// --- Suppliers ---------------------------------------------------------------------

export interface Certification {
  id: string
  type: string
  title?: string
  kind?: string
  number: string
  issuer: string
  expiresOn: string
  attachmentId?: string
}
// A certificate in its dialog, with the file chosen to upload with it.
export interface CertificationDraft extends Certification {
  pendingFile?: File
}

export interface Nonconformity {
  id: string
  date: string
  description: string
  severity: string
  status: string
  capaCode: string
  closedOn: string
}

export interface Contact {
  id: string
  fullName: string
  jobTitle: string
  phone: string
  email: string
  notes: string
}

// A criterion of an evaluation as scored (on a template, or one of the six fixed ones).
export interface EvaluationCriterion {
  id?: string
  criterionId: string
  label: string
  description?: string
  weight: NumberInput
  optional?: boolean
  position: number
  score: Score
}

// The thresholds and scale of a template or of an evaluation made on one.
export interface Thresholds {
  passThreshold?: NumberInput | null
  conditionalThreshold?: NumberInput | null
  scoreScale?: NumberInput
}

// An evaluation: on a template (its snapshot and criteria) or an earlier one on the
// six fixed criteria (scores and weights by criterion key).
export interface Evaluation extends Thresholds {
  id: string
  evaluatedOn: string
  evaluator: string
  notes: string
  source?: string
  scores?: Record<string, Score>
  weights?: Record<string, number>
  templateId?: string
  templateName?: string
  templateVersion?: number
  frequencyMonths?: number
  totalScore?: NumberInput | null
  result?: string
  criteriaScores?: string
  periodYear?: number | string
  criteria?: EvaluationCriterion[]
}
// The fields an evaluation's result is worked out from (all optional: a template's
// snapshot and criteria, or the scores of the six fixed criteria).
export type EvaluationResultFields = Omit<Evaluation, 'id' | 'evaluatedOn' | 'evaluator' | 'notes'>

export interface Supplier {
  id: string
  code: string
  name: string
  legalName: string
  category: string
  criticality: string
  status: string
  taxId: string
  contactName: string
  phone: string
  email: string
  address: string
  city: string
  country: string
  website: string
  products: string
  contractEndsOn: string
  approvalStatus: string
  evaluationMonths: NumberInput
  notes: string
  departmentIds?: string[]
  certifications?: Certification[]
  evaluations?: Evaluation[]
  nonconformities?: Nonconformity[]
  contacts?: Contact[]
  createdAt?: string
  updatedAt?: string
}

export interface SupplierStatus {
  approval: string
  score: number | null
  latestEvaluation: Evaluation | null
  scoredEvaluation: Evaluation | null
  evaluationDue: boolean
  evaluationMonths: number
  nextEvaluation: string
  expiredCertificates: number
  expiringCertificates: number
  openNonconformities: number
  majorOpen: number
  contractState: string
}
// A supplier as the lists show it (its evaluation frequency as worked out).
export type SupplierRow = Omit<Supplier, 'evaluationMonths'> & SupplierStatus & { equipmentCount: number }

export interface SupplierFilters {
  query: string
  category: string
  approval: string
  criticality: string
  status: string
  quick: string | null
}

// The lists of a supplier edited one entry at a time, and an entry of any of them.
export type SupplierListField = 'evaluations' | 'certifications' | 'nonconformities' | 'contacts'
export type SupplierListEntry = { id: string } & Partial<Omit<CertificationDraft, 'id'>> & Partial<Omit<Evaluation, 'id'>> & Partial<Omit<Nonconformity, 'id'>> & Partial<Omit<Contact, 'id'>>
// The entry open in its dialog, with the list it belongs to.
export interface SupplierItemEditing {
  field: SupplierListField
  item: SupplierListEntry
}

// A file of the supplier: stored (cloud) or kept in the browser (demo, with its object URL).
export interface SupplierFile extends Pick<StoredAttachment, 'id' | 'name' | 'size' | 'type' | 'category' | 'description'>, Partial<Pick<StoredAttachment, 'storagePath' | 'url' | 'createdAt'>> {
  objectUrl?: string
}
// A document of the supplier: a certificate (with its file, if any) or a file without details.
export type SupplierDocumentRow = { key: string, cert: Certification, file: SupplierFile | null } | { key: string, cert: null, file: SupplierFile }

// A line of the evaluations sheet: a supplier and its latest evaluation.
export interface SupplierSheetRow {
  supplier: Pick<Supplier, 'name' | 'category' | 'evaluations'>
  evaluation: Evaluation | null
}

// --- Evaluation templates ----------------------------------------------------------

export interface TemplateCriterion {
  id: string
  label: string
  description: string
  weight: NumberInput
  optional: boolean
}
export interface EvaluationTemplate {
  id: string
  name: string
  description: string
  categories: string[]
  passThreshold: NumberInput
  conditionalThreshold: NumberInput
  frequencyMonths: NumberInput
  scoreScale: NumberInput
  active: boolean
  version: number
  source?: string
  updatedAt?: string
  criteria: TemplateCriterion[]
}

// The resources as the service returns them (and the demo keeps them in the browser).
export interface ResourceState {
  suppliers: Supplier[]
  equipment: Equipment[]
  events: EquipmentEvent[]
  templates: EvaluationTemplate[]
}
// A template in its editor, with the template as it was before the edit (none when new).
export interface TemplateEditing {
  draft: EvaluationTemplate
  before: EvaluationTemplate | null
}

// --- Database rows -----------------------------------------------------------------

export type EvaluationDbRow = Tables<'quality_supplier_evaluations'> & { scores?: Tables<'quality_supplier_evaluation_scores'>[] | null }
export type SupplierDbRow = Tables<'quality_suppliers'> & {
  certifications?: Tables<'quality_supplier_certifications'>[] | null
  evaluations?: EvaluationDbRow[] | null
  nonconformities?: Tables<'quality_supplier_nonconformities'>[] | null
  contacts?: Tables<'quality_supplier_contacts'>[] | null
}
export type TemplateDbRow = Tables<'quality_supplier_eval_templates'> & { criteria?: Tables<'quality_supplier_eval_template_criteria'>[] | null }
// A stored score row of an evaluation, as read back to keep its id.
export type StoredScoreRow = Pick<Tables<'quality_supplier_evaluation_scores'>, 'id' | 'criterion' | 'criterion_id' | 'criterion_label'>

// --- Renewal of certificates -------------------------------------------------------

// The certificate as it was when it was requested (and before it was replaced).
export interface CertificateSnapshot {
  certificate_type?: string
  certificate_number?: string
  issuer?: string
  expires_on?: string
}
// What the supplier submitted for one certificate.
export interface RenewalSubmission {
  type: string
  number: string
  issuer: string
  issuedOn: string
  expiresOn: string
  note: string
}
export interface RenewalAttachment {
  id: string
  name: string
  storagePath: string
  type: string
  size: number
}
// One certificate of a request.
export interface RequestItem {
  id: string
  requestId: string
  supplierId: string
  certificationId: string
  status: string
  snapshot: CertificateSnapshot
  submittedAt: string
  submitted: RenewalSubmission
  attachment: RenewalAttachment | null
  reviewedAt: string
  reviewComment: string
  previous: CertificateSnapshot | null
  history: Record<string, string>[]
  updatedAt?: string
}
export interface SendHistoryEntry {
  kind: string
  at: string
  expiresAt: string
}
// One request (one e-mail, one link) to a supplier, with its certificates.
export interface CertificateRequest {
  id: string
  supplierId: string
  recipientEmail: string
  status: string
  requestedAt: string
  approvedAt: string
  sentAt: string
  firstSentAt: string
  sendCount: number
  reminderCount: number
  lastReminderAt: string
  history: SendHistoryEntry[]
  tokenExpiresAt: string
  reviewComment: string
  updatedAt?: string
  items: RequestItem[]
}
export type RequestItemWithRequest = RequestItem & { request: CertificateRequest }

export type AttachmentDbRow = Pick<Tables<'attachments'>, 'id' | 'file_name' | 'storage_path' | 'mime_type' | 'size_bytes'>
export type RequestItemDbRow = Tables<'quality_supplier_certificate_request_items'> & { attachment?: AttachmentDbRow | null }
export type CertificateRequestDbRow = Tables<'quality_supplier_certificate_requests'> & { items?: RequestItemDbRow[] | null }

// A certificate to renew, with its supplier, addresses and latest request.
export interface RenewalQueueRow {
  key: string
  supplierId: string
  supplierCode: string
  supplierName: string
  certification: Certification
  state: string
  days: number | null
  recipients: string[]
  recipient: string
  item: RequestItemWithRequest | null
  request: CertificateRequest | null
  selectable: boolean
}
// The certificates to renew of one supplier.
export interface RenewalGroupBase {
  key: string
  supplierId: string
  supplierCode: string
  supplierName: string
  recipients: string[]
  rows: RenewalQueueRow[]
  requests: CertificateRequest[]
}
export interface RenewalGroup extends RenewalGroupBase {
  request: CertificateRequest | null
  selectable: RenewalQueueRow[]
  recipient: string
  days: number
  expired: number
  submitted: number
  noResponse: number | null
  link: string
}
export interface RenewalSendGroup {
  supplierId: string
  supplierName: string
  recipient: string
  recipients: string[]
  rows: RenewalQueueRow[]
}
// An item the approval sends (the database function's argument).
export type RenewalSendItem = { certification_id: string, recipient_email: string }
export interface RenewalCreateResult {
  created?: number
  requests?: number
  sent?: number
  skipped?: unknown[]
  simulated?: boolean
}

// The nightly automatic e-mailing of a hospital.
export interface RenewalSettings {
  autoEnabled: boolean
  remindAfterDays: NumberInput
  maxReminders: NumberInput
  lastRunAt: string
  lastResult: Record<string, unknown> | null
}

// The supplier's public page: the hospital, and each certificate asked.
export interface SupplierAccessItem {
  id: string
  status: string
  type: string
  title: string
  number: string
  issuer: string
  expiresOn: string
  submittedAt: string | null
  reviewComment: string | null
}
export interface SupplierAccess {
  status: string
  demo?: boolean
  organizationName?: string
  organizationLogo?: string | null
  organizationEmail?: string
  organizationPhone?: string
  supplierName?: string
  expiresAt?: string
  items?: SupplierAccessItem[]
}
