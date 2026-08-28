/**
 * LIRA data access contract.
 *
 * The UI must consume only records already authorized for the current actor.
 * Demo/local mode is currently assembled inside LiraPage from the same domain
 * datasets used by the product. The Supabase adapter will implement this
 * contract with tenant + role + department scope/RLS and return no broader
 * dataset than the user can open in the primary modules.
 */
export const LIRA_DATA_DOMAINS = Object.freeze([
  'surveillance',
  'laboratory',
  'patients',
  'prevention',
  'quality',
  'training',
  'committees',
  'documents',
  'indicators',
])

export function createLiraContext({actor,scope,domains={}}={}){
  return {
    actor:actor||null,
    scope:scope||null,
    domains:Object.fromEntries(LIRA_DATA_DOMAINS.map(key=>[key,domains[key]||[]])),
    generatedAt:new Date().toISOString(),
  }
}

export function assertLiraScope(context){
  if(!context?.actor||!context?.scope) return {safe:false,reason:'missing_actor_scope'}
  return {safe:true,reason:null}
}
