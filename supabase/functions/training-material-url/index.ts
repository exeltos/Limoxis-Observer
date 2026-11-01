import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serveWithCors } from '../_shared/cors.ts'

// Public endpoint of a participant's personal training link (no account, verify_jwt = false):
// the participant opens one file of the programme inside the page. The access token is
// checked by training_access_files() (it lists only the files of the programme the token
// belongs to); the file must be in that list. A short-lived signed URL of the attachments
// bucket is returned (5 minutes); the page opens it in its own reader and sends the time
// spent through training_track_time().
const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Cache-Control': 'no-store' }
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers })
const fail = (code: string, status = 400) => reply({ ok: false, code }, status)

serveWithCors(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  if (req.method !== 'POST') return fail('METHOD_NOT_ALLOWED', 405)
  const url = Deno.env.get('SUPABASE_URL'), service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !service) return fail('SERVICE_UNAVAILABLE', 503)
  let body: { token?: unknown; attachmentId?: unknown }
  try { body = await req.json() } catch { return fail('TRAINING_MATERIAL_INVALID_REQUEST') }
  const token = String(typeof body.token === 'string' ? body.token : '').trim().slice(0, 200)
  const attachmentId = String(typeof body.attachmentId === 'string' ? body.attachmentId : '').trim()
  if (!token || !/^[0-9a-f-]{36}$/i.test(attachmentId)) return fail('TRAINING_MATERIAL_INVALID_REQUEST')

  const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } })
  // The token must open an assignment, and the file must belong to that assignment's programme.
  const { data: files, error: listError } = await admin.rpc('training_access_files', { p_token: token })
  if (listError) return fail('TRAINING_ACCESS_NOT_AVAILABLE', 404)
  const allowed = Array.isArray(files) && files.some((file: { id?: string }) => file?.id === attachmentId)
  if (!allowed) return fail('TRAINING_MATERIAL_NOT_AVAILABLE', 404)

  const { data: attachment, error: attachmentError } = await admin.from('attachments').select('storage_path,file_name,mime_type').eq('id', attachmentId).is('deleted_at', null).maybeSingle()
  if (attachmentError || !attachment) return fail('TRAINING_MATERIAL_NOT_AVAILABLE', 404)
  const { data: signed, error: signError } = await admin.storage.from('attachments').createSignedUrl(attachment.storage_path, 300)
  if (signError || !signed?.signedUrl) return fail('TRAINING_MATERIAL_UNAVAILABLE', 500)
  return reply({ ok: true, url: signed.signedUrl, fileName: attachment.file_name, mimeType: attachment.mime_type })
})
