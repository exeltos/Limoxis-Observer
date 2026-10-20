import { supabase } from '../../core/supabase/client'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { isOwnerPreview } from '../../core/preview/ownerPreview'
import { loadSnapshot, saveSnapshot } from '../../core/data/repository'
import { DEMO_LIBRARY_ORG, demoLibraryItems, demoLibraryNews, demoSources } from './libraryDemoData'
import { keywordList } from './libraryModel'

// «Βιβλιοθήκη» (20261203200000_library.sql). Everyone reads the platform's
// items and their own hospital's; the Platform Owner writes the platform's
// items and the news sources, a Hospital Admin or Quality Manager the
// hospital's. The news found in the sources is written by the
// library-news-ingest Edge Function only. The preview and the Demo keep
// everything in the browser.

const BUCKET = 'library-files'
const isLocal = () => isDemoDataEnvironment() || isOwnerPreview()
const localId = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
const must = ({ data, error }) => { if (error) throw error; return data }
const text = value => { const kept = String(value ?? '').trim(); return kept || null }
const KEYS = { items: 'library_local_items', news: 'library_local_news', sources: 'library_local_sources' }

function local() {
  const items = loadSnapshot(KEYS.items, null)
  if (Array.isArray(items)) return { items, news: loadSnapshot(KEYS.news, []), sources: loadSnapshot(KEYS.sources, []) }
  const state = { items: demoLibraryItems(), news: demoLibraryNews(), sources: demoSources() }
  saveLocal(state)
  return state
}
function saveLocal(state) { for (const [field, key] of Object.entries(KEYS)) saveSnapshot(key, state[field]) }

// --- Shapes --------------------------------------------------------------------------------

export const toItem = row => ({ id: row.id, organizationId: row.organization_id || null, kind: row.kind, group: row.link_group, name: row.name, abbreviation: row.abbreviation || '', organisation: row.organisation || '', url: row.url || '', descriptionEl: row.description_el || '', descriptionEn: row.description_en || '', summaryEl: row.summary_el || '', summaryEn: row.summary_en || '', limoxisEl: row.limoxis_note_el || '', limoxisEn: row.limoxis_note_en || '', noteEl: row.note_el || '', noteEn: row.note_en || '', tags: row.tags || [], year: row.year || null, language: row.language || 'en', proposed: Boolean(row.is_proposed), status: row.status || 'published', filePath: row.file_path || '', fileName: row.file_name || '', fileType: row.file_type || '', sortOrder: row.sort_order ?? 100, createdAt: row.created_at, updatedAt: row.updated_at })
export const itemRow = (item, organizationId) => ({ organization_id: organizationId || null, kind: item.kind, link_group: organizationId ? 'hospital' : (item.group || 'international'), name: String(item.name).trim(), abbreviation: text(item.abbreviation), organisation: text(item.organisation), url: text(item.url), description_el: text(item.descriptionEl), description_en: text(item.descriptionEn), summary_el: text(item.summaryEl), summary_en: text(item.summaryEn), note_el: text(item.noteEl), note_en: text(item.noteEn), tags: item.tags || [], year: item.year ? Number(item.year) : null, language: item.language || 'el', is_proposed: organizationId ? false : Boolean(item.proposed), status: item.status || 'published' })
export const toNews = row => ({ id: row.id, sourceId: row.source_id || '', sourceName: row.library_sources?.name || '', sourceAbbreviation: row.library_sources?.abbreviation || '', organizationId: row.organization_id || null, title: row.title, url: row.url || '', excerpt: row.excerpt || '', publishedAt: row.published_at || '', detectedAt: row.detected_at })
export const toSource = row => ({ id: row.id, itemId: row.item_id || '', name: row.name, abbreviation: row.abbreviation || '', url: row.url, kind: row.kind, intervalHours: row.interval_hours || 2, keywords: row.keywords || [], active: row.active !== false, verified: Boolean(row.verified), lastCheckedAt: row.last_checked_at || '', lastOkAt: row.last_ok_at || '', lastError: row.last_error || '', consecutiveFailures: row.consecutive_failures || 0, createdAt: row.created_at })

// --- Reading -------------------------------------------------------------------------------

// The platform's items and the hospital's own (RLS returns exactly these); `all`
// keeps archived ones too (the management screen).
export async function loadLibrary(organizationId, { all = false, platformOnly = false } = {}) {
  if (isLocal()) {
    const state = local()
    return state.items.filter(item => (all || item.status !== 'archived') && (!platformOnly || !item.organizationId))
  }
  let query = supabase.from('library_items').select('*').order('sort_order').order('name').limit(2000)
  query = platformOnly ? query.is('organization_id', null) : organizationId ? query.or(`organization_id.is.null,organization_id.eq.${organizationId}`) : query.is('organization_id', null)
  if (!all) query = query.eq('status', 'published')
  return (must(await query) || []).map(toItem)
}

export async function loadNews(organizationId) {
  if (isLocal()) return local().news
  let query = supabase.from('library_news').select('id,source_id,organization_id,title,url,excerpt,published_at,detected_at,library_sources(name,abbreviation)').order('published_at', { ascending: false, nullsFirst: false }).order('detected_at', { ascending: false }).limit(200)
  query = organizationId ? query.or(`organization_id.is.null,organization_id.eq.${organizationId}`) : query.is('organization_id', null)
  return (must(await query) || []).map(toNews)
}

export async function loadSources() {
  if (isLocal()) return local().sources
  return (must(await supabase.from('library_sources').select('*').order('name')) || []).map(toSource)
}

// A short-lived link to a clinical guide's file (the bucket is private).
export async function fileUrl(item) {
  if (!item?.filePath) return item?.url || ''
  if (isLocal()) return item.localFileUrl || item.url || ''
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(item.filePath, 300)
  if (error) throw error
  return data?.signedUrl || ''
}

// --- Writing -------------------------------------------------------------------------------

async function uploadFile(file, folder, itemId) {
  const safeName = String(file.name || 'file').replace(/[^\w.-]+/g, '_').slice(-120)
  const path = `${folder}/${itemId}/${Date.now()}-${safeName}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined })
  if (error) throw error
  return { file_path: path, file_name: file.name, file_type: file.type || null }
}

// Saves an item (and, for a link with «Αυτόματη λήψη νέων», its news source).
// organizationId null = a platform item (Platform Owner).
export async function saveItem(draft, organizationId) {
  const now = new Date().toISOString()
  if (isLocal()) {
    const state = local()
    const id = draft.id || localId('lib')
    const saved = { ...draft, id, organizationId: organizationId ? organizationId || DEMO_LIBRARY_ORG : null, group: organizationId ? 'hospital' : draft.group, year: draft.year ? Number(draft.year) : null, updatedAt: now, ...(draft.file ? { filePath: `local/${draft.file.name}`, fileName: draft.file.name, fileType: draft.file.type, localFileUrl: typeof URL !== 'undefined' && URL.createObjectURL ? URL.createObjectURL(draft.file) : '' } : {}) }
    delete saved.file
    delete saved.news
    delete saved.scope
    state.items = state.items.some(item => item.id === id) ? state.items.map(item => (item.id === id ? { ...item, ...saved } : item)) : [...state.items, { sortOrder: 1000, ...saved }]
    if (!organizationId) state.sources = saveLocalSource(state.sources, draft, id)
    saveLocal(state)
    return saved
  }
  const payload = itemRow(draft, organizationId)
  const saved = draft.id
    ? must(await supabase.from('library_items').update(payload).eq('id', draft.id).select('*').single())
    : must(await supabase.from('library_items').insert(payload).select('*').single())
  let row = saved
  if (draft.file) {
    const file = await uploadFile(draft.file, organizationId || 'platform', saved.id)
    row = must(await supabase.from('library_items').update(file).eq('id', saved.id).select('*').single())
    if (draft.filePath && draft.filePath !== file.file_path) await supabase.storage.from(BUCKET).remove([draft.filePath]).catch(() => {})
  }
  if (!organizationId && draft.kind === 'link') await saveSourceFor(draft, saved.id)
  return toItem(row)
}

function saveLocalSource(sources, draft, itemId) {
  const news = draft.news || {}
  if (!news.enabled) return news.id ? sources.map(source => (source.id === news.id ? { ...source, active: false } : source)) : sources
  const values = { itemId, name: `${draft.abbreviation || draft.name} · news`, abbreviation: draft.abbreviation || '', url: news.url.trim(), kind: news.kind, intervalHours: Number(news.intervalHours) || 2, keywords: keywordList(news.keywords), active: true }
  return news.id ? sources.map(source => (source.id === news.id ? { ...source, ...values } : source)) : [...sources, { id: localId('src'), verified: false, lastCheckedAt: '', lastOkAt: '', lastError: '', consecutiveFailures: 0, createdAt: new Date().toISOString(), ...values }]
}

async function saveSourceFor(draft, itemId) {
  const news = draft.news || {}
  if (!news.enabled) {
    if (news.id) must(await supabase.from('library_sources').update({ active: false }).eq('id', news.id))
    return
  }
  const values = { item_id: itemId, name: `${draft.abbreviation || draft.name} · news`, abbreviation: text(draft.abbreviation), url: news.url.trim(), kind: news.kind === 'page' ? 'page' : 'rss', interval_hours: Number(news.intervalHours) || 2, keywords: keywordList(news.keywords), active: true }
  if (news.id) must(await supabase.from('library_sources').update(values).eq('id', news.id))
  else must(await supabase.from('library_sources').upsert(values, { onConflict: 'url' }))
}

// A news source on its own (type «Πηγή νέων»): Platform Owner.
export async function saveSource(source) {
  if (isLocal()) {
    const state = local()
    const values = { name: source.name.trim(), abbreviation: source.abbreviation || '', url: source.url.trim(), kind: source.kind, intervalHours: Number(source.intervalHours) || 2, keywords: keywordList(source.keywords), active: source.active !== false }
    state.sources = source.id ? state.sources.map(item => (item.id === source.id ? { ...item, ...values } : item)) : [...state.sources, { id: localId('src'), itemId: '', verified: false, lastCheckedAt: '', lastOkAt: '', lastError: '', consecutiveFailures: 0, createdAt: new Date().toISOString(), ...values }]
    saveLocal(state)
    return
  }
  const values = { name: source.name.trim(), abbreviation: text(source.abbreviation), url: source.url.trim(), kind: source.kind === 'page' ? 'page' : 'rss', interval_hours: Number(source.intervalHours) || 2, keywords: keywordList(source.keywords), active: source.active !== false }
  if (source.id) must(await supabase.from('library_sources').update(values).eq('id', source.id))
  else must(await supabase.from('library_sources').insert(values))
}

// «Απόσυρση»: the item stops showing; it is kept, and can be published again.
export async function setItemStatus(item, status) {
  if (isLocal()) {
    const state = local()
    state.items = state.items.map(entry => (entry.id === item.id ? { ...entry, status, updatedAt: new Date().toISOString() } : entry))
    saveLocal(state)
    return
  }
  must(await supabase.from('library_items').update({ status }).eq('id', item.id))
}

// A hospital's own announcement in «Νέα».
export async function saveAnnouncement(draft, organizationId) {
  const row = { title: String(draft.name).trim(), url: text(draft.url), excerpt: text(String(draft.excerpt || '').slice(0, 300)), published_at: draft.publishedAt ? new Date(`${draft.publishedAt}T12:00:00Z`).toISOString() : new Date().toISOString() }
  if (isLocal()) {
    const state = local()
    const saved = { id: draft.id || localId('news'), sourceId: '', sourceName: '', sourceAbbreviation: draft.abbreviation || '', organizationId: organizationId || DEMO_LIBRARY_ORG, title: row.title, url: row.url || '', excerpt: row.excerpt || '', publishedAt: row.published_at, detectedAt: new Date().toISOString() }
    state.news = state.news.some(item => item.id === saved.id) ? state.news.map(item => (item.id === saved.id ? saved : item)) : [saved, ...state.news]
    saveLocal(state)
    return saved
  }
  if (draft.id) return toNews(must(await supabase.from('library_news').update(row).eq('id', draft.id).select('*').single()))
  return toNews(must(await supabase.from('library_news').insert({ ...row, organization_id: organizationId, item_key: `hospital:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}` }).select('*').single()))
}

export async function removeAnnouncement(item) {
  if (isLocal()) {
    const state = local()
    state.news = state.news.filter(entry => entry.id !== item.id)
    saveLocal(state)
    return
  }
  must(await supabase.from('library_news').delete().eq('id', item.id))
}
