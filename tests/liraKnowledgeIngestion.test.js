import fs from 'node:fs'
import {describe,expect,it} from 'vitest'
import {chunkLiraKnowledge,validateLiraIngestion} from '../src/features/lira/liraKnowledgeIngestion'

describe('LIRA knowledge ingestion',()=>{
 it('chunks content while preserving citation context',()=>{
  const chunks=chunkLiraKnowledge([{id:'sec-1',heading:'Case definition',content:'A'.repeat(3000),citationLabel:'Section 4',pageStart:12,pageEnd:13}],{maxChars:1200,overlapChars:100})
  expect(chunks.length).toBeGreaterThan(2)
  expect(chunks[0]).toMatchObject({chunk_index:0,heading:'Case definition',citation_label:'Section 4',page_start:12,page_end:13})
  expect(chunks.every(x=>x.content.length<=1200)).toBe(true)
 })
 it('requires governed source metadata before ingestion',()=>{
  expect(validateLiraIngestion({id:'s1',status:'review',authority:'ECDC',source_version:'2.3'},[{content:'ok'}]).ok).toBe(true)
  expect(validateLiraIngestion({id:'s1',status:'draft',authority:'ECDC'},[]).ok).toBe(false)
 })
 it('keeps database ingestion permission-aware and embedding-provider neutral',()=>{
  const migration=fs.readFileSync('supabase/migrations/20260922220000_lira_knowledge_ingestion.sql','utf8')
  expect(migration).toContain('security invoker')
  expect(migration).toContain("current_user_has_capability(v_source.organization_id,'manage_libraries')")
  expect(migration).toContain("embedding_status text not null default 'pending'")
  expect(migration).not.toMatch(/openai|gemini|anthropic/i)
 })
})
