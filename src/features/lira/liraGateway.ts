import { invokeAuthenticatedFunction } from '../../core/supabase/client'
import type { AnyRecord } from '../../types/featureTypes'
export async function callLiraGateway({organizationId,question,language='el',context=null,deterministicAnswer=null,aggregateContext=null,patientContext=null,knowledge=[]}: AnyRecord){
 return invokeAuthenticatedFunction('lira-ai-gateway',{organizationId,question,language,context,deterministicAnswer,aggregateContext,patientContext,knowledge})
}
