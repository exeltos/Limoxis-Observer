import { describe,expect,it } from 'vitest'
import fs from 'node:fs'
import { roleLabel,SYSTEM_ROLE_KEYS } from '../src/core/permissions/roleLabels.js'

describe('Platform Owner UI audit',()=>{
  it('uses bilingual presentation labels instead of raw database role keys',()=>{
    expect(roleLabel('hospital_admin','el')).toBe('Διαχειριστής Νοσοκομείου')
    expect(roleLabel('occupational_physician','el')).toBe('Ιατρός Εργασίας')
    expect(roleLabel('quality_manager','en')).toBe('Quality Manager')
    expect(SYSTEM_ROLE_KEYS).toContain('link_nurse')
  })

  it('keeps synthetic operational tasks out of production notifications',()=>{
    const source=fs.readFileSync('src/core/notifications/NotificationContext.jsx','utf8')
    expect(source).toContain('demoOperationalText')
    expect(source).toContain('if(!isDemo)return []')
  })

  it('opens organizations as full record workspaces with actions inside general information',()=>{
    const source=fs.readFileSync('src/features/workspaces/PlatformCenterPage.jsx','utf8')
    expect(source).toContain('function openOrganization(org)')
    expect(source).toContain('platform-owner-record-workspace')
    expect(source).toContain('platform-record-intro')
    expect(source).toContain('<PlatformOrganizationActions organization={selectedOrg}')
    expect(source).toContain("orgDetailTab==='details'")
    expect(source).toContain("orgDetailTab==='users'")
    expect(source).toContain("orgDetailTab==='diagnostics'")
    expect(source).toContain("orgDetailTab==='analysis'")
    expect(source).toContain('platform-info-sections')
  })

  it('preserves organization and tab context in navigation history',()=>{
    const source=fs.readFileSync('src/features/workspaces/PlatformCenterPage.jsx','utf8')
    expect(source).toContain('parsePlatformHash')
    expect(source).toContain('organization=${org.id}&tab=details')
    expect(source).toContain('replace:true,state:location.state')
    expect(source).toContain('location.state?.returnTo')
    expect(source).toContain('organization=${selectedOrg.id}&tab=analysis')
  })

  it('presents owner areas as one persistent primary navigation instead of duplicate back flows',()=>{
    const shell=fs.readFileSync('src/app/AppShell.jsx','utf8')
    const page=fs.readFileSync('src/features/workspaces/PlatformCenterPage.jsx','utf8')
    const styles=fs.readFileSync('src/styles/platform-owner-polish.css','utf8')
    expect(shell).toContain('className="platform-primary-nav"')
    expect(shell).toContain("['/platform#organizations','platformOrganizationsNav'")
    expect(shell).toContain("['/platform#demo','platformDemoNav'")
    expect(shell).toContain("['/platform#reports','platformAnalyticsNav'")
    expect(styles).toContain('.platform-primary-nav a.active')
    expect(page).not.toContain("onClick={()=>nav('/platform')}><ArrowLeft")
  })

  it('makes owner registry entries and user rows directly clickable',()=>{
    const source=fs.readFileSync('src/features/workspaces/PlatformCenterPage.jsx','utf8')
    expect(source).toContain('platform-owner-clickable-row')
    expect(source).toContain('onClick={()=>openOrganization(org)}')
    expect(source).toContain('onClick={()=>setSelectedUser(user)}')
    expect(source).not.toContain('>{tx(\'Διαχείριση\',\'Manage\')}</button>')
  })

  it('uses the shared dialog and localized semantic actions in the Platform Owner workspace',()=>{
    const source=fs.readFileSync('src/features/workspaces/PlatformCenterPage.jsx','utf8')
    expect(source).toContain('PlatformOrganizationActions')
    expect(source).toContain('PlatformUserDialog')
    expect(source).toContain('roleLabel(user.role,language)')
    expect(source).toContain('Λειτουργία & συμβάντα')
    expect(source).toContain('platform-form-shell')
    expect(source).not.toContain('footer={<Button variant="secondary" onClick={()=>setSelectedUser(null)}>Κλείσιμο</Button>}')
  })

  it('renders login briefing through the shared ObserverDialog with no duplicate close action',()=>{
    const briefing=fs.readFileSync('src/core/notifications/LoginBriefingDialog.jsx','utf8')
    const shell=fs.readFileSync('src/app/AppShell.jsx','utf8')
    expect(briefing).toContain('<ObserverDialog')
    expect(briefing).toContain('onClose={onClose}')
    expect(briefing).not.toContain('closeBriefing')
    expect(shell).toContain('LoginBriefingDialog')
    expect(shell).toContain('roleLabel(role,language)')
  })

  it('does not add a duplicate cancel button to shared dialog actions by default',()=>{
    const source=fs.readFileSync('src/design-system/ObserverDialog.jsx','utf8')
    expect(source).toContain('showCancel=false')
    expect(source).toContain('showCancel&&onCancel')
  })

  it('mirrors the Indicator private-schema usage fix without granting anon execution',()=>{
    const source=fs.readFileSync('supabase/migrations/20260903090000_indicator_private_schema_usage_grant.sql','utf8')
    expect(source).toContain('grant usage on schema private to authenticated')
    expect(source).toContain('revoke all on function private.indicator_metric_snapshot')
    expect(source).toContain('from public, anon')
  })
})
