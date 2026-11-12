// The printed record as a document. A record page describes its report as plain data
// (kind, code, title, summary, sections) and RecordReportPrint renders it: black text on
// white, no chips, boxes or tables. This module cleans that description: blank values
// are dropped, empty sections are left out (or say «Δεν υπάρχουν καταγραφές»), the
// remaining sections are numbered 1…N and history is put in chronological order.
//
//   section: { id, title, intro?, pairs?: [[label, value]], items?: [{ title, meta?, pairs?, list?, text?, table?: [[a, b]] }],
//              list?: [text], events?: [{ when, sort, title, detail?, by? }], text?, documents?: {…}, keep?, emptyText? }
import type { AttachmentFile } from './AttachmentField'

// What a record page gives (plain data; anything that is not text or a number is dropped).
export type ReportPair = [label: string, value: string]
export interface ReportEventInput { when?: unknown; sort?: unknown; title?: unknown; detail?: unknown; by?: unknown }
export interface ReportItemInput { title?: unknown; meta?: unknown; pairs?: unknown; list?: unknown; text?: unknown; table?: unknown }
// The documents of a record: read from the cloud by entity, or the files themselves.
export interface ReportDocuments { organizationId?: string | null; entityType?: string | null; entityId?: string | null; value?: AttachmentFile[] }
export interface ReportSectionInput {
  id?: string
  title?: unknown
  intro?: unknown
  pairs?: unknown
  items?: Array<ReportItemInput | null | undefined>
  list?: unknown
  events?: unknown
  text?: unknown
  documents?: ReportDocuments | null
  keep?: boolean
  emptyText?: unknown
}
export interface RecordReport {
  kind?: unknown
  code?: unknown
  title?: unknown
  subtitle?: unknown
  statusLabel?: unknown
  status?: unknown
  summaryText?: unknown
  summaryPairs?: unknown
  sections?: Array<ReportSectionInput | null | undefined>
  signatures?: unknown
}

// The same description, cleaned (normalizeReport).
export interface ReportItem { title: string; meta: string; pairs: ReportPair[]; list: string[]; text: string; table: ReportPair[] }
export interface ReportEvent { when: string; sort: string; title: string; detail: string; by: string }
export interface ReportSection {
  id: string
  number: number
  title: string
  intro: string
  pairs: ReportPair[]
  items: ReportItem[]
  list: string[]
  events: ReportEvent[]
  text: string
  documents: ReportDocuments | null
  empty: string
  documentsEmpty: string
}

export const emptyReportText = (en: boolean) => (en ? 'No records.' : 'Δεν υπάρχουν καταγραφές')
export const CONFIDENTIAL_LINE = (en: boolean) => (en ? 'Confidential — contains health data' : 'Εμπιστευτικό — περιέχει δεδομένα υγείας')
export const pageLabel = (en: boolean) => (en ? 'Page' : 'Σελίδα')

const blank = (value: unknown) => value === null || value === undefined || value === false || (typeof value === 'string' && (value.trim() === '' || value.trim() === '—'))
// A value becomes plain text: numbers and strings stay, anything else (elements) is dropped.
const plain = (value: unknown): string => (blank(value) ? '' : typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '')
export const cleanPairs = (pairs: unknown): ReportPair[] => (Array.isArray(pairs) ? pairs : []).map((pair): ReportPair => [plain(pair?.[0]), plain(pair?.[1])]).filter(([label, value]) => label && value)
const cleanList = (list: unknown) => (Array.isArray(list) ? list : []).map(plain).filter(Boolean)

function cleanItem(item: ReportItemInput | null | undefined): ReportItem | null {
  const next: ReportItem = {
    title: plain(item?.title),
    meta: plain(item?.meta),
    pairs: cleanPairs(item?.pairs),
    list: cleanList(item?.list),
    text: plain(item?.text),
    table: cleanPairs(item?.table),
  }
  return next.title || next.pairs.length || next.list.length || next.text || next.table.length ? next : null
}

function cleanEvents(events: unknown): ReportEvent[] {
  return (Array.isArray(events) ? events : [])
    .map((event): ReportEvent => ({ when: plain(event?.when), sort: String(event?.sort ?? event?.when ?? ''), title: plain(event?.title), detail: plain(event?.detail), by: plain(event?.by) }))
    .filter(event => event.title || event.detail)
    .sort((a, b) => (a.sort < b.sort ? -1 : a.sort > b.sort ? 1 : 0))
}

// One line of a chronological list: «30/01/2025 · Εισαγωγή · ΜΕΘ (Χρήστης)».
export const eventLine = (event: ReportEvent) => [event.when, event.title, event.detail].filter(Boolean).join(' · ') + (event.by ? ` (${event.by})` : '')

export function normalizeReport(report: RecordReport | null | undefined, { en = false }: { en?: boolean } = {}) {
  const empty = emptyReportText(en)
  const sections: Array<Omit<ReportSection, 'number'>> = []
  for (const section of Array.isArray(report?.sections) ? report.sections : []) {
    if (!section) continue
    const next = {
      id: section.id || `section-${sections.length + 1}`,
      title: plain(section.title),
      intro: plain(section.intro),
      pairs: cleanPairs(section.pairs),
      items: (Array.isArray(section.items) ? section.items : []).map(cleanItem).filter(Boolean),
      list: cleanList(section.list),
      events: cleanEvents(section.events),
      text: plain(section.text),
      documents: section.documents || null,
    }
    const hasContent = Boolean(next.pairs.length || next.items.length || next.list.length || next.events.length || next.text || next.documents)
    // A section that may be empty on purpose (keep) says so; any other empty section is left out.
    if (!hasContent && !section.keep) continue
    sections.push({ ...next, empty: hasContent ? '' : plain(section.emptyText) || empty, documentsEmpty: plain(section.emptyText) || empty })
  }
  return {
    // Signature lines at the end (as the shared documents): role names, e.g. «Επικυρώθηκε από».
    signatures: cleanList(report?.signatures),
    kind: plain(report?.kind),
    code: plain(report?.code),
    title: plain(report?.title),
    subtitle: plain(report?.subtitle),
    statusLabel: plain(report?.statusLabel),
    status: plain(report?.status),
    summaryText: plain(report?.summaryText),
    summaryPairs: cleanPairs(report?.summaryPairs),
    sections: sections.map((section, index): ReportSection => ({ ...section, number: index + 1 })),
  }
}

// Greek/English words for an antibiogram result (S/I/R) in a printed report.
export const SIR_WORDS: Record<'el' | 'en', Record<string, string>> = {
  el: { S: 'Ευαίσθητο', I: 'Ευαίσθητο με αυξημένη έκθεση', R: 'Ανθεκτικό' },
  en: { S: 'Susceptible', I: 'Susceptible, increased exposure', R: 'Resistant' },
}
export const sirWord = (value: unknown, en?: boolean) => SIR_WORDS[en ? 'en' : 'el'][String(value || '').trim().toUpperCase()] || plain(value)

// «Meropenem R · Colistin S» (the demo's summary line) → [[antibiotic, result in words]].
export function parseSusceptibility(text: unknown, en?: boolean): ReportPair[] {
  return String(text || '')
    .split(/\s*[·;,]\s*/)
    .map(part => part.trim().match(/^(.+?)\s+([SIR])$/i))
    .filter(Boolean)
    .map((match): ReportPair => [match[1], sirWord(match[2], en)])
}
