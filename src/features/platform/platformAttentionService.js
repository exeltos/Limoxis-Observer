import { supabase } from '../../core/supabase/client'
import { hasSupabaseConfig } from '../../core/config/env'

const DAY=86400000
const daysUntil=value=>Math.ceil((new Date(`${String(value).slice(0,10)}T00:00:00`).getTime()-new Date(new Date().toDateString()).getTime())/DAY)

// The Platform Owner's briefing items: Demos ending within 7 days and
// organizations whose deletion date is within 7 days or has passed (the same
// events the nightly reminder e-mails cover).
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
  const items=[]
  if(due)items.push({id:'PLATFORM-deletion-due',title:en?'Organizations that reached their deletion date':'Οργανισμοί που έφτασαν στην ημερομηνία διαγραφής',count:due,to:'/platform#organizations',type:'task',source:'supabase'})
  if(soon)items.push({id:'PLATFORM-deletion-soon',title:en?'Organization deletions within 7 days':'Διαγραφές οργανισμών εντός 7 ημερών',count:soon,to:'/platform#organizations',type:'task',source:'supabase'})
  if(ending)items.push({id:'PLATFORM-demo-ending',title:en?'Demos ending within 7 days':'Demo που λήγουν εντός 7 ημερών',count:ending,to:'/platform#demo',type:'task',source:'supabase'})
  return items
}
