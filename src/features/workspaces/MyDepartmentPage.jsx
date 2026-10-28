import { useTenant } from '../../core/tenant/TenantContext'
import { ROLES } from '../../core/permissions/roles'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { DashboardPage } from '../dashboard/DashboardPage'

// Department home: same layout as the role dashboards (priority work and
// announcements); the manager's tiles count the department, never the whole organization.
export function MyDepartmentPage(){
  const {membership,role,isDemo}=useTenant()
  const {language}=useLanguage();const en=language==='en'
  const department=membership?.previewDepartment || membership?.departmentName || (en?'My department':'Το τμήμα μου')
  const isManager=role===ROLES.DEPARTMENT_MANAGER
  // The manager's and the Link Nurse's tiles count the department only: in the Demo its sample department, in a hospital the departments of the membership.
  const departmentCounts=(isManager||role===ROLES.LINK_NURSE)&&(isDemo?Boolean(membership?.previewDepartment):Boolean(membership?.departmentIds?.length))
  return <DashboardPage showKpis={departmentCounts} department={isDemo?membership?.previewDepartment||null:null} title={department} subtitle={isManager?(en?'Department overview, pending work and actions matching your role.':'Τμηματική εικόνα, εκκρεμότητες και ενέργειες που αντιστοιχούν στον ρόλο σας.'):(en?'Personal and departmental work relevant to you.':'Οι προσωπικές και τμηματικές εργασίες που σας αφορούν.')}/>
}
