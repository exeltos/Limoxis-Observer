import './trainingMyView.css'
import { useEffect,useMemo,useState } from 'react'
import { Check,Inbox,X } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { FilterBar } from '../../design-system/FilterBar'
import { SegmentedControl } from '../../design-system/SegmentedControl'
import { RegistryTable } from '../../design-system/RegistryTable'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { GovernedReasonDialog } from '../../design-system/GovernedReasonDialog'
import { formatDay } from '../../core/i18n/formatDay'
import { matchesSearch } from '../../core/i18n/searchMatch'
import type { TrainingParticipationRequest } from './trainingMyView'
import type { TrainingProgram } from './trainingTypes'

// «Αιτήσεις συμμετοχής» of the training managers (owner, 20/11/2026): who asked to attend which programme, when and
// why; «Αποδοχή» creates the assignment, «Απόρριψη» asks for the reason (the shared reason dialog), which the requester
// sees on «Απορρίφθηκε». «Σε αναμονή» first; «Όλες» keeps the answered ones too.
interface TrainingRequestsPanelProps { requests: TrainingParticipationRequest[], programs: TrainingProgram[], language: string, busyId: string|null, onDecide: (request: TrainingParticipationRequest,accept: boolean,reason?: string)=>unknown }
export function TrainingRequestsPanel({requests,programs,language,busyId,onDecide}: TrainingRequestsPanelProps){
 const en=language==='en',tr=(el: string,enText: string)=>en?enText:el
 const [view,setView]=useState('pending'),[query,setQuery]=useState(''),[page,setPage]=useState(1),[pageSize,setPageSize]=useState(15),[rejecting,setRejecting]=useState<TrainingParticipationRequest|null>(null)
 const titleOf=(request: TrainingParticipationRequest)=>programs.find(program=>program.id===request.programId)?.title||request.programTitle||request.programId
 const shown=useMemo(()=>requests.filter(request=>request.status!=='cancelled'&&(view==='all'||request.status==='pending')&&matchesSearch(query,[request.requesterName,request.department,titleOf(request),request.note])),[requests,view,query])// eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>setPage(1),[view,query,pageSize])
 const pending=requests.filter(request=>request.status==='pending').length,answered=requests.filter(request=>request.status==='accepted'||request.status==='rejected').length
 const totalPages=Math.max(1,Math.ceil(shown.length/pageSize)),safePage=Math.min(page,totalPages),pageRows=shown.slice((safePage-1)*pageSize,safePage*pageSize)
 const statusBadge=(request: TrainingParticipationRequest)=>request.status==='accepted'?<span className="status-badge active">{tr('Έγινε δεκτή','Accepted')}</span>:request.status==='rejected'?<span className="status-badge danger" title={request.decisionReason||undefined}>{tr('Απορρίφθηκε','Rejected')}</span>:<span className="status-badge info">{tr('Σε αναμονή','Pending')}</span>
 return <>
  <FilterBar query={query} onQueryChange={setQuery} placeholder={tr('Αναζήτηση εργαζομένου, τμήματος ή προγράμματος…','Search employee, department or programme…')} end={<SegmentedControl ariaLabel={tr('Ποιες αιτήσεις','Which requests')} value={view} onChange={setView} options={[{value:'pending',label:`${tr('Σε αναμονή','Pending')} (${pending})`},{value:'all',label:`${tr('Όλες','All')} (${pending+answered})`}]}/>}/>
  <RegistryTable className="training-requests-table" sortable={false} rows={pageRows} emptyTitle={requests.length?tr('Καμία αίτηση σε αυτή την επιλογή.','No request in this choice.'):tr('Δεν υπάρχουν αιτήσεις συμμετοχής.','There are no participation requests.')} emptyIcon={requests.length?undefined:Inbox} emptyFiltered={Boolean(requests.length&&query)} onClearFilters={()=>setQuery('')}
   columns={[{key:'person',label:tr('Εργαζόμενος','Employee')},{key:'program',label:tr('Εκπαίδευση','Training')},{key:'date',label:tr('Ημερομηνία','Date')},{key:'note',label:tr('Σημείωση','Note')},{key:'decision',label:'',ariaLabel:tr('Απόφαση','Decision')}]}
   renderRow={(request: TrainingParticipationRequest)=><tr>
    <td className="training-requests-person"><strong>{request.requesterName||'—'}</strong>{request.department&&<small>{request.department}</small>}</td>
    <td className="training-requests-program" title={titleOf(request)}>{titleOf(request)}</td>
    <td className="training-requests-date">{formatDay(request.createdAt)}</td>
    <td className="training-requests-note" title={request.note||undefined}>{request.note||'—'}</td>
    <td className="open-record-cell"><span className="training-requests-actions">{request.status==='pending'?<><Button variant="secondary" className="training-my-open" loading={busyId===request.id} disabled={Boolean(busyId)} onClick={()=>onDecide(request,true)}><Check size={14}/>{tr('Αποδοχή','Accept')}</Button><Button variant="secondary" className="training-my-open" disabled={Boolean(busyId)} onClick={()=>setRejecting(request)}><X size={14}/>{tr('Απόρριψη','Reject')}</Button></>:statusBadge(request)}</span></td>
   </tr>}/>
  <RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={shown.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize}/>
  <GovernedReasonDialog open={Boolean(rejecting)} danger title={tr('Απόρριψη αίτησης συμμετοχής','Reject the participation request')} description={rejecting?`${rejecting.requesterName||'—'} · ${titleOf(rejecting)}. ${tr('Ο αιτών βλέπει την αιτιολογία.','The requester sees the reason.')}`:undefined} label={tr('Αιτιολογία απόρριψης','Reason for rejection')} confirmLabel={tr('Απόρριψη','Reject')} onCancel={()=>setRejecting(null)} onConfirm={reason=>{const request=rejecting;setRejecting(null);if(request)void onDecide(request,false,reason)}}/>
 </>
}
