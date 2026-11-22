import { describe, expect, it } from 'vitest'
import { NEWS_SOURCES, PLATFORM_CLINICAL_GUIDES, PLATFORM_GUIDELINES, PLATFORM_LINKS } from '../src/features/library/libraryCatalogue'
import { blankDraft, canManageHospitalLibrary, clinicalGuidePrintHtml, filterGuidelines, filterNews, guidelineOptions, guidelineTitle, guidelineTopicCounts, initials, isHttpUrl, linkGroups, newsByPeriod, newsCounts, newsPeriod, sourceLines, sourceState, validateDraft } from '../src/features/library/libraryModel'
import { dueSources, EXCERPT_LIMIT, MAX_AGE_DAYS, MAX_ITEMS_PER_CHECK, newsRows } from '../supabase/functions/_shared/libraryNews.ts'
import { parseFeed, parsePage } from '../supabase/functions/_shared/legislationWatch.ts'
import { readSource } from './helpers/readSource'
import type { LibraryNews, NewsSettings } from '../src/features/library/libraryTypes'

const read = file => readSource(file)
const migration = read('supabase/migrations/20261203200000_library.sql')
const seed = read('supabase/migrations/20261203200100_library_seed.sql')
const cleanup = read('supabase/migrations/20261231618000_library_cleanup.sql')
const newContent = read('supabase/migrations/20261231620000_library_new_content.sql')
const titleEl = read('supabase/migrations/20261231621000_library_title_el.sql')
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
      expect(byAbbreviation[abbreviation].status).toBe('archived')
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
    expect(PLATFORM_GUIDELINES.find(item => item.abbreviation === 'SSC')).toMatchObject({ organisation: 'SCCM / ESICM', year: 2026 })
    // Every guideline has a Greek title; the Greek-language ones keep their own name.
    for (const item of PLATFORM_GUIDELINES) {
      expect(item.titleEl, item.name).toMatch(/[Α-Ωα-ωά-ώ]/)
      if (item.language === 'el') expect(item.titleEl, item.name).toBe(item.name)
    }
  })

  it('holds the 9 one-page clinical guides with their points and sources', () => {
    expect(PLATFORM_CLINICAL_GUIDES).toHaveLength(9)
    for (const item of PLATFORM_CLINICAL_GUIDES) {
      expect(isHttpUrl(item.url), item.name).toBe(true)
      expect(item.summaryEl.split('\n').length, item.name).toBeGreaterThan(3)
      expect(item.noteEl, item.name).toMatch(/^Πηγές: /)
      expect(sourceLines(item.noteEl).length, item.name).toBeGreaterThan(0)
    }
  })

  it('seeds exactly the catalogue rows in the migrations', () => {
    // The seed, as corrected by the cleanup (links that moved, each guideline's own page) and
    // completed by the new content (guidelines, clinical guides) and the Greek titles.
    const all = seed + cleanup + newContent + titleEl
    for (const item of [...PLATFORM_LINKS, ...PLATFORM_GUIDELINES, ...PLATFORM_CLINICAL_GUIDES]) {
      expect(all, item.name).toContain(`${item.name.replace(/'/g, "''")}`)
      expect(all, item.name).toContain(`${item.url}`)
    }
    for (const item of PLATFORM_GUIDELINES) if (item.titleEl !== item.name) expect(titleEl, item.name).toContain(`set title_el = $q$${item.titleEl}$q$`)
    for (const item of PLATFORM_LINKS.filter(link => link.status === 'archived')) expect(cleanup, item.name).toContain(`'${item.url}'`)
    for (const source of NEWS_SOURCES) expect(seed, source.name).toContain(`'${source.url}'`)
    expect((seed.match(/\(null, '(link|guideline)'/g) || []).length + (newContent.match(/select null, '(guideline|clinical_guide)'/g) || []).length).toBe(PLATFORM_LINKS.length + PLATFORM_GUIDELINES.length + PLATFORM_CLINICAL_GUIDES.length)
    expect((titleEl.match(/^update public\.library_items set title_el/gm) || []).length).toBe(PLATFORM_GUIDELINES.length)
    // Run once: the Platform Owner's later edits are never overwritten.
    expect(seed).toContain('if exists (select 1 from public.library_items where organization_id is null) then')
  })
})

describe('library model', () => {
  const hospital = { id: 'h1', organizationId: 'org-1', kind: 'link', group: 'hospital', name: 'Πρωτόκολλα ΜΕΘ', url: 'https://intranet.example.org', descriptionEl: 'Εσωτερικά', tags: ['internal'], status: 'published' }
  const items = [...PLATFORM_LINKS, ...PLATFORM_GUIDELINES, hospital]

  it('groups the links, the hospital additions in their own group', () => {
    const { groups, counts, total } = linkGroups(items)
    // The withdrawn links (the «Αρχείο» ones, AIDS) are not listed.
    expect(groups.map(group => group.value)).toEqual(['greek', 'international', 'nursing', 'hospital'])
    expect(counts.hospital).toBe(1)
    expect(total).toBe(PLATFORM_LINKS.filter(link => link.status !== 'archived').length + 1)
    expect(linkGroups(items, { query: 'eody' }).total).toBe(1)
    expect(linkGroups(items, { query: 'υγιεινη χεριων' }).total).toBeGreaterThan(0)
    expect(linkGroups(items, { group: 'nursing' }).groups.map(group => group.value)).toEqual(['nursing'])
  })

  it('filters guidelines by organisation, topic and year, newest first', () => {
    const options = guidelineOptions(items)
    expect(options.organisations).toContain('WHO')
    expect(options.years[0]).toBe(2026)
    const who = filterGuidelines(items, { query: '', organisation: 'WHO', topic: 'all', year: 'all' })
    expect(who.every(item => item.organisation === 'WHO')).toBe(true)
    expect(filterGuidelines(items, { query: '', organisation: 'all', topic: 'sepsis', year: '2026' }).map(item => item.abbreviation)).toEqual(['SSC'])
    // The search finds a guideline by its Greek title too.
    expect(filterGuidelines(items, { query: 'ενδαγγειακους καθετηρες', organisation: 'all', topic: 'all', year: 'all' }).map(item => item.organisation)).toEqual(['CDC / HICPAC'])
  })

  it('shows the Greek title in Greek, the original under it, and only the original in English', () => {
    const cdc = PLATFORM_GUIDELINES.find(item => item.name === 'Guidelines for the Prevention of Intravascular Catheter-Related Infections')!
    expect(guidelineTitle(cdc, 'el')).toEqual({ main: 'Οδηγίες CDC/HICPAC για την πρόληψη λοιμώξεων από ενδαγγειακούς καθετήρες', original: cdc.name })
    expect(guidelineTitle(cdc, 'en')).toEqual({ main: cdc.name, original: '' })
    const greek = PLATFORM_GUIDELINES.find(item => item.language === 'el')!
    expect(guidelineTitle(greek, 'el')).toEqual({ main: greek.name, original: '' })
    expect(guidelineTitle({ name: 'Local protocol' }, 'el')).toEqual({ main: 'Local protocol', original: '' })
  })

  it('counts the topic chips over what the other filters leave', () => {
    const { total, topics } = guidelineTopicCounts(items)
    expect(total).toBe(PLATFORM_GUIDELINES.length)
    expect(topics[0]).toEqual({ value: 'ipc', count: PLATFORM_GUIDELINES.filter(item => item.tags.includes('ipc')).length })
    const who = guidelineTopicCounts(items, { query: '', organisation: 'WHO', topic: 'sepsis', year: 'all' })
    expect(who.total).toBe(PLATFORM_GUIDELINES.filter(item => item.organisation === 'WHO').length)
    // The chosen topic stays listed with 0, so the chip and the list keep showing the filter still applied.
    expect(who.topics.find(topic => topic.value === 'sepsis')).toEqual({ value: 'sepsis', count: 0 })
    expect(guidelineTopicCounts(items, { query: '', organisation: 'WHO', topic: 'all', year: 'all' }).topics.find(topic => topic.value === 'sepsis')).toBeUndefined()
    // A guide uploaded as an image or PDF has no text to print: it prints from «Αρχείο».
    expect(readSource('src/features/library/LibraryPage.tsx')).toContain('{points.length > 0 && <ExportMenu onPrint={print} language={language} />}')
  })

  it('prints a clinical guide on one clean page, escaped', () => {
    const guide = { ...PLATFORM_CLINICAL_GUIDES[0], name: 'Χέρια <b>' }
    const html = clinicalGuidePrintHtml(guide, 'el', { today: '2026-11-22' })
    expect(html).toContain('@page{size:A4')
    expect(html).toContain('Χέρια &lt;b&gt;')
    expect(html).toContain('<h2>Τι κάνουμε</h2>')
    expect(html).toContain('<h2>Πηγές</h2>')
    expect(html).toContain('Εκτύπωση 22/11/2026')
    expect(clinicalGuidePrintHtml(guide, 'en', { today: '2026-11-22' })).toContain('<h2>What we do</h2>')
  })

  it('groups the news under this week, this month and older (hospital time)', () => {
    const at = (publishedAt: string) => ({ id: publishedAt, title: 't', publishedAt }) as LibraryNews
    // Sunday 22/11/2026: the week started on Monday 16/11.
    expect(newsPeriod(at('2026-11-16T08:00:00Z'), '2026-11-22')).toBe('week')
    expect(newsPeriod(at('2026-11-15T22:30:00Z'), '2026-11-22')).toBe('week')
    expect(newsPeriod(at('2026-11-15T10:00:00Z'), '2026-11-22')).toBe('month')
    expect(newsPeriod(at('2026-10-31T10:00:00Z'), '2026-11-22')).toBe('older')
    expect(newsPeriod(at('2026-11-30T10:00:00Z'), '2026-12-01')).toBe('week')
    expect(newsPeriod({ id: 'x', title: 't' }, '2026-11-22')).toBe('older')
    expect(newsByPeriod([at('2026-11-20T10:00:00Z'), at('2026-10-01T10:00:00Z')], '2026-11-22').map(group => group.period)).toEqual(['week', 'older'])
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
    const now = Date.parse('2026-10-20T00:00:00Z')
    const rows = newsRows('s1', parseFeed(xml), [], now)
    expect(rows).toHaveLength(MAX_ITEMS_PER_CHECK)
    expect(rows[0]).toMatchObject({ source_id: 's1', item_key: 'g0', title: 'Item 0', url: 'https://example.org/0', published_at: '2026-10-19T10:00:00.000Z' })
    expect(rows[0].excerpt.length).toBeLessThanOrEqual(EXCERPT_LIMIT)
    expect(newsRows('s1', [{ key: 'k', title: 'Bad link', url: 'javascript:alert(1)', excerpt: '', published: 'not a date' }])[0]).toMatchObject({ url: null, published_at: null })
    expect(newsRows('s1', parseFeed(xml), ['item 3'], now)).toHaveLength(1)
  })

  it('keeps the newest items of a feed that mixes years, and only the articles of a page', () => {
    const xml = `<rss><channel>${[['old', 'Thu, 20 Aug 2026 10:00:00 GMT'], ['new', 'Sat, 10 Oct 2026 07:49:45 GMT'], ['mid', 'Tue, 01 Sep 2026 16:42:38 GMT'], ['archive', 'Mon, 02 Jun 2018 10:00:00 GMT'], ['nodate', '']].map(([key, date]) => `<item><title>Item ${key}</title><link>https://example.org/${key}</link><guid>${key}</guid>${date ? `<pubDate>${date}</pubDate>` : ''}</item>`).join('')}</channel></rss>`
    // Newest first; an item older than MAX_AGE_DAYS (the feed's archive) is never kept; undated ones are.
    expect(newsRows('s1', parseFeed(xml), [], Date.parse('2026-10-12T00:00:00Z')).map(row => row.item_key)).toEqual(['new', 'mid', 'old', 'nodate'])
    expect(MAX_AGE_DAYS).toBe(90)
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
