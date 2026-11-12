import { ROLES } from '../../core/permissions/roles'

interface SurveillanceTabAccessOptions {
  role: string
  actualRole: string
  canSeeSensitiveEmployeeHealth: boolean
}
// Which surveillance lists a role opens besides the patient episodes: the staff
// screenings (infection control, occupational health, those who may see
// employee health) and the environmental sampling (all but the ward roles and
// the reviewing doctor). The page and the «Surveillance» section read the same rule.
export function surveillanceTabAccess({ role, actualRole, canSeeSensitiveEmployeeHealth }: SurveillanceTabAccessOptions) {
  const employees =
    actualRole === ROLES.PLATFORM_OWNER ||
    [ROLES.HOSPITAL_ADMIN, ROLES.INFECTION_CONTROL_LEAD, ROLES.INFECTION_CONTROL_MEMBER, ROLES.OCCUPATIONAL_PHYSICIAN].includes(role) ||
    Boolean(canSeeSensitiveEmployeeHealth)
  const environment = ![ROLES.DEPARTMENT_MANAGER, ROLES.DEPARTMENT_USER, ROLES.DOCTOR_REVIEWER].includes(role)
  // The culture programme: the infection control lead and the hospital administrator (and the platform owner).
  const cultures = actualRole === ROLES.PLATFORM_OWNER || [ROLES.HOSPITAL_ADMIN, ROLES.INFECTION_CONTROL_LEAD].includes(role)
  return { employees, environment, cultures }
}
