// Optimistic concurrency for record editing (the Surgitrack pattern): a save
// names the version the editor loaded (updated_at). The database moves
// updated_at on every update, so if someone else saved in between, the guarded
// update matches no row and the save is refused with CONFLICT instead of
// silently overwriting their changes.
import { DataAccessError } from './repository'

// Adds the version condition to an update query when the loaded version is known.
export function expectVersion(query, updatedAt) {
  return updatedAt ? query.eq('updated_at', updatedAt) : query
}

// Runs a guarded `.update(...).select(...).single()` query: "no row" means the
// record changed (or was removed) since it was loaded.
export async function guardedSingle(query, { table, updatedAt } = {}) {
  const { data, error } = await query
  if (error?.code === 'PGRST116' && updatedAt) throw new DataAccessError('Someone else already changed this record. Reload it before saving again.', { table, operation: 'update', code: 'CONFLICT' })
  if (error) throw error
  return data
}
