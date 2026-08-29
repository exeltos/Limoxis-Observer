import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './AppShell'
import { ProtectedRoute } from '../core/auth/ProtectedRoute'
import { RequireCapability, RequireAnyCapability } from '../core/permissions/RequireCapability'
import { CAPABILITIES, MANAGEMENT_CAPABILITIES } from '../core/permissions/roles'
import { LoginPage } from '../features/auth/LoginPage'
import { RouteLoading } from '../design-system/RouteLoading'
import { GlobalTextareaExpander } from '../design-system/GlobalTextareaExpander'

// Route-level code splitting: each feature page loads its own chunk on first
// visit instead of all being bundled into the single initial JS payload.
// Named exports need the .then(...) wrapper since React.lazy expects a
// module with a default export.
const lazyNamed = (loader, name) => lazy(() => loader().then(m => ({ default: m[name] })))

const DashboardPage = lazyNamed(() => import('../features/dashboard/DashboardPage'), 'DashboardPage')
const SurveillancePage = lazyNamed(() => import('../features/surveillance/SurveillancePage'), 'SurveillancePage')
const PatientClinicalRecordPage = lazyNamed(() => import('../features/surveillance/PatientClinicalRecordPage'), 'PatientClinicalRecordPage')
const LaboratoryPage = lazyNamed(() => import('../features/laboratory/LaboratoryPage'), 'LaboratoryPage')
const LaboratorySampleRecordPage = lazyNamed(() => import('../features/laboratory/LaboratorySampleRecordPage'), 'LaboratorySampleRecordPage')
const PreventionPage = lazyNamed(() => import('../features/prevention/PreventionPage'), 'PreventionPage')
const PreventionRecordPage = lazyNamed(() => import('../features/prevention/PreventionRecordPage'), 'PreventionRecordPage')
const ControlsPage = lazyNamed(() => import('../features/controls/ControlsPage'), 'ControlsPage')
const ControlRecordPage = lazyNamed(() => import('../features/controls/ControlRecordPage'), 'ControlRecordPage')
const QualityPage = lazyNamed(() => import('../features/quality/QualityPage'), 'QualityPage')
const QualityRecordPage = lazyNamed(() => import('../features/quality/QualityRecordPage'), 'QualityRecordPage')
const QualityCreatePage = lazyNamed(() => import('../features/quality/QualityCreatePage'), 'QualityCreatePage')
const TrainingPage = lazyNamed(() => import('../features/training/TrainingPage'), 'TrainingPage')
const TrainingAccessPage = lazyNamed(() => import('../features/training/TrainingAccessPage'), 'TrainingAccessPage')
const CommitteesPage = lazyNamed(() => import('../features/committees/CommitteesPage'), 'CommitteesPage')
const CommitteeRecordPage = lazyNamed(() => import('../features/committees/CommitteeRecordPage'), 'CommitteeRecordPage')
const DocumentsPage = lazyNamed(() => import('../features/documents/DocumentsPage'), 'DocumentsPage')
const DocumentRecordPage = lazyNamed(() => import('../features/documents/DocumentRecordPage'), 'DocumentRecordPage')
const PatientsPage = lazyNamed(() => import('../features/patients/PatientsPage'), 'PatientsPage')
const EmployeesPage = lazyNamed(() => import('../features/employees/EmployeesPage'), 'EmployeesPage')
const EmployeeRecordPage = lazyNamed(() => import('../features/employees/EmployeeRecordPage'), 'EmployeeRecordPage')
const PharmacyPage = lazyNamed(() => import('../features/pharmacy/PharmacyPage'), 'PharmacyPage')
const OccupationalHealthPage = lazyNamed(() => import('../features/occupational-health/OccupationalHealthPage'), 'OccupationalHealthPage')
const LiraPage = lazyNamed(() => import('../features/lira/LiraPage'), 'LiraPage')
const ManagementPage = lazyNamed(() => import('../features/management/ManagementPage'), 'ManagementPage')
const IndicatorsPage = lazyNamed(() => import('../features/indicators/IndicatorsPage'), 'IndicatorsPage')
const MyDepartmentPage = lazyNamed(() => import('../features/workspaces/MyDepartmentPage'), 'MyDepartmentPage')
const AboutPage = lazyNamed(() => import('../features/about/AboutPage'), 'AboutPage')

const gate = (capability, element) => <RequireCapability capability={capability}>{element}</RequireCapability>
const gateAny = (capabilities, element) => <RequireAnyCapability capabilities={capabilities}>{element}</RequireAnyCapability>

export function App() {
  return <>
  <GlobalTextareaExpander/>
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/training-access/:token" element={<Suspense fallback={<RouteLoading/>}><TrainingAccessPage /></Suspense>} />
    <Route element={<ProtectedRoute />}>
      <Route element={<AppShell />}>
        <Route path="about" element={<Suspense fallback={<RouteLoading/>}><AboutPage /></Suspense>} />
        <Route index element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_DASHBOARD, <DashboardPage />)}</Suspense>} />
        <Route path="my-department" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_MY_DEPARTMENT, <MyDepartmentPage />)}</Suspense>} />
        <Route path="my-profile" element={<Suspense fallback={<RouteLoading/>}><EmployeeRecordPage selfMode /></Suspense>} />
        <Route path="surveillance" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_SURVEILLANCE, <SurveillancePage />)}</Suspense>} />
        <Route path="surveillance/:caseId" element={<Suspense fallback={<RouteLoading/>}>{gateAny([CAPABILITIES.VIEW_SURVEILLANCE, CAPABILITIES.VIEW_LAB], <PatientClinicalRecordPage />)}</Suspense>} />
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
        <Route path="training" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_TRAINING, <TrainingPage />)}</Suspense>} />
        <Route path="training/:programId" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_TRAINING, <TrainingPage />)}</Suspense>} />
        <Route path="committees" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_COMMITTEES, <CommitteesPage />)}</Suspense>} />
        <Route path="committees/:committeeId" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_COMMITTEES, <CommitteeRecordPage />)}</Suspense>} />
        <Route path="documents" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_DOCUMENTS, <DocumentsPage />)}</Suspense>} />
        <Route path="documents/:documentId" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_DOCUMENTS, <DocumentRecordPage />)}</Suspense>} />
        <Route path="patients" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_PATIENTS, <PatientsPage />)}</Suspense>} />
        <Route path="patients/:patientId" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_PATIENTS, <PatientClinicalRecordPage patientMode />)}</Suspense>} />
        <Route path="employees" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_STAFF, <EmployeesPage />)}</Suspense>} />
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
