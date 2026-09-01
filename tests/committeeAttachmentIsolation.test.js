import { describe,expect,it } from 'vitest'
import fs from 'node:fs'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

describe('committee attachment isolation',()=>{
  it('excludes committee documents from generic metadata policies',()=>{
    const sql=read('supabase/migrations/202609010039_v0309_committee_attachment_policy_isolation.sql')
    expect(sql).toContain("entity_type <> 'committee_document'")
    expect(sql).toContain('drop policy if exists attachments_read')
    expect(sql).toContain('drop policy if exists attachments_write')
    expect(sql).toContain('drop policy if exists attachments_soft_delete')
  })

  it('excludes committee documents from generic storage policies',()=>{
    const sql=read('supabase/migrations/202609010039_v0309_committee_attachment_policy_isolation.sql')
    expect(sql).toContain("coalesce((storage.foldername(name))[2], '') <> 'committee_document'")
    expect(sql).toContain('drop policy if exists attachments_bucket_read')
    expect(sql).toContain('drop policy if exists attachments_bucket_upload')
    expect(sql).toContain('drop policy if exists attachments_bucket_delete')
  })

  it('keeps committee-specific guards in the governance migration',()=>{
    const sql=read('supabase/migrations/202609010031_v0301_committee_visibility_and_function_acl_hardening.sql')
    expect(sql).toContain('attachments_committee_read_guard')
    expect(sql).toContain('attachments_storage_committee_read_guard')
  })
})
