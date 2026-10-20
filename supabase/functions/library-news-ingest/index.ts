import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { parseFeed, parsePage } from '../_shared/legislationWatch.ts'
import { dueSources, newsRows } from '../_shared/libraryNews.ts'

// Fills the «Νέα» tab of the Library from the sources in library_sources
// (RSS/Atom feeds or pages). Called by pg_cron (private.platform_dispatch_library_news)
// with the shared scheduler secret from Vault, never by a browser.
//
// Safe when a source fails: each source is checked on its own, one request at
// most, 10 seconds; a failure is written on the source (last_error,
// consecutive_failures) and the others carry on. Only title, link, date and an
// excerpt of at most 300 characters are kept: the article stays at its source.

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any
const MAX_SOURCES_PER_RUN = 25

async function fetchText(url: string) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 10000)
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: 'follow', headers: { 'user-agent': 'LimoxisObserver/library (+https://www.limoxis.com)', 'accept': 'application/rss+xml, application/atom+xml, application/xml, text/html;q=0.9, */*;q=0.8' } })
    const body = response.ok ? (await response.text()).slice(0, 2_000_000) : ''
    return { status: response.status, ok: response.ok, body }
  } finally { clearTimeout(timer) }
}

async function checkSources(admin: Admin) {
  const { data: sources, error } = await admin.from('library_sources').select('id,name,url,kind,interval_hours,keywords,active,last_checked_at,consecutive_failures').eq('active', true)
  if (error) throw error
  const due = dueSources(sources || []).slice(0, MAX_SOURCES_PER_RUN)
  let checked = 0, stored = 0, failed = 0
  for (const source of due) {
    const now = new Date().toISOString()
    checked++
    try {
      const page = await fetchText(source.url)
      if (!page.ok) throw new Error(`HTTP ${page.status}`)
      const items = source.kind === 'page' ? parsePage(page.body, source.url) : parseFeed(page.body)
      if (!items.length) throw new Error('NO_ITEMS')
      const rows = newsRows(source.id, items, source.keywords || [])
      if (rows.length) {
        const { error: upsertError } = await admin.from('library_news').upsert(rows, { onConflict: 'source_id,item_key', ignoreDuplicates: true })
        if (upsertError) throw upsertError
        stored += rows.length
      }
      await admin.from('library_sources').update({ last_checked_at: now, last_ok_at: now, last_status: page.status, last_error: null, consecutive_failures: 0, verified: true }).eq('id', source.id)
    } catch (caught) {
      failed++
      const message = (caught as Error)?.name === 'AbortError' ? 'TIMEOUT' : String((caught as Error)?.message || caught).slice(0, 300)
      await admin.from('library_sources').update({ last_checked_at: now, last_error: message, consecutive_failures: Number(source.consecutive_failures || 0) + 1 }).eq('id', source.id)
    }
  }
  // What a feed found is kept for a year; a hospital's own announcements stay until it removes them.
  await admin.from('library_news').delete().not('source_id', 'is', null).lt('detected_at', new Date(Date.now() - 365 * 86400000).toISOString())
  return { due: due.length, checked, stored, failed }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405)
  const url = Deno.env.get('SUPABASE_URL')
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !service) return reply({ error: 'Function is not configured' }, 500)
  const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } })

  const secret = req.headers.get('x-limoxis-scheduler') || ''
  const { data: valid, error: secretError } = await admin.rpc('platform_scheduler_secret_valid', { p_secret: secret })
  if (secretError || valid !== true) return reply({ error: 'Unauthorized' }, 401)

  try {
    return reply({ ok: true, task: 'library_watch', ...(await checkSources(admin)) })
  } catch (caught) {
    return reply({ ok: false, task: 'library_watch', error: String((caught as Error)?.message || caught).slice(0, 300) }, 500)
  }
})
