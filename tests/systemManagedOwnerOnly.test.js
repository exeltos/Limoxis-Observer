// System (platform-wide) entries are editable only on the platform screen
// (ManagementPage global), which requires VIEW_PLATFORM (Platform Owner only).
// Inside a hospital the Platform Owner has the Hospital Administrator's view.
import { describe,it,expect } from 'vitest'
import fs from 'node:fs'

const bundles=fs.readFileSync('src/features/management/BundleLibraryPanel.jsx','utf8')

describe('system-managed library governance',()=>{
  it('restricts system Bundle management to Platform Owner',()=>{
    expect(bundles).toContain("const isPlatformOwner=global")
    expect(bundles).toContain('item.system&&!isPlatformOwner')
    expect(bundles).toContain('Only the Platform Owner can modify this system item.')
  })

  it('opens protected system Bundles read-only for hospital users',()=>{
    expect(bundles).toContain('const readOnly=(item.system&&!isPlatformOwner)||immutable')
    expect(bundles).toContain('setSelected({...clone(item),readOnly})')
    expect(bundles).toContain('Σύστημα · Μόνο ιδιοκτήτης')
    expect(bundles).toContain('Μόνο ο Platform Owner μπορεί να το τροποποιήσει ή να το διαγράψει.')
  })
})
