import { supabase as configuredClient, type Cloud } from '../../core/supabase/client'
import { hasSupabaseConfig } from '../../core/config/env'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { invalidateEmployeesCache } from './employeesCache'
import type { AnyRecord } from '../../types/featureTypes'

// The calls below run with a configured client: the demo and an unconfigured build return before them.
const supabase = configuredClient as Cloud

// The employee photo lives in the private `attachments` bucket under
// <organization>/employee_photo/<employee uuid>/<file>, and employees.photo_path
// points to it (see supabase/migrations/20261121100000_employee_photo.sql).
// Colleagues of the organisation may read it (staff directory); only whoever may
// edit the employee may add, replace or remove it. In the demo workspace the
// photo is kept on the demo row as a small data URL.
const BUCKET = 'attachments'
export const PHOTO_FOLDER = 'employee_photo'
export const PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp'
export const PHOTO_TYPES = PHOTO_ACCEPT.split(',')
export const PHOTO_MAX_BYTES = 8 * 1024 * 1024
// Stored photos are cut down to this edge (pixels): enough for a header avatar
// and a printable record, small enough to load a whole registry page quickly.
export const PHOTO_MAX_EDGE = 512
const SIGNED_URL_SECONDS = 3600
// Signed URLs are reused for a while, then asked for again before they expire.
const CACHE_MS = 45 * 60 * 1000
// A page left open asks again once the cached URL is stale, well before the signed URL expires.
export const PHOTO_URL_REFRESH_MS = CACHE_MS + 60 * 1000
const urlCache = new Map<string, { url: string, until: number }>()

const localStore = () => import('./employeeStore')

export function validatePhotoFile(file: File | null | undefined) {
  if (!file) return 'PHOTO_MISSING'
  if (!PHOTO_TYPES.includes(String(file.type || '').toLowerCase())) return 'PHOTO_TYPE'
  if (Number(file.size || 0) > PHOTO_MAX_BYTES) return 'PHOTO_TOO_LARGE'
  return null
}

export function employeePhotoPath(organizationId: string | null | undefined, employeeDbId: string, ext = 'jpg', now = Date.now()) {
  if (!organizationId || !employeeDbId) throw new Error('MISSING_PHOTO_CONTEXT')
  return `${organizationId}/${PHOTO_FOLDER}/${employeeDbId}/${now}-photo.${ext}`
}

export function employeeInitials(employee: AnyRecord | null | undefined, language = 'el') {
  const first = language === 'el' ? employee?.firstName : employee?.firstNameEn || employee?.firstName
  const last = language === 'el' ? employee?.lastName : employee?.lastNameEn || employee?.lastName
  return `${String(first || '').trim()[0] || ''}${String(last || '').trim()[0] || ''}`.toUpperCase()
}

export const isInlinePhoto = (path: string) => /^data:image\//.test(String(path || ''))

// Scale so the longer edge is at most `maxEdge`; never enlarge.
export function fitWithin(width: number, height: number, maxEdge = PHOTO_MAX_EDGE) {
  const w = Math.max(1, Number(width) || 1), h = Math.max(1, Number(height) || 1)
  const scale = Math.min(1, maxEdge / Math.max(w, h))
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) }
}

// Where a portrait sits in its frame: staff photos are head-and-shoulders with
// the face in the upper third, so the square keeps the horizontal centre and a
// quarter of the spare height above it (the avatars' object-position 50% 25%).
export const PHOTO_FOCUS_Y = 0.25

// The square of the source image kept on upload: centred across, and for a
// portrait PHOTO_FOCUS_Y of the spare height from the top.
export function squareCrop(width: number, height: number, focusY = PHOTO_FOCUS_Y) {
  const w = Math.max(1, Math.round(Number(width) || 1)), h = Math.max(1, Math.round(Number(height) || 1))
  const side = Math.min(w, h)
  return { x: Math.round((w - side) / 2), y: Math.round((h - side) * focusY), size: side }
}

// Cut to a square around the face and resized in the browser through a canvas;
// where that is not available (an old browser, a test), the original file is
// kept as it is.
export async function preparePhoto(file: File, { maxEdge = PHOTO_MAX_EDGE } = {}): Promise<{ blob: Blob, type: string, ext: string }> {
  const fallback = { blob: file, type: file.type, ext: extensionOf(file.type) }
  if (typeof document === 'undefined' || typeof createImageBitmap !== 'function') return fallback
  try {
    const bitmap = await createImageBitmap(file)
    const crop = squareCrop(bitmap.width, bitmap.height)
    const size = fitWithin(crop.size, crop.size, maxEdge)
    const canvas = document.createElement('canvas')
    canvas.width = size.width
    canvas.height = size.height
    const context = canvas.getContext('2d')
    if (!context) return fallback
    context.drawImage(bitmap, crop.x, crop.y, crop.size, crop.size, 0, 0, size.width, size.height)
    const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, type, 0.86))
    if (!blob) return fallback
    // An already square, small photo is kept as it came when re-encoding does not shrink it.
    const cropped = crop.size < bitmap.width || crop.size < bitmap.height
    bitmap.close?.()
    if (!cropped && blob.size >= file.size) return fallback
    return { blob, type, ext: extensionOf(type) }
  } catch {
    return fallback
  }
}

function extensionOf(type: string) {
  return type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg'
}

function cloudEnabled() {
  return hasSupabaseConfig && Boolean(supabase) && !isDemoDataEnvironment()
}

const readAsDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result || ''))
  reader.onerror = () => reject(reader.error || new Error('PHOTO_READ_FAILED'))
  reader.readAsDataURL(blob)
})

async function saveDemoPhoto(employee: AnyRecord, photoPath: string | null) {
  const { loadEmployees, saveEmployees } = await localStore()
  const rows = loadEmployees()
  saveEmployees(rows.map(row => (row.id === employee.id ? { ...row, photoPath } : row)))
  return { ...employee, photoPath }
}

// Signed URLs for many paths in one request (a registry page), cached briefly.
export async function employeePhotoUrls(paths: (string | null | undefined)[] | null | undefined) {
  const out: Record<string, string> = {}
  const wanted = [...new Set((paths || []).filter(Boolean))] as string[]
  const missing: string[] = []
  const now = Date.now()
  for (const path of wanted) {
    if (isInlinePhoto(path)) { out[path] = path; continue }
    const cached = urlCache.get(path)
    if (cached && cached.until > now) out[path] = cached.url
    else missing.push(path)
  }
  if (missing.length && cloudEnabled()) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(missing, SIGNED_URL_SECONDS)
    if (error) throw error
    for (const item of data || []) {
      if (!item?.signedUrl || item.error) continue
      urlCache.set(item.path as string, { url: item.signedUrl, until: now + CACHE_MS })
      out[item.path as string] = item.signedUrl
    }
  }
  return out
}

export function forgetEmployeePhotoUrl(path: string) {
  urlCache.delete(path)
}

async function setPhotoPath(organizationId: string | null | undefined, employee: AnyRecord, photoPath: string | null) {
  const { data, error } = await supabase
    .from('employees')
    .update({ photo_path: photoPath })
    .eq('organization_id', organizationId as string)
    .eq('id', employee.dbId)
    .select('photo_path,updated_at')
    .single()
  if (error) throw error
  invalidateEmployeesCache(organizationId)
  return { ...employee, photoPath: data?.photo_path || null, updatedAt: data?.updated_at || employee.updatedAt }
}

export async function uploadEmployeePhoto(organizationId: string | null | undefined, employee: AnyRecord, file: File) {
  const invalid = validatePhotoFile(file)
  if (invalid) throw new Error(invalid)
  const prepared = await preparePhoto(file)
  if (isDemoDataEnvironment()) return saveDemoPhoto(employee, await readAsDataUrl(prepared.blob))
  if (!cloudEnabled()) throw new Error('PRODUCTION_CLOUD_REQUIRED:employees.photo')
  if (!employee?.dbId) throw new Error('PRODUCTION_EMPLOYEE_DB_ID_REQUIRED:employees.photo')
  const path = employeePhotoPath(organizationId, employee.dbId, prepared.ext)
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, prepared.blob, { contentType: prepared.type })
  if (uploadError) throw uploadError
  let updated
  try {
    updated = await setPhotoPath(organizationId, employee, path)
  } catch (error) {
    await supabase.storage.from(BUCKET).remove([path]).catch(() => {})
    throw error
  }
  if (employee.photoPath && employee.photoPath !== path) {
    forgetEmployeePhotoUrl(employee.photoPath)
    await supabase.storage.from(BUCKET).remove([employee.photoPath]).catch(() => {})
  }
  return updated
}

export async function removeEmployeePhoto(organizationId: string | null | undefined, employee: AnyRecord) {
  if (isDemoDataEnvironment()) return saveDemoPhoto(employee, null)
  if (!cloudEnabled()) throw new Error('PRODUCTION_CLOUD_REQUIRED:employees.photo')
  if (!employee?.dbId) throw new Error('PRODUCTION_EMPLOYEE_DB_ID_REQUIRED:employees.photo')
  const updated = await setPhotoPath(organizationId, employee, null)
  if (employee.photoPath) {
    forgetEmployeePhotoUrl(employee.photoPath)
    await supabase.storage.from(BUCKET).remove([employee.photoPath]).catch(() => {})
  }
  return updated
}
