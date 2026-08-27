import { ArrowRight, ShieldCheck } from 'lucide-react'
import { Card } from '../../design-system/Card'
import { Page } from '../../design-system/Page'
import { useTenant } from '../../core/tenant/TenantContext'
import { workspaceFor } from '../workspaces/workspaceConfig'

export function DashboardPage() {
  const { role, tenant } = useTenant()
  const workspace = workspaceFor(role)
  return <Page title={workspace.title} subtitle={workspace.subtitle}>
    {workspace.kpis.length > 0 && <div className="kpi-grid role-kpis">{workspace.kpis.map(([label, value]) => <article className="kpi-card" key={label}><span>{label}</span><strong>{value}</strong><small>{tenant?.name ?? 'Limoxis Observer'}</small></article>)}</div>}
    <div className="workspace-grid">
      <Card title="Χρειάζεται ενέργεια"><div className="task-list">{workspace.tasks.map((task, index) => <button className="task-row" key={task}><span className={`priority ${index === 0 ? 'high' : 'medium'}`}/><span className="task-copy"><strong>{task}</strong><small>Η ορατότητα προκύπτει από ρόλο, scope και ανάθεση.</small></span><ArrowRight size={17}/></button>)}</div></Card>
      <Card title="Access context"><div className="context-card"><ShieldCheck size={19}/><div><strong>Least privilege workspace</strong><span>Οι ενότητες και οι ενέργειες φιλτράρονται κεντρικά. Το backend/RLS παραμένει η τελική γραμμή ελέγχου.</span></div></div></Card>
    </div>
  </Page>
}
