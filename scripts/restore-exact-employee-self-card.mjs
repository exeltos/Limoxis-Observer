import fs from 'node:fs'

const p='src/features/employees/EmployeeRecordPage.jsx'
let s=fs.readFileSync(p,'utf8')

const before=s

s=s.replace(
  "return <Page fill title={selfMode?t('employeesRecords.myProfile'):name} subtitle={selfMode?t('employeesRecords.myEmployeeRecordSubtitle'):t('employeesRecords.employeeFullRecordSubtitle')}>",
  "return <Page fill title={name} subtitle={t('employeesRecords.employeeFullRecordSubtitle')}>"
)

s=s.replace(/\n\s*\{selfMode&&<SelfAccountSummary[^\n]*\}\n/, '\n')
s=s.replace(/\n\s*\{selfMode&&pendingCommitteeApprovals\.length>0&&<div className="committee-approval-banner"[^\n]*\}\n/, '\n')

if(s===before){
  throw new Error('No profile-only wrapper markup found to remove; refusing silent patch.')
}

fs.writeFileSync(p,s)
