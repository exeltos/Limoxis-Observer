import fs from 'node:fs'
const p='src/features/employees/EmployeeRecordPage.jsx'
let s=fs.readFileSync(p,'utf8')
const old=`    if(identityEmail){const byEmail=employeeRows.find(x=>(x.email||'').trim().toLowerCase()===identityEmail);if(byEmail)return byEmail}\n    if(isDemo)return employeeRows.find(x=>x.id==='EMP-001')||employeeRows[0]||null\n    return null\n`
const neu=`    if(identityEmail){const byEmail=employeeRows.find(x=>(x.email||'').trim().toLowerCase()===identityEmail);if(byEmail)return byEmail}\n    const platformOwner=Boolean(profile?.isPlatformOwner||profile?.is_platform_owner)\n    if(platformOwner){\n      const fullName=profile?.fullName||profile?.full_name||user?.user_metadata?.full_name||user?.email||'Platform Owner'\n      const parts=String(fullName).trim().split(/\\s+/).filter(Boolean)\n      const firstName=parts[0]||'Platform'\n      const lastName=parts.slice(1).join(' ')||'Owner'\n      return {\n        id:'PLATFORM-OWNER',dbId:null,userId:profile?.id||user?.id||null,\n        firstName,lastName,firstNameEn:firstName,lastNameEn:lastName,\n        email:profile?.contactEmail||profile?.email||user?.email||'',\n        profession:'Platform Owner',professionEn:'Platform Owner',\n        department:'Πλατφόρμα',departmentEn:'Platform',\n        employmentStatus:'active',hireDate:'',employeeCode:'PLATFORM-OWNER',\n      }\n    }\n    if(isDemo)return employeeRows.find(x=>x.id==='EMP-001')||employeeRows[0]||null\n    return null\n`
if(!s.includes(old))throw new Error('selfEmployee anchor not found')
s=s.replace(old,neu)
s=s.replace(`    {selfMode&&<SelfAccountSummary profile={profile} user={user} role={role} membership={membership} tenant={tenant} language={language}/>}\n`,``)
fs.writeFileSync(p,s)
