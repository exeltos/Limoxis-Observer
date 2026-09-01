import { useCallback,useEffect,useMemo,useState } from 'react'
import { Navigate,useSearchParams } from 'react-router-dom'
import { CheckCircle2,ClipboardCheck,MapPin } from 'lucide-react'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { Button } from '../../design-system/Button'
import { RouteLoading } from '../../design-system/RouteLoading'
import { Page } from '../../design-system/Page'
import { useAuth } from '../../core/auth/AuthContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { can,CAPABILITIES } from '../../core/permissions/roles'
import { CommitteeRecordPage } from './CommitteeRecordPage'
import { CommitteeApprovalPanel } from './CommitteeApprovalPanel'
import { loadCommitteeApprovalDeepLinkAsync,decideCommitteeApprovalDeepLinkAsync } from './committeeApprovalDeepLinkService'

const fmtDateTime=(value,en)=>value?new Date(value).toLocaleString(en?'en-GB':'el-GR',{dateStyle:'medium',timeStyle:'short'}):'—'

export function CommitteeRecordPageRoute(){
  const [params,setParams]=useSearchParams()
  const approvalId=params.get('approval')||''
  const meetingKey=params.get('meeting')||''
  const {user}=useAuth()
  const {tenant,isDemo,role,membership}=useTenant()
  const {notify,notifyError}=useFeedback()
  const {language}=useLanguage();const en=language==='en'
  const [state,setState]=useState({loading:false,data:null,error:null})
  const canViewCommittee=can(role,CAPABILITIES.VIEW_COMMITTEES,membership?.capabilities??[],membership?.customCapabilities??[])

  const closeApproval=useCallback(()=>{
    const next=new URLSearchParams(params)
    next.delete('approval');next.delete('meeting')
    setParams(next,{replace:true})
  },[params,setParams])

  const load=useCallback(async()=>{
    if(!approvalId||isDemo||!tenant?.id||!user?.id){setState({loading:false,data:null,error:null});return}
    setState(s=>({...s,loading:true,error:null}))
    try{
      const data=await loadCommitteeApprovalDeepLinkAsync(tenant.id,user.id,approvalId)
      setState({loading:false,data,error:data?null:new Error('APPROVAL_NOT_AVAILABLE')})
    }catch(error){setState({loading:false,data:null,error})}
  },[approvalId,isDemo,tenant?.id,user?.id])

  useEffect(()=>{void load()},[load])

  const meeting=state.data?.meeting||null
  const routeMatches=useMemo(()=>!meetingKey||!meeting||[meeting.id,meeting.dbId].filter(Boolean).map(String).includes(String(meetingKey)),[meetingKey,meeting])

  async function decide(status,comment=''){
    if(!approvalId)return
    try{
      await decideCommitteeApprovalDeepLinkAsync(approvalId,status,comment)
      notify(status==='approved'?(en?'Minutes approved.':'Τα πρακτικά εγκρίθηκαν.'):(en?'Correction request sent.':'Το αίτημα διορθώσεων καταχωρήθηκε.'),'success',{operation:'committee_minutes_approval'})
      await load()
    }catch(error){notifyError(error,'save',{operation:'committee_minutes_approval'})}
  }

  if(!canViewCommittee&&!approvalId)return <Navigate to="/" replace/>

  return <>
    {canViewCommittee?<CommitteeRecordPage/>:<Page fill title={en?'Committee minutes approval':'Έγκριση πρακτικών επιτροπής'}><div className="inline-empty">{en?'Review the requested minutes in the approval window.':'Ελέγξτε τα πρακτικά στο παράθυρο έγκρισης.'}</div></Page>}
    {approvalId&&state.loading&&<div className="modal-backdrop"><section className="login-briefing"><RouteLoading/></section></div>}
    {approvalId&&!state.loading&&state.error&&<ObserverDialog width="standard" eyebrow={en?'Minutes approval':'Έγκριση πρακτικών'} title={en?'Approval is not available':'Η έγκριση δεν είναι διαθέσιμη'} subtitle={en?'It may already have been completed or you may no longer be an approver.':'Μπορεί να έχει ήδη ολοκληρωθεί ή να μην είστε πλέον ο απαιτούμενος εγκριτής.'} onClose={closeApproval} footer={<Button onClick={closeApproval}>{en?'Close':'Κλείσιμο'}</Button>}/>} 
    {approvalId&&!state.loading&&state.data&&!routeMatches&&<ObserverDialog width="standard" eyebrow={en?'Minutes approval':'Έγκριση πρακτικών'} title={en?'The meeting link is no longer valid':'Ο σύνδεσμος συνεδρίασης δεν είναι πλέον έγκυρος'} subtitle={en?'Open the current notification from the notification center.':'Ανοίξτε την τρέχουσα ειδοποίηση από το κέντρο ειδοποιήσεων.'} onClose={closeApproval} footer={<Button onClick={closeApproval}>{en?'Close':'Κλείσιμο'}</Button>}/>} 
    {approvalId&&!state.loading&&state.data&&routeMatches&&<ObserverDialog width="workspace" eyebrow={state.data.committee.name||state.data.committee.code} title={meeting?.title|| (en?'Meeting minutes':'Πρακτικά συνεδρίασης')} subtitle={`${fmtDateTime(meeting?.scheduledAt,en)}${meeting?.location?` · ${meeting.location}`:''}`} onClose={closeApproval} footer={<Button variant="secondary" onClick={closeApproval}>{en?'Close':'Κλείσιμο'}</Button>}>
      <div className="observer-form-section"><div className="details-grid"><div><span>{en?'Minutes number':'Αρ. πρακτικού'}</span><strong>{meeting?.minutesNo||'—'}</strong></div><div><span>{en?'Quorum':'Απαρτία'}</span><strong>{meeting?.quorum===true?(en?'Yes':'Ναι'):meeting?.quorum===false?(en?'No':'Όχι'):'—'}</strong></div><div><span>{en?'Meeting':'Συνεδρίαση'}</span><strong><ClipboardCheck size={15}/> {meeting?.title||'—'}</strong></div><div><span>{en?'Location':'Χώρος'}</span><strong><MapPin size={15}/> {meeting?.location||'—'}</strong></div></div></div>
      <div className="observer-form-section"><div className="record-section-header"><div><span className="eyebrow">Limoxis Observer</span><h3>{en?'Agenda & conclusions':'Θέματα & συμπεράσματα'}</h3></div></div>{(meeting?.topics||[]).map((topic,index)=><div className="committee-topic-card" key={topic.id||index}><strong>{en?'Topic':'Θέμα'} {index+1}</strong><div className="source-truth-note"><strong>{topic.subject||'—'}</strong><p>{topic.decision||'—'}</p></div></div>)}{!(meeting?.topics||[]).length&&<div className="inline-empty">{en?'No agenda items recorded.':'Δεν έχουν καταγραφεί θέματα.'}</div>}</div>
      <div className="observer-form-section"><div className="record-section-header"><div><span className="eyebrow">Limoxis Observer</span><h3>{en?'Minutes':'Πρακτικά'}</h3></div></div><div className="source-truth-note"><p>{meeting?.generalNotes|| (en?'No additional minutes text.':'Δεν υπάρχει πρόσθετο κείμενο πρακτικών.')}</p></div></div>
      <CommitteeApprovalPanel approvals={meeting?.approvals||[]} actorId={user?.id} busy={state.loading} onApprove={()=>decide('approved','')} onRequestChanges={(id,comment)=>decide('rejected',comment)} en={en}/>
      {state.data.approval.status!=='pending'&&<div className="source-truth-note"><strong><CheckCircle2 size={15}/> {en?'Your decision has been recorded':'Η απόφασή σας έχει καταγραφεί'}</strong></div>}
    </ObserverDialog>}
  </>
}
