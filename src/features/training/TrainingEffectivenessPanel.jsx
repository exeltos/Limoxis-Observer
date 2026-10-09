import { useEffect,useMemo,useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpenCheck,ChevronRight,ClipboardCheck,Plus,Smile,Target } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { MetricCard } from '../../design-system/MetricCard'
import { ManualDateField } from '../../design-system/ManualDateField'
import { useAuth } from '../../core/auth/AuthContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { CAPABILITIES,can } from '../../core/permissions/roles'
import { formatDay } from '../../core/i18n/formatDay'
import { loadQualityRecords } from '../quality/qualityService'
import { EFFECTIVENESS_METHODS,EFFECTIVENESS_RESULTS,capasForProgram,defaultEffectiveness,effectivenessCapaSource,effectivenessLevels,effectivenessState,optionLabel } from './trainingEffectiveness'
import './trainingEffectiveness.css'

const effectivenessStateText=(state,en)=>({not_planned:en?'Not planned':'Δεν έχει προγραμματιστεί',planned:en?'Planned':'Προγραμματισμένη',overdue:en?'Overdue':'Εκπρόθεσμη',effective:en?'Effective':'Αποτελεσματική',partial:en?'Partly effective':'Μερικώς αποτελεσματική',not_effective:en?'Not effective':'Μη αποτελεσματική'})[state]||state

// Programme tab "Effectiveness": feedback (level 1) and assessment (level 2)
// from what participants submitted, and the evaluation in practice (level 3)
// recorded some months later. Not met → a CAPA prefilled from the evaluation.
export function TrainingEffectivenessPanel({program,assignments=[],state,onPersist,busy=false,en=false,canManage=false}){
 const navigate=useNavigate()
 const {profile,user}=useAuth()
 const {tenant,role,membership}=useTenant()
 const canCreateCapa=can(role,CAPABILITIES.MANAGE_QUALITY,membership?.capabilities??[],membership?.customCapabilities??[])
 const saved=useMemo(()=>({...defaultEffectiveness(program),...(program.effectiveness||{})}),[program])
 const [draft,setDraft]=useState(saved)
 const [capas,setCapas]=useState([])
 useEffect(()=>setDraft(saved),[saved])
 useEffect(()=>{let active=true;loadQualityRecords('capas',tenant?.id).then(rows=>{if(active)setCapas(capasForProgram(rows||[],program.id))}).catch(()=>{});return()=>{active=false}},[tenant?.id,program.id])
 const levels=effectivenessLevels(program,assignments)
 const status=effectivenessState(program)
 const dirty=JSON.stringify(draft)!==JSON.stringify(saved)
 const set=(key,value)=>setDraft(current=>({...current,[key]:value}))
 const evaluator=profile?.fullName||profile?.name||user?.email||''

 async function save(){
  const next={...draft}
  if(next.result&&!next.evaluatedAt)next.evaluatedAt=new Date().toISOString().slice(0,10)
  if(next.result&&!next.evaluatedBy)next.evaluatedBy=evaluator
  if(!next.result){next.evaluatedAt='';next.evaluatedBy=''}
  await onPersist({...state,programs:state.programs.map(p=>p.id===program.id?{...p,effectiveness:next,updatedAt:new Date().toISOString()}:p)},en?'Effectiveness evaluation saved.':'Η αξιολόγηση αποτελεσματικότητας αποθηκεύτηκε.')
 }

 const practice=program.effectiveness?.result?effectivenessStateText(status,en):program.effectiveness?.plannedDate?`${effectivenessStateText(status,en)} · ${formatDay(program.effectiveness.plannedDate)}`:effectivenessStateText(status,en)
 const notMet=['partial','not_effective'].includes(program.effectiveness?.result)

 return <section className="record-section training-effectiveness">
  <div className="record-section-header"><div><span className="eyebrow">{en?'Training effectiveness':'Αποτελεσματικότητα εκπαίδευσης'}</span><h3>{en?'Did the training change practice?':'Άλλαξε η εκπαίδευση την πρακτική;'}</h3></div><span className={`training-effectiveness-state ${status}`}>{effectivenessStateText(status,en)}</span></div>
  <div className="training-effectiveness-levels">
   <MetricCard icon={Smile} value={levels.satisfaction==null?'—':`${levels.satisfaction}/5`} label={en?`1 · Satisfaction (${levels.feedbackCount} answers)`:`1 · Ικανοποίηση (${levels.feedbackCount} απαντήσεις)`}/>
   <MetricCard icon={BookOpenCheck} value={levels.passRate==null?'—':`${levels.passRate}%`} label={en?`2 · Knowledge: passed${levels.averageScore==null?'':` · avg ${levels.averageScore}%`}`:`2 · Γνώσεις: επιτυχία${levels.averageScore==null?'':` · μ.ο. ${levels.averageScore}%`}`}/>
   <MetricCard icon={Target} value={practice} label={en?'3 · Practice (evaluation)':'3 · Εφαρμογή στην πράξη'} tone={status==='effective'?'active':notMet||status==='overdue'?'danger':'neutral'}/>
  </div>

  <div className="entry-grid">
   <ManualDateField label={en?'Evaluate on':'Αξιολόγηση στις'} value={draft.plannedDate} onChange={value=>set('plannedDate',value)} disabled={!canManage}/>
   <label><span>{en?'Method':'Μέθοδος'}</span><select disabled={!canManage} value={draft.method} onChange={e=>set('method',e.target.value)}>{EFFECTIVENESS_METHODS.map(([key,el,enLabel])=><option key={key} value={key}>{en?enLabel:el}</option>)}</select></label>
   <label className="entry-span-2"><span>{en?'What counts as effective':'Τι θεωρείται αποτελεσματικό'}</span><input disabled={!canManage} value={draft.criterion} onChange={e=>set('criterion',e.target.value)} placeholder={en?'e.g. hand hygiene compliance ≥ 80% in the ward audit':'π.χ. συμμόρφωση υγιεινής χεριών ≥ 80% στην επιθεώρηση του τμήματος'}/></label>
   <label><span>{en?'Result':'Αποτέλεσμα'}</span><select disabled={!canManage} value={draft.result} onChange={e=>set('result',e.target.value)}><option value="">{en?'Not evaluated yet':'Δεν έχει αξιολογηθεί'}</option>{EFFECTIVENESS_RESULTS.map(([key,el,enLabel])=><option key={key} value={key}>{en?enLabel:el}</option>)}</select></label>
   <ManualDateField label={en?'Evaluated on':'Ημερομηνία αξιολόγησης'} value={draft.evaluatedAt} onChange={value=>set('evaluatedAt',value)} optional disabled={!canManage||!draft.result}/>
   <label className="entry-span-2"><span>{en?'Findings':'Ευρήματα'}</span><textarea rows={3} disabled={!canManage} value={draft.notes} onChange={e=>set('notes',e.target.value)} placeholder={en?'What was observed or measured':'Τι παρατηρήθηκε ή μετρήθηκε'}/></label>
  </div>
  {saved.evaluatedBy&&<p className="training-effectiveness-meta">{en?'Evaluated by':'Αξιολόγηση από'} {saved.evaluatedBy}{saved.evaluatedAt?` · ${formatDay(saved.evaluatedAt)}`:''} · {optionLabel(EFFECTIVENESS_METHODS,saved.method,en)}</p>}
  {canManage&&<div className="inline-edit-footer">{dirty&&<Button variant="secondary" onClick={()=>setDraft(saved)} disabled={busy}>{en?'Cancel':'Ακύρωση'}</Button>}<SaveButton loading={busy} disabled={!dirty||busy} onClick={()=>void save()}>{en?'Save':'Αποθήκευση'}</SaveButton></div>}

  {(notMet||capas.length>0)&&<div className="training-effectiveness-capa">
   <div className="training-effectiveness-capa-head"><div><strong>{en?'Corrective action':'Διορθωτική ενέργεια'}</strong><span>{en?'When practice did not change, open a CAPA; it links back to this programme.':'Όταν η πρακτική δεν άλλαξε, ανοίξτε CAPA· συνδέεται με αυτό το πρόγραμμα.'}</span></div>{notMet&&canCreateCapa&&<Button onClick={()=>navigate('/quality/capas/new',{state:{qualitySource:effectivenessCapaSource(program,{en})}})}><Plus size={15}/>{en?' Create CAPA':' Δημιουργία CAPA'}</Button>}</div>
   {capas.map(capa=><button type="button" key={capa.id} className="training-effectiveness-capa-link" onClick={()=>navigate(`/quality/capas/${capa.id}`)}><ClipboardCheck size={15}/><span><strong>{capa.displayId||capa.id}</strong><small>{en?capa.titleEn||capa.title:capa.title}</small></span><ChevronRight size={15}/></button>)}
  </div>}
 </section>
}
