import { readdirSync, readFileSync } from 'node:fs'
import { URL } from 'node:url'
import { describe, expect, it } from 'vitest'

const migrationsUrl=new URL('../supabase/migrations/',import.meta.url)
const migrations=readdirSync(migrationsUrl).filter(name=>name.endsWith('.sql')).sort()

describe('migration integrity',()=>{
  it('uses each Supabase migration version prefix exactly once',()=>{
    const prefixes=migrations.map(name=>name.split('_',1)[0])
    expect(new Set(prefixes).size).toBe(prefixes.length)
  })

  // Later migrations are no longer named after a release, so the package version
  // (which tests/platformHardening.test.js keeps equal to APP_VERSION) may be newer.
  it('keeps the package version at or after the latest versioned release migration',()=>{
    const versioned=migrations.filter(name=>/_v0(\d{2})(\d+)_[^.]+\.sql$/.test(name))
    expect(versioned.length).toBeGreaterThan(0)
    const latest=versioned.at(-1)
    const match=latest.match(/_v0(\d{2})(\d+)_[^.]+\.sql$/)
    expect(match).not.toBeNull()
    const expected=`0.${Number(match[1])}.${Number(match[2])}`
    const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'))
    const parts=v=>v.split('.').map(Number)
    const [a,b]=[parts(pkg.version),parts(expected)]
    expect(a[0]*1e6+a[1]*1e3+a[2]).toBeGreaterThanOrEqual(b[0]*1e6+b[1]*1e3+b[2])
  })
})
