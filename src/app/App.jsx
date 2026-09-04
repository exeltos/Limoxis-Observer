import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './AppShell'
import { ProtectedRoute } from '../core/auth/ProtectedRoute'
import { useAuth } from '../core/auth/AuthContext'
import { useTenant } from '../core/tenant/TenantContext'
import { RequireCapability, RequireAnyCapability } from '../core/permissions/RequireCapability'
import { CAPABILITIES, MANAGEMENT_CAPABILITIES } from '../core/permissions/roles'
import { LoginPage } from '../features/auth/LoginPage'
import { ActivateAccountPage } from '../features/auth/ActivateAccountPage'
import { ForgotAccessPage } from '../features/auth/ForgotAccessPage'
import { ResetPasswordPage } from '../features/auth/ResetPasswordPage'
import { RouteLoading } from '../design-system/RouteLoading'
import { GlobalTextareaExpander } from '../design-system/GlobalTextareaExpander'
import { PlatformMaintenanceBanner } from '../features/platform/PlatformMaintenanceBanner'

const lazyNamed = (loader, name) => lazy(() => loader().then(m => ({ default: m[name] })))

const PlatformCenterPage = lazyNamed(() => import('../features/workspaces/PlatformCenterPage'), 'PlatformCenterPage')
const PlatformHealthPage = lazyNamed(() => import('../features/platform/PlatformControlPlaneRoutes'), 'PlatformHealthPage')
const PlatformAuditSecurityPage = lazyNamed(() => import('../features/platform/PlatformControlPlaneRoutes'), 'PlatformAuditSecurityPage')
const PlatformSettingsPage = lazyNamed(() => import('../features/platform/PlatformControlPlaneRoutes'), 'PlatformSettingsPage')
const DashboardPage = lazyNamed(() => import('../features/dashboard/DashboardPage'), 'DashboardPage')
const SurveillancePage = lazyNamed(() => import('../features/surveillance/SurveillanceRoutePage'), 'SurveillanceRoutePage')
const PatientClinicalRecordRoute = lazyNamed(() => import('../features/surveillance/PatientClinicalRecordRoute'), 'PatientClinicalRecordRoute')
const LaboratoryPage = lazyNamed(() => import('../features/laboratory/LaboratoryPage'), 'LaboratoryPage')
const LaboratorySampleRecordPage = lazyNamed(() => import('../features/laboratory/LaboratorySampleRecordPage'), 'LaboratorySampleRecordPage')
const PreventionPage = lazyNamed(() => import('../features/prevention/PreventionPage'), 'PreventionPage')
const PreventionRecordPage = lazyNamed(() => import('../features/prevention/PreventionRecordPage'), 'PreventionRecordPage')
const ControlsPage = lazyNamed(() => import('../features/controls/ControlsPage'), 'ControlsPage')
const ControlRecordPage = lazyNamed(() => import('../features/controls/ControlRecordPage'), 'ControlRecordPage')
const QualityPage = lazyNamed(() => import('../features/quality/QualityPage'), 'QualityPage')
const QualityRecordPage = lazyNamed(() => import('../features/quality/QualityRecordPage'), 'QualityRecordPage')
const QualityCreatePage = lazyNamed(() => import('../features/quality/QualityCreatePage'), 'QualityCreatePage')
const TrainingPageRoute = lazyNamed(() => import('../features/training/TrainingPageRoute'), 'TrainingPageRoute')
const TrainingAccessPage = lazyNamed(() => import('../features/training/TrainingAccessPage'), 'TrainingAccessPage')
const CommitteesPage = lazyNamed(() => import('../features/committees/CommitteesPage'), 'CommitteesPage')
const CommitteeRecordPageRoute = lazyNamed(() => import('../features/committees/CommitteeRecordPageRoute'), 'CommitteeRecordPageRoute')
const DocumentsPage = lazyNamed(() => import('../features/documents/DocumentsPage'), 'DocumentsPage')
const DocumentRecordPage = lazyNamed(() => import('../features/documents/DocumentRecordPage'), 'DocumentRecordPage')
const PatientsPage = lazyNamed(() => import('../features/patients/PatientsPage'), 'PatientsPage')
const EmployeesPage = lazyNamed(() => import('../features/employees/EmployeesPage'), 'EmployeesPage')
const EmployeeCreatePage = lazyNamed(() => import('../features/employees/EmployeeCreatePage'), 'EmployeeCreatePage')
const EmployeeRecordPage = lazyNamed(() => import('../features/employees/EmployeeRecordPage'), 'EmployeeRecordPage')
const PharmacyPage = lazyNamed(() => import('../features/pharmacy/PharmacyPage'), 'PharmacyPage')
const OccupationalHealthPage = lazyNamed(() => import('../features/occupational-health/OccupationalHealthPage'), 'OccupationalHealthPage')
const LiraPage = lazyNamed(() => import('../features/lira/LiraPage'), 'LiraPage')
const ManagementPage = lazyNamed(() => import('../features/management/ManagementPage'), 'ManagementPage')
const IndicatorsPage = lazyNamed(() => import('../features/indicators/IndicatorsPage'), 'IndicatorsPage')
const MyDepartmentPage = lazyNamed(() => import('../features/workspaces/MyDepartmentPage'), 'MyDepartmentPage')
const AboutPage = lazyNamed(() => import('../features/about/AboutPage'), 'AboutPage')
const AnalysisPage = lazyNamed(() => import('../features/analysis/AnalysisPage'), 'AnalysisPage')
const AccountPage = lazyNamed(() => import('../features/account/AccountPage'), 'AccountPage')
const AccessDeniedPage = lazyNamed(() => import('../features/auth/AccessDeniedPage'), 'AccessDeniedPage')

const gate = (capability, element) => <RequireCapability capability={capability}>{element}</RequireCapability>
const gateAny = (capabilities, element) => <RequireAnyCapability capabilities={capabilities}>{element}</RequireAnyCapability>

function HomeRoute() {
  const { profile } = useAuth()
  const { activeMembershipId, isDemo, loading } = useTenant()

  if (loading) return <RouteLoading />
  if (profile?.isPlatformOwner && !activeMembershipId && !isDemo) return <Navigate to="/platform" replace />

  return gate(CAPABILITIES.VIEW_DASHBOARD, <DashboardPage />)
}

export function App() {
  return <>
  <GlobalTextareaExpander/>
  <PlatformMaintenanceBanner/>
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/activate" element={<ActivateAccountPage />} />
    <Route path="/forgot-access" element={<ForgotAccessPage />} />
    <Route path="/reset-password" element={<ResetPasswordPage />} />
    <Route element={<ProtectedRoute />}>
      <Route path="training-access/:token" element={<Suspense fallback={<RouteLoading/>}><TrainingAccessPage /></Suspense>} />
      <Route element={<AppShell />}>
        <Route path="platform" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_PLATFORM, <PlatformCenterPage />)}</Suspense>} />
        <Route path="platform/health" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_PLATFORM, <PlatformHealthPage />)}</Suspense>} />
        <Route path="platform/audit" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_PLATFORM, <PlatformAuditSecurityPage />)}</Suspense>} />
        <Route path="platform/settings" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_PLATFORM, <PlatformSettingsPage />)}</Suspense>} />
        <Route path="about" element={<Suspense fallback={<RouteLoading/>}><AboutPage /></Suspense>} />
        <Route path="analysis" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_ANALYSIS, <AnalysisPage />)}</Suspense>} />
        <Route path="account" element={<Suspense fallback={<RouteLoading/>}><AccountPage /></Suspense>} />
        <Route path="access-denied" element={<Suspense fallback={<RouteLoading/>}><AccessDeniedPage /></Suspense>} />
        <Route index element={<Suspense fallback={<RouteLoading/>}><HomeRoute /></Suspense>} />
        <Route path="my-department" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_MY_DEPARTMENT, <MyDepartmentPage />)}</Suspense>} />
        <Route path="my-profile" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_MY_PROFILE, <EmployeeRecordPage selfMode />)}</Suspense>} />
        <Route path="surveillance" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_SURVEILLANCE, <SurveillancePage />)}</Suspense>} />
        <Route path="surveillance/:caseId" element={<Suspense fallback={<RouteLoading/>}>{gateAny([CAPABILITIES.VIEW_SURVEILLANCE, CAPABILITIES.VIEW_LAB], <PatientClinicalRecordRoute />)}</Suspense>} />
        <Route path="laboratory" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_LAB, <LaboratoryPage />)}</Suspense>} />
        <Route path="laboratory/:sampleId" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_LAB, <LaboratorySampleRecordPage />)}</Suspense>} />
        <Route path="prevention" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_PREVENTION, <PreventionPage />)}</Suspense>} />
        <Route path="prevention/:recordType/:recordId" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_PREVENTION, <PreventionRecordPage />)}</Suspense>} />
        <Route path="controls" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_CONTROLS, <ControlsPage />)}</Suspense>} />
        <Route path="controls/:controlId" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_CONTROLS, <ControlRecordPage />)}</Suspense>} />
        <Route path="quality" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_QUALITY, <QualityPage />)}</Suspense>} />
        <Route path="quality/:recordType/new" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_QUALITY, <QualityCreatePage />)}</Suspense>} />
        <Route path="quality/:recordType/:recordId" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_QUALITY, <QualityRecordPage />)}</Suspense>} />
        <Route path="indicators" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_INDICATORS, <IndicatorsPage />)}</Suspense>} />
        <Route path="training" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_TRAINING, <TrainingPageRoute />)}</Suspense>} />
        <Route path="training/:programId" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_TRAINING, <TrainingPageRoute />)}</Suspense>} />
        <Route path="committees" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_COMMITTEES, <CommitteesPage />)}</Suspense>} />
        <Route path="committees/:committeeId" element={<Suspense fallback={<RouteLoading/>}><CommitteeRecordPageRoute /></Suspense>} />
        <Route path="documents" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_DOCUMENTS, <DocumentsPage />)}</Suspense>} />
        <Route path="documents/:documentId" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_DOCUMENTS, <DocumentRecordPage />)}</Suspense>} />
        <Route path="patients" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_PATIENTS, <PatientsPage />)}</Suspense>} />
        <Route path="patients/:patientId" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_PATIENTS, <PatientClinicalRecordRoute patientMode />)}</Suspense>} />
        <Route path="employees" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_STAFF, <EmployeesPage />)}</Suspense>} />
        <Route path="employees/new" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.MANAGE_STAFF_ADMIN, <EmployeeCreatePage />)}</Suspense>} />
        <Route path="employees/:employeeId" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_STAFF, <EmployeeRecordPage />)}</Suspense>} />
        <Route path="pharmacy" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_PHARMACY, <PharmacyPage />)}</Suspense>} />
        <Route path="occupational-health" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_OCCUPATIONAL_HEALTH, <OccupationalHealthPage />)}</Suspense>} />
        <Route path="lira" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_LIRA, <LiraPage />)}</Suspense>} />
        <Route path="management" element={<Suspense fallback={<RouteLoading/>}>{gateAny(MANAGEMENT_CAPABILITIES, <ManagementPage />)}</Suspense>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Route>
  </Routes>
  </>
}
