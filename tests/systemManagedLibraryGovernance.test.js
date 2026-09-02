import { describe,it,expect } from 'vitest'
import fs from 'node:fs'

const bundles=fs.readFileSync('src/features/management/BundleLibraryPanel.jsx','utf8')
const libraries=fs.readFileSync('src/features/management/LibrariesPanel.jsx','utf8')
const management=fs.readFileSync('src/features/management/ManagementPage.jsx','utf8')
const service=fs.readFileSync('src/features/management/managementCloudService.js','utf8')
const referenceMigration=fs.readFileSync('supabase/migrations/202609020103_platform_owner_system_reference_governance.sql','utf8')
const libraryMigration=fs.readFileSync('supabase/migrations/202609020104_platform_owner_system_library_governance.sql','utf8')

describe('Platform Owner-only system library governance',()=>{
  it('restricts system Bundles to the Platform Owner',()=>{
    expect(bundles).toContain('ROLES.PLATFORM_OWNER')
    expect(bundles).toContain('item.system&&!isPlatformOwner')
    expect(bundles).toContain("System · Owner managed")
    expect(bundles).toContain("System · Μόνο Owner")
  })

  it('renders system library records read-only for hospital users',()=>{
    expect(libraries).toContain('role===ROLES.PLATFORM_OWNER')
    expect(libraries).toContain("mode:system&&!isPlatformOwner?'view':'edit'")
    expect(libraries).toContain('meta.system&&!isPlatformOwner')
    expect(libraries).toContain("(!meta.system||isPlatformOwner)")
  })

  it('hides global reference mutation actions from hospital users',()=>{
    expect(management).toContain('const isPlatformOwner=role===ROLES.PLATFORM_OWNER')
    expect(management).toContain('(!item.isGlobal||isPlatformOwner)')
    expect(management).toContain('referenceEditor?.isGlobal&&!isPlatformOwner')
    expect(management).toContain('item?.isGlobal&&!isPlatformOwner')
  })

  it('distinguishes global references and uses strict UUID detection',()=>{
    expect(service).toContain('isGlobal:row.organization_id==null')
    expect(service).toContain('const isUuid=value=>')
    expect(service).toContain("item.isGlobal?query.is('organization_id',null)")
  })

  it('allows only Platform Owner to mutate global external references',()=>{
    expect(referenceMigration).toContain('external_refs_manage_system_owner')
    expect(referenceMigration).toContain('organization_id is null')
    expect(referenceMigration).toContain('public.current_user_is_platform_owner()')
  })

  it('prevents hospital admins from mutating system master-library rows',()=>{
    expect(libraryMigration).toContain('master_library_items_manage_system_owner')
    expect(libraryMigration).toContain("coalesce(metadata->>'system','false') = 'true'")
    expect(libraryMigration).toContain('public.current_user_is_platform_owner()')
  })
})
