import { supabase } from '../../core/supabase/client'
import { hasSupabaseConfig } from '../../core/config/env'

// «Ζητήστε παρουσίαση» της δημόσιας Σελίδας παρουσίασης. Η submit_demo_request() ελέγχει ξανά όλα τα πεδία, κόβει
// το κρυφό πεδίο-παγίδα (website) και έχει όριο αιτημάτων· ειδοποιεί με email τον Ιδιοκτήτη Πλατφόρμας.
export interface DemoRequestInput {
  fullName: string
  organization: string
  role: string
  email: string
  phone: string
  message: string
  privacyAccepted: boolean
  // Το κρυφό πεδίο-παγίδα: ο άνθρωπος δεν το βλέπει και το αφήνει κενό.
  website: string
  language: 'el' | 'en'
}

export type DemoRequestFailure = 'rate' | 'invalid' | 'unavailable' | 'failed'
export class DemoRequestError extends Error {
  reason: DemoRequestFailure
  constructor(reason: DemoRequestFailure) { super(`DEMO_REQUEST_${reason.toUpperCase()}`); this.reason = reason }
}

export const DEMO_REQUEST_LIMITS = { fullName: 120, organization: 200, role: 120, email: 254, phone: 40, message: 2000 } as const
export const isValidDemoEmail = (value: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim())

export async function submitDemoRequest(input: DemoRequestInput): Promise<void> {
  if (!hasSupabaseConfig || !supabase) throw new DemoRequestError('unavailable')
  let result
  try {
    result = await supabase.rpc('submit_demo_request', {
      p_full_name: input.fullName.trim(),
      p_organization: input.organization.trim(),
      p_role: input.role.trim(),
      p_email: input.email.trim(),
      p_phone: input.phone.trim() || undefined,
      p_message: input.message.trim() || undefined,
      p_language: input.language,
      p_privacy_accepted: input.privacyAccepted,
      p_website: input.website || undefined,
    })
  } catch { throw new DemoRequestError('failed') }
  const { error } = result
  if (!error) return
  const text = `${error.message || ''} ${(error as { code?: string }).code || ''}`
  if (/RATE_LIMIT|54000/.test(text)) throw new DemoRequestError('rate')
  if (/INVALID|PRIVACY_REQUIRED|22023/.test(text)) throw new DemoRequestError('invalid')
  throw new DemoRequestError('failed')
}
