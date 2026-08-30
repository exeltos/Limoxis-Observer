import { BarChart3, Building2, FlaskConical, Settings, ShieldCheck, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { useTenant } from '../../core/tenant/TenantContext'
import { useLanguage } from '../../core/i18n/LanguageContext'

export function PlatformCenterPage(){
  const {memberships,setTenantByMembership}=useTenant(); const {language}=useLanguage(); const nav=useNavigate(); const en=language==='en'
  const sections=[
    ['organizations',Building2,en?'Organizations / Hospitals':'Οργανισμοί / Νοσοκομεία',en?'Create, activate and enter an organization.':'Δημιουργία, ενεργοποίηση και είσοδος σε οργανισμό.'],
    ['users',Users,en?'Users & Hospital Admins':'Χρήστες & Hospital Admins',en?'Platform-level user and administrator management.':'Κεντρική διαχείριση χρηστών και διαχειριστών.'],
    ['demo',FlaskConical,'Demo',en?'Issue demo access or open the demo environment.':'Ενεργοποίηση Demo για τρίτους ή είσοδος στο Demo περιβάλλον.'],
    ['reports',BarChart3,en?'Global Reports':'Global Reports',en?'Cross-organization analytics and comparisons.':'Συγκεντρωτικές αναφορές και συγκρίσεις οργανισμών.'],
    ['governance',ShieldCheck,en?'Audit & Governance':'Audit & Governance',en?'Platform audit trail, entitlements and security.':'Audit trail πλατφόρμας, entitlements και ασφάλεια.'],
    ['settings',Settings,en?'Platform Settings':'Ρυθμίσεις Πλατφόρμας',en?'Global platform configuration.':'Κεντρικές ρυθμίσεις της πλατφόρμας.'],
  ]
  return <Page title={en?'Platform Center':'Κέντρο Πλατφόρμας'} subtitle={en?'Central control of Limoxis Observer. Choose where you want to work.':'Κεντρικός έλεγχος του Limoxis Observer. Επίλεξε πού θέλεις να εργαστείς.'}>
    <div className="platform-center-grid">{sections.map(([key,Icon,title,desc])=><button key={key} className="platform-center-card" onClick={()=>document.getElementById(`platform-${key}`)?.scrollIntoView({behavior:'smooth',block:'start'})}><span><Icon size={20}/></span><strong>{title}</strong><small>{desc}</small></button>)}</div>
    <section id="platform-organizations" className="platform-center-section"><div className="platform-section-heading"><div><h2>{en?'Organizations / Hospitals':'Οργανισμοί / Νοσοκομεία'}</h2><p>{en?'Select an organization to enter the full hospital application with Platform Owner rights.':'Επίλεξε οργανισμό για να μπεις στην πλήρη εφαρμογή του νοσοκομείου με δικαιώματα Platform Owner.'}</p></div><button className="action-button primary">+ {en?'New organization':'Νέος οργανισμός'}</button></div>{memberships.length?<div className="platform-org-list">{memberships.map(m=><button key={m.id} className="platform-org-row" onClick={()=>{setTenantByMembership(m.id);nav('/')}}><span><strong>{m.organization.name}</strong><small>{m.organization.code||'—'} · {m.organization.status||'active'}</small></span><b>{en?'Open organization':'Άνοιγμα οργανισμού'} →</b></button>)}</div>:<div className="empty-state platform-empty"><strong>{en?'No organizations yet':'Δεν υπάρχουν ακόμη οργανισμοί'}</strong><span>{en?'Create the first hospital from Platform Center.':'Δημιούργησε το πρώτο νοσοκομείο από το Κέντρο Πλατφόρμας.'}</span></div>}</section>
    {sections.slice(1).map(([key,Icon,title,desc])=><section id={`platform-${key}`} key={key} className="platform-center-section platform-coming"><Icon size={20}/><div><h2>{title}</h2><p>{desc}</p><small>{en?'Platform workspace — next implementation step.':'Platform workspace — επόμενο βήμα υλοποίησης.'}</small></div></section>)}
  </Page>
}
