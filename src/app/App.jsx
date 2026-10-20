import { Suspense } from 'react'
import { lazyPage } from '../core/errors/chunkRecovery'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './AppShell'
import { ProtectedRoute } from '../core/auth/ProtectedRoute'
import { useAuth } from '../core/auth/AuthContext'
import { useTenant } from '../core/tenant/TenantContext'
import { RequireCapability, RequireAnyCapability } from '../core/permissions/RequireCapability'
import { CAPABILITIES, MANAGEMENT_CAPABILITIES, ROLES } from '../core/permissions/roles'
import { LoginPage } from '../features/auth/LoginPage'
import { RouteLoading } from '../design-system/RouteLoading'
import { registerRoutePreload } from './routePreload'
import { SectionRedirect } from '../core/navigation/SectionRoute'
import { sectionCapabilities } from '../core/navigation/sectionTabs'
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
// The merged sections: «Επιτήρηση», «Έγγραφα & Κανονισμοί», «Συνεδριάσεις & αποφάσεις» (one menu entry, several tabs).
const SurveillanceSectionPage = lazyNamed(() => import('../features/sections/SectionPages'), 'SurveillanceSectionPage')
const DocumentsSectionPage = lazyNamed(() => import('../features/sections/SectionPages'), 'DocumentsSectionPage')
const MeetingsSectionPage = lazyNamed(() => import('../features/sections/SectionPages'), 'MeetingsSectionPage')
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
const ApplicationPage = lazyNamed(() => import('../features/interviews/apply/ApplicationPage'), 'ApplicationPage')
const SurveyRecordPage = lazyNamed(() => import('../features/quality/surveys/SurveyRecordPage'), 'SurveyRecordPage')
const EquipmentRecordPage = lazyNamed(() => import('../features/quality/resources/EquipmentRecordPage'), 'EquipmentRecordPage')
const SupplierRecordPage = lazyNamed(() => import('../features/quality/resources/SupplierRecordPage'), 'SupplierRecordPage')
const AuditQuestionnairesPage = lazyNamed(() => import('../features/quality/audits/AuditQuestionnairesPage'), 'AuditQuestionnairesPage')
const LegislationPage = lazyNamed(() => import('../features/legislation/LegislationPage'), 'LegislationPage')
const LegislationRecordPage = lazyNamed(() => import('../features/legislation/LegislationRecordPage'), 'LegislationRecordPage')
const LegislationEditorPage = lazyNamed(() => import('../features/legislation/LegislationEditorPage'), 'LegislationEditorPage')
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
const KitchenPage = lazyNamed(() => import('../features/kitchen/KitchenPage'), 'KitchenPage')
const KitchenReceiptRecordPage = lazyNamed(() => import('../features/kitchen/KitchenReceiptRecordPage'), 'KitchenReceiptRecordPage')
const KitchenDayRecordPage = lazyNamed(() => import('../features/kitchen/KitchenDayRecordPage'), 'KitchenDayRecordPage')
const PharmacyPage = lazyNamed(() => import('../features/pharmacy/PharmacyPage'), 'PharmacyPage')
const OccupationalHealthPage = lazyNamed(() => import('../features/occupational-health/OccupationalHealthPage'), 'OccupationalHealthPage')
const ManagementPage = lazyNamed(() => import('../features/management/ManagementPage'), 'ManagementPage')
const RecycleBinPage = lazyNamed(() => import('../features/recycle-bin/RecycleBinPage'), 'RecycleBinPage')
const IndicatorsPage = lazyNamed(() => import('../features/indicators/IndicatorsPage'), 'IndicatorsPage')
const IndicatorsRoute = lazyNamed(() => import('../features/indicators/IndicatorsRoute'), 'IndicatorsRoute')
const IndicatorCreatePage = lazyNamed(() => import('../features/indicators/IndicatorCreatePage'), 'IndicatorCreatePage')
const IndicatorRecordPage = lazyNamed(() => import('../features/indicators/IndicatorRecordPage'), 'IndicatorRecordPage')
const MyDepartmentPage = lazyNamed(() => import('../features/workspaces/MyDepartmentPage'), 'MyDepartmentPage')
const AboutPage = lazyNamed(() => import('../features/about/AboutPage'), 'AboutPage')
// /analysis: the route wrapper (AnalysisRoute) sends whoever has «Δείκτες» to the matching tab there.
const AnalysisPage = lazyNamed(() => import('../features/analysis/AnalysisRoute'), 'AnalysisRoute')
const AccountPage = lazyNamed(() => import('../features/account/AccountPage'), 'AccountPage')
const ExecutiveDashboardPage = lazyNamed(() => import('../features/executive/ExecutiveDashboardPage'), 'ExecutiveDashboardPage')
const InterviewsPage = lazyNamed(() => import('../features/interviews/InterviewsPage'), 'InterviewsPage')
const InterviewRecordPage = lazyNamed(() => import('../features/interviews/InterviewRecordPage'), 'InterviewRecordPage')
const SupplierCertificatePage = lazyNamed(() => import('../features/quality/resources/SupplierCertificatePage'), 'SupplierCertificatePage')
const AccessDeniedPage = lazyNamed(() => import('../features/auth/AccessDeniedPage'), 'AccessDeniedPage')
// The page files each sidebar screen opens (list and record), fetched ahead on hover/idle.
registerRoutePreload('/', DashboardPage)
registerRoutePreload('/executive', ExecutiveDashboardPage)
registerRoutePreload('/my-department', MyDepartmentPage)
registerRoutePreload('/surveillance', SurveillanceSectionPage, SurveillancePage, PatientClinicalRecordRoute)
registerRoutePreload('/patients', PatientsPage, PatientClinicalRecordRoute)
registerRoutePreload('/laboratory', LaboratoryPage, LaboratorySampleRecordPage)
registerRoutePreload('/prevention', PreventionPage, PreventionRecordPage)
registerRoutePreload('/controls', ControlsPage, ControlRecordPage)
registerRoutePreload('/quality', QualityPage, QualityRecordPage, MyReportsPage)
registerRoutePreload('/registers', RegistersPage, RegisterRecordPage)
registerRoutePreload('/employees', EmployeesPage, EmployeeRecordPage)
registerRoutePreload('/interviews', InterviewsPage, InterviewRecordPage)
registerRoutePreload('/analysis', AnalysisPage)
registerRoutePreload('/indicators', IndicatorsRoute, IndicatorsPage, IndicatorRecordPage)
registerRoutePreload('/training', TrainingPageRoute)
registerRoutePreload('/committees', CommitteesPage, CommitteeRecordPageRoute)
registerRoutePreload('/meetings', MeetingsSectionPage, CommitteesPage, MeetingRecordPage)
registerRoutePreload('/documents', DocumentsSectionPage, DocumentsPage, DocumentRecordPage)
registerRoutePreload('/regulations', RegulationsPage, RegulationPage)
registerRoutePreload('/legislation', LegislationPage, LegislationRecordPage)
registerRoutePreload('/kitchen', KitchenPage, KitchenReceiptRecordPage, KitchenDayRecordPage)
registerRoutePreload('/pharmacy', PharmacyPage)
registerRoutePreload('/occupational-health', OccupationalHealthPage)
registerRoutePreload('/calendar', CalendarPage)
registerRoutePreload('/management', ManagementPage)
registerRoutePreload('/platform', PlatformCenterPage)
const KITCHEN_CAPABILITIES = [CAPABILITIES.VIEW_KITCHEN, CAPABILITIES.RECORD_KITCHEN, CAPABILITIES.MANAGE_KITCHEN]
const gate = (capability, element) => <RequireCapability capability={capability}>{element}</RequireCapability>
const gateAny = (capabilities, element) => <RequireAnyCapability capabilities={capabilities}>{element}</RequireAnyCapability>
// The Director's home is the Executive dashboard (overview + analysis), not the generic overview.
function HomeRoute(){const {profile}=useAuth();const {activeMembershipId,isDemo,loading,role}=useTenant();if(loading)return <RouteLoading/>;if(profile?.isPlatformOwner&&!activeMembershipId&&!isDemo)return <Navigate to="/platform" replace/>;if(role===ROLES.HOSPITAL_DIRECTOR)return <Navigate to="/executive" replace/>;return gate(CAPABILITIES.VIEW_DASHBOARD,<DashboardPage/>)}
export function App(){return <><GlobalTextareaExpander/><PlatformMaintenanceBanner/><Routes>
 <Route path="/login" element={<LoginPage/>}/><Route path="/activate" element={<Suspense fallback={<RouteLoading/>}><ActivateAccountPage/></Suspense>}/><Route path="/forgot-access" element={<Suspense fallback={<RouteLoading/>}><ForgotAccessPage/></Suspense>}/><Route path="/privacy" element={<Suspense fallback={<RouteLoading/>}><LegalPage kind="privacy"/></Suspense>}/><Route path="/terms" element={<Suspense fallback={<RouteLoading/>}><LegalPage kind="terms"/></Suspense>}/><Route path="/reset-password" element={<Suspense fallback={<RouteLoading/>}><ResetPasswordPage/></Suspense>}/><Route path="training-access/:token" element={<Suspense fallback={<RouteLoading/>}><TrainingAccessPage/></Suspense>}/><Route path="minutes-approval/:token" element={<Suspense fallback={<RouteLoading/>}><MinutesApprovalPage/></Suspense>}/><Route path="survey/:token" element={<Suspense fallback={<RouteLoading/>}><SurveyRespondPage/></Suspense>}/><Route path="apply" element={<Suspense fallback={<RouteLoading/>}><ApplicationPage/></Suspense>}/><Route path="apply/:token" element={<Suspense fallback={<RouteLoading/>}><ApplicationPage/></Suspense>}/><Route path="supplier-certificate/:token" element={<Suspense fallback={<RouteLoading/>}><SupplierCertificatePage/></Suspense>}/>
 <Route element={<ProtectedRoute/>}><Route element={<AppShell/>}>
  <Route path="platform" element={gate(CAPABILITIES.VIEW_PLATFORM,<PlatformCenterPage/>)}/><Route path="platform/health" element={gate(CAPABILITIES.VIEW_PLATFORM,<PlatformHealthPage/>)}/><Route path="platform/legislation" element={gate(CAPABILITIES.VIEW_PLATFORM,<LegislationPage/>)}/><Route path="platform/legislation/library/:textId" element={gate(CAPABILITIES.VIEW_PLATFORM,<LegislationEditorPage/>)}/><Route path="platform/audit" element={gate(CAPABILITIES.VIEW_PLATFORM,<PlatformAuditSecurityPage/>)}/><Route path="platform/settings" element={gate(CAPABILITIES.VIEW_PLATFORM,<PlatformSettingsPage/>)}/>
  <Route path="about" element={<AboutPage/>}/><Route path="analysis" element={gate(CAPABILITIES.VIEW_ANALYSIS,<AnalysisPage/>)}/><Route path="executive" element={gate(CAPABILITIES.VIEW_EXECUTIVE_DASHBOARD,<ExecutiveDashboardPage/>)}/><Route path="account" element={<AccountPage/>}/><Route path="access-denied" element={<AccessDeniedPage/>}/><Route index element={<HomeRoute/>}/>
  <Route path="my-department" element={gate(CAPABILITIES.VIEW_MY_DEPARTMENT,<MyDepartmentPage/>)}/><Route path="my-profile" element={gate(CAPABILITIES.VIEW_MY_PROFILE,<EmployeeRecordPage selfMode/>)}/>
  <Route path="surveillance" element={gateAny(sectionCapabilities('surveillance'),<SurveillanceSectionPage/>)}/><Route path="surveillance/environment/:sampleId" element={gateAny([CAPABILITIES.VIEW_SURVEILLANCE,CAPABILITIES.VIEW_LAB],<LaboratorySampleRecordPage/>)}/><Route path="surveillance/:caseId" element={gateAny([CAPABILITIES.VIEW_SURVEILLANCE,CAPABILITIES.VIEW_LAB],<PatientClinicalRecordRoute/>)}/>
  <Route path="laboratory" element={gate(CAPABILITIES.VIEW_LAB,<LaboratoryPage/>)}/><Route path="laboratory/:sampleId" element={gate(CAPABILITIES.VIEW_LAB,<LaboratorySampleRecordPage/>)}/>
  <Route path="prevention" element={gate(CAPABILITIES.VIEW_PREVENTION,<PreventionPage/>)}/><Route path="prevention/:recordType/:recordId" element={gate(CAPABILITIES.VIEW_PREVENTION,<PreventionRecordPage/>)}/>
  <Route path="controls" element={gate(CAPABILITIES.VIEW_CONTROLS,<ControlsPage/>)}/><Route path="controls/new" element={gate(CAPABILITIES.VIEW_CONTROLS,<ControlCreatePage/>)}/><Route path="controls/:controlId" element={gate(CAPABILITIES.VIEW_CONTROLS,<ControlRecordPage/>)}/>
  <Route path="quality" element={gate(CAPABILITIES.VIEW_QUALITY,<QualityPage/>)}/><Route path="quality/risks/:assessmentCode" element={gate(CAPABILITIES.VIEW_QUALITY,<RiskAssessmentPage/>)}/><Route path="quality/risks/:assessmentCode/opportunities/:opportunityId" element={gate(CAPABILITIES.VIEW_QUALITY,<OpportunityRecordPage/>)}/><Route path="quality/risks/:assessmentCode/:riskKey" element={gate(CAPABILITIES.VIEW_QUALITY,<RiskRecordPage/>)}/><Route path="registers" element={gateAny([CAPABILITIES.VIEW_QUALITY,CAPABILITIES.VIEW_MY_DEPARTMENT],<RegistersPage/>)}/><Route path="registers/new" element={gate(CAPABILITIES.MANAGE_QUALITY,<RegisterCreatePage/>)}/><Route path="registers/:registerId" element={gateAny([CAPABILITIES.VIEW_QUALITY,CAPABILITIES.VIEW_MY_DEPARTMENT],<RegisterRecordPage/>)}/><Route path="registers/:registerId/import" element={gateAny([CAPABILITIES.VIEW_QUALITY,CAPABILITIES.VIEW_MY_DEPARTMENT],<RegisterImportPage/>)}/><Route path="registers/:registerId/entries/:entryId" element={gateAny([CAPABILITIES.VIEW_QUALITY,CAPABILITIES.VIEW_MY_DEPARTMENT],<RegisterEntryPage/>)}/><Route path="meetings/:meetingId" element={gateAny([CAPABILITIES.VIEW_QUALITY,CAPABILITIES.VIEW_MY_DEPARTMENT],<MeetingRecordPage/>)}/><Route path="quality/surveys/:surveyId" element={gateAny([CAPABILITIES.VIEW_QUALITY,CAPABILITIES.VIEW_MY_DEPARTMENT],<SurveyRecordPage/>)}/><Route path="quality/equipment/:equipmentId" element={gateAny([CAPABILITIES.VIEW_QUALITY,CAPABILITIES.VIEW_MY_DEPARTMENT],<EquipmentRecordPage/>)}/><Route path="quality/suppliers/:supplierId" element={gate(CAPABILITIES.VIEW_QUALITY,<SupplierRecordPage/>)}/><Route path="quality/audit-questionnaires" element={gate(CAPABILITIES.VIEW_QUALITY,<AuditQuestionnairesPage/>)}/><Route path="quality/audit-questionnaires/:templateId" element={gate(CAPABILITIES.VIEW_QUALITY,<AuditQuestionnairesPage/>)}/><Route path="quality/reviews/:reviewId" element={gate(CAPABILITIES.VIEW_QUALITY,<ReviewRecordPage/>)}/><Route path="quality/my-reports" element={gateAny([CAPABILITIES.REPORT_INCIDENT,CAPABILITIES.MANAGE_QUALITY],<MyReportsPage/>)}/><Route path="quality/report" element={gateAny([CAPABILITIES.REPORT_INCIDENT,CAPABILITIES.MANAGE_QUALITY],<IncidentReportPage/>)}/><Route path="quality/:recordType/new" element={gate(CAPABILITIES.VIEW_QUALITY,<QualityCreatePage/>)}/><Route path="quality/:recordType/:recordId" element={gate(CAPABILITIES.VIEW_QUALITY,<QualityRecordPage/>)}/>
  <Route path="indicators" element={gateAny([CAPABILITIES.VIEW_INDICATORS,CAPABILITIES.VIEW_EXECUTIVE_DASHBOARD],<IndicatorsRoute/>)}/><Route path="indicators/new" element={gate(CAPABILITIES.MANAGE_INDICATORS,<IndicatorCreatePage/>)}/><Route path="indicators/:indicatorId" element={gate(CAPABILITIES.VIEW_INDICATORS,<IndicatorRecordPage/>)}/>
  <Route path="training" element={gate(CAPABILITIES.VIEW_TRAINING,<TrainingPageRoute/>)}/><Route path="training/new" element={gate(CAPABILITIES.MANAGE_TRAINING,<TrainingCreatePage/>)}/><Route path="training/:programId" element={gate(CAPABILITIES.VIEW_TRAINING,<TrainingPageRoute/>)}/>
  <Route path="committees" element={<SectionRedirect sectionId="meetings" tab="committees"/>}/><Route path="meetings" element={gateAny(sectionCapabilities('meetings'),<MeetingsSectionPage/>)}/><Route path="committees/new" element={gate(CAPABILITIES.CREATE_COMMITTEE,<CommitteeCreatePage/>)}/><Route path="committees/:committeeId" element={<CommitteeRecordPageRoute/>}/>
  <Route path="calendar" element={<CalendarPage/>}/><Route path="legislation" element={<SectionRedirect sectionId="documents" tab="legislation"/>}/><Route path="legislation/library/:textId" element={gate(CAPABILITIES.VIEW_QUALITY,<LegislationEditorPage/>)}/><Route path="legislation/:textId" element={gate(CAPABILITIES.VIEW_QUALITY,<LegislationRecordPage/>)}/><Route path="regulations" element={<SectionRedirect sectionId="documents" tab="regulations"/>}/><Route path="regulations/templates/:templateKey" element={gateAny([CAPABILITIES.VIEW_DOCUMENTS,CAPABILITIES.VIEW_QUALITY],<RegulationTemplatePage/>)}/><Route path="regulations/:regulationId" element={gateAny([CAPABILITIES.VIEW_DOCUMENTS,CAPABILITIES.VIEW_QUALITY],<RegulationPage/>)}/><Route path="documents" element={gateAny(sectionCapabilities('documents'),<DocumentsSectionPage/>)}/><Route path="documents/new" element={gate(CAPABILITIES.MANAGE_DOCUMENTS,<DocumentCreatePage/>)}/><Route path="documents/acknowledgements" element={gate(CAPABILITIES.VIEW_DOCUMENTS,<DocumentAcknowledgementsPage/>)}/><Route path="documents/:documentId" element={gate(CAPABILITIES.VIEW_DOCUMENTS,<DocumentRecordPage/>)}/>
  <Route path="patients" element={<SectionRedirect sectionId="surveillance" tab="registry"/>}/><Route path="patients/new" element={gate(CAPABILITIES.CREATE_PATIENT,<PatientCreatePage/>)}/><Route path="patients/:patientId" element={gate(CAPABILITIES.VIEW_PATIENTS,<PatientClinicalRecordRoute patientMode/>)}/>
  <Route path="employees" element={gate(CAPABILITIES.VIEW_STAFF,<EmployeesPage/>)}/><Route path="employees/new" element={gate(CAPABILITIES.MANAGE_STAFF_ADMIN,<EmployeeCreatePage/>)}/><Route path="employees/:employeeId" element={gate(CAPABILITIES.VIEW_STAFF,<EmployeeRecordPage/>)}/><Route path="interviews" element={gate(CAPABILITIES.VIEW_INTERVIEWS,<InterviewsPage/>)}/><Route path="interviews/:candidateId" element={gate(CAPABILITIES.VIEW_INTERVIEWS,<InterviewRecordPage/>)}/>
  <Route path="kitchen" element={gateAny(KITCHEN_CAPABILITIES,<KitchenPage/>)}/><Route path="kitchen/receipts/:receiptId" element={gateAny(KITCHEN_CAPABILITIES,<KitchenReceiptRecordPage/>)}/><Route path="kitchen/days/:productionId" element={gateAny(KITCHEN_CAPABILITIES,<KitchenDayRecordPage/>)}/>
  <Route path="pharmacy" element={gate(CAPABILITIES.VIEW_PHARMACY,<PharmacyPage/>)}/><Route path="occupational-health" element={gate(CAPABILITIES.VIEW_OCCUPATIONAL_HEALTH,<OccupationalHealthPage/>)}/><Route path="management" element={gateAny(MANAGEMENT_CAPABILITIES,<ManagementPage/>)}/><Route path="recycle-bin" element={<RecycleBinPage/>}/><Route path="*" element={<Navigate to="/" replace/>}/>
 </Route></Route>
 </Routes></>}
