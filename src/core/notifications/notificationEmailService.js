import { supabase } from '../supabase/client'
import { hasSupabaseConfig } from '../config/env'
import { isDemoDataEnvironment } from '../data/dataEnvironment'

export async function processNotificationOutboxAsync(organizationId){
  if(isDemoDataEnvironment()||!organizationId)return {ok:true,skipped:true}
  if(!hasSupabaseConfig||!supabase)throw new Error('PRODUCTION_NOTIFICATION_EMAIL_SERVICE_REQUIRED')
  const {data,error}=await supabase.functions.invoke('process-notification-outbox',{body:{organizationId}})
  if(error)throw error
  return data||{ok:true}
}
