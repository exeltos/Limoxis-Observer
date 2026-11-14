import { supabase as configuredClient, type Cloud } from '../../core/supabase/client'
import { hasSupabaseConfig } from '../../core/config/env'
import { isOwnerPreview } from '../../core/preview/ownerPreview'
import type { Tables } from '../../core/supabase/database.types'

// Τα αιτήματα «Ζητήστε παρουσίαση» της δημόσιας Σελίδας παρουσίασης. Τα διαβάζει και τα αλλάζει μόνο ο Ιδιοκτήτης
// Πλατφόρμας (RLS: current_user_is_platform_owner()).
const supabase = configuredClient as Cloud

export type DemoRequestStatus = 'new' | 'contacted' | 'closed'
export const DEMO_REQUEST_STATUSES: DemoRequestStatus[] = ['new', 'contacted', 'closed']
export interface DemoRequest {
  id: string
  createdAt: string
  fullName: string
  organizationName: string
  roleTitle: string
  email: string
  phone: string
  message: string
  language: 'el' | 'en'
  status: DemoRequestStatus
  handledAt: string | null
}
type DemoRequestRow = Pick<Tables<'demo_requests'>, 'id' | 'created_at' | 'full_name' | 'organization_name' | 'role_title' | 'email' | 'phone' | 'message' | 'language' | 'status' | 'handled_at'>
const COLUMNS = 'id,created_at,full_name,organization_name,role_title,email,phone,message,language,status,handled_at'

export function mapDemoRequest(row: DemoRequestRow): DemoRequest {
  return {
    id: row.id,
    createdAt: row.created_at,
    fullName: row.full_name,
    organizationName: row.organization_name,
    roleTitle: row.role_title,
    email: row.email,
    phone: row.phone || '',
    message: row.message || '',
    language: row.language === 'en' ? 'en' : 'el',
    status: (DEMO_REQUEST_STATUSES as string[]).includes(row.status) ? row.status as DemoRequestStatus : 'new',
    handledAt: row.handled_at,
  }
}

// Η προεπισκόπηση της κονσόλας (βοήθεια) δείχνει ένα ενδεικτικό αίτημα, χωρίς βάση.
const PREVIEW: DemoRequest[] = [{ id: 'preview-1', createdAt: '2026-11-12T09:30:00Z', fullName: 'Μαρία Παπαδοπούλου', organizationName: 'Γενικό Νοσοκομείο Παράδειγμα', roleTitle: 'Υπεύθυνη Ελέγχου Λοιμώξεων', email: 'maria@example.org', phone: '210 000 0000', message: 'Θα θέλαμε παρουσίαση για την Επιτήρηση και την Ποιότητα.', language: 'el', status: 'new', handledAt: null }]

export async function listDemoRequests(): Promise<DemoRequest[]> {
  if (isOwnerPreview()) return PREVIEW
  if (!hasSupabaseConfig || !configuredClient) return []
  const { data, error } = await supabase.from('demo_requests').select(COLUMNS).order('created_at', { ascending: false }).limit(500)
  if (error) throw error
  return (data || []).map(mapDemoRequest)
}

export async function updateDemoRequestStatus(id: string, status: DemoRequestStatus): Promise<DemoRequest> {
  if (!hasSupabaseConfig || !configuredClient) throw new Error('SUPABASE_NOT_CONFIGURED')
  const { data, error } = await supabase.from('demo_requests').update({ status }).eq('id', id).select(COLUMNS).single()
  if (error) throw error
  return mapDemoRequest(data)
}
