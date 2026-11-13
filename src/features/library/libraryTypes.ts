// The library's records as the screens keep them (libraryService translates the database rows).

// A link, guideline, clinical guide or announcement (platform or hospital). The Demo's own items leave out what they do not need.
export type LibraryItem = {
  id: string
  organizationId?: string | null
  kind: string
  group?: string
  name: string
  abbreviation?: string
  organisation?: string
  url?: string
  descriptionEl?: string
  descriptionEn?: string
  summaryEl?: string
  summaryEn?: string
  limoxisEl?: string
  limoxisEn?: string
  noteEl?: string
  noteEn?: string
  tags?: string[]
  year?: number | null
  language?: string
  proposed?: boolean
  status?: string
  filePath?: string
  fileName?: string
  fileType?: string
  sortOrder?: number
  createdAt?: string
  updatedAt?: string
  // The Demo's own files open from the browser.
  localFileUrl?: string
}
// A news item of a source, or a hospital's own announcement.
export type LibraryNews = { id: string, sourceId?: string, sourceName?: string, sourceAbbreviation?: string, organizationId?: string | null, title: string, url?: string, excerpt?: string, publishedAt?: string, detectedAt?: string }
// A source the platform reads news from (RSS or a page).
export type LibrarySource = { id: string, itemId?: string, name: string, abbreviation?: string, url: string, kind: string, intervalHours: number, keywords?: string[], active?: boolean, verified?: boolean, lastCheckedAt?: string, lastOkAt?: string, lastError?: string, consecutiveFailures?: number, createdAt?: string }

// «Αυτόματη λήψη νέων» of a link, as the form keeps it.
export type NewsSettings = { enabled: boolean, id: string, url: string, kind: string, intervalHours: number | string, keywords: string }
// The form of an item, an announcement or a news source.
export type LibraryDraft = Omit<LibraryItem, 'id' | 'year' | 'kind' | 'name' | 'tags'> & {
  id: string
  kind: string
  name: string
  tags: string[]
  scope?: string
  // As typed («2021»).
  year: string
  file?: File | null
  excerpt?: string
  publishedAt?: string
  news: NewsSettings
  // A news source edited on its own.
  sourceKind?: string
  intervalHours?: number | string
  keywords?: string | string[]
  active?: boolean
}
// What the form opens with: an item, an announcement (a news item) or a news source of the Platform Owner's list.
export type LibraryEntry = Partial<LibraryItem> & Partial<LibraryNews> & Partial<LibrarySource> & { sourceKind?: string }
// A news source as the form saves it.
export type NewsSourceDraft = { id: string, name: string, abbreviation?: string, url?: string, kind: string, intervalHours: number | string, keywords: string | string[], active: boolean }
// A row of the Platform Owner's list: an item, or a news source of its own.
export type LibraryAdminRow = LibraryEntry & { id: string, kind: string, name: string, rowId: string }
