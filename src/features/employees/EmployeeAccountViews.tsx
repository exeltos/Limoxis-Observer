import { useState } from 'react'
import { ObserverDialog, DialogActions } from '../../design-system/ObserverDialog'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import { roleLabel } from '../../core/permissions/roleLabels'
import { creatableManagementRoles } from '../management/managementRoles'
import { needsDepartment } from '../platform/bulkAccountsModel'
import type { Employee, EmployeeDepartment, SignedInProfile, SignedInUser } from './employeeTypes'

// The account side of the employee record (EmployeeRecordPage): «My profile» without a linked
// employee, and the dialog that gives an employee a user account.
export function UnlinkedProfileTab({ tab, platformOwner, language }: { tab: string, platformOwner: boolean, language: string }) {
  const en = language === 'en'
  const labels: Record<string, string> = {
    occupational: en ? 'Occupational Health' : 'Ιατρός Εργασίας',
    vaccinations: en ? 'Vaccinations' : 'Εμβολιασμοί',
    surveillance: en ? 'Surveillance' : 'Επιτήρηση',
    training: en ? 'Training' : 'Εκπαίδευση',
    evaluations: en ? 'Evaluations' : 'Αξιολογήσεις',
    certificates: en ? 'Certificates & documents' : 'Πιστοποιήσεις / Έγγραφα',
    details: en ? 'Employee record' : 'Καρτέλα εργαζομένου',
  }
  const title = labels[tab] || labels.details
  const message = platformOwner
    ? en
      ? 'This Platform Owner account is not a hospital employee identity. This tab remains visible for a consistent profile structure, but employee data does not apply to this account.'
      : 'Ο λογαριασμός Ιδιοκτήτη πλατφόρμας δεν αποτελεί ταυτότητα εργαζομένου νοσοκομείου. Η καρτέλα παραμένει ορατή για σταθερή δομή του προφίλ, αλλά τα δεδομένα εργαζομένου δεν εφαρμόζονται σε αυτόν τον λογαριασμό.'
    : en
      ? 'No employee record is linked to this account yet. Link the user from Organization → Users to load the real personal data in this tab.'
      : 'Δεν έχει συνδεθεί ακόμη καρτέλα εργαζομένου με αυτόν τον λογαριασμό. Συνδέστε τον χρήστη από Οργανισμός → Χρήστες για να φορτωθούν εδώ τα πραγματικά προσωπικά δεδομένα.'
  return (
    <section className="my-profile-tab-state">
      <div className="my-profile-unlinked-icon">—</div>
      <div>
        <strong>{title}</strong>
        <span>{message}</span>
      </div>
    </section>
  )
}

export function SelfAccountSummary({ profile, user, role, membership, tenant, language }: { profile: SignedInProfile | null | undefined, user: SignedInUser | null | undefined, role: string | null | undefined, membership: { status?: string | null } | null | undefined, tenant: { name?: string | null, organization_name?: string | null } | null | undefined, language: string }) {
  const en = language === 'en'
  const fullName =
    profile?.fullName || profile?.full_name || user?.user_metadata?.full_name || user?.email || '—'
  const email = profile?.contactEmail || profile?.email || user?.email || '—'
  const username = profile?.username || user?.user_metadata?.username || '—'
  const isPlatformOwner = Boolean(profile?.isPlatformOwner || profile?.is_platform_owner)
  const organization = isPlatformOwner
    ? en
      ? 'Platform account'
      : 'Λογαριασμός πλατφόρμας'
    : tenant?.name || tenant?.organization_name || '—'
  const membershipStatus = membership?.status || 'active'
  const active = membershipStatus !== 'disabled' && membershipStatus !== 'suspended'
  const initials =
    String(fullName || '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0])
      .join('')
      .toUpperCase() || 'L'
  return (
    <section
      className="surface my-profile-hero"
      aria-label={en ? 'Account details' : 'Στοιχεία λογαριασμού'}
    >
      <div className="my-profile-avatar">{initials}</div>
      <div className="my-profile-identity">
        <span>
          {isPlatformOwner
            ? en
              ? 'PLATFORM ACCOUNT'
              : 'ΛΟΓΑΡΙΑΣΜΟΣ ΠΛΑΤΦΟΡΜΑΣ'
            : en
              ? 'ACCOUNT'
              : 'ΛΟΓΑΡΙΑΣΜΟΣ'}
        </span>
        <h2>{fullName}</h2>
        <p>{email}</p>
      </div>
      <span className={`status-badge ${active ? 'active' : 'danger'}`}>
        {active ? (en ? 'Active' : 'Ενεργός') : en ? 'Suspended' : 'Σε παύση'}
      </span>
      <div className="my-profile-grid my-profile-account-grid">
        <div className="my-profile-value">
          <span className="my-profile-value-label">Username</span>
          <strong>{username}</strong>
        </div>
        <div className="my-profile-value">
          <span className="my-profile-value-label">{en ? 'Role' : 'Ρόλος'}</span>
          <strong>{roleLabel(role, language)}</strong>
        </div>
        <div className="my-profile-value">
          <span className="my-profile-value-label">{en ? 'Organization' : 'Οργανισμός'}</span>
          <strong>{organization}</strong>
        </div>
        <div className="my-profile-value">
          <span className="my-profile-value-label">Email</span>
          <strong>{email}</strong>
        </div>
      </div>
    </section>
  )
}

// The role is always chosen (no default); a department role also needs the department
// it sees, which starts from the employee's own.
export function EmployeeAccountDialog({ employee, departments = [], language, saving, onClose, onCreate }: { employee: Employee, departments?: EmployeeDepartment[], language: string, saving: boolean, onClose: () => void, onCreate: (account: { role: string, departmentId: string | null, email: string, phone: string, jobTitle: string }) => unknown }) {
  const en = language === 'en'
  const [email, setEmail] = useState(employee.email || ''),
    [phone, setPhone] = useState(employee.phone || ''),
    [jobTitle, setJobTitle] = useState(employee.profession || ''),
    [role, setRole] = useState(''),
    [departmentId, setDepartmentId] = useState(employee.departmentId || '')
  const scoped = needsDepartment(role)
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && Boolean(role) && (!scoped || Boolean(departmentId))
  return (
    <ObserverDialog
      width="wide"
      eyebrow={en ? 'Employee account' : 'Λογαριασμός εργαζομένου'}
      title={en ? 'Create and link account' : 'Δημιουργία και σύνδεση λογαριασμού'}
      subtitle={
        en
          ? `${employee.firstName} ${employee.lastName} will be linked directly to this account.`
          : `Ο λογαριασμός θα συνδεθεί απευθείας με τον εργαζόμενο ${employee.firstName} ${employee.lastName}.`
      }
      onClose={onClose}
      footer={
        <DialogActions
          onCancel={onClose}
          onSave={() =>
            onCreate({
              email: email.trim(),
              phone: phone.trim(),
              jobTitle: jobTitle.trim(),
              role,
              departmentId: scoped ? departmentId : null,
            })
          }
          disabled={!valid || saving}
        />
      }
    >
      <div className="entry-grid">
        <label>
          <span>Email *</span>
          <input type="email" value={email} onChange={event => setEmail(event.target.value)} />
        </label>
        <label>
          <span>{en ? 'Phone' : 'Τηλέφωνο'}</span>
          <input value={phone} onChange={event => setPhone(event.target.value)} />
        </label>
        <label>
          <span>{en ? 'Job title' : 'Ιδιότητα'}</span>
          <input value={jobTitle} onChange={event => setJobTitle(event.target.value)} />
        </label>
        <SearchableSelect
          label={en ? 'Account role *' : 'Ρόλος λογαριασμού *'}
          value={role}
          onChange={next => setRole(next || '')}
          placeholder={en ? 'Choose a role…' : 'Επιλέξτε ρόλο…'}
          options={creatableManagementRoles.map(value => ({ value, label: roleLabel(value, language) }))}
        />
        {scoped && (
          <SearchableSelect
            label={en ? 'Department *' : 'Τμήμα *'}
            value={departmentId}
            onChange={next => setDepartmentId(next || '')}
            placeholder={en ? 'Choose a department…' : 'Επιλέξτε τμήμα…'}
            options={departments.map(department => ({
              value: department.id,
              label: en ? department.nameEn || department.name : department.name,
            }))}
          />
        )}
      </div>
    </ObserverDialog>
  )
}

