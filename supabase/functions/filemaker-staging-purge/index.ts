import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// FileMaker migration housekeeping: removes from the private bucket filemaker-staging
// the files already copied into attachments. public.fm_stage_files_purgeable lists only
// a file whose attachments row and storage object both exist; each removed file keeps
// its fm_stage_files row, marked staging_purged_at. Called with the scheduler secret
// (private.filemaker_staging_purge_dispatch), never by a browser.

const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}})
const STAGING_BUCKET='filemaker-staging'
const BUDGET_MS=100000

Deno.serve(async(req)=>{
  if(req.method!=='POST')return reply({error:'Method not allowed'},405)
  const url=Deno.env.get('SUPABASE_URL'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if(!url||!service)return reply({error:'Function is not configured'},500)
  const admin=createClient(url,service,{auth:{autoRefreshToken:false,persistSession:false}})
  const {data:valid,error:secretError}=await admin.rpc('platform_scheduler_secret_valid',{p_secret:req.headers.get('x-limoxis-scheduler')||''})
  if(secretError||valid!==true)return reply({error:'Unauthorized'},401)
  const started=Date.now()
  let removed=0
  try{
    while(Date.now()-started<BUDGET_MS){
      const {data:rows,error}=await admin.rpc('fm_stage_files_purgeable',{p_limit:100})
      if(error)throw error
      if(!rows?.length)break
      const paths=[...new Set(rows.map((row:{storage_path:string})=>row.storage_path))] as string[]
      const {error:removeError}=await admin.storage.from(STAGING_BUCKET).remove(paths)
      if(removeError)throw removeError
      const now=new Date().toISOString()
      for(const row of rows){
        const {error:markError}=await admin.from('fm_stage_files').update({staging_purged_at:now}).eq('base_table',row.base_table).eq('field',row.field).eq('record_id',row.record_id)
        if(markError)throw markError
      }
      removed+=rows.length
    }
  }catch(error){
    return reply({ok:false,removed,error:String((error as Error)?.message||error).slice(0,300)},500)
  }
  return reply({ok:true,removed})
})
