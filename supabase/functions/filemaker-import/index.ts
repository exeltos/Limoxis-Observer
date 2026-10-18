import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// FileMaker (ISOWISE) migration, step 1: reads the hospital's FileMaker tables
// through the FileMaker Server OData API into the fm_stage_* tables, as they are.
// Called by pg_cron (private.filemaker_import_dispatch) with the scheduler secret,
// never by a browser. Tasks:
//   probe   check the connection; for each table its record count and field names;
//   pull    read the next pages, smallest tables first, for about two minutes.
// The FileMaker account is read-only and its password lives only in the
// function's secrets (FM_HOST, FM_DATABASE, FM_USER, FM_PASSWORD).

const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}})
const BUDGET_MS=110000
const MAX_TEXT=200000
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin=any

function source(){
  const host=Deno.env.get('FM_HOST'),database=Deno.env.get('FM_DATABASE'),user=Deno.env.get('FM_USER'),password=Deno.env.get('FM_PASSWORD')
  if(!host||!database||!user||!password)throw new Error('FILEMAKER_NOT_CONFIGURED')
  return {base:`https://${host}/fmi/odata/v4/${encodeURIComponent(database)}`,auth:'Basic '+btoa(unescape(encodeURIComponent(`${user}:${password}`)))}
}

async function odata(path:string){
  const {base,auth}=source()
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),60000)
  try{
    const response=await fetch(`${base}${path}`,{signal:controller.signal,headers:{authorization:auth,accept:'application/json'}})
    const text=await response.text()
    if(!response.ok)throw new Error(`HTTP ${response.status}: ${text.slice(0,200)}`)
    return text
  }finally{clearTimeout(timer)}
}
const entity=(name:string)=>'/'+encodeURIComponent(name)

// FileMaker keeps some passwords as plain text (People, Departments): they are never copied.
const SECRET_FIELD=/pass|κωδικ.*(πρόσβ|προσβ|εισόδ|εισοδ)|pin\b/i
// A container (file) or a huge text is not kept in the staging copy: only its size.
function clean(row:Record<string,unknown>){
  const out:Record<string,unknown>={}
  for(const [key,value] of Object.entries(row)){
    if(key.startsWith('@'))continue
    if(SECRET_FIELD.test(key)){out[key]={omitted:true,reason:'password'};continue}
    out[key]=typeof value==='string'&&value.length>MAX_TEXT?{omitted:true,length:value.length}:value
  }
  return out
}
// FileMaker's own record id when OData gives it, else the record's place in the table
// (an ID field of the table itself is not trusted to be unique).
const idOf=(row:Record<string,unknown>,fallback:number)=>String(row.ROWID??fallback)

async function probe(admin:Admin){
  await odata('')
  const {data:tables,error}=await admin.from('fm_stage_tables').select('base_table,occurrence').order('expected')
  if(error)throw error
  let ok=0,failed=0
  for(const table of tables||[]){
    try{
      const count=Number((await odata(`${entity(table.occurrence)}/$count`)).trim())
      const first=JSON.parse(await odata(`${entity(table.occurrence)}?$top=1`))
      const names=Object.keys(first.value?.[0]||{}).filter(key=>!key.startsWith('@'))
      await admin.from('fm_stage_tables').update({remote_count:Number.isFinite(count)?count:null,field_names:names,last_error:null,updated_at:new Date().toISOString()}).eq('base_table',table.base_table)
      ok++
    }catch(error){
      await admin.from('fm_stage_tables').update({last_error:String((error as Error)?.message||error).slice(0,300),updated_at:new Date().toISOString()}).eq('base_table',table.base_table)
      failed++
    }
  }
  return {tables:ok,failed}
}

async function pull(admin:Admin,started:number){
  const {data:settings}=await admin.from('fm_stage_settings').select('page_size').eq('id',true).single()
  const size=Number(settings?.page_size||500)
  let read=0,finished=0
  while(Date.now()-started<BUDGET_MS){
    const {data:table}=await admin.from('fm_stage_tables').select('*').in('status',['running','pending']).order('status',{ascending:false}).order('expected').limit(1).maybeSingle()
    if(!table)break
    const now=new Date().toISOString()
    try{
      const page=JSON.parse(await odata(`${entity(table.occurrence)}?$top=${size}&$skip=${table.next_skip}`))
      const rows=(page.value||[]) as Record<string,unknown>[]
      if(rows.length){
        const records=rows.map((row,index)=>({base_table:table.base_table,record_id:idOf(row,table.next_skip+index+1),mod_id:row.ROWMODID==null?null:String(row.ROWMODID),data:clean(row),fetched_at:now}))
        const {error}=await admin.from('fm_stage_records').upsert(records,{onConflict:'base_table,record_id'})
        if(error)throw error
      }
      const done=rows.length<size
      await admin.from('fm_stage_tables').update({status:done?'done':'running',next_skip:table.next_skip+rows.length,fetched:table.fetched+rows.length,last_error:null,started_at:table.started_at||now,finished_at:done?now:null,updated_at:now}).eq('base_table',table.base_table)
      read+=rows.length
      if(done)finished++
    }catch(error){
      await admin.from('fm_stage_tables').update({status:'error',last_error:String((error as Error)?.message||error).slice(0,300),updated_at:now}).eq('base_table',table.base_table)
    }
  }
  return {read,finished}
}

Deno.serve(async(req)=>{
  if(req.method!=='POST')return reply({error:'Method not allowed'},405)
  const url=Deno.env.get('SUPABASE_URL'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if(!url||!service)return reply({error:'Function is not configured'},500)
  const admin=createClient(url,service,{auth:{autoRefreshToken:false,persistSession:false}})
  const {data:valid,error:secretError}=await admin.rpc('platform_scheduler_secret_valid',{p_secret:req.headers.get('x-limoxis-scheduler')||''})
  if(secretError||valid!==true)return reply({error:'Unauthorized'},401)

  const {task='pull'}=await req.json().catch(()=>({}))
  const started=Date.now()
  // One reading at a time: a minute's call while the last one still runs returns at once.
  const until=new Date(started+BUDGET_MS+20000).toISOString()
  const {data:claimed}=await admin.from('fm_stage_settings').update({running_until:until}).eq('id',true).or(`running_until.is.null,running_until.lt.${new Date(started).toISOString()}`).select('id')
  if(!claimed?.length)return reply({ok:true,task,skipped:'busy'})
  let result:Record<string,unknown>={task}
  try{
    result={...result,...(task==='probe'?await probe(admin):await pull(admin,started))}
  }catch(error){
    result={...result,error:String((error as Error)?.message||error).slice(0,300)}
  }
  await admin.from('fm_stage_settings').update({running_until:null,last_run_at:new Date().toISOString(),last_result:result}).eq('id',true)
  return reply({ok:!result.error,...result},result.error?500:200)
})
