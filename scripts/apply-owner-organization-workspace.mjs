import fs from 'node:fs'

{
  const path='src/features/workspaces/PlatformCenterPage.jsx'
  let s=fs.readFileSync(path,'utf8')
  const marker="import { PlatformDemoRecord } from '../platform/PlatformDemoRecord'\n"
  if(!s.includes("import { PlatformOrganizationRecord }")) s=s.replace(marker,marker+"import { PlatformOrganizationRecord } from '../platform/PlatformOrganizationRecord'\n")
  const root=s.indexOf("  if (activeKey === 'organizations') {")
  const start=s.indexOf("    if (selectedOrg) {",root)
  const end=s.indexOf("\n    return (\n      <>\n        <Page\n          title={tx('Οργανισμοί'",start)
  if(start<0||end<0) throw new Error('Organization record block not found')
  const replacement=`    if (selectedOrg) {
      return (
        <>
          <PlatformOrganizationRecord
            organization={selectedOrg}
            language={language}
            initialTab={orgDetailTab}
            onTabChange={changeOrgTab}
            onBack={returnFromRecord}
            onEnter={() => enterOrganization(selectedOrg)}
            onDelete={() => requestRemoveOrganization(selectedOrg)}
            onChanged={async () => {
              await reloadMemberships()
              await refreshPlatformData()
            }}
            onOpenAnalysis={openOrganizationAnalysis}
          />
          {deleteDialog}
        </>
      )
    }
`
  s=s.slice(0,start)+replacement+s.slice(end)
  fs.writeFileSync(path,s)
}

{
  const path='src/core/tenant/tenantService.js'
  let s=fs.readFileSync(path,'utf8')
  const needle="    .select('id,label,contact_name,contact_email,valid_from,valid_until,status,organization_id,demo_user_id,organization:organizations(id,name,code,is_demo)')\n    .order('valid_until', { ascending: true })"
  if(s.includes(needle)) s=s.replace(needle,"    .select('id,label,contact_name,contact_email,valid_from,valid_until,status,organization_id,demo_user_id,organization:organizations(id,name,code,is_demo)')\n    .neq('status', 'revoked')\n    .order('valid_until', { ascending: true })")
  fs.writeFileSync(path,s)
}

{
  const path='src/features/platform/platformDemoService.js'
  let s=fs.readFileSync(path,'utf8')
  const needle=`  if (entitlementError) {
    await supabase
      .from('organizations')
      .update({ is_demo: true, updated_at: new Date().toISOString() })
      .eq('id', demo.organization_id)
    throw entitlementError
  }

  return organization
}`
  const replacement=`  if (entitlementError) {
    await supabase
      .from('organizations')
      .update({ is_demo: true, updated_at: new Date().toISOString() })
      .eq('id', demo.organization_id)
    throw entitlementError
  }

  if (demo.demo_user_id) {
    const { error: membershipError } = await supabase
      .from('organization_members')
      .update({ role: 'staff_user' })
      .eq('organization_id', demo.organization_id)
      .eq('user_id', demo.demo_user_id)
      .eq('role', 'demo')
    if (membershipError) throw membershipError
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ is_demo: false, demo_entitlement_id: null })
      .eq('id', demo.demo_user_id)
    if (profileError) throw profileError
  }

  return organization
}`
  if(!s.includes(needle)) throw new Error('Demo conversion block not found')
  s=s.replace(needle,replacement)
  fs.writeFileSync(path,s)
}

{
  const path='supabase/functions/create-demo-access/index.ts'
  let s=fs.readFileSync(path,'utf8')
  s=s.replace("const country=String(body.country||'Greece').trim()||'Greece'","const country=String(body.country||'').trim()||null")
  fs.writeFileSync(path,s)
}
