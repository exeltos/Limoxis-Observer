import { supabase } from '../../core/supabase/client'
import { hasSupabaseConfig } from '../../core/config/env'

// Η εταιρεία στη δημόσια «Σελίδα παρουσίασης» (διαδρομή «/» πριν τη σύνδεση). Την αλλάζει ο Ιδιοκτήτης Πλατφόρμας
// στην κονσόλα (Οργανισμοί › Ρυθμίσεις › Σελίδα παρουσίασης)· αυτές είναι οι τιμές όταν η βάση δεν απαντά ή είναι κενή.
export interface PublicContact { name: string, email: string, phone: string, website: string }

export const DEFAULT_PUBLIC_CONTACT: PublicContact = {
  name: 'Exeltos',
  email: 'info@exeltos.com',
  phone: '694 247 1022',
  website: 'https://exeltos.com/',
}

type PublicContactRow = { name?: string | null, email?: string | null, phone?: string | null, website?: string | null }

// Ό,τι λείπει ή είναι κενό κρατά την αρχική τιμή. Η public_contact() επιστρέφει μόνο αυτά τα 4 πεδία.
export function mergePublicContact(row: PublicContactRow | null | undefined): PublicContact {
  const pick = (key: keyof PublicContact) => String(row?.[key] ?? '').trim() || DEFAULT_PUBLIC_CONTACT[key]
  return { name: pick('name'), email: pick('email'), phone: pick('phone'), website: pick('website') }
}

export async function loadPublicContact(): Promise<PublicContact> {
  if (!hasSupabaseConfig || !supabase) return DEFAULT_PUBLIC_CONTACT
  try {
    const { data, error } = await supabase.rpc('public_contact')
    if (error) return DEFAULT_PUBLIC_CONTACT
    return mergePublicContact(Array.isArray(data) ? data[0] : data)
  } catch { return DEFAULT_PUBLIC_CONTACT }
}
