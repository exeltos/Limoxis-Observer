import { useState } from 'react'
import { normalizeTrainingQuestion } from '../training/trainingAssessment'
import { Button } from '../../design-system/Button'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { useContextualNavigation } from '../../core/navigation/useContextualNavigation'
import { useEmployeeSubRecords } from './useEmployeeSubRecords'
import { loadEmployeeTrainingAsync } from './employeeSubRecordsService'
import { SectionTitle,Empty,State,Pager,RegistryFilter,useRegistryRows,statusClass,label } from './employeeRecordShared'

// Training tab of the employee record: programmes, attendance and questionnaire answers.

export function EmployeeTrainingTab({employee,t,language,fmt,organizationId,canOpenProgram=false}){
  const {goTo}=useContextualNavigation('/training')
  const state=useEmployeeSubRecords(loadEmployeeTrainingAsync,organizationId,employee.dbId,employee.id)
  const [selected,setSelected]=useState(null)
  const registry=useRegistryRows(state.data)
  const paging=registry.paging
  return <section className="record-section record-secondary-registry">
    <SectionTitle title={language==='en'?'Training':'Εκπαίδευση'} subtitle={language==='en'?'Assignments and completion data come directly from Training programmes.':'Οι αναθέσεις και οι ολοκληρώσεις αντλούνται απευθείας από τα προγράμματα Εκπαίδευσης.'}/>
    <State {...state} language={language} onRetry={state.reload}/>
    {!state.loading&&!state.error&&<RegistryFilter query={registry.query} setQuery={registry.setQuery} language={language} count={registry.filtered.length}/>}
    {!state.loading&&!state.error&&(registry.filtered.length?<><div className="scroll-table"><table className="data-table sticky-table record-table-clickable"><thead><tr><th>{language==='en'?'Training':'Εκπαίδευση'}</th><th>{language==='en'?'Date':'Ημερομηνία'}</th><th>{language==='en'?'Status':'Κατάσταση'}</th><th>{language==='en'?'Score':'Βαθμολογία'}</th></tr></thead><tbody>{paging.paged.map(row=><tr key={row.id} tabIndex={0} onClick={()=>setSelected(row)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(row)}}}><td><strong>{language==='el'?(row.titleEl||row.titleEn):(row.titleEn||row.titleEl)}</strong></td><td>{fmt(row.date)}</td><td><span className={`status-badge ${statusClass(row.status)}`}>{label(row.status,t)}</span></td><td>{row.score!=null?`${row.score}%`:'—'}</td></tr>)}</tbody></table></div><Pager paging={paging} total={registry.filtered.length} language={language}/></>:<Empty language={language} title={language==='en'?'No training records':'Δεν υπάρχουν εκπαιδεύσεις'}/>) }
    {selected&&<ObserverDialog width="wide" eyebrow={language==='en'?'Employee training':'Εκπαίδευση εργαζομένου'} title={language==='el'?(selected.titleEl||selected.titleEn):(selected.titleEn||selected.titleEl)} subtitle={fmt(selected.date)} onClose={()=>setSelected(null)} footer={canOpenProgram&&selected.programId?<Button onClick={()=>goTo(`/training/${selected.programId}`,{tab:'training',returnTo:`/employees/${encodeURIComponent(employee.id)}`,returnTab:'training'})}>{language==='en'?'Open training programme':'Άνοιγμα εκπαίδευσης'}</Button>:undefined}><div className="employee-training-detail"><div className="employee-training-summary"><div><span className="eyebrow">{language==='en'?'TRAINING STATUS':'ΚΑΤΑΣΤΑΣΗ ΕΚΠΑΙΔΕΥΣΗΣ'}</span><strong>{label(selected.status,t)}</strong><small>{language==='en'?'Assigned':'Ανάθεση'}: {fmt(selected.assignedDate)}</small></div>{selected.score!=null&&<div className="employee-training-score"><span>{language==='en'?'Assessment score':'Βαθμολογία αξιολόγησης'}</span><strong>{selected.score}%</strong><em>{selected.score>=80?(language==='en'?'Successful':'Επιτυχής'):(language==='en'?'Review required':'Απαιτείται επανέλεγχος')}</em></div>}</div><div className="employee-training-timeline"><div><span>1</span><section><small>{language==='en'?'Assigned':'Ανάθεση'}</small><strong>{fmt(selected.assignedDate)}</strong></section></div><div className={selected.completedDate?'is-complete':''}><span>2</span><section><small>{language==='en'?'Completed':'Ολοκλήρωση'}</small><strong>{fmt(selected.completedDate)}</strong></section></div></div>{selected.score!=null&&<div className="employee-training-progress"><div><span>{language==='en'?'Knowledge assessment':'Αξιολόγηση γνώσεων'}</span><strong>{selected.score}%</strong></div><div><i style={{width:`${Math.max(0,Math.min(100,selected.score))}%`}}/></div></div>}</div></ObserverDialog>}
  </section>
}

export function trainingAnswerText(question,answer,en){const q=normalizeTrainingQuestion(question);if(answer===undefined||answer===null||answer==='')return '—';if(q.type==='single_choice')return q.options.find(option=>option.id===answer)?.text||String(answer);if(q.type==='multiple_choice')return (Array.isArray(answer)?answer:[]).map(value=>q.options.find(option=>option.id===value)?.text||String(value)).join(', ')||'—';if(q.type==='true_false'){const value=answer===true||answer==='true'||answer===1||answer==='1';return value?(en?'True':'Σωστό'):(en?'False':'Λάθος')}return String(answer)}
