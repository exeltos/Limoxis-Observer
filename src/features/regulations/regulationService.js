import { supabase } from '../../core/supabase/client'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { isOwnerPreview } from '../../core/preview/ownerPreview'
import { loadSnapshot, saveSnapshot } from '../../core/data/repository'
import { REGULATION_TEMPLATES } from './regulationTemplates'
import { SIGNING_ROLES, contentFromTemplate, newId, nextRegulationCode, validSignatures } from './regulationModel'

// Regulations in the cloud: regulation_templates (the platform's), regulations
// (each hospital's, with its approved edition), regulation_drafts (the edition
// being written, seen only by those who edit) and regulation_editions (every
// approved edition) and regulation_signatures (the administrator's and the
// infection control lead's, each for one revision of the draft). The demo keeps
// the same shapes in memory.

const isLocal = () => isDemoDataEnvironment() || isOwnerPreview()
const must = ({ data, error }) => { if (error) throw error; return data }
const KEY = 'regulations_local'
const today = () => new Date().toISOString().slice(0, 10)

const toSignature = row => ({ id: row.id, role: row.role, name: row.signer_name ?? row.name, title: row.signer_title ?? row.title ?? '', image: row.image || '', signedAt: row.signed_at ?? row.signedAt, revision: row.draft_revision ?? row.revision ?? null })
const toTemplate = row => ({ key: row.key, title: row.title, titleEn: row.title_en || '', category: row.category, description: row.description || '', sources: row.sources || '', version: row.version, content: row.content || { chapters: [] }, changeNote: row.change_note || '', publishedAt: row.published_at })
const toRegulation = row => ({ id: row.id, code: row.code, title: row.title, category: row.category, description: row.description || '', templateKey: row.template_key || '', templateVersion: row.template_version || null, edition: row.edition || 0, issuedOn: row.issued_on || '', approvedAt: row.approved_at || '', approvedByName: row.approved_by_name || '', content: row.content || { chapters: [] }, archived: Boolean(row.archived), updatedAt: row.updated_at, hasDraft: false, signatures: (row.signatures || []).map(toSignature) })
const toEdition = row => ({ id: row.id, edition: row.edition, changeNote: row.change_note || '', issuedOn: row.issued_on || '', approvedAt: row.approved_at, approvedByName: row.approved_by_name || '', templateVersion: row.template_version || null, content: row.content, signatures: (row.signatures || []).map(toSignature) })

// --- Demo -------------------------------------------------------------------------

function demoState() {
  const template = REGULATION_TEMPLATES[0]
  const approved = contentFromTemplate(template, { hospital: 'Demo Hospital' })
  approved.chapters[0].sections[0].html += '<p>Η παρούσα έκδοση εγκρίθηκε από τη Διοίκηση μετά από εισήγηση της Επιτροπής Νοσοκομειακών Λοιμώξεων.</p>'
  for (const chapter of approved.chapters) for (const section of chapter.sections) section.html = section.html.replace(/<p class="reg-fill">[^<]*<\/p>/g, '')
  const issued = `${new Date().getFullYear()}-02-10`
  const signatures = [{ role: 'administrator', name: 'Μ. Παπαδοπούλου', title: 'Διοικήτρια', image: '', signedAt: `${issued}T09:00:00Z` }, { role: 'infection_lead', name: 'Α. Γεωργίου', title: 'Προϊστάμενη Νοσηλεύτρια Επιτήρησης Λοιμώξεων', image: '', signedAt: `${issued}T09:30:00Z` }]
  const regulation = { id: 'reg-demo-infection', code: 'REG-01', title: template.title, category: template.category, description: '', templateKey: template.key, templateVersion: template.version, edition: 2, issuedOn: issued, approvedAt: `${issued}T10:00:00Z`, approvedByName: 'Διοίκηση Demo Hospital', content: approved, archived: false, updatedAt: `${issued}T10:00:00Z`, signatures }
  const waste = REGULATION_TEMPLATES[1]
  const wasteRegulation = { id: 'reg-demo-waste', code: 'REG-02', title: waste.title, category: waste.category, description: '', templateKey: waste.key, templateVersion: waste.version, edition: 0, issuedOn: '', approvedAt: '', approvedByName: '', content: { chapters: [] }, archived: false, updatedAt: new Date().toISOString() }
  return {
    templates: structuredClone(REGULATION_TEMPLATES),
    templateVersions: REGULATION_TEMPLATES.map(item => ({ key: item.key, version: item.version, content: structuredClone(item.content), changeNote: item.changeNote })),
    regulations: [regulation, wasteRegulation],
    drafts: { [wasteRegulation.id]: { content: contentFromTemplate(waste, { hospital: 'Demo Hospital' }), changeNote: '', revision: 1, updatedAt: new Date().toISOString() } },
    signatures: {},
    editions: {
      [regulation.id]: [
        { id: 'ed-demo-2', edition: 2, changeNote: 'Ενσωμάτωση του Προγράμματος «Προκρούστης» και νέοι στόχοι υγιεινής χεριών.', issuedOn: issued, approvedAt: `${issued}T10:00:00Z`, approvedByName: 'Διοίκηση Demo Hospital', templateVersion: 1, content: approved, signatures },
        { id: 'ed-demo-1', edition: 1, changeNote: 'Πρώτη έκδοση.', issuedOn: `${new Date().getFullYear() - 2}-03-01`, approvedAt: `${new Date().getFullYear() - 2}-03-01T10:00:00Z`, approvedByName: 'Διοίκηση Demo Hospital', templateVersion: 1, content: approved, signatures },
      ],
    },
  }
}
function local() {
  const state = loadSnapshot(KEY, null)
  if (state && !Array.isArray(state) && state.regulations) return state
  const fresh = demoState()
  saveSnapshot(KEY, fresh)
  return fresh
}
const saveLocal = state => saveSnapshot(KEY, state)

// --- Templates ----------------------------------------------------------------------

// The templates; without their text unless asked (a shelf needs only titles and versions).
export async function loadTemplates({ withContent = true } = {}) {
  if (isLocal()) return local().templates.map(item => ({ ...item, content: withContent ? structuredClone(item.content) : null }))
  const columns = withContent ? '*' : 'key,title,title_en,category,description,sources,version,change_note,published_at'
  return (must(await supabase.from('regulation_templates').select(columns).order('title')) || []).map(row => ({ ...toTemplate(row), content: withContent ? row.content || { chapters: [] } : null }))
}

// One template with its text.
export async function loadTemplate(key) {
  if (!key) return null
  if (isLocal()) { const found = local().templates.find(item => item.key === key); return found ? { ...found, content: structuredClone(found.content) } : null }
  const row = must(await supabase.from('regulation_templates').select('*').eq('key', key).maybeSingle())
  return row ? toTemplate(row) : null
}

// The content of an earlier version of a template (to see what a new one changed).
export async function loadTemplateVersion(key, version) {
  if (!key || !version) return null
  if (isLocal()) return structuredClone(local().templateVersions.find(item => item.key === key && item.version === version)?.content || null)
  const row = must(await supabase.from('regulation_template_versions').select('content').eq('template_key', key).eq('version', version).maybeSingle())
  return row?.content || null
}

// The platform publishes a new version of a template.
export async function publishTemplate(template, changeNote) {
  if (isLocal()) {
    const state = local()
    const current = state.templates.find(item => item.key === template.key)
    if (!current) throw new Error('REGULATION_TEMPLATE_UNKNOWN')
    const version = current.version + 1
    Object.assign(current, { title: template.title, description: template.description, sources: template.sources, content: structuredClone(template.content), version, changeNote, publishedAt: new Date().toISOString() })
    state.templateVersions.push({ key: template.key, version, content: structuredClone(template.content), changeNote })
    saveLocal(state)
    return version
  }
  return must(await supabase.rpc('regulation_template_publish', { p_key: template.key, p_title: template.title, p_description: template.description || null, p_sources: template.sources || null, p_content: template.content, p_change_note: changeNote || null }))
}

// --- Regulations --------------------------------------------------------------------

export async function loadRegulations(organizationId) {
  if (isLocal()) { const state = local(); return state.regulations.map(item => ({ ...item, content: undefined, hasDraft: Boolean(state.drafts[item.id]) })) }
  const [rows, drafts] = await Promise.all([
    supabase.from('regulations').select('id,code,title,category,description,template_key,template_version,edition,issued_on,approved_at,approved_by_name,archived,updated_at').eq('organization_id', organizationId).order('code'),
    supabase.from('regulation_drafts').select('regulation_id').eq('organization_id', organizationId).eq('active', true),
  ])
  const withDraft = new Set((drafts.data || []).map(row => row.regulation_id))
  return (must(rows) || []).map(row => ({ ...toRegulation(row), content: undefined, hasDraft: withDraft.has(row.id) }))
}

// One regulation with its approved content, its draft (for those who edit) and its editions.
export async function loadRegulation(organizationId, id) {
  if (isLocal()) {
    const state = local()
    const regulation = state.regulations.find(item => item.id === id)
    if (!regulation) return null
    const draft = state.drafts[id] || null
    return { regulation: { ...structuredClone(regulation), hasDraft: Boolean(draft) }, draft: draft && { revision: 1, ...structuredClone(draft) }, editions: structuredClone(state.editions[id] || []).map(({ content: _content, ...rest }) => rest), signatures: draft ? structuredClone(state.signatures?.[id] || []) : [] }
  }
  const [row, draft, editions, signatures] = await Promise.all([
    supabase.from('regulations').select('*').eq('organization_id', organizationId).eq('id', id).maybeSingle(),
    supabase.from('regulation_drafts').select('content,change_note,revision,updated_at').eq('regulation_id', id).eq('active', true).maybeSingle(),
    supabase.from('regulation_editions').select('id,edition,change_note,issued_on,approved_at,approved_by_name,template_version,signatures').eq('regulation_id', id).order('edition', { ascending: false }),
    supabase.from('regulation_signatures').select('id,role,signer_name,signer_title,image,signed_at,draft_revision').eq('regulation_id', id).is('edition', null).order('signed_at', { ascending: false }),
  ])
  const data = must(row)
  if (!data) return null
  const draftRow = draft.error ? null : draft.data
  return { regulation: { ...toRegulation(data), hasDraft: Boolean(draftRow) }, draft: draftRow ? { content: draftRow.content, changeNote: draftRow.change_note || '', revision: draftRow.revision || 1, updatedAt: draftRow.updated_at } : null, editions: (must(editions) || []).map(toEdition), signatures: draftRow && !signatures.error ? (signatures.data || []).map(toSignature) : [] }
}

export async function loadEdition(id, edition) {
  if (isLocal()) return structuredClone((local().editions[id] || []).find(item => item.edition === edition) || null)
  const row = must(await supabase.from('regulation_editions').select('*').eq('regulation_id', id).eq('edition', edition).maybeSingle())
  return row ? toEdition(row) : null
}

// A new regulation: from a template (its content becomes the first draft) or blank.
export async function createRegulation(organizationId, { title, category, template = null, hospital = '', content = null, codes = [] }) {
  const draftContent = content || (template ? contentFromTemplate(template, { hospital }) : { chapters: [{ id: newId('ch'), title: 'Κεφάλαιο 1', sections: [{ id: newId('sec'), origin: null, title: 'Γενικά', html: '' }] }] })
  const code = nextRegulationCode(codes)
  if (isLocal()) {
    const state = local()
    const regulation = { id: newId('reg'), code, title, category, description: '', templateKey: template?.key || '', templateVersion: template?.version || null, edition: 0, issuedOn: '', approvedAt: '', approvedByName: '', content: { chapters: [] }, archived: false, updatedAt: new Date().toISOString() }
    state.regulations.push(regulation)
    state.drafts[regulation.id] = { content: draftContent, changeNote: '', revision: 1, updatedAt: new Date().toISOString() }
    saveLocal(state)
    return regulation.id
  }
  const row = must(await supabase.from('regulations').insert({ organization_id: organizationId, code, title, category, template_key: template?.key || null, template_version: template?.version || null }).select('id').single())
  must(await supabase.from('regulation_drafts').insert({ regulation_id: row.id, organization_id: organizationId, content: draftContent }))
  return row.id
}

// Saves the edition being written (starting one if the regulation has none).
export async function saveDraft(organizationId, id, content, changeNote = '') {
  if (isLocal()) {
    const state = local()
    const previous = state.drafts[id]
    const changed = !previous || JSON.stringify(previous.content) !== JSON.stringify(content)
    state.drafts[id] = { content: structuredClone(content), changeNote, revision: (previous?.revision || 0) + (changed ? 1 : 0), updatedAt: new Date().toISOString() }
    saveLocal(state)
    return
  }
  must(await supabase.from('regulation_drafts').upsert({ regulation_id: id, organization_id: organizationId, content, change_note: changeNote || null, active: true, updated_at: new Date().toISOString() }, { onConflict: 'regulation_id' }))
}

// Leaves the revision: the regulation stays as approved.
export async function discardDraft(organizationId, id) {
  if (isLocal()) { const state = local(); delete state.drafts[id]; if (state.signatures) delete state.signatures[id]; saveLocal(state); return }
  must(await supabase.from('regulation_drafts').update({ active: false }).eq('regulation_id', id).eq('organization_id', organizationId))
}

export async function updateRegulation(organizationId, id, changes) {
  const row = {}
  if ('title' in changes) row.title = changes.title
  if ('category' in changes) row.category = changes.category
  if ('description' in changes) row.description = changes.description || null
  if ('templateVersion' in changes) row.template_version = changes.templateVersion
  if ('archived' in changes) row.archived = Boolean(changes.archived)
  if (isLocal()) {
    const state = local()
    const regulation = state.regulations.find(item => item.id === id)
    if (regulation) Object.assign(regulation, Object.fromEntries(Object.keys(changes).map(key => [key, changes[key]])), { updatedAt: new Date().toISOString() })
    saveLocal(state)
    return
  }
  must(await supabase.from('regulations').update(row).eq('organization_id', organizationId).eq('id', id))
}

// Approves the draft as the next edition.
export async function approveDraft(organizationId, id, { changeNote = '', issuedOn = today(), approvedByName = '' } = {}) {
  if (isLocal()) {
    const state = local()
    const regulation = state.regulations.find(item => item.id === id)
    const draft = state.drafts[id]
    if (!regulation || !draft) throw new Error('REGULATION_NO_DRAFT')
    const signatures = validSignatures(state.signatures?.[id] || [], draft.revision || 1)
    if (signatures.length < SIGNING_ROLES.length) throw new Error('REGULATION_SIGNATURES_MISSING')
    const edition = regulation.edition + 1
    const approvedAt = new Date().toISOString()
    ;(state.editions[id] ||= []).unshift({ id: newId('ed'), edition, changeNote, issuedOn, approvedAt, approvedByName, templateVersion: regulation.templateVersion, content: structuredClone(draft.content), signatures })
    Object.assign(regulation, { content: structuredClone(draft.content), edition, issuedOn, approvedAt, approvedByName, updatedAt: approvedAt, signatures })
    delete state.drafts[id]
    delete state.signatures[id]
    saveLocal(state)
    return edition
  }
  return must(await supabase.rpc('regulation_approve', { p_regulation_id: id, p_change_note: changeNote || null, p_issued_on: issuedOn || null, p_approved_by_name: approvedByName || null }))
}

// Signs the draft, as it stands now, in a role (administrator, infection_lead).
// A later change to the text leaves the signature on the earlier revision.
export async function signDraft(id, { role, name, title = '', image = '' }) {
  if (isLocal()) {
    const state = local()
    const draft = state.drafts[id]
    if (!draft) throw new Error('REGULATION_NO_DRAFT')
    ;(state.signatures ||= {})[id] = [{ id: newId('sig'), role, name: name.trim(), title: title.trim(), image, signedAt: new Date().toISOString(), revision: draft.revision || 1 }, ...(state.signatures[id] || [])]
    saveLocal(state)
    return
  }
  must(await supabase.rpc('regulation_sign', { p_regulation_id: id, p_role: role, p_name: name, p_title: title || null, p_image: image || null }))
}
