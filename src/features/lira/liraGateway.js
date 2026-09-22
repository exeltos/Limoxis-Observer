import { supabase } from '../../core/supabase/client'

export async function callLiraGateway({organizationId,question,language='el',context=null}){
 if(!supabase)throw new Error('LIRA_GATEWAY_UNAVAILABLE')
 const {data,error}=await supabase.functions.invoke('lira-ai-gateway',{body:{organizationId,question,language,context}})
 if(error)throw error
 if(!data?.ok)throw new Error(data?.code||'LIRA_GATEWAY_FAILED')
 return data
}
