import { invokeAuthenticatedFunction } from '../../core/supabase/client'
import { isOwnerPreview } from '../../core/preview/ownerPreview'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { chunk } from './bulkAccountsModel'
import { ACTIVE_USERS_CHUNK, requestUser } from './activeUsersModel'
import type { ActiveUserResult, ActiveUserVerdict, CheckedPerson, CreatedActiveUser } from './activeUsersModel'

// «Νέος προσωρινός κωδικός»: τι στέλνει η οθόνη και τι επιστρέφει ο server (μία φορά ο κωδικός).
export type ReissueRequest = { organizationId: string | null | undefined, userId: string | null | undefined, passwordMode: string, phone: string }
export type ReissueResult = { ok?: boolean, temporaryPassword: string, temporaryPasswordExpiresAt?: string | null, passwordMode?: string }

// «Ενεργοί χρήστες» (Platform Owner only; the Edge Function refuses anyone else).
const FUNCTION = 'platform-create-active-users'
// The owner's preview frame and the Demo run on sample people: nothing is sent.
const simulated = () => isOwnerPreview() || isDemoDataEnvironment()

// The check before anything is created (dryRun), in chunks of 25.
export async function previewActiveUsers(organizationId: string | null | undefined, people: CheckedPerson[]): Promise<ActiveUserVerdict[]> {
  if (simulated()) return people.map((person: CheckedPerson) => ({ line: person.line, status: 'ok', code: null }))
  const results: ActiveUserVerdict[] = []
  for (const part of chunk(people, ACTIVE_USERS_CHUNK)) {
    const data = await invokeAuthenticatedFunction(FUNCTION, { organizationId, dryRun: true, users: part.map(requestUser) })
    results.push(...(data.results || []))
  }
  return results
}

// A sample password for the preview frame only (never a real account).
const samplePassword = () => `Prv-${Math.random().toString(36).slice(2, 8)}#${Math.floor(10 + Math.random() * 89)}`

// The creation, in chunks of 25; onProgress(done, total). Each row comes back with
// its username and, once, its temporary password.
export async function createActiveUsers(organizationId: string | null | undefined, people: CheckedPerson[], { onProgress }: { onProgress?: (done: number, total: number) => void } = {}) {
  const byLine = new Map(people.map((person: CheckedPerson) => [person.line, person]))
  const results: CreatedActiveUser[] = []
  let done = 0
  onProgress?.(0, people.length)
  for (const part of chunk(people, ACTIVE_USERS_CHUNK)) {
    const rows: ActiveUserResult[] = simulated()
      ? part.map((person: CheckedPerson) => ({ line: person.line, status: 'created', code: null, username: person.username || `${person.fullName.slice(0, 1).toUpperCase() || 'X'}U${10000 + done}`, temporaryPassword: samplePassword(), welcomeEmail: Boolean(person.email) }))
      : (await invokeAuthenticatedFunction(FUNCTION, { organizationId, users: part.map(requestUser) })).results || []
    for (const row of rows) {
      const person: Partial<CheckedPerson> = byLine.get(row.line) || {}
      results.push({ ...person, ...row, email: person.email || '' })
    }
    done += part.length
    onProgress?.(done, people.length)
  }
  return results
}

// «Νέος προσωρινός κωδικός» for an existing account: a new 7-day password; it also unlocks an account
// locked after the deadline. The password comes back once. The preview frame / Demo send nothing.
export async function reissueTemporaryPassword({ organizationId, userId, passwordMode, phone }: ReissueRequest): Promise<ReissueResult> {
  if (simulated()) return { ok: true, temporaryPassword: samplePassword(), temporaryPasswordExpiresAt: new Date(Date.now() + 7 * 86400000).toISOString(), passwordMode }
  return invokeAuthenticatedFunction(FUNCTION, { action: 'reissue', organizationId, userId, passwordMode, phone })
}
