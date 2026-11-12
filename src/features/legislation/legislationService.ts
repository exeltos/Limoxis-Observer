import { supabase } from '../../core/supabase/client'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { isOwnerPreview } from '../../core/preview/ownerPreview'
import { loadSnapshot, saveSnapshot } from '../../core/data/repository'
import { nextLegislationCode, unpublishedChanges } from './legislationModel'
import { demoLegislation } from './legislationDemoData'

// Legislation (20261112100000_legislation.sql). Hospitals read the published
// versions and keep their own register; the Platform Owner keeps the working
// copies, the sources and what the automatic check found, and publishes with
// legislation_publish (which e-mails the hospitals). The demo keeps everything
// in the browser and sends nothing.

const isLocal = () => isDemoDataEnvironment() || isOwnerPreview()
const isUuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''))
const localId = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
const must = ({ data, error }) => { if (error) throw error; return data }
const text = value => { const kept = String(value ?? '').trim(); return kept || null }
const KEYS = { library: 'legislation_local_library', versions: 'legislation_local_versions', rows: 'legislation_local_rows', candidates: 'legislation_local_candidates', sources: 'legislation_local_sources' }

function local() {
  const library = loadSnapshot(KEYS.library, null)
  if (Array.isArray(library)) return Object.fromEntries(Object.entries(KEYS).map(([field, key]) => [field, field === 'library' ? library : loadSnapshot(key, [])]))
  const state = demoLegislation()
  saveLocal(state)
  return state
}
function saveLocal(state) { for (const [field, key] of Object.entries(KEYS)) saveSnapshot(key, state[field]) }

async function selectAll(build) {
  const all = []
  for (let from = 0; ; from += 1000) {
    const page = must(await build().range(from, from + 999)) || []
    all.push(...page)
    if (page.length < 1000) return all
  }
}

// --- Shapes --------------------------------------------------------------------------------

const toVersion = row => ({ textId: row.text_id, version: row.version, snapshot: row.snapshot || {}, changeNote: row.change_note || '', changedRequirements: row.changed_requirements || [], publishedAt: row.published_at })
const toRow = row => ({ id: row.id, textId: row.text_id, applicable: row.applicable, acceptedVersion: row.accepted_version || 0, responsible: row.responsible || '', compliance: row.compliance || {}, nextReviewOn: row.next_review_on || '', notes: row.notes || '', reviewedAt: row.reviewed_at || '' })
const toText = row => ({ id: row.id, code: row.code, title: row.title, titleEn: row.title_en || '', kind: row.kind, reference: row.reference || '', issuer: row.issuer || '', issuedOn: row.issued_on || '', topics: row.topics || [], summary: row.summary || '', url: row.url || '', status: row.status, requirements: Array.isArray(row.requirements) ? row.requirements : [], version: row.version || 0, publishedAt: row.published_at || '', updatedAt: row.updated_at })
const textRow = item => ({ title: item.title.trim(), title_en: text(item.titleEn), kind: item.kind, reference: text(item.reference), issuer: text(item.issuer), issued_on: item.issuedOn || null, topics: item.topics || [], summary: text(item.summary), url: text(item.url), status: item.status || 'in_force', requirements: (item.requirements || []).map(requirement => ({ id: requirement.id, text: String(requirement.text || '').trim(), ...(requirement.guidance ? { guidance: requirement.guidance } : {}) })) })
const toCandidate = row => ({ id: row.id, sourceId: row.source_id || '', sourceName: row.legislation_sources?.name || '', title: row.title, url: row.url || '', excerpt: row.excerpt || '', publishedHint: row.published_hint || '', matchedKeywords: row.matched_keywords || [], status: row.status, linkedTextId: row.linked_text_id || '', note: row.note || '', detectedAt: row.detected_at, reviewedAt: row.reviewed_at || '' })
const toSource = row => ({ id: row.id, name: row.name, url: row.url, kind: row.kind, keywords: row.keywords || [], active: row.active, lastCheckedAt: row.last_checked_at || '', lastStatus: row.last_status, lastError: row.last_error || '', consecutiveFailures: row.consecutive_failures || 0 })

// --- The hospital's register -------------------------------------------------------------------

// Every published version (the register works out each text's latest and what changed) and the hospital's rows.
export async function loadRegister(organizationId) {
  if (isLocal()) { const state = local(); return { versions: state.versions, rows: state.rows } }
  const [versions, rows] = await Promise.all([
    selectAll(() => supabase.from('legislation_text_versions').select('text_id,version,snapshot,change_note,changed_requirements,published_at').order('text_id').order('version')),
    organizationId ? selectAll(() => supabase.from('organization_legislation').select('*').eq('organization_id', organizationId).order('id')) : [],
  ])
  return { versions: versions.map(toVersion), rows: rows.map(toRow) }
}

export async function saveRegisterRow(organizationId, row, { reviewed = false } = {}) {
  const now = new Date().toISOString()
  if (isLocal()) {
    const state = local()
    const saved = { ...row, id: row.id || localId('ol'), ...(reviewed ? { reviewedAt: now } : {}) }
    state.rows = state.rows.some(item => item.textId === row.textId) ? state.rows.map(item => (item.textId === row.textId ? saved : item)) : [...state.rows, saved]
    saveLocal(state)
    return saved
  }
  const payload = { organization_id: organizationId, text_id: row.textId, applicable: row.applicable !== false, accepted_version: row.acceptedVersion || 0, responsible: text(row.responsible), compliance: row.compliance || {}, next_review_on: row.nextReviewOn || null, notes: text(row.notes), ...(reviewed ? { reviewed_at: now, reviewed_by: (await supabase.auth.getUser()).data?.user?.id || null } : {}) }
  return toRow(must(await supabase.from('organization_legislation').upsert(payload, { onConflict: 'organization_id,text_id' }).select('*').single()))
}

// --- The Platform Owner's library ----------------------------------------------------------------

export async function loadLibrary() {
  if (isLocal()) { const state = local(); return { texts: state.library, versions: state.versions } }
  const [texts, versions] = await Promise.all([
    selectAll(() => supabase.from('legislation_texts').select('*').order('code')),
    selectAll(() => supabase.from('legislation_text_versions').select('text_id,version,snapshot,change_note,changed_requirements,published_at').order('text_id').order('version')),
  ])
  return { texts: texts.map(toText), versions: versions.map(toVersion) }
}

export async function saveText(item) {
  if (isLocal()) {
    const state = local()
    const saved = { ...item, id: item.id || localId('leg'), code: item.code || nextLegislationCode(state.library.map(entry => entry.code)), version: item.version || 0 }
    state.library = item.id ? state.library.map(entry => (entry.id === item.id ? saved : entry)) : [...state.library, saved]
    saveLocal(state)
    return saved
  }
  if (isUuid(item.id)) return toText(must(await supabase.from('legislation_texts').update(textRow(item)).eq('id', item.id).select('*').single()))
  const codes = must(await supabase.from('legislation_texts').select('code')) || []
  return toText(must(await supabase.from('legislation_texts').insert({ ...textRow(item), code: nextLegislationCode(codes.map(entry => entry.code)) }).select('*').single()))
}

export async function removeText(id) {
  if (isLocal()) {
    const state = local()
    state.library = state.library.filter(entry => entry.id !== id)
    saveLocal(state)
    return
  }
  must(await supabase.from('legislation_texts').delete().eq('id', id).eq('version', 0))
}

// Publishes the saved working copy; returns the new version.
export async function publishText(id, changeNote) {
  if (isLocal()) {
    const state = local()
    const item = state.library.find(entry => entry.id === id)
    if (!item) throw new Error('LEGISLATION_TEXT_UNKNOWN')
    const history = state.versions.filter(entry => entry.textId === id).sort((a, b) => a.version - b.version)
    const changes = unpublishedChanges(item, history.at(-1)?.snapshot)
    const version = (item.version || 0) + 1
    const snapshot = Object.fromEntries(Object.entries(item).filter(([key]) => !['id', 'version', 'publishedAt'].includes(key)))
    state.versions = [...state.versions, { textId: id, version, snapshot: structuredClone(snapshot), changeNote: String(changeNote || '').trim(), changedRequirements: changes.requirements, publishedAt: new Date().toISOString() }]
    state.library = state.library.map(entry => (entry.id === id ? { ...entry, version, publishedAt: new Date().toISOString() } : entry))
    saveLocal(state)
    return version
  }
  return must(await supabase.rpc('legislation_publish', { p_text_id: id, p_change_note: String(changeNote || '').trim() || null }))
}

export async function loadCandidates() {
  if (isLocal()) return local().candidates
  return (must(await supabase.from('legislation_candidates').select('*,legislation_sources(name)').order('detected_at', { ascending: false }).limit(500)) || []).map(toCandidate)
}

export async function setCandidate(id, patch) {
  const fields = { status: patch.status, linkedTextId: patch.linkedTextId || '', note: patch.note || '' }
  if (isLocal()) {
    const state = local()
    state.candidates = state.candidates.map(item => (item.id === id ? { ...item, ...fields, reviewedAt: new Date().toISOString() } : item))
    saveLocal(state)
    return
  }
  must(await supabase.from('legislation_candidates').update({ status: fields.status, linked_text_id: isUuid(fields.linkedTextId) ? fields.linkedTextId : null, note: text(fields.note), reviewed_at: new Date().toISOString(), reviewed_by: (await supabase.auth.getUser()).data?.user?.id || null }).eq('id', id))
}

export async function loadSources() {
  if (isLocal()) return local().sources
  return (must(await supabase.from('legislation_sources').select('id,name,url,kind,keywords,active,last_checked_at,last_status,last_error,consecutive_failures').order('created_at')) || []).map(toSource)
}

export async function saveSource(source) {
  const fields = { name: source.name.trim(), url: source.url.trim(), kind: source.kind, keywords: (source.keywords || []).map(item => String(item).trim()).filter(Boolean), active: source.active !== false }
  if (isLocal()) {
    const state = local()
    const saved = { ...source, ...fields, id: source.id || localId('ls'), lastCheckedAt: source.lastCheckedAt || '', consecutiveFailures: source.consecutiveFailures || 0 }
    state.sources = source.id ? state.sources.map(item => (item.id === source.id ? saved : item)) : [...state.sources, saved]
    saveLocal(state)
    return saved
  }
  if (isUuid(source.id)) return toSource(must(await supabase.from('legislation_sources').update(fields).eq('id', source.id).select('*').single()))
  return toSource(must(await supabase.from('legislation_sources').insert(fields).select('*').single()))
}

export async function removeSource(id) {
  if (isLocal()) { const state = local(); state.sources = state.sources.filter(item => item.id !== id); saveLocal(state); return }
  must(await supabase.from('legislation_sources').delete().eq('id', id))
}

// Starts a check of every source now (the result shows a minute later).
export async function checkSourcesNow() {
  if (isLocal()) return false
  return must(await supabase.rpc('legislation_check_now'))
}

// How many candidates wait for the Platform Owner (for the notifications).
export async function pendingCandidateCount() {
  if (isLocal()) return local().candidates.filter(item => item.status === 'pending').length
  const { count } = await supabase.from('legislation_candidates').select('id', { count: 'exact', head: true }).eq('status', 'pending')
  return count || 0
}
