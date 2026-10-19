import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'
import { getDocumentProxy } from 'npm:unpdf@0.12.1'
import { strFromU8, unzipSync } from 'npm:fflate@0.8.2'
import {
  draftPrompt, evaluateProtocol, extractProtocolReferences, hasTextLayer, legislationKeys, newFindings, normalizeExtractedText, parseDraft, splitProtocolSections,
  type ClinicalSourceChange, type LegislationChange, type ProtocolDoc, type Sections,
} from '../_shared/protocolReview.ts'

// Έλεγχος επικαιρότητας πρωτοκόλλων. Called by pg_cron (private.protocol_review_dispatch)
// with the scheduler secret from Vault, never by a browser. Tasks:
//   extract  read the text of protocols not read yet (one row per document version);
//   compare  review date, age and cited sources → suggestions (and optional drafts);
//   nightly  extract in small batches (each in its own invocation), then compare.
// Nothing in controlled_documents changes. No e-mail, no notification_outbox.
// Only the protocol text and the source excerpt go to the organisation's LIRA
// provider, and only when one is configured; never patient data.

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any
const BUCKET = 'attachments'
const MAX_BODY_CHARS = 400000
const MAX_FILE_BYTES = 25 * 1024 * 1024
const STUCK_MINUTES = 15
const CURRENT = ['published', 'approved']
const env = (name: string, fallback: number) => { const v = Number(Deno.env.get(name)); return Number.isFinite(v) && v > 0 ? v : fallback }
const MAX_DRAFTS_PER_NIGHT = env('PROTOCOL_REVIEW_MAX_DRAFTS', 5)
const MAX_DRAFT_CHARS = env('PROTOCOL_REVIEW_MAX_CHARS', 6000)
const short = (e: unknown) => String((e as Error)?.message || e).slice(0, 300)

// ------------------------------------------------------------------ reading

async function pdfText(bytes: Uint8Array) {
  const pdf = await getDocumentProxy(bytes)
  const pages: string[] = []
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n)
    const content = await page.getTextContent()
    let out = '', lastY: number | null = null
    // deno-lint-ignore no-explicit-any
    for (const item of content.items as any[]) {
      if (typeof item.str !== 'string') continue
      const y = Array.isArray(item.transform) ? item.transform[5] : null
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 2 && !out.endsWith('\n')) out += '\n'
      out += item.str
      if (item.hasEOL) out += '\n'
      if (y !== null) lastY = y
    }
    pages.push(out)
    page.cleanup?.()
  }
  await pdf.destroy?.()
  return { text: pages.join('\n\n'), pages: pdf.numPages }
}

function docxText(bytes: Uint8Array) {
  const files = unzipSync(bytes, { filter: file => file.name === 'word/document.xml' })
  const xml = files['word/document.xml'] ? strFromU8(files['word/document.xml']) : ''
  const text = xml
    .replace(/<w:tab\/>/g, '\t').replace(/<w:br[^>]*\/>/g, '\n').replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
  return { text, pages: 0 }
}

const kindOf = (a: { mime_type?: string | null, file_name?: string | null }) => {
  const name = String(a.file_name || '').toLowerCase(), mime = String(a.mime_type || '').toLowerCase()
  if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf'
  if (mime.includes('wordprocessingml') || name.endsWith('.docx')) return 'docx'
  return null
}

async function sha256(parts: Uint8Array[]) {
  const total = parts.reduce((n, p) => n + p.length, 0), all = new Uint8Array(total)
  let at = 0; for (const p of parts) { all.set(p, at); at += p.length }
  const digest = await crypto.subtle.digest('SHA-256', all)
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
}

const sameIds = (a: string[] = [], b: string[] = []) => a.length === b.length && [...a].sort().join() === [...b].sort().join()

// Protocols whose current attachments have not been read yet.
async function extractionQueue(admin: Admin, organizationId: string | null, retryFailed: boolean) {
  const stuckBefore = new Date(Date.now() - STUCK_MINUTES * 60000).toISOString()
  let stuck = admin.from('protocol_text_versions').update({ status: 'failed', error: 'INTERRUPTED' }).eq('status', 'processing').lt('started_at', stuckBefore)
  if (organizationId) stuck = stuck.eq('organization_id', organizationId)
  await stuck
  let q = admin.from('controlled_documents').select('id,organization_id,version').eq('document_type', 'protocol').in('status', [...CURRENT, 'draft', 'review']).order('updated_at', { ascending: false }).limit(2000)
  if (organizationId) q = q.eq('organization_id', organizationId)
  const { data: docs, error } = await q
  if (error) throw error
  const ids = (docs || []).map((d: Admin) => d.id)
  const texts = new Map<string, Admin>(), files = new Map<string, Admin[]>()
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200)
    const [{ data: t }, { data: a }] = await Promise.all([
      admin.from('protocol_text_versions').select('id,document_id,status,error,attachment_ids').in('document_id', chunk),
      admin.from('attachments').select('id,entity_id,file_name,storage_path,mime_type,size_bytes,created_at').eq('entity_type', 'controlled_document').is('deleted_at', null).in('entity_id', chunk),
    ])
    for (const row of t || []) texts.set(row.document_id, row)
    for (const row of a || []) { const list = files.get(row.entity_id) || []; list.push(row); files.set(row.entity_id, list) }
  }
  const queue: Array<{ doc: Admin, text: Admin | null, files: Admin[] }> = []
  for (const doc of docs || []) {
    const list = (files.get(doc.id) || []).sort((x: Admin, y: Admin) => String(x.created_at).localeCompare(String(y.created_at)))
    const text = texts.get(doc.id) || null
    if (text?.status === 'processing') continue
    // A file that stopped the worker is not tried again every night, only on request.
    if (text?.status === 'failed' && text.error === 'INTERRUPTED' && !retryFailed) continue
    const current = list.map((f: Admin) => f.id)
    if (text && sameIds(text.attachment_ids || [], current) && !(retryFailed && text.status === 'failed')) continue
    queue.push({ doc, text, files: list })
  }
  return queue
}

async function claim(admin: Admin, item: { doc: Admin, text: Admin | null }) {
  const now = new Date().toISOString()
  if (!item.text) {
    const { data } = await admin.from('protocol_text_versions').upsert({ organization_id: item.doc.organization_id, document_id: item.doc.id, document_version: item.doc.version, status: 'processing', started_at: now }, { onConflict: 'document_id', ignoreDuplicates: true }).select('id')
    return data?.[0]?.id || null
  }
  const { data } = await admin.from('protocol_text_versions').update({ status: 'processing', started_at: now, error: null, document_version: item.doc.version }).eq('id', item.text.id).neq('status', 'processing').select('id')
  return data?.[0]?.id || null
}

async function extractOne(admin: Admin, item: { doc: Admin, text: Admin | null, files: Admin[] }) {
  const id = await claim(admin, item)
  if (!id) return 'skipped'
  const finish = (patch: Record<string, unknown>) => admin.from('protocol_text_versions').update({ attachment_ids: item.files.map(f => f.id), extracted_at: new Date().toISOString(), ...patch }).eq('id', id)
  try {
    const readable = item.files.filter(f => kindOf(f) && Number(f.size_bytes || 0) <= MAX_FILE_BYTES)
    if (!readable.length) { await finish({ status: 'unsupported', error: item.files.length ? 'NO_PDF_OR_DOCX' : 'NO_ATTACHMENT', body: null, sections: {}, char_count: 0 }); await replaceReferences(admin, id, item.doc, []); return 'unsupported' }
    const parts: Uint8Array[] = [], texts: string[] = []
    let pages = 0
    const extractors = new Set<string>()
    for (const file of readable) {
      const { data: blob, error } = await admin.storage.from(BUCKET).download(file.storage_path)
      if (error || !blob) throw new Error(`DOWNLOAD_FAILED ${error?.message || ''}`.trim())
      const bytes = new Uint8Array(await blob.arrayBuffer())
      parts.push(bytes)
      const kind = kindOf(file)!
      const result = kind === 'pdf' ? await pdfText(bytes) : docxText(bytes)
      extractors.add(kind === 'pdf' ? 'unpdf' : 'docx-xml')
      pages += result.pages
      texts.push(result.text)
    }
    const text = normalizeExtractedText(texts.join('\n\n')).slice(0, MAX_BODY_CHARS)
    const hash = await sha256(parts)
    if (!hasTextLayer(text, pages || 1)) {
      await finish({ status: 'no_text', content_hash: hash, page_count: pages || null, char_count: text.length, body: null, sections: {}, extractor: [...extractors].join('+'), error: null })
      await replaceReferences(admin, id, item.doc, [])
      return 'no_text'
    }
    const sections = splitProtocolSections(text)
    const refs = extractProtocolReferences(text)
    await finish({ status: 'extracted', content_hash: hash, page_count: pages || null, char_count: text.length, body: text, sections, extractor: [...extractors].join('+'), error: null })
    await replaceReferences(admin, id, item.doc, refs)
    return 'extracted'
  } catch (error) {
    await finish({ status: 'failed', error: short(error) })
    return 'failed'
  }
}

async function replaceReferences(admin: Admin, textVersionId: string, doc: Admin, refs: ReturnType<typeof extractProtocolReferences>) {
  await admin.from('protocol_references').delete().eq('text_version_id', textVersionId)
  if (!refs.length) return
  const rows = refs.slice(0, 300).map(r => ({ organization_id: doc.organization_id, text_version_id: textVersionId, document_id: doc.id, kind: r.kind, ref_key: r.key.slice(0, 120), label: r.label.slice(0, 200), organisation: r.organisation, cited_year: r.year, section: r.section, context: r.context.slice(0, 200) }))
  const { error } = await admin.from('protocol_references').insert(rows)
  if (error) throw error
}

async function extractBatch(admin: Admin, { organizationId = null, limit = 5, retryFailed = false }: { organizationId?: string | null, limit?: number, retryFailed?: boolean }) {
  const queue = await extractionQueue(admin, organizationId, retryFailed)
  const counts: Record<string, number> = { extracted: 0, no_text: 0, failed: 0, unsupported: 0, skipped: 0 }
  const max = Math.max(1, Math.min(25, limit))
  let done = 0, seen = 0
  // An item another invocation has just claimed is skipped and does not count.
  for (const item of queue) {
    if (done >= max) break
    seen++
    const result = await extractOne(admin, item)
    counts[result]++
    if (result !== 'skipped') done++
  }
  return { ...counts, remaining: Math.max(0, queue.length - seen) }
}

// ------------------------------------------------------------------ comparison

const greekDay = (v: string) => v ? `${v.slice(8, 10)}/${v.slice(5, 7)}/${v.slice(0, 4)}` : ''

async function loadSources(admin: Admin) {
  const [{ data: history }, { data: versions }, { data: texts }] = await Promise.all([
    admin.from('clinical_content_source_history').select('id,source_id,checked_at,note,clinical_content_sources(id,source_key,name,authority,source_url)').eq('change_detected', true).order('checked_at', { ascending: false }).limit(500),
    admin.from('legislation_text_versions').select('text_id,version,change_note,changed_requirements,snapshot,published_at').gt('version', 1).order('published_at', { ascending: false }).limit(1000),
    admin.from('legislation_texts').select('id,code,title,reference,url,status,requirements,updated_at,published_at'),
  ])
  const clinical: ClinicalSourceChange[] = (history || []).filter((h: Admin) => h.clinical_content_sources).map((h: Admin) => ({ source: h.clinical_content_sources, historyId: h.id, checkedAt: h.checked_at, note: h.note }))
  const byId = new Map<string, Admin>((texts || []).map((t: Admin) => [t.id, t]))
  const legislation: LegislationChange[] = []
  const latestVersion = new Map<string, Admin>()
  for (const v of versions || []) if (!latestVersion.has(v.text_id)) latestVersion.set(v.text_id, v)
  for (const [textId, v] of latestVersion) {
    const t = byId.get(textId); if (!t) continue
    const changed = new Set(v.changed_requirements || [])
    const reqs = (v.snapshot?.requirements || t.requirements || []).filter((r: Admin) => changed.has(r.id)).map((r: Admin) => String(r.text || '')).filter(Boolean)
    legislation.push({
      text: t, keys: legislationKeys(t), triggerKey: `legislation:${textId}:v${v.version}`, changedAt: v.published_at,
      summary: `Η νομοθεσία «${t.title}»${t.reference ? ` (${t.reference})` : ''} ενημερώθηκε (έκδοση ${v.version}, ${greekDay(String(v.published_at).slice(0, 10))})${v.change_note ? `: ${v.change_note}` : '.'}`.slice(0, 4000),
      excerpt: reqs.join('\n').slice(0, 4000),
    })
  }
  for (const t of texts || []) {
    if (!['amended', 'repealed'].includes(t.status)) continue
    legislation.push({
      text: t, keys: legislationKeys(t), triggerKey: `legislation:${t.id}:${t.status}`, changedAt: t.updated_at,
      summary: `Η νομοθεσία «${t.title}»${t.reference ? ` (${t.reference})` : ''} ${t.status === 'repealed' ? 'καταργήθηκε' : 'τροποποιήθηκε'}.`,
      excerpt: '',
    })
  }
  return { clinical, legislation }
}

async function compareOrganisation(admin: Admin, organizationId: string, sources: Awaited<ReturnType<typeof loadSources>>, today: string) {
  const { data: docs, error } = await admin.from('controlled_documents').select('id,organization_id,code,title,status,version,effective_date,review_date,published_at,created_at').eq('organization_id', organizationId).eq('document_type', 'protocol').in('status', CURRENT).limit(5000)
  if (error) throw error
  const ids = (docs || []).map((d: Admin) => d.id)
  const texts = new Map<string, Admin>(), refs = new Map<string, Admin[]>(), existing: Admin[] = []
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100)
    const [{ data: t }, { data: r }, { data: s }] = await Promise.all([
      admin.from('protocol_text_versions').select('document_id,status,sections,body').eq('status', 'extracted').in('document_id', chunk),
      admin.from('protocol_references').select('document_id,kind,ref_key,label').in('document_id', chunk),
      admin.from('protocol_update_suggestions').select('document_id,reason,source_ref,trigger_key,status').in('document_id', chunk),
    ])
    for (const row of t || []) texts.set(row.document_id, row)
    for (const row of r || []) { const list = refs.get(row.document_id) || []; list.push({ key: row.ref_key, kind: row.kind, label: row.label }); refs.set(row.document_id, list) }
    existing.push(...(s || []))
  }
  const rows: Admin[] = []
  const counts: Record<string, number> = { review_due: 0, source_changed: 0, stale: 0 }
  for (const doc of (docs || []) as ProtocolDoc[]) {
    const text = texts.get(doc.id)
    const findings = evaluateProtocol({ doc, sections: (text?.sections || null) as Partial<Sections> | null, references: refs.get(doc.id) || [], text: text?.body || '', clinicalChanges: sources.clinical, legislationChanges: sources.legislation, today })
    for (const f of newFindings(doc.id, findings, existing)) {
      counts[f.reason]++
      rows.push({ organization_id: organizationId, document_id: doc.id, reason: f.reason, source_kind: f.source_kind, source_ref: f.source_ref, source_label: f.source_label, source_url: f.source_url, trigger_key: f.trigger_key, what_changed: f.what_changed.slice(0, 4000), affected_sections: f.affected_sections, details: f.details, source_excerpt: f.source_excerpt ? f.source_excerpt.slice(0, 4000) : null })
    }
  }
  for (let i = 0; i < rows.length; i += 100) {
    const { error: insertError } = await admin.from('protocol_update_suggestions').upsert(rows.slice(i, i + 100), { onConflict: 'document_id,reason,source_ref,trigger_key', ignoreDuplicates: true })
    if (insertError) throw insertError
  }
  return counts
}

// Optional drafting through the organisation's LIRA provider; bounded per night.
async function draftSuggestions(admin: Admin, organizationIds: string[], maxDrafts: number) {
  let drafted = 0, attempted = 0
  const done = new Set<string>()
  for (const organizationId of organizationIds) {
    if (attempted >= maxDrafts) break
    const { data: runtime } = await admin.rpc('get_lira_provider_runtime_secret', { p_organization_id: organizationId })
    const cfg = runtime?.[0]
    if (!cfg || cfg.provider !== 'openai' || !cfg.api_key || !cfg.model) continue
    const { data: open } = await admin.from('protocol_update_suggestions').select('id,document_id,source_label,source_url,source_excerpt,what_changed,affected_sections,details').eq('organization_id', organizationId).eq('status', 'open').eq('reason', 'source_changed').is('draft_text', null).is('draft_attempted_at', null).order('created_at', { ascending: true }).limit(maxDrafts * 3)
    for (const s of open || []) {
      if (attempted >= maxDrafts && !done.has(s.document_id)) break
      if (!done.has(s.document_id)) { done.add(s.document_id); attempted++ }
      const { data: text } = await admin.from('protocol_text_versions').select('sections').eq('document_id', s.document_id).eq('status', 'extracted').maybeSingle()
      const now = new Date().toISOString()
      if (!text?.sections) { await admin.from('protocol_update_suggestions').update({ draft_attempted_at: now }).eq('id', s.id); continue }
      const prompt = draftPrompt({ sections: text.sections, affected: s.affected_sections || [], sourceLabel: s.source_label || '', sourceExcerpt: s.source_excerpt || '', whatChanged: s.what_changed, maxChars: MAX_DRAFT_CHARS })
      const r = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { 'Authorization': `Bearer ${cfg.api_key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: cfg.model, input: [{ role: 'system', content: prompt.system }, { role: 'user', content: prompt.user }], max_output_tokens: 700 }) }).catch(() => null)
      const payload = r?.ok ? await r.json().catch(() => null) : null
      // deno-lint-ignore no-explicit-any
      const raw = String(payload?.output_text || payload?.output?.flatMap((x: any) => x?.content || []).map((x: any) => x?.text || '').join('\n') || '')
      const draft = parseDraft(raw)
      if (!draft) { await admin.from('protocol_update_suggestions').update({ draft_attempted_at: now }).eq('id', s.id); continue }
      await admin.from('protocol_update_suggestions').update({
        draft_text: draft.proposed_text, draft_citation: [s.source_label, s.source_url].filter(Boolean).join(' — ').slice(0, 500) || null,
        draft_generated_at: now, draft_attempted_at: now, details: { ...(s.details || {}), ai: { what_changed: draft.what_changed, affected_sections: draft.affected_sections } },
      }).eq('id', s.id)
      drafted++
    }
  }
  return { drafted, draftAttempts: attempted }
}

async function compareAll(admin: Admin, { organizationId = null, maxDrafts = MAX_DRAFTS_PER_NIGHT }: { organizationId?: string | null, maxDrafts?: number }) {
  const today = new Date().toISOString().slice(0, 10)
  // A postponed suggestion comes back on its date.
  let reopen = admin.from('protocol_update_suggestions').update({ status: 'open', updated_at: new Date().toISOString() }).eq('status', 'snoozed').lte('snoozed_until', today)
  if (organizationId) reopen = reopen.eq('organization_id', organizationId)
  await reopen
  let orgIds: string[] = []
  if (organizationId) orgIds = [organizationId]
  else {
    const { data } = await admin.from('controlled_documents').select('organization_id').eq('document_type', 'protocol').in('status', CURRENT).limit(10000)
    orgIds = [...new Set<string>((data || []).map((d: Admin) => d.organization_id))]
  }
  const sources = await loadSources(admin)
  const totals: Record<string, number> = { review_due: 0, source_changed: 0, stale: 0 }
  for (const id of orgIds) {
    const counts = await compareOrganisation(admin, id, sources, today)
    for (const k of Object.keys(totals)) totals[k] += counts[k] || 0
  }
  const drafts = await draftSuggestions(admin, orgIds, Math.max(0, Math.min(50, Number(maxDrafts) || 0)))
  return { organisations: orgIds.length, created: totals, ...drafts }
}

// ------------------------------------------------------------------ entry

Deno.serve(async req => {
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405)
  const url = Deno.env.get('SUPABASE_URL'), service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !service) return reply({ error: 'Function is not configured' }, 500)
  const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } })
  const secret = req.headers.get('x-limoxis-scheduler') || ''
  const { data: valid, error: secretError } = await admin.rpc('platform_scheduler_secret_valid', { p_secret: secret })
  if (secretError || valid !== true) return reply({ error: 'Unauthorized' }, 401)
  const body = await req.json().catch(() => ({}))
  const task = String(body.task || 'nightly')
  const organizationId = typeof body.organizationId === 'string' && /^[0-9a-f-]{36}$/i.test(body.organizationId) ? body.organizationId : null
  try {
    if (task === 'extract') return reply({ ok: true, task, ...await extractBatch(admin, { organizationId, limit: Number(body.limit) || 5, retryFailed: body.retryFailed === true }) })
    if (task === 'compare') return reply({ ok: true, task, ...await compareAll(admin, { organizationId, maxDrafts: body.maxDrafts ?? MAX_DRAFTS_PER_NIGHT }) })
    if (task === 'nightly') {
      // Each batch runs in its own invocation, so one large PDF cannot use up the
      // time of the whole run; the run stops after a few minutes and goes on the next night.
      const started = Date.now(), totals: Record<string, number> = { extracted: 0, no_text: 0, failed: 0, unsupported: 0 }
      const parallel = Math.max(1, Math.min(4, Number(body.parallel) || 1))
      let remaining = 1, rounds = 0, errors = 0
      while (remaining > 0 && Date.now() - started < 240000 && rounds < 80 && errors < 3) {
        rounds++
        const results = await Promise.all(Array.from({ length: parallel }, () => fetch(`${url}/functions/v1/protocol-review`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-limoxis-scheduler': secret }, body: JSON.stringify({ task: 'extract', organizationId, limit: 3 }) })
          .then(r => (r.ok ? r.json() : null)).catch(() => null)))
        const ok = results.filter(Boolean)
        if (!ok.length) { errors++; continue }
        for (const result of ok) for (const k of Object.keys(totals)) totals[k] += Number(result[k] || 0)
        remaining = Math.min(...ok.map(result => Number(result.remaining || 0)))
      }
      const compared = body.compare === false ? {} : await compareAll(admin, { organizationId, maxDrafts: body.maxDrafts ?? MAX_DRAFTS_PER_NIGHT })
      return reply({ ok: true, task, extraction: { ...totals, remaining, rounds }, ...compared })
    }
    return reply({ ok: false, error: 'UNKNOWN_TASK' }, 400)
  } catch (error) {
    return reply({ ok: false, task, error: short(error) }, 500)
  }
})
