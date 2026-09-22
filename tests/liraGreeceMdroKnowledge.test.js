import fs from 'node:fs'
import {describe,expect,it} from 'vitest'
describe('LIRA Greece-aware MDRO knowledge',()=>{const sql=fs.readFileSync('supabase/migrations/20260923030000_lira_greece_mdro_knowledge.sql','utf8')
it('adds EODY Candida auris guidance under review',()=>{expect(sql).toContain("'ΕΟΔΥ'");expect(sql).toContain("'candida-auris-greece'");expect(sql).toContain("'review_required',true")})
it('adds dated WHO CRO guidance and implementation manual',()=>{expect(sql).toContain("'dated_guidance',true");expect(sql).toContain('CRAB');expect(sql).toContain('CRPsA');expect(sql).toContain('WHO-UHC-SDS-2019-6')})
it('keeps colonization distinct from infection',()=>{expect(sql).toContain('Αποικισμός και ενεργός λοίμωξη είναι διαφορετικές καταστάσεις');expect(sql).toContain('δεν πρέπει να μετατρέπει αποτέλεσμα αποικισμού σε διάγνωση λοίμωξης')})
it('does not auto approve new knowledge',()=>{expect(sql).not.toMatch(/set\s+status\s*=\s*'approved'/i)})})
