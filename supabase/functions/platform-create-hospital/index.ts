import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'}
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
  try{
    const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authHeader=req.headers.get('Authorization')||''
    const caller=createClient(url,anon,{global:{headers:{Authorization:authHeader}}})
    const {data:{user}}=await caller.auth.getUser();if(!user)throw new Error('Unauthorized')
    const admin=createClient(url,service)
    const {data:profile}=await admin.from('profiles').select('is_platform_owner').eq('id',user.id).single()
    if(!profile?.is_platform_owner)throw new Error('Platform owner required')
    const body=await req.json();const {name,code,type='hospital',region='',city='',adminEmail='',adminName=''}=body
    const {data:org,error:orgError}=await admin.from('organizations').insert({name,code,type,region,city}).select().single();if(orgError)throw orgError
    let invited=null
    if(adminEmail){
      const redirectTo=`${req.headers.get('origin')||''}/login`
      const {data,error}=await admin.auth.admin.inviteUserByEmail(adminEmail,{redirectTo,data:{full_name:adminName||adminEmail.split('@')[0]}});if(error)throw error
      if(data.user){await admin.from('organization_members').insert({organization_id:org.id,user_id:data.user.id,role:'hospital_admin',status:'invited'});invited={id:data.user.id,email:adminEmail}}
    }
    await admin.from('system_audit_log').insert({organization_id:org.id,actor_user_id:user.id,actor_role:'platform_owner',event_type:'platform.organization_created',entity_type:'organization',entity_id:org.id,metadata:{admin_email:adminEmail||null}})
    return new Response(JSON.stringify({organization:org,invited}),{headers:{...cors,'Content-Type':'application/json'}})
  }catch(error){return new Response(JSON.stringify({error:String(error?.message||error)}),{status:400,headers:{...cors,'Content-Type':'application/json'}})}
})
