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

  it('keeps the package version aligned with the latest migration release',()=>{
    const latest=migrations.at(-1)
    const match=latest.match(/_v0(\d{2})(\d+)_[^.]+\.sql$/)
    expect(match).not.toBeNull()
    const expected=`0.${Number(match[1])}.${Number(match[2])}`
    const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'))
    expect(pkg.version).toBe(expected)
  })
})
