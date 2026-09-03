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

  it('uses the shared dialog and semantic icon actions in the Platform Owner workspace',()=>{
    const source=fs.readFileSync('src/features/workspaces/PlatformCenterPage.jsx','utf8')
    expect(source).toContain('PlatformOrganizationActions')
    expect(source).toContain('PlatformUserDialog')
    expect(source).toContain('roleLabel(user.role,language)')
    expect(source).toContain('Λειτουργία & συμβάντα')
    expect(source).not.toContain('footer={<Button variant="secondary" onClick={()=>setSelectedUser(null)}>Κλείσιμο</Button>}')
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
