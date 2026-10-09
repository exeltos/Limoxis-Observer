import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { strToU8, zipSync } from 'npm:fflate@0.8.2'

// A full copy of one organization for its hand-over before deletion: every
// organization table as CSV (UTF-8, ";" separated), the organization row as
// JSON and every attachment, in one ZIP kept in the private
// "organization-exports" bucket. Platform Owner only. Also returns a
// short-lived download link for an existing export.

const cors={
  'Content-Type':'application/json',
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
}
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors})
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const BUCKET='organization-exports'
const PAGE=1000
const MAX_FILE_BYTES=250*1024*1024
const LINK_SECONDS=3600

function csvCell(value:unknown){
  if(value===null||value===undefined)return ''
  const text=typeof value==='object'?JSON.stringify(value):String(value)
  return `"${text.replaceAll('"','""')}"`
}
function toCsv(rows:Record<string,unknown>[]){
  const columns=[...new Set(rows.flatMap(row=>Object.keys(row)))]
  return '﻿'+[columns.map(csvCell).join(';'),...rows.map(row=>columns.map(column=>csvCell(row[column])).join(';'))].join('\r\n')
}

async function readTable(admin:any,table:string,organizationId:string){
  const rows:Record<string,unknown>[]=[]
  for(let from=0;;from+=PAGE){
    let query=admin.from(table).select('*').eq('organization_id',organizationId).range(from,from+PAGE-1)
    let {data,error}=await query.order('id',{ascending:true})
    if(error)({data,error}=await admin.from(table).select('*').eq('organization_id',organizationId).range(from,from+PAGE-1))
    if(error)throw new Error(`${table}: ${error.message}`)
    rows.push(...(data||[]))
    if(!data||data.length<PAGE)break
  }
  return rows
}

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
  if(req.method!=='POST')return reply({error:'Method not allowed'},405)

  const url=Deno.env.get('SUPABASE_URL')!
  const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anon=Deno.env.get('SUPABASE_ANON_KEY')!
  const jwt=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'')
  if(!jwt)return reply({error:'Unauthorized'},401)
  const caller=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${jwt}`}},auth:{persistSession:false}})
  const admin=createClient(url,service,{auth:{persistSession:false}})
  const {data:cu,error:userError}=await caller.auth.getUser()
  if(userError||!cu?.user)return reply({error:'Unauthorized'},401)
  const {data:owner}=await admin.from('profiles').select('is_platform_owner').eq('id',cu.user.id).maybeSingle()
  if(!owner?.is_platform_owner)return reply({error:'Platform Owner access required.'},403)

  const body=await req.json().catch(()=>({}))

  // A new link for an export made earlier.
  if(body?.exportId){
    if(!UUID.test(String(body.exportId)))return reply({error:'Invalid export'},400)
    const {data:record}=await admin.from('platform_organization_exports').select('id,storage_path,organization_name').eq('id',body.exportId).maybeSingle()
    if(!record)return reply({error:'Το αντίγραφο δεν βρέθηκε.'},404)
    const {data:link,error}=await admin.storage.from(BUCKET).createSignedUrl(record.storage_path,LINK_SECONDS,{download:`${record.organization_name}.zip`})
    if(error)return reply({error:error.message},500)
    return reply({ok:true,url:link.signedUrl})
  }

  const organizationId=String(body?.organizationId||'')
  if(!UUID.test(organizationId))return reply({error:'Invalid organization'},400)
  const {data:organization}=await admin.from('organizations').select('*').eq('id',organizationId).maybeSingle()
  if(!organization)return reply({error:'Ο οργανισμός δεν βρέθηκε.'},404)

  const {data:manifest,error:manifestError}=await admin.rpc('platform_organization_export_manifest',{p_organization_id:organizationId})
  if(manifestError)return reply({error:manifestError.message},500)

  const entries:Record<string,Uint8Array>={}
  const summary:Record<string,number>={}
  let rowsCount=0
  try{
    for(const table of (manifest?.tables||[])){
      const rows=await readTable(admin,table,organizationId)
      if(!rows.length)continue
      entries[`data/${table}.csv`]=strToU8(toCsv(rows))
      summary[table]=rows.length
      rowsCount+=rows.length
    }
  }catch(error){
    return reply({error:`Η εξαγωγή απέτυχε: ${String((error as Error)?.message||error)}`},500)
  }

  const warnings:string[]=[]
  let filesCount=0,fileBytes=0
  for(const file of (manifest?.files||[])){
    const {data:blob,error}=await admin.storage.from(file.bucket).download(file.name)
    if(error||!blob){warnings.push(`${file.bucket}/${file.name}: ${error?.message||'missing'}`);continue}
    const bytes=new Uint8Array(await blob.arrayBuffer())
    if(fileBytes+bytes.length>MAX_FILE_BYTES){warnings.push(`${file.bucket}/${file.name}: skipped, the export size limit was reached`);continue}
    entries[`files/${file.bucket}/${file.name}`]=bytes
    fileBytes+=bytes.length;filesCount++
  }

  const createdAt=new Date().toISOString()
  entries['organization.json']=strToU8(JSON.stringify(organization,null,2))
  entries['README.txt']=strToU8([
    `Limoxis Observer – αντίγραφο οργανισμού / organization export`,
    `${organization.name} (${organization.code})`,
    `Δημιουργήθηκε / Created: ${createdAt}`,
    `Πίνακες / Tables: ${Object.keys(summary).length} · Εγγραφές / Rows: ${rowsCount} · Αρχεία / Files: ${filesCount}`,
    '',
    'data/*.csv: ένας πίνακας ανά αρχείο, UTF-8, διαχωριστικό ";" / one table per file, UTF-8, ";" separated.',
    'files/: τα συνημμένα αρχεία / attachments.',
    ...(warnings.length?['', 'Προειδοποιήσεις / Warnings:',...warnings]:[]),
  ].join('\r\n'))

  const zip=zipSync(entries,{level:6})
  const path=`${organizationId}/${createdAt.replace(/[:.]/g,'-')}.zip`
  const {error:uploadError}=await admin.storage.from(BUCKET).upload(path,zip,{contentType:'application/zip',upsert:false})
  if(uploadError)return reply({error:`Η αποθήκευση του αντιγράφου απέτυχε: ${uploadError.message}`},500)

  const {data:record,error:recordError}=await admin.from('platform_organization_exports').insert({
    source_organization_id:organizationId,organization_name:organization.name,organization_code:organization.code,storage_path:path,
    file_size:zip.length,tables_count:Object.keys(summary).length,rows_count:rowsCount,files_count:filesCount,created_by:cu.user.id,
  }).select('id,created_at').single()
  if(recordError)return reply({error:recordError.message},500)

  await admin.from('system_audit_log').insert({
    organization_id:organizationId,actor_user_id:cu.user.id,actor_role:'platform_owner',event_type:'platform.organization.exported',
    entity_type:'platform_organization_export',entity_id:record.id,
    metadata:{organization_name:organization.name,organization_code:organization.code,tables:Object.keys(summary).length,rows:rowsCount,files:filesCount,bytes:zip.length,warnings},
  })

  const {data:link}=await admin.storage.from(BUCKET).createSignedUrl(path,LINK_SECONDS,{download:`${organization.name}.zip`})
  return reply({ok:true,exportId:record.id,createdAt:record.created_at,url:link?.signedUrl||null,tables:Object.keys(summary).length,rows:rowsCount,files:filesCount,bytes:zip.length,warnings})
})
