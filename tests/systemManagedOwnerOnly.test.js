import { describe,it,expect } from 'vitest'
import fs from 'node:fs'

const bundles=fs.readFileSync('src/features/management/BundleLibraryPanel.jsx','utf8')

describe('system-managed library governance',()=>{
  it('restricts system Bundle management to Platform Owner',()=>{
    expect(bundles).toContain("role===ROLES.PLATFORM_OWNER")
    expect(bundles).toContain('item.system&&!isPlatformOwner')
    expect(bundles).toContain('Only the Platform Owner can modify this system item.')
  })

  it('opens protected system Bundles read-only for hospital users',()=>{
    expect(bundles).toContain('readOnly:true')
    expect(bundles).toContain('System · Μόνο Owner')
    expect(bundles).toContain('Μόνο ο Platform Owner μπορεί να το τροποποιήσει ή να το διαγράψει.')
  })
})
