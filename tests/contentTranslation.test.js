import { describe, expect, it, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { GLOSSARY, TRANSLATABLE, runTranslations } from '../supabase/functions/_shared/translateContent.ts'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

// A small in-memory stand-in for the Supabase client: the tables the translation job reads and writes.
function fakeAdmin(db, runtime = { provider: 'openai', model: 'm', api_key: 'k' }) {
  const query = table => {
    const state = { filters: [], op: 'select', payload: null, limitTo: null }
    const rows = () => (db[table] ||= []).filter(row => state.filters.every(test => test(row)))
    const api = {
      select: () => api,
      in: (column, values) => { state.filters.push(row => values.includes(row[column])); return api },
      lt: (column, value) => { state.filters.push(row => row[column] < value); return api },
      eq: (column, value) => { state.filters.push(row => row[column] === value); return api },
      order: () => api,
      limit: count => { state.limitTo = count; return api },
      maybeSingle: () => Promise.resolve({ data: rows()[0] || null }),
      update: payload => { state.op = 'update'; state.payload = payload; return api },
      upsert: payload => { (db[table] ||= []); const at = db[table].findIndex(row => ['organization_id', 'entity', 'entity_id', 'field', 'lang'].every(key => row[key] === payload[key])); if (at >= 0) db[table][at] = { ...db[table][at], ...payload }; else db[table].push({ id: `n${db[table].length}`, ...payload }); return Promise.resolve({ error: null }) },
      then: (resolve, reject) => {
        if (state.op === 'update') { rows().forEach(row => Object.assign(row, state.payload)); return Promise.resolve({ error: null }).then(resolve, reject) }
        const found = rows(); return Promise.resolve({ data: state.limitTo ? found.slice(0, state.limitTo) : found, error: null }).then(resolve, reject)
      },
    }
    return api
  }
  return { from: query, rpc: async () => ({ data: runtime ? [runtime] : [] }) }
}
const base = () => ({
  organization_translation_settings: [{ organization_id: 'o1', enabled: true, monthly_char_limit: 1000, used_month: '2000-01-01', used_chars: 0 }],
  translation_jobs: [{ id: 'j1', organization_id: 'o1', entity: 'quality_objectives', entity_id: 'q1', field: 'title', status: 'pending', attempts: 0, updated_at: '2026-01-01' }],
  quality_objectives: [{ id: 'q1', organization_id: 'o1', title: 'Μείωση λοιμώξεων ΜΕΘ', title_en: null }],
  content_translations: [],
})
const answer = text => vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ output_text: text }) })))
afterEach(() => vi.unstubAllGlobals())

describe('automatic translation of institutional texts', () => {
  it('translates an empty English field, keeps a trace and counts the characters', async () => {
    const db = base(); answer('Reduce ICU infections')
    expect(await runTranslations(fakeAdmin(db))).toMatchObject({ translated: 1, failed: 0 })
    expect(db.quality_objectives[0].title_en).toBe('Reduce ICU infections')
    expect(db.content_translations[0]).toMatchObject({ origin: 'auto', field: 'title', text: 'Reduce ICU infections' })
    expect(db.translation_jobs[0].status).toBe('done')
    expect(db.organization_translation_settings[0].used_chars).toBe('Μείωση λοιμώξεων ΜΕΘ'.length)
  })
  it('never replaces an English text that was already there or that a person edited', async () => {
    const db = base(); db.quality_objectives[0].title_en = 'Hand written'; answer('Machine')
    expect(await runTranslations(fakeAdmin(db))).toMatchObject({ translated: 0, skipped: 1 })
    expect(db.quality_objectives[0].title_en).toBe('Hand written')
    const edited = base(); edited.quality_objectives[0].title_en = 'Corrected by a person'
    edited.content_translations.push({ id: 'c1', organization_id: 'o1', entity: 'quality_objectives', entity_id: 'q1', field: 'title', lang: 'en', source_hash: 'x', text: 'Old machine text', origin: 'auto' })
    await runTranslations(fakeAdmin(edited))
    expect(edited.quality_objectives[0].title_en).toBe('Corrected by a person')
    expect(edited.content_translations[0].origin).toBe('human')
  })
  it('does nothing for a hospital that has not turned it on, and waits without a provider or past the limit', async () => {
    const off = base(); off.organization_translation_settings[0].enabled = false; answer('x')
    expect(await runTranslations(fakeAdmin(off))).toMatchObject({ translated: 0, skipped: 1 })
    expect(fetch).not.toHaveBeenCalled()
    const noProvider = base()
    expect(await runTranslations(fakeAdmin(noProvider, null))).toMatchObject({ translated: 0, waiting: 1 })
    expect(noProvider.translation_jobs[0].status).toBe('pending')
    const over = base(); over.organization_translation_settings[0].monthly_char_limit = 5
    expect(await runTranslations(fakeAdmin(over))).toMatchObject({ translated: 0, waiting: 1 })
    expect(over.quality_objectives[0].title_en).toBeNull()
  })
  it('keeps to the allow-list, the glossary and the database triggers', () => {
    expect(Object.keys(TRANSLATABLE)).toEqual(['library_items', 'quality_objectives'])
    expect(Object.keys(TRANSLATABLE.library_items)).toEqual(['description_el', 'summary_el', 'note_el', 'limoxis_note_el'])
    expect(TRANSLATABLE.library_items.description_el.max).toBe(400)
    expect(GLOSSARY.find(([el]) => el === 'ΜΕΘ')[1]).toBe('ICU')
    const migration = read('supabase/migrations/20261231120000_content_translation.sql')
    expect(migration).toContain("private.queue_translation('description_el', 'summary_el', 'note_el', 'limoxis_note_el')")
    expect(migration).toContain("private.queue_translation('title')")
    expect(migration).not.toMatch(/\bdelete\s+from\b|\bdrop\s+(table|policy|function)\b/i)
    expect(migration).toMatch(/enable row level security/)
    expect(read('supabase/functions/platform-scheduled-tasks/index.ts')).toContain("task==='translate_content'")
  })
})
