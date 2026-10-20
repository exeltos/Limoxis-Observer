// Ανάγνωση και αποθήκευση του επιδημιολογικού ερωτηματολογίου (ένα ανά επεισόδιο) και των
// τοπικών ρυθμίσεων των ερωτήσεων. Το demo κρατά τα δεδομένα στη μνήμη της συνεδρίας· η παραγωγή
// μιλά στους πίνακες surveillance_case_questionnaires και epi_questionnaire_question_settings
// (RLS + module gate). Το demo δεν χρησιμοποιείται ποτέ σιωπηλά στην παραγωγή.
import { supabase } from '../../../core/supabase/client'
import { isEmptyPreview } from '../../../core/preview/emptyPreview'
import { EPI_ANSWER, EPI_SOURCE, cleanAnswers, coreOnly, epiDefinitionVersion } from './epiQuestionnaireModel'

const COLUMNS = 'id,surveillance_case_id,definition_version,answers,prefilled,core_complete,answered_by,answered_at,updated_by,updated_at'
const mapRow = row => ({
  id: row.id,
  caseId: row.surveillance_case_id,
  definitionVersion: row.definition_version || 1,
  answers: row.answers && typeof row.answers === 'object' ? row.answers : {},
  prefilled: row.prefilled && typeof row.prefilled === 'object' ? row.prefilled : {},
  coreComplete: Boolean(row.core_complete),
  answeredBy: row.answered_by || '',
  answeredAt: row.answered_at || '',
  updatedBy: row.updated_by || '',
  updatedAt: row.updated_at || '',
})

const yes = (detail = '', src = EPI_SOURCE.PREFILL) => ({ a: EPI_ANSWER.YES, detail, src })
const no = (src = EPI_SOURCE.MANUAL) => ({ a: EPI_ANSWER.NO, detail: '', src })
const unknown = () => ({ a: EPI_ANSWER.UNKNOWN, detail: '', src: EPI_SOURCE.MANUAL })
const stamp = daysAgo => new Date(Date.now() - daysAgo * 86400000).toISOString()

// Demo: a few episodes with answered and unanswered questionnaires (the others show «Ερωτηματολόγιο: εκκρεμεί»).
function demoSeed() {
  if (isEmptyPreview()) return {}
  const row = (caseId, answers, daysAgo, by) => ({ id: `EPQ-${caseId}`, caseId, definitionVersion: 1, answers, prefilled: {}, coreComplete: true, answeredBy: by, answeredAt: stamp(daysAgo), updatedBy: by, updatedAt: stamp(daysAgo) })
  return {
    // Hospital origin, three risk factors: the full questionnaire, with prefilled lines.
    'SUR-260041': row('SUR-260041', {
      antibiotics_90d: yes('Ceftazidime/avibactam', EPI_SOURCE.PREFILL),
      icu_stay: yes('', EPI_SOURCE.PREFILL),
      transfer_from_facility: yes('Γ.Ν. Πατρών', EPI_SOURCE.MANUAL),
      other_admission_90d: no(),
      invasive_device_48h: yes('Κεντρικός φλεβικός καθετήρας', EPI_SOURCE.PREFILL),
      surgery_30d: no(),
      dialysis: unknown(),
      known_mdro: no(),
      immunosuppression_30d: no(),
      ltcf_residence: no(),
      abroad_12m: unknown(),
    }, 1, 'Μαρία Κ.'),
    // Core answered only, no risk factors.
    'SUR-260039': row('SUR-260039', { antibiotics_90d: no(), icu_stay: no(), transfer_from_facility: no() }, 3, 'Α. Νικολάου'),
    // Core answered with «Άγνωστο» (allowed).
    'SUR-260036': row('SUR-260036', { antibiotics_90d: unknown(), icu_stay: no(), transfer_from_facility: unknown(), known_mdro: yes('MRSA, 2025', EPI_SOURCE.MANUAL) }, 6, 'Δ. Παπαδάκη'),
    // Started but the core is not complete: still pending.
    'SUR-260023': { id: 'EPQ-SUR-260023', caseId: 'SUR-260023', definitionVersion: 1, answers: { icu_stay: yes('', EPI_SOURCE.MANUAL) }, prefilled: {}, coreComplete: false, answeredBy: 'Μαρία Κ.', answeredAt: stamp(2), updatedBy: 'Μαρία Κ.', updatedAt: stamp(2) },
  }
}
const demoRows = new Map(Object.entries(demoSeed()))
const demoSettings = new Map()

const needsCloud = organizationId => Boolean(supabase && organizationId)

// { [caseKey]: row } for the given episodes (their ids as the page uses them: the demo code, the record id in production).
export async function loadEpiQuestionnaires(organizationId, caseIds = [], { isDemo = false } = {}) {
  const ids = [...new Set((caseIds || []).filter(Boolean).map(String))]
  if (isDemo) return Object.fromEntries(ids.filter(id => demoRows.has(id)).map(id => [id, demoRows.get(id)]))
  if (!needsCloud(organizationId) || !ids.length) return {}
  const out = {}
  for (let index = 0; index < ids.length; index += 100) {
    const { data, error } = await supabase.from('surveillance_case_questionnaires').select(COLUMNS).eq('organization_id', organizationId).in('surveillance_case_id', ids.slice(index, index + 100))
    if (error) throw error
    for (const row of data || []) out[row.surveillance_case_id] = mapRow(row)
  }
  return out
}

// Every questionnaire of the hospital: the episode lists show «Ερωτηματολόγιο: εκκρεμεί» from it.
export async function loadAllEpiQuestionnaires(organizationId, { isDemo = false } = {}) {
  if (isDemo) return Object.fromEntries(demoRows)
  if (!needsCloud(organizationId)) return {}
  const out = {}
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('surveillance_case_questionnaires').select(COLUMNS).eq('organization_id', organizationId).order('id').range(from, from + 999)
    if (error) throw error
    for (const row of data || []) out[row.surveillance_case_id] = mapRow(row)
    if (!data || data.length < 1000) break
  }
  return out
}

// Saves the whole questionnaire of an episode (insert or update: one row per episode).
export async function saveEpiQuestionnaire(organizationId, caseId, { answers, prefilled = {}, definitionVersion = 1, actorName = '' } = {}, { isDemo = false } = {}) {
  const clean = cleanAnswers(answers)
  if (isDemo) {
    const previous = demoRows.get(String(caseId))
    const core = ['antibiotics_90d', 'icu_stay', 'transfer_from_facility'].every(key => clean[key])
    const row = { id: previous?.id || `EPQ-${caseId}`, caseId: String(caseId), definitionVersion, answers: clean, prefilled, coreComplete: core, answeredBy: previous?.answeredBy || actorName, answeredAt: previous?.answeredAt || new Date().toISOString(), updatedBy: actorName, updatedAt: new Date().toISOString() }
    demoRows.set(String(caseId), row)
    return row
  }
  if (!needsCloud(organizationId)) throw new Error('No cloud connection.')
  const { data, error } = await supabase
    .from('surveillance_case_questionnaires')
    .upsert({ organization_id: organizationId, surveillance_case_id: caseId, definition_version: definitionVersion, answers: clean, prefilled }, { onConflict: 'surveillance_case_id' })
    .select(COLUMNS)
    .single()
  if (error) throw error
  return mapRow(data)
}

// The mini version (sample request): merges ONLY the three core answers into the stored questionnaire.
export async function saveEpiCoreAnswers(organizationId, caseId, core, options = {}) {
  const existing = (await loadEpiQuestionnaires(organizationId, [caseId], options))[String(caseId)]
  const answers = { ...(existing?.answers || {}), ...coreOnly(core) }
  return saveEpiQuestionnaire(organizationId, caseId, { answers, prefilled: existing?.prefilled || {}, definitionVersion: existing?.definitionVersion || 1, actorName: options.actorName || '' }, options)
}

// ---- hospital settings ------------------------------------------------------------------------
const SETTING_COLUMNS = 'id,question_key,label_el,label_en,help_el,help_en,window_days,is_active,version,updated_at'
const mapSetting = row => ({ id: row.id, questionKey: row.question_key, labelEl: row.label_el || '', labelEn: row.label_en || '', helpEl: row.help_el || '', helpEn: row.help_en || '', windowDays: row.window_days ?? null, isActive: row.is_active !== false, version: row.version || 1, updatedAt: row.updated_at || '' })

export async function loadEpiSettings(organizationId, { isDemo = false } = {}) {
  if (isDemo) return [...demoSettings.values()]
  if (!needsCloud(organizationId)) return []
  const { data, error } = await supabase.from('epi_questionnaire_question_settings').select(SETTING_COLUMNS).eq('organization_id', organizationId)
  if (error) throw error
  return (data || []).map(mapSetting)
}

// Saves one question's settings; every save raises that question's version (and so the questionnaire's).
export async function saveEpiSetting(organizationId, questionKey, patch, current = null, { isDemo = false } = {}) {
  const version = (current?.version || 0) + 1
  const body = { labelEl: patch.labelEl ?? current?.labelEl ?? '', labelEn: patch.labelEn ?? current?.labelEn ?? '', helpEl: patch.helpEl ?? current?.helpEl ?? '', helpEn: patch.helpEn ?? current?.helpEn ?? '', windowDays: patch.windowDays === undefined ? current?.windowDays ?? null : patch.windowDays, isActive: patch.isActive ?? current?.isActive ?? true }
  if (isDemo) {
    const row = { id: current?.id || `EPS-${questionKey}`, questionKey, ...body, version, updatedAt: new Date().toISOString() }
    demoSettings.set(questionKey, row)
    return row
  }
  if (!needsCloud(organizationId)) throw new Error('No cloud connection.')
  const { data, error } = await supabase
    .from('epi_questionnaire_question_settings')
    .upsert({ organization_id: organizationId, question_key: questionKey, label_el: body.labelEl || null, label_en: body.labelEn || null, help_el: body.helpEl || null, help_en: body.helpEn || null, window_days: body.windowDays, is_active: body.isActive, version, updated_at: new Date().toISOString() }, { onConflict: 'organization_id,question_key' })
    .select(SETTING_COLUMNS)
    .single()
  if (error) throw error
  return mapSetting(data)
}

export { epiDefinitionVersion }
