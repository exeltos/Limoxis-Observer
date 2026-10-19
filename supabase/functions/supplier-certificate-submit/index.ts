import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serveWithCors } from '../_shared/cors.ts'

// Public endpoint of the e-mailed supplier link (no account, verify_jwt = false):
// the supplier uploads the renewed certificate. The random single-use token is
// checked by its SHA-256 (as quality_supplier_certificate_access does), the file is
// stored with the service role under the supplier (attachments bucket, entity
// quality_supplier, category certification) and the submission is written on the
// request, which becomes «submitted» once. Quality reviews it in the app.
const cors={'Content-Type':'application/json','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Cache-Control':'no-store'}
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors})
const fail=(code:string,status=400)=>reply({ok:false,code},status)
const MAX_BYTES=10*1024*1024
const TYPES:Record<string,string>={'application/pdf':'pdf','image/jpeg':'jpg','image/png':'png','image/webp':'webp'}
const text=(value:FormDataEntryValue|null,max=200)=>String(typeof value==='string'?value:'').trim().slice(0,max)
const isDay=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(`${value}T00:00:00Z`))
const athensToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Athens',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
async function sha256(value:string){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('')}
// The file is what it says it is: PDF, JPEG, PNG or WebP by its first bytes.
function sniff(bytes:Uint8Array){
  const at=(i:number,...values:number[])=>values.every((v,k)=>bytes[i+k]===v)
  if(at(0,0x25,0x50,0x44,0x46))return 'application/pdf'
  if(at(0,0xff,0xd8,0xff))return 'image/jpeg'
  if(at(0,0x89,0x50,0x4e,0x47))return 'image/png'
  if(at(0,0x52,0x49,0x46,0x46)&&at(8,0x57,0x45,0x42,0x50))return 'image/webp'
  return ''
}

serveWithCors(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
  if(req.method!=='POST')return fail('METHOD_NOT_ALLOWED',405)
  const url=Deno.env.get('SUPABASE_URL'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if(!url||!service)return fail('SERVICE_UNAVAILABLE',503)
  if(Number(req.headers.get('content-length')||0)>MAX_BYTES+512*1024)return fail('SUPPLIER_CERTIFICATE_FILE_TOO_LARGE',413)
  let form:FormData
  // multipart/form-data from the page; a JSON body (no file) is read the same way, so a check of the link alone answers cleanly.
  try{
    if(/application\/json/i.test(req.headers.get('content-type')||'')){const body=await req.json();form=new FormData();for(const [key,value] of Object.entries(body||{}))if(typeof value==='string')form.set(key,value)}
    else form=await req.formData()
  }catch{return fail('SUPPLIER_CERTIFICATE_INVALID_REQUEST')}

  const token=text(form.get('token'),200)
  if(!/^SCR-[0-9a-f]{64}$/.test(token))return fail('SUPPLIER_CERTIFICATE_ACCESS_NOT_AVAILABLE',404)
  const admin=createClient(url,service,{auth:{autoRefreshToken:false,persistSession:false}})
  const hash=await sha256(token)
  const {data:request,error:loadError}=await admin.from('quality_supplier_certificate_requests').select('id,organization_id,supplier_id,status,token_expires_at').eq('token_hash',hash).maybeSingle()
  if(loadError)return fail('SUPPLIER_CERTIFICATE_UNAVAILABLE',500)
  if(!request)return fail('SUPPLIER_CERTIFICATE_ACCESS_NOT_AVAILABLE',404)
  if(request.status!=='sent')return fail(request.status==='submitted'?'SUPPLIER_CERTIFICATE_ALREADY_SUBMITTED':'SUPPLIER_CERTIFICATE_ACCESS_NOT_AVAILABLE',409)
  if(!request.token_expires_at||new Date(request.token_expires_at).getTime()<Date.now())return fail('SUPPLIER_CERTIFICATE_ACCESS_EXPIRED',410)

  const certificateType=text(form.get('certificate_type'))
  const certificateNumber=text(form.get('certificate_number'))
  const issuer=text(form.get('issuer'))
  const issuedOn=text(form.get('issued_on'),10)
  const expiresOn=text(form.get('expires_on'),10)
  const note=text(form.get('note'),2000)
  const today=athensToday()
  if(!certificateType)return fail('SUPPLIER_CERTIFICATE_TYPE_REQUIRED')
  if(!certificateNumber)return fail('SUPPLIER_CERTIFICATE_NUMBER_REQUIRED')
  if(!isDay(expiresOn))return fail('SUPPLIER_CERTIFICATE_EXPIRY_REQUIRED')
  if(expiresOn<=today)return fail('SUPPLIER_CERTIFICATE_EXPIRY_NOT_FUTURE')
  if(issuedOn&&(!isDay(issuedOn)||issuedOn>today||issuedOn>=expiresOn))return fail('SUPPLIER_CERTIFICATE_ISSUE_DATE_INVALID')
  const file=form.get('file')
  if(!(file instanceof File)||!file.size)return fail('SUPPLIER_CERTIFICATE_FILE_REQUIRED')
  if(file.size>MAX_BYTES)return fail('SUPPLIER_CERTIFICATE_FILE_TOO_LARGE',413)
  const bytes=new Uint8Array(await file.arrayBuffer())
  const mime=sniff(bytes)
  if(!mime)return fail('SUPPLIER_CERTIFICATE_FILE_TYPE')

  const base=(file.name||'certificate').replace(/\.[^.]*$/,'').replace(/[^\w.-]+/g,'_').slice(0,80)||'certificate'
  const fileName=`${base}.${TYPES[mime]}`
  const storagePath=`${request.organization_id}/quality_supplier/${request.supplier_id}/${Date.now()}-${fileName}`
  const {error:uploadError}=await admin.storage.from('attachments').upload(storagePath,bytes,{contentType:mime,upsert:false})
  if(uploadError){console.error('supplier certificate upload failed',uploadError.message);return fail('SUPPLIER_CERTIFICATE_UPLOAD_FAILED',500)}
  const {data:attachment,error:attachmentError}=await admin.from('attachments').insert({organization_id:request.organization_id,entity_type:'quality_supplier',entity_id:String(request.supplier_id),file_name:fileName,storage_path:storagePath,mime_type:mime,size_bytes:bytes.length,uploaded_by:null,metadata:{category:'certification',description:[certificateType,certificateNumber].filter(Boolean).join(' · '),source:'supplier_link',request_id:request.id}}).select('id').single()
  if(attachmentError||!attachment){await admin.storage.from('attachments').remove([storagePath]).catch(()=>{});return fail('SUPPLIER_CERTIFICATE_UPLOAD_FAILED',500)}

  // Single use: only a request still «sent» with this token takes the submission.
  const {data:saved,error:saveError}=await admin.from('quality_supplier_certificate_requests').update({status:'submitted',submitted_at:new Date().toISOString(),certificate_type:certificateType,certificate_number:certificateNumber,issuer:issuer||null,issued_on:issuedOn||null,expires_on:expiresOn,note:note||null,attachment_id:attachment.id,updated_at:new Date().toISOString()}).eq('id',request.id).eq('token_hash',hash).eq('status','sent').select('id').maybeSingle()
  if(saveError||!saved){
    await admin.from('attachments').delete().eq('id',attachment.id)
    await admin.storage.from('attachments').remove([storagePath]).catch(()=>{})
    return fail(saveError?'SUPPLIER_CERTIFICATE_UNAVAILABLE':'SUPPLIER_CERTIFICATE_ALREADY_SUBMITTED',saveError?500:409)
  }
  return reply({ok:true,status:'submitted'})
})
