import { Page } from '../../design-system/Page'
import { Card } from '../../design-system/Card'
import { useTenant } from '../../core/tenant/TenantContext'
import { ROLES } from '../../core/permissions/roles'
import { useLanguage } from '../../core/i18n/LanguageContext'

export function MyDepartmentPage(){
  const {membership,role}=useTenant()
  const {language}=useLanguage();const en=language==='en'
  const department=membership?.previewDepartment || membership?.departmentName || (en?'My department':'Το τμήμα μου')
  const isManager=role===ROLES.DEPARTMENT_MANAGER
  return <Page fill title={department} subtitle={isManager?(en?'Department overview, pending work and actions matching your role.':'Τμηματική εικόνα, εκκρεμότητες και ενέργειες που αντιστοιχούν στον ρόλο σας.'):(en?'Personal and departmental work relevant to you.':'Οι προσωπικές και τμηματικές εργασίες που σας αφορούν.')}>
    <div className="kpi-grid role-kpis">
      <article className="kpi-card"><span>{en?'Active surveillance':'Ενεργές επιτηρήσεις'}</span><strong>—</strong><small>{en?'Department only':'Μόνο για το τμήμα'}</small></article>
      <article className="kpi-card"><span>{en?'Pending controls':'Εκκρεμείς έλεγχοι'}</span><strong>—</strong><small>{en?'Assigned actions':'Ανατεθειμένες ενέργειες'}</small></article>
      <article className="kpi-card"><span>{en?'Training':'Εκπαίδευση'}</span><strong>—</strong><small>{en?'Staff pending items':'Εκκρεμότητες προσωπικού'}</small></article>
    </div>
    <div className="workspace-grid"><Card title={en?'Action required':'Χρειάζεται ενέργεια'}><div className="inline-empty">{en?'Only department tasks or personal assignments appear here.':'Εδώ εμφανίζονται μόνο εργασίες του τμήματος ή προσωπικές αναθέσεις.'}</div></Card><Card title={en?'Access':'Πρόσβαση'}><div className="inline-empty">{en?'Hospital-wide registries or sensitive employee data are not shown without specific authorization.':'Δεν εμφανίζονται hospital-wide μητρώα ή ευαίσθητα δεδομένα εργαζομένων χωρίς ειδική αρμοδιότητα.'}</div></Card></div>
  </Page>
}
