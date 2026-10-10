import { useState } from 'react'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { useEmployeeSubRecords } from './useEmployeeSubRecords'
import { loadOccupationalVisitsAsync,loadVaccinationsAsync,loadExposureIncidentsAsync } from './employeeSubRecordsService'
import { SubTabs } from '../../design-system/SubTabs'
import { SectionTitle,Empty,State,Pager,RegistryFilter,useRegistryRows,statusClass,label } from './employeeRecordShared'

// Occupational-health tabs of the employee record: health overview, visits,
// vaccinations and exposure incidents.

// Occupational health, vaccinations and exposure incidents share one tab
// (same permission) with a sub-navigation, so the record tabs fit one row.
export function EmployeeHealthTab({employee,t,language,fmt,organizationId,initialSection='visits'}){
  const [section,setSection]=useState(initialSection)
  const en=language==='en'
  const sections=[['visits',en?'Visits':'Επισκέψεις'],['vaccinations',en?'Vaccinations':'Εμβολιασμοί'],['exposures',en?'Exposure incidents':'Περιστατικά έκθεσης']]
  return <div className="employee-health-tab">
    <SubTabs activeId={section} onChange={setSection} ariaLabel={en?'Occupational health':'Ιατρός Εργασίας'} tabs={sections.map(([id,label])=>({id,label}))}/>
    {section==='visits'&&<EmployeeOccupationalTab employee={employee} t={t} language={language} fmt={fmt} organizationId={organizationId}/>}
    {section==='vaccinations'&&<EmployeeVaccinationsTab employee={employee} t={t} language={language} fmt={fmt} organizationId={organizationId}/>}
    {section==='exposures'&&<EmployeeExposureIncidentsTab employee={employee} language={language} fmt={fmt} organizationId={organizationId}/>}
  </div>
}

export function EmployeeOccupationalTab({employee,t,language,fmt,organizationId}){
  const state=useEmployeeSubRecords(loadOccupationalVisitsAsync,organizationId,employee.dbId,employee.id)
  const [selected,setSelected]=useState(null)
  const registry=useRegistryRows(state.data)
  const paging=registry.paging
  return <section className="record-section record-secondary-registry">
    <SectionTitle title={language==='en'?'Occupational Health':'Ιατρός Εργασίας'} subtitle={language==='en'?'Visits are read from the Occupational Health clinical record.':'Οι επισκέψεις αντλούνται από το κλινικό αρχείο Ιατρού Εργασίας.'}/>
    <State {...state} language={language} onRetry={state.reload}/>
    {!state.loading&&!state.error&&<RegistryFilter query={registry.query} setQuery={registry.setQuery} language={language} count={registry.filtered.length}/>}
    {!state.loading&&!state.error&&(registry.filtered.length?<><div className="scroll-table"><table className="data-table sticky-table record-table-clickable"><thead><tr><th>{language==='en'?'Visit date':'Ημερομηνία'}</th><th>{language==='en'?'Visit type':'Τύπος επίσκεψης'}</th><th>{language==='en'?'Fitness':'Καταλληλότητα'}</th><th>{language==='en'?'Follow-up':'Επανέλεγχος'}</th><th>{language==='en'?'Status':'Κατάσταση'}</th></tr></thead><tbody>{paging.paged.map(row=><tr key={row.id} tabIndex={0} onClick={()=>setSelected(row)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(row)}}}><td>{fmt(row.date)}</td><td><strong>{label(row.type,t)}</strong></td><td>{label(row.fitStatus,t)}</td><td>{fmt(row.followUpDate)}</td><td><span className={`status-badge ${statusClass(row.status)}`}>{label(row.status,t)}</span></td></tr>)}</tbody></table></div><Pager paging={paging} total={registry.filtered.length} language={language}/></>:<Empty language={language} title={language==='en'?'No occupational-health visits':'Δεν υπάρχουν επισκέψεις Ιατρού Εργασίας'}/>) }
    {selected&&<ObserverDialog width="wide" eyebrow={language==='en'?'Occupational Health':'Ιατρός Εργασίας'} title={`${fmt(selected.date)} · ${label(selected.type,t)}`} onClose={()=>setSelected(null)}><div className="detail-grid"><div className="detail-item"><span>{language==='en'?'Status':'Κατάσταση'}</span><strong>{label(selected.status,t)}</strong></div><div className="detail-item"><span>{language==='en'?'Fitness status':'Καταλληλότητα'}</span><strong>{label(selected.fitStatus,t)}</strong></div><div className="detail-item"><span>{language==='en'?'Follow-up date':'Ημερομηνία επανελέγχου'}</span><strong>{fmt(selected.followUpDate)}</strong></div></div><div className="source-truth-note"><div><strong>{language==='en'?'Notes / treatment':'Σημειώσεις / αντιμετώπιση'}</strong><span>{selected.clinicalNotes||'—'}</span></div></div></ObserverDialog>}
  </section>
}

export function EmployeeVaccinationsTab({employee,t,language,fmt,organizationId}){
  const state=useEmployeeSubRecords(loadVaccinationsAsync,organizationId,employee.dbId,employee.id)
  const [selected,setSelected]=useState(null)
  const registry=useRegistryRows(state.data)
  const paging=registry.paging
  return <section className="record-section record-secondary-registry">
    <SectionTitle title={language==='en'?'Vaccinations':'Εμβολιασμοί'} subtitle={language==='en'?'Vaccination records come from the staff vaccination register.':'Τα στοιχεία αντλούνται από το μητρώο εμβολιασμών προσωπικού.'}/>
    <State {...state} language={language} onRetry={state.reload}/>
    {!state.loading&&!state.error&&<RegistryFilter query={registry.query} setQuery={registry.setQuery} language={language} count={registry.filtered.length}/>}
    {!state.loading&&!state.error&&(registry.filtered.length?<><div className="scroll-table"><table className="data-table sticky-table record-table-clickable"><thead><tr><th>{language==='en'?'Vaccine':'Εμβόλιο'}</th><th>{language==='en'?'Dose':'Δόση'}</th><th>{language==='en'?'Date':'Ημερομηνία'}</th><th>{language==='en'?'Valid until':'Ισχύει έως'}</th><th>{language==='en'?'Status':'Κατάσταση'}</th></tr></thead><tbody>{paging.paged.map(row=><tr key={row.id} tabIndex={0} onClick={()=>setSelected(row)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(row)}}}><td><strong>{row.vaccine||'—'}</strong></td><td>{row.dose||'—'}</td><td>{fmt(row.date)}</td><td>{fmt(row.validUntil)}</td><td><span className={`status-badge ${statusClass(row.status)}`}>{label(row.status,t)}</span></td></tr>)}</tbody></table></div><Pager paging={paging} total={registry.filtered.length} language={language}/></>:<Empty language={language} title={language==='en'?'No vaccination records':'Δεν υπάρχουν εμβολιασμοί'}/>) }
    {selected&&<ObserverDialog width="wide" eyebrow={language==='en'?'Staff vaccination':'Εμβολιασμός προσωπικού'} title={selected.vaccine||'—'} subtitle={fmt(selected.date)} onClose={()=>setSelected(null)}><div className="detail-grid"><div className="detail-item"><span>{language==='en'?'Dose':'Δόση'}</span><strong>{selected.dose||'—'}</strong></div><div className="detail-item"><span>{language==='en'?'Lot number':'Αριθμός παρτίδας'}</span><strong>{selected.lotNumber||'—'}</strong></div><div className="detail-item"><span>{language==='en'?'Valid until':'Ισχύει έως'}</span><strong>{fmt(selected.validUntil)}</strong></div><div className="detail-item"><span>{language==='en'?'Status':'Κατάσταση'}</span><strong>{label(selected.status,t)}</strong></div></div>{selected.clinicalNotes&&<div className="source-truth-note"><div><strong>{language==='en'?'Notes':'Σημειώσεις'}</strong><span>{selected.clinicalNotes}</span></div></div>}</ObserverDialog>}
  </section>
}

export function EmployeeExposureIncidentsTab({employee,language,fmt,organizationId}){
  const en=language==='en'
  const state=useEmployeeSubRecords(loadExposureIncidentsAsync,organizationId,employee.dbId,employee.id)
  const [selected,setSelected]=useState(null)
  const registry=useRegistryRows(state.data)
  const paging=registry.paging
  const typeLabel=value=>({needlestick:['Τρύπημα βελόνας','Needlestick'],sharps_object:['Άλλο αιχμηρό αντικείμενο','Other sharps object'],mucocutaneous:['Έκθεση βλεννογόνου','Mucocutaneous exposure'],non_intact_skin:['Έκθεση μη ακέραιου δέρματος','Non-intact skin exposure'],other:['Άλλο','Other']}[value]?.[en?1:0]||value||'—')
  const followUpLabel=value=>({pending:['Εκκρεμεί','Pending'],scheduled:['Προγραμματισμένη','Scheduled'],completed:['Ολοκληρώθηκε','Completed'],closed:['Έκλεισε','Closed']}[value]?.[en?1:0]||value||'—')
  return <section className="record-section record-secondary-registry">
    <SectionTitle title={en?'Occupational exposure':'Επαγγελματική έκθεση'} subtitle={en?'Needlestick, sharps and mucocutaneous exposure incidents and their follow-up.':'Περιστατικά τρυπήματος βελόνας, αιχμηρών αντικειμένων και έκθεσης βλεννογόνου, με την παρακολούθησή τους.'}/>
    <State {...state} language={language} onRetry={state.reload}/>
    {!state.loading&&!state.error&&<RegistryFilter query={registry.query} setQuery={registry.setQuery} language={language} count={registry.filtered.length}/>}
    {!state.loading&&!state.error&&(registry.filtered.length?<><div className="scroll-table"><table className="data-table sticky-table record-table-clickable"><thead><tr><th>{en?'Date':'Ημερομηνία'}</th><th>{en?'Exposure type':'Τύπος έκθεσης'}</th><th>{en?'Follow-up':'Παρακολούθηση'}</th><th>{en?'Status':'Κατάσταση'}</th></tr></thead><tbody>{paging.paged.map(row=><tr key={row.id} tabIndex={0} onClick={()=>setSelected(row)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(row)}}}><td>{fmt(row.incidentDate)}</td><td><strong>{typeLabel(row.exposureType)}</strong></td><td>{followUpLabel(row.followUpStatus)}</td><td><span className={`status-badge ${row.status==='open'?'temporary':''}`}>{row.status==='open'?(en?'Open':'Ανοικτό'):(en?'Closed':'Κλειστό')}</span></td></tr>)}</tbody></table></div><Pager paging={paging} total={registry.filtered.length} language={language}/></>:<Empty language={language} title={en?'No exposure incidents recorded':'Δεν έχουν καταγραφεί περιστατικά έκθεσης'}/>) }
    {selected&&<ObserverDialog width="wide" eyebrow={en?'Occupational exposure':'Επαγγελματική έκθεση'} title={`${fmt(selected.incidentDate)} · ${typeLabel(selected.exposureType)}`} onClose={()=>setSelected(null)}><div className="detail-grid"><div className="detail-item"><span>{en?'Device / source':'Συσκευή / πηγή'}</span><strong>{selected.deviceOrSource||'—'}</strong></div><div className="detail-item"><span>{en?'Body site':'Σημείο έκθεσης'}</span><strong>{selected.bodySite||'—'}</strong></div><div className="detail-item"><span>{en?'Follow-up status':'Κατάσταση παρακολούθησης'}</span><strong>{followUpLabel(selected.followUpStatus)}</strong></div><div className="detail-item"><span>{en?'Follow-up due':'Επόμενος επανέλεγχος'}</span><strong>{fmt(selected.followUpDueAt)}</strong></div></div><div className="source-truth-note"><div><strong>{en?'Notes':'Σημειώσεις'}</strong><span>{selected.notes||'—'}</span></div></div></ObserverDialog>}
  </section>
}
