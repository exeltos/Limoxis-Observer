import fs from 'node:fs'
import { describe,expect,it } from 'vitest'

const migration=fs.readFileSync('supabase/migrations/20260922190000_lira_knowledge_foundation.sql','utf8')

describe('LIRA governed knowledge foundation',()=>{
 it('enables pgvector and creates governed source/chunk tables',()=>{
  expect(migration).toContain('create extension if not exists vector with schema extensions')
  expect(migration).toContain('create table if not exists public.lira_knowledge_sources')
  expect(migration).toContain('create table if not exists public.lira_knowledge_chunks')
 })
 it('requires approved provenance for global retrieval',()=>{
  expect(migration).toContain("organization_id is null and status = 'approved'")
  expect(migration).toContain("s.status = 'approved'")
  expect(migration).toContain('source_version text')
  expect(migration).toContain('source_url text')
 })
 it('keeps semantic retrieval permission-aware and security-invoker',()=>{
  expect(migration).toContain('create or replace function public.match_lira_knowledge')
  expect(migration).toContain('security invoker')
  expect(migration).toContain('public.is_org_member(s.organization_id)')
  expect(migration).toContain('revoke all on function public.match_lira_knowledge')
 })
 it('enables RLS and does not grant anonymous knowledge access',()=>{
  expect(migration).toContain('alter table public.lira_knowledge_sources enable row level security')
  expect(migration).toContain('alter table public.lira_knowledge_chunks enable row level security')
  expect(migration).toContain('revoke all on public.lira_knowledge_sources from anon')
  expect(migration).toContain('revoke all on public.lira_knowledge_chunks from anon')
 })
})
