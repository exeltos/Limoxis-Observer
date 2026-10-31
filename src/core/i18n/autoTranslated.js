import { useEffect, useState } from 'react'
import { supabase } from '../supabase/client'

// Which English texts of a list are an automatic translation (not written by a person):
// the keys look like «<id>:<field>» (library_items: description_el, summary_el, note_el, limoxis_note_el; quality_objectives: title).
export async function loadAutoTranslated(entity, ids) {
  const list = [...new Set((ids || []).filter(Boolean))].slice(0, 500)
  if (!list.length) return new Set()
  const { data, error } = await supabase.from('content_translations').select('entity_id,field').eq('entity', entity).eq('origin', 'auto').in('entity_id', list)
  if (error) return new Set()
  return new Set((data || []).map(row => `${row.entity_id}:${row.field}`))
}

// Only asked for in English and outside the demo; a failure means «no mark», never an error on the screen.
export function useAutoTranslated(entity, ids, { enabled = true } = {}) {
  const [marked, setMarked] = useState(() => new Set())
  const key = enabled ? [...new Set(ids || [])].sort().join(',') : ''
  useEffect(() => {
    if (!key) { setMarked(new Set()); return undefined }
    let active = true
    loadAutoTranslated(entity, key.split(',')).then(set => { if (active) setMarked(set) }).catch(() => {})
    return () => { active = false }
  }, [entity, key])
  return marked
}
