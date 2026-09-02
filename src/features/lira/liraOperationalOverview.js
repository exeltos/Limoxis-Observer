const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
const departmentOf=row=>row?.department||row?.departmentEl||row?.departmentEn||'—'
const rowDate=row=>row?.signalDate||row?.resultedAt||row?.collectedAt||row?.date||row?.startedAt||row?.dueDate||null
const scoped=(rows,department)=>(rows||[]).filter(row=>department==='all'||departmentOf(row)===department)
const inWindow=(row,window)=>{if(!window)return true;const value=rowDate(row);if(!value)return false;const date=String(value).slice(0,10);return date>=window.start&&date<=window.end}
const windowed=(rows,department,window)=>scoped(rows,department).filter(row=>inWindow(row,window))
const weightedHand=rows=>{let n=0,c=0;for(const row of rows){const obs=Number(row.observations)||0;n+=obs;c+=obs*(Number(row.rate)||0)/100}return n?Math.round(c/n*100):null}
const bundleRate=rows=>rows.length?Math.round(rows.filter(row=>row.allOrNone).length/rows.length*100):null
const openStatus=value=>!['closed','completed','cancelled','resolved'].includes(normalize(value))
const overdue=(value,today)=>value&&String(value).slice(0,10)<today
const fmt=value=>Number.isInteger(value)?String(value):Number(value).toFixed(1).replace(/\.0$/,'')

function operationalMetrics(data,{department='all',window=null,today}){
 const surveillance=windowed(data?.surveillance,department,window);const laboratory=windowed(data?.laboratory,department,window);const handRows=windowed(data?.handHygiene,department,window);const bundleRows=windowed(data?.bundles,department,window);const incidents=windowed(data?.qualityIncidents,department,window);const capas=windowed(data?.qualityCapas,department,window)
 return {active:surveillance.filter(row=>row.state==='active').length,overdueReviews:surveillance.filter(row=>row.reviewDue&&overdue(row.reviewDue,today)).length,criticalUncommunicated:laboratory.filter(row=>row.critical&&!(row.communications||[]).length).length,amr:laboratory.filter(row=>Boolean(row.resistance)).length,handHygiene:weightedHand(handRows),bundleCompliance:bundleRate(bundleRows),seriousIncidents:incidents.filter(row=>openStatus(row.status)&&['high','critical','major','severe'].includes(normalize(row.severity))).length,overdueCapas:capas.filter(row=>openStatus(row.status)&&overdue(row.dueDate,today)).length}
}

export function buildOperationalOverview(data,{department='all',today=new Date().toISOString().slice(0,10),language='el'}={}){
 const en=language==='en';const metrics=operationalMetrics(data,{department,today});const {active,overdueReviews,criticalUncommunicated,amr,handHygiene:hand,bundleCompliance:bundles,seriousIncidents,overdueCapas}=metrics
 const signals=[];const add=(priority,domain,title,detail)=>signals.push({priority,domain,title,detail})
 if(criticalUncommunicated)add(100,'laboratory',en?'Critical laboratory communication':'Γνωστοποίηση κρίσιμων εργαστηριακών',en?`${criticalUncommunicated} critical result(s) have no documented communication.`:`${criticalUncommunicated} κρίσιμα αποτελέσματα δεν έχουν τεκμηριωμένη γνωστοποίηση.`)
 if(overdueReviews)add(90,'surveillance',en?'Overdue surveillance review':'Εκπρόθεσμη επανεκτίμηση επιτήρησης',en?`${overdueReviews} active record(s) require overdue review.`:`${overdueReviews} ενεργές εγγραφές χρειάζονται εκπρόθεσμη επανεκτίμηση.`)
 if(seriousIncidents)add(85,'quality',en?'Serious open quality incidents':'Σοβαρά ανοικτά συμβάντα ποιότητας',en?`${seriousIncidents} serious incident(s) remain open.`:`${seriousIncidents} σοβαρά συμβάντα παραμένουν ανοικτά.`)
 if(overdueCapas)add(80,'quality',en?'Overdue CAPA':'Εκπρόθεσμες CAPA',en?`${overdueCapas} corrective/preventive action(s) are overdue.`:`${overdueCapas} διορθωτικές/προληπτικές ενέργειες είναι εκπρόθεσμες.`)
 if(hand!=null&&hand<70)add(75,'prevention',en?'Low hand-hygiene compliance':'Χαμηλή συμμόρφωση υγιεινής χεριών',`${hand}%`)
 if(bundles!=null&&bundles<80)add(70,'prevention',en?'Low bundle all-or-none compliance':'Χαμηλή bundle all-or-none συμμόρφωση',`${bundles}%`)
 if(amr)add(65,'amr','AMR / MDR-XDR',en?`${amr} resistance-flagged microbiology result(s).`:`${amr} μικροβιολογικά αποτελέσματα με σήμανση ανθεκτικότητας.`)
 if(active)add(40,'surveillance',en?'Active surveillance':'Ενεργή επιτήρηση',en?`${active} active surveillance record(s).`:`${active} ενεργές εγγραφές επιτήρησης.`)
 signals.sort((a,b)=>b.priority-a.priority);const scope=department==='all'?(en?'hospital-wide':'σε επίπεδο νοσοκομείου'):department;const points=signals.slice(0,8).map((signal,index)=>`${index+1}. ${signal.title}: ${signal.detail}`)
 if(!points.length)points.push(en?'No high-priority operational signal emerged from the currently authorized records.':'Δεν προέκυψε σήμα υψηλής προτεραιότητας από τις διαθέσιμες εξουσιοδοτημένες εγγραφές.')
 points.push(en?'Priority reflects operational urgency and data signals, not an autonomous clinical risk score.':'Η προτεραιοποίηση αποτυπώνει λειτουργική επείγουσα ανάγκη και σήματα δεδομένων, όχι αυτόνομο κλινικό risk score.')
 return {title:en?'What needs attention?':'Τι χρειάζεται προσοχή;',subtitle:en?`Cross-domain operational view ${scope}.`:`Διατομεακή λειτουργική εικόνα ${scope}.`,points,signals,metrics}
}

export function compareOperationalOverview(data,spec,{department='all',today=new Date().toISOString().slice(0,10),language='el'}={}){
 const en=language==='en';const current=operationalMetrics(data,{department,window:spec.current,today});const reference=operationalMetrics(data,{department,window:spec.reference,today})
 const definitions=[['criticalUncommunicated',en?'critical results without documented communication':'κρίσιμα αποτελέσματα χωρίς τεκμηριωμένη γνωστοποίηση','higher'],['overdueReviews',en?'overdue surveillance reviews':'εκπρόθεσμες επανεκτιμήσεις επιτήρησης','higher'],['seriousIncidents',en?'serious open quality incidents':'σοβαρά ανοικτά συμβάντα ποιότητας','higher'],['overdueCapas',en?'overdue CAPA':'εκπρόθεσμες CAPA','higher'],['amr','AMR / MDR-XDR','higher'],['handHygiene',en?'hand-hygiene compliance':'συμμόρφωση υγιεινής χεριών','lower'],['bundleCompliance',en?'bundle all-or-none compliance':'bundle all-or-none συμμόρφωση','lower']]
 const changes=[]
 for(const [key,label,worse] of definitions){const a=current[key],b=reference[key];if(a==null||b==null||a===b)continue;const delta=a-b;const worsened=worse==='higher'?delta>0:delta<0;changes.push({key,label,current:a,reference:b,delta,worsened,weight:Math.abs(delta)+(worsened?100:0)})}
 changes.sort((a,b)=>b.weight-a.weight);const points=changes.map(change=>{const unit=['handHygiene','bundleCompliance'].includes(change.key)?'%':'';const direction=change.worsened?(en?'worsened':'επιδεινώθηκε'):(en?'improved':'βελτιώθηκε');return `${change.label}: ${fmt(change.reference)}${unit} → ${fmt(change.current)}${unit} · ${direction}.`})
 if(!points.length)points.push(en?'No material cross-domain change was identified between the matched periods from the available records.':'Δεν εντοπίστηκε ουσιώδης διατομεακή μεταβολή μεταξύ των αντίστοιχων περιόδων από τις διαθέσιμες εγγραφές.')
 const worsened=changes.filter(x=>x.worsened).length;const improved=changes.filter(x=>!x.worsened).length;points.push(en?`${worsened} domain signal(s) worsened and ${improved} improved or decreased. Interpret these as descriptive operational signals, not proof of causality.`:`${worsened} διατομεακά σήματα επιδεινώθηκαν και ${improved} βελτιώθηκαν ή μειώθηκαν. Η εικόνα είναι περιγραφική και δεν αποδεικνύει αιτιότητα.`)
 return {title:en?'What changed?':'Τι άλλαξε;',subtitle:en?`${spec.current.label} versus ${spec.reference.label} across infection prevention and quality signals.`:`${spec.current.label} έναντι ${spec.reference.label} σε σήματα λοιμώξεων, πρόληψης και ποιότητας.`,points,changes,current,reference}
}

export function explainOperationalChange(data,spec,{department='all',today=new Date().toISOString().slice(0,10),language='el'}={}){
 const en=language==='en';const comparison=compareOperationalOverview(data,spec,{department,today,language});const worse=comparison.changes.filter(change=>change.worsened).slice(0,4);const better=comparison.changes.filter(change=>!change.worsened).slice(0,2);const points=[]
 if(worse.length){points.push(en?'The strongest concurrent deterioration signals are:':'Τα ισχυρότερα παράλληλα σήματα επιδείνωσης είναι:');for(const change of worse){const unit=['handHygiene','bundleCompliance'].includes(change.key)?'%':'';points.push(`${change.label}: ${fmt(change.reference)}${unit} → ${fmt(change.current)}${unit}.`)}}
 else points.push(en?'The available matched-period records do not show a clear cross-domain deterioration signal.':'Οι διαθέσιμες εγγραφές των αντίστοιχων περιόδων δεν δείχνουν σαφές διατομεακό σήμα επιδείνωσης.')
 if(better.length)points.push(en?`At the same time, ${better.map(x=>x.label).join(', ')} improved or decreased.`:`Παράλληλα, ${better.map(x=>x.label).join(', ')} βελτιώθηκαν ή μειώθηκαν.`)
 points.push(en?'These observations can guide investigation of timing, cases, device exposure, prevention practices and quality actions. They do not establish that one change caused another.':'Οι παρατηρήσεις αυτές μπορούν να κατευθύνουν τη διερεύνηση χρονισμού, περιστατικών, έκθεσης σε συσκευές, πρακτικών πρόληψης και ενεργειών ποιότητας. Δεν τεκμηριώνουν ότι μία μεταβολή προκάλεσε κάποια άλλη.')
 return {title:en?'Why might the picture have changed?':'Γιατί μπορεί να άλλαξε η εικόνα;',subtitle:en?`${spec.current.label} versus ${spec.reference.label}: evidence-led investigation context.`:`${spec.current.label} έναντι ${spec.reference.label}: πλαίσιο διερεύνησης με βάση τα διαθέσιμα δεδομένα.`,points,changes:comparison.changes}
}
