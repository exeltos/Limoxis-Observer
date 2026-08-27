import { Page } from '../../design-system/Page'
import { Card } from '../../design-system/Card'
import { useTenant } from '../../core/tenant/TenantContext'
import { ROLES } from '../../core/permissions/roles'

export function MyDepartmentPage(){
  const {membership,role}=useTenant()
  const department=membership?.previewDepartment || membership?.departmentName || 'Το τμήμα μου'
  const isManager=role===ROLES.DEPARTMENT_MANAGER
  return <Page fill title={department} subtitle={isManager?'Τμηματική εικόνα, εκκρεμότητες και ενέργειες που αντιστοιχούν στον ρόλο σας.':'Οι προσωπικές και τμηματικές εργασίες που σας αφορούν.'}>
    <div className="kpi-grid role-kpis">
      <article className="kpi-card"><span>Ενεργές επιτηρήσεις</span><strong>—</strong><small>Μόνο για το τμήμα</small></article>
      <article className="kpi-card"><span>Εκκρεμείς έλεγχοι</span><strong>—</strong><small>Ανατεθειμένες ενέργειες</small></article>
      <article className="kpi-card"><span>Εκπαίδευση</span><strong>—</strong><small>Εκκρεμότητες προσωπικού</small></article>
    </div>
    <div className="workspace-grid"><Card title="Χρειάζεται ενέργεια"><div className="inline-empty">Εδώ εμφανίζονται μόνο εργασίες του τμήματος ή προσωπικές αναθέσεις.</div></Card><Card title="Πρόσβαση"><div className="inline-empty">Δεν εμφανίζονται hospital-wide μητρώα ή ευαίσθητα δεδομένα εργαζομένων χωρίς ειδική αρμοδιότητα.</div></Card></div>
  </Page>
}
