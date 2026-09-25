import { useState } from 'react'
import { Activity, Building2, LogIn, Users } from 'lucide-react'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { IconButton } from '../../design-system/IconButton'
import { roleLabel } from '../../core/permissions/roleLabels'
import { demoUsers } from '../management/managementData'

// Read-only counterpart to PlatformOrganizationRecord.jsx for the synthetic
// "Demo Hospital" entry the Platform Owner's demo preview shows in place of
// real organizations. It never calls a backend: everything comes from the
// same demoUsers/demoOrganizations fixtures already used elsewhere in demo
// mode, and the only action is "Enter", which hands off to the real
// enterPlatformDemo() flow (the actual, fully working demo hospital).
const DEMO_DETAILS = Object.freeze({
  city: 'Θεσσαλονίκη',
  region: 'Κεντρική Μακεδονία',
  healthRegion: '4η ΥΠΕ Μακεδονίας και Θράκης',
  contactEmail: 'demo@limoxis-observer.local',
  bedCapacity: 120,
})

function Action({icon,label,title,onClick}){return <div className="platform-org-action-item"><IconButton tone="primary" label={title} onClick={onClick}>{icon}</IconButton><span>{label}</span></div>}

export function PlatformDemoOrganizationRecord({organization,language='el',initialTab='details',onTabChange,onBack,onEnter}){
  const en=language==='en',tx=(elText,enText)=>en?enText:elText
  const [tab,setTab]=useState(['details','users','diagnostics'].includes(initialTab)?initialTab:'details')
  function changeTab(next){setTab(next);onTabChange?.(next)}
  const tabs=[{id:'details',label:tx('Στοιχεία & Ρυθμίσεις','Details & Settings'),icon:Building2},{id:'users',label:`${tx('Χρήστες & Ρόλοι','Users & Roles')} (${demoUsers.length})`,icon:Users},{id:'diagnostics',label:tx('Λειτουργία & Συμβάντα','Activity & Events'),icon:Activity}]
  const actions=<div className="platform-org-actions" aria-label={tx('Ενέργειες οργανισμού','Organization actions')}><Action icon={<LogIn size={18}/>} label={tx('Είσοδος','Enter')} title={tx('Είσοδος στο demo νοσοκομείο','Enter the demo hospital')} onClick={onEnter}/></div>

  return <EntityRecordShell className="platform-owner-record-shell platform-organization-record-workspace" avatar={<Building2 size={20}/>} eyebrow={tx('ΚΑΡΤΕΛΑ ΟΡΓΑΝΙΣΜΟΥ · DEMO','ORGANIZATION RECORD · DEMO')} title={organization.name} subtitle={`${organization.code||'DEMO'} · ${DEMO_DETAILS.city} · ${DEMO_DETAILS.region}`} status={<span className="status-badge temporary">DEMO</span>} headerActions={actions} tabs={tabs} activeTab={tab} onTabChange={changeTab} onBack={onBack} backLabel={tx('Πίσω','Back')}>
    {tab==='details'&&<div className="platform-owner-details platform-organization-record-form">
      <div className="platform-organization-summary-strip">
        <div><span>{tx('Τύπος','Type')}</span><strong>{tx('Νοσοκομείο','Hospital')}</strong></div>
        <div><span>{tx('Χρήστες','Users')}</span><strong>{demoUsers.length}</strong></div>
        <div><span>Hospital Admin</span><strong>1</strong></div>
        <div><span>{tx('Κλίνες','Beds')}</span><strong>{DEMO_DETAILS.bedCapacity}</strong></div>
      </div>
      <div className="details-grid">
        <div><span>{tx('Περιφέρεια','Region')}</span><strong>{DEMO_DETAILS.region}</strong></div>
        <div><span>{tx('Υγειονομική Περιφέρεια (ΥΠΕ)','Health Region')}</span><strong>{DEMO_DETAILS.healthRegion}</strong></div>
        <div><span>{tx('Πόλη','City')}</span><strong>{DEMO_DETAILS.city}</strong></div>
        <div><span>Email</span><strong>{DEMO_DETAILS.contactEmail}</strong></div>
      </div>
      <div className="inline-empty"><strong>{tx('Συνθετικά δεδομένα επίδειξης','Synthetic demo data')}</strong><span>{tx('Αυτός ο οργανισμός δεν αντιστοιχεί σε πραγματικό πελάτη και τα στοιχεία του δεν μπορούν να επεξεργαστούν.','This organization does not correspond to a real customer and its details cannot be edited.')}</span></div>
    </div>}
    {tab==='users'&&<div className="workspace-column workspace-fill">
      <div className="section-toolbar"><div><strong>{tx('Χρήστες & Ρόλοι','Users & Roles')}</strong><span>{tx('Demo χρήστες, μόνο για επίδειξη.','Demo users, for demonstration only.')}</span></div></div>
      <section className="surface registry-workspace workspace-column workspace-fill"><div className="scroll-table"><table className="data-table sticky-table"><thead><tr><th>{tx('Χρήστης','User')}</th><th>Email</th><th>{tx('Ρόλος','Role')}</th><th>{tx('Κατάσταση','Status')}</th></tr></thead><tbody>{demoUsers.map(user=><tr key={user.id}><td><strong>{user.name}</strong></td><td>{user.email}</td><td>{roleLabel(user.role,language)}</td><td><span className="status-badge active">{tx('Ενεργός','Active')}</span></td></tr>)}</tbody></table></div></section>
    </div>}
    {tab==='diagnostics'&&<div className="registry-empty-state"><strong>{tx('Δεν υπάρχουν πραγματικά συμβάντα σε λειτουργία demo.','No real events in demo mode.')}</strong></div>}
  </EntityRecordShell>
}
