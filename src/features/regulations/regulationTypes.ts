import type { RegulationContent } from './regulationModel'

// A signature of a draft (or of an approved edition): the role, who signed, for which revision of the text.
export type RegulationSignature = { id?: string, role: string, name: string, title: string, image: string, signedAt: string, revision?: number | null }
// A platform template (its content only when asked).
export type RegulationTemplate = { key: string, title: string, titleEn?: string, category: string, description: string, sources: string, version: number, content: RegulationContent | null, changeNote: string, publishedAt?: string | null }
// A hospital's regulation, with its approved edition (the shelf leaves the content out).
export type Regulation = { id: string, code: string, title: string, category: string, description: string, templateKey: string, templateVersion: number | null, edition: number, issuedOn: string, approvedAt: string, approvedByName: string, content?: RegulationContent, archived: boolean, updatedAt: string, hasDraft?: boolean, signatures?: RegulationSignature[] }
// An approved edition (the list of editions leaves the content out).
export type RegulationEdition = { id: string, edition: number, changeNote: string, issuedOn: string, approvedAt: string, approvedByName: string, templateVersion: number | null, content?: RegulationContent, signatures: RegulationSignature[] }
// A regulation with its approved content (the demo keeps them so, and so the page reads one).
export type StoredRegulation = Regulation & { content: RegulationContent }
// The edition being written.
export type RegulationDraft = { content: RegulationContent, changeNote: string, revision?: number, updatedAt?: string }
// A regulation as its page reads it.
export type RegulationDetail = { regulation: StoredRegulation, draft: RegulationDraft | null, editions: RegulationEdition[], signatures: RegulationSignature[] }
// A signature box of the printed and read regulation.
export type SignatureSlot = { role: string, label: string, name: string, title: string, image: string, date: string }
// The header of the regulation as it is read and printed.
export type RegulationMeta = { title: string, organization: string, code: string, category: string, edition: number | string | undefined, editionLabel: string, issued: string, approvedBy: string | undefined, status: string, template: string, draft: boolean, signatures?: SignatureSlot[] }
