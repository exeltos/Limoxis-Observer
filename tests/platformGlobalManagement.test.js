import { describe,it,expect } from 'vitest'
import fs from 'node:fs'

const migration=fs.readFileSync('supabase/migrations/20260921120000_platform_owner_global_library_propagation.sql','utf8')
const center=fs.readFileSync('src/features/workspaces/PlatformCenterPage.jsx','utf8')
const dashboard=fs.readFileSync('src/features/platform/PlatformDashboardView.jsx','utf8')
const demoRegistry=fs.readFileSync('src/features/platform/PlatformDemosRegistry.jsx','utf8')
const globalManagement=fs.readFileSync('src/features/platform/PlatformGlobalManagement.jsx','utf8')
const managementPage=fs.readFileSync('src/features/management/ManagementPage.jsx','utf8')
const librariesPanel=fs.readFileSync('src/features/management/LibrariesPanel.jsx','utf8')

describe('Platform Owner global (all-hospitals) Central Management',()=>{
  it('lets a global master_library_items row exist and fan out to every organization', () => {
    expect(migration).toContain('alter table public.master_library_items alter column organization_id drop not null')
    expect(migration).toContain('add column if not exists origin_item_id')
    expect(migration).toContain('private.propagate_master_library_global_item')
    expect(migration).toContain("after insert or update or delete on public.master_library_items")
  })

  it('backfills a global row per existing baseline item and links existing organization copies', () => {
    expect(migration).toContain('distinct on (library_key, code)')
    expect(migration).toContain('origin_item_id = new_id')
  })

  it('seeds brand-new organizations from the live global catalog, not just the static baseline', () => {
    expect(migration).toContain('private.seed_system_master_libraries_on_org_create')
    expect(migration).toContain('from public.master_library_items g')
    expect(migration).toContain('where g.organization_id is null')
  })

  it('adds a Central Management entry point reachable without entering a hospital', () => {
    expect(dashboard).toContain("onNavigate('/platform#management')")
    expect(center).toContain("if(activeKey==='management')return <PlatformGlobalManagement")
    expect(globalManagement).toContain('<ManagementPage global onBack={onBack}/>')
  })

  it('renders Page as the outermost element of the global Management view, so its fill/height layout matches every other Platform Center screen', () => {
    expect(managementPage).toMatch(/return <Page fill/)
    expect(globalManagement).not.toContain('platform-registry-shell')
  })

  it('removes the redundant Enter Demo button from the Demo entitlements registry', () => {
    expect(demoRegistry).not.toContain('Είσοδος Demo')
    expect(demoRegistry).not.toContain('onEnterDemo')
    expect(center).not.toContain('onEnterDemo={()=>{enterPlatformDemo();nav(\'/\')}}')
  })

  it('restricts the global Management view to platform-wide tabs and forwards global to child panels', () => {
    expect(managementPage).toContain("if(global)return [{id:'libraries'")
    expect(managementPage).toContain('<LibrariesPanel global={global}/>')
    expect(managementPage).toContain('<IndicatorsPanel global={global}/>')
    expect(managementPage).toContain('<BundleLibraryPanel global={global}/>')
    expect(managementPage).toContain('loadGlobalExternalReferences')
  })

  it('hides the per-hospital departments category from the global Libraries view', () => {
    expect(librariesPanel).toContain("global?categories.filter(([id])=>id!=='departments')")
    expect(librariesPanel).toContain('loadGlobalLibraryItems')
    expect(librariesPanel).toContain('createGlobalLibraryItem')
  })
})
