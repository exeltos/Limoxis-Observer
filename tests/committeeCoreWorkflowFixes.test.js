import { describe,expect,it } from 'vitest'
import fs from 'node:fs'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

const migration=read('supabase/migrations/202609130002_committees_core_workflow_fixes.sql')
const recordPage=read('src/features/committees/CommitteeRecordPage.jsx')

describe('committee core workflow fixes',()=>{
  it('keeps the repository audit trigger compatible with tables that do not expose updated_by',()=>{
    expect(migration).toContain("row_data ? 'updated_by'")
    expect(migration).toContain('jsonb_populate_record')
    expect(migration).not.toContain('new.updated_by')
  })

  it('adds permissive committee attachment policies alongside restrictive guards',()=>{
    expect(migration).toContain('attachments_committee_insert_allow')
    expect(migration).toContain('attachments_committee_read_allow')
    expect(migration).toContain('attachments_committee_update_allow')
    expect(migration).toContain('attachments_storage_committee_insert_allow')
    expect(migration).toContain('attachments_storage_committee_read_allow')
    expect(migration).toContain('attachments_storage_committee_delete_allow')
    expect(migration).toContain('as permissive')
  })

  it('offers governed committee roles while preserving an Other option',()=>{
    for(const role of ['Πρόεδρος','Αντιπρόεδρος','Γραμματέας','Συντονιστής','Μέλος','Αναπληρωματικό μέλος','Εισηγητής','Σύμβουλος','Παρατηρητής']){
      expect(recordPage).toContain(role)
    }
    expect(recordPage).toContain("value=\"__other\"")
  })

  it('uses the compact shared filter pattern for decisions',()=>{
    expect(recordPage).toContain('<FilterBar compact query={q}')
    expect(recordPage).toContain("workflowStatusLabel(x.status,en)")
  })

  it('opens the meeting returned by the create operation',()=>{
    expect(recordPage).toContain("setDialog({type:'meeting',id:result.id||id})")
  })
})
