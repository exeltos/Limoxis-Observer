import { useMemo, useState } from 'react'
import { Download, Printer, BarChart3 } from 'lucide-react'
import { useTenant } from '../../core/tenant/TenantContext'
import { ROLES } from '../../core/permissions/roles'

const KPI={overview:[['HAI / 1.000 κλινοημέρες','3,5'],['MDR/XDR rate','12,4%'],['Υγιεινή χεριών','88%'],['DDD / 1.000 κλινοημέρες','58'],['Bundle compliance','91%'],['Έλεγχοι στην ώρα τους','95%']]}

export function AnalysisPage({platform=false,organizations=[]}){
 const {tenant,role}=useTenant(); const [tab]=useState('overview')
 const regions=useMemo(()=>[...new Set(organizations.map(o=>o.region).filter(Boolean))],[organizations])
 const allowed=[ROLES.PLATFORM_OWNER,ROLES.HOSPITAL_ADMIN,ROLES.INFECTION_CONTROL_LEAD,ROLES.DEMO].includes(role)
 if(!allowed)return <div className="empty-state"><strong>Δεν υπάρχει πρόσβαση στην Ανάλυση.</strong></div>
 if(platform&&organizations.length===0)return <div className="analysis-workspace"><div className="analysis-header"><div><span className="eyebrow">ANALYTICS & REPORTING</span><h1>Ανάλυση</h1><p>Συγκεντρωτική και συγκριτική εικόνα πλατφόρμας · μόνο πραγματικά δεδομένα οργανισμών.</p></div></div><div className="empty-state platform-empty"><BarChart3 size={24}/><strong>Δεν υπάρχουν δεδομένα οργανισμών</strong><span>Η ανάλυση της πλατφόρμας θα ενεργοποιηθεί όταν δημιουργηθεί ο πρώτος πραγματικός οργανισμός. Τα Demo δεδομένα παραμένουν απομονωμένα και δεν συμμετέχουν στα KPIs.</span></div></div>
 const rows=KPI[tab]||KPI.overview
 return <div className="analysis-workspace"><div className="analysis-header"><div><span className="eyebrow">ANALYTICS & REPORTING</span><h1>Ανάλυση</h1><p>{platform?'Συγκεντρωτική και συγκριτική εικόνα πλατφόρμας':tenant?.name||'Οργανισμός'} · δείκτες και reports.</p></div><div className="analysis-actions"><button className="icon-button" title="Print" aria-label="Print" onClick={()=>window.print()}><Printer size={16}/></button><button className="icon-button" title="Export CSV" aria-label="Export CSV" disabled><Download size={16}/></button></div></div><div className="analysis-kpi-grid">{rows.map(([label,value])=><article className="analysis-kpi-card" key={label}><span>{label}</span><strong>{value}</strong></article>)}</div>{platform&&<small>{organizations.length} οργανισμοί · {regions.length} περιφέρειες</small>}</div>
}
