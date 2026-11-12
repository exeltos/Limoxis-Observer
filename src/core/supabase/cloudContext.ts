import { supabase, type Cloud } from './client'

// The checks every cloud service makes before it reads or writes: Supabase is
// configured and, when an organization is passed, one is selected.
// assertCloud() checks Supabase only; assertCloud(organizationId) also the organization.
export function assertCloud(...args: unknown[]): void {
  cloudClient(...args)
}

// Όπως το assertCloud, και επιστρέφει τον client για τον κώδικα TypeScript.
export function cloudClient(...args: unknown[]): Cloud {
  if (!supabase) throw new Error('Supabase is not configured.')
  if (args.length && !args[0]) throw new Error('Organization is required.')
  return supabase
}

// The signed-in user's id, for created_by / updated_by columns.
export async function currentUserId(): Promise<string> {
  const { data, error } = await cloudClient().auth.getUser()
  if (error) throw error
  const id = data?.user?.id
  if (!id) throw new Error('Authenticated user is required.')
  return id
}
