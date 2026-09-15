from pathlib import Path
p=Path('src/features/surveillance/PatientClinicalCanonicalPage.jsx')
s=p.read_text()
old="await load(created.id);setSelectedEpisodeId(created.id);setTab('surveillanceJourney');notify(t('surveillanceCreated'),'success');return created"
new="setEpisodes(current=>[...current.filter(row=>String(row.id)!==String(created.id)),created]);setSelectedEpisodeId(created.id);notify(t('surveillanceCreated'),'success');return created"
assert old in s, 'createEpisode refresh pattern not found'
s=s.replace(old,new,1)
old="onClose={()=>{setCreateOpen(false);setSampleToLink(null)}} onCreate={createEpisode}"
new="onClose={()=>{setCreateOpen(false);setSampleToLink(null);void load(selectedEpisodeId)}} onCreate={createEpisode}"
assert old in s, 'flow close pattern not found'
s=s.replace(old,new,1)
old="const details=[[language==='el'?'Κωδικός ασθενούς':'Patient code',patient?.id],[language==='el'?'Αριθμός φακέλου':'Hospital record number',patient?.hospitalRecordNumber],[language==='el'?'Όνομα':'First name',patient?.firstName],[language==='el'?'Επώνυμο':'Last name',patient?.lastName],[language==='el'?'Πατρώνυμο':'Father name',patient?.fatherName],[language==='el'?'Ημερομηνία γέννησης':'Date of birth',fmtDate(patient?.dateOfBirth)],[language==='el'?'Ηλικία':'Age',age==null?'—':String(age)],[language==='el'?'Φύλο':'Sex',patient?.sex?t(patient.sex):'—'],[language==='el'?'Τρέχον τμήμα':'Current department',patient?.department||'—'],[language==='el'?'Κατάσταση':'Status',t(patient?.status||'active')],[language==='el'?'Αρχική εισαγωγή':'Initial admission',fmtDate(patient?.admissionDate)],[language==='el'?'Αρχικό εξιτήριο':'Initial discharge',fmtDate(patient?.dischargeDate)],[language==='el'?'Σημειώσεις':'Notes',patient?.notes||'—']]"
new="const identity=[[language==='el'?'Κωδικός ασθενούς':'Patient code',patient?.id],[language==='el'?'Αριθμός φακέλου':'Hospital record number',patient?.hospitalRecordNumber],[language==='el'?'Επώνυμο':'Last name',patient?.lastName],[language==='el'?'Όνομα':'First name',patient?.firstName],[language==='el'?'Πατρώνυμο':'Father name',patient?.fatherName]];const demographics=[[language==='el'?'Ημερομηνία γέννησης':'Date of birth',fmtDate(patient?.dateOfBirth)],[language==='el'?'Ηλικία':'Age',age==null?'—':String(age)],[language==='el'?'Φύλο':'Sex',patient?.sex?t(patient.sex):'—']];const care=[[language==='el'?'Κατάσταση':'Status',t(patient?.status||'active')],[language==='el'?'Τρέχον τμήμα':'Current department',patient?.department||'—'],[language==='el'?'Αρχική εισαγωγή':'Initial admission',fmtDate(patient?.admissionDate)],[language==='el'?'Αρχικό εξιτήριο':'Initial discharge',fmtDate(patient?.dischargeDate)]];const notes=[[language==='el'?'Σημειώσεις':'Notes',patient?.notes||'—']]"
assert old in s, 'patient details pattern not found'
s=s.replace(old,new,1)
old='<div className="detail-grid patient-detail-grid patient-full-detail-grid">{details.map(([label,value])=><Detail key={label} label={label} value={value}/>)}</div>'
new='<div className="patient-detail-sections"><PatientDetailGroup title={language===\'el\'?\'Ταυτοποίηση\':\'Identification\'} items={identity}/><PatientDetailGroup title={language===\'el\'?\'Δημογραφικά\':\'Demographics\'} items={demographics}/><PatientDetailGroup title={language===\'el\'?\'Νοσηλεία\':\'Care & admission\'} items={care}/><PatientDetailGroup className="patient-notes-group" title={language===\'el\'?\'Σημειώσεις\':\'Notes\'} items={notes} hideItemLabel/></div>'
assert old in s, 'patient details render pattern not found'
s=s.replace(old,new,1)
marker='function CanonicalSummary({patient,admission,record,t,language,fmtDate})'
helper="function PatientDetailGroup({title,items,className='',hideItemLabel=false}){return <section className={`patient-detail-group ${className}`}><h4>{title}</h4><div className=\"detail-grid patient-detail-grid patient-full-detail-grid\">{items.map(([label,value])=><div key={label} className={hideItemLabel?'detail-item patient-note-item':'detail-item'}>{!hideItemLabel&&<span>{label}</span>}<strong>{value||'—'}</strong></div>)}</div></section>}\n"
assert marker in s
s=s.replace(marker,helper+marker,1)
p.write_text(s)

css=Path('src/styles/patient-workspace-polish.css')
css.write_text('''/* Patient workspace hierarchy refinement */
.patient-full-demographics{background:#fff!important}
.patient-detail-sections{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:12px 14px 14px}
.patient-detail-group{min-width:0;border:1px solid #e2eaf0;border-radius:10px;background:#fbfcfd;overflow:hidden}
.patient-detail-group>h4{margin:0;padding:8px 11px;border-bottom:1px solid #e8eef3;background:#f4f8fa;color:#557086;font-size:11px;font-weight:800;letter-spacing:.055em;text-transform:uppercase}
.patient-detail-group .patient-full-detail-grid{grid-template-columns:repeat(2,minmax(0,1fr));border:0!important}
.patient-detail-group .detail-item{min-height:58px;padding:10px 12px;background:#fff;border-color:#edf1f4!important}
.patient-detail-group .detail-item span{color:#7890a2;font-size:10px;font-weight:750}
.patient-detail-group .detail-item strong{color:#17344d;font-size:13px}
.patient-notes-group{grid-column:1/-1}
.patient-notes-group .patient-full-detail-grid{grid-template-columns:1fr}
.patient-note-item{min-height:50px!important}
.patient-record-shell .clinical-panel.full-panel:has(.attachment-field){border:0!important;box-shadow:none!important;background:transparent!important;padding:0!important}
.patient-record-shell .attachment-field-v2{border:0!important;outline:0!important;background:transparent!important;padding:2px 0 0!important}
.patient-record-shell .attachment-heading{padding:8px 0 10px!important;border-bottom:1px solid #e6edf2}
.patient-record-shell .attachment-list{margin-top:8px}
.patient-record-shell .attachment-row-v2{border:1px solid #e4ebf0!important;border-radius:9px!important;background:#fff!important;margin-bottom:7px}
.unified-surveillance-workspace .surveillance-tree-episode{background:#eef7fc!important;border-left:3px solid #3195c9!important}
.unified-surveillance-workspace .surveillance-tree-group>.surveillance-sample-row{background:#fff!important}
.unified-surveillance-workspace .surveillance-independent-samples{margin-top:6px!important;border-top:2px solid #cbd8e1!important;padding-top:0!important}
@media(max-width:900px){.patient-detail-sections{grid-template-columns:1fr}.patient-notes-group{grid-column:auto}.patient-detail-group .patient-full-detail-grid{grid-template-columns:1fr}}
''')

main=Path('src/main.jsx')
m=main.read_text()
imp="import './styles/patient-workspace-polish.css'\n"
if imp not in m:
    anchor="import './styles/surveillance-flow-polish.css'\n"
    assert anchor in m, 'main css anchor missing'
    m=m.replace(anchor,anchor+imp)
main.write_text(m)
