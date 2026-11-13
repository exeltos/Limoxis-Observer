import { useEffect, useState } from 'react'
import { cloudAttachmentsEnabled, deleteAttachment, getAttachmentUrl, loadAttachments, uploadAttachment } from '../../../core/attachments/attachmentService'
import type { Certification, SupplierDocumentRow, SupplierFile } from './resourceTypes'

// The supplier's documents are one list: each certificate, licence or contract with its file,
// and the files attached without such details. In the demo the files stay in the browser.
export const SUPPLIER_FILE_ENTITY = 'quality_supplier'

export function useSupplierFiles(organizationId: string | null | undefined, supplierId: string) {
  const cloud = cloudAttachmentsEnabled() && Boolean(organizationId) && Boolean(supplierId) && supplierId !== 'new'
  const [files, setFiles] = useState<SupplierFile[]>([])
  useEffect(() => {
    if (!cloud) { setFiles([]); return undefined }
    let cancelled = false
    loadAttachments(organizationId, SUPPLIER_FILE_ENTITY, supplierId).then(rows => { if (!cancelled) setFiles(rows) }).catch(error => console.error(error))
    return () => { cancelled = true }
  }, [cloud, organizationId, supplierId])
  return { files, setFiles, cloud }
}

// The documents as rows: the certificates first (with their file), then the files without details.
export function supplierDocumentRows(certifications: Certification[] = [], files: SupplierFile[] = []): SupplierDocumentRow[] {
  const linked = new Set(certifications.map(item => item.attachmentId).filter(Boolean))
  return [
    ...certifications.map(cert => ({ key: cert.id, cert, file: files.find(file => file.id === cert.attachmentId) || null })),
    ...files.filter(file => !linked.has(file.id)).map(file => ({ key: file.id, cert: null, file })),
  ]
}

const KIND_OF_CATEGORY: Record<string, string> = { certification: 'certificate', contract: 'contract' }
// A file without details becomes a document: its name (or description) is the document, its category the kind.
export const certificationFromFile = (base: Certification, file: SupplierFile) => ({ ...base, type: file.description || file.name.replace(/\.[^.]+$/, ''), kind: KIND_OF_CATEGORY[file.category] || 'other', attachmentId: file.id })

export async function attachSupplierFile(cloud: boolean, organizationId: string | null | undefined, supplierId: string, file: File, kind: string) {
  const category = kind === 'certificate' ? 'certification' : kind === 'contract' ? 'contract' : 'generalDocument'
  if (cloud) return uploadAttachment(organizationId, SUPPLIER_FILE_ENTITY, supplierId, file, { category })
  return { id: `file-${Date.now().toString(36)}`, name: file.name, size: file.size, type: file.type, category, description: '', objectUrl: URL.createObjectURL(file) }
}

export async function removeSupplierFile(cloud: boolean, file: SupplierFile | null) {
  if (!file) return
  if (cloud) await deleteAttachment(file.id)
  else if (file.objectUrl) URL.revokeObjectURL(file.objectUrl)
}

export async function openSupplierFile(cloud: boolean, file: SupplierFile | null) {
  if (!file) return
  if (!cloud) { if (file.objectUrl) window.open(file.objectUrl, '_blank', 'noopener,noreferrer'); return }
  const preview = window.open('about:blank', '_blank')
  try {
    const url = await getAttachmentUrl(file.storagePath as string)
    if (preview && url) { preview.opener = null; preview.location.href = url } else preview?.close()
  } catch (error) { preview?.close(); throw error }
}
