import { useEffect,useMemo,useRef,useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileSpreadsheet,Plus } from 'lucide-react'
import { ActionButton } from '../../../design-system/ActionButton'
import { ObserverDialog,DialogActions } from '../../../design-system/ObserverDialog'
import { ManualDateField } from '../../../design-system/ManualDateField'
import { useAuth } from '../../../core/auth/AuthContext'
import { useFeedback } from '../../../core/feedback/FeedbackContext'
import { auditActorFromAuth,auditEvent } from '../../../core/audit/actor'
import { createRiskAssessment,loadRiskAssessments } from './riskService'
import { importRiskWorkbook } from './riskImport'
import { levelLabel,riskTrend,summarizeRisks } from './riskModel'
import { L,LevelChip,PERIOD_KINDS,fmtDate,statusLabel,statusTone,txt } from './riskUi'
import './riskAssessment.css'

const FIELD_LABELS={inherentScore:['Εγγενής βαθμός','Inherent score'],residualScore:['Υπολειπόμενος βαθμός','Residual score'],inherentLevel:['Εγγενής κατηγορία','Inherent level'],residualLevel:['Υπολειπόμενη κατηγορία','Residual level'],process:['Διεργασία','Process']}

// The assessments of the organization inside the Quality Center.
export function RiskAssessmentsPanel({organizationId,canManage,en,locale}){
 const navigate=useNavigate()
 const {profile,user}=useAuth()
 const {notify}=useFeedback()
 const actor=useMemo(()=>auditActorFromAuth({profile,user}),[profile,user])
 const [items,setItems]=useState([])
 const [loading,setLoading]=useState(true)
 const [creating,setCreating]=useState(false)
 const [preview,setPreview]=useState(null)
 const fileRef=useRef(null)
 useEffect(()=>{let active=true;setLoading(true);loadRiskAssessments(organizationId).then(rows=>{if(active)setItems(rows)}).catch(()=>{if(active)setItems([])}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[organizationId])
 const rows=useMemo(()=>items.map(a=>({a,s:summarizeRisks(a.risks||[])})),[items])
 const trend=useMemo(()=>riskTrend(items),[items])
 const open=code=>navigate(`/quality/risks/${code}`)

 async function create(draft,carryFrom){
  try{const created=await createRiskAssessment(organizationId,{...draft,history:[auditEvent('riskAssessmentCreated',{actor})]},{carryFrom});setCreating(false);open(created.code)}
  catch{notify(L(en,'Δεν ήταν δυνατή η δημιουργία της εκτίμησης.','Could not create the assessment.'),'error')}
 }
 async function pickFile(event){
  const file=event.target.files?.[0];event.target.value=''
  if(!file)return
  try{const parsed=await importRiskWorkbook(file);if(!parsed.risks.length){notify(L(en,'Δεν βρέθηκαν κίνδυνοι στη μορφή Ε.Δ.ΔΙΑΧ.090 (στήλη «ΔΙΕΡΓΑΣΙΑ»).','No risks were found in the Ε.Δ.ΔΙΑΧ.090 layout (a “ΔΙΕΡΓΑΣΙΑ” column).'),'error');return}setPreview({file:file.name,...parsed})}
  catch{notify(L(en,'Το αρχείο δεν είναι αρχείο Excel (.xlsx) που μπορεί να διαβαστεί.','The file is not a readable Excel (.xlsx) workbook.'),'error')}
 }
 async function confirmImport(draft){
  try{const created=await createRiskAssessment(organizationId,{...draft,history:[auditEvent('riskAssessmentImported',{actor,detail:{file:preview.file,risks:preview.risks.length,fixes:preview.fixes.length}})]},{risks:preview.risks,opportunities:preview.opportunities});setPreview(null);open(created.code)}
  catch{notify(L(en,'Δεν ήταν δυνατή η εισαγωγή.','Could not import.'),'error')}
 }

 return <div className="risk-assessments">
  <div className="risk-toolbar">
   <p className="risk-hint">{L(en,'Εκτίμηση επικινδυνότητας κατά τη μήτρα 5×5 (NHS): εγγενής, υπολειπόμενος κίνδυνος και κίνδυνος-στόχος για κάθε κίνδυνο, ανάλυση, σύγκριση περιόδων και αντιστοίχιση με JCI.','Risk assessment on the 5×5 (NHS) matrix: inherent, residual and target risk for every risk, analysis, period comparison and JCI mapping.')}</p>
   {canManage&&<div className="row-actions">
    <input ref={fileRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden onChange={pickFile}/>
    <ActionButton label={L(en,'Εισαγωγή από Excel','Import from Excel')} onClick={()=>fileRef.current?.click()}><FileSpreadsheet size={16}/><span>{L(en,'Εισαγωγή από Excel','Import from Excel')}</span></ActionButton>
    <ActionButton label={L(en,'Νέα εκτίμηση','New assessment')} tone="primary" onClick={()=>setCreating(true)}><Plus size={16}/><span>{L(en,'Νέα εκτίμηση','New assessment')}</span></ActionButton>
   </div>}
  </div>
  <div className="scroll-table">
   <table className="data-table sticky-table risk-table"><thead><tr><th>{L(en,'Περίοδος','Period')}</th><th>{L(en,'Εκτίμηση','Assessment')}</th><th>{L(en,'Ημερομηνία','Date')}</th><th>{L(en,'Κίνδυνοι','Risks')}</th><th>{L(en,'Πολύ υψηλοί / υψηλοί (υπολ.)','Very high / high (residual)')}</th><th>{L(en,'Μέσος υπολειπόμενος','Avg. residual')}</th><th>{L(en,'Κατάσταση','Status')}</th></tr></thead><tbody>
    {rows.map(({a,s})=><tr key={a.id} onClick={()=>open(a.code)}><td><strong>{a.periodLabel}</strong><small>{PERIOD_KINDS[a.periodKind]?.[en?1:0]}</small></td><td>{txt(a,'title',en)}<small>{a.formCode}</small></td><td>{fmtDate(a.assessedOn,locale)}<small>{L(en,'Επόμενη','Next')}: {fmtDate(a.nextReviewOn,locale)}</small></td><td>{s.total}</td><td><span className="risk-pair"><span className="risk-level risk-level-very_high" title={levelLabel('very_high',en)}><strong>{s.levels.residual.very_high}</strong></span><span className="risk-level risk-level-high" title={levelLabel('high',en)}><strong>{s.levels.residual.high}</strong></span></span></td><td>{s.averages.residual!=null?<LevelChip score={Math.round(s.averages.residual)} en={en} title={String(s.averages.residual)}/>:'—'}</td><td><span className={`status-badge ${statusTone(a.status)}`}>{statusLabel(a.status,en)}</span></td></tr>)}
   </tbody></table>
   {!loading&&!rows.length&&<div className="registry-empty-state"><strong>{L(en,'Δεν υπάρχουν εκτιμήσεις κινδύνου','No risk assessments yet')}</strong><span>{L(en,'Δημιουργήστε την πρώτη εκτίμηση ή εισαγάγετε το υπάρχον μητρώο σας από Excel.','Create the first assessment or import your existing register from Excel.')}</span></div>}
  </div>
  {trend.length>1&&<p className="risk-hint">{L(en,'Μέσος υπολειπόμενος βαθμός ανά περίοδο','Average residual score by period')}: {trend.map(p=>`${p.label} ${p.residualAverage??'—'}`).join(' → ')}</p>}
  {creating&&<AssessmentDetailsDialog en={en} assessments={items} onClose={()=>setCreating(false)} onSave={create}/>}
  {preview&&<ImportPreviewDialog preview={preview} en={en} onClose={()=>setPreview(null)} onConfirm={confirmImport}/>}
 </div>
}

// Header of an assessment (new, imported or edited). A new one may carry the
// risks of an earlier assessment forward, to be reassessed for the new period.
export function AssessmentDetailsDialog({initial,en,assessments=[],onClose,onSave,saveLabel,children}){
 const today=new Date().toISOString().slice(0,10)
 const [draft,setDraft]=useState(()=>({title:L(en,'Εκτίμηση επικινδυνότητας','Risk assessment'),periodLabel:String(new Date().getFullYear()),periodKind:'annual',assessedOn:today,nextReviewOn:'',assessorLabel:'',formCode:'Ε.Δ.ΔΙΑΧ.090',scopeNote:'',...initial}))
 const [carryId,setCarryId]=useState(assessments[0]?.id||'')
 const set=(key,value)=>setDraft(d=>({...d,[key]:value}))
 const isNew=!initial?.id
 const carryFrom=assessments.find(a=>a.id===carryId)||null
 const field=(key,label,props={})=><label className="risk-field"><span>{label}</span><input value={draft[key]||''} onChange={e=>set(key,e.target.value)} {...props}/></label>
 return <ObserverDialog width="standard" title={isNew?L(en,'Νέα εκτίμηση κινδύνου','New risk assessment'):L(en,'Στοιχεία εκτίμησης','Assessment details')} onClose={onClose}
  footer={<DialogActions onCancel={onClose} showCancel onSave={()=>onSave(draft,isNew&&!children?carryFrom:null)} disabled={!String(draft.title).trim()||!String(draft.periodLabel).trim()||!draft.assessedOn} saveLabel={saveLabel||(isNew?L(en,'Δημιουργία','Create'):undefined)}/>}>
  <div className="risk-editor-grid">
   {field('title',L(en,'Τίτλος','Title'))}
   {field('formCode',L(en,'Κωδικός εντύπου','Form code'))}
   {field('periodLabel',L(en,'Περίοδος (π.χ. 2026, 2026-Α)','Period (e.g. 2026, 2026-H1)'))}
   <label className="risk-field"><span>{L(en,'Είδος περιόδου','Period type')}</span><select value={draft.periodKind} onChange={e=>set('periodKind',e.target.value)}>{Object.entries(PERIOD_KINDS).map(([id,[el,enLabel]])=><option key={id} value={id}>{en?enLabel:el}</option>)}</select></label>
   <ManualDateField label={L(en,'Ημερομηνία αξιολόγησης','Assessment date')} value={draft.assessedOn||''} onChange={v=>set('assessedOn',v)}/>
   <ManualDateField label={L(en,'Επόμενη αξιολόγηση','Next assessment')} value={draft.nextReviewOn||''} onChange={v=>set('nextReviewOn',v)} optional/>
   {field('assessorLabel',L(en,'Υπεύθυνος αξιολόγησης','Assessed by'))}
   <label className="risk-field risk-field-wide"><span>{L(en,'Πεδίο εφαρμογής / σημειώσεις','Scope / notes')}</span><textarea rows={2} value={draft.scopeNote||''} onChange={e=>set('scopeNote',e.target.value)}/></label>
   {isNew&&!children&&assessments.length>0&&<label className="risk-field risk-field-wide"><span>{L(en,'Μεταφορά κινδύνων από','Carry risks forward from')}</span><select value={carryId} onChange={e=>setCarryId(e.target.value)}><option value="">{L(en,'Κενή εκτίμηση','Empty assessment')}</option>{assessments.map(a=><option key={a.id} value={a.id}>{a.periodLabel} · {txt(a,'title',en)} ({(a.risks||[]).length})</option>)}</select><small>{L(en,'Οι κίνδυνοι μεταφέρονται με τους ίδιους κωδικούς, ώστε να συγκρίνονται οι περίοδοι.','Risks keep their codes, so the periods can be compared.')}</small></label>}
  </div>
  {children}
 </ObserverDialog>
}

function ImportPreviewDialog({preview,en,onClose,onConfirm}){
 const year=(preview.meta.assessedOn||'').slice(0,4)||String(new Date().getFullYear())
 const initial={title:preview.meta.title||L(en,'Εκτίμηση επικινδυνότητας','Risk assessment'),formCode:preview.meta.formCode||'',periodLabel:year,assessedOn:preview.meta.assessedOn||new Date().toISOString().slice(0,10),nextReviewOn:preview.meta.nextReviewOn||'',assessorLabel:preview.meta.assessor||''}
 const kinds=preview.fixes.reduce((m,f)=>({...m,[f.field]:(m[f.field]||0)+1}),{})
 return <AssessmentDetailsDialog initial={initial} en={en} onClose={onClose} onSave={draft=>onConfirm(draft)} saveLabel={L(en,`Εισαγωγή ${preview.risks.length} κινδύνων`,`Import ${preview.risks.length} risks`)}>
  <section className="risk-import-preview">
   <h4>{preview.file}</h4>
   <ul className="risk-import-sheets">{preview.sheets.map(s=><li key={s.name}><strong>{s.name}</strong><span>{s.section==='opportunities'?L(en,`${s.count} ευκαιρίες`,`${s.count} opportunities`):L(en,`${s.count} κίνδυνοι`,`${s.count} risks`)}</span></li>)}</ul>
   {preview.fixes.length>0?<>
    <p className="risk-hint">{L(en,`Ο βαθμός και η κατηγορία υπολογίζονται από L × C με τις ζώνες NHS. Διορθώνονται ${preview.fixes.length} σημεία του αρχείου:`,`Score and level are computed from L × C with the NHS bands. ${preview.fixes.length} points of the file are corrected:`)} {Object.entries(kinds).map(([k,n])=>`${FIELD_LABELS[k]?.[en?1:0]||k} ${n}`).join(' · ')}</p>
    <div className="scroll-table risk-import-fixes"><table className="data-table"><thead><tr><th>{L(en,'Κωδ.','Code')}</th><th>{L(en,'Πεδίο','Field')}</th><th>{L(en,'Στο αρχείο','In the file')}</th><th>{L(en,'Μετά την εισαγωγή','After import')}</th></tr></thead><tbody>
     {preview.fixes.map((f,i)=><tr key={i}><td>{f.lineageKey}</td><td>{FIELD_LABELS[f.field]?.[en?1:0]||f.field}</td><td>{String(f.before)}</td><td><strong>{/Level$/.test(f.field)?levelLabel(f.after,en):String(f.after)}</strong></td></tr>)}
    </tbody></table></div></>:<p className="risk-hint">{L(en,'Όλοι οι βαθμοί και οι κατηγορίες του αρχείου συμφωνούν με τη μήτρα.','Every score and level of the file agrees with the matrix.')}</p>}
   <p className="risk-hint">{L(en,'Το JCI προτείνεται από τη διατύπωση κάθε κινδύνου και διορθώνεται στο μητρώο. Ο κίνδυνος-στόχος συμπληρώνεται μετά την εισαγωγή.','JCI is suggested from each risk’s wording and can be changed in the register. The target risk is filled in after the import.')}</p>
  </section>
 </AssessmentDetailsDialog>
}
