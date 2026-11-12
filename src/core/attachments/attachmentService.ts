import { supabase } from '../supabase/client'
import type { Json } from '../supabase/database.types'
import { hasSupabaseConfig } from '../config/env'
import { isDemoDataEnvironment } from '../data/dataEnvironment'

const BUCKET = 'attachments'

type AttachmentRow = { id: string; file_name: string; storage_path: string; mime_type: string | null; size_bytes: number | null; metadata: Json; created_at: string }
interface AttachmentMetadata { category?: string; description?: string }

export interface StoredAttachment {
  id: string
  name: string
  size: number
  type: string
  category: string
  description: string
  storagePath: string
  url: string
  createdAt: string
}

export function cloudAttachmentsEnabled(): boolean {
  return hasSupabaseConfig && Boolean(supabase) && !isDemoDataEnvironment()
}

function fromRow(row: AttachmentRow, signedUrl?: string): StoredAttachment {
  const metadata = row.metadata as AttachmentMetadata | null
  return {
    id: row.id,
    name: row.file_name,
    size: row.size_bytes || 0,
    type: row.mime_type || '',
    category: metadata?.category || 'other',
    description: metadata?.description || '',
    storagePath: row.storage_path,
    url: signedUrl || '',
    createdAt: row.created_at,
  }
}

// Signed URLs are short-lived by design (the bucket is private) — callers
// should request a fresh one right before use (e.g. when the user clicks
// "view"), not cache it long-term.
export async function getAttachmentUrl(storagePath: string): Promise<string> {
  if (!cloudAttachmentsEnabled()) return ''
  const { data, error } = await supabase!.storage.from(BUCKET).createSignedUrl(storagePath, 300)
  if (error) throw error
  return data?.signedUrl || ''
}

export async function loadAttachments(organizationId: string | null | undefined, entityType: string | null | undefined, entityId: string | number | null | undefined): Promise<StoredAttachment[]> {
  if (!cloudAttachmentsEnabled() || !organizationId || !entityId) return []
  const { data, error } = await supabase!
    .from('attachments')
    .select('id,file_name,storage_path,mime_type,size_bytes,metadata,created_at')
    .eq('organization_id', organizationId)
    .eq('entity_type', entityType as string)
    .eq('entity_id', String(entityId))
    .is('deleted_at', null)
    .order('created_at')
  if (error) throw error
  return (data || []).map(row => fromRow(row))
}

export async function uploadAttachment(organizationId: string | null | undefined, entityType: string | null | undefined, entityId: string | number | null | undefined, file: File, { category = 'other', description = '' }: AttachmentMetadata = {}): Promise<StoredAttachment> {
  if (!cloudAttachmentsEnabled()) throw new Error('CLOUD_ATTACHMENTS_DISABLED')
  if (!organizationId || !entityId) throw new Error('MISSING_ATTACHMENT_CONTEXT')
  const safeName = file.name.replace(/[^\w.-]+/g, '_')
  const storagePath = `${organizationId}/${entityType}/${entityId}/${Date.now()}-${safeName}`
  const { error: uploadError } = await supabase!.storage.from(BUCKET).upload(storagePath, file, { contentType: file.type || undefined })
  if (uploadError) throw uploadError
  const { data: authData } = await supabase!.auth.getUser()
  const { data, error } = await supabase!
    .from('attachments')
    .insert({
      organization_id: organizationId,
      entity_type: entityType as string,
      entity_id: String(entityId),
      file_name: file.name,
      storage_path: storagePath,
      mime_type: file.type || null,
      size_bytes: file.size,
      uploaded_by: authData?.user?.id || null,
      metadata: { category, description },
    })
    .select('id,file_name,storage_path,mime_type,size_bytes,metadata,created_at')
    .single()
  if (error) {
    // Best-effort cleanup: don't leave an orphaned file if the metadata row failed.
    await supabase!.storage.from(BUCKET).remove([storagePath]).catch(() => {})
    throw error
  }
  return fromRow(data)
}

export async function updateAttachmentMetadata(id: string | null, { category, description }: AttachmentMetadata): Promise<StoredAttachment> {
  if (!cloudAttachmentsEnabled()) throw new Error('CLOUD_ATTACHMENTS_DISABLED')
  const { data, error } = await supabase!
    .from('attachments')
    .update({ metadata: { category, description } })
    .eq('id', id as string)
    .select('id,file_name,storage_path,mime_type,size_bytes,metadata,created_at')
    .single()
  if (error) throw error
  return fromRow(data)
}

export async function deleteAttachment(id: string): Promise<void> {
  if (!cloudAttachmentsEnabled()) throw new Error('CLOUD_ATTACHMENTS_DISABLED')
  const { error } = await supabase!.from('attachments').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}
