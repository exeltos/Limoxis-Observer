import { useMemo,useState } from 'react'
import { AlertTriangle,Info } from 'lucide-react'
import { ObserverDialog,DialogActions } from '../../../design-system/ObserverDialog'
import { ManualDateField } from '../../../design-system/ManualDateField'
import { CONSEQUENCE,JCI_CHAPTERS,LIKELIHOOD,SECTIONS,levelInfo,riskWarnings,scored,warningLabel } from './riskModel'
import { AxisSelect,L,LevelChip,txt } from './riskUi'

const STAGES=[['inherent','Εγγενής κίνδυνος','Inherent risk','Χωρίς κανένα μέτρο','Before any control'],['residual','Υπολειπόμενος κίνδυνος','Residual risk','Με τα μέτρα που ήδη λαμβάνονται','With the controls already in place'],['target','Κίνδυνος-στόχος','Target risk','Μετά τα πρόσθετα μέτρα','After the additional measures']]

// Add or edit one risk. The score, level and warnings update as L and C change.
export function RiskEditorDialog({risk,processes=[],en,readOnly=false,onClose,onSave,saving=false}){
 const [draft,setDraft]=useState(()=>({section:'clinical',...risk,process:txt(risk,'process',en),scope:txt(risk,'scope',en),hazard:txt(risk,'hazard',en),existingControls:txt(risk,'existingControls',en),additionalMeasures:txt(risk,'additionalMeasures',en),owner:txt(risk,'owner',en),reviewFrequency:txt(risk,'reviewFrequency',en)}))
 const set=(key,value)=>setDraft(current=>({...current,[key]:value}))
 const s=useMemo(()=>scored(draft),[draft])
 const warnings=useMemo(()=>riskWarnings(draft),[draft])
 const residualLevel=levelInfo(s.residual.level)
 const valid=Boolean(String(draft.hazard||'').trim())&&s.inherent.score&&s.residual.score
 const field=(key,label,props={})=><label className="risk-field"><span>{label}</span><input value={draft[key]??''} disabled={readOnly} onChange={e=>set(key,e.target.value)} {...props}/></label>
 const area=(key,label,rows=3)=><label className="risk-field risk-field-wide"><span>{label}</span><textarea rows={rows} value={draft[key]??''} disabled={readOnly} onChange={e=>set(key,e.target.value)}/></label>
 return <ObserverDialog width="wide" eyebrow={draft.lineageKey||L(en,'Νέος κίνδυνος','New risk')} title={L(en,'Κίνδυνος','Risk')} subtitle={draft.process||undefined} onClose={onClose}
  footer={<DialogActions onCancel={onClose} showCancel cancelLabel={readOnly?L(en,'Κλείσιμο','Close'):undefined} onSave={readOnly?undefined:()=>onSave(draft)} disabled={!valid||saving} saveLabel={L(en,'Αποθήκευση κινδύνου','Save risk')}/>}>
  <div className="risk-editor">
   <section className="risk-editor-block">
    <div className="risk-editor-grid">
     <label className="risk-field"><span>{L(en,'Ενότητα','Section')}</span><select value={draft.section} disabled={readOnly} onChange={e=>set('section',e.target.value)}>{SECTIONS.map(x=><option key={x.id} value={x.id}>{en?x.en:x.el}</option>)}</select></label>
     {field('process',L(en,'Διεργασία','Process'),{list:'risk-process-options'})}
     <datalist id="risk-process-options">{processes.map(p=><option key={p} value={p}/>)}</datalist>
     {field('scope',L(en,'Τμήμα / αφορά','Department / applies to'))}
     <label className="risk-field"><span>JCI</span><select value={draft.jci||''} disabled={readOnly} onChange={e=>set('jci',e.target.value)}><option value="">—</option>{JCI_CHAPTERS.map(x=><option key={x.id} value={x.id}>{x.id} · {en?x.en:x.el}</option>)}</select></label>
     {field('jciReference',L(en,'Πρότυπο / ME (JCI)','Standard / ME (JCI)'),{placeholder:L(en,'π.χ. όπως στο εγχειρίδιο','e.g. as in the manual')})}
    </div>
    {area('hazard',L(en,'Πιθανό ρίσκο / κίνδυνος','Potential risk / hazard'),2)}
   </section>
   <section className="risk-editor-stages">
    {STAGES.map(([kind,el,enLabel,hintEl,hintEn])=><div key={kind} className={`risk-stage risk-stage-${kind}`}>
     <header><strong>{en?enLabel:el}</strong><small>{en?hintEn:hintEl}</small></header>
     <div className="risk-stage-axes">
      <AxisSelect label={L(en,'Πιθανότητα (L)','Likelihood (L)')} value={draft[`${kind}L`]} onChange={v=>set(`${kind}L`,v)} scale={LIKELIHOOD} en={en} disabled={readOnly}/>
      <AxisSelect label={L(en,'Συνέπεια (C)','Consequence (C)')} value={draft[`${kind}C`]} onChange={v=>set(`${kind}C`,v)} scale={CONSEQUENCE} en={en} disabled={readOnly}/>
     </div>
     <LevelChip score={s[kind].score} level={s[kind].level} en={en}/>
     {kind==='inherent'&&area('existingControls',L(en,'Προληπτικά μέτρα που ήδη λαμβάνονται','Controls already in place'),4)}
     {kind==='residual'&&s.inherent.c&&s.residual.c&&s.inherent.c!==s.residual.c&&area('consequenceRationale',L(en,'Γιατί άλλαξε η συνέπεια;','Why did the consequence change?'),2)}
     {kind==='residual'&&residualLevel&&<p className={`risk-response risk-response-${residualLevel.id}`}>{en?residualLevel.responseEn:residualLevel.responseEl}</p>}
    </div>)}
   </section>
   <section className="risk-editor-block">
    {area('additionalMeasures',L(en,'Απαιτούμενα πρόσθετα μέτρα (σχέδιο δράσης)','Additional measures required (action plan)'),3)}
    <div className="risk-editor-grid">
     {field('owner',L(en,'Υπεύθυνος υλοποίησης','Owner'))}
     <ManualDateField label={L(en,'Προθεσμία','Due date')} value={draft.dueDate||''} onChange={v=>set('dueDate',v||null)} optional disabled={readOnly}/>
     {field('reviewFrequency',L(en,'Συχνότητα ελέγχου','Review frequency'))}
     {field('indicator',L(en,'Δείκτης / κωδικός συμβάντος','Indicator / incident code'))}
    </div>
    <label className="observer-check risk-check"><input type="checkbox" checked={Boolean(draft.prioritized)} disabled={readOnly} onChange={e=>set('prioritized',e.target.checked)}/><span>{L(en,'Επιλογή για προληπτική ανάλυση (FMEA) της περιόδου','Selected for this period’s proactive analysis (FMEA)')}</span></label>
    {area('notes',L(en,'Σημειώσεις','Notes'),2)}
   </section>
   {warnings.length>0&&<ul className="risk-warnings">{warnings.map(w=><li key={w.id} className={`risk-warning-${w.tone}`}>{w.tone==='info'?<Info size={14}/>:<AlertTriangle size={14}/>}{warningLabel(w.id,en)}</li>)}</ul>}
  </div>
 </ObserverDialog>
}
