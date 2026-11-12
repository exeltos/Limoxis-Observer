import { supabase } from '../supabase/client'
import { hasSupabaseConfig } from '../config/env'
import { isDemoDataEnvironment } from '../data/dataEnvironment'

const BUCKET = 'attachments'

export function cloudAttachmentsEnabled() {
  return hasSupabaseConfig && Boolean(supabase) && !isDemoDataEnvironment()
}

function fromRow(row, signedUrl) {
  return {
    id: row.id,
    name: row.file_name,
    size: row.size_bytes || 0,
    type: row.mime_type || '',
    category: row.metadata?.category || 'other',
    description: row.metadata?.description || '',
    storagePath: row.storage_path,
    url: signedUrl || '',
    createdAt: row.created_at,
  }
}

// Signed URLs are short-lived by design (the bucket is private) — callers
// should request a fresh one right before use (e.g. when the user clicks
// "view"), not cache it long-term.
export async function getAttachmentUrl(storagePath) {
  if (!cloudAttachmentsEnabled()) return ''
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 300)
  if (error) throw error
  return data?.signedUrl || ''
}

export async function loadAttachments(organizationId, entityType, entityId) {
  if (!cloudAttachmentsEnabled() || !organizationId || !entityId) return []
  const { data, error } = await supabase
    .from('attachments')
    .select('id,file_name,storage_path,mime_type,size_bytes,metadata,created_at')
    .eq('organization_id', organizationId)
    .eq('entity_type', entityType)
    .eq('entity_id', String(entityId))
    .is('deleted_at', null)
    .order('created_at')
  if (error) throw error
  return (data || []).map(row => fromRow(row))
}

export async function uploadAttachment(organizationId, entityType, entityId, file, { category = 'other', description = '' } = {}) {
  if (!cloudAttachmentsEnabled()) throw new Error('CLOUD_ATTACHMENTS_DISABLED')
  if (!organizationId || !entityId) throw new Error('MISSING_ATTACHMENT_CONTEXT')
  const safeName = file.name.replace(/[^\w.-]+/g, '_')
  const storagePath = `${organizationId}/${entityType}/${entityId}/${Date.now()}-${safeName}`
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file, { contentType: file.type || undefined })
  if (uploadError) throw uploadError
  const { data: authData } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('attachments')
    .insert({
      organization_id: organizationId,
      entity_type: entityType,
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
    await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {})
    throw error
  }
  return fromRow(data)
}

export async function updateAttachmentMetadata(id, { category, description }) {
  if (!cloudAttachmentsEnabled()) throw new Error('CLOUD_ATTACHMENTS_DISABLED')
  const { data, error } = await supabase
    .from('attachments')
    .update({ metadata: { category, description } })
    .eq('id', id)
    .select('id,file_name,storage_path,mime_type,size_bytes,metadata,created_at')
    .single()
  if (error) throw error
  return fromRow(data)
}

export async function deleteAttachment(id) {
  if (!cloudAttachmentsEnabled()) throw new Error('CLOUD_ATTACHMENTS_DISABLED')
  const { error } = await supabase.from('attachments').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}
