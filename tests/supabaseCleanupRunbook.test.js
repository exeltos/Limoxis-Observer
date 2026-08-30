import { readFileSync } from 'node:fs'
import { URL } from 'node:url'
import { describe,expect,it } from 'vitest'

const inventory=readFileSync(new URL('../supabase/maintenance/00_preflight_inventory.sql',import.meta.url),'utf8')

describe('Supabase cleanup preflight',()=>{
  it('is read-only and inventories every destructive dependency category',()=>{
    const executable=inventory.split('\n').filter(line=>!line.trim().startsWith('--')).join('\n')
    expect(executable).not.toMatch(/\b(drop|truncate|delete|update|insert|alter|create)\b/i)
    for(const catalogue of ['pg_class','pg_policies','pg_proc','information_schema.triggers','pg_constraint','storage.buckets','supabase_migrations.schema_migrations']){
      expect(inventory).toContain(catalogue)
    }
    expect(executable).not.toContain('from supabase_migrations.schema_migrations')
    expect(inventory).toContain("to_regclass('supabase_migrations.schema_migrations')")
  })

  it('captures function overload identity and RLS expressions',()=>{
    expect(inventory).toContain('pg_get_function_identity_arguments')
    expect(inventory).toContain('using_expression')
    expect(inventory).toContain('check_expression')
  })
})
