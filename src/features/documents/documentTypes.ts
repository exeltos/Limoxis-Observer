import type { AttachmentFile } from '../../design-system/AttachmentField'

// A controlled document as the screens keep it (documentService translates the rows of controlled_documents).

// One line of a document's history (the audit log, or the Demo's own).
export type DocumentHistoryEvent = { at: string, actor: string, actorId?: string | null, action: string, oldStatus?: string | null, newStatus?: string | null, version?: string | null, reason?: string, eventType?: string }
// (A type alias, not an interface: the record is also exported as plain data.)
export type DocumentRecord = {
  id: string
  dbId?: string
  organizationId?: string
  code?: string
  title: string
  type: string
  // A protocol's kind and clinical area; a licence's renewal and what requires it.
  protocolKind?: string
  clinicalArea?: string
  renewalMonths?: number | string
  requiredBy?: string[]
  departmentId?: string | null
  department?: string
  audience?: string
  status: string
  version?: string
  description?: string
  ownerId?: string | null
  owner?: string
  revisionOfDbId?: string | null
  supersedesDbId?: string | null
  // The Demo links its versions by their codes.
  revisionOfId?: string | null
  supersedesId?: string | null
  supersededById?: string | null
  revisionReason?: string
  effectiveDate?: string
  reviewDate?: string
  approvedAt?: string | null
  approvedBy?: string | null
  approvedById?: string | null
  publishedAt?: string | null
  publishedBy?: string | null
  publishedById?: string | null
  createdAt?: string
  createdBy?: string
  createdById?: string | null
  updatedAt?: string
  updatedBy?: string
  updatedById?: string | null
  attachments?: (AttachmentFile & { fileName?: string })[]
  history?: DocumentHistoryEvent[]
}
// A new document (or its form): no code or status yet.
export type DocumentDraft = Omit<DocumentRecord, 'id' | 'status'> & { id?: string, status?: string }
// A department a document can belong to.
export type DocumentDepartment = { id: string, name: string, nameEn?: string }
// A document's versions together: the first, the current, the one in force.
export type DocumentFamily = { key: string, current: DocumentRecord, root: DocumentRecord, versions: DocumentRecord[], versionCount: number, activePublished: DocumentRecord | null }
