// Αυτόματη μετάφραση θεσμικού κειμένου (docs/TRANSLATION_DESIGN.md, φάση 1).
// Καλείται από το platform-scheduled-tasks (task «translate_content»), ποτέ από browser.
// Κανόνες: μόνο τα πεδία της λίστας παρακάτω· δεν αντικαθίσταται ποτέ υπάρχον αγγλικό κείμενο που
// δεν είναι προηγούμενη αυτόματη μετάφραση· ανά νοσοκομείο opt-in και μηνιαίο όριο χαρακτήρων.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any

export const TRANSLATABLE: Record<string, Record<string, { dst: string; max?: number }>> = {
  library_items: {
    description_el: { dst: 'description_en', max: 400 },
    summary_el: { dst: 'summary_en' },
    note_el: { dst: 'note_en' },
    limoxis_note_el: { dst: 'limoxis_note_en' },
  },
  quality_objectives: { title: { dst: 'title_en' } },
}

// Σταθεροί όροι: ο πάροχος τους βλέπει στην οδηγία ώστε να μεταφράζονται πάντα ίδια.
export const GLOSSARY: Array<[string, string]> = [
  ['ΜΕΘ', 'ICU'], ['ΜΕΝΝ', 'NICU'], ['ΤΕΠ', 'Emergency Department'], ['ΛΣΦΥ', 'healthcare-associated infection (HAI)'],
  ['Λοίμωξη σχετιζόμενη με τη φροντίδα υγείας', 'Healthcare-associated infection'], ['Ποιότητα', 'Quality'], ['Μητρώο τμήματος', 'Department register'],
  ['Έλεγχος λοιμώξεων', 'Infection control'], ['Προϊστάμενος', 'Head nurse'], ['Στόχος', 'Objective'], ['Ανεπιθύμητο συμβάν', 'Adverse event'],
]

const clean = (value: unknown) => String(value ?? '').trim()
const outputText = (payload: any) => clean(payload?.output_text || payload?.output?.flatMap((item: any) => item?.content || []).map((item: any) => item?.text || '').join('\n'))

async function sha256(text: string) {
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

async function translate(cfg: any, text: string, max?: number): Promise<string> {
  const glossary = GLOSSARY.map(([el, en]) => `${el} = ${en}`).join('\n')
  const system = [
    'You translate short institutional texts of a hospital quality and infection-prevention platform from Greek to English.',
    'Return only the English translation: no quotes, no notes, no added or removed information. Keep line breaks, numbers, abbreviations and names of organisations as they are.',
    max ? `The translation must not exceed ${max} characters.` : '',
    'Use these fixed terms:\n' + glossary,
  ].filter(Boolean).join('\n')
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.api_key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: cfg.model || 'gpt-5.6-luna', input: [{ role: 'system', content: system }, { role: 'user', content: text }], max_output_tokens: 1200 }),
  }).catch(() => null)
  if (!response?.ok) throw new Error(`PROVIDER_${response?.status || 'ERROR'}`)
  const answer = outputText(await response.json().catch(() => null))
  if (!answer) throw new Error('PROVIDER_EMPTY')
  return max && answer.length > max ? answer.slice(0, max).replace(/\s+\S*$/, '').trim() : answer
}

// Μία παρτίδα εργασιών. Επιστρέφει πόσες έγιναν, πόσες παραλείφθηκαν και πόσες απέτυχαν.
export async function runTranslations(admin: Admin, limit = 25) {
  const result = { translated: 0, skipped: 0, failed: 0, waiting: 0 }
  const { data: jobs, error } = await admin.from('translation_jobs').select('*').in('status', ['pending', 'failed']).lt('attempts', 3).order('updated_at', { ascending: true }).limit(limit)
  if (error) throw error
  const providers = new Map<string, any>()
  const settings = new Map<string, any>()
  for (const job of jobs || []) {
    const finish = (status: string, extra: Record<string, unknown> = {}) => admin.from('translation_jobs').update({ status, updated_at: new Date().toISOString(), ...extra }).eq('id', job.id)
    const cfg = TRANSLATABLE[job.entity]?.[job.field]
    if (!cfg) { await finish('skipped', { last_error: 'FIELD_NOT_ALLOWED' }); result.skipped++; continue }
    try {
      if (!settings.has(job.organization_id)) {
        const { data } = await admin.from('organization_translation_settings').select('*').eq('organization_id', job.organization_id).maybeSingle()
        settings.set(job.organization_id, data || null)
      }
      const setting = settings.get(job.organization_id)
      if (!setting?.enabled) { await finish('skipped', { last_error: 'NOT_ENABLED' }); result.skipped++; continue }
      if (!providers.has(job.organization_id)) {
        const { data } = await admin.rpc('get_lira_provider_runtime_secret', { p_organization_id: job.organization_id })
        providers.set(job.organization_id, data?.[0]?.provider === 'openai' ? data[0] : null)
      }
      const provider = providers.get(job.organization_id)
      if (!provider) { result.waiting++; continue }

      const { data: row } = await admin.from(job.entity).select(`id,organization_id,${job.field},${cfg.dst}`).eq('id', job.entity_id).eq('organization_id', job.organization_id).maybeSingle()
      const source = clean(row?.[job.field])
      if (!row || !source) { await finish('skipped', { last_error: 'NO_SOURCE' }); result.skipped++; continue }
      const hash = await sha256(source)
      const current = clean(row[cfg.dst])
      const { data: prior } = await admin.from('content_translations').select('*').eq('organization_id', job.organization_id).eq('entity', job.entity).eq('entity_id', job.entity_id).eq('field', job.field).eq('lang', 'en').maybeSingle()
      if (current) {
        // Υπάρχει αγγλικό κείμενο: αν δεν είναι η αυτόματη μετάφραση που κρατήσαμε, το έγραψε άνθρωπος (ή υπήρχε ήδη) και μένει.
        if (!prior || prior.text !== current) {
          if (prior && prior.origin !== 'human') await admin.from('content_translations').update({ origin: 'human', text: current }).eq('id', prior.id)
          await finish('skipped', { last_error: 'ENGLISH_EXISTS' }); result.skipped++; continue
        }
        if (prior.source_hash === hash) { await finish('done'); result.skipped++; continue }
      }
      // Μηνιαίο όριο χαρακτήρων: η εργασία περιμένει τον επόμενο μήνα ή αύξηση του ορίου.
      const month = new Date().toISOString().slice(0, 7) + '-01'
      const used = setting.used_month === month ? Number(setting.used_chars || 0) : 0
      if (used + source.length > Number(setting.monthly_char_limit || 0)) { result.waiting++; continue }

      const english = await translate(provider, source, cfg.max)
      await admin.from(job.entity).update({ [cfg.dst]: english }).eq('id', job.entity_id).eq('organization_id', job.organization_id)
      await admin.from('content_translations').upsert({ organization_id: job.organization_id, entity: job.entity, entity_id: job.entity_id, field: job.field, lang: 'en', source_hash: hash, text: english, origin: 'auto', model: provider.model || null, translated_at: new Date().toISOString() }, { onConflict: 'organization_id,entity,entity_id,field,lang' })
      const nextUsed = used + source.length
      settings.set(job.organization_id, { ...setting, used_month: month, used_chars: nextUsed })
      await admin.from('organization_translation_settings').update({ used_month: month, used_chars: nextUsed }).eq('organization_id', job.organization_id)
      await finish('done', { last_error: null })
      result.translated++
    } catch (failure) {
      await finish('failed', { attempts: Number(job.attempts || 0) + 1, last_error: String((failure as Error)?.message || failure).slice(0, 200) })
      result.failed++
    }
  }
  return result
}
