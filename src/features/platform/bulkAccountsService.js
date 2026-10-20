import { supabase, invokeAuthenticatedFunction } from '../../core/supabase/client'
import { isOwnerPreview } from '../../core/preview/ownerPreview'
import { previewCreateAccounts, previewEmail, previewEmployeeAccounts, previewResend } from '../../core/preview/bulkAccountsPreview'
import { CHUNK_SIZE, RESEND_CHUNK_SIZE, chunk, normalizeRosterRow } from './bulkAccountsModel'

// N1 · bulk creation of accounts from the employee roster (Platform Owner only;
// the RPC and the Edge Function refuse anyone else).
const FUNCTION = 'platform-bulk-create-accounts'

export async function loadEmployeeAccounts(organizationId) {
  const data = isOwnerPreview()
    ? previewEmployeeAccounts(organizationId)
    : await (async () => {
        if (!supabase) return { employees: [], departments: [] }
        const { data: result, error } = await supabase.rpc('platform_employee_accounts', { p_organization_id: organizationId })
        if (error) throw error
        return result || {}
      })()
  return {
    employees: (data.employees || []).map(normalizeRosterRow),
    departments: data.departments || [],
  }
}

// The confirmation (dryRun): people per role, who is skipped, e-mails that already
// have an account in another hospital, the link's validity, the e-mail preview.
export async function previewBulkAccounts(organization, items, rows) {
  if (isOwnerPreview()) {
    const byId = new Map(rows.map(row => [row.employeeId, row]))
    const existing = items
      .map(item => byId.get(item.employeeId))
      .filter(row => row?.existing)
      .map(row => ({ employeeId: row.employeeId, name: row.name, email: row.email, role: items.find(item => item.employeeId === row.employeeId).role, existingName: row.existing.name, organizations: row.existing.organizations }))
    const expires = new Date()
    expires.setDate(expires.getDate() + 7)
    expires.setHours(23, 59, 0, 0)
    const first = items.map(item => byId.get(item.employeeId)).find(row => row && !row.existing)
    return { ok: true, expiresAt: expires.toISOString(), existing, skipped: [], emailPreview: first ? { ...previewEmail(first.name, organization), to: first.email } : null }
  }
  return invokeAuthenticatedFunction(FUNCTION, { action: 'preview', organizationId: organization.id, items })
}

// The run, in chunks of 25 with one batchKey (a retry of a chunk returns the same
// rows; the server never makes two accounts for one employee), then «finish»
// (audit, summary to the hospital's administrators). onProgress(done, total).
export async function createBulkAccounts(organizationId, items, { confirmExisting = [], onProgress } = {}) {
  if (isOwnerPreview()) {
    onProgress?.(items.length, items.length)
    return previewCreateAccounts(items, confirmExisting)
  }
  const batchKey = crypto.randomUUID()
  const results = []
  let done = 0
  onProgress?.(0, items.length)
  for (const part of chunk(items, CHUNK_SIZE)) {
    const data = await invokeWithRetry({ action: 'create', organizationId, batchKey, total: items.length, items: part, confirmExisting })
    results.push(...(data.results || []))
    done += part.length
    onProgress?.(done, items.length)
  }
  const finished = await invokeWithRetry({ action: 'finish', organizationId, batchKey })
  return { batchKey, batchId: finished.batchId, results, totals: finished.totals }
}

// One retry after a network failure: the same batchKey and items give back the same rows.
async function invokeWithRetry(body) {
  try {
    return await invokeAuthenticatedFunction(FUNCTION, body)
  } catch (error) {
    if (!/fetch|network|timeout|Failed to send/i.test(String(error?.message || ''))) throw error
    return invokeAuthenticatedFunction(FUNCTION, body)
  }
}

// «Ξαναστείλε»: a new link (the old one stops working) for people who have not activated.
export async function resendAccountAccess(organizationId, employeeIds) {
  if (isOwnerPreview()) return previewResend(employeeIds)
  const results = []
  for (const part of chunk(employeeIds, RESEND_CHUNK_SIZE)) {
    const data = await invokeAuthenticatedFunction(FUNCTION, { action: 'resend', organizationId, employeeIds: part })
    results.push(...(data.results || []))
  }
  return { results }
}
