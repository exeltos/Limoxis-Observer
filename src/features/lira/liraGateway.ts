import { invokeAuthenticatedFunction } from '../../core/supabase/client'
export async function callLiraGateway({organizationId,question,language='el',context=null,deterministicAnswer=null,aggregateContext=null,patientContext=null,knowledge=[]}){
 return invokeAuthenticatedFunction('lira-ai-gateway',{organizationId,question,language,context,deterministicAnswer,aggregateContext,patientContext,knowledge})
}
