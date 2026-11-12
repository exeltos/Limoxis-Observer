import { describe, expect, it } from 'vitest'
import { readSource } from './helpers/readSource'

const sql = readSource('supabase/migrations/20261231480000_fm_fill_nicu_blanks.sql')
const body = sql.replace(/--[^\n]*/g, '')

describe('NICU register: blanks of existing newborns are filled from FileMaker', () => {
  it('matches by case number and admission date, and fills only empty fields of unlocked entries', () => {
    expect(body).toContain("i.case_number = s.data->>'ΑΡΙΘΜΟΣ ΠΕΡΙΣΤΑΤΙΚΟΥ'")
    expect(body).toContain("r.admission_date::text = s.data->>'ΗΜΕΡΟΜΗΝΙΑ ΕΙΣΑΓΩΓΗΣ ΜΕΝΝ'")
    expect(body).toContain('not coalesce(r.locked, false)')
    for (const column of ['discharge_date', 'outcome', 'apgar_1', 'apgar_5', 'discharge_weight', 'breast_milk', 'ventilator_days']) {
      expect(body).toContain(`${column} = coalesce(r.${column}, v.${column})`)
      expect(body).toContain(`r.${column} is null and v.${column} is not null`)
    }
  })
  it('never deletes, and the nightly sync runs it after the creation step', () => {
    expect(/\bdelete\s+from\b|\btruncate\b|\bdrop\s+/i.test(body)).toBe(false)
    expect(body).toMatch(/\+ private\.fm_sync_nicu\(\)\s*\+ private\.fm_fill_nicu\(\);/)
  })
})
