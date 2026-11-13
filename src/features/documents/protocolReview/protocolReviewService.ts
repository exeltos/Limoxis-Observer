import { supabase } from '../../../core/supabase/client'
import { hasSupabaseConfig } from '../../../core/config/env'
import { isDemoDataEnvironment } from '../../../core/data/dataEnvironment'
import { loadSnapshot, saveSnapshot } from '../../../core/data/repository'
import { DEMO_PROTOCOL_SUGGESTIONS } from './protocolReviewDemoData'
import { decisionProblem, suggestionFromRow, todayKey, type ProtocolSuggestion } from './protocolReviewModel'
import { cloudClient } from '../../../core/supabase/cloudContext'
import type { Database } from '../../../core/supabase/database.types'
import type { Tables } from '../../../core/supabase/database.types'

// Protocol update suggestions: read under the documents' RLS, decided through
// protocol_suggestion_decide (audited). The Demo keeps them in its snapshot.
const COLUMNS='id,organization_id,document_id,reason,source_kind,source_ref,source_label,source_url,what_changed,affected_sections,details,draft_text,draft_citation,status,decided_at,rejection_reason,snoozed_until,revision_document_id,created_at'
const TABLE='protocol_update_suggestions'

function production(organizationId: string|null|undefined,operation: string): organizationId is string{
 if(isDemoDataEnvironment())return false
 if(!hasSupabaseConfig||!supabase)throw new Error(`PRODUCTION_PROTOCOL_REVIEW_SUPABASE_REQUIRED:${operation}`)
 if(!organizationId)throw new Error(`PRODUCTION_PROTOCOL_REVIEW_ORGANIZATION_REQUIRED:${operation}`)
 return true
}

type SuggestionRow=Tables<'protocol_update_suggestions'>
const loadLocal=(): SuggestionRow[]=>{const rows=loadSnapshot(TABLE,structuredClone(DEMO_PROTOCOL_SUGGESTIONS));return Array.isArray(rows)?rows:[]}

// Open and postponed suggestions of the organisation (decided ones stay in the
// table and the audit log, not on screen).
export async function loadProtocolSuggestionsAsync(organizationId: string|null|undefined): Promise<ProtocolSuggestion[]>{
 if(!production(organizationId,'load'))return loadLocal().filter(row=>['open','snoozed'].includes(row.status)).map(suggestionFromRow) as ProtocolSuggestion[]
 const rows: Partial<SuggestionRow>[]=[]
 for(let from=0;;from+=1000){
  const {data,error}=await cloudClient().from(TABLE).select(COLUMNS).eq('organization_id',organizationId).in('status',['open','snoozed']).order('created_at',{ascending:false}).range(from,from+999)
  if(error){if(error.code==='42501'||error.code==='42P01')return [];throw error}
  rows.push(...(data||[]))
  if(!data||data.length<1000)break
 }
 return rows.map(suggestionFromRow) as ProtocolSuggestion[]
}

export async function decideProtocolSuggestionAsync(organizationId: string|null|undefined,suggestion: ProtocolSuggestion|null|undefined,{decision,reason='',snoozeUntil='',revisionDocumentId=null}: {decision?: string,reason?: string,snoozeUntil?: string,revisionDocumentId?: string|null}={},actor: {id?: string|null}|null=null){
 // The revision notes belong to the new revision, not to the suggestion.
 const problem=decisionProblem({decision,reason,snoozeUntil,notes:decision==='accepted'?'revision':'',today:todayKey()})
 if(problem)throw new Error(`PROTOCOL_SUGGESTION_${problem.toUpperCase()}`)
 if(!suggestion?.id)throw new Error('PROTOCOL_SUGGESTION_UNKNOWN')
 if(!production(organizationId,'decide')){
  const rows=loadLocal()
  const now=new Date().toISOString()
  const next=rows.map(row=>row.id!==suggestion.id?row:{...row,status:decision,decided_at:now,decided_by:actor?.id||null,
   rejection_reason:decision==='rejected'?String(reason).trim().slice(0,1000):row.rejection_reason||null,
   snoozed_until:decision==='snoozed'?snoozeUntil:null,revision_document_id:decision==='accepted'?revisionDocumentId:null})
  saveSnapshot(TABLE,next)
  return suggestionFromRow(next.find(row=>row.id===suggestion.id))
 }
 // The generated types mark the optional arguments as non-null; the function takes null for them.
 const {data,error}=await cloudClient().rpc('protocol_suggestion_decide',{p_suggestion_id:suggestion.id,p_decision:decision,p_reason:decision==='rejected'?String(reason).trim():null,p_snooze_until:decision==='snoozed'?snoozeUntil:null,p_revision_document_id:decision==='accepted'?revisionDocumentId:null} as Database['public']['Functions']['protocol_suggestion_decide']['Args'])
 if(error)throw error
 return suggestionFromRow(data as SuggestionRow|null)
}
