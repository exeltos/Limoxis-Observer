import { strict as assert } from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { CAPABILITIES, ROLES, can } from '../src/core/permissions/roles.js'

const root=path.resolve('src/features')
const files=[]
function walk(dir){
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const full=path.join(dir,entry.name)
  if(entry.isDirectory())walk(full)
  else if(/\.(js|jsx|ts|tsx)$/.test(entry.name))files.push(full)
 }
}
walk(root)

const referenced=new Set()
for(const file of files){
 const text=fs.readFileSync(file,'utf8')
 for(const match of text.matchAll(/CAPABILITIES\.([A-Z0-9_]+)/g))referenced.add(match[1])
}
// Occupational health (medical visits + vaccinations) is the one clinical
// domain reserved for the occupational physician role even from Hospital
// Admin — see supabase/migrations/20260919120000_restrict_hospital_admin_occupational_health.sql.
const hospitalAdminReserved=new Set(['VIEW_PLATFORM','MANAGE_PLATFORM','VIEW_OCCUPATIONAL_HEALTH','MANAGE_OCCUPATIONAL_HEALTH'])
const missing=[...referenced].filter(key=>!hospitalAdminReserved.has(key)&&!can(ROLES.HOSPITAL_ADMIN,CAPABILITIES[key]))
assert.deepEqual(missing,[],`Hospital Admin missing feature capabilities: ${missing.join(', ')}`)
const policyText=fs.readFileSync(path.resolve('src/core/permissions/roleUxPolicy.js'),'utf8')
assert.match(policyText,/\[ROLES\.HOSPITAL_ADMIN\]: \{ scope: SCOPES\.ORGANIZATION, sensitiveEmployeeHealth: true/)
assert.equal(can(ROLES.HOSPITAL_ADMIN,CAPABILITIES.MANAGE_PLATFORM),false)
assert.equal(can(ROLES.HOSPITAL_ADMIN,CAPABILITIES.MANAGE_OCCUPATIONAL_HEALTH),false)
console.log(`Hospital Admin full-access check passed: ${referenced.size} feature capabilities audited; platform scope and occupational health remain reserved.`)
