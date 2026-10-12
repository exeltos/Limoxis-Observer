import { supabase } from '../../core/supabase/client'
import { hasSupabaseConfig } from '../../core/config/env'

const DAY=86400000
const daysUntil=value=>Math.ceil((new Date(`${String(value).slice(0,10)}T00:00:00`).getTime()-new Date(new Date().toDateString()).getTime())/DAY)

// The Platform Owner's briefing items: what evaluators did lately in their
// Demos (below), Demos ending within 7 days and organizations whose deletion
// date is within 7 days or has passed (the same events the nightly reminder
// e-mails cover).
export async function loadPlatformAttentionItems(language='el'){
  if(!hasSupabaseConfig||!supabase)return []
  const en=language==='en'
  const [{data:demos,error:demoError},{data:orgs,error:orgError}]=await Promise.all([
    supabase.from('platform_demo_entitlements').select('id,valid_until').eq('status','active'),
    supabase.from('organizations').select('id,deletion_scheduled_at').eq('is_demo',false).not('deletion_scheduled_at','is',null),
  ])
  if(demoError)throw demoError
  if(orgError)throw orgError
  const ending=(demos||[]).filter(d=>daysUntil(d.valid_until)<=7).length
  const due=(orgs||[]).filter(o=>new Date(o.deletion_scheduled_at).getTime()<=Date.now()).length
  const soon=(orgs||[]).filter(o=>new Date(o.deletion_scheduled_at).getTime()>Date.now()&&daysUntil(o.deletion_scheduled_at)<=7).length
  const items=[...await loadDemoActivityItems(en).catch(()=>[])]
  if(due)items.push({id:'PLATFORM-deletion-due',title:en?'Organizations that reached their deletion date':'Οργανισμοί που έφτασαν στην ημερομηνία διαγραφής',count:due,to:'/platform#organizations',type:'task',source:'supabase'})
  if(soon)items.push({id:'PLATFORM-deletion-soon',title:en?'Organization deletions within 7 days':'Διαγραφές οργανισμών εντός 7 ημερών',count:soon,to:'/platform#organizations',type:'task',source:'supabase'})
  if(ending)items.push({id:'PLATFORM-demo-ending',title:en?'Demos ending within 7 days':'Demo που λήγουν εντός 7 ημερών',count:ending,to:'/platform#demo',type:'task',source:'supabase'})
  return items
}

const ACTIVITY_DAYS=14
// What evaluators did lately in their Demos, for the Owner's notifications
// (each one once, with a pop-up when it is new): an evaluator finished signing
// up (accepted the invitation), or completed the evaluation (rated the guide
// as a whole). `popup` marks them for the pop-up.
export async function loadDemoActivityItems(en=false){
  const since=new Date(Date.now()-ACTIVITY_DAYS*DAY).toISOString()
  const [{data:invites,error:inviteError},{data:rated,error:ratedError}]=await Promise.all([
    supabase.from('account_invitations').select('id,user_id,organization_id,accepted_at,delivery_email,organization:organizations(name,is_demo)').gte('accepted_at',since),
    supabase.from('demo_evaluation_progress').select('demo_organization_id,user_id,rating,rated_at,organization:organizations(name)').eq('step_key','guide_opened').not('rating','is',null).gte('rated_at',since),
  ])
  if(inviteError)throw inviteError
  if(ratedError)throw ratedError
  const joined=(invites||[]).filter(row=>row.organization?.is_demo)
  const userIds=[...new Set([...joined.map(row=>row.user_id),...(rated||[]).map(row=>row.user_id)].filter(Boolean))]
  const orgIds=[...new Set([...joined.map(row=>row.organization_id),...(rated||[]).map(row=>row.demo_organization_id)].filter(Boolean))]
  if(!userIds.length)return []
  const [{data:profiles},{data:demos}]=await Promise.all([
    supabase.from('profiles').select('id,full_name,contact_email').in('id',userIds),
    supabase.from('platform_demo_entitlements').select('id,organization_id').in('organization_id',orgIds),
  ])
  const nameOf=(id,fallback='')=>{const p=(profiles||[]).find(row=>row.id===id);return p?.full_name||p?.contact_email||fallback||(en?'An evaluator':'Ένας αξιολογητής')}
  const demoLink=orgId=>{const demo=(demos||[]).find(row=>row.organization_id===orgId);return demo?`/platform#demo?demo=${demo.id}`:'/platform#demo'}
  return [
    ...joined.map(row=>({id:`PLATFORM-demo-joined-${row.id}`,popup:true,type:'notification',source:'supabase',createdAt:row.accepted_at,to:demoLink(row.organization_id),
      title:en?`${nameOf(row.user_id,row.delivery_email)} completed the sign-up`:`${nameOf(row.user_id,row.delivery_email)}: ολοκλήρωσε την εγγραφή`,
      message:en?`Demo ${row.organization?.name||''}`:`Demo ${row.organization?.name||''}`})),
    ...(rated||[]).map(row=>({id:`PLATFORM-demo-rated-${row.demo_organization_id}-${row.user_id}`,popup:true,type:'notification',source:'supabase',createdAt:row.rated_at,to:demoLink(row.demo_organization_id),
      title:en?`${nameOf(row.user_id)} completed the evaluation (${row.rating}/5)`:`${nameOf(row.user_id)}: ολοκλήρωσε την αξιολόγηση (${row.rating}/5)`,
      message:en?`Demo ${row.organization?.name||''}`:`Demo ${row.organization?.name||''}`})),
  ].sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))
}
