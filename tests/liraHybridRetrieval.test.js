import fs from 'node:fs'
import {describe,expect,it} from 'vitest'
import {withPassages} from '../src/features/lira/LiraAssistantLauncher'

describe('LIRA keyless hybrid retrieval',()=>{
 const sql=fs.readFileSync('supabase/migrations/20261012192152_lira_hybrid_retrieval.sql','utf8')
 const edge=fs.readFileSync('supabase/functions/lira-ai-gateway/index.ts','utf8')
 it('searches approved knowledge under the caller RLS, by words and by meaning',()=>{
  expect(sql).toContain('function public.search_lira_knowledge_hybrid')
  expect(sql).toContain('security invoker')
  expect(sql).toContain("s.status = 'approved'")
  expect(sql).toContain('public.is_org_member(s.organization_id)')
  expect(sql).toContain('extensions.vector(384)')
  expect(sql).toContain('full outer join semantic')
  expect(sql).toMatch(/revoke all on function public\.search_lira_knowledge_hybrid[^;]*from public, anon/)
 })
 it('folds Greek accents and requeues changed chunks for embedding',()=>{
  expect(sql).toContain("'άέήίόύώϊϋΐΰς', 'αεηιουωιυιυσ'")
  expect(sql).toContain("new.embedding_status := 'pending'")
 })
 it('compares embeddings in the queue trigger without the pgvector = operator',()=>{
  // Under an empty search_path the operator is not found and every text edit failed.
  const fix=fs.readFileSync('supabase/migrations/20261012193538_fix_lira_chunk_embedding_queue_compare.sql','utf8')
  expect(fix).toContain('new.embedding::text is not distinct from old.embedding::text')
  expect(fix).toContain("set search_path = ''")
 })
 it('embeds inside the project with the built-in model, never with the provider key',()=>{
  expect(edge).toContain("const EMBEDDING_MODEL='gte-small'")
  expect(edge).toContain('Supabase.ai.Session(EMBEDDING_MODEL)')
  expect(edge).toContain("caller.rpc('search_lira_knowledge_hybrid'")
  expect(edge).not.toMatch(/api\.openai\.com\/v1\/embeddings/)
 })
 it('turns a question the data modules did not recognise into a guidance answer',()=>{
  const passages=[{chunkId:'c1',authority:'CDC',label:'C. difficile',excerpt:'Use a sporicidal agent.'}]
  const generic=withPassages({generic:true,title:'Αξιολόγηση LIRA',points:['signal'],provenance:[{source:'x'}]},passages,false)
  expect(generic.title).toBe('Από τις οδηγίες');expect(generic.points).toEqual([]);expect(generic.passages).toBe(passages)
  const specific=withPassages({title:'CLABSI',points:['3']},passages,false)
  expect(specific.title).toBe('CLABSI');expect(specific.points).toEqual(['3']);expect(specific.passages).toBe(passages)
 })
})
