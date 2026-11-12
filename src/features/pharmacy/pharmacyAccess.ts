import { ROLES } from '../../core/permissions/roles'

// Who reads and who changes antimicrobial therapies in the cloud: a copy of the
// RLS policies on public.antimicrobial_therapies (antimicrobial_therapies_read,
// antimicrobial_therapies_demo_admin_read, antimicrobial_therapies_update).
// The Hospital Administrator reads them only in a Demo organization.
export const THERAPY_READ_ROLES = Object.freeze([ROLES.INFECTION_CONTROL_LEAD, ROLES.INFECTION_CONTROL_MEMBER, ROLES.PHARMACY, ROLES.DOCTOR_REVIEWER, ROLES.LABORATORY])
export const THERAPY_UPDATE_ROLES = Object.freeze([ROLES.INFECTION_CONTROL_LEAD, ROLES.DOCTOR_REVIEWER, ROLES.PHARMACY])

// `sample`: the browser-only sample hospital (no cloud rows, no RLS).
export function therapyAccess({ role, isPlatformOwner = false, demoOrganization = false, sample = false } = {}) {
  if (sample) return { read: true, update: true }
  const owner = isPlatformOwner || role === ROLES.PLATFORM_OWNER
  return {
    read: owner || THERAPY_READ_ROLES.includes(role) || (demoOrganization && role === ROLES.HOSPITAL_ADMIN),
    update: owner || THERAPY_UPDATE_ROLES.includes(role),
  }
}
