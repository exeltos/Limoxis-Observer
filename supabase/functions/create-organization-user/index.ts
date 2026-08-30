// Supabase Edge Function: create-organization-user
//
// Creates a staff account that signs in with an auto-generated username
// instead of a personal email. Must be deployed with the Supabase CLI —
// see supabase/functions/create-organization-user/README.md.
//
// Request body: { organizationId: string, fullName: string, role: string }
// Response:     { username: string, temporaryPassword: string, userId: string }
//
// The caller must be authenticated and hold the 'hospital_admin' role (or be
// the platform owner) on the target organization — enforced below using the
// same rule as the organization_members RLS policies.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ROLES = [
  'platform_owner',
  'hospital_admin',
  'infection_control_lead',
  'link_nurse',
  'doctor_reviewer',
  'department_user',
  'laboratory',
  'staff_user',
]

function randomPassword() {
  const bytes = new Uint8Array(18)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, '').slice(0, 20)
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return new Response(JSON.stringify({ error: 'Function is not configured' }), { status: 500 })
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  const jwt = authHeader.replace(/^Bearer\s+/i, '')
  if (!jwt) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401 })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 })
  }
  const { organizationId, fullName, role } = body ?? {}
  if (!organizationId || !fullName || !role) {
    return new Response(JSON.stringify({ error: 'organizationId, fullName and role are required' }), { status: 400 })
  }
  if (!ALLOWED_ROLES.includes(role)) {
    return new Response(JSON.stringify({ error: `Unknown role: ${role}` }), { status: 400 })
  }

  // Verify the caller's identity with the anon client + their own JWT (no service role yet).
  const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${jwt}` } } })
  const { data: callerData, error: callerError } = await callerClient.auth.getUser()
  if (callerError || !callerData?.user) {
    return new Response(JSON.stringify({ error: 'Invalid session' }), { status: 401 })
  }

  const admin = createClient(supabaseUrl, serviceRoleKey)

  // Authorize: caller must be platform owner or hold hospital_admin on this organization.
  const { data: callerProfile } = await admin.from('profiles').select('is_platform_owner').eq('id', callerData.user.id).maybeSingle()
  let authorized = Boolean(callerProfile?.is_platform_owner)
  if (!authorized) {
    const { data: membership } = await admin
      .from('organization_members')
      .select('role,status')
      .eq('organization_id', organizationId)
      .eq('user_id', callerData.user.id)
      .eq('status', 'active')
      .maybeSingle()
    authorized = membership?.role === 'hospital_admin'
  }
  if (!authorized) {
    return new Response(JSON.stringify({ error: 'Not authorized to create users for this organization' }), { status: 403 })
  }

  // Generate the username the same way the database would (transliterated, unique).
  const { data: username, error: usernameError } = await admin.rpc('generate_username', { source_name: fullName })
  if (usernameError || !username) {
    return new Response(JSON.stringify({ error: 'Could not generate a username' }), { status: 500 })
  }

  const syntheticEmail = `${username}@users.limoxis.local`
  const temporaryPassword = randomPassword()

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: syntheticEmail,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: { full_name: fullName, username, is_platform_owner: false },
  })
  if (createError || !created?.user) {
    return new Response(JSON.stringify({ error: createError?.message || 'Could not create the user' }), { status: 500 })
  }

  const { error: memberError } = await admin.from('organization_members').insert({
    organization_id: organizationId,
    user_id: created.user.id,
    role,
    status: 'active',
  })
  if (memberError) {
    // Roll back the auth user so we don't leave an orphaned account behind.
    await admin.auth.admin.deleteUser(created.user.id)
    return new Response(JSON.stringify({ error: memberError.message }), { status: 500 })
  }

  return new Response(JSON.stringify({ username, temporaryPassword, userId: created.user.id }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
