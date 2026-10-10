// Which employee record belongs to the signed-in user ("My profile"), and
// whether an open employee record is the user's own (then it is read-only).

const normalizeEmail = value => String(value || '').trim().toLowerCase()

// The record the Platform Owner sees as "My profile": a platform account is not
// a hospital employee, so it gets a synthetic, read-only identity.
export function platformOwnerEmployee(profile, user) {
  const fullName = profile?.fullName || profile?.full_name || user?.user_metadata?.full_name || user?.email || 'Platform Owner'
  const parts = String(fullName).trim().split(/\s+/).filter(Boolean)
  const firstName = parts[0] || 'Platform'
  const lastName = parts.slice(1).join(' ') || 'Owner'
  return {
    id: 'PLATFORM-OWNER',
    dbId: null,
    userId: profile?.id || user?.id || null,
    firstName,
    lastName,
    firstNameEn: firstName,
    lastNameEn: lastName,
    email: profile?.contactEmail || profile?.email || user?.email || '',
    profession: 'Platform Owner',
    professionEn: 'Platform Owner',
    department: 'Πλατφόρμα',
    departmentEn: 'Platform',
    employmentStatus: 'active',
    hireDate: '',
    employeeCode: 'PLATFORM-OWNER',
  }
}

// Looks the user up, strongest link first: the employee id on the membership or
// profile, then the user account linked to the employee, then the sign-in
// e-mail. The Platform Owner gets a synthetic identity; the browser-only demo
// falls back to its first sample employee.
export function resolveSelfEmployee({ employeeRows = [], membership, profile, user, isDemo = false }) {
  const explicitId = membership?.employeeId || membership?.employee_id || membership?.profile?.employeeId || profile?.employeeId || profile?.employee_id
  if (explicitId) {
    const exact = employeeRows.find(row => row.id === explicitId)
    if (exact) return exact
  }

  const linkedUserId = profile?.id || user?.id
  if (linkedUserId) {
    const byUser = employeeRows.find(row => row.userId === linkedUserId)
    if (byUser) return byUser
  }

  const identityEmail = normalizeEmail(profile?.email || user?.email)
  if (identityEmail) {
    const byEmail = employeeRows.find(row => normalizeEmail(row.email) === identityEmail)
    if (byEmail) return byEmail
  }

  if (profile?.isPlatformOwner || profile?.is_platform_owner) return platformOwnerEmployee(profile, user)
  if (isDemo) return employeeRows.find(row => row.id === 'EMP-001') || employeeRows[0] || null
  return null
}

// An employee record is the user's own when it is linked to the user's account
// or carries the user's e-mail (contact e-mail first, then the sign-in e-mail).
export function isOwnEmployeeRecord(employee, { profile, user }) {
  if (!employee) return false
  const currentUserId = profile?.id || user?.id || null
  if (currentUserId && employee.userId === currentUserId) return true
  const currentEmail = normalizeEmail(profile?.contactEmail || profile?.email || user?.email)
  return Boolean(currentEmail && normalizeEmail(employee.email) === currentEmail)
}
