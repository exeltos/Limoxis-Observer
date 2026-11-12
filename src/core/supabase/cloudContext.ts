import { supabase } from './client'

// The checks every cloud service makes before it reads or writes: Supabase is
// configured and, when an organization is passed, one is selected.
// assertCloud() checks Supabase only; assertCloud(organizationId) also the organization.
export function assertCloud(...args) {
  if (!supabase) throw new Error('Supabase is not configured.')
  if (args.length && !args[0]) throw new Error('Organization is required.')
}

// The signed-in user's id, for created_by / updated_by columns.
export async function currentUserId() {
  assertCloud()
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  const id = data?.user?.id
  if (!id) throw new Error('Authenticated user is required.')
  return id
}
