import { useMemo,useState } from 'react'
import { AlertTriangle,Info } from 'lucide-react'
import { ObserverDialog,DialogActions } from '../../../design-system/ObserverDialog'
import { ManualDateField } from '../../../design-system/ManualDateField'
import { CONSEQUENCE,JCI_CHAPTERS,LIKELIHOOD,SECTIONS,levelInfo,riskWarnings,scored,warningLabel } from './riskModel'
import { AxisSelect,L,LevelChip,txt } from './riskUi'
import { IndicatorPicker } from './RiskIndicatorsUi'

const STAGES=[['inherent','Εγγενής κίνδυνος','Inherent risk','Χωρίς κανένα μέτρο','Before any control'],['residual','Υπολειπόμενος κίνδυνος','Residual risk','Με τα μέτρα που ήδη λαμβάνονται','With the controls already in place'],['target','Κίνδυνος-στόχος','Target risk','Μετά τα πρόσθετα μέτρα','After the additional measures']]

// Add or edit one risk. The score, level and warnings update as L and C change.
export function RiskEditorDialog({risk,processes=[],en,readOnly=false,onClose,onSave,saving=false,indicatorValues=null}){
 const [draft,setDraft]=useState(()=>({section:'clinical',...risk,process:txt(risk,'process',en),scope:txt(risk,'scope',en),hazard:txt(risk,'hazard',en),existingControls:txt(risk,'existingControls',en),additionalMeasures:txt(risk,'additionalMeasures',en),owner:txt(risk,'owner',en),reviewFrequency:txt(risk,'reviewFrequency',en)}))
 const set=(key,value)=>setDraft(current=>({...current,[key]:value}))
 const s=useMemo(()=>scored(draft),[draft])
 const warnings=useMemo(()=>riskWarnings(draft),[draft])
 const residualLevel=levelInfo(s.residual.level)
 const valid=Boolean(String(draft.hazard||'').trim())&&s.inherent.score&&s.residual.score
 const field=(key,label,props={})=><label className="risk-field"><span>{label}</span><input value={draft[key]??''} disabled={readOnly} onChange={e=>set(key,e.target.value)} {...props}/></label>
 const area=(key,label,rows=3,hint='')=><label className="risk-field risk-field-wide"><span>{label}{hint&&<small>{hint}</small>}</span><textarea rows={rows} value={draft[key]??''} disabled={readOnly} onChange={e=>set(key,e.target.value)}/></label>
 // Measure lists grow with their lines (one measure per line), within limits.
 const listRows=key=>Math.min(14,Math.max(6,String(draft[key]||'').split('\n').length+1))
 const measureRows=Math.max(listRows('existingControls'),listRows('additionalMeasures'))
 const short=String(draft.hazard||'').trim()
 const title=short?(short.length>90?`${short.slice(0,88)}…`:short):L(en,'Νέος κίνδυνος','New risk')
 const sectionLabel=SECTIONS.find(x=>x.id===draft.section)
 const path=STAGES.map(([kind])=>s[kind].score??'—').join(' → ')
 const alerts=warnings.filter(w=>w.tone!=='info'),notes=warnings.filter(w=>w.tone==='info')
 return <ObserverDialog width="wide" className="risk-editor-dialog" eyebrow={[draft.lineageKey||L(en,'Νέος κίνδυνος','New risk'),sectionLabel&&(en?sectionLabel.en:sectionLabel.el)].filter(Boolean).join(' · ')} title={title} subtitle={[draft.process,draft.scope].filter(Boolean).join(' · ')||undefined} onClose={onClose}
  footer={<DialogActions onCancel={onClose} showCancel cancelLabel={readOnly?L(en,'Κλείσιμο','Close'):undefined} onSave={readOnly?undefined:()=>onSave(draft)} disabled={!valid||saving} saveLabel={L(en,'Αποθήκευση κινδύνου','Save risk')}/>}>
  <div className="risk-editor">
   <Step n={1} title={L(en,'Περιγραφή','Description')}>
    <div className="risk-editor-grid risk-editor-grid-description">
     <label className="risk-field risk-span-2"><span>{L(en,'Ενότητα','Section')}</span><select value={draft.section} disabled={readOnly} onChange={e=>set('section',e.target.value)}>{SECTIONS.map(x=><option key={x.id} value={x.id}>{en?x.en:x.el}</option>)}</select></label>
     <div className="risk-span-2">{field('process',L(en,'Διεργασία','Process'),{list:'risk-process-options'})}</div>
     <datalist id="risk-process-options">{processes.map(p=><option key={p} value={p}/>)}</datalist>
     <div className="risk-span-2">{field('scope',L(en,'Τμήμα / αφορά','Department / applies to'))}</div>
     <label className="risk-field risk-span-4"><span>JCI</span><select value={draft.jci||''} disabled={readOnly} onChange={e=>set('jci',e.target.value)}><option value="">—</option>{JCI_CHAPTERS.map(x=><option key={x.id} value={x.id}>{x.id} · {en?x.en:x.el}</option>)}</select></label>
     <div className="risk-span-2">{field('jciReference',L(en,'Πρότυπο / ME','Standard / ME'),{placeholder:L(en,'π.χ. IPSG.5 ME 2','e.g. IPSG.5 ME 2')})}</div>
    </div>
    {area('hazard',L(en,'Πιθανό ρίσκο / κίνδυνος','Potential risk / hazard'),2)}
   </Step>
   <Step n={2} title={L(en,'Αξιολόγηση (L × C)','Assessment (L × C)')} aside={<span className="risk-editor-path" title={L(en,'Εγγενής → υπολειπόμενος → στόχος','Inherent → residual → target')}>{path}</span>}>
    <div className="risk-editor-stages">
     {STAGES.map(([kind,el,enLabel,hintEl,hintEn])=><div key={kind} className={`risk-stage risk-stage-${kind}`}>
      <header><strong>{en?enLabel:el}</strong><small>{en?hintEn:hintEl}</small></header>
      <AxisSelect label={L(en,'Πιθανότητα (L)','Likelihood (L)')} value={draft[`${kind}L`]} onChange={v=>set(`${kind}L`,v)} scale={LIKELIHOOD} en={en} disabled={readOnly}/>
      <AxisSelect label={L(en,'Συνέπεια (C)','Consequence (C)')} value={draft[`${kind}C`]} onChange={v=>set(`${kind}C`,v)} scale={CONSEQUENCE} en={en} disabled={readOnly}/>
      <div className="risk-stage-level"><LevelChip score={s[kind].score} level={s[kind].level} en={en}/></div>
     </div>)}
    </div>
    {residualLevel&&<p className={`risk-response risk-response-${residualLevel.id}`}><strong>{L(en,'Απαιτούμενη ενέργεια','Required response')}:</strong> {en?residualLevel.responseEn:residualLevel.responseEl}</p>}
    {s.inherent.c&&s.residual.c&&s.inherent.c!==s.residual.c&&area('consequenceRationale',L(en,'Γιατί άλλαξε η συνέπεια (C) με τα μέτρα;','Why did the consequence (C) change with the controls?'),2)}
    {alerts.length>0&&<ul className="risk-warnings">{alerts.map(w=><li key={w.id} className={`risk-warning-${w.tone}`}><AlertTriangle size={14}/>{warningLabel(w.id,en)}</li>)}</ul>}
   </Step>
   {/* The controls in place give the residual risk, the additional measures the target. */}
   <Step n={3} title={L(en,'Μέτρα','Measures')}>
    <div className="risk-editor-measures">
     {area('existingControls',L(en,'Προληπτικά μέτρα που ήδη λαμβάνονται','Controls already in place'),measureRows,L(en,'ένα ανά γραμμή','one per line'))}
     {area('additionalMeasures',L(en,'Απαιτούμενα πρόσθετα μέτρα (σχέδιο δράσης)','Additional measures required (action plan)'),measureRows,L(en,'ένα ανά γραμμή','one per line'))}
    </div>
   </Step>
   <Step n={4} title={L(en,'Παρακολούθηση','Monitoring')}>
    <IndicatorPicker risk={draft} values={indicatorValues} en={en} disabled={readOnly} onChange={keys=>set('indicatorKeys',keys)}/>
    <div className="risk-editor-grid risk-editor-grid-monitoring">
     <div className="risk-field-span2">{field('owner',L(en,'Υπεύθυνος υλοποίησης','Owner'))}</div>
     {field('reviewFrequency',L(en,'Συχνότητα ελέγχου','Review frequency'))}
     {field('indicator',L(en,'Κωδικός συμβάντος / άλλος δείκτης','Incident code / other indicator'))}
     <ManualDateField label={L(en,'Προθεσμία','Due date')} value={draft.dueDate||''} onChange={v=>set('dueDate',v||null)} optional disabled={readOnly}/>
    </div>
    <label className="risk-fmea"><input type="checkbox" checked={Boolean(draft.prioritized)} disabled={readOnly} onChange={e=>set('prioritized',e.target.checked)}/><span><strong>{L(en,'Προληπτική ανάλυση (FMEA)','Proactive analysis (FMEA)')}</strong><small>{L(en,'Ο κίνδυνος επιλέγεται για την FMEA της περιόδου.','The risk is selected for the period’s FMEA.')}</small></span></label>
    {area('notes',L(en,'Σημειώσεις','Notes'),2)}
    {notes.length>0&&<ul className="risk-warnings">{notes.map(w=><li key={w.id} className={`risk-warning-${w.tone}`}><Info size={14}/>{warningLabel(w.id,en)}</li>)}</ul>}
   </Step>
  </div>
 </ObserverDialog>
}

// A numbered part of the editor; the order follows the assessment itself.
function Step({n,title,aside=null,children}){
 return <section className="risk-editor-step">
  <header><span className="risk-editor-step-number">{n}</span><h4>{title}</h4>{aside}</header>
  {children}
 </section>
}
