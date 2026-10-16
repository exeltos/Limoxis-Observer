import { useMemo,useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileSpreadsheet } from 'lucide-react'
import { FilterBar } from '../../../design-system/FilterBar'
import { ObserverDialog,DialogActions } from '../../../design-system/ObserverDialog'
import { ManualDateField } from '../../../design-system/ManualDateField'
import { RegistryTable } from '../../../design-system/RegistryTable'
import { SearchableSelect } from '../../../design-system/SearchableSelect'
import { useAuth } from '../../../core/auth/AuthContext'
import { rememberQualitySection } from '../qualityReturnSection'
import { useFeedback } from '../../../core/feedback/FeedbackContext'
import { auditActorFromAuth,auditEvent } from '../../../core/audit/actor'
import { createAssessmentSeries,createRiskAssessment } from './riskService'
import { importPlan,importRiskWorkbook } from './riskImport'
import { summarizeRisks,levelLabel,suggestPeriodLabel } from './riskModel'
import { AssessmentStatusBadge,L,LevelChip,PERIOD_KINDS,fmtDate,returnedClass,txt,usePaged,useReturnedRow } from './riskUi'
import './riskAssessment.css'

const FIELD_LABELS={inherentScore:['Εγγενής βαθμός','Inherent score'],residualScore:['Υπολειπόμενος βαθμός','Residual score'],inherentLevel:['Εγγενής κατηγορία','Inherent level'],residualLevel:['Υπολειπόμενη κατηγορία','Residual level'],process:['Διεργασία','Process'],wording:['Λεκτικό','Wording']}

// The assessments of the organization inside the Quality Center. The page's
// «Create» menu opens a new assessment (creating) or the Excel file (fileRef).
export function RiskAssessmentsPanel({list,organizationId,en,locale,creating,onCreatingChange,fileRef}){
 const navigate=useNavigate()
 const {profile,user}=useAuth()
 const {notify}=useFeedback()
 const actor=useMemo(()=>auditActorFromAuth({profile,user}),[profile,user])
 const setCreating=onCreatingChange
 const [preview,setPreview]=useState(null)
 const [query,setQuery]=useState('')
 const {items,loading}=list
 const rows=useMemo(()=>{const q=query.trim().toLowerCase();return items.filter(a=>!q||`${a.periodLabel} ${a.title||''} ${a.titleEn||''} ${a.formCode||''} ${a.code}`.toLowerCase().includes(q)).map(a=>({a,s:summarizeRisks(a.risks||[])}))},[items,query])
 // Back from an assessment returns to this tab.
 const assessmentRow=useReturnedRow('limoxis.quality.risk.returnedAssessment')
 const {items:pageRows,pager}=usePaged(rows,{en})
 const open=code=>{rememberQualitySection('risks');assessmentRow.remember(code);navigate(`/quality/risks/${code}`)}

 async function create(draft,carryFrom){
  try{const created=await createRiskAssessment(organizationId,{...draft,history:[auditEvent('riskAssessmentCreated',{actor})]},{carryFrom});setCreating(false);open(created.code)}
  catch{notify(L(en,'Δεν ήταν δυνατή η δημιουργία της εκτίμησης.','Could not create the assessment.'),'error')}
 }
 async function pickFile(event){
  const file=event.target.files?.[0];event.target.value=''
  if(!file)return
  try{const parsed=await importRiskWorkbook(file);if(!parsed.risks.length){notify(L(en,'Δεν βρέθηκαν κίνδυνοι στο αρχείο (στήλη «ΔΙΕΡΓΑΣΙΑ»).','No risks were found in the file (a “ΔΙΕΡΓΑΣΙΑ” column).'),'error');return}setPreview({file:file.name,...parsed})}
  catch{notify(L(en,'Το αρχείο δεν είναι αρχείο Excel (.xlsx) που μπορεί να διαβαστεί.','The file is not a readable Excel (.xlsx) workbook.'),'error')}
 }
 async function confirmImport(draft,initial){
  try{
   const history=[auditEvent('riskAssessmentImported',{actor,detail:{file:preview.file,risks:preview.risks.length,fixes:preview.fixes.length}})]
   const created=await createAssessmentSeries(organizationId,importPlan(preview,draft,initial),history)
   setPreview(null);open(created.at(-1).code)
  }catch{notify(L(en,'Δεν ήταν δυνατή η εισαγωγή.','Could not import.'),'error')}
 }

 // The tab sits in the Quality Center card: filter row, table and pager are its rows.
 return <>
  <input ref={fileRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden onChange={pickFile}/>
  <FilterBar query={query} onQueryChange={setQuery} placeholder={L(en,'Αναζήτηση εκτίμησης ή περιόδου','Search assessment or period')} onClear={()=>setQuery('')}/>
  <RegistryTable wrapperClassName="scroll-table risk-assessments-table" className="risk-table" rows={pageRows} rowKey={({a})=>a.id}
   columns={[{key:'period',label:L(en,'Περίοδος','Period')},{key:'title',label:L(en,'Εκτίμηση','Assessment')},{key:'date',label:L(en,'Ημερομηνία','Date')},{key:'risks',label:L(en,'Κίνδυνοι','Risks')},{key:'veryHigh',label:L(en,'Πολύ υψηλοί','Very high')},{key:'high',label:L(en,'Υψηλοί','High')},{key:'residual',label:L(en,'Μέσος υπολειπόμενος','Avg. residual')},{key:'status',label:L(en,'Κατάσταση','Status')}]}
   rowProps={({a})=>({className:`risk-row-clickable${returnedClass(assessmentRow.returned,a.code)}`,onClick:()=>open(a.code)})}
   emptyTitle={loading?undefined:L(en,'Δεν υπάρχουν εκτιμήσεις κινδύνου','No risk assessments yet')} emptyText={L(en,'Δημιουργήστε την πρώτη εκτίμηση ή εισαγάγετε το υπάρχον μητρώο σας από Excel.','Create the first assessment or import your existing register from Excel.')}
   renderRow={({a,s})=><><td><strong>{a.periodLabel}</strong><small>{PERIOD_KINDS[a.periodKind]?.[en?1:0]}</small></td><td>{txt(a,'title',en)}<small>{a.formCode}</small></td><td>{fmtDate(a.assessedOn,locale)}<small>{L(en,'Επόμενη','Next')}: {fmtDate(a.nextReviewOn,locale)}</small></td><td>{s.total}</td><td><span className="risk-level risk-level-very_high" title={levelLabel('very_high',en)}><strong>{s.levels.residual.very_high}</strong></span></td><td><span className="risk-level risk-level-high" title={levelLabel('high',en)}><strong>{s.levels.residual.high}</strong></span></td><td>{s.averages.residual!=null?<LevelChip score={Math.round(s.averages.residual)} en={en} title={String(s.averages.residual)}/>:'—'}</td><td><AssessmentStatusBadge status={a.status} en={en}/></td></>}/>
  {rows.length>0&&pager}
  {creating&&<AssessmentDetailsDialog en={en} assessments={items} onClose={()=>setCreating(false)} onSave={create}/>}
  {preview&&<ImportPreviewDialog preview={preview} en={en} onClose={()=>setPreview(null)} onConfirm={confirmImport}/>}
 </>
}

// Header of an assessment (new, imported or edited). A new one may carry the
// risks of an earlier assessment forward, to be reassessed for the new period.
export function AssessmentDetailsDialog({initial,en,assessments=[],onClose,onSave,saveLabel,intro=null,children}){
 const today=new Date().toISOString().slice(0,10)
 const [draft,setDraft]=useState(()=>({title:L(en,'Εκτίμηση επικινδυνότητας','Risk assessment'),periodLabel:String(new Date().getFullYear()),periodKind:'annual',assessedOn:today,nextReviewOn:'',assessorLabel:'',formCode:'Ε.Δ.QUAL.050-02',scopeNote:'',...initial}))
 const [carryId,setCarryId]=useState(assessments[0]?.id||'')
 const isNew=!initial?.id
 // On a new assessment the period label follows the type and the date, until it is typed by hand.
 const set=(key,value)=>setDraft(d=>{const next={...d,[key]:value}
  if(isNew&&(key==='periodKind'||key==='assessedOn')&&String(d.periodLabel||'').trim()===suggestPeriodLabel(d.periodKind,d.assessedOn,en))next.periodLabel=suggestPeriodLabel(next.periodKind,next.assessedOn,en)
  return next})
 const carryFrom=assessments.find(a=>a.id===carryId)||null
 const field=(key,label,props={},wide=false)=><label className={`risk-field${wide===true?' risk-field-wide':wide?` ${wide}`:''}`}><span>{label}</span><input value={draft[key]||''} onChange={e=>set(key,e.target.value)} {...props}/></label>
 return <ObserverDialog width="standard" title={isNew?L(en,'Νέα εκτίμηση κινδύνου','New risk assessment'):L(en,'Στοιχεία εκτίμησης','Assessment details')} onClose={onClose}
  footer={<DialogActions onCancel={onClose} showCancel onSave={()=>onSave(draft,isNew&&!children?carryFrom:null)} disabled={!String(draft.title).trim()||!String(draft.periodLabel).trim()||!draft.assessedOn} saveLabel={saveLabel||(isNew?L(en,'Δημιουργία','Create'):undefined)}/>}>
  {intro}
  <div className="risk-editor-grid risk-assessment-form">
   {/* Three even rows, one-line labels: title and form; type, period and date; next review and assessor. */}
   {field('title',L(en,'Τίτλος','Title'),{},'risk-field-span2')}
   {field('formCode',L(en,'Κωδικός εντύπου','Form code'))}
   <SearchableSelect className="risk-field" label={L(en,'Είδος περιόδου','Period type')} value={draft.periodKind} onChange={v=>{if(v)set('periodKind',v)}} options={Object.entries(PERIOD_KINDS).map(([id,[el,enLabel]])=>({value:id,label:en?enLabel:el}))}/>
   {field('periodLabel',L(en,'Περίοδος','Period'),{placeholder:L(en,'π.χ. 2026, Α\' εξάμηνο 2026','e.g. 2026, H1 2026'),title:L(en,'π.χ. 2026, Α\' εξάμηνο 2026, Γ\' τρίμηνο 2026','e.g. 2026, H1 2026, Q3 2026')})}
   <ManualDateField label={L(en,'Ημερομηνία αξιολόγησης','Assessment date')} value={draft.assessedOn||''} onChange={v=>set('assessedOn',v)}/>
   <ManualDateField label={L(en,'Επόμενη αξιολόγηση','Next assessment')} value={draft.nextReviewOn||''} onChange={v=>set('nextReviewOn',v)} optional/>
   {field('assessorLabel',L(en,'Υπεύθυνος αξιολόγησης','Assessed by'),{},'risk-field-span2')}
   <label className="risk-field risk-field-wide"><span>{L(en,'Πεδίο εφαρμογής / σημειώσεις','Scope / notes')}</span><textarea rows={2} value={draft.scopeNote||''} onChange={e=>set('scopeNote',e.target.value)}/></label>
   {isNew&&!children&&assessments.length>0&&<div className="risk-field risk-field-wide"><SearchableSelect label={L(en,'Μεταφορά κινδύνων από','Carry risks forward from')} value={carryId} onChange={v=>setCarryId(v||'')} options={[{value:'',label:L(en,'Κενή εκτίμηση','Empty assessment')},...assessments.map(a=>({value:a.id,label:`${a.periodLabel} · ${txt(a,'title',en)} (${(a.risks||[]).length})`,keywords:a.code}))]}/><small>{L(en,'Οι κίνδυνοι μεταφέρονται με τους ίδιους κωδικούς, ώστε να συγκρίνονται οι περίοδοι.','Risks keep their codes, so the periods can be compared.')}</small></div>}
  </div>
  {children}
 </ObserverDialog>
}

function ImportPreviewDialog({preview,en,onClose,onConfirm}){
 const year=(preview.meta.assessedOn||'').slice(0,4)||String(new Date().getFullYear())
 const initial={title:preview.meta.title||L(en,'Εκτίμηση επικινδυνότητας','Risk assessment'),formCode:preview.meta.formCode||'',periodLabel:year,assessedOn:preview.meta.assessedOn||new Date().toISOString().slice(0,10),nextReviewOn:preview.meta.nextReviewOn||'',assessorLabel:preview.meta.assessor||''}
 // A file with a reassessment also creates the initial assessment, dated by its own period.
 const earlier=(preview.periods||[]).length>1?preview.periods[0]:null
 const [first,setFirst]=useState(()=>({initialLabel:String(earlier?.year||''),initialOn:earlier?.year?`${earlier.year}${initial.assessedOn.slice(4)}`:''}))
 const fixes=preview.fixes.filter(f=>f.field!=='wording')
 // One row per risk, all its corrections together.
 const byRisk=Object.values(fixes.reduce((m,f)=>{(m[f.lineageKey]||=({key:f.lineageKey,items:[]})).items.push(f);return m},{}))
 const words=Object.values(preview.fixes.filter(f=>f.field==='wording').reduce((m,f)=>{const k=`${f.before}→${f.after}`;m[k]||={...f,count:0};m[k].count++;return m},{}))
 const count=earlier?earlier.risks.length+preview.risks.length:preview.risks.length
 const opportunities=(preview.opportunities||[]).length
 const what=[L(en,`${count} κινδύνων`,`${count} risks`),opportunities&&L(en,`${opportunities} ${opportunities===1?'ευκαιρίας':'ευκαιριών'}`,`${opportunities} ${opportunities===1?'opportunity':'opportunities'}`)].filter(Boolean).join(L(en,' και ',' and '))
 const after=f=>/Level$/.test(f.field)?levelLabel(f.after,en):String(f.after)
 // What the file holds comes first; the details of the new assessment follow; the corrections close.
 const intro=<section className="risk-import-summary">
  <h4><FileSpreadsheet size={15}/>{preview.file}</h4>
  <ul className="risk-import-sheets">{preview.sheets.map(s=><li key={s.name}><strong>{s.name}</strong><span>{s.section==='opportunities'?L(en,`${s.count} ευκαιρίες`,`${s.count} opportunities`):L(en,`${s.count} κίνδυνοι`,`${s.count} risks`)}</span></li>)}</ul>
  {earlier&&<>
   <p className="risk-hint">{L(en,`Το αρχείο έχει αρχική αξιολόγηση και επαναξιολόγηση. Δημιουργούνται δύο εκτιμήσεις με τους ίδιους κωδικούς κινδύνων, ώστε να συγκρίνονται: η αρχική (${earlier.risks.length} κίνδυνοι) και η επαναξιολόγηση με τα στοιχεία παρακάτω (${preview.risks.length} κίνδυνοι).`,`The file holds an initial assessment and a reassessment. Two assessments are created with the same risk codes, so they can be compared: the initial one (${earlier.risks.length} risks) and the reassessment with the details below (${preview.risks.length} risks).`)}</p>
   <div className="risk-editor-grid">
    <label className="risk-field"><span>{L(en,'Περίοδος αρχικής αξιολόγησης','Initial assessment period')}</span><input value={first.initialLabel} onChange={e=>setFirst(f=>({...f,initialLabel:e.target.value}))}/></label>
    <ManualDateField label={L(en,'Ημερομηνία αρχικής αξιολόγησης','Initial assessment date')} value={first.initialOn} onChange={v=>setFirst(f=>({...f,initialOn:v}))}/>
   </div>
  </>}
 </section>
 return <AssessmentDetailsDialog initial={initial} en={en} intro={intro} onClose={onClose} onSave={draft=>onConfirm(draft,first)} saveLabel={earlier?L(en,'Εισαγωγή 2 εκτιμήσεων','Import 2 assessments'):L(en,`Εισαγωγή ${what}`,`Import ${what}`)}>
  <section className="risk-import-preview">
   <h4>{L(en,`Διορθώσεις κατά την εισαγωγή (${preview.fixes.length})`,`Corrections on import (${preview.fixes.length})`)}</h4>
   {preview.fixes.length>0?<>
    <p className="risk-hint">{L(en,'Ο βαθμός και η κατηγορία υπολογίζονται από L × C με τις ζώνες NHS· οι διεργασίες ενοποιούνται και τα λεκτικά διορθώνονται.','Score and level are computed from L × C with the NHS bands; processes are unified and spelling is corrected.')}</p>
    {byRisk.length>0&&<table className="data-table risk-import-fixes"><thead><tr><th>{L(en,'Κωδ.','Code')}</th><th>{L(en,'Τι διορθώνεται','What is corrected')}</th></tr></thead><tbody>
     {byRisk.map(r=><tr key={r.key}><td><strong>{r.key}</strong></td><td><ul>{r.items.map((f,i)=><li key={i}><span>{FIELD_LABELS[f.field]?.[en?1:0]||f.field}:</span> <s>{String(f.before)}</s> → <strong>{after(f)}</strong></li>)}</ul></td></tr>)}
    </tbody></table>}
    {words.length>0&&<p className="risk-hint risk-import-words"><strong>{L(en,'Διόρθωση λεκτικών','Spelling corrections')}:</strong> {words.map(w=>`${w.before} → ${w.after}${w.count>1?` (${w.count})`:''}`).join(' · ')}</p>}
   </>:<p className="risk-hint">{L(en,'Όλοι οι βαθμοί και οι κατηγορίες του αρχείου συμφωνούν με τη μήτρα.','Every score and level of the file agrees with the matrix.')}</p>}
   <p className="risk-hint">{L(en,'Το JCI προτείνεται από τη διατύπωση κάθε κινδύνου και διορθώνεται στο μητρώο. Ο κίνδυνος-στόχος συμπληρώνεται μετά την εισαγωγή.','JCI is suggested from each risk’s wording and can be changed in the register. The target risk is filled in after the import.')}</p>
  </section>
 </AssessmentDetailsDialog>
}
