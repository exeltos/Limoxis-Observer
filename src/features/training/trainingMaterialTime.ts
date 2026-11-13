import { cloudClient } from '../../core/supabase/cloudContext'
// A file of the programme as the learner's link sees it, and the time counted on it.
export type AccessFile = { id: string, fileName?: string, mimeType?: string, activeSeconds?: number }
export type TrackedTime = { activeSeconds?: number, [key: string]: unknown }

// Time a participant spends on the files of a programme (the personal link; migration
// 20261231180000_training_material_time.sql). The page counts ACTIVE seconds only: the tab
// is visible and the person has used the page (mouse, key, scroll, touch) in the last minute.
export const IDLE_AFTER_SECONDS = 60
export const SEND_EVERY_SECONDS = 15
const MAX_PER_CALL = 30

// Accumulates active seconds; tick() is called once a second by the reader.
export function createActiveTimer({ now = () => Date.now(), idleAfter = IDLE_AFTER_SECONDS } = {}) {
  let lastActivity = now()
  let pending = 0
  return {
    activity() { lastActivity = now() },
    // One second passed: counts it only when the page is visible and in use.
    tick(visible: boolean) {
      if (!visible) return false
      if (now() - lastActivity > idleAfter * 1000) return false
      pending += 1
      return true
    },
    pending() { return pending },
    // The seconds to send (at most MAX_PER_CALL); the rest stays for the next call.
    take() { const seconds = Math.min(pending, MAX_PER_CALL); pending -= seconds; return seconds },
    restore(seconds: number) { pending += seconds },
  }
}

export async function loadAccessFiles(token: string): Promise<AccessFile[]> {
  const { data, error } = await cloudClient().rpc('training_access_files', { p_token: token })
  if (error) throw error
  return Array.isArray(data) ? data as AccessFile[] : []
}

export async function trackMaterialTime(token: string, attachmentId: string, seconds: number, page: number | null = null) {
  const { data, error } = await cloudClient().rpc('training_track_time', { p_token: token, p_attachment_id: attachmentId, p_seconds: seconds, p_page: page as number })
  if (error) throw error
  return data as TrackedTime | null
}

// A short-lived link to the file (the training-material-url function checks the token).
export async function loadMaterialUrl(token: string, attachmentId: string) {
  const { data, error } = await cloudClient().functions.invoke('training-material-url', { body: { token, attachmentId } })
  if (error) throw error
  if (!data?.ok) throw new Error(data?.code || 'TRAINING_MATERIAL_UNAVAILABLE')
  return data
}

// The managers' side: the seconds of each participant on each file of the programme.
export async function loadProgramMaterialTimes(programDbId: string | null | undefined) {
  if (!programDbId) return []
  const { data, error } = await cloudClient().from('training_material_views').select('assignment_id,attachment_id,active_seconds,last_page,opened_count,first_opened_at,last_seen_at').eq('program_id', programDbId)
  if (error) throw error
  return data || []
}

export function formatActiveTime(seconds: unknown, en = false) {
  const total = Math.max(0, Math.round(Number(seconds) || 0))
  if (!total) return '—'
  if (total < 60) return en ? `${total} s` : `${total} δ`
  const minutes = Math.floor(total / 60), rest = total % 60
  if (minutes < 60) return rest ? (en ? `${minutes} min ${rest} s` : `${minutes}΄ ${rest}΄΄`) : (en ? `${minutes} min` : `${minutes}΄`)
  const hours = Math.floor(minutes / 60)
  return en ? `${hours} h ${minutes % 60} min` : `${hours} ώ ${minutes % 60}΄`
}
