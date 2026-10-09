import { supabase } from '../../core/supabase/client'

// Which screen guides the signed-in user has already seen (user_screen_guides,
// own rows only). "*" means the user turned all screen guides off.
export async function loadSeenScreenGuides(userId) {
  if (!supabase || !userId) return new Set()
  const { data, error } = await supabase.from('user_screen_guides').select('guide_key').eq('user_id', userId).eq('dismissed', true)
  if (error) throw error
  return new Set((data || []).map(row => row.guide_key))
}

export async function markScreenGuidesSeen(userId, keys) {
  const rows = [...new Set(keys)].filter(Boolean).map(guide_key => ({ user_id: userId, guide_key, dismissed: true, updated_at: new Date().toISOString() }))
  if (!supabase || !userId || !rows.length) return
  const { error } = await supabase.from('user_screen_guides').upsert(rows, { onConflict: 'user_id,guide_key' })
  if (error) throw error
}

export async function resetScreenGuides(userId) {
  if (!supabase || !userId) return
  const { error } = await supabase.from('user_screen_guides').update({ dismissed: false, updated_at: new Date().toISOString() }).eq('user_id', userId)
  if (error) throw error
}
