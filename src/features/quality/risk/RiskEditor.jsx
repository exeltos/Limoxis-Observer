import { useLayoutEffect,useMemo,useRef,useState } from 'react'
import { AlertTriangle,ArrowDown,ArrowUp,CheckSquare2,Info,Plus,Save,ShieldAlert,X } from 'lucide-react'
import { EntityRecordShell } from '../../../design-system/EntityRecordShell'
import { Button } from '../../../design-system/Button'
import { ManualDateField } from '../../../design-system/ManualDateField'
import { ChoiceField } from '../../../design-system/ChoiceField'
import { SearchableSelect } from '../../../design-system/SearchableSelect'
import { YesNoField } from '../../../design-system/YesNoField'
import { CONSEQUENCE,JCI_CHAPTERS,LIKELIHOOD,SECTIONS,joinMeasures,levelInfo,parseMeasures,riskWarnings,scored,warningLabel } from './riskModel'
import { AxisSelect,L,LevelChip,recordActions,txt } from './riskUi'
import { IndicatorPicker } from './RiskIndicatorsUi'

const STAGES=[['inherent','Εγγενής κίνδυνος','Inherent risk','Χωρίς κανένα μέτρο','Before any control'],['residual','Υπολειπόμενος κίνδυνος','Residual risk','Με τα μέτρα που ήδη λαμβάνονται','With the controls already in place'],['target','Κίνδυνος-στόχος','Target risk','Μετά τα πρόσθετα μέτρα','After the additional measures']]

// One risk of an assessment, on its own page. The score, level and warnings update as L and C change.
export function RiskEditor({risk,processes=[],en,readOnly=false,onClose,onSave,onDelete=null,onCreateCapa=null,saving=false,indicatorValues=null,assessmentLabel='',startEditing=false,onCancel=null}){
 const [draft,setDraft]=useState(()=>({section:'clinical',...risk,process:txt(risk,'process',en),scope:txt(risk,'scope',en),hazard:txt(risk,'hazard',en),existingControls:txt(risk,'existingControls',en),additionalMeasures:txt(risk,'additionalMeasures',en),owner:txt(risk,'owner',en),reviewFrequency:txt(risk,'reviewFrequency',en)}))
 const set=(key,value)=>setDraft(current=>({...current,[key]:value}))
 const isNew=!risk?.id
 const [editing,setEditing]=useState((isNew||startEditing)&&!readOnly)
 const locked=readOnly||!editing
 const [initial]=useState(draft)
 // Cancel remounts the fields, so lists with their own state (the measures) drop the edits too.
 const [version,setVersion]=useState(0)
 const cancel=()=>{if(isNew){onClose();return};if(onCancel){onCancel();return};setDraft(initial);setEditing(false);setVersion(v=>v+1)}
 const s=useMemo(()=>scored(draft),[draft])
 const warnings=useMemo(()=>riskWarnings(draft),[draft])
 const residualLevel=levelInfo(s.residual.level)
 const valid=Boolean(String(draft.hazard||'').trim())&&s.inherent.score&&s.residual.score
 const field=(key,label,props={})=><label className="risk-field"><span>{label}</span><input value={draft[key]??''} disabled={locked} onChange={e=>set(key,e.target.value)} {...props}/></label>
 const area=(key,label,rows=3,hint='')=><label className="risk-field risk-field-wide"><span>{label}{hint&&<small>{hint}</small>}</span><textarea rows={rows} value={draft[key]??''} disabled={locked} onChange={e=>set(key,e.target.value)}/></label>
 const short=String(draft.hazard||'').trim()
 const title=short?(short.length>90?`${short.slice(0,88)}…`:short):L(en,'Νέος κίνδυνος','New risk')
 const sectionLabel=SECTIONS.find(x=>x.id===draft.section)
 const path=STAGES.map(([kind])=>s[kind].score??'—').join(' → ')
 const alerts=warnings.filter(w=>w.tone!=='info'),notes=warnings.filter(w=>w.tone==='info')
 return <EntityRecordShell className="quality-record-shell risk-editor-shell workspace-fill" avatar={<ShieldAlert size={19}/>}
  eyebrow={[draft.lineageKey||L(en,'Νέος κίνδυνος','New risk'),sectionLabel&&(en?sectionLabel.en:sectionLabel.el),assessmentLabel].filter(Boolean).join(' · ')}
  title={title} subtitle={[draft.process,draft.scope].filter(Boolean).join(' · ')||undefined}
  status={<span className="risk-editor-path" title={L(en,'Εγγενής → υπολειπόμενος → στόχος','Inherent → residual → target')}>{path}</span>}
  headerActions={recordActions({en,canEdit:!readOnly,editing,isNew,onEdit:()=>setEditing(true),onDelete})}
  onBack={onClose} backLabel={L(en,'Πίσω στην εκτίμηση','Back to the assessment')}>
  <div className="risk-editor" key={version}>
   <Step n={1} title={L(en,'Περιγραφή','Description')}>
    <div className="risk-editor-grid risk-editor-grid-description">
     <fieldset className="risk-fieldset risk-span-2" disabled={locked}><ChoiceField label={L(en,'Ενότητα','Section')} value={draft.section} onChange={v=>set('section',v)} options={SECTIONS.map(x=>({value:x.id,label:en?x.en:x.el}))}/></fieldset>
     <SearchableSelect className="risk-field risk-span-2" label={L(en,'Διεργασία','Process')} value={draft.process??''} disabled={locked} allowCustom onChange={v=>set('process',v)} options={processes.map(p=>({value:p,label:p}))}/>
     <div className="risk-span-2">{field('scope',L(en,'Τμήμα / αφορά','Department / applies to'))}</div>
     <SearchableSelect className="risk-field risk-span-4" label="JCI" value={draft.jci||''} disabled={locked} placeholder="—" clearLabel={locked?'':L(en,'Καθαρισμός','Clear')} emptyLabel={L(en,'Κανένα κεφάλαιο','No chapter')} onChange={v=>set('jci',v||'')} options={JCI_CHAPTERS.map(x=>({value:x.id,label:`${x.id} · ${en?x.en:x.el}`}))}/>
     <div className="risk-span-2">{field('jciReference',L(en,'Πρότυπο / ME','Standard / ME'),{placeholder:L(en,'π.χ. IPSG.5 ME 2','e.g. IPSG.5 ME 2')})}</div>
    </div>
    {area('hazard',L(en,'Πιθανό ρίσκο / κίνδυνος','Potential risk / hazard'),2)}
   </Step>
   {/* The order of the assessment: inherent risk, the controls in place, the residual risk they leave, the additional measures, the target. */}
   <Step n={2} title={L(en,'Αξιολόγηση και μέτρα','Assessment and measures')}>
    <div className="risk-editor-flow">
     <ScoreRow kind="inherent" draft={draft} s={s} en={en} readOnly={locked} set={set}/>
     <MeasureList title={L(en,'Προληπτικά μέτρα που ήδη λαμβάνονται','Controls already in place')} hint={L(en,'μειώνουν τον εγγενή στον υπολειπόμενο κίνδυνο','they bring the inherent risk down to the residual')} value={draft.existingControls} onChange={v=>set('existingControls',v)} en={en} disabled={locked}/>
     <ScoreRow kind="residual" draft={draft} s={s} en={en} readOnly={locked} set={set}/>
     {residualLevel&&<p className={`risk-response risk-response-${residualLevel.id}`}><strong>{L(en,'Απαιτούμενη ενέργεια','Required response')}:</strong> {en?residualLevel.responseEn:residualLevel.responseEl}</p>}
     {s.inherent.c&&s.residual.c&&s.inherent.c!==s.residual.c&&area('consequenceRationale',L(en,'Γιατί άλλαξε η συνέπεια (C) με τα μέτρα;','Why did the consequence (C) change with the controls?'),2)}
     <MeasureList title={L(en,'Απαιτούμενα πρόσθετα μέτρα (σχέδιο δράσης)','Additional measures required (action plan)')} hint={L(en,'οδηγούν στον κίνδυνο-στόχο','they lead to the target risk')} value={draft.additionalMeasures} onChange={v=>set('additionalMeasures',v)} en={en} disabled={locked}/>
     <ScoreRow kind="target" draft={draft} s={s} en={en} readOnly={locked} set={set}/>
    </div>
    {alerts.length>0&&<ul className="risk-warnings">{alerts.map(w=><li key={w.id} className={`risk-warning-${w.tone}`}><AlertTriangle size={14}/>{warningLabel(w.id,en)}</li>)}</ul>}
   </Step>
   <Step n={3} title={L(en,'Παρακολούθηση','Monitoring')}>
    <IndicatorPicker risk={draft} values={indicatorValues} en={en} disabled={locked} onChange={keys=>set('indicatorKeys',keys)}/>
    <div className="risk-editor-grid risk-editor-grid-monitoring">
     <div className="risk-field-span2">{field('owner',L(en,'Υπεύθυνος υλοποίησης','Owner'))}</div>
     {field('reviewFrequency',L(en,'Συχνότητα ελέγχου','Review frequency'))}
     {field('indicator',L(en,'Κωδικός συμβάντος / άλλος δείκτης','Incident code / other indicator'))}
     <ManualDateField label={L(en,'Προθεσμία','Due date')} value={draft.dueDate||''} onChange={v=>set('dueDate',v||null)} optional disabled={locked}/>
    </div>
    <fieldset className="risk-fieldset risk-fmea" disabled={locked}><YesNoField label={L(en,'Προληπτική ανάλυση (FMEA)','Proactive analysis (FMEA)')} hint={L(en,'Ο κίνδυνος επιλέγεται για την FMEA της περιόδου.','The risk is selected for the period’s FMEA.')} value={Boolean(draft.prioritized)} onChange={v=>set('prioritized',v)}/></fieldset>
    {area('notes',L(en,'Σημειώσεις','Notes'),2)}
    {notes.length>0&&<ul className="risk-warnings">{notes.map(w=><li key={w.id} className={`risk-warning-${w.tone}`}><Info size={14}/>{warningLabel(w.id,en)}</li>)}</ul>}
   </Step>
  </div>
  <div className="risk-editor-actions">
   {locked&&!isNew&&onCreateCapa&&<Button variant="secondary" onClick={()=>onCreateCapa(draft)}><CheckSquare2 size={15}/>{L(en,'Δημιουργία διορθωτικής ενέργειας','Create CAPA')}</Button>}
   <Button variant="secondary" onClick={locked?onClose:cancel}>{locked?L(en,'Πίσω','Back'):L(en,'Ακύρωση','Cancel')}</Button>
   {!locked&&<Button onClick={()=>onSave(draft)} disabled={!valid||saving}><Save size={15}/>{L(en,'Αποθήκευση κινδύνου','Save risk')}</Button>}
  </div>
 </EntityRecordShell>
}

const STAGE_LABELS=Object.fromEntries(STAGES.map(([kind,...rest])=>[kind,rest]))

// One stage of the assessment: L and C on one line, with the resulting level.
function ScoreRow({kind,draft,s,en,readOnly,set}){
 const [el,enLabel,hintEl,hintEn]=STAGE_LABELS[kind]
 return <div className={`risk-stage risk-stage-${kind}`}>
  <header><strong>{en?enLabel:el}</strong><small>{en?hintEn:hintEl}</small></header>
  <AxisSelect label={L(en,'Πιθανότητα (L)','Likelihood (L)')} value={draft[`${kind}L`]} onChange={v=>set(`${kind}L`,v)} scale={LIKELIHOOD} en={en} disabled={readOnly}/>
  <AxisSelect label={L(en,'Συνέπεια (C)','Consequence (C)')} value={draft[`${kind}C`]} onChange={v=>set(`${kind}C`,v)} scale={CONSEQUENCE} en={en} disabled={readOnly}/>
  <div className="risk-stage-level"><LevelChip score={s[kind].score} level={s[kind].level} en={en}/></div>
 </div>
}

// Measures as a numbered list, kept as one line each. Enter adds the next one.
export function MeasureList({title,hint,value,onChange,en,disabled}){
 const [items,setItems]=useState(()=>{const list=parseMeasures(value);return list.length?list:['']})
 const refs=useRef([])
 // Each item is as tall as its text.
 useLayoutEffect(()=>{for(const el of refs.current){if(el){el.style.height='auto';el.style.height=`${el.scrollHeight+2}px`}}},[items])
 const commit=next=>{setItems(next);onChange(joinMeasures(next))}
 const focus=i=>setTimeout(()=>refs.current[i]?.focus(),0)
 const update=(i,text)=>commit(items.map((item,j)=>j===i?text:item))
 const add=(at=items.length)=>{const next=[...items.slice(0,at),'',...items.slice(at)];commit(next);focus(at)}
 const remove=i=>{const next=items.filter((_,j)=>j!==i);commit(next.length?next:['']);focus(Math.max(0,i-1))}
 const move=(i,d)=>{const j=i+d;if(j<0||j>=items.length)return;const next=[...items];[next[i],next[j]]=[next[j],next[i]];commit(next);focus(j)}
 const filled=items.filter(item=>item.trim()).length
 return <div className="risk-measures">
  <div className="risk-measures-head"><strong>{title}</strong><small>{hint}</small><span className="risk-measures-count">{filled}</span></div>
  <ol>{items.map((item,i)=><li key={i}>
   <span className="risk-measure-number">{i+1}</span>
   <textarea data-limoxis-no-expand="true" ref={el=>{refs.current[i]=el}} rows={1} value={item} disabled={disabled} placeholder={L(en,'Περιγραφή μέτρου…','Describe the measure…')} onChange={e=>update(i,e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();add(i+1)}else if(e.key==='Backspace'&&!item&&items.length>1){e.preventDefault();remove(i)}}}/>
   {!disabled&&<span className="risk-measure-actions">
    <button type="button" onClick={()=>move(i,-1)} disabled={i===0} aria-label={L(en,'Μετακίνηση πάνω','Move up')}><ArrowUp size={13}/></button>
    <button type="button" onClick={()=>move(i,1)} disabled={i===items.length-1} aria-label={L(en,'Μετακίνηση κάτω','Move down')}><ArrowDown size={13}/></button>
    <button type="button" onClick={()=>remove(i)} aria-label={L(en,'Διαγραφή μέτρου','Delete the measure')}><X size={13}/></button>
   </span>}
  </li>)}</ol>
  {!disabled&&<button type="button" className="risk-measure-add" onClick={()=>add()}><Plus size={14}/>{L(en,'Προσθήκη μέτρου','Add a measure')}</button>}
 </div>
}

// A numbered part of the editor; the order follows the assessment itself.
export function Step({n,title,aside=null,children}){
 return <section className="risk-editor-step">
  <header><span className="risk-editor-step-number">{n}</span><h4>{title}</h4>{aside}</header>
  {children}
 </section>
}
