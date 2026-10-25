import { ROLES } from '../../core/permissions/roles'

// Which surveillance lists a role opens besides the patient episodes: the staff
// screenings (infection control, occupational health, those who may see
// employee health) and the environmental sampling (all but the ward roles and
// the reviewing doctor). The page and the «Surveillance» section read the same rule.
export function surveillanceTabAccess({ role, actualRole, canSeeSensitiveEmployeeHealth }) {
  const employees =
    actualRole === ROLES.PLATFORM_OWNER ||
    [ROLES.HOSPITAL_ADMIN, ROLES.INFECTION_CONTROL_LEAD, ROLES.INFECTION_CONTROL_MEMBER, ROLES.OCCUPATIONAL_PHYSICIAN].includes(role) ||
    Boolean(canSeeSensitiveEmployeeHealth)
  const environment = ![ROLES.DEPARTMENT_MANAGER, ROLES.DEPARTMENT_USER, ROLES.DOCTOR_REVIEWER].includes(role)
  return { employees, environment }
}
