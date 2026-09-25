import { describe,expect,it } from 'vitest'
import fs from 'node:fs'
import { roleLabel,SYSTEM_ROLE_KEYS } from '../src/core/permissions/roleLabels.js'

const read=path=>fs.readFileSync(path,'utf8')

describe('Platform Owner UI audit',()=>{
  it('uses bilingual presentation labels instead of raw database role keys',()=>{
    expect(roleLabel('hospital_admin','el')).toBe('Διαχειριστής Νοσοκομείου')
    expect(roleLabel('occupational_physician','el')).toBe('Ιατρός Εργασίας')
    expect(roleLabel('quality_manager','en')).toBe('Quality Manager')
    expect(SYSTEM_ROLE_KEYS).toContain('link_nurse')
  })

  it('keeps synthetic operational tasks out of production notifications',()=>{
    const source=read('src/core/notifications/NotificationContext.jsx')
    expect(source).toContain('demoOperationalText')
    expect(source).toContain('if(!isDemo)return liveOperational')
  })

  it('uses the canonical record shell for organization and demo records',()=>{
    const owner=read('src/features/workspaces/PlatformCenterPage.jsx')
    const organization=read('src/features/platform/PlatformOrganizationRecord.jsx')
    const demo=read('src/features/platform/PlatformDemoRecord.jsx')
    expect(owner).toContain('<PlatformOrganizationRecord')
    expect(organization).toContain('<EntityRecordShell')
    expect(organization).toContain('className="platform-owner-record-shell platform-organization-record-workspace"')
    expect(organization).toContain("eyebrow={tx('ΚΑΡΤΕΛΑ ΟΡΓΑΝΙΣΜΟΥ','ORGANIZATION RECORD')}")
    expect(demo).toContain('<EntityRecordShell')
    expect(demo).toContain('className="platform-owner-record-shell platform-demo-record-workspace"')
  })

  it('keeps root owner registries on the canonical Page, FilterBar and data-table pattern',()=>{
    const source=read('src/features/workspaces/PlatformCenterPage.jsx')
    const registry=read('src/features/platform/PlatformOrganizationsRegistry.jsx')
    expect(registry).toContain('className="platform-registry-shell"')
    expect(registry).toContain('<FilterBar')
    expect(registry).toContain('className="data-table sticky-table"')
    expect(registry).toContain('platform-owner-clickable-row')
    expect(source).not.toContain('className="platform-back-button"')
  })

  it('preserves organization and tab context in navigation history',()=>{
    const source=read('src/features/workspaces/PlatformCenterPage.jsx')
    expect(source).toContain('parsePlatformHash')
    expect(source).toContain('organization=${org.id}&tab=details')
    expect(source).toContain('state:location.state')
    expect(source).toContain('location.state?.returnTo')
    expect(source).toContain('organization=${selectedOrg.id}&tab=${tab}')
  })

  it('marks the organization user record as an owner-shell so its Edit/Save/Delete header actions render directly, not folded into a generic overflow menu',()=>{
    const source=read('src/features/platform/PlatformOrganizationRecord.jsx')
    expect(source).toContain('className="platform-owner-record-shell platform-user-record-shell workspace-fill"')
  })

  it('uses shared record actions and localized role management in the Platform Owner workspace',()=>{
    const source=read('src/features/platform/PlatformOrganizationRecord.jsx')
    expect(source).toContain('<EntityRecordShell')
    expect(source).toContain('className="platform-org-actions"')
    expect(source).toContain('roleLabel(user.role,language)')
    expect(source).toContain("tx('Λειτουργία & Συμβάντα','Activity & Events')")
    expect(source).toContain('platform-form-shell')
    expect(source).toContain("role:'hospital_admin'")
    expect(source).toContain("action:'update'")
    expect(source).toContain('role:userDraft.role||selectedUser.role')
  })

  it('renders Platform reports through the exact same Analysis workspace with platform scope only',()=>{
    const owner=read('src/features/workspaces/PlatformCenterPage.jsx')
    const analysis=read('src/features/analysis/AnalysisPage.jsx')
    expect(owner).toMatch(/<AnalysisPage\s+platform\s+organizations=\{organizations\}\s+forceDemo=\{platformDemoPreview\}\s*\/>/)
    expect(analysis).toContain('export function AnalysisPage({platform=false,organizations=EMPTY_ORGANIZATIONS,forceDemo=false})')
    expect(analysis).toContain('analysis-workspace')
    expect(analysis).toContain('className="analysis-filter-toolbar"')
    expect(analysis).toContain('className="analysis-filter-group analysis-filter-time"')
    expect(analysis).toContain('className="analysis-filter-group analysis-filter-scope"')
    expect(analysis).toContain('analysis-filter-group analysis-filter-compare')
    expect(analysis).toContain('analysis-tabs')
    expect(analysis).toContain('className="analysis-kpis"')
    expect(analysis).toContain("tx('Περιφέρεια','Region')")
    expect(analysis).toContain("tx('Νοσοκομείο','Hospital')")
    expect(analysis).not.toContain('platform-back-button')
  })

  it('keeps owner layout rules out of shared action and navigation stylesheets',()=>{
    const section=(file,name)=>read(file).split(`/* ==== ${name} ==== */`)[1].split('/* ==== ')[0]
    const navigation=section('src/styles/foundation.css','design-system-navigation')
    const actions=section('src/styles/design-system.css','design-system-actions')
    expect(navigation).toContain('.lo-back-button')
    expect(navigation).not.toContain('.platform-owner-users')
    expect(navigation).not.toContain('.platform-org-list')
    expect(actions).not.toContain('.platform-owner-record-workspace')
    expect(actions).not.toContain('.platform-owner-clickable-row')
  })

  it('renders login briefing through the shared ObserverDialog with no duplicate close action',()=>{
    const briefing=read('src/core/notifications/LoginBriefingDialog.jsx')
    const shell=read('src/app/AppShell.jsx')
    expect(briefing).toContain('<ObserverDialog')
    expect(briefing).toContain('onClose={onClose}')
    expect(briefing).not.toContain('closeBriefing')
    expect(shell).toContain('LoginBriefingDialog')
    expect(shell).toContain('roleLabel(role,language)')
  })

  it('does not add a duplicate cancel button to shared dialog actions by default',()=>{
    const source=read('src/design-system/ObserverDialog.jsx')
    expect(source).toContain('showCancel=false')
    expect(source).toContain('showCancel&&onCancel')
  })

  it('mirrors the Indicator private-schema usage fix without granting anon execution',()=>{
    const source=read('supabase/migrations/20260903063445_indicator_private_schema_usage_grant.sql')
    expect(source).toContain('grant usage on schema private to authenticated')
    expect(source).toContain('revoke all on function private.indicator_metric_snapshot')
    expect(source).toContain('from public, anon')
  })
})