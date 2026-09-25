import { useTenant } from '../../core/tenant/TenantContext'
import { ROLES } from '../../core/permissions/roles'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { DashboardPage } from '../dashboard/DashboardPage'

// Department home: same layout as the role dashboards (priority work and
// announcements), without organization-wide counts or registries.
export function MyDepartmentPage(){
  const {membership,role}=useTenant()
  const {language}=useLanguage();const en=language==='en'
  const department=membership?.previewDepartment || membership?.departmentName || (en?'My department':'Το τμήμα μου')
  const isManager=role===ROLES.DEPARTMENT_MANAGER
  return <DashboardPage showKpis={false} title={department} subtitle={isManager?(en?'Department overview, pending work and actions matching your role.':'Τμηματική εικόνα, εκκρεμότητες και ενέργειες που αντιστοιχούν στον ρόλο σας.'):(en?'Personal and departmental work relevant to you.':'Οι προσωπικές και τμηματικές εργασίες που σας αφορούν.')}/>
}
