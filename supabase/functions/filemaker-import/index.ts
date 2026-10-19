import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// FileMaker (ISOWISE) migration, step 1: reads the hospital's FileMaker tables
// through the FileMaker Server OData API into the fm_stage_* tables, as they are.
// Called by pg_cron (private.filemaker_import_dispatch) with the scheduler secret,
// never by a browser. Tasks:
//   probe   check the connection; for each table its record count and field names;
//   pull    read the next pages, smallest tables first, for about two minutes;
//   files   read the container (file) fields listed in fm_stage_file_sources into
//           the private bucket filemaker-staging and fm_stage_files;
//   files_attach  copy staged files whose record is in Limoxis into attachments.
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
    // The database refuses a NUL character or half of a broken character pair inside a
    // text: FileMaker containers sometimes carry them.
    const text=typeof value==='string'?value.replace(/\u0000/g,'').replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,'\uFFFD'):value
    out[key]=typeof text==='string'&&text.length>MAX_TEXT?{omitted:true,length:text.length}:text
  }
  return out
}
// FileMaker's own record id when OData gives it, else the record's place in the table
// (an ID field of the table itself is not trusted to be unique).
const idOf=(row:Record<string,unknown>,fallback:number)=>String(row.ROWID??fallback)

// FileMaker's record id (ROWID) is only returned when asked for by name, with the fields;
// a field name with spaces or other characters goes in double quotes.
const quoted=(name:string)=>(/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)?name:`"${name.replace(/"/g,'""')}"`)
const selectOf=(names:string[]|null)=>names?.length?`&$select=${['ROWID','ROWMODID',...names.filter(name=>name!=='ROWID'&&name!=='ROWMODID')].map(name=>encodeURIComponent(quoted(name))).join(',')}`:''

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
  // Whether this server returns ROWID: tried on the smallest table that answered.
  const {data:small}=await admin.from('fm_stage_tables').select('occurrence,field_names').not('field_names','is',null).order('expected').limit(1).maybeSingle()
  let rowid=false
  if(small){
    try{rowid=JSON.parse(await odata(`${entity(small.occurrence)}?$top=1${selectOf(small.field_names)}`)).value?.[0]?.ROWID!=null}catch{rowid=false}
  }
  await admin.from('fm_stage_settings').update({rowid}).eq('id',true)
  return {tables:ok,failed,rowid}
}

// Which ways of asking for ROWID this server accepts: key names and errors only, no values.
async function rowidCheck(admin:Admin){
  const {data:small}=await admin.from('fm_stage_tables').select('occurrence,field_names').not('field_names','is',null).order('expected').limit(1).maybeSingle()
  if(!small)return {rowidCheck:'no table'}
  const tries:Record<string,string>={only:'&$select=ROWID',both:'&$select=ROWID,ROWMODID',quoted:"&$select=%22ROWID%22",fields:selectOf(small.field_names),first:`&$select=ROWID,${encodeURIComponent(small.field_names?.[0]||'')}`}
  const out:Record<string,unknown>={table:small.occurrence}
  for(const [name,query] of Object.entries(tries)){
    try{out[name]=Object.keys(JSON.parse(await odata(`${entity(small.occurrence)}?$top=1${query}`)).value?.[0]||{}).slice(0,5)}catch(error){out[name]=String((error as Error)?.message||error).slice(0,200)}
  }
  return {rowidCheck:out}
}

// Whether this server hands out container (file) fields: for one small table, what a
// record carries in its container field and what the field's $value answers. Sizes,
// types and errors only, never the content.
async function filesProbe(){
  const {base,auth}=source()
  const out:Record<string,unknown>={}
  for(const [table,field] of [['ANNOUNCESMENTS','ANNOUNCEMENT ATTACH'],['Forms','Attachement']]){
    const r:Record<string,unknown>={}
    try{
      const page=JSON.parse(await odata(`${entity(table)}?$top=5${selectOf([field])}`))
      const rows=(page.value||[]) as Record<string,unknown>[]
      r.rows=rows.map(row=>({rowid:row.ROWID,kind:typeof row[field],length:typeof row[field]==='string'?(row[field] as string).length:null,start:typeof row[field]==='string'?(row[field] as string).slice(0,12):null}))
      const id=rows.find(row=>row[field])?.ROWID??rows[0]?.ROWID
      if(id!=null){
        const response=await fetch(`${base}${entity(table)}(${id})/${encodeURIComponent(quoted(field))}/$value`,{headers:{authorization:auth}})
        const bytes=new Uint8Array(await response.arrayBuffer())
        r.value={status:response.status,type:response.headers.get('content-type'),disposition:response.headers.get('content-disposition'),bytes:bytes.length}
      }
    }catch(error){r.error=String((error as Error)?.message||error).slice(0,200)}
    out[table]=r
  }
  return {filesProbe:out}
}

// Container (file) fields, step 4 of the migration. OData hands a container's content
// inline as base64 when the field is asked for by name; FileMaker gives no file name,
// so the type is read from the first bytes and the name from the record's title.
// Files go to the private bucket filemaker-staging (service role only) and are listed
// in fm_stage_files; one record's identical files (same sha256) are kept once.
const STAGING_BUCKET='filemaker-staging'
const latin=(bytes:Uint8Array,from=0,to=bytes.length)=>{let text='';for(let i=from;i<Math.min(to,bytes.length);i+=8192)text+=String.fromCharCode(...bytes.subarray(i,Math.min(i+8192,to,bytes.length)));return text}
function fileType(bytes:Uint8Array):{ext:string,mime:string}{
  const head=latin(bytes,0,16),hex=[...bytes.subarray(0,4)].map(b=>b.toString(16).padStart(2,'0')).join('')
  if(head.startsWith('%PDF'))return {ext:'pdf',mime:'application/pdf'}
  if(hex.startsWith('ffd8ff'))return {ext:'jpg',mime:'image/jpeg'}
  if(hex==='89504e47')return {ext:'png',mime:'image/png'}
  if(head.startsWith('GIF8'))return {ext:'gif',mime:'image/gif'}
  if(head.startsWith('BM'))return {ext:'bmp',mime:'image/bmp'}
  if(hex==='49492a00'||hex==='4d4d002a')return {ext:'tif',mime:'image/tiff'}
  if(head.startsWith('RIFF')&&head.slice(8,12)==='WEBP')return {ext:'webp',mime:'image/webp'}
  if(head.slice(4,8)==='ftyp'){const brand=head.slice(8,12);return /hei|mif1/.test(brand)?{ext:'heic',mime:'image/heic'}:brand==='qt  '?{ext:'mov',mime:'video/quicktime'}:{ext:'mp4',mime:'video/mp4'}}
  if(head.startsWith('{\\rtf'))return {ext:'rtf',mime:'application/rtf'}
  if(head.startsWith('ID3')||hex.startsWith('fffb'))return {ext:'mp3',mime:'audio/mpeg'}
  if(hex==='504b0304'){
    // Office files are zip archives: their part names are plain text in the archive.
    const names=latin(bytes,0,Math.min(bytes.length,4*1024*1024))
    if(names.includes('word/'))return {ext:'docx',mime:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}
    if(names.includes('xl/'))return {ext:'xlsx',mime:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}
    if(names.includes('ppt/'))return {ext:'pptx',mime:'application/vnd.openxmlformats-officedocument.presentationml.presentation'}
    if(names.includes('[Content_Types].xml'))return {ext:'docx',mime:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}
    return {ext:'zip',mime:'application/zip'}
  }
  if(hex==='d0cf11e0'){
    // Old Office files: the stream names are UTF-16 inside the file.
    const text=latin(bytes).replace(/\u0000/g,'')
    if(text.includes('WordDocument'))return {ext:'doc',mime:'application/msword'}
    if(text.includes('Workbook')||text.includes('Book'))return {ext:'xls',mime:'application/vnd.ms-excel'}
    if(text.includes('PowerPoint Document'))return {ext:'ppt',mime:'application/vnd.ms-powerpoint'}
    if(text.includes('__substg1.0_'))return {ext:'msg',mime:'application/vnd.ms-outlook'}
    return {ext:'bin',mime:'application/octet-stream'}
  }
  const sample=latin(bytes,0,512)
  if(sample.length&&!/[\u0000-\u0008\u000e-\u001f]/.test(sample))return {ext:'txt',mime:'text/plain'}
  return {ext:'bin',mime:'application/octet-stream'}
}
const slug=(text:string)=>text.replace(/[^A-Za-z0-9._-]+/g,'_').replace(/^_+|_+$/g,'')
const fileTitle=(text:unknown)=>typeof text==='string'?text.replace(/[\u0000-\u001f\\/:*?"<>|]+/g,' ').replace(/\s+/g,' ').trim().slice(0,120):''
// A large file does not fit in memory several times over (response text, parsed JSON,
// decoded copy), so the response is kept as bytes: each container value is cut out of
// it by position and decoded from there, and only the rest is parsed as JSON.
const B64=new Int16Array(128).fill(-1)
'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'.split('').forEach((c,i)=>{B64[c.charCodeAt(0)]=i})
function decodeRange(bytes:Uint8Array,from:number,to:number){
  const out=new Uint8Array(Math.floor((to-from)*3/4)+3)
  let size=0,acc=0,bits=0
  for(let i=from;i<to;i++){
    let c=bytes[i]
    // JSON escapes inside the value: a line break is skipped, an escaped slash kept.
    if(c===92){i++;c=bytes[i];if(c!==47)continue}
    const v=c<128?B64[c]:-1
    if(v<0){if(c===61)break;if(c===32||c===9||c===10||c===13)continue;return null}
    acc=(acc<<6)|v;bits+=6
    if(bits>=8){bits-=8;out[size++]=(acc>>bits)&255}
  }
  return size?out.subarray(0,size):null
}
function cutValues(bytes:Uint8Array,field:string){
  const key=new TextEncoder().encode(JSON.stringify(field)+':')
  const ranges:[number,number][]=[],parts:Uint8Array[]=[]
  let last=0
  // indexOf runs natively and jumps over a whole base64 value (it holds no quote).
  for(let i=bytes.indexOf(34);i>=0&&i<=bytes.length-key.length;i=bytes.indexOf(34,i+1)){
    let k=1
    while(k<key.length&&bytes[i+k]===key[k])k++
    if(k<key.length)continue
    let start=i+key.length
    while(bytes[start]===32)start++
    if(bytes[start]!==34)continue
    let end=bytes.indexOf(34,start+1)
    while(end>0&&bytes[end-1]===92)end=bytes.indexOf(34,end+1)
    if(end<0)throw new Error('BAD_RESPONSE')
    parts.push(bytes.subarray(last,start),new TextEncoder().encode(JSON.stringify(`#${ranges.length}`)))
    ranges.push([start+1,end])
    last=end+1;i=end
  }
  parts.push(bytes.subarray(last))
  const rest=new Uint8Array(parts.reduce((n,part)=>n+part.length,0))
  let at=0
  for(const part of parts){rest.set(part,at);at+=part.length}
  return {ranges,rest:JSON.parse(new TextDecoder().decode(rest))}
}
async function odataBytes(path:string){
  const {base,auth}=source()
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),90000)
  try{
    const response=await fetch(`${base}${path}`,{signal:controller.signal,headers:{authorization:auth,accept:'application/json'}})
    if(!response.ok)throw new Error(`HTTP ${response.status}: ${(await response.text()).slice(0,200)}`)
    return new Uint8Array(await response.arrayBuffer())
  }finally{clearTimeout(timer)}
}
const hexOf=(buffer:ArrayBuffer)=>[...new Uint8Array(buffer)].map(b=>b.toString(16).padStart(2,'0')).join('')

// One record per request (a page of large files does not fit in the function's memory,
// and a record whose file FileMaker has lost fails the whole request), a few requests at
// once: FileMaker takes seconds to hand out one file.
const PARALLEL=2

async function files(admin:Admin,started:number){
  const {data:settings}=await admin.from('fm_stage_settings').select('rowid').eq('id',true).single()
  let read=0,stored=0,finished=0
  while(Date.now()-started<BUDGET_MS){
    const {data:source}=await admin.from('fm_stage_file_sources').select('*').in('status',['running','pending']).order('status',{ascending:false}).order('position').limit(1).maybeSingle()
    if(!source)break
    const {data:table}=await admin.from('fm_stage_tables').select('occurrence,use_rowid').eq('base_table',source.base_table).single()
    const now=new Date().toISOString()
    const where={base_table:source.base_table,field:source.field}
    const save=(values:Record<string,unknown>)=>admin.from('fm_stage_file_sources').update({...values,updated_at:now}).match(where)
    // A call that died on this page (a file too large for the function's memory) is not
    // retried for ever: the page is read again one record at a time (inflight_skip is then
    // stored as -(skip+1)), and if that dies too, the record is passed over as a failure.
    const skip=source.next_skip
    if(source.inflight_skip===-(skip+1)){
      await save({next_skip:skip+1,records_seen:source.records_seen+1,failures:source.failures+1,inflight_skip:null,last_error:`record at ${skip}: too large to read`})
      continue
    }
    const width=source.inflight_skip===skip?1:PARALLEL
    await save({inflight_skip:width===1?-(skip+1):skip})
    try{
      // Only the records whose container holds something, when the server can filter on it.
      const filterOf=(mode:string)=>{const parts=[mode==='container'?`${quoted(source.field)} ne null`:'',source.extra_filter||''].filter(Boolean);return parts.length?`&$filter=${encodeURIComponent(parts.join(' and '))}`:''}
      const ask=(mode:string,at:number)=>odataBytes(`${entity(table.occurrence)}?$top=1&$skip=${at}${filterOf(mode)}${selectOf([source.field,...(source.title_field?[source.title_field]:[])])}`)
      // A table read without ROWID (too many fields) numbers its records by place, in
      // the same order as the staged copy: it is read whole, without the filter.
      const byPlace=!settings?.rowid||table.use_rowid===false
      let mode=byPlace?'plain':source.filter_mode
      if(mode==='container'&&skip===0){
        // Only a refused filter (HTTP 400) makes the field be read without it.
        try{await odata(`${entity(table.occurrence)}?$top=1&$select=ROWID${filterOf(mode)}`)}
        catch(error){
          if(!String((error as Error)?.message||error).startsWith('HTTP 400'))throw error
          mode='plain'
          await save({filter_mode:mode})
        }
      }
      // One record: how many rows it took (0 at the end), the file kept, or why not.
      const readOne=async(at:number)=>{
        let body
        try{body=await ask(mode,at)}
        catch(error){
          const message=String((error as Error)?.message||error)
          // FileMaker answers <File Missing> for a container whose external file is gone.
          if(message.includes('File Missing'))return {rows:1,count:0,bytes:0,failure:`record at ${at}: file missing in FileMaker`}
          throw error
        }
        const {ranges,rest}=cutValues(body,source.field)
        const row=((rest.value||[]) as Record<string,unknown>[])[0]
        if(!row)return {rows:0,count:0,bytes:0,failure:null}
        const value=row[source.field]
        const range=typeof value==='string'&&value.startsWith('#')?ranges[Number(value.slice(1))]:null
        if(!range||range[1]-range[0]<4)return {rows:1,count:0,bytes:0,failure:null}
        const recordId=byPlace?String(at+1):idOf(row,at+1)
        try{
          const content=decodeRange(body,range[0],range[1])
          if(!content)throw new Error('NOT_BASE64')
          const sha256=hexOf(await crypto.subtle.digest('SHA-256',content))
          const {ext,mime}=fileType(content)
          const title=fileTitle(source.title_field?row[source.title_field]:null)
          const fileName=`${title||`${source.base_table} ${recordId}`}.${ext}`
          const {data:same}=await admin.from('fm_stage_files').select('field,storage_path,sha256').eq('base_table',source.base_table).eq('record_id',recordId)
          const existing=(same||[]).find((file:Record<string,string>)=>file.field===source.field)
          if(existing?.sha256===sha256)return {rows:1,count:0,bytes:0,failure:null}
          const twin=(same||[]).find((file:Record<string,string>)=>file.field!==source.field&&file.sha256===sha256)
          const storagePath=twin?twin.storage_path:`fm/${slug(source.base_table)}/${slug(source.field)}/${slug(recordId)}.${ext}`
          if(!twin){
            const {error}=await admin.storage.from(STAGING_BUCKET).upload(storagePath,content,{contentType:mime,upsert:true})
            if(error)throw error
          }
          const {error}=await admin.from('fm_stage_files').upsert({base_table:source.base_table,field:source.field,record_id:recordId,fm_rowid:row.ROWID==null?null:String(row.ROWID),storage_path:storagePath,mime_type:mime,size_bytes:content.length,sha256,file_name:fileName,duplicate_of:twin?twin.field:null,fetched_at:now},{onConflict:'base_table,field,record_id'})
          if(error)throw error
          return {rows:1,count:1,bytes:twin?0:content.length,failure:null}
        }catch(error){
          return {rows:1,count:0,bytes:0,failure:`${recordId}: ${String((error as Error)?.message||error).slice(0,200)}`}
        }
      }
      const results=await Promise.all(Array.from({length:width},(_,i)=>readOne(skip+i)))
      // Rows past the end come back empty: the field is done.
      const taken=results.findIndex(result=>result.rows===0)
      const used=taken<0?results:results.slice(0,taken)
      const failures=used.filter(result=>result.failure)
      const done=taken>=0
      await save({status:done?'done':'running',inflight_skip:null,next_skip:skip+used.length,records_seen:source.records_seen+used.length,files:source.files+used.reduce((n,result)=>n+result.count,0),bytes:Number(source.bytes)+used.reduce((n,result)=>n+result.bytes,0),failures:source.failures+failures.length,last_error:failures.at(-1)?.failure??source.last_error,started_at:source.started_at||now,finished_at:done?now:null})
      read+=used.length;stored+=used.reduce((n,result)=>n+result.count,0)
      if(done)finished++
    }catch(error){
      const message=String((error as Error)?.message||error)
      // The whole FileMaker database unavailable (closed for a backup, restarted): the
      // field keeps its place and the call stops, to try again on the next one. A request
      // that timed out counts as a page that died (a file too large to hand out in time).
      if(/not defined in database|HTTP 5\d\d|abort/i.test(message)){
        await save({...(/abort/i.test(message)?{}:{inflight_skip:null}),last_error:message.slice(0,300)})
        return {read,stored,finished,unavailable:message.slice(0,120)}
      }
      await save({status:'error',last_error:message.slice(0,300)})
    }
  }
  return {read,stored,finished}
}

// Puts each staged file whose record now lives in Limoxis (fm_stage_files.attach_*,
// filled from fm_stage_links) where the app keeps attachments, as the app names them:
// attachments/<organization>/<entity type>/<entity id>/<time>-<file name>.
async function filesAttach(admin:Admin,started:number){
  let attached=0,failed=0
  while(Date.now()-started<BUDGET_MS){
    const {data:rows}=await admin.from('fm_stage_files').select('*').not('attach_entity_type','is',null).is('attachment_id',null).is('attach_error',null).is('duplicate_of',null).limit(20)
    if(!rows?.length)break
    for(const file of rows){
      if(Date.now()-started>=BUDGET_MS)break
      try{
        const safeName=String(file.file_name).replace(/[^\w.-]+/g,'_')
        const target=`${file.organization_id}/${file.attach_entity_type}/${file.attach_entity_id}/${Date.now()}-${safeName}`
        const {data:blob,error:readError}=await admin.storage.from(STAGING_BUCKET).download(file.storage_path)
        if(readError)throw readError
        const {error:uploadError}=await admin.storage.from('attachments').upload(target,blob,{contentType:file.mime_type||undefined})
        if(uploadError)throw uploadError
        const {data:row,error}=await admin.from('attachments').insert({organization_id:file.organization_id,entity_type:file.attach_entity_type,entity_id:file.attach_entity_id,file_name:file.file_name,storage_path:target,mime_type:file.mime_type,size_bytes:file.size_bytes,uploaded_by:null,metadata:{category:file.attach_category||'generalDocument',description:'',source:'filemaker',fm_table:file.base_table,fm_field:file.field,fm_record_id:file.record_id}}).select('id').single()
        if(error){await admin.storage.from('attachments').remove([target]).catch(()=>{});throw error}
        const {error:markError}=await admin.from('fm_stage_files').update({attachment_id:row.id,attached_at:new Date().toISOString()}).eq('base_table',file.base_table).eq('field',file.field).eq('record_id',file.record_id)
        if(markError)throw markError
        attached++
      }catch(error){
        await admin.from('fm_stage_files').update({attach_error:String((error as Error)?.message||error).slice(0,300)}).eq('base_table',file.base_table).eq('field',file.field).eq('record_id',file.record_id)
        failed++
      }
    }
  }
  return {attached,failed}
}

async function pull(admin:Admin,started:number){
  const {data:settings}=await admin.from('fm_stage_settings').select('page_size,rowid').eq('id',true).single()
  const size=Number(settings?.page_size||500)
  let read=0,finished=0
  while(Date.now()-started<BUDGET_MS){
    const {data:table}=await admin.from('fm_stage_tables').select('*').in('status',['running','pending']).order('status',{ascending:false}).order('expected').limit(1).maybeSingle()
    if(!table)break
    const now=new Date().toISOString()
    try{
      const plain=`${entity(table.occurrence)}?$top=${size}&$skip=${table.next_skip}`
      const useRowid=Boolean(settings?.rowid)&&table.use_rowid!==false
      let page
      try{page=JSON.parse(await odata(useRowid?plain+selectOf(table.field_names):plain))}
      catch(error){
        // A table with very many fields can make the request too long: it is read
        // without ROWID from its first page on, its records numbered by place.
        if(!useRowid||table.next_skip>0)throw error
        await admin.from('fm_stage_tables').update({use_rowid:false}).eq('base_table',table.base_table)
        page=JSON.parse(await odata(plain))
      }
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
    result={...result,...(task==='probe'?await probe(admin):task==='rowid'?await rowidCheck(admin):task==='filesprobe'?await filesProbe():task==='files'?await files(admin,started):task==='files_attach'?await filesAttach(admin,started):await pull(admin,started))}
  }catch(error){
    result={...result,error:String((error as Error)?.message||error).slice(0,300)}
  }
  await admin.from('fm_stage_settings').update({running_until:null,last_run_at:new Date().toISOString(),last_result:result}).eq('id',true)
  return reply({ok:!result.error,...result},result.error?500:200)
})
