import fs from 'node:fs'
const p='src/features/platform/PlatformOrganizationRecord.jsx'
let s=fs.readFileSync(p,'utf8')
s=s.replaceAll('setSelectedUserId(user.userId)','setSelectedUserId(current=>current===user.userId?\'\':user.userId)')
fs.writeFileSync(p,s)
