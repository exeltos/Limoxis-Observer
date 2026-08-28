import fs from 'node:fs'
const list=fs.readFileSync('src/features/committees/CommitteesPage.jsx','utf8')
const rec=fs.readFileSync('src/features/committees/CommitteeRecordPage.jsx','utf8')
const app=fs.readFileSync('src/app/App.jsx','utf8')
const tests=[
 ['create dialog from registry',list.includes('CommitteeCreateDialog')&&list.includes('setCreateOpen(true)')],
 ['no committee new route',!app.includes('committees/new')&&!app.includes('CommitteeCreatePage')],
 ['shared create dialog',list.includes('ObserverDialog width="wide"')&&list.includes('observer-form-section')],
 ['member workflow preserved',list.includes('approvalRequired')&&list.includes('memberType')&&list.includes('requestCommitteeApproval')],
 ['shared record buttons',rec.includes('<Button onClick={()=>setModal({type:\'member\'})}')&&rec.includes('<Button onClick={()=>setModal({type:\'newMeeting\'})}')],
 ['shared overview',rec.includes('module-summary-strip')&&rec.includes('details-grid')&&!rec.includes('committee-governance-kpis')],
 ['shared guidance',rec.includes('function Guidance')&&!rec.includes('committee-guidance-card')],
 ['shared employee source',list.includes("from '../employees/employeeStore'")&&rec.includes("from '../employees/employeeStore'")]
]
for(const [n,ok] of tests){if(!ok){console.error('FAIL',n);process.exit(1)}console.log('✓',n)}
console.log(`v0.26.15 committees smoke passed: ${tests.length}/${tests.length}`)
