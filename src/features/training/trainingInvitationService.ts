import {supabase as configuredSupabase,type Cloud} from '../../core/supabase/client'
import {hasSupabaseConfig} from '../../core/config/env'
import {isDemoDataEnvironment} from '../../core/data/dataEnvironment'
import type { AssessmentAnswers } from './trainingTypes'
// What a submission returns: the attempt and its programme.
type SubmissionResult = { assignmentId?: string, programId?: string }
import type {Json} from '../../core/supabase/database.types'

// Every cloud call below runs after cloudRequired, which checks that the client exists.
const supabase=configuredSupabase as Cloud

const TRAINING_UPDATES_CHANNEL='limoxis-training-updates'
const TRAINING_TAB_KEY='limoxis.training.activeTabText'

function cloudRequired(operation: string){if(isDemoDataEnvironment())return false;if(!hasSupabaseConfig||!supabase)throw new Error(`PRODUCTION_CLOUD_REQUIRED:${operation}`);return true}
function trainingEmailError(data: {code?: string, error?: string, message?: string}|null){const code=data?.code||'TRAINING_EMAIL_SEND_FAILED';const messages: Record<string, string>={EMAIL_SERVICE_NOT_CONFIGURED:'Η υπηρεσία email δεν είναι ρυθμισμένη στο Supabase. Απαιτούνται SMTP_USER και SMTP_PASS στο Edge Function.',EMAIL_BACKEND_CONFIG_MISSING:'Η υπηρεσία αποστολής email δεν έχει ολοκληρωμένη ρύθμιση.',EMAIL_AUTH_REQUIRED:'Απαιτείται ενεργή σύνδεση για αποστολή email.',EMAIL_INVALID_SESSION:'Η συνεδρία έληξε. Συνδεθείτε ξανά.',EMAIL_NOT_AUTHORIZED:'Δεν έχετε δικαίωμα αποστολής αυτής της φόρμας.'};const err: Error&{code?: string, details?: unknown}=new Error(messages[code]||data?.error||'Δεν ήταν δυνατή η αποστολή του email.');err.code=code;err.details=data;return err}

function announceTrainingUpdate(payload: Record<string, unknown>={}){
 if(typeof window==='undefined'||typeof BroadcastChannel==='undefined')return
 const channel=new BroadcastChannel(TRAINING_UPDATES_CHANNEL)
 channel.postMessage({type:'training-submission-updated',at:Date.now(),...payload})
 channel.close()
}

function installTrainingRefreshBridge(){
 if(typeof window==='undefined'||typeof BroadcastChannel==='undefined')return
 const restoreTab=()=>{
  const wanted=sessionStorage.getItem(TRAINING_TAB_KEY)
  if(!wanted)return
  let attempts=0
  const tryRestore=()=>{
   const buttons=[...document.querySelectorAll<HTMLButtonElement>('.entity-record-tabs button')]
   const target=buttons.find(button=>button.textContent?.trim()===wanted)
   if(target){sessionStorage.removeItem(TRAINING_TAB_KEY);target.click();return}
   if(attempts++<20)setTimeout(tryRestore,100)
  }
  setTimeout(tryRestore,0)
 }
 restoreTab()
 const channel=new BroadcastChannel(TRAINING_UPDATES_CHANNEL)
 channel.onmessage=event=>{
  if(event?.data?.type!=='training-submission-updated')return
  const path=window.location.pathname||''
  if(!/^\/training\/[^/]+\/?$/.test(path))return
  if(document.querySelector('.observer-dialog'))return
  const active=document.querySelector('.entity-record-tabs button.active')
  if(active?.textContent?.trim())sessionStorage.setItem(TRAINING_TAB_KEY,active.textContent.trim())
  window.location.reload()
 }
}
installTrainingRefreshBridge()

async function queueTrainingInvitationAsync(assignmentKey: string,language='el'){if(!cloudRequired('training.invitation.queue'))return {demo:true,assignmentId:assignmentKey};const {data,error}=await supabase.rpc('queue_training_invitation',{p_assignment_key:assignmentKey,p_language:language});if(error)throw error;return data}
export async function loadTrainingEmailAccessAsync(token: string){if(!cloudRequired('training.access'))return null;const {data,error}=await supabase.rpc('training_email_access',{p_token:token});if(error)throw error;return data}
export async function submitTrainingEvaluationAsync(token: string,{answers={},feedbackScores={},feedbackComment='',attendanceAttested=false}: {answers?: AssessmentAnswers,feedbackScores?: Record<string, number>,feedbackComment?: string|null,attendanceAttested?: boolean}={}){if(!cloudRequired('training.evaluation'))return null;const {data,error}=await supabase.rpc('training_submit_evaluation',{p_token:token,p_answers:answers as Json,p_feedback_scores:feedbackScores,p_feedback_comment:(feedbackComment||null) as string,p_attendance_attested:Boolean(attendanceAttested)});if(error)throw error;announceTrainingUpdate({assignmentId:(data as SubmissionResult|null)?.assignmentId||null,programId:(data as SubmissionResult|null)?.programId||null});return data}
async function processTrainingOutboxAsync(organizationId: string|null|undefined){if(!cloudRequired('training.email.process'))return {demo:true,sent:0,failed:0};const {data,error}=await supabase.functions.invoke('process-notification-outbox',{body:{organizationId}});if(error)throw error;if(data?.ok===false)throw trainingEmailError(data);return data}
export async function sendTrainingInvitationsAsync(assignmentKeys: (string|null|undefined)[]|null|undefined,language='el',organizationId?: string|null){const keys=[...new Set((assignmentKeys||[]).filter(Boolean))] as string[];if(!keys.length)return {queued:0,processed:null};for(const key of keys)await queueTrainingInvitationAsync(key,language);const processed=await processTrainingOutboxAsync(organizationId);return {queued:keys.length,processed}}
