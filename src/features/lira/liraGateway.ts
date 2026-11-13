import { invokeAuthenticatedFunction } from '../../core/supabase/client'
// Ό,τι στέλνει η LIRA στο gateway: η ερώτηση και το πλαίσιο της ντετερμινιστικής απάντησης.
export interface LiraGatewayRequest { organizationId: string, question: string, language?: string, context?: unknown, deterministicAnswer?: unknown, aggregateContext?: unknown, patientContext?: unknown, knowledge?: unknown[] }
export async function callLiraGateway({organizationId,question,language='el',context=null,deterministicAnswer=null,aggregateContext=null,patientContext=null,knowledge=[]}: LiraGatewayRequest){
 return invokeAuthenticatedFunction('lira-ai-gateway',{organizationId,question,language,context,deterministicAnswer,aggregateContext,patientContext,knowledge})
}
