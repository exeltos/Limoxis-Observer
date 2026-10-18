import { Suspense } from 'react'
import { lazyPage } from '../core/errors/chunkRecovery'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './AppShell'
import { ProtectedRoute } from '../core/auth/ProtectedRoute'
import { useAuth } from '../core/auth/AuthContext'
import { useTenant } from '../core/tenant/TenantContext'
import { RequireCapability, RequireAnyCapability } from '../core/permissions/RequireCapability'
import { CAPABILITIES, MANAGEMENT_CAPABILITIES } from '../core/permissions/roles'
import { LoginPage } from '../features/auth/LoginPage'
import { RouteLoading } from '../design-system/RouteLoading'
import { GlobalTextareaExpander } from '../design-system/GlobalTextareaExpander'
import { PlatformMaintenanceBanner } from '../features/platform/PlatformMaintenanceBanner'

const lazyNamed = (loader, name) => lazyPage(loader, name)
// Sign-in side pages other than the login screen load on demand.
const ResetPasswordPage = lazyNamed(() => import('../features/auth/ResetPasswordPage'), 'ResetPasswordPage')
const ForgotAccessPage = lazyNamed(() => import('../features/auth/ForgotAccessPage'), 'ForgotAccessPage')
const ActivateAccountPage = lazyNamed(() => import('../features/auth/ActivateAccountPage'), 'ActivateAccountPage')
const LegalPage = lazyNamed(() => import('../features/legal/LegalPage'), 'LegalPage')
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
const ControlCreatePage = lazyNamed(() => import('../features/controls/ControlsPage'), 'ControlCreatePage')
const ControlRecordPage = lazyNamed(() => import('../features/controls/ControlRecordPage'), 'ControlRecordPage')
const QualityPage = lazyNamed(() => import('../features/quality/QualityPage'), 'QualityPage')
const QualityRecordPage = lazyNamed(() => import('../features/quality/QualityRecordPage'), 'QualityRecordPage')
const QualityCreatePage = lazyNamed(() => import('../features/quality/QualityCreatePage'), 'QualityCreatePage')
const MyReportsPage = lazyNamed(() => import('../features/quality/MyReportsPage'), 'MyReportsPage')
const IncidentReportPage = lazyNamed(() => import('../features/quality/IncidentReportPage'), 'IncidentReportPage')
const RegistersPage = lazyNamed(() => import('../features/registers/RegistersPage'), 'RegistersPage')
const RegisterCreatePage = lazyNamed(() => import('../features/registers/RegisterCreatePage'), 'RegisterCreatePage')
const RegisterRecordPage = lazyNamed(() => import('../features/registers/RegisterRecordPage'), 'RegisterRecordPage')
const RegisterEntryPage = lazyNamed(() => import('../features/registers/RegisterEntryPage'), 'RegisterEntryPage')
const RegisterImportPage = lazyNamed(() => import('../features/registers/RegisterImportPage'), 'RegisterImportPage')
const ReviewRecordPage = lazyNamed(() => import('../features/quality/review/ReviewRecordPage'), 'ReviewRecordPage')
const MeetingRecordPage = lazyNamed(() => import('../features/quality/meetings/MeetingRecordPage'), 'MeetingRecordPage')
const RiskAssessmentPage = lazyNamed(() => import('../features/quality/risk/RiskAssessmentPage'), 'RiskAssessmentPage')
const RiskRecordPage = lazyNamed(() => import('../features/quality/risk/RiskRecordPage'), 'RiskRecordPage')
const OpportunityRecordPage = lazyNamed(() => import('../features/quality/risk/OpportunityRecordPage'), 'OpportunityRecordPage')
const TrainingPageRoute = lazyNamed(() => import('../features/training/TrainingPageRoute'), 'TrainingPageRoute')
const TrainingCreatePage = lazyNamed(() => import('../features/training/TrainingCreatePage'), 'TrainingCreatePage')
const TrainingAccessPage = lazyNamed(() => import('../features/training/TrainingAccessPage'), 'TrainingAccessPage')
const MinutesApprovalPage = lazyNamed(() => import('../features/committees/MinutesApprovalPage'), 'MinutesApprovalPage')
const SurveyRespondPage = lazyNamed(() => import('../features/quality/surveys/SurveyRespondPage'), 'SurveyRespondPage')
const SurveyRecordPage = lazyNamed(() => import('../features/quality/surveys/SurveyRecordPage'), 'SurveyRecordPage')
const EquipmentRecordPage = lazyNamed(() => import('../features/quality/resources/EquipmentRecordPage'), 'EquipmentRecordPage')
const SupplierRecordPage = lazyNamed(() => import('../features/quality/resources/SupplierRecordPage'), 'SupplierRecordPage')
const CommitteesPage = lazyNamed(() => import('../features/committees/CommitteesPage'), 'CommitteesPage')
const CommitteeCreatePage = lazyNamed(() => import('../features/committees/CommitteeCreatePage'), 'CommitteeCreatePage')
const CommitteeRecordPageRoute = lazyNamed(() => import('../features/committees/CommitteeRecordPageRoute'), 'CommitteeRecordPageRoute')
const CalendarPage = lazyNamed(() => import('../features/calendar/CalendarPage'), 'CalendarPage')
const DocumentsPage = lazyNamed(() => import('../features/documents/DocumentsPage'), 'DocumentsPage')
const RegulationsPage = lazyNamed(() => import('../features/regulations/RegulationsPage'), 'RegulationsPage')
const RegulationPage = lazyNamed(() => import('../features/regulations/RegulationPage'), 'RegulationPage')
const RegulationTemplatePage = lazyNamed(() => import('../features/regulations/RegulationTemplatePage'), 'RegulationTemplatePage')
const DocumentCreatePage = lazyNamed(() => import('../features/documents/DocumentCreatePage'), 'DocumentCreatePage')
const DocumentAcknowledgementsPage = lazyNamed(() => import('../features/documents/DocumentAcknowledgementsPage'), 'DocumentAcknowledgementsPage')
const DocumentRecordPage = lazyNamed(() => import('../features/documents/DocumentRecordPage'), 'DocumentRecordPage')
const PatientsPage = lazyNamed(() => import('../features/patients/PatientsPage'), 'PatientsPage')
const PatientCreatePage = lazyNamed(() => import('../features/patients/PatientCreatePage'), 'PatientCreatePage')
const EmployeesPage = lazyNamed(() => import('../features/employees/EmployeesPage'), 'EmployeesPage')
const EmployeeCreatePage = lazyNamed(() => import('../features/employees/EmployeeCreatePage'), 'EmployeeCreatePage')
const EmployeeRecordPage = lazyNamed(() => import('../features/employees/EmployeeRecordPage'), 'EmployeeRecordPage')
const PharmacyPage = lazyNamed(() => import('../features/pharmacy/PharmacyPage'), 'PharmacyPage')
const OccupationalHealthPage = lazyNamed(() => import('../features/occupational-health/OccupationalHealthPage'), 'OccupationalHealthPage')
const ManagementPage = lazyNamed(() => import('../features/management/ManagementPage'), 'ManagementPage')
const RecycleBinPage = lazyNamed(() => import('../features/recycle-bin/RecycleBinPage'), 'RecycleBinPage')
const IndicatorsPage = lazyNamed(() => import('../features/indicators/IndicatorsPage'), 'IndicatorsPage')
const IndicatorCreatePage = lazyNamed(() => import('../features/indicators/IndicatorCreatePage'), 'IndicatorCreatePage')
const IndicatorRecordPage = lazyNamed(() => import('../features/indicators/IndicatorRecordPage'), 'IndicatorRecordPage')
const MyDepartmentPage = lazyNamed(() => import('../features/workspaces/MyDepartmentPage'), 'MyDepartmentPage')
const AboutPage = lazyNamed(() => import('../features/about/AboutPage'), 'AboutPage')
const AnalysisPage = lazyNamed(() => import('../features/analysis/AnalysisPage'), 'AnalysisPage')
const AccountPage = lazyNamed(() => import('../features/account/AccountPage'), 'AccountPage')
const AccessDeniedPage = lazyNamed(() => import('../features/auth/AccessDeniedPage'), 'AccessDeniedPage')
const gate = (capability, element) => <RequireCapability capability={capability}>{element}</RequireCapability>
const gateAny = (capabilities, element) => <RequireAnyCapability capabilities={capabilities}>{element}</RequireAnyCapability>
function HomeRoute(){const {profile}=useAuth();const {activeMembershipId,isDemo,loading}=useTenant();if(loading)return <RouteLoading/>;if(profile?.isPlatformOwner&&!activeMembershipId&&!isDemo)return <Navigate to="/platform" replace/>;return gate(CAPABILITIES.VIEW_DASHBOARD,<DashboardPage/>)}
export function App(){return <><GlobalTextareaExpander/><PlatformMaintenanceBanner/><Routes>
 <Route path="/login" element={<LoginPage/>}/><Route path="/activate" element={<Suspense fallback={<RouteLoading/>}><ActivateAccountPage/></Suspense>}/><Route path="/forgot-access" element={<Suspense fallback={<RouteLoading/>}><ForgotAccessPage/></Suspense>}/><Route path="/privacy" element={<Suspense fallback={<RouteLoading/>}><LegalPage kind="privacy"/></Suspense>}/><Route path="/terms" element={<Suspense fallback={<RouteLoading/>}><LegalPage kind="terms"/></Suspense>}/><Route path="/reset-password" element={<Suspense fallback={<RouteLoading/>}><ResetPasswordPage/></Suspense>}/><Route path="training-access/:token" element={<Suspense fallback={<RouteLoading/>}><TrainingAccessPage/></Suspense>}/><Route path="minutes-approval/:token" element={<Suspense fallback={<RouteLoading/>}><MinutesApprovalPage/></Suspense>}/><Route path="survey/:token" element={<Suspense fallback={<RouteLoading/>}><SurveyRespondPage/></Suspense>}/>
 <Route element={<ProtectedRoute/>}><Route element={<AppShell/>}>
  <Route path="platform" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_PLATFORM,<PlatformCenterPage/>)}</Suspense>}/><Route path="platform/health" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_PLATFORM,<PlatformHealthPage/>)}</Suspense>}/><Route path="platform/audit" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_PLATFORM,<PlatformAuditSecurityPage/>)}</Suspense>}/><Route path="platform/settings" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_PLATFORM,<PlatformSettingsPage/>)}</Suspense>}/>
  <Route path="about" element={<Suspense fallback={<RouteLoading/>}><AboutPage/></Suspense>}/><Route path="analysis" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_ANALYSIS,<AnalysisPage/>)}</Suspense>}/><Route path="account" element={<Suspense fallback={<RouteLoading/>}><AccountPage/></Suspense>}/><Route path="access-denied" element={<Suspense fallback={<RouteLoading/>}><AccessDeniedPage/></Suspense>}/><Route index element={<Suspense fallback={<RouteLoading/>}><HomeRoute/></Suspense>}/>
  <Route path="my-department" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_MY_DEPARTMENT,<MyDepartmentPage/>)}</Suspense>}/><Route path="my-profile" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_MY_PROFILE,<EmployeeRecordPage selfMode/>)}</Suspense>}/>
  <Route path="surveillance" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_SURVEILLANCE,<SurveillancePage/>)}</Suspense>}/><Route path="surveillance/environment/:sampleId" element={<Suspense fallback={<RouteLoading/>}>{gateAny([CAPABILITIES.VIEW_SURVEILLANCE,CAPABILITIES.VIEW_LAB],<LaboratorySampleRecordPage/>)}</Suspense>}/><Route path="surveillance/:caseId" element={<Suspense fallback={<RouteLoading/>}>{gateAny([CAPABILITIES.VIEW_SURVEILLANCE,CAPABILITIES.VIEW_LAB],<PatientClinicalRecordRoute/>)}</Suspense>}/>
  <Route path="laboratory" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_LAB,<LaboratoryPage/>)}</Suspense>}/><Route path="laboratory/:sampleId" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_LAB,<LaboratorySampleRecordPage/>)}</Suspense>}/>
  <Route path="prevention" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_PREVENTION,<PreventionPage/>)}</Suspense>}/><Route path="prevention/:recordType/:recordId" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_PREVENTION,<PreventionRecordPage/>)}</Suspense>}/>
  <Route path="controls" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_CONTROLS,<ControlsPage/>)}</Suspense>}/><Route path="controls/new" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_CONTROLS,<ControlCreatePage/>)}</Suspense>}/><Route path="controls/:controlId" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_CONTROLS,<ControlRecordPage/>)}</Suspense>}/>
  <Route path="quality" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_QUALITY,<QualityPage/>)}</Suspense>}/><Route path="quality/risks/:assessmentCode" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_QUALITY,<RiskAssessmentPage/>)}</Suspense>}/><Route path="quality/risks/:assessmentCode/opportunities/:opportunityId" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_QUALITY,<OpportunityRecordPage/>)}</Suspense>}/><Route path="quality/risks/:assessmentCode/:riskKey" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_QUALITY,<RiskRecordPage/>)}</Suspense>}/><Route path="registers" element={<Suspense fallback={<RouteLoading/>}>{gateAny([CAPABILITIES.VIEW_QUALITY,CAPABILITIES.VIEW_MY_DEPARTMENT],<RegistersPage/>)}</Suspense>}/><Route path="registers/new" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.MANAGE_QUALITY,<RegisterCreatePage/>)}</Suspense>}/><Route path="registers/:registerId" element={<Suspense fallback={<RouteLoading/>}>{gateAny([CAPABILITIES.VIEW_QUALITY,CAPABILITIES.VIEW_MY_DEPARTMENT],<RegisterRecordPage/>)}</Suspense>}/><Route path="registers/:registerId/import" element={<Suspense fallback={<RouteLoading/>}>{gateAny([CAPABILITIES.VIEW_QUALITY,CAPABILITIES.VIEW_MY_DEPARTMENT],<RegisterImportPage/>)}</Suspense>}/><Route path="registers/:registerId/entries/:entryId" element={<Suspense fallback={<RouteLoading/>}>{gateAny([CAPABILITIES.VIEW_QUALITY,CAPABILITIES.VIEW_MY_DEPARTMENT],<RegisterEntryPage/>)}</Suspense>}/><Route path="meetings/:meetingId" element={<Suspense fallback={<RouteLoading/>}>{gateAny([CAPABILITIES.VIEW_QUALITY,CAPABILITIES.VIEW_MY_DEPARTMENT],<MeetingRecordPage/>)}</Suspense>}/><Route path="quality/surveys/:surveyId" element={<Suspense fallback={<RouteLoading/>}>{gateAny([CAPABILITIES.VIEW_QUALITY,CAPABILITIES.VIEW_MY_DEPARTMENT],<SurveyRecordPage/>)}</Suspense>}/><Route path="quality/equipment/:equipmentId" element={<Suspense fallback={<RouteLoading/>}>{gateAny([CAPABILITIES.VIEW_QUALITY,CAPABILITIES.VIEW_MY_DEPARTMENT],<EquipmentRecordPage/>)}</Suspense>}/><Route path="quality/suppliers/:supplierId" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_QUALITY,<SupplierRecordPage/>)}</Suspense>}/><Route path="quality/reviews/:reviewId" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_QUALITY,<ReviewRecordPage/>)}</Suspense>}/><Route path="quality/my-reports" element={<Suspense fallback={<RouteLoading/>}>{gateAny([CAPABILITIES.REPORT_INCIDENT,CAPABILITIES.MANAGE_QUALITY],<MyReportsPage/>)}</Suspense>}/><Route path="quality/report" element={<Suspense fallback={<RouteLoading/>}>{gateAny([CAPABILITIES.REPORT_INCIDENT,CAPABILITIES.MANAGE_QUALITY],<IncidentReportPage/>)}</Suspense>}/><Route path="quality/:recordType/new" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_QUALITY,<QualityCreatePage/>)}</Suspense>}/><Route path="quality/:recordType/:recordId" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_QUALITY,<QualityRecordPage/>)}</Suspense>}/>
  <Route path="indicators" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_INDICATORS,<IndicatorsPage/>)}</Suspense>}/><Route path="indicators/new" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.MANAGE_INDICATORS,<IndicatorCreatePage/>)}</Suspense>}/><Route path="indicators/:indicatorId" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_INDICATORS,<IndicatorRecordPage/>)}</Suspense>}/>
  <Route path="training" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_TRAINING,<TrainingPageRoute/>)}</Suspense>}/><Route path="training/new" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.MANAGE_TRAINING,<TrainingCreatePage/>)}</Suspense>}/><Route path="training/:programId" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_TRAINING,<TrainingPageRoute/>)}</Suspense>}/>
  <Route path="committees" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_COMMITTEES,<CommitteesPage/>)}</Suspense>}/><Route path="committees/new" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.CREATE_COMMITTEE,<CommitteeCreatePage/>)}</Suspense>}/><Route path="committees/:committeeId" element={<Suspense fallback={<RouteLoading/>}><CommitteeRecordPageRoute/></Suspense>}/>
  <Route path="calendar" element={<Suspense fallback={<RouteLoading/>}><CalendarPage/></Suspense>}/><Route path="regulations" element={<Suspense fallback={<RouteLoading/>}>{gateAny([CAPABILITIES.VIEW_DOCUMENTS,CAPABILITIES.VIEW_QUALITY],<RegulationsPage/>)}</Suspense>}/><Route path="regulations/templates/:templateKey" element={<Suspense fallback={<RouteLoading/>}>{gateAny([CAPABILITIES.VIEW_DOCUMENTS,CAPABILITIES.VIEW_QUALITY],<RegulationTemplatePage/>)}</Suspense>}/><Route path="regulations/:regulationId" element={<Suspense fallback={<RouteLoading/>}>{gateAny([CAPABILITIES.VIEW_DOCUMENTS,CAPABILITIES.VIEW_QUALITY],<RegulationPage/>)}</Suspense>}/><Route path="documents" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_DOCUMENTS,<DocumentsPage/>)}</Suspense>}/><Route path="documents/new" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.MANAGE_DOCUMENTS,<DocumentCreatePage/>)}</Suspense>}/><Route path="documents/acknowledgements" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_DOCUMENTS,<DocumentAcknowledgementsPage/>)}</Suspense>}/><Route path="documents/:documentId" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_DOCUMENTS,<DocumentRecordPage/>)}</Suspense>}/>
  <Route path="patients" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_PATIENTS,<PatientsPage/>)}</Suspense>}/><Route path="patients/new" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.CREATE_PATIENT,<PatientCreatePage/>)}</Suspense>}/><Route path="patients/:patientId" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_PATIENTS,<PatientClinicalRecordRoute patientMode/>)}</Suspense>}/>
  <Route path="employees" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_STAFF,<EmployeesPage/>)}</Suspense>}/><Route path="employees/new" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.MANAGE_STAFF_ADMIN,<EmployeeCreatePage/>)}</Suspense>}/><Route path="employees/:employeeId" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_STAFF,<EmployeeRecordPage/>)}</Suspense>}/>
  <Route path="pharmacy" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_PHARMACY,<PharmacyPage/>)}</Suspense>}/><Route path="occupational-health" element={<Suspense fallback={<RouteLoading/>}>{gate(CAPABILITIES.VIEW_OCCUPATIONAL_HEALTH,<OccupationalHealthPage/>)}</Suspense>}/><Route path="management" element={<Suspense fallback={<RouteLoading/>}>{gateAny(MANAGEMENT_CAPABILITIES,<ManagementPage/>)}</Suspense>}/><Route path="recycle-bin" element={<Suspense fallback={<RouteLoading/>}><RecycleBinPage/></Suspense>}/><Route path="*" element={<Navigate to="/" replace/>}/>
 </Route></Route>
 </Routes></>}
