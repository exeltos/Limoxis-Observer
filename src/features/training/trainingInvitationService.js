import {supabase} from '../../core/supabase/client'
import {hasSupabaseConfig} from '../../core/config/env'
import {isDemoDataEnvironment} from '../../core/data/dataEnvironment'

function cloudRequired(operation){if(isDemoDataEnvironment())return false;if(!hasSupabaseConfig||!supabase)throw new Error(`PRODUCTION_CLOUD_REQUIRED:${operation}`);return true}

export async function queueTrainingInvitationAsync(assignmentKey,language='el'){if(!cloudRequired('training.invitation.queue'))return {demo:true,assignmentId:assignmentKey};const {data,error}=await supabase.rpc('queue_training_invitation',{p_assignment_key:assignmentKey,p_language:language});if(error)throw error;return data}
export async function loadTrainingEmailAccessAsync(token){if(!cloudRequired('training.access'))return null;const {data,error}=await supabase.rpc('training_email_access',{p_token:token});if(error)throw error;return data}
export async function confirmTrainingAttendanceAsync(token){if(!cloudRequired('training.attendance'))return null;const {data,error}=await supabase.rpc('training_confirm_attendance',{p_token:token});if(error)throw error;return data}
export async function submitTrainingEvaluationAsync(token,{answers={},feedbackScores={},feedbackComment=''}={}){if(!cloudRequired('training.evaluation'))return null;const {data,error}=await supabase.rpc('training_submit_evaluation',{p_token:token,p_answers:answers,p_feedback_scores:feedbackScores,p_feedback_comment:feedbackComment||null});if(error)throw error;return data}
export async function processTrainingOutboxAsync(organizationId){if(!cloudRequired('training.email.process'))return {demo:true,sent:0,failed:0};const {data,error}=await supabase.functions.invoke('process-notification-outbox',{body:{organizationId}});if(error)throw error;if(data?.ok===false){const err=new Error(data.code||data.error||'TRAINING_EMAIL_SEND_FAILED');err.code=data.code||'TRAINING_EMAIL_SEND_FAILED';err.details=data;throw err}return data}
