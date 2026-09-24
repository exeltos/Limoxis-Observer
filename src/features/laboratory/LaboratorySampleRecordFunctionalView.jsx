import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Download, FileClock, FileSearch, FlaskConical, LockKeyhole, Microscope, Paperclip, Pencil, PhoneCall, PlayCircle, Printer, RotateCcw, ShieldAlert, X } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { Button } from '../../design-system/Button'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { ObserverDialog, DialogActions } from '../../design-system/ObserverDialog'
import { GovernedReasonDialog } from '../../design-system/GovernedReasonDialog'
import { ManualDateField } from '../../design-system/ManualDateField'
import { TimeField } from '../../design-system/TimeField'
import { EmptyState } from '../../design-system/EmptyState'
import { EntityAttachmentsPanel } from '../../design-system/EntityAttachmentsPanel'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { can, CAPABILITIES } from '../../core/permissions/roles'
import { useContextualNavigation } from '../../core/navigation/useContextualNavigation'
import { useRecordSequenceNavigation } from '../../core/navigation/useRecordSequenceNavigation'
import { downloadRecordJson } from '../../core/export/recordExport'
import { ENVIRONMENTAL_CATEGORIES, resolveEnvironmentalStandard, sampleTypeLabel } from './laboratoryCloudService'
import { LaboratoryStatus as Status } from './LaboratoryStatus'
import { LaboratorySampleSummary, LaboratoryWorkflow } from './LaboratorySampleSummary'
import { useLaboratoryRepository } from './hooks/useLaboratoryRepository'
import { loadManagementLibraries } from '../management/managementCloudService'
import { demoLibrarySeed } from '../management/managementData'

const copy={
 el:{reject:'Απόρριψη δείγματος',rejectReason:'Αιτιολογία απόρριψης',rejectHelp:'Το δείγμα δεν θα διαγραφεί. Θα σημανθεί ως απορριφθέν και η αιτιολογία θα παραμείνει στο ιστορικό.',rejected:'Το δείγμα απορρίφθηκε και η αιτιολογία καταγράφηκε.',process:'Έναρξη επεξεργασίας',processing:'Η επεξεργασία του δείγματος ξεκίνησε.',correction:'Διόρθωση',correctionHelp:'Η εγγραφή είναι οριστικοποιημένη. Η διόρθωση την ξεκλειδώνει και καταγράφεται στο ιστορικό.',finalize:'Οριστικοποίηση',finalizeRecord:'Οριστικοποίηση εγγραφής',finalized:'Η εργαστηριακή καταχώριση οριστικοποιήθηκε',finalizedReadOnly:'Οριστικοποιημένη εργαστηριακή καταχώριση · μόνο για ανάγνωση',rejectedReadOnly:'Απορριφθέν δείγμα · μόνο για ανάγνωση',method:'Μέθοδος',status:'Κατάσταση',draft:'Πρόχειρο',validated:'Επικυρωμένο',amended:'Διορθωμένο',organisms:'Μικροοργανισμοί',organism:'Μικροοργανισμός',chooseOrganism:'Επιλέξτε από τη Βιβλιοθήκη Μικροοργανισμών',antibiotic:'Αντιβιοτικό',chooseAntibiotic:'Επιλέξτε από τη Βιβλιοθήκη Αντιβιοτικών',critical:'Κρίσιμο αποτέλεσμα',cfu:'CFU',assessment:'Αξιολόγηση',within:'Εντός ορίων',outside:'Εκτός ορίων',noLimit:'Δεν υπάρχει ρυθμισμένο όριο',protocol:'Το όριο εφαρμόζεται αυτόματα από το κεντρικά ρυθμισμένο πρωτόκολλο.',noProtocol:'Δεν βρέθηκε πρωτόκολλο',documents:'Ολοκλήρωση ελέγχου εγγράφων',documentsDone:'Τα έγγραφα ελέγχθηκαν.',documentsHint:'Ελέγξτε τα συνημμένα του δείγματος και επιβεβαιώστε ότι είναι πλήρη.',saveDraft:'Αποθήκευση προχείρου',validate:'Επικύρωση αποτελέσματος',enterResult:'Καταχώριση αποτελέσματος',editResult:'Επεξεργασία αποτελέσματος',addAst:'Προσθήκη αντιβιογράμματος',classifyAmr:'Ταξινόμηση AMR',changeAmr:'Αλλαγή ταξινόμησης AMR',addCommunication:'Καταγραφή επικοινωνίας',print:'Εκτύπωση',export:'Εξαγωγή JSON',stepReceive:'Παραλαβή',stepResult:'Αποτέλεσμα',stepAst:'Αντιβιόγραμμα',stepCommunication:'Επικοινωνία κρίσιμου',stepDocuments:'Έλεγχος εγγράφων',stepFinalize:'Οριστικοποίηση',hintReceive:'Παραλάβετε το δείγμα και ξεκινήστε την επεξεργασία',hintResult:'Καταχωρίστε και επικυρώστε το μικροβιολογικό αποτέλεσμα',hintAst:'Καταχωρίστε αντιβιόγραμμα για κάθε μικροοργανισμό',hintCommunication:'Τεκμηριώστε την ενημέρωση του κλινικού αποδέκτη',hintDocuments:'Ελέγξτε τα συνημμένα του δείγματος',hintFinalize:'Όλα τα βήματα ολοκληρώθηκαν — οριστικοποιήστε την εγγραφή',awaitingPermission:'Αναμένεται ενέργεια από χρήστη με το αντίστοιχο δικαίωμα.',organismRequired:'Για επικύρωση θετικού αποτελέσματος απαιτείται τουλάχιστον ένας μικροοργανισμός.',noAst:'Δεν έχει καταχωριστεί αντιβιόγραμμα.',noCommunication:'Δεν έχει καταγραφεί ακόμη επικοινωνία.',noResult:'Δεν έχει καταχωριστεί αποτέλεσμα.',standard:'Πρότυπο',version:'Έκδοση',notes:'Σημειώσεις',recipient:'Παραλήπτης',role:'Ρόλος / ιδιότητα',department:'Τμήμα',channel:'Τρόπος επικοινωνίας',date:'Ημερομηνία επικοινωνίας',time:'Ώρα επικοινωνίας',readBack:'Επιβεβαίωση ορθής επανάληψης (read-back)',classification:'Κατηγορία',definitionSource:'Πηγή ορισμού',definitionVersion:'Έκδοση ορισμού',rationale:'Τεκμηρίωση / αιτιολόγηση',amrTitle:'Ταξινόμηση AMR',astTitle:'Νέο αντιβιόγραμμα',communicationTitle:'Επικοινωνία κρίσιμου αποτελέσματος',resultHelp:'Ο μικροοργανισμός εμφανίζεται μόνο όταν το αποτέλεσμα είναι θετικό.'},
 en:{reject:'Reject sample',rejectReason:'Rejection reason',rejectHelp:'The sample will not be deleted. It will be marked as rejected and the reason kept in history.',rejected:'The sample was rejected and the reason was recorded.',process:'Start processing',processing:'Sample processing has started.',correction:'Correction',correctionHelp:'This record is finalized. A correction unlocks it and is recorded in history.',finalize:'Finalization',finalizeRecord:'Finalize record',finalized:'The laboratory record has been finalized',finalizedReadOnly:'Finalized laboratory record · read only',rejectedReadOnly:'Rejected sample · read only',method:'Method',status:'Status',draft:'Draft',validated:'Validated',amended:'Amended',organisms:'Microorganisms',organism:'Microorganism',chooseOrganism:'Select from the Microorganism Library',antibiotic:'Antibiotic',chooseAntibiotic:'Select from the Antibiotic Library',critical:'Critical result',cfu:'CFU',assessment:'Assessment',within:'Within limits',outside:'Outside limits',noLimit:'No configured limit',protocol:'The limit is applied automatically from the centrally configured protocol.',noProtocol:'No protocol configured',documents:'Complete document review',documentsDone:'Documents have been reviewed.',documentsHint:'Review the sample attachments and confirm they are complete.',saveDraft:'Save draft',validate:'Validate result',enterResult:'Enter result',editResult:'Edit result',addAst:'Add susceptibility test',classifyAmr:'AMR classification',changeAmr:'Change AMR classification',addCommunication:'Record communication',print:'Print',export:'Export JSON',stepReceive:'Receipt',stepResult:'Result',stepAst:'Susceptibility',stepCommunication:'Critical communication',stepDocuments:'Document review',stepFinalize:'Finalization',hintReceive:'Receive the sample and start processing',hintResult:'Enter and validate the microbiology result',hintAst:'Record susceptibility testing for every organism',hintCommunication:'Document notification of the clinical recipient',hintDocuments:'Review the sample attachments',hintFinalize:'All steps are complete — finalize the record',awaitingPermission:'Awaiting action by a user with the required permission.',organismRequired:'A positive result needs at least one organism before validation.',noAst:'No susceptibility testing recorded.',noCommunication:'No communication recorded yet.',noResult:'No result recorded.',standard:'Standard',version:'Version',notes:'Notes',recipient:'Recipient',role:'Role / capacity',department:'Department',channel:'Communication method',date:'Communication date',time:'Communication time',readBack:'Read-back confirmation',classification:'Classification',definitionSource:'Definition source',definitionVersion:'Definition version',rationale:'Rationale',amrTitle:'AMR classification',astTitle:'New susceptibility test',communicationTitle:'Critical result communication',resultHelp:'Organism entry appears only when the result is positive.'}
}
const METHODS=[['culture','Καλλιέργεια','Culture'],['automated_culture','Αυτοματοποιημένη καλλιέργεια','Automated culture'],['maldi_tof','MALDI-TOF','MALDI-TOF'],['pcr','PCR','PCR'],['microscopy','Μικροσκόπηση','Microscopy'],['other','Άλλη μέθοδος','Other method']]
const methodLabel=(value,language)=>{const row=METHODS.find(x=>x[0]===value);return row?row[language==='el'?1:2]:value||'—'}
const rows=(libraries,key,language)=>(libraries?.[key]||[]).map(row=>({value:row[0],label:row[language==='el'?0:1]||row[0],code:row[2]?.code||''}))
const organismsOf=result=>String(result?.organism||'').split(',').map(x=>x.trim()).filter(Boolean)

export function LaboratorySampleRecordFunctionalView(){
 const {sampleId}=useParams();const {t,locale,language}=useLanguage();const tx=key=>copy[language]?.[key]||copy.en[key]||key
 const {notify}=useFeedback();const {role,membership,tenant,isDemo,canAccessRecord}=useTenant();const repository=useLaboratoryRepository();const {goBack}=useContextualNavigation('/laboratory')
 const recordNavigation=useRecordSequenceNavigation({registry:'laboratory',currentId:sampleId,pathForId:id=>`/laboratory/${id}`})
 const [sample,setSample]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[tab,setTab]=useState('sample'),[dialog,setDialog]=useState(null),[standards,setStandards]=useState([]),[libraries,setLibraries]=useState({})
 const has=cap=>can(role,cap,membership?.capabilities??[],membership?.customCapabilities??[]);const canManage=has(CAPABILITIES.MANAGE_LAB_SAMPLES),canValidate=has(CAPABILITIES.VALIDATE_LAB_RESULTS),canCommunicate=has(CAPABILITIES.COMMUNICATE_CRITICAL_RESULTS),canReopen=has(CAPABILITIES.REOPEN_LAB_RECORD)
 const fmt=value=>value?new Intl.DateTimeFormat(locale,{dateStyle:'short',timeStyle:'short'}).format(new Date(value)):'—'
 async function reload(){setLoading(true);setError('');try{setSample(await repository.get(sampleId))}catch(err){setError(err?.message||t('actionFailed'))}finally{setLoading(false)}}
 useEffect(()=>{reload()},[sampleId,repository]) // eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{if(isDemo){setLibraries(demoLibrarySeed);return}if(tenant?.id)loadManagementLibraries(tenant.id).then(setLibraries).catch(()=>setLibraries({}))},[isDemo,tenant?.id])
 const isEnvironmental=sample?.subjectType==='environment'||ENVIRONMENTAL_CATEGORIES.includes(sample?.type)
 useEffect(()=>{if(isEnvironmental)repository.loadStandards().then(setStandards).catch(()=>setStandards([]))},[isEnvironmental,repository])
 const standard=isEnvironmental&&sample?resolveEnvironmentalStandard(standards,sample.type,sample.environmentalMethod):null
 const result=sample?.microbiologyResults?.[0]||null,ast=result?.ast||[],amr=result?.amr||[],communications=result?.communications||[],organisms=organismsOf(result),finalized=Boolean(sample?.finalizedAt),rejected=sample?.status==='rejected',locked=finalized||rejected,canManageActive=canManage&&!locked
 const received=Boolean(sample&&(sample.receivedAt||['processing','completed'].includes(sample.status))),resultValidated=Boolean(result&&['validated','amended'].includes(result.resultStatus)),astRequired=result?.result==='positive'&&organisms.length>0,astComplete=!astRequired||organisms.every(name=>ast.some(row=>row.organism===name)),communicationRequired=Boolean(result?.critical),communicationComplete=!communicationRequired||communications.length>0,documentsReviewed=Boolean(sample?.documentsReviewedAt),readyToFinalize=Boolean(resultValidated&&astComplete&&communicationComplete&&documentsReviewed)
 const tabs=useMemo(()=>[{id:'sample',label:t('laboratoryRecords.sample'),icon:FlaskConical},{id:'result',label:t('laboratoryRecords.microbiologyResult'),icon:Microscope},{id:'attachments',label:t('attachments'),icon:Paperclip},{id:'history',label:t('history'),icon:FileClock}],[language]) // eslint-disable-line react-hooks/exhaustive-deps
 async function run(work,message){try{await work();setDialog(null);await reload();notify(message,'success')}catch(err){notify(err?.message||t('actionFailed'),'error')}}
 const startProcessing=()=>run(()=>repository.updateStatus(sample.id,'processing',{receivedAt:sample.receivedAt||new Date()}),tx('processing'))
 const openResult=()=>{setTab('result');setDialog('result')}
 const openAst=organism=>{setTab('result');setDialog(`ast:${organism||organisms[0]||''}`)}
 const openCommunication=()=>{setTab('result');setDialog('communication')}
 async function reject(reason){if(finalized&&canReopen)await repository.reopen(sample.id,`${tx('reject')}: ${reason}`);await run(()=>repository.updateStatus(sample.id,'rejected',{rejectionReason:reason}),tx('rejected'))}
 if(loading)return <Page title={t('laboratoryRecords.sample')}><div className="inline-empty">{t('loading')}</div></Page>
 if(error||!sample)return <Page title={t('laboratoryRecords.sample')}><EmptyState title={t('actionFailed')} description={error||t('noData')}/></Page>
 if(!canAccessRecord(sample))return <Page title={t('laboratoryRecords.sample')}><EmptyState title={t('scopeAccessDeniedTitle')} description={t('scopeAccessDeniedDescription')}/></Page>

 const firstMissingAst=organisms.find(name=>!ast.some(row=>row.organism===name))
 const pending=[
  {id:'receive',label:tx('stepReceive'),done:received,meta:received?fmt(sample.receivedAt):'',hint:tx('hintReceive'),action:canManageActive?{label:tx('process'),icon:PlayCircle,onClick:startProcessing}:null},
  {id:'result',label:tx('stepResult'),done:resultValidated,meta:result?[result.result&&t(result.result),tx(result.resultStatus||'draft')].filter(Boolean).join(' · '):'',hint:tx('hintResult'),action:canManageActive?{label:result?tx('editResult'):tx('enterResult'),icon:Pencil,onClick:openResult}:null},
  {id:'ast',label:tx('stepAst'),done:astComplete,na:!astRequired,meta:astRequired?`${organisms.filter(name=>ast.some(row=>row.organism===name)).length}/${organisms.length}`:'',hint:firstMissingAst?`${tx('hintAst')} · ${firstMissingAst}`:tx('hintAst'),action:canManageActive?{label:tx('addAst'),icon:Microscope,onClick:()=>openAst(firstMissingAst)}:null},
  {id:'communication',label:tx('stepCommunication'),done:communicationComplete,na:!communicationRequired,meta:communications.length?fmt(communications[communications.length-1].at):'',hint:tx('hintCommunication'),action:canCommunicate&&!locked?{label:tx('addCommunication'),icon:PhoneCall,onClick:openCommunication}:null},
  {id:'documents',label:tx('stepDocuments'),done:documentsReviewed,meta:documentsReviewed?fmt(sample.documentsReviewedAt):'',hint:tx('hintDocuments'),action:!locked?{label:tx('documents'),icon:FileSearch,onClick:()=>setTab('attachments')}:null},
  {id:'finalize',label:tx('stepFinalize'),done:finalized,meta:finalized?fmt(sample.finalizedAt):'',hint:tx('hintFinalize'),action:canValidate&&!locked&&readyToFinalize?{label:tx('finalizeRecord'),icon:CheckCircle2,onClick:()=>run(()=>repository.finalize(sample.id),tx('finalized'))}:null},
 ]
 let nextAssigned=false
 const steps=pending.map(step=>{const state=step.na?'na':step.done?'done':nextAssigned?'todo':(nextAssigned=true,'next');return {...step,state,hint:step.action||state!=='next'?step.hint:`${step.hint} — ${tx('awaitingPermission')}`}})
 const closedNote=rejected?<><AlertTriangle size={16}/><span>{tx('rejectedReadOnly')}{sample.rejectionReason?` · ${sample.rejectionReason}`:''}</span></>:finalized?<><LockKeyhole size={16}/><span>{tx('finalizedReadOnly')}</span></>:null

 const sampleMenu=[
  canManageActive&&!received&&{id:'process',label:tx('process'),icon:PlayCircle,onClick:startProcessing},
  canManageActive&&received&&{id:'result',label:result?tx('editResult'):tx('enterResult'),icon:Pencil,onClick:openResult},
  finalized&&canReopen&&!rejected&&{id:'correct',label:tx('correction'),icon:RotateCcw,onClick:()=>setDialog('correction')},
  {id:'print',label:tx('print'),icon:Printer,separatorBefore:canManageActive||(finalized&&canReopen),onClick:()=>window.print()},
  {id:'export',label:tx('export'),icon:Download,onClick:()=>downloadRecordJson(sample,{filename:sample.id})},
  (canManageActive||(finalized&&canReopen&&!rejected))&&{id:'reject',label:tx('reject'),icon:AlertTriangle,tone:'danger',separatorBefore:true,onClick:()=>setDialog('reject')},
 ].filter(Boolean)

 return <Page fill><EntityRecordShell className="laboratory-record-shell workspace-fill" recordNavigation={recordNavigation} avatar={<FlaskConical size={20}/>} eyebrow={sample.id} title={sampleTypeLabel(sample.type,t)} subtitle={`${sample.subjectName||sample.patient||'—'}${(sample.subjectCode||sample.patientId)?` · ${sample.subjectCode||sample.patientId}`:''} · ${sample.department||'—'}`} status={<Status text={rejected?t('rejected'):finalized?t('completed'):t(sample.status)} kind={rejected?'rejected':finalized?'completed':sample.status}/>} tabs={tabs} activeTab={tab} onTabChange={setTab} onBack={goBack} backLabel={t('backToLaboratory')}>
  {tab==='sample'&&<div className="lab-record-stack">
   <LaboratoryWorkflow steps={steps} language={language} closedNote={closedNote}/>
   <LaboratorySampleSummary sample={sample} t={t} language={language} fmt={fmt} menu={<OverflowMenu items={sampleMenu}/>}/>
  </div>}
  {tab==='result'&&<div className="lab-record-stack">
   <ResultCard t={t} tx={tx} language={language} result={result} organisms={organisms} isEnvironmental={isEnvironmental} standard={standard} menu={<OverflowMenu items={[
    canManageActive&&received&&{id:'result',label:result?tx('editResult'):tx('enterResult'),icon:Pencil,onClick:openResult},
    canManageActive&&astRequired&&{id:'ast',label:tx('addAst'),icon:Microscope,onClick:()=>openAst(firstMissingAst)},
    canCommunicate&&!locked&&communicationRequired&&{id:'communication',label:tx('addCommunication'),icon:PhoneCall,onClick:openCommunication},
    finalized&&canReopen&&!rejected&&{id:'correct',label:tx('correction'),icon:RotateCcw,separatorBefore:true,onClick:()=>setDialog('correction')},
   ].filter(Boolean)}/>}/>
   {astRequired&&<section className="lab-record-card lab-ast-card"><div className="record-section-header"><div><span className="eyebrow">{tx('organisms')}</span><h3><ShieldAlert size={15}/> {language==='el'?'Αντιβιόγραμμα και AMR':'AST and AMR'}</h3></div></div>
    {organisms.map(name=>{const tagged=ast.filter(row=>row.organism===name);const current=amr.filter(row=>row.organism===name).slice(-1)[0]||null;return <article className="lab-isolate-card" key={name}>
     <div className="lab-isolate-summary"><div className="lab-isolate-identity"><span className="lab-isolate-icon"><Microscope size={18}/></span><div><span className="eyebrow">{tx('organism')}</span><h3>{name}</h3></div></div>
      <div className="record-section-actions">{current&&<span className="status-badge danger">{current.classification}</span>}{canManageActive&&<OverflowMenu items={[{id:'add-ast',label:tx('addAst'),icon:Microscope,onClick:()=>openAst(name)},{id:'classify-amr',label:current?tx('changeAmr'):tx('classifyAmr'),icon:ShieldAlert,onClick:()=>setDialog(`amr:${name}`)}]}/>}</div></div>
     {current&&<div className="lab-amr-strip"><ShieldAlert size={16}/><div><span>{tx('amrTitle')}</span><strong>{current.classification} · {current.definitionSource||'—'} {current.definitionVersion||''}</strong>{current.rationale&&<small>{current.rationale}</small>}</div></div>}
     <div className="record-table-wrap"><table className="record-table lab-ast-table"><thead><tr><th>{tx('antibiotic')}</th><th>MIC</th><th>S/I/R</th><th>{tx('method')}</th><th>{tx('standard')}</th></tr></thead><tbody>{tagged.length?tagged.map(row=><tr key={row.id}><td><strong>{row.drug}</strong></td><td>{row.mic!=null&&row.mic!==''?`${row.operator||''}${row.mic}`:row.zone!=null?`${row.zone} mm`:'—'}</td><td><span className={`lab-sir-badge sir-${String(row.sir||'').toLowerCase()}`}>{row.sir||'—'}</span></td><td>{row.method||'—'}</td><td>{[row.standard,row.version].filter(Boolean).join(' ')||'—'}</td></tr>):<tr><td colSpan="5" className="lab-table-empty">{tx('noAst')}</td></tr>}</tbody></table></div>
    </article>})}
   </section>}
   {communicationRequired&&<section className="lab-record-card lab-communication-card"><div className="record-section-header"><div><span className="eyebrow">{communicationComplete?tx('critical'):t('laboratoryRecords.criticalCommunicationRequired')}</span><h3><PhoneCall size={15}/> {tx('communicationTitle')}</h3></div>{canCommunicate&&!locked&&<OverflowMenu items={[{id:'add-communication',label:tx('addCommunication'),icon:PhoneCall,onClick:openCommunication}]}/>}</div>
    {communications.length?<div className="lab-communication-list">{communications.map(row=><article className="lab-communication-row" key={row.id}><div><strong>{row.to||row.recipientName||'—'}</strong>{(row.recipientRole||row.recipientDepartment)&&<span>{[row.recipientRole,row.recipientDepartment].filter(Boolean).join(' · ')}</span>}</div><div><span>{fmt(row.at)}</span><span>{t(row.method)}</span>{row.readBack&&<span className="status-badge active">Read-back</span>}</div></article>)}</div>:<div className="lab-inline-warning"><AlertTriangle size={16}/>{tx('noCommunication')}</div>}
   </section>}
  </div>}
  {tab==='attachments'&&<div className="lab-record-stack">
   {!locked&&!documentsReviewed&&<div className="lab-inline-action"><div><strong>{tx('stepDocuments')}</strong><span>{tx('documentsHint')}</span></div><Button variant="secondary" onClick={()=>run(()=>repository.markDocumentsReviewed(sample.id),tx('documentsDone'))}><CheckCircle2 size={15}/>{tx('documents')}</Button></div>}
   <div className="lab-attachments-card"><EntityAttachmentsPanel organizationId={tenant?.id} entityType="laboratory_sample" entityRecordId={sample.recordId} category="laboratory_evidence" canManage={canManage&&!locked} t={t} notify={notify}/></div>
  </div>}
  {tab==='history'&&<section className="lab-record-card"><div className="record-section-header"><div><span className="eyebrow">{t('laboratoryRecords.sample')}</span><h3><FileClock size={15}/> {t('history')}</h3></div></div><LabHistory sample={sample} t={t} tx={tx} fmt={fmt}/></section>}
 </EntityRecordShell>
 {dialog==='result'&&<ResultDialog t={t} tx={tx} language={language} result={result} isEnvironmental={isEnvironmental} standard={standard} libraries={libraries} canValidate={canValidate} onClose={()=>setDialog(null)} onSave={draft=>run(()=>repository.saveResult(sample.id,draft),t('saved'))}/>}
 {String(dialog||'').startsWith('ast:')&&<AstDialog tx={tx} language={language} libraries={libraries} organisms={organisms} initialOrganism={String(dialog).slice(4)} onClose={()=>setDialog(null)} onSave={draft=>run(()=>repository.addAst(sample.id,result.id,draft),t('saved'))}/>}
 {String(dialog||'').startsWith('amr:')&&<AmrDialog tx={tx} language={language} organism={String(dialog).slice(4)} initialClassification={amr.filter(row=>row.organism===String(dialog).slice(4)).slice(-1)[0]?.classification||''} onClose={()=>setDialog(null)} onSave={draft=>run(()=>repository.saveAmr(sample.id,result.id,draft),t('saved'))}/>}
 {dialog==='communication'&&<CommunicationDialog tx={tx} onClose={()=>setDialog(null)} onSave={draft=>run(()=>repository.communicate(sample.id,result.id,draft),t('saved'))}/>}
 <GovernedReasonDialog open={dialog==='reject'} danger title={tx('reject')} description={tx('rejectHelp')} label={`${tx('rejectReason')} *`} confirmLabel={tx('reject')} onCancel={()=>setDialog(null)} onConfirm={reject}/>
 <GovernedReasonDialog open={dialog==='correction'} title={tx('correction')} description={tx('correctionHelp')} confirmLabel={tx('correction')} onCancel={()=>setDialog(null)} onConfirm={reason=>run(()=>repository.reopen(sample.id,reason),tx('correction')).then(()=>setTab('result'))}/>
 </Page>
}

function ResultCard({t,tx,language,result,organisms,isEnvironmental,standard,menu}){
 const hasLimit=standard?.limitCfu!=null&&standard?.limitCfu!==''
 const title=isEnvironmental?t('laboratoryRecords.environmentalResult'):t('laboratoryRecords.resultAndOrganism')
 return <section className="lab-record-card lab-result-card">
  <div className="record-section-header"><div><span className="eyebrow">{t('laboratoryRecords.microbiologyResult')}</span><h3><Microscope size={15}/> {title}</h3></div>{menu}</div>
  {isEnvironmental&&<div className={`smart-protocol-strip ${hasLimit?'configured':'missing'}`}><div><strong>{standard?.protocolCode||tx('noProtocol')}</strong>{hasLimit&&<span> · {standard.limitCfu} {standard.unit||'CFU'}</span>}</div><span className="smart-lock-chip">🔒 {tx('protocol')}</span></div>}
  {result?<div className="lab-result-band">
   <div className={`lab-result-primary is-${result.result||'none'}`}><span>{t('result')}</span><strong>{result.result?t(result.result):'—'}</strong>{result.critical&&<small><AlertTriangle size={12}/> {tx('critical')}</small>}</div>
   <div><span>{tx('organisms')}</span><strong>{organisms.length?organisms.join(', '):'—'}</strong></div>
   <div><span>{tx('method')}</span><strong>{methodLabel(result.method,language)}</strong></div>
   <div><span>{tx('status')}</span><strong><span className={`status-badge ${result.resultStatus==='draft'?'temporary':'active'}`}>{tx(result.resultStatus)}</span></strong></div>
   {isEnvironmental&&<><div><span>{tx('cfu')}</span><strong>{result.result==='negative'?'0':result.cfuCount??'—'}</strong></div><div><span>{tx('assessment')}</span><strong>{result.withinLimit===true?tx('within'):result.withinLimit===false?tx('outside'):tx('noLimit')}</strong></div></>}
  </div>:<div className="lab-table-empty lab-result-empty">{tx('noResult')}</div>}
 </section>
}

function makeDraft(result){return {id:result?.id||null,result:result?.result||'',organisms:organismsOf(result),critical:Boolean(result?.critical),method:result?.method||'',interpretationStandard:result?.interpretationStandard||'EUCAST',interpretationVersion:result?.interpretationVersion||'',cfuCount:result?.cfuCount??''}}

function ResultDialog({t,tx,language,result,isEnvironmental,standard,libraries,canValidate,onClose,onSave}){
 const [draft,setDraft]=useState(()=>makeDraft(result)),[choice,setChoice]=useState('');const options=rows(libraries,'microorganisms',language),hasLimit=standard?.limitCfu!=null&&standard?.limitCfu!==''
 const set=(key,value)=>setDraft(d=>({...d,[key]:value}))
 const add=()=>{if(choice&&!draft.organisms.includes(choice)){set('organisms',[...draft.organisms,choice]);setChoice('')}}
 const remove=name=>set('organisms',draft.organisms.filter(x=>x!==name))
 const save=status=>{const cfu=isEnvironmental?(draft.result==='negative'?0:draft.cfuCount===''?null:Number(draft.cfuCount)):null,limit=isEnvironmental&&hasLimit?Number(standard.limitCfu):null,within=isEnvironmental&&limit!=null&&cfu!=null?cfu<=limit:null;onSave({...draft,validationStatus:status,organism:draft.organisms.join(', '),cfuCount:cfu,cfuLimit:limit,withinLimit:within,pendingAmr:{}})}
 const complete=Boolean(draft.result)&&(!isEnvironmental||draft.result==='negative'||draft.cfuCount!=='')
 const needsOrganism=!isEnvironmental&&draft.result==='positive'&&!draft.organisms.length
 const title=isEnvironmental?t('laboratoryRecords.environmentalResult'):t('laboratoryRecords.resultAndOrganism')
 return <ObserverDialog width="standard" eyebrow={t('laboratoryRecords.microbiologyResult')} title={title} subtitle={tx('resultHelp')} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>{t('cancel')}</Button><Button variant="secondary" disabled={!complete} onClick={()=>save('draft')}>{tx('saveDraft')}</Button>{canValidate&&<Button disabled={!complete||needsOrganism} onClick={()=>save('validated')}><CheckCircle2 size={15}/>{tx('validate')}</Button>}</>}>
  <div className="lab-dialog-form">
   <label><span>{t('result')} *</span><select value={draft.result} onChange={e=>set('result',e.target.value)}><option value="">{t('select')}</option><option value="negative">{t('negative')}</option><option value="positive">{t('positive')}</option><option value="inconclusive">{t('inconclusive')}</option><option value="contaminated">{t('contaminated')}</option></select></label>
   <label><span>{tx('method')}</span><select value={draft.method} onChange={e=>set('method',e.target.value)}><option value="">{t('select')}</option>{METHODS.map(([value,el,en])=><option key={value} value={value}>{language==='el'?el:en}</option>)}</select></label>
   {draft.result==='positive'&&<div className="lab-dialog-span"><span className="lab-dialog-label">{tx('organisms')} *</span><div className="lab-organism-picker"><select value={choice} onChange={e=>setChoice(e.target.value)}><option value="">{tx('chooseOrganism')}</option>{options.filter(x=>!draft.organisms.includes(x.value)).map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select><Button type="button" variant="secondary" disabled={!choice} onClick={add}>+ {t('clinicalRecords.add')}</Button></div>{draft.organisms.length>0&&<div className="lab-organism-chips">{draft.organisms.map(name=><span className="lab-organism-chip" key={name}>{name}<button type="button" onClick={()=>remove(name)} aria-label={t('delete')}><X size={13}/></button></span>)}</div>}{needsOrganism&&<small className="lab-dialog-hint">{tx('organismRequired')}</small>}</div>}
   {isEnvironmental&&draft.result==='positive'&&<label><span>{tx('cfu')}</span><input inputMode="decimal" value={draft.cfuCount} onChange={e=>set('cfuCount',e.target.value)}/></label>}
   <label className="lab-dialog-check lab-dialog-span"><input type="checkbox" checked={draft.critical} onChange={e=>set('critical',e.target.checked)}/><span>{tx('critical')}</span></label>
  </div>
 </ObserverDialog>
}

function AstDialog({tx,language,libraries,organisms,initialOrganism,onClose,onSave}){
 const options=rows(libraries,'antibiotics',language),[draft,setDraft]=useState({organism:initialOrganism||organisms[0]||'',drug:'',code:'',method:'MIC',sir:'S',standard:'EUCAST',version:'',mic:'',notes:''})
 const set=(key,value)=>setDraft(d=>({...d,[key]:value}))
 const choose=value=>{const item=options.find(x=>x.value===value);setDraft(d=>({...d,drug:value,code:item?.code||''}))}
 return <ObserverDialog width="standard" eyebrow={tx('organism')} title={tx('astTitle')} subtitle={draft.organism} onClose={onClose} footer={<DialogActions showCancel onCancel={onClose} onSave={()=>onSave(draft)} disabled={!draft.organism||!draft.drug||!draft.version}/>}>
  <div className="lab-dialog-form">
   <label><span>{tx('organism')} *</span><select value={draft.organism} onChange={e=>set('organism',e.target.value)}>{organisms.map(x=><option key={x}>{x}</option>)}</select></label>
   <label><span>{tx('antibiotic')} *</span><select value={draft.drug} onChange={e=>choose(e.target.value)}><option value="">{tx('chooseAntibiotic')}</option>{options.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></label>
   <div className="lab-dialog-span"><span className="lab-dialog-label">S/I/R *</span><div className="lab-sir-toggle" role="radiogroup">{['S','I','R'].map(value=><button type="button" key={value} role="radio" aria-checked={draft.sir===value} className={`sir-${value.toLowerCase()} ${draft.sir===value?'is-selected':''}`} onClick={()=>set('sir',value)}>{value}</button>)}</div></div>
   <label><span>MIC</span><input value={draft.mic} onChange={e=>set('mic',e.target.value)}/></label>
   <label><span>{tx('method')}</span><input value={draft.method} onChange={e=>set('method',e.target.value)}/></label>
   <label><span>{tx('standard')}</span><input value={draft.standard} onChange={e=>set('standard',e.target.value)}/></label>
   <label><span>{tx('version')} *</span><input value={draft.version} onChange={e=>set('version',e.target.value)}/></label>
   <label className="lab-dialog-span"><span>{tx('notes')}</span><input value={draft.notes} onChange={e=>set('notes',e.target.value)}/></label>
  </div>
 </ObserverDialog>
}

function AmrDialog({tx,language,organism,initialClassification='',onClose,onSave}){
 const [draft,setDraft]=useState({classification:initialClassification,definitionSource:'Magiorakos et al.',definitionVersion:'2012',rationale:''})
 const set=(key,value)=>setDraft(d=>({...d,[key]:value}))
 return <ObserverDialog width="standard" eyebrow={tx('organism')} title={tx('amrTitle')} subtitle={organism} onClose={onClose} footer={<DialogActions showCancel onCancel={onClose} onSave={()=>onSave({...draft,organism})} disabled={!draft.classification||!draft.definitionSource||!draft.definitionVersion}/>}>
  <div className="lab-dialog-form">
   <label className="lab-dialog-span"><span>{tx('classification')} *</span><select value={draft.classification} onChange={e=>set('classification',e.target.value)}><option value="">{language==='el'?'Επιλέξτε':'Select'}</option><option value="MDR">MDR – {language==='el'?'Πολυανθεκτικό':'Multidrug-resistant'}</option><option value="XDR">XDR – {language==='el'?'Εκτεταμένα ανθεκτικό':'Extensively drug-resistant'}</option><option value="PDR">PDR – {language==='el'?'Παν-ανθεκτικό':'Pandrug-resistant'}</option></select></label>
   <label><span>{tx('definitionSource')} *</span><input value={draft.definitionSource} onChange={e=>set('definitionSource',e.target.value)}/></label>
   <label><span>{tx('definitionVersion')} *</span><input value={draft.definitionVersion} onChange={e=>set('definitionVersion',e.target.value)}/></label>
   <label className="lab-dialog-span"><span>{tx('rationale')}</span><textarea rows={3} value={draft.rationale} onChange={e=>set('rationale',e.target.value)}/></label>
  </div>
 </ObserverDialog>
}

function CommunicationDialog({tx,onClose,onSave}){
 const {language}=useLanguage();const now=new Date(),localDate=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
 const [draft,setDraft]=useState({recipientName:'',recipientRole:'',recipientDepartment:'',method:'phone',readBack:true,communicatedDate:localDate,communicatedTime:now.toTimeString().slice(0,5),notes:''})
 const set=(key,value)=>setDraft(d=>({...d,[key]:value}))
 return <ObserverDialog width="standard" eyebrow={tx('critical')} title={tx('communicationTitle')} onClose={onClose} footer={<DialogActions showCancel onCancel={onClose} onSave={()=>onSave({...draft,at:`${draft.communicatedDate}T${draft.communicatedTime||'00:00'}`})} disabled={!draft.recipientName||!draft.recipientRole||!draft.communicatedDate}/>}>
  <div className="lab-dialog-form">
   <label><span>{tx('recipient')} *</span><input value={draft.recipientName} onChange={e=>set('recipientName',e.target.value)}/></label>
   <label><span>{tx('role')} *</span><input value={draft.recipientRole} onChange={e=>set('recipientRole',e.target.value)}/></label>
   <label><span>{tx('department')}</span><input value={draft.recipientDepartment} onChange={e=>set('recipientDepartment',e.target.value)}/></label>
   <label><span>{tx('channel')}</span><select value={draft.method} onChange={e=>set('method',e.target.value)}><option value="phone">{language==='el'?'Τηλεφωνικά':'Phone'}</option><option value="in_person">{language==='el'?'Προφορικά / διά ζώσης':'In person'}</option><option value="secure_message">{language==='el'?'Ασφαλές ηλεκτρονικό μήνυμα':'Secure message'}</option><option value="other">{language==='el'?'Άλλος':'Other'}</option></select></label>
   <ManualDateField label={`${tx('date')} *`} value={draft.communicatedDate} onChange={v=>set('communicatedDate',v)}/>
   <TimeField label={tx('time')} value={draft.communicatedTime} onChange={v=>set('communicatedTime',v)}/>
   <label className="lab-dialog-check lab-dialog-span"><input type="checkbox" checked={draft.readBack} onChange={e=>set('readBack',e.target.checked)}/><span>{tx('readBack')}</span></label>
   <label className="lab-dialog-span"><span>{tx('notes')}</span><textarea rows={3} value={draft.notes} onChange={e=>set('notes',e.target.value)}/></label>
  </div>
 </ObserverDialog>
}

function LabHistory({sample,t,tx,fmt}){
 const events=[
  sample.requestedAt&&{at:sample.requestedAt,title:t('requested')},
  sample.collectedAt&&{at:sample.collectedAt,title:t('collectedLabel')},
  sample.receivedAt&&{at:sample.receivedAt,title:t('received')},
  ...(sample.microbiologyResults||[]).flatMap(item=>[
   item.resultedAt&&{at:item.resultedAt,title:`${t('laboratoryRecords.microbiologyResult')} · ${tx(item.resultStatus)}`},
   ...(item.communications||[]).map(row=>row.at&&{at:row.at,title:tx('communicationTitle'),by:row.to||row.recipientName}),
  ]),
  sample.documentsReviewedAt&&{at:sample.documentsReviewedAt,title:tx('documentsDone')},
  sample.rejectedAt&&{at:sample.rejectedAt,title:`${tx('reject')} · ${sample.rejectionReason||'—'}`},
  sample.finalizedAt&&{at:sample.finalizedAt,title:tx('finalized')},
 ].filter(Boolean).sort((a,b)=>new Date(b.at)-new Date(a.at))
 if(!events.length)return <div className="inline-empty">{t('noData')}</div>
 return <div className="lab-history-list">{events.map((event,index)=><div className="lab-history-row" key={`${event.at}-${index}`}><time>{fmt(event.at)}</time><strong>{event.title}</strong><span>{event.by||''}</span></div>)}</div>
}
