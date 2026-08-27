import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './AppShell'
import { ProtectedRoute } from '../core/auth/ProtectedRoute'
import { RequireCapability } from '../core/permissions/RequireCapability'
import { CAPABILITIES } from '../core/permissions/roles'
import { LoginPage } from '../features/auth/LoginPage'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import { SurveillancePage } from '../features/surveillance/SurveillancePage'
import { PatientClinicalRecordPage } from '../features/surveillance/PatientClinicalRecordPage'
import { LaboratoryPage } from '../features/laboratory/LaboratoryPage'
import { LaboratorySampleRecordPage } from '../features/laboratory/LaboratorySampleRecordPage'
import { PreventionPage } from '../features/prevention/PreventionPage'
import { ControlsPage } from '../features/controls/ControlsPage'
import { ControlRecordPage } from '../features/controls/ControlRecordPage'
import { RecordsPage } from '../features/records/RecordsPage'
import { QualityPage } from '../features/quality/QualityPage'
import { QualityRecordPage } from '../features/quality/QualityRecordPage'
import { QualityCreatePage } from '../features/quality/QualityCreatePage'
import { TrainingPage } from '../features/training/TrainingPage'
import { CommitteesPage } from '../features/committees/CommitteesPage'
import { DocumentsPage } from '../features/documents/DocumentsPage'
import { PatientsPage } from '../features/patients/PatientsPage'
import { EmployeesPage } from '../features/employees/EmployeesPage'
import { EmployeeRecordPage } from '../features/employees/EmployeeRecordPage'
import { PharmacyPage } from '../features/pharmacy/PharmacyPage'
import { OccupationalHealthPage } from '../features/occupational-health/OccupationalHealthPage'
import { LiraPage } from '../features/lira/LiraPage'
import { ManagementPage } from '../features/management/ManagementPage'
import { IndicatorsPage } from '../features/indicators/IndicatorsPage'
import { MyDepartmentPage } from '../features/workspaces/MyDepartmentPage'

const gate = (capability, element) => <RequireCapability capability={capability}>{element}</RequireCapability>

export function App() {
  return <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route element={<ProtectedRoute />}>
      <Route element={<AppShell />}>
        <Route index element={gate(CAPABILITIES.VIEW_DASHBOARD, <DashboardPage />)} />
        <Route path="my-department" element={gate(CAPABILITIES.VIEW_MY_DEPARTMENT, <MyDepartmentPage />)} />
        <Route path="my-profile" element={gate(CAPABILITIES.VIEW_MY_PROFILE, <EmployeeRecordPage selfMode />)} />
        <Route path="surveillance" element={gate(CAPABILITIES.VIEW_SURVEILLANCE, <SurveillancePage />)} />
        <Route path="surveillance/:caseId" element={gate(CAPABILITIES.VIEW_SURVEILLANCE, <PatientClinicalRecordPage />)} />
        <Route path="laboratory" element={gate(CAPABILITIES.VIEW_LAB, <LaboratoryPage />)} />
        <Route path="laboratory/:sampleId" element={gate(CAPABILITIES.VIEW_LAB, <LaboratorySampleRecordPage />)} />
        <Route path="prevention" element={gate(CAPABILITIES.VIEW_PREVENTION, <PreventionPage />)} />
        <Route path="controls" element={gate(CAPABILITIES.VIEW_CONTROLS, <ControlsPage />)} />
        <Route path="controls/:controlId" element={gate(CAPABILITIES.VIEW_CONTROLS, <ControlRecordPage />)} />
        <Route path="records" element={gate(CAPABILITIES.VIEW_RECORDS, <RecordsPage />)} />
        <Route path="quality" element={gate(CAPABILITIES.VIEW_QUALITY, <QualityPage />)} />
        <Route path="quality/:recordType/new" element={gate(CAPABILITIES.VIEW_QUALITY, <QualityCreatePage />)} />
        <Route path="quality/:recordType/:recordId" element={gate(CAPABILITIES.VIEW_QUALITY, <QualityRecordPage />)} />
        <Route path="indicators" element={gate(CAPABILITIES.VIEW_INDICATORS, <IndicatorsPage />)} />
        <Route path="training" element={gate(CAPABILITIES.VIEW_TRAINING, <TrainingPage />)} />
        <Route path="committees" element={gate(CAPABILITIES.VIEW_COMMITTEES, <CommitteesPage />)} />
        <Route path="documents" element={gate(CAPABILITIES.VIEW_DOCUMENTS, <DocumentsPage />)} />
        <Route path="patients" element={gate(CAPABILITIES.VIEW_PATIENTS, <PatientsPage />)} />
        <Route path="patients/:patientId" element={gate(CAPABILITIES.VIEW_PATIENTS, <PatientClinicalRecordPage patientMode />)} />
        <Route path="employees" element={gate(CAPABILITIES.VIEW_STAFF, <EmployeesPage />)} />
        <Route path="employees/:employeeId" element={gate(CAPABILITIES.VIEW_STAFF, <EmployeeRecordPage />)} />
        <Route path="pharmacy" element={gate(CAPABILITIES.VIEW_PHARMACY, <PharmacyPage />)} />
        <Route path="occupational-health" element={gate(CAPABILITIES.VIEW_OCCUPATIONAL_HEALTH, <OccupationalHealthPage />)} />
        <Route path="lira" element={gate(CAPABILITIES.VIEW_LIRA, <LiraPage />)} />
        <Route path="management" element={gate(CAPABILITIES.MANAGE_ORGANIZATION, <ManagementPage />)} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Route>
  </Routes>
}
