from pathlib import Path
p=Path('src/features/surveillance/PatientClinicalCanonicalPage.jsx')
s=p.read_text()
# Human-readable clinical values everywhere in the journey.
s=s.replace("function TagList({items=[]}){return <div className=\"tag-list\">{items.map(x=><span key={x}>{x}</span>)}</div>}","function TagList({items=[],language='el'}){return <div className=\"tag-list\">{items.map(x=><span key={x}>{clinicalTerm(x,language)}</span>)}</div>}")
s=s.replace("<TagList items={record.assessment?.symptoms||[]}/>","<TagList items={record.assessment?.symptoms||[]} language={language}/>")
s=s.replace("<TagList items={record.assessment?.riskFactors||[]}/>","<TagList items={record.assessment?.riskFactors||[]} language={language}/>")
s=s.replace("<span>classification</span><strong>{record.assessment?.classification||'—'}</strong>","<span>{language==='el'?'Κλινική ταξινόμηση':'Clinical classification'}</span><strong>{clinicalTerm(record.assessment?.classification,language)}</strong>")
s=s.replace("<span>{language==='el'?'Ταξινόμηση':'Classification'}</span><strong>{record.assessment?.classification||'—'}</strong>","<span>{language==='el'?'Κλινική ταξινόμηση':'Clinical classification'}</span><strong>{clinicalTerm(record.assessment?.classification,language)}</strong>")
# Action labels: visually and linguistically consistent.
s=s.replace("<Button onClick={()=>setSampleOpen(true)}>+ {language==='el'?'Νέο δείγμα':'New sample'}</Button>","<Button className=\"clinical-primary-action\" onClick={()=>setSampleOpen(true)}><Microscope size={15}/> {language==='el'?'Καταχώριση νέου δείγματος':'Record new sample'}</Button>")
s=s.replace("<Button onClick={onCreate}>+ {language==='el'?'Νέα επιτήρηση':'New surveillance'}</Button>","<Button className=\"clinical-primary-action\" onClick={onCreate}><PlayCircle size={15}/> {language==='el'?'Έναρξη νέας επιτήρησης':'Start new surveillance'}</Button>")
s=s.replace(">{language==='el'?'Επεξεργασία αξιολόγησης':'Edit assessment'}</Button>","><Activity size={15}/> {language==='el'?'Επεξεργασία κλινικής αξιολόγησης':'Edit clinical assessment'}</Button>")
# Report gets patient/admission context from current record and opens a dedicated printable document.
s=s.replace("onClick:()=>printSurveillanceReport(detailRecord,{language,fmtDate,fmtDateTime,t})", "onClick:()=>printSurveillanceReport(detailRecord,{language,fmtDate,fmtDateTime,t})")
# Insert robust terminology helper before TagList or before first dialog helper.
marker='function TagList('
if 'function clinicalTerm(' not in s and marker in s:
    helper="""function clinicalTerm(value,language='el'){
  if(value==null||value==='')return '—'
  const key=String(value).trim().toUpperCase()
  const el={UNDETERMINED:'Δεν έχει ακόμη καθοριστεί',PENDING:'Εκκρεμεί',POSITIVE:'Θετικό',NEGATIVE:'Αρνητικό',FEVER:'Πυρετός',CHILLS:'Ρίγος',RIGORS:'Έντονο ρίγος',ICU_STAY:'Νοσηλεία σε ΜΕΘ',ICU:'Νοσηλεία σε ΜΕΘ',DEVICE:'Παρουσία επεμβατικής συσκευής',RECENT_SURGERY:'Πρόσφατη χειρουργική επέμβαση',IMMUNOSUPPRESSION:'Ανοσοκαταστολή',ANTIBIOTIC_EXPOSURE:'Πρόσφατη έκθεση σε αντιμικροβιακά',YES:'Ναι',NO:'Όχι',Y:'Ναι',N:'Όχι',P:'Θετικό',R:'Ανθεκτικό',S:'Ευαίσθητο',I:'Ευαίσθητο με αυξημένη έκθεση'}
  const en={UNDETERMINED:'Not yet determined',PENDING:'Pending',POSITIVE:'Positive',NEGATIVE:'Negative',FEVER:'Fever',CHILLS:'Chills',RIGORS:'Rigors',ICU_STAY:'ICU stay',ICU:'ICU stay',DEVICE:'Invasive device present',RECENT_SURGERY:'Recent surgery',IMMUNOSUPPRESSION:'Immunosuppression',ANTIBIOTIC_EXPOSURE:'Recent antimicrobial exposure',YES:'Yes',NO:'No',Y:'Yes',N:'No',P:'Positive',R:'Resistant',S:'Susceptible',I:'Susceptible, increased exposure'}
  return (language==='el'?el:en)[key]||String(value).replaceAll('_',' ').replace(/\\b\\w/g,c=>c.toUpperCase())
}
"""
    s=s.replace(marker,helper+marker,1)
# Replace report implementation wholesale when identifiable.
start=s.find('function printSurveillanceReport(')
if start!=-1:
    end=s.find('\nfunction ',start+10)
    if end==-1:end=len(s)
    report=r'''function printSurveillanceReport(record,{language='el',fmtDate,fmtDateTime}){
  const esc=value=>String(value??'—').replace(/[&<>\"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[ch]))
  const L=(el,en)=>language==='el'?el:en
  const rows=(items,empty='—')=>items?.length?items.map(x=>`<li>${esc(x)}</li>`).join(''):`<li>${empty}</li>`
  const samples=(record.samples||[]).map(s=>`<tr><td>${esc(fmtDate(s.collectedAt||s.requestedAt))}</td><td>${esc(s.type||s.sampleType)}</td><td>${esc(s.sampleCode||s.id)}</td><td>${esc(clinicalTerm(s.result,language))}</td><td>${esc(s.organism)}</td><td>${esc(s.resistance||s.amr)}</td></tr>`).join('')
  const therapy=(record.therapy||[]).map(x=>`<tr><td>${esc(x.antimicrobial||x.drug)}</td><td>${esc(x.dose)}</td><td>${esc(x.route)}</td><td>${esc(fmtDate(x.startedAt||x.startDate))}</td><td>${esc(fmtDate(x.endedAt||x.endDate))}</td></tr>`).join('')
  const timeline=(record.timeline||[]).slice().sort((a,b)=>new Date(a.at||a.createdAt)-new Date(b.at||b.createdAt)).map(x=>`<tr><td>${esc(fmtDateTime(x.at||x.createdAt))}</td><td>${esc(x.label||x.type)}</td><td>${esc(clinicalTerm(x.value||x.detail||x.notes,language))}</td></tr>`).join('')
  const html=`<!doctype html><html><head><meta charset="utf-8"><title>${L('Αναφορά επιτήρησης','Surveillance report')}</title><style>@page{size:A4;margin:14mm}body{font:12px Arial,sans-serif;color:#17324a}h1{font-size:21px;margin:0 0 4px}h2{font-size:14px;border-bottom:1px solid #cbd8e3;padding-bottom:5px;margin:20px 0 8px}.muted{color:#687b8d}.grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 18px}.field{padding:6px 0;border-bottom:1px solid #edf1f4}.field b{display:block;font-size:10px;color:#687b8d;text-transform:uppercase;margin-bottom:2px}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:6px;border-bottom:1px solid #dfe7ed;vertical-align:top}th{font-size:10px;color:#607487;background:#f5f8fa}ul{margin:5px 0;padding-left:18px}.footer{margin-top:24px;padding-top:8px;border-top:1px solid #cbd8e3;color:#687b8d;font-size:10px}@media print{button{display:none}}</style></head><body><h1>${L('Αναλυτική αναφορά επιτήρησης','Detailed surveillance report')}</h1><div class="muted">${L('Limoxis Observer · Κλινική επιτήρηση','Limoxis Observer · Clinical surveillance')}</div><h2>${L('Στοιχεία επεισοδίου','Episode details')}</h2><div class="grid"><div class="field"><b>${L('Ασθενής','Patient')}</b>${esc(record.patient||record.patientName)}</div><div class="field"><b>${L('Κωδικός ασθενούς','Patient code')}</b>${esc(record.patientId)}</div><div class="field"><b>${L('Τμήμα','Department')}</b>${esc(record.department)}</div><div class="field"><b>${L('Έναρξη επιτήρησης','Surveillance start')}</b>${esc(fmtDate(record.startedAt))}</div><div class="field"><b>${L('Κατάσταση','Status')}</b>${esc(clinicalTerm(record.status,language))}</div><div class="field"><b>${L('Λόγος επιτήρησης','Surveillance reason')}</b>${esc(record.reason)}</div></div><h2>${L('Κλινική αξιολόγηση','Clinical assessment')}</h2><div class="grid"><div class="field"><b>${L('Ημερομηνία αξιολόγησης','Assessment date')}</b>${esc(fmtDate(record.assessment?.date))}</div><div class="field"><b>${L('Κλινική ταξινόμηση','Clinical classification')}</b>${esc(clinicalTerm(record.assessment?.classification,language))}</div></div><b>${L('Σημεία / συμπτώματα','Signs / symptoms')}</b><ul>${rows((record.assessment?.symptoms||[]).map(x=>clinicalTerm(x,language)))}</ul><b>${L('Παράγοντες κινδύνου','Risk factors')}</b><ul>${rows((record.assessment?.riskFactors||[]).map(x=>clinicalTerm(x,language)))}</ul><h2>${L('Μικροβιολογικά δείγματα','Microbiology samples')}</h2><table><thead><tr><th>${L('Ημερομηνία','Date')}</th><th>${L('Τύπος','Type')}</th><th>${L('Κωδικός','Code')}</th><th>${L('Αποτέλεσμα','Result')}</th><th>${L('Μικροοργανισμός','Organism')}</th><th>AMR</th></tr></thead><tbody>${samples||`<tr><td colspan="6">${L('Δεν υπάρχουν καταχωρισμένα δείγματα.','No samples recorded.')}</td></tr>`}</tbody></table><h2>${L('Απομόνωση','Isolation')}</h2><div class="grid"><div class="field"><b>${L('Κατάσταση','Status')}</b>${esc(record.isolation?clinicalTerm(record.isolation.status||'yes',language):L('Δεν απαιτείται / δεν έχει καταχωριστεί','Not required / not recorded'))}</div><div class="field"><b>${L('Έναρξη','Start')}</b>${esc(fmtDate(record.isolation?.startedAt))}</div></div><h2>${L('Αντιμικροβιακή αγωγή','Antimicrobial therapy')}</h2><table><thead><tr><th>${L('Φάρμακο','Drug')}</th><th>${L('Δόση','Dose')}</th><th>${L('Οδός','Route')}</th><th>${L('Έναρξη','Start')}</th><th>${L('Λήξη','End')}</th></tr></thead><tbody>${therapy||`<tr><td colspan="5">${L('Δεν έχει καταχωριστεί αγωγή.','No therapy recorded.')}</td></tr>`}</tbody></table><h2>${L('Χρονολογικό ιστορικό','Chronological history')}</h2><table><thead><tr><th>${L('Ημερομηνία / ώρα','Date / time')}</th><th>${L('Ενέργεια','Action')}</th><th>${L('Λεπτομέρειες','Details')}</th></tr></thead><tbody>${timeline||`<tr><td colspan="3">${L('Δεν υπάρχουν συμβάντα.','No events recorded.')}</td></tr>`}</tbody></table><div class="footer">${L('Η αναφορά δημιουργήθηκε από το Limoxis Observer.','Report generated by Limoxis Observer.')} · ${esc(new Date().toLocaleString(language==='el'?'el-GR':'en-GB'))}</div><script>window.onload=()=>setTimeout(()=>window.print(),150)<\/script></body></html>`
  const win=window.open('','_blank','noopener,noreferrer')
  if(!win)return
  win.document.open();win.document.write(html);win.document.close()
}
'''
    s=s[:start]+report+s[end:]
p.write_text(s)

css=Path('src/styles/patient-record.css')
c=css.read_text()
addon='''\n/* Clinical action hierarchy: creation/edit actions must read as intentional actions. */\n.patient-record-shell .clinical-primary-action,\n.patient-record-shell .surveillance-workspace-toolbar .btn-primary{display:inline-flex!important;align-items:center!important;gap:7px!important;min-height:36px!important;padding:8px 13px!important;border-radius:9px!important;font-weight:750!important;box-shadow:0 1px 2px rgba(17,73,112,.12)!important}\n.patient-record-shell .clinical-panel .record-section-header .btn{display:inline-flex!important;align-items:center!important;gap:7px!important;min-height:34px!important;padding:7px 12px!important;border-radius:9px!important;font-weight:700!important}\n.patient-record-shell .tag-list span{font-size:12px!important;font-weight:650!important;letter-spacing:0!important;text-transform:none!important}\n'''
if 'Clinical action hierarchy' not in c:c+=addon
css.write_text(c)
