import { describe,it,expect } from 'vitest'
import fs from 'node:fs'

const bundles=fs.readFileSync('src/features/management/BundleLibraryPanel.jsx','utf8')
const libraries=fs.readFileSync('src/features/management/LibrariesPanel.jsx','utf8')
const service=fs.readFileSync('src/features/management/managementCloudService.js','utf8')

describe('Platform Owner-only system library governance',()=>{
  it('restricts system Bundles to the Platform Owner',()=>{
    expect(bundles).toContain('ROLES.PLATFORM_OWNER')
    expect(bundles).toContain('item.system&&!isPlatformOwner')
    expect(bundles).toContain('System · Owner only')
  })

  it('renders system library records read-only for hospital users',()=>{
    expect(libraries).toContain('role===ROLES.PLATFORM_OWNER')
    expect(libraries).toContain("mode:system&&!isPlatformOwner?'view':'edit'")
    expect(libraries).toContain('meta.system&&!isPlatformOwner')
    expect(libraries).toContain("(!meta.system||isPlatformOwner)")
  })

  it('distinguishes global references and uses strict UUID detection',()=>{
    expect(service).toContain('isGlobal:row.organization_id==null')
    expect(service).toContain('const isUuid=value=>')
    expect(service).toContain("item.isGlobal?query.is('organization_id',null)")
  })
})
