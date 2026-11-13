import { cloudClient } from '../../core/supabase/cloudContext'
import type { Database, Json, Tables, TablesUpdate } from '../../core/supabase/database.types'

// The generated types mark the optional arguments of these functions as non-null; they take null.
type RpcArgs<F extends keyof Database['public']['Functions']> = Database['public']['Functions'][F]['Args']
import type { RegulationContent } from './regulationModel'
import type { Regulation, RegulationDetail, RegulationDraft, RegulationEdition, RegulationSignature, RegulationTemplate, StoredRegulation } from './regulationTypes'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { isOwnerPreview } from '../../core/preview/ownerPreview'
import { loadSnapshot, saveSnapshot } from '../../core/data/repository'
import { REGULATION_TEMPLATES } from './regulationTemplates'
import { SIGNING_ROLES, contentFromTemplate, newId, nextRegulationCode, validSignatures } from './regulationModel'
import { hospitalToday } from '../../core/dates/hospitalDate'

// Regulations in the cloud: regulation_templates (the platform's), regulations
// (each hospital's, with its approved edition), regulation_drafts (the edition
// being written, seen only by those who edit) and regulation_editions (every
// approved edition) and regulation_signatures (the administrator's and the
// infection control lead's, each for one revision of the draft). The demo keeps
// the same shapes in memory.

const isLocal = () => isDemoDataEnvironment() || isOwnerPreview()
const must = <T>({ data, error }: { data: T, error: unknown }): T => { if (error) throw error; return data }
const KEY = 'regulations_local'
const today = () => hospitalToday()

// A signature as a row of regulation_signatures, or as kept in the json of an edition (or the demo).
type SignatureSource = { id?: string, role: string, signer_name?: string, name?: string, signer_title?: string | null, title?: string | null, image?: string | null, signed_at?: string, signedAt?: string, draft_revision?: number | null, revision?: number | null }
// The rows as read (a shelf reads only some columns); content and signatures are json.
type TemplateRow = Pick<Tables<'regulation_templates'>, 'key' | 'title' | 'category' | 'version'> & Partial<Tables<'regulation_templates'>>
type RegulationRow = Pick<Tables<'regulations'>, 'id' | 'code' | 'title' | 'category' | 'updated_at'> & Partial<Tables<'regulations'>>
type EditionRow = Pick<Tables<'regulation_editions'>, 'id' | 'edition' | 'approved_at'> & Partial<Tables<'regulation_editions'>>
const signaturesOf = (value: Json | undefined) => (value || []) as SignatureSource[]
const contentOf = (value: Json | undefined) => value as unknown as RegulationContent
// The content goes back to its json column as it is.
const asJson = (content: RegulationContent) => content as unknown as Json
const toSignature = (row: SignatureSource): RegulationSignature => ({ id: row.id, role: row.role, name: (row.signer_name ?? row.name) as string, title: row.signer_title ?? row.title ?? '', image: row.image || '', signedAt: (row.signed_at ?? row.signedAt) as string, revision: row.draft_revision ?? row.revision ?? null })
const toTemplate = (row: TemplateRow): RegulationTemplate => ({ key: row.key, title: row.title, titleEn: row.title_en || '', category: row.category, description: row.description || '', sources: row.sources || '', version: row.version, content: contentOf(row.content) || { chapters: [] }, changeNote: row.change_note || '', publishedAt: row.published_at })
const toRegulation = (row: RegulationRow): StoredRegulation => ({ id: row.id, code: row.code, title: row.title, category: row.category, description: row.description || '', templateKey: row.template_key || '', templateVersion: row.template_version || null, edition: row.edition || 0, issuedOn: row.issued_on || '', approvedAt: row.approved_at || '', approvedByName: row.approved_by_name || '', content: contentOf(row.content) || { chapters: [] }, archived: Boolean(row.archived), updatedAt: row.updated_at, hasDraft: false, signatures: signaturesOf(row.signatures).map(toSignature) })
const toEdition = (row: EditionRow): RegulationEdition => ({ id: row.id, edition: row.edition, changeNote: row.change_note || '', issuedOn: row.issued_on || '', approvedAt: row.approved_at, approvedByName: row.approved_by_name || '', templateVersion: row.template_version || null, content: contentOf(row.content), signatures: signaturesOf(row.signatures).map(toSignature) })

// --- Demo -------------------------------------------------------------------------

// The demo keeps everything in one state, in the shapes of the screens.
type LocalState = { templates: RegulationTemplate[], templateVersions: { key: string, version: number, content: RegulationContent | null, changeNote: string }[], regulations: StoredRegulation[], drafts: Record<string, RegulationDraft>, signatures: Record<string, RegulationSignature[]>, editions: Record<string, RegulationEdition[]> }
function demoState(): LocalState {
  const template = REGULATION_TEMPLATES[0]
  const approved = contentFromTemplate(template, { hospital: 'Demo Hospital' })
  approved.chapters[0].sections[0].html += '<p>Η παρούσα έκδοση εγκρίθηκε από τη Διοίκηση μετά από εισήγηση της Επιτροπής Νοσοκομειακών Λοιμώξεων.</p>'
  for (const chapter of approved.chapters) for (const section of chapter.sections) section.html = section.html.replace(/<p class="reg-fill">[^<]*<\/p>/g, '')
  const issued = `${new Date().getFullYear()}-02-10`
  const signatures = [{ role: 'administrator', name: 'Μ. Παπαδοπούλου', title: 'Διοικήτρια', image: '', signedAt: `${issued}T09:00:00Z` }, { role: 'infection_lead', name: 'Α. Γεωργίου', title: 'Προϊστάμενος/η Νοσηλευτικής Επιτήρησης Λοιμώξεων', image: '', signedAt: `${issued}T09:30:00Z` }]
  const regulation: StoredRegulation = { id: 'reg-demo-infection', code: 'REG-01', title: template.title, category: template.category, description: '', templateKey: template.key, templateVersion: template.version, edition: 2, issuedOn: issued, approvedAt: `${issued}T10:00:00Z`, approvedByName: 'Διοίκηση Demo Hospital', content: approved, archived: false, updatedAt: `${issued}T10:00:00Z`, signatures }
  const waste = REGULATION_TEMPLATES[1]
  const wasteRegulation: StoredRegulation = { id: 'reg-demo-waste', code: 'REG-02', title: waste.title, category: waste.category, description: '', templateKey: waste.key, templateVersion: waste.version, edition: 0, issuedOn: '', approvedAt: '', approvedByName: '', content: { chapters: [] }, archived: false, updatedAt: new Date().toISOString() }
  // Three more approved regulations, issued in 2025 and this year (owner, 9/11/2026: the Demo shows the whole of 2025).
  const more = [['food_safety', 'reg-demo-food', 'REG-03', '2025-04-14', 'Η Διοίκηση ενέκρινε τον κανονισμό μετά από εισήγηση του Υπευθύνου Διατροφής.'], ['patient_safety', 'reg-demo-patient-safety', 'REG-04', '2025-09-22', 'Η Διοίκηση ενέκρινε τον κανονισμό μετά από εισήγηση της Επιτροπής Ποιότητας και Ασφάλειας Ασθενών.'], ['water_safety', 'reg-demo-water', 'REG-05', `${new Date().getFullYear()}-03-16`, 'Η Διοίκηση ενέκρινε το σχέδιο μετά από εισήγηση της Επιτροπής Νοσοκομειακών Λοιμώξεων και της Τεχνικής Υπηρεσίας.']].map(([key, id, code, issuedOn, note]) => {
    const source = REGULATION_TEMPLATES.find(item => item.key === key) as RegulationTemplate
    const content = contentFromTemplate(source, { hospital: 'Demo Hospital' })
    if (content.chapters[0]?.sections[0]) content.chapters[0].sections[0].html += `<p>${note}</p>`
    for (const chapter of content.chapters) for (const section of chapter.sections) section.html = section.html.replace(/<p class="reg-fill">[^<]*<\/p>/g, '')
    const signed = [{ role: 'administrator', name: 'Μ. Παπαδοπούλου', title: 'Διοικήτρια', image: '', signedAt: `${issuedOn}T09:00:00Z` }]
    return { id, code, title: source.title, category: source.category, description: '', templateKey: source.key, templateVersion: source.version, edition: 1, issuedOn, approvedAt: `${issuedOn}T10:00:00Z`, approvedByName: 'Διοίκηση Demo Hospital', content, archived: false, updatedAt: `${issuedOn}T10:00:00Z`, signatures: signed }
  })
  return {
    templates: structuredClone(REGULATION_TEMPLATES),
    templateVersions: REGULATION_TEMPLATES.map(item => ({ key: item.key, version: item.version, content: structuredClone(item.content), changeNote: item.changeNote })),
    regulations: [regulation, wasteRegulation, ...more],
    drafts: { [wasteRegulation.id]: { content: contentFromTemplate(waste, { hospital: 'Demo Hospital' }), changeNote: '', revision: 1, updatedAt: new Date().toISOString() } },
    signatures: {},
    editions: {
      [regulation.id]: [
        { id: 'ed-demo-2', edition: 2, changeNote: 'Ενσωμάτωση του Προγράμματος «Προκρούστης» και νέοι στόχοι υγιεινής χεριών.', issuedOn: issued, approvedAt: `${issued}T10:00:00Z`, approvedByName: 'Διοίκηση Demo Hospital', templateVersion: 1, content: approved, signatures },
        { id: 'ed-demo-1', edition: 1, changeNote: 'Πρώτη έκδοση.', issuedOn: `${new Date().getFullYear() - 2}-03-01`, approvedAt: `${new Date().getFullYear() - 2}-03-01T10:00:00Z`, approvedByName: 'Διοίκηση Demo Hospital', templateVersion: 1, content: approved, signatures },
      ],
      ...Object.fromEntries(more.map(item => [item.id, [{ id: `ed-${item.id.slice(4)}-1`, edition: 1, changeNote: 'Πρώτη έκδοση.', issuedOn: item.issuedOn, approvedAt: item.approvedAt, approvedByName: item.approvedByName, templateVersion: item.templateVersion, content: item.content, signatures: item.signatures }]])),
    },
  }
}
function local(): LocalState {
  const state = loadSnapshot(KEY, null)
  if (state && !Array.isArray(state) && state.regulations) return state
  const fresh = demoState()
  saveSnapshot(KEY, fresh)
  return fresh
}
const saveLocal = (state: LocalState) => saveSnapshot(KEY, state)

// --- Templates ----------------------------------------------------------------------

// The templates; without their text unless asked (a shelf needs only titles and versions).
export async function loadTemplates({ withContent = true } = {}) {
  if (isLocal()) return local().templates.map((item: RegulationTemplate) => ({ ...item, content: withContent ? structuredClone(item.content) : null }))
  const columns = withContent ? '*' : 'key,title,title_en,category,description,sources,version,change_note,published_at'
  // The column list depends on withContent; the rows are read as full rows (content only when asked).
  return (must(await cloudClient().from('regulation_templates').select(columns as '*').order('title')) || []).map(row => ({ ...toTemplate(row), content: withContent ? contentOf(row.content) || { chapters: [] } : null }))
}

// One template with its text.
export async function loadTemplate(key: string | null | undefined) {
  if (!key) return null
  if (isLocal()) { const found = local().templates.find((item: RegulationTemplate) => item.key === key); return found ? { ...found, content: structuredClone(found.content) } : null }
  const row = must(await cloudClient().from('regulation_templates').select('*').eq('key', key).maybeSingle())
  return row ? toTemplate(row) : null
}

// The content of an earlier version of a template (to see what a new one changed).
export async function loadTemplateVersion(key: string | null | undefined, version: number | null | undefined) {
  if (!key || !version) return null
  if (isLocal()) return structuredClone(local().templateVersions.find(item => item.key === key && item.version === version)?.content || null)
  const row = must(await cloudClient().from('regulation_template_versions').select('content').eq('template_key', key).eq('version', version).maybeSingle())
  return (row?.content || null) as RegulationContent | null
}

// The platform publishes a new version of a template.
export async function publishTemplate(template: RegulationTemplate, changeNote: string) {
  if (isLocal()) {
    const state = local()
    const current = state.templates.find((item: RegulationTemplate) => item.key === template.key)
    if (!current) throw new Error('REGULATION_TEMPLATE_UNKNOWN')
    const version = current.version + 1
    Object.assign(current, { title: template.title, description: template.description, sources: template.sources, content: structuredClone(template.content), version, changeNote, publishedAt: new Date().toISOString() })
    state.templateVersions.push({ key: template.key, version, content: structuredClone(template.content), changeNote })
    saveLocal(state)
    return version
  }
  return must(await cloudClient().rpc('regulation_template_publish', { p_key: template.key, p_title: template.title, p_description: template.description || null, p_sources: template.sources || null, p_content: template.content, p_change_note: changeNote || null } as RpcArgs<'regulation_template_publish'>))
}

// --- Regulations --------------------------------------------------------------------

export async function loadRegulations(organizationId: string) {
  if (isLocal()) { const state = local(); return state.regulations.map((item: Regulation) => ({ ...item, content: undefined, hasDraft: Boolean(state.drafts[item.id]) })) }
  const [rows, drafts] = await Promise.all([
    cloudClient().from('regulations').select('id,code,title,category,description,template_key,template_version,edition,issued_on,approved_at,approved_by_name,archived,updated_at').eq('organization_id', organizationId).order('code'),
    cloudClient().from('regulation_drafts').select('regulation_id').eq('organization_id', organizationId).eq('active', true),
  ])
  const withDraft = new Set((drafts.data || []).map(row => row.regulation_id))
  return (must(rows) || []).map(row => ({ ...toRegulation(row), content: undefined, hasDraft: withDraft.has(row.id) }))
}

// One regulation with its approved content, its draft (for those who edit) and its editions.
export async function loadRegulation(organizationId: string, id: string): Promise<RegulationDetail | null> {
  if (isLocal()) {
    const state = local()
    const regulation = state.regulations.find((item: Regulation) => item.id === id)
    if (!regulation) return null
    const draft = state.drafts[id] || null
    return { regulation: { ...structuredClone(regulation), hasDraft: Boolean(draft) }, draft: draft && { revision: 1, ...structuredClone(draft) }, editions: structuredClone(state.editions[id] || []).map(({ content: _content, ...rest }: RegulationEdition) => rest), signatures: draft ? structuredClone(state.signatures?.[id] || []) : [] }
  }
  const [row, draft, editions, signatures] = await Promise.all([
    cloudClient().from('regulations').select('*').eq('organization_id', organizationId).eq('id', id).maybeSingle(),
    cloudClient().from('regulation_drafts').select('content,change_note,revision,updated_at').eq('regulation_id', id).eq('active', true).maybeSingle(),
    cloudClient().from('regulation_editions').select('id,edition,change_note,issued_on,approved_at,approved_by_name,template_version,signatures').eq('regulation_id', id).order('edition', { ascending: false }),
    cloudClient().from('regulation_signatures').select('id,role,signer_name,signer_title,image,signed_at,draft_revision').eq('regulation_id', id).is('edition', null).order('signed_at', { ascending: false }),
  ])
  const data = must(row)
  if (!data) return null
  const draftRow = draft.error ? null : draft.data
  return { regulation: { ...toRegulation(data), hasDraft: Boolean(draftRow) }, draft: draftRow ? { content: contentOf(draftRow.content), changeNote: draftRow.change_note || '', revision: draftRow.revision || 1, updatedAt: draftRow.updated_at } : null, editions: (must(editions) || []).map(toEdition), signatures: draftRow && !signatures.error ? (signatures.data || []).map(toSignature) : [] }
}

export async function loadEdition(id: string, edition: number) {
  if (isLocal()) return structuredClone((local().editions[id] || []).find((item: RegulationEdition) => item.edition === edition) || null)
  const row = must(await cloudClient().from('regulation_editions').select('*').eq('regulation_id', id).eq('edition', edition).maybeSingle())
  return row ? toEdition(row) : null
}

// A new regulation: from a template (its content becomes the first draft) or blank.
export async function createRegulation(organizationId: string, { title, category, template = null, hospital = '', content = null, codes = [] }: { title: string, category: string, template?: RegulationTemplate | null, hospital?: string, content?: RegulationContent | null, codes?: unknown[] }) {
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
  const row = must(await cloudClient().from('regulations').insert({ organization_id: organizationId, code, title, category, template_key: template?.key || null, template_version: template?.version || null }).select('id').single()) as { id: string }
  must(await cloudClient().from('regulation_drafts').insert({ regulation_id: row.id, organization_id: organizationId, content: asJson(draftContent) }))
  return row.id
}

// Saves the edition being written (starting one if the regulation has none).
export async function saveDraft(organizationId: string, id: string, content: RegulationContent, changeNote = '') {
  if (isLocal()) {
    const state = local()
    const previous = state.drafts[id]
    const changed = !previous || JSON.stringify(previous.content) !== JSON.stringify(content)
    state.drafts[id] = { content: structuredClone(content), changeNote, revision: (previous?.revision || 0) + (changed ? 1 : 0), updatedAt: new Date().toISOString() }
    saveLocal(state)
    return
  }
  must(await cloudClient().from('regulation_drafts').upsert({ regulation_id: id, organization_id: organizationId, content: asJson(content), change_note: changeNote || null, active: true, updated_at: new Date().toISOString() }, { onConflict: 'regulation_id' }))
}

// Leaves the revision: the regulation stays as approved.
export async function discardDraft(organizationId: string, id: string) {
  if (isLocal()) { const state = local(); delete state.drafts[id]; if (state.signatures) delete state.signatures[id]; saveLocal(state); return }
  must(await cloudClient().from('regulation_drafts').update({ active: false }).eq('regulation_id', id).eq('organization_id', organizationId))
}

export async function updateRegulation(organizationId: string, id: string, changes: Partial<Regulation>) {
  const row: TablesUpdate<'regulations'> = {}
  if ('title' in changes) row.title = changes.title
  if ('category' in changes) row.category = changes.category
  if ('description' in changes) row.description = changes.description || null
  if ('templateVersion' in changes) row.template_version = changes.templateVersion
  if ('archived' in changes) row.archived = Boolean(changes.archived)
  if (isLocal()) {
    const state = local()
    const regulation = state.regulations.find((item: Regulation) => item.id === id)
    if (regulation) Object.assign(regulation, Object.fromEntries(Object.keys(changes).map(key => [key, changes[key as keyof Regulation]])), { updatedAt: new Date().toISOString() })
    saveLocal(state)
    return
  }
  must(await cloudClient().from('regulations').update(row).eq('organization_id', organizationId).eq('id', id))
}

// Approves the draft as the next edition.
export async function approveDraft(organizationId: string, id: string, { changeNote = '', issuedOn = today(), approvedByName = '' } = {}) {
  if (isLocal()) {
    const state = local()
    const regulation = state.regulations.find((item: Regulation) => item.id === id)
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
  return must(await cloudClient().rpc('regulation_approve', { p_regulation_id: id, p_change_note: changeNote || null, p_issued_on: issuedOn || null, p_approved_by_name: approvedByName || null } as RpcArgs<'regulation_approve'>))
}

// Signs the draft, as it stands now, in a role (administrator, infection_lead).
// A later change to the text leaves the signature on the earlier revision.
export async function signDraft(id: string, { role, name, title = '', image = '' }: { role: string, name: string, title?: string, image?: string }) {
  if (isLocal()) {
    const state = local()
    const draft = state.drafts[id]
    if (!draft) throw new Error('REGULATION_NO_DRAFT')
    ;(state.signatures ||= {})[id] = [{ id: newId('sig'), role, name: name.trim(), title: title.trim(), image, signedAt: new Date().toISOString(), revision: draft.revision || 1 }, ...(state.signatures[id] || [])]
    saveLocal(state)
    return
  }
  must(await cloudClient().rpc('regulation_sign', { p_regulation_id: id, p_role: role, p_name: name, p_title: title || null, p_image: image || null } as RpcArgs<'regulation_sign'>))
}
