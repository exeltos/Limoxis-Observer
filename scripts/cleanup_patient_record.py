from pathlib import Path
import re

jsx=Path('src/features/surveillance/PatientClinicalCanonicalPage.jsx')
s=jsx.read_text(encoding='utf-8')
start=s.index('function PatientAdmissionsHome(')
end=s.index('function CanonicalSummary(', start)
replacement=r'''function PatientAdmissionsHome({patient,rows,episodes,tenantId,isDemo,departments,canEdit,t,language,fmtDate,onAdded,onSelect,actions}){
  const age=patient?.dateOfBirth?Math.max(0,Math.floor((Date.now()-new Date(`${patient.dateOfBirth}T12:00:00`).getTime())/31557600000)):null
  const profile=[
    [language==='el'?'Κωδικός ασθενούς':'Patient code',patient?.id],
    [language==='el'?'Αριθμός φακέλου':'Hospital record number',patient?.hospitalRecordNumber],
    [language==='el'?'Ονοματεπώνυμο':'Full name',[patient?.lastName,patient?.firstName].filter(Boolean).join(' ')||patient?.name],
    [language==='el'?'Πατρώνυμο':'Father name',patient?.fatherName],
    [language==='el'?'Ημερομηνία γέννησης':'Date of birth',fmtDate(patient?.dateOfBirth)],
    [language==='el'?'Ηλικία':'Age',age==null?'—':String(age)],
    [language==='el'?'Φύλο':'Sex',patient?.sex?t(patient.sex):'—'],
    [language==='el'?'Τρέχον τμήμα':'Current department',patient?.department||'—'],
  ]
  return <div className="patient-home-layout"><section className="patient-home-details patient-profile-card"><div className="record-section-header"><div><h3>{language==='el'?'Στοιχεία ασθενούς':'Patient details'}</h3><p>{language==='el'?'Βασικά στοιχεία ταυτοποίησης και τρέχουσας νοσηλείας.':'Core identity and current admission information.'}</p></div>{actions}</div><div className="patient-profile-grid">{profile.map(([label,value])=><div key={label} className="patient-profile-item"><span>{label}</span><strong>{value||'—'}</strong></div>)}</div>{patient?.notes&&<div className="patient-profile-note"><span>{language==='el'?'Σημειώσεις':'Notes'}</span><p>{patient.notes}</p></div>}</section><AdmissionsPanel rows={rows} episodes={episodes} patient={patient} tenantId={tenantId} isDemo={isDemo} departments={departments} canEdit={canEdit} t={t} language={language} fmtDate={fmtDate} onAdded={onAdded} onSelect={onSelect}/></div>
}
'''
s=s[:start]+replacement+s[end:]
jsx.write_text(s,encoding='utf-8')

css=Path('src/styles/patient-record.css')
c=css.read_text(encoding='utf-8')
root_start=c.index('/* Patient root:')
root_end=c.index('/* Summary:',root_start)
clean=r'''/* Patient root: compact identity overview + admission registry. */
.patient-home-layout{
  display:flex!important;flex-direction:column!important;flex:1 1 auto!important;
  gap:14px!important;min-height:0!important;height:100%!important;overflow:hidden!important;
}
.patient-profile-card{
  flex:0 0 auto!important;margin:0!important;padding:0!important;
  border:1px solid #e1e8ee!important;border-radius:12px!important;background:#fff!important;
  overflow:hidden!important;box-shadow:0 1px 2px rgba(27,58,84,.025)!important;
}
.patient-profile-card>.record-section-header{
  align-items:center!important;margin:0!important;padding:11px 14px!important;
  border-bottom:1px solid #e8edf2!important;background:#fff!important;
}
.patient-profile-card>.record-section-header h3{font-size:15px!important}
.patient-profile-card>.record-section-header p{font-size:10px!important;margin-top:2px!important}
.patient-profile-grid{
  display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;
  background:#fff!important;
}
.patient-profile-item{
  min-width:0!important;min-height:58px!important;padding:10px 14px!important;
  border-right:1px solid #edf1f4!important;border-bottom:1px solid #edf1f4!important;
}
.patient-profile-item:nth-child(4n){border-right:0!important}
.patient-profile-item:nth-last-child(-n+4){border-bottom:0!important}
.patient-profile-item span,.patient-profile-note>span{
  display:block!important;margin-bottom:4px!important;color:#7b8b9b!important;
  font-size:9px!important;font-weight:800!important;line-height:1.2!important;
}
.patient-profile-item strong{
  display:block!important;color:#18364f!important;font-size:12px!important;font-weight:700!important;
  line-height:1.3!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;
}
.patient-profile-note{padding:10px 14px!important;border-top:1px solid #edf1f4!important;background:#fbfcfd!important}
.patient-profile-note p{margin:0!important;color:#40556a!important;font-size:11px!important;line-height:1.4!important}
.patient-admissions-section{
  display:flex!important;flex-direction:column!important;flex:1 1 auto!important;min-height:0!important;
  overflow:hidden!important;padding:0!important;border:1px solid #e1e8ee!important;border-radius:12px!important;
  background:#fff!important;box-shadow:0 1px 2px rgba(27,58,84,.025)!important;
}
.patient-admissions-section>.record-section-header{
  flex:0 0 auto!important;align-items:center!important;margin:0!important;padding:11px 14px!important;
  border-bottom:1px solid #e8edf2!important;background:#fff!important;
}
.patient-admissions-section>.record-section-header h3{font-size:15px!important}
.patient-admissions-section>.record-section-header p{margin-top:2px!important;color:#8391a0!important;font-size:10px!important}
.patient-admissions-table-wrap{display:block!important;flex:1 1 auto!important;height:100%!important;min-height:0!important;overflow:auto!important;border:0!important;border-radius:0!important;background:#fff!important}
.patient-admissions-table{width:100%!important;table-layout:fixed!important;border-collapse:collapse!important}
.patient-admissions-table th{position:sticky!important;top:0!important;z-index:1!important;height:38px!important;padding:0 14px!important;background:#f7f9fb!important;color:#718397!important;font-size:9px!important;font-weight:800!important;text-transform:uppercase!important;border-bottom:1px solid #e1e8ee!important}
.patient-admissions-table td{height:50px!important;padding:8px 14px!important;border-bottom:1px solid #edf1f4!important;color:#40556a!important;font-size:11px!important;vertical-align:middle!important}
.patient-admissions-table tbody tr:last-child td{border-bottom:0!important}
.patient-admissions-table .clickable-row{cursor:pointer!important;transition:background .15s ease!important}
.patient-admissions-table .clickable-row:hover,.patient-admissions-table .clickable-row:focus{background:#f4f9fc!important;outline:none!important}
.patient-admissions-table .clickable-row:focus-visible{box-shadow:inset 3px 0 0 #2f8fba!important}

'''
c=c[:root_start]+clean+c[root_end:]
# Remove obsolete patient-full-detail-grid overrides left from the previous multi-card patient layout.
c=re.sub(r'\.patient-full-detail-grid\{[^}]*\}\s*\.patient-full-detail-grid \.detail-item:last-child\{[^}]*\}', '', c, count=1)
# Replace obsolete responsive selectors from the removed multi-card layout.
c=c.replace('.patient-home-details .patient-detail-grid,.clean-patient-summary .patient-detail-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}', '.patient-profile-grid,.clean-patient-summary .patient-detail-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}')
c=c.replace('  .patient-home-details .detail-item:nth-child(2n),.clean-patient-summary .patient-detail-grid>.detail-item:nth-child(2n){border-right:0!important}\n  .patient-home-details .detail-item{border-bottom:1px solid #e8edf2!important}\n  .patient-home-details .detail-item:nth-last-child(-n+2){border-bottom:0!important}\n', '  .patient-profile-item:nth-child(2n){border-right:0!important}\n  .patient-profile-item:nth-last-child(-n+2){border-bottom:0!important}\n')
c=c.replace('.patient-home-details .patient-detail-grid,.clean-patient-summary .patient-detail-grid,.clinical-snapshot-strip{grid-template-columns:1fr!important}', '.patient-profile-grid,.clean-patient-summary .patient-detail-grid,.clinical-snapshot-strip{grid-template-columns:1fr!important}')
c=c.replace('  .patient-home-details .detail-item,.clean-patient-summary .patient-detail-grid>.detail-item{border-right:0!important;border-bottom:1px solid #e8edf2!important}\n  .patient-home-details .detail-item:last-child,.clean-patient-summary .patient-detail-grid>.detail-item:last-child{border-bottom:0!important}\n', '  .patient-profile-item{border-right:0!important;border-bottom:1px solid #e8edf2!important}\n  .patient-profile-item:last-child{border-bottom:0!important}\n')
css.write_text(c,encoding='utf-8')
