import { EmployeePositionTab } from './JobDescriptionViews'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Activity,
  BriefcaseBusiness,
  FileCheck2,
  GraduationCap,
  HeartPulse,
  KeyRound,
  Pencil,
  ShieldCheck,
  Trash2,
  UserRound,
} from 'lucide-react'
import { Page } from '../../design-system/Page'
import { EntityRecordShell, type RecordNavigation } from '../../design-system/EntityRecordShell'
import { ExportMenu } from '../../design-system/ExportMenu'
import { printReport } from '../../core/export/reportDocument'
import { Button } from '../../design-system/Button'
import { RouteLoading } from '../../design-system/RouteLoading'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { can, CAPABILITIES } from '../../core/permissions/roles'
import { useContextualNavigation } from '../../core/navigation/useContextualNavigation'
import { useRecordSequenceNavigation } from '../../core/navigation/useRecordSequenceNavigation'
import { useAuth } from '../../core/auth/AuthContext'
import {
  createEmployeeAccountAsync,
  deleteEmployeeAsync,
} from './employeeService'
import { useEmployeeRecordData } from './useEmployeeRecordData'
import { loadDepartments } from '../management/departmentsService'
import { loadManagementLibraries } from '../management/managementCloudService'
import { demoLibrarySeed as managementSeed } from '../management/managementData'
import { EmployeeSurveillanceFlow } from '../surveillance/EmployeeSurveillanceFlow'
import { EmployeeProtocolsTab } from '../documents/EmployeeProtocolsTab'
import { isOwnEmployeeRecord, resolveSelfEmployee } from './employeeIdentity'
import {
  EmployeeHealthTab,
  EmployeeTrainingTab,
  EmployeeEvaluationsTab,
  EmployeeCertificatesTab,
  EmployeeSurveillanceTab,
  EmployeeHistoryTab,
} from './EmployeeRecordTabs'
import { signalDemoStep } from '../demo/demoScenarioSignals'
import { EmployeeHeaderPhoto } from './EmployeePhoto'
import { Details, withEmployeeValues } from './EmployeeDetails'
import { EmployeeAccountDialog, SelfAccountSummary, UnlinkedProfileTab } from './EmployeeAccountViews'
import type { Employee, EmployeeDepartment, EmployeeOption, MembershipLink, SignedInProfile, SignedInUser } from './employeeTypes'
import type { ExportItem } from '../../design-system/ExportMenu'

// The Demo libraries as this page reads them (departments, categories, positions).
const demoLibrarySeed = managementSeed

export function EmployeeRecordPage({ selfMode = false }) {
  const { employeeId } = useParams()
  const navigate = useNavigate()
  const { goBack, restored } = useContextualNavigation('/employees')
  const { t, language, locale } = useLanguage()
  const { confirm, notify } = useFeedback()
  const { role, membership, canAccessRecord, canSeeSensitiveEmployeeHealth, isDemo, tenant } =
    useTenant()
  const { user, profile } = useAuth()
  const {
    data: employeeRows,
    loading: employeesLoading,
    error: employeesError,
    reload: reloadEmployees,
    setData: setEmployeeRows,
  } = useEmployeeRecordData({
    code: employeeId || null,
    selfMode,
    self: {
      employeeCode:
        (membership as MembershipLink | null)?.employeeId ||
        (membership as MembershipLink | null)?.employee_id ||
        (membership as MembershipLink | null)?.profile?.employeeId ||
        (profile as SignedInProfile | null)?.employeeId ||
        (profile as SignedInProfile | null)?.employee_id ||
        null,
      userId: profile?.id || user?.id || null,
      email: profile?.email || user?.email || null,
    },
  })
  const [accountOpen, setAccountOpen] = useState(false)
  // A tab can add its own items to the one «Εξαγωγή» of the page (e.g. the training history).
  const [tabExports, setTabExports] = useState<ExportItem[]>([])
  const [accountSaving, setAccountSaving] = useState(false)
  const [departments, setDepartments] = useState<EmployeeDepartment[]>([])
  const [professionalCategories, setProfessionalCategories] = useState<EmployeeOption[]>([])
  const [positionOptions, setPositionOptions] = useState<EmployeeOption[]>([])
  const [surveillanceOpen, setSurveillanceOpen] = useState(false)
  const [surveillanceVersion, setSurveillanceVersion] = useState(0)

  useEffect(() => {
    let active = true
    // Demo mode's tenant.id is the literal string 'demo-hospital', not a real
    // UUID — calling the live loadDepartments/loadManagementLibraries cloud
    // services with it fails with a Postgres invalid-UUID 400. Use the same
    // demoLibrarySeed fixture NewSurveillanceFlow/PatientClinicalCanonicalPage
    // already use for demo departments/libraries instead.
    if (isDemo) {
      setDepartments(
        demoLibrarySeed.departments.map(([elName, enName]) => ({
          id: elName,
          name: elName,
          nameEn: enName,
        })),
      )
      setProfessionalCategories(demoLibrarySeed.professionalCategories || [])
      setPositionOptions(demoLibrarySeed.positions || [])
      return () => {
        active = false
      }
    }
    if (!tenant?.id) {
      setDepartments([])
      setProfessionalCategories([])
      return () => {
        active = false
      }
    }
    Promise.all([loadDepartments(tenant.id), loadManagementLibraries(tenant.id)])
      .then(([departmentRows, libraries]) => {
        if (!active) return
        setDepartments((departmentRows || []).filter(row => row.is_active !== false))
        setProfessionalCategories(libraries?.professionalCategories || [])
        setPositionOptions(libraries?.positions || [])
      })
      .catch(() => {
        if (active) {
          setDepartments([])
          setProfessionalCategories([])
        }
      })
    return () => {
      active = false
    }
  }, [isDemo, tenant?.id])

  const selfEmployee = useMemo(
    () =>
      selfMode ? resolveSelfEmployee({ employeeRows, membership, profile, user, isDemo }) : null,
    [selfMode, membership, profile, user, isDemo, employeeRows],
  )

  const id = selfMode ? selfEmployee?.id : employeeId || null
  const employee = selfMode ? selfEmployee : employeeRows.find(row => row.id === id) || null
  const isOwnEmployee = isOwnEmployeeRecord(employee, { profile, user })
  const selfReadOnly = Boolean(selfMode || isOwnEmployee)
  const recordNavigation = useRecordSequenceNavigation({
    registry: 'employees',
    currentId: id,
    pathForId: nextId => `/employees/${nextId}`,
  })
  const addOns = membership?.capabilities ?? [],
    custom = membership?.customCapabilities ?? []
  const canAdmin = can(role, CAPABILITIES.MANAGE_STAFF_ADMIN, addOns, custom) && !selfReadOnly
  const canManageUsers = can(role, CAPABILITIES.MANAGE_USERS, addOns, custom) && !selfReadOnly
  const canOccupational =
    (can(role, CAPABILITIES.VIEW_OCCUPATIONAL_HEALTH, addOns, custom) ||
      can(role, CAPABILITIES.MANAGE_OCCUPATIONAL_HEALTH, addOns, custom)) &&
    canSeeSensitiveEmployeeHealth
  const canManageEmployeeFollowup =
    (isDemo || can(role, CAPABILITIES.MANAGE_OCCUPATIONAL_HEALTH, addOns, custom)) && !selfReadOnly
  const canTraining = can(role, CAPABILITIES.VIEW_TRAINING, addOns, custom)
  const canSeeProtocolsAsManager =
    can(role, CAPABILITIES.MANAGE_DOCUMENTS, addOns, custom) ||
    can(role, CAPABILITIES.PUBLISH_DOCUMENT, addOns, custom)
  const canSeeProtocols =
    can(role, CAPABILITIES.MANAGE_DOCUMENTS, addOns, custom) ||
    can(role, CAPABILITIES.PUBLISH_DOCUMENT, addOns, custom) ||
    isOwnEmployee
  const tabs = useMemo(
    () =>
      [
        {
          id: 'details',
          label: t('employeesRecords.employeeDetailsTab'),
          icon: UserRound,
          show: true,
        },
        {
          id: 'position',
          label: language === 'en' ? 'Position' : 'Θέση',
          icon: BriefcaseBusiness,
          show: true,
        },
        {
          id: 'occupational',
          label: t('occupationalHealth'),
          icon: HeartPulse,
          show: canOccupational || selfMode,
        },
        {
          id: 'surveillance',
          label: t('surveillance'),
          icon: Activity,
          show: canSeeSensitiveEmployeeHealth && (canOccupational || selfMode),
        },
        {
          id: 'training',
          label: t('training'),
          icon: GraduationCap,
          show: canTraining || selfMode,
        },
        {
          id: 'evaluations',
          label: t('evaluations'),
          icon: FileCheck2,
          show: canAdmin || selfMode || role === 'department_manager' || role === 'hr_office',
        },
        {
          id: 'certificates',
          label: language === 'en' ? 'Documents' : 'Έγγραφα',
          icon: BriefcaseBusiness,
          show: true,
        },
        {
          id: 'history',
          label: t('history'),
          icon: ShieldCheck,
          show: canOccupational || canAdmin,
        },
      ].filter(item => item.show),
    [
      t,
      canAdmin,
      canOccupational,
      canTraining,
      canSeeSensitiveEmployeeHealth,
      selfMode,
      language,
      role,
    ],
  )
  // Vaccinations and exposure incidents now live inside the occupational health tab.
  const [healthSection] = useState(() =>
    restored?.tab === 'vaccinations'
      ? 'vaccinations'
      : restored?.tab === 'exposureIncidents'
        ? 'exposures'
        : 'visits',
  )
  const [editingDetails, setEditingDetails] = useState(false)
  const [tab, setTab] = useState(() =>
    ['vaccinations', 'exposureIncidents'].includes(restored?.tab ?? '')
      ? 'occupational'
      : restored?.tab === 'protocols' ? 'certificates' : restored?.tab || 'details',
  )
  const selfProfileTabs = useMemo(
    () => [
      { id: 'details', label: t('employeesRecords.employeeDetailsTab'), icon: UserRound },
      { id: 'position', label: language === 'en' ? 'Position' : 'Θέση', icon: BriefcaseBusiness },
      { id: 'occupational', label: t('occupationalHealth'), icon: HeartPulse },
      { id: 'surveillance', label: t('surveillance'), icon: Activity },
      { id: 'training', label: t('training'), icon: GraduationCap },
      { id: 'evaluations', label: t('evaluations'), icon: FileCheck2 },
      {
        id: 'certificates',
        label: language === 'en' ? 'Documents' : 'Έγγραφα',
        icon: BriefcaseBusiness,
      },
    ],
    [t, language],
  )
  // Demo evaluation guide: opening these tabs are steps of the HR scenarios.
  useEffect(() => {
    if (tab === 'training') signalDemoStep('employee_record', 'training')
    if (tab === 'certificates') signalDemoStep('employee_record', 'documents')
    if (tab === 'evaluations') signalDemoStep('performance_evaluation', 'evaluations')
  }, [tab])

  if (employeesLoading) return <RouteLoading />
  if (employeesError)
    return (
      <Page title={t('employees')}>
        <div className="data-access-state error" role="alert">
          <span>
            {language === 'en'
              ? 'Could not load employees.'
              : 'Δεν ήταν δυνατή η φόρτωση του προσωπικού.'}
          </span>
          <Button variant="secondary" onClick={reloadEmployees}>
            {language === 'en' ? 'Retry' : 'Επανάληψη'}
          </Button>
        </div>
      </Page>
    )
  if (!employee) {
    const platformOwner = Boolean(profile?.isPlatformOwner || (profile as SignedInProfile | null)?.is_platform_owner)
    const fullName =
      profile?.fullName ||
      (profile as SignedInProfile | null)?.full_name ||
      (user as SignedInUser | null)?.user_metadata?.full_name ||
      user?.email ||
      '—'
    const email = profile?.contactEmail || profile?.email || user?.email || '—'
    const initials =
      String(fullName || '')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0])
        .join('')
        .toUpperCase() || 'L'
    return (
      <Page
        fill
        title={selfMode ? t('employeesRecords.myProfile') : t('employees')}
        subtitle={
          selfMode
            ? platformOwner
              ? language === 'en'
                ? 'Platform account identity and access context.'
                : 'Στοιχεία λογαριασμού πλατφόρμας και πλαισίου πρόσβασης.'
              : language === 'en'
                ? 'Account identity and personal employee record.'
                : 'Στοιχεία λογαριασμού και προσωπική καρτέλα εργαζομένου.'
            : undefined
        }
      >
        <EntityRecordShell
          className="employee-record-shell workspace-fill my-profile-unlinked-shell"
          avatar={initials}
          eyebrow={
            platformOwner
              ? language === 'en'
                ? 'PLATFORM ACCOUNT'
                : 'ΛΟΓΑΡΙΑΣΜΟΣ ΠΛΑΤΦΟΡΜΑΣ'
              : language === 'en'
                ? 'MY PROFILE'
                : 'ΤΟ ΠΡΟΦΙΛ ΜΟΥ'
          }
          title={fullName}
          subtitle={email}
          status={
            <span className="status-badge active">{language === 'en' ? 'Active' : 'Ενεργός'}</span>
          }
          tabs={selfProfileTabs}
          activeTab={tab}
          onTabChange={setTab}
          onBack={() => navigate('/')}
          backLabel={t('back')}
        >
          {tab === 'details' && (
            <>
              <SelfAccountSummary
                profile={profile}
                user={user}
                role={role}
                membership={membership}
                tenant={tenant}
                language={language}
              />
              <UnlinkedProfileTab tab="details" platformOwner={platformOwner} language={language} />
            </>
          )}
          {tab !== 'details' && (
            <UnlinkedProfileTab tab={tab} platformOwner={platformOwner} language={language} />
          )}
        </EntityRecordShell>
      </Page>
    )
  }

  if (!(selfMode || canAccessRecord({ ...employee, department: employee.department })))
    return (
      <Page title={t('employees')}>
        <div className="inline-empty">
          {language === 'en'
            ? 'You do not have access to this record.'
            : 'Δεν έχετε πρόσβαση σε αυτή την εγγραφή.'}
        </div>
      </Page>
    )
  const name =
    language === 'el'
      ? `${employee.lastName} ${employee.firstName}`
      : `${employee.firstNameEn || employee.firstName} ${employee.lastNameEn || employee.lastName}`
  const fmt = (value: unknown) =>
    value
      ? new Intl.DateTimeFormat(locale).format(new Date(`${String(value).slice(0, 10)}T12:00:00`))
      : '—'
  async function deleteEmployee() {
    if (selfReadOnly || !canAdmin || !employee) return
    const ok = await confirm({
      title: t('employeesRecords.deleteEmployee'),
      message: t('employeesRecords.confirmEmployeeDelete'),
      confirmLabel: t('delete'),
      danger: true,
    })
    if (!ok) return
    try {
      await deleteEmployeeAsync(tenant?.id, employee.dbId, employee.id)
      notify(t('employeesRecords.employeeDeleted'), 'success')
      navigate('/employees', { replace: true })
    } catch (error) {
      notify(
        (error as Error | null)?.message ||
          (language === 'en'
            ? 'Could not delete the employee.'
            : 'Δεν ήταν δυνατή η διαγραφή του εργαζομένου.'),
        'error',
      )
    }
  }
  async function createAccount(values: Parameters<typeof createEmployeeAccountAsync>[2]) {
    if (selfReadOnly || !employee) return
    setAccountSaving(true)
    try {
      await createEmployeeAccountAsync(tenant?.id, employee, values)
      notify(
        language === 'en'
          ? 'User account created and linked to this employee.'
          : 'Ο λογαριασμός χρήστη δημιουργήθηκε και συνδέθηκε με τον εργαζόμενο.',
        'success',
      )
      setAccountOpen(false)
      await reloadEmployees()
    } catch (error) {
      notify(
        (error as Error | null)?.message ||
          (language === 'en'
            ? 'Could not create the account.'
            : 'Δεν ήταν δυνατή η δημιουργία του λογαριασμού.'),
        'error',
      )
    } finally {
      setAccountSaving(false)
    }
  }
  const departmentOptions = departments.map(row => [row.name, row.nameEn || row.name] as EmployeeOption)
  // The employee's details as a printed sheet (the full employee file comes
  // with the shared document layout's next exports).
  function printEmployee(pdf?: boolean) {
    if (!employee) return
    const en = language === 'en'
    const pick = (el: string | undefined, enValue: string | undefined) => (en ? enValue || el : el) || ''
    const ok = printReport({
      language,
      kind: en ? 'Employee details' : 'Στοιχεία εργαζομένου',
      code: employee.id,
      title: name,
      subtitle: [
        pick(employee.profession, employee.professionEn),
        pick(employee.department, employee.departmentEn),
      ]
        .filter(Boolean)
        .join(' · '),
      meta: [
        [en ? 'Employee / folder code' : 'Κωδικός εργαζομένου / φακέλου', employee.id],
        [en ? 'Status' : 'Κατάσταση', t(employee.employmentStatus)],
        [t('firstName'), pick(employee.firstName, employee.firstNameEn)],
        [t('lastName'), pick(employee.lastName, employee.lastNameEn)],
        [t('fatherName'), pick(employee.fatherName, employee.fatherNameEn)],
        [t('department'), pick(employee.department, employee.departmentEn)],
        [t('professionalCategory'), pick(employee.profession, employee.professionEn)],
        [en ? 'Job position' : 'Θέση εργασίας', pick(employee.position, employee.positionEn)],
        [en ? 'HR department' : 'Τμήμα HR', employee.hrDepartment],
        [en ? 'Directorate' : 'Διεύθυνση', employee.directorate],
        [t('employeesRecords.hireDate'), employee.hireDate ? fmt(employee.hireDate) : ''],
        [t('employeesRecords.email'), employee.email],
        [t('phone'), employee.phone],
        [
          en ? 'User account' : 'Λογαριασμός χρήστη',
          employee.accountLinked ? (en ? 'Linked' : 'Συνδεδεμένος') : en ? 'None' : 'Κανένας',
        ],
      ],
      filename: `${employee.id}_${en ? 'employee' : 'ergazomenos'}`,
    }, { pdf: pdf === true })
    if (!ok)
      notify(
        en ? 'Allow pop-ups to print.' : 'Επιτρέψτε τα αναδυόμενα παράθυρα για την εκτύπωση.',
        'error',
      )
  }
  // The record's «⋯» (account, edit, delete) belongs to the employee's details, so it shows on «Στοιχεία» only;
  // on the other tabs it would sit over the tab's own button (e.g. «Νέος έλεγχος»).
  const onDetails = tab === 'details'
  const headerActions = (
    <>
      {canAdmin && onDetails && !editingDetails && (
        <Button
          variant="secondary"
          tone="edit"
          onClick={() => {
            setTab('details')
            setEditingDetails(true)
          }}
        >
          <Pencil size={15} />
          {t('employeesRecords.editEmployee')}
        </Button>
      )}
      {canManageUsers && onDetails && !employee.accountLinked && (
        <Button recordMenu variant="secondary" onClick={() => setAccountOpen(true)}>
          <KeyRound size={15} />
          {language === 'en' ? 'Create user account' : 'Δημιουργία λογαριασμού χρήστη'}
        </Button>
      )}
      <ExportMenu items={[
        { id: 'employee-print', kind: 'print', label: language === 'en' ? 'Print: details' : 'Εκτύπωση: στοιχεία', onClick: () => printEmployee(false) },
        ...tabExports,
      ]} />
      {canAdmin && onDetails && !editingDetails && (
        <Button variant="secondary" tone="danger" onClick={deleteEmployee}>
          <Trash2 size={15} />
          {t('employeesRecords.deleteEmployee')}
        </Button>
      )}
    </>
  )

  return (
    <Page fill title={name} subtitle={t('employeesRecords.employeeFullRecordSubtitle')}>
      <EntityRecordShell
        className={`employee-record-shell workspace-fill${selfReadOnly ? ' employee-self-readonly' : ''}`}
        avatar={
          <EmployeeHeaderPhoto
            employee={employee}
            organizationId={tenant?.id}
            canEdit={canAdmin}
            onChange={(next: Employee) =>
              setEmployeeRows(rows => rows.map(row => (row.id === next.id ? { ...row, ...next } : row)))
            }
          />
        }
        eyebrow={employee.id}
        title={name}
        subtitle={[language === 'el' ? employee.profession : employee.professionEn || employee.profession, language === 'el' ? employee.department : employee.departmentEn || employee.department].filter(Boolean).join(' · ')}
        status={
          <span
            className={`status-badge ${employee.employmentStatus === 'active' ? 'active' : ''}`}
          >
            {t(employee.employmentStatus)}
          </span>
        }
        recordNavigation={selfMode ? null : recordNavigation as RecordNavigation}
        headerActions={headerActions}
        tabs={tabs}
        activeTab={tab}
        onTabChange={setTab}
        onBack={selfMode ? () => navigate('/') : goBack}
        backLabel={t('back')}
      >
        {selfReadOnly && (
          <div className="source-truth-note">
            <ShieldCheck size={16} />
            <div>
              <strong>
                {language === 'en'
                  ? 'Your employee record is read-only'
                  : 'Η προσωπική σας καρτέλα είναι μόνο για προβολή'}
              </strong>
              <span>
                {language === 'en'
                  ? 'You cannot edit, delete or perform administrative actions on your own employee record.'
                  : 'Δεν μπορείτε να επεξεργαστείτε, να διαγράψετε ή να εκτελέσετε διοικητικές ενέργειες στη δική σας καρτέλα.'}
              </span>
            </div>
          </div>
        )}
        {tab === 'details' && (
          <Details
            // A new employee mounts a new form: never one frame of the previous employee's fields.
            key={employee.dbId || employee.id}
            employee={employee}
            t={t}
            language={language}
            fmt={fmt}
            editing={editingDetails}
            setEditing={setEditingDetails}
            notify={notify}
            organizationId={tenant?.id}
            departmentOptions={departmentOptions}
            professionOptions={withEmployeeValues(professionalCategories, employeeRows, 'profession', 'professionEn')}
            positionOptions={withEmployeeValues(positionOptions, employeeRows, 'position', 'positionEn')}
            reloadEmployees={reloadEmployees}
            onCodeChanged={newCode =>
              navigate(`/employees/${encodeURIComponent(newCode)}`, { replace: true })
            }
          />
        )}
        {tab === 'position' && (
          <EmployeePositionTab
            employee={employee}
            onExportItems={setTabExports}
            positions={positionOptions}
            language={language}
            organizationId={tenant?.id}
            canAcknowledge={isOwnEmployee || selfMode || isDemo}
            actorName={name}
          />
        )}
        {tab === 'occupational' && (
          <EmployeeHealthTab
            employee={employee}
            onExportItems={setTabExports}
            t={t}
            language={language}
            fmt={fmt}
            organizationId={tenant?.id}
            initialSection={healthSection}
          />
        )}
        {tab === 'surveillance' && (
          <EmployeeSurveillanceTab
            employee={employee}
            onExportItems={setTabExports}
            t={t}
            language={language}
            fmt={fmt}
            version={surveillanceVersion}
            readOnly={selfReadOnly}
            isDemo={isDemo}
            organizationId={tenant?.id}
            canManageFollowup={canManageEmployeeFollowup}
            onNew={() => setSurveillanceOpen(true)}
          />
        )}
        {tab === 'training' && (
          <EmployeeTrainingTab
            employee={employee}
            t={t}
            language={language}
            fmt={fmt}
            organizationId={tenant?.id}
            canOpenProgram={canTraining}
            onExportItems={setTabExports}
          />
        )}
        {tab === 'evaluations' && (
          <EmployeeEvaluationsTab
            employee={employee}
            onExportItems={setTabExports}
            t={t}
            language={language}
            fmt={fmt}
            organizationId={tenant?.id}
            canCreate={!selfReadOnly && (role === 'department_manager' || canAdmin)}
            canHrApprove={!selfReadOnly && (role === 'hr_office' || canAdmin)}
            canAdminApprove={!selfReadOnly && canAdmin}
            selfReadOnly={selfReadOnly}
          />
        )}
        {/* Files and protocols one under the other, scrolling together (the file list used to run over the protocols). */}
        {tab === 'certificates' && (
          <div className="employee-documents-tab">
          <EmployeeCertificatesTab
            employee={employee}
            onExportItems={setTabExports}
            language={language}
            fmt={fmt}
            organizationId={tenant?.id}
            canEdit={canAdmin}
            isDemo={isDemo}
          />
          {(canSeeProtocols || selfMode) && (
          <EmployeeProtocolsTab
            employee={employee}
            language={language}
            organizationId={tenant?.id}
            isDemo={isDemo}
            selfMode={selfReadOnly && !canSeeProtocolsAsManager}
          />
        )}
          </div>
        )}
        {tab === 'history' && <EmployeeHistoryTab employee={employee} language={language} onExportItems={setTabExports} />}
      </EntityRecordShell>
      {surveillanceOpen && !selfReadOnly && (
        <EmployeeSurveillanceFlow
          employee={employee}
          onClose={() => setSurveillanceOpen(false)}
          onCreated={() => setSurveillanceVersion(version => version + 1)}
        />
      )}
      {accountOpen && !selfReadOnly && (
        <EmployeeAccountDialog
          employee={employee}
          departments={departments}
          language={language}
          saving={accountSaving}
          onClose={() => setAccountOpen(false)}
          onCreate={createAccount}
        />
      )}
    </Page>
  )
}
