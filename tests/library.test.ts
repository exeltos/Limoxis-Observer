import { describe, expect, it } from 'vitest'
import { NEWS_SOURCES, PLATFORM_GUIDELINES, PLATFORM_LINKS } from '../src/features/library/libraryCatalogue'
import { blankDraft, canManageHospitalLibrary, filterGuidelines, filterNews, guidelineOptions, initials, isHttpUrl, linkGroups, newsCounts, sourceState, validateDraft } from '../src/features/library/libraryModel'
import { dueSources, EXCERPT_LIMIT, MAX_ITEMS_PER_CHECK, newsRows } from '../supabase/functions/_shared/libraryNews.ts'
import { parseFeed, parsePage } from '../supabase/functions/_shared/legislationWatch.ts'
import { readSource } from './helpers/readSource'
import type { LibraryNews, NewsSettings } from '../src/features/library/libraryTypes'

const read = file => readSource(file)
const migration = read('supabase/migrations/20261203200000_library.sql')
const seed = read('supabase/migrations/20261203200100_library_seed.sql')
const cleanup = read('supabase/migrations/20261231618000_library_cleanup.sql')
const ingest = read('supabase/functions/library-news-ingest/index.ts')

describe('library catalogue (the platform starting content)', () => {
  it('holds the owner-approved links in their groups, the defunct ones in «Αρχείο» with a note', () => {
    const byAbbreviation = Object.fromEntries(PLATFORM_LINKS.map(item => [item.abbreviation, item]))
    for (const [abbreviation, domain, group] of [['ΕΟΔΥ', 'eody.gov.gr', 'greek'], ['ΕΕΕΛ', 'eeel.gr', 'greek'], ['ΕΕΛ', 'loimoxeis.gr', 'greek'], ['AIDS', 'aidshellas.gr', 'greek'], ['CDC', 'cdc.gov', 'international'], ['APIC', 'apic.org', 'international'], ['HIS', 'his.org.uk', 'international'], ['AORN', 'aorn.org', 'international'], ['CHICA', 'ipac-canada.org', 'international'], ['WHO', 'who.int', 'international'], ['ΕΣΝΕ', 'esne.gr', 'nursing'], ['ICN', 'icn.ch', 'nursing'], ['ANA', 'nursingworld.org', 'nursing'], ['CNA', 'cna-aiic.ca', 'nursing'], ['RCN', 'rcn.org.uk', 'nursing'], ['NS', 'journals.rcni.com', 'nursing'], ['ΕΝΕ', 'enne.gr', 'nursing']]) {
      expect(byAbbreviation[abbreviation]?.url, abbreviation).toContain(domain)
      expect(byAbbreviation[abbreviation].group, abbreviation).toBe(group)
      expect(byAbbreviation[abbreviation].proposed, abbreviation).toBe(false)
    }
    for (const abbreviation of ['ICNA', 'SARS', 'NMAP', 'RCNA']) {
      expect(byAbbreviation[abbreviation].group).toBe('archive')
      expect(byAbbreviation[abbreviation].noteEl).toBeTruthy()
      expect(byAbbreviation[abbreviation].noteEn).toBeTruthy()
    }
    for (const abbreviation of ['ECDC', 'ΕΟΦ', 'NHSN', 'IDSA', 'EUC', 'SSC', 'AWaRe']) expect(byAbbreviation[abbreviation].proposed, abbreviation).toBe(true)
    expect(byAbbreviation.HIS.descriptionEl).toContain('Hospital Infection Society')
  })

  it('has a description in both languages for every link, within the card limit', () => {
    for (const item of PLATFORM_LINKS) {
      expect(item.descriptionEl.length, item.name).toBeGreaterThan(10)
      expect(item.descriptionEn.length, item.name).toBeGreaterThan(10)
      expect(item.descriptionEl.length, item.name).toBeLessThanOrEqual(160)
      expect(/[Α-Ωα-ωά-ώ]/.test(item.descriptionEn), item.name).toBe(false)
      expect(isHttpUrl(item.url), item.name).toBe(true)
    }
  })

  it('lists only well-known guidelines with organisation and year, linked to the publisher', () => {
    for (const item of PLATFORM_GUIDELINES) {
      expect(item.organisation, item.name).toBeTruthy()
      expect(isHttpUrl(item.url), item.name).toBe(true)
      if (item.language === 'en') expect(item.year, item.name).toBeGreaterThan(2000)
    }
    expect(PLATFORM_GUIDELINES.find(item => item.abbreviation === 'SSC')).toMatchObject({ organisation: 'SCCM / ESICM', year: 2021 })
  })

  it('seeds exactly the catalogue rows in the migration', () => {
    for (const item of [...PLATFORM_LINKS, ...PLATFORM_GUIDELINES]) {
      // The seed, as corrected later by the cleanup migration (links that moved, each guideline's own page).
      expect(seed + cleanup, item.name).toContain(`${item.name.replace(/'/g, "''")}`)
      expect(seed + cleanup, item.name).toContain(`${item.url}`)
    }
    for (const source of NEWS_SOURCES) expect(seed, source.name).toContain(`'${source.url}'`)
    expect((seed.match(/\(null, '(link|guideline)'/g) || []).length).toBe(PLATFORM_LINKS.length + PLATFORM_GUIDELINES.length)
    // Run once: the Platform Owner's later edits are never overwritten.
    expect(seed).toContain('if exists (select 1 from public.library_items where organization_id is null) then')
  })
})

describe('library model', () => {
  const hospital = { id: 'h1', organizationId: 'org-1', kind: 'link', group: 'hospital', name: 'Πρωτόκολλα ΜΕΘ', url: 'https://intranet.example.org', descriptionEl: 'Εσωτερικά', tags: ['internal'], status: 'published' }
  const items = [...PLATFORM_LINKS, ...PLATFORM_GUIDELINES, hospital]

  it('groups the links, the hospital additions in their own group', () => {
    const { groups, counts, total } = linkGroups(items)
    expect(groups.map(group => group.value)).toEqual(['greek', 'international', 'nursing', 'archive', 'hospital'])
    expect(counts.hospital).toBe(1)
    expect(total).toBe(PLATFORM_LINKS.length + 1)
    expect(linkGroups(items, { query: 'eody' }).total).toBe(1)
    expect(linkGroups(items, { query: 'υγιεινη χεριων' }).total).toBeGreaterThan(0)
    expect(linkGroups(items, { group: 'archive' }).groups.map(group => group.value)).toEqual(['archive'])
  })

  it('filters guidelines by organisation, topic and year, newest first', () => {
    const options = guidelineOptions(items)
    expect(options.organisations).toContain('WHO')
    expect(options.years[0]).toBe(2026)
    const who = filterGuidelines(items, { query: '', organisation: 'WHO', topic: 'all', year: 'all' })
    expect(who.every(item => item.organisation === 'WHO')).toBe(true)
    expect(filterGuidelines(items, { query: '', organisation: 'all', topic: 'sepsis', year: '2021' }).map(item => item.abbreviation)).toEqual(['SSC'])
  })

  it('lets only the Hospital Admin and the Quality Manager (and the Platform Owner, the Demo) add for the hospital', () => {
    for (const role of ['hospital_admin', 'quality_manager', 'platform_owner', 'demo']) expect(canManageHospitalLibrary(role), role).toBe(true)
    for (const role of ['staff_user', 'infection_control_lead', 'department_user', 'hospital_director']) expect(canManageHospitalLibrary(role), role).toBe(false)
  })

  it('validates the form', () => {
    expect(validateDraft(blankDraft('link'))).toMatchObject({ name: 'required', url: 'url', descriptionEl: 'required' })
    expect(validateDraft({ ...blankDraft('link'), name: 'ECDC', url: 'https://www.ecdc.europa.eu', descriptionEl: 'Ευρωπαϊκή επιτήρηση' })).toEqual({})
    expect(validateDraft({ ...blankDraft('link'), name: 'ECDC', url: 'https://www.ecdc.europa.eu', descriptionEl: 'x', news: { enabled: true, url: 'feed' } as NewsSettings }).newsUrl).toBe('url')
    expect(validateDraft({ ...blankDraft('clinical_guide', 'hospital'), name: 'Σήψη', file: { name: 'sepsis.pdf' } as File })).toEqual({})
    expect(validateDraft({ ...blankDraft('guideline'), name: 'Οδηγία', url: 'https://example.org', year: '21' }).year).toBe('year')
  })

  it('shows initials, never a logo', () => {
    expect(initials({ abbreviation: 'ECDC', name: 'European Centre' })).toBe('ECDC')
    expect(initials({ name: 'Royal College of Nursing' })).toBe('RCN')
  })

  it('counts and filters the news; a source is «not answering» after 3 failures', () => {
    const news = [{ id: 'a', sourceAbbreviation: 'ECDC', publishedAt: '2026-10-19T10:00:00Z' }, { id: 'b', sourceAbbreviation: 'ΕΟΔΥ', publishedAt: '2026-10-17T10:00:00Z' }, { id: 'c', organizationId: 'org-1', publishedAt: '2026-10-12T10:00:00Z' }] as LibraryNews[]
    expect(newsCounts(news, new Set(['a']))).toEqual({ all: 3, greek: 1, international: 1, hospital: 1, unread: 2 })
    expect(filterNews(news, 'all').map(item => item.id)).toEqual(['a', 'b', 'c'])
    expect(filterNews(news, 'unread', new Set(['a'])).map(item => item.id)).toEqual(['b', 'c'])
    expect(sourceState({ active: true, consecutiveFailures: 3, lastOkAt: '2026-10-01' })).toBe('failing')
    expect(sourceState({ active: true, consecutiveFailures: 0, lastOkAt: '' })).toBe('unchecked')
    expect(sourceState({ active: false })).toBe('off')
  })
})

describe('library news ingestion (library-news-ingest)', () => {
  it('checks only the sources that are due', () => {
    const now = Date.parse('2026-10-20T12:00:00Z')
    const sources = [
      { id: 'new', kind: 'rss', interval_hours: 2, last_checked_at: null },
      { id: 'fresh', kind: 'rss', interval_hours: 2, last_checked_at: '2026-10-20T11:00:00Z' },
      { id: 'due', kind: 'rss', interval_hours: 2, last_checked_at: '2026-10-20T09:59:00Z' },
      { id: 'daily', kind: 'page', interval_hours: 24, last_checked_at: '2026-10-20T00:00:00Z' },
      { id: 'off', kind: 'rss', interval_hours: 2, last_checked_at: null, active: false },
    ] as never
    expect(dueSources(sources, now).map(source => source.id)).toEqual(['new', 'due'])
  })

  it('keeps title, link, date and a short excerpt only', () => {
    const long = 'Λέξη '.repeat(200)
    const xml = `<rss><channel>${Array.from({ length: 30 }, (_, i) => `<item><title>Item ${i}</title><link>https://example.org/${i}</link><guid>g${i}</guid><pubDate>Mon, 19 Oct 2026 10:00:00 GMT</pubDate><description>${long}</description></item>`).join('')}</channel></rss>`
    const rows = newsRows('s1', parseFeed(xml))
    expect(rows).toHaveLength(MAX_ITEMS_PER_CHECK)
    expect(rows[0]).toMatchObject({ source_id: 's1', item_key: 'g0', title: 'Item 0', url: 'https://example.org/0', published_at: '2026-10-19T10:00:00.000Z' })
    expect(rows[0].excerpt.length).toBeLessThanOrEqual(EXCERPT_LIMIT)
    expect(newsRows('s1', [{ key: 'k', title: 'Bad link', url: 'javascript:alert(1)', excerpt: '', published: 'not a date' }])[0]).toMatchObject({ url: null, published_at: null })
    expect(newsRows('s1', parseFeed(xml), ['item 3'])).toHaveLength(1)
  })

  it('keeps the newest items of a feed that mixes years, and only the articles of a page', () => {
    const xml = `<rss><channel>${[['old', 'Mon, 02 Jun 2018 10:00:00 GMT'], ['new', 'Sat, 10 Oct 2026 07:49:45 GMT'], ['mid', 'Tue, 06 Oct 2020 16:42:38 GMT'], ['nodate', '']].map(([key, date]) => `<item><title>Item ${key}</title><link>https://example.org/${key}</link><guid>${key}</guid>${date ? `<pubDate>${date}</pubDate>` : ''}</item>`).join('')}</channel></rss>`
    expect(newsRows('s1', parseFeed(xml)).map(row => row.item_key)).toEqual(['new', 'mid', 'old', 'nodate'])
    const html = '<a href="/mmwr/volumes/75/wr/mm7545a2.htm">Respiratory Virus Activity — United States, July 2025–June 2026</a><a href="/mmwr/publications/index.html">View all Publications of the series</a><a href="/mmwr/volumes/75/wr/mm7544a1.htm">Use of Glucagon-Like Peptide-1 Medications Among Adults</a>'
    expect(parsePage(html, 'https://www.cdc.gov/mmwr/index.html').map(item => item.url)).toHaveLength(3)
    expect(parsePage(html, 'https://www.cdc.gov/mmwr/index.html', '^/mmwr/volumes/').map(item => item.url)).toEqual(['https://www.cdc.gov/mmwr/volumes/75/wr/mm7545a2.htm', 'https://www.cdc.gov/mmwr/volumes/75/wr/mm7544a1.htm'])
    expect(parsePage(html, 'https://www.cdc.gov/mmwr/index.html', '([')).toHaveLength(3)
    expect(ingest).toContain('parsePage(page.body, source.url, source.link_pattern)')
    expect(readSource('src/features/library/libraryService.ts')).toContain(".order('listed_at', { ascending: false })")
  })

  it('is server-only, behind the scheduler secret, and survives a failing source', () => {
    expect(ingest).toContain("admin.rpc('platform_scheduler_secret_valid', { p_secret: secret })")
    expect(ingest).toContain("return reply({ error: 'Unauthorized' }, 401)")
    expect(ingest).not.toContain('serveWithCors(')
    expect(ingest).toContain('setTimeout(() => controller.abort(), 10000)')
    expect(ingest).toMatch(/for \(const source of due\) \{[\s\S]*try \{[\s\S]*\} catch \(caught\) \{[\s\S]*consecutive_failures/)
    expect(read('supabase/config.toml')).toMatch(/\[functions\.library-news-ingest\]\s*verify_jwt = false/)
    expect(read('supabase/maintenance/library_news_schedule.sql')).toContain("cron.schedule('limoxis-library-news'")
  })
})

describe('library database rules', () => {
  it('lets every member read the platform rows and their own hospital rows', () => {
    expect(migration).toContain('create policy library_items_read on public.library_items for select to authenticated using (\n  organization_id is null or (select public.is_org_member(organization_id)));')
    expect(migration).toContain('create policy library_news_read on public.library_news for select to authenticated using (\n  organization_id is null or (select public.is_org_member(organization_id)));')
  })

  it('lets the Platform Owner write the platform rows and the Hospital Admin / Quality Manager their hospital rows', () => {
    expect(migration).toContain("case when organization_id is null then (select public.current_user_is_platform_owner())\n  else (select public.current_user_has_org_role(organization_id, array['hospital_admin','quality_manager']::public.app_role[])) end);")
    expect(migration).toContain('create policy library_sources_owner_insert on public.library_sources for insert to authenticated with check ((select public.current_user_is_platform_owner()));')
    // What a feed found is written by the Edge Function (service role) only.
    expect(migration).toContain('source_id is null and organization_id is not null\n  and (select public.current_user_has_org_role(organization_id')
    expect(migration).toContain('revoke all on public.library_items, public.library_sources, public.library_news from anon;')
  })

  it('keeps the guide files private, platform/ for everyone, <hospital>/ for its members', () => {
    expect(migration).toContain("values ('library-files', 'library-files', false, 10485760")
    expect(migration).toContain("(storage.foldername(name))[1] = 'platform' and (select public.current_user_is_platform_owner())")
    expect(migration).toContain('revoke all on function private.platform_dispatch_library_news() from public, anon, authenticated;')
  })
})
