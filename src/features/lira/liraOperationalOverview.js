const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
const departmentOf=row=>row?.department||row?.departmentEl||row?.departmentEn||'—'
const scoped=(rows,department)=>(rows||[]).filter(row=>department==='all'||departmentOf(row)===department)
const weightedHand=rows=>{let n=0,c=0;for(const row of rows){const obs=Number(row.observations)||0;n+=obs;c+=obs*(Number(row.rate)||0)/100}return n?Math.round(c/n*100):null}
const bundleRate=rows=>rows.length?Math.round(rows.filter(row=>row.allOrNone).length/rows.length*100):null
const openStatus=value=>!['closed','completed','cancelled','resolved'].includes(normalize(value))
const overdue=(value,today)=>value&&String(value).slice(0,10)<today

export function buildOperationalOverview(data,{department='all',today=new Date().toISOString().slice(0,10),language='el'}={}){
 const en=language==='en';const surveillance=scoped(data?.surveillance,department);const laboratory=scoped(data?.laboratory,department);const handRows=scoped(data?.handHygiene,department);const bundleRows=scoped(data?.bundles,department);const incidents=scoped(data?.qualityIncidents,department);const capas=scoped(data?.qualityCapas,department)
 const active=surveillance.filter(row=>row.state==='active').length
 const overdueReviews=surveillance.filter(row=>row.reviewDue&&overdue(row.reviewDue,today)).length
 const criticalUncommunicated=laboratory.filter(row=>row.critical&&!(row.communications||[]).length).length
 const amr=laboratory.filter(row=>Boolean(row.resistance)).length
 const hand=weightedHand(handRows);const bundles=bundleRate(bundleRows)
 const seriousIncidents=incidents.filter(row=>openStatus(row.status)&&['high','critical','major','severe'].includes(normalize(row.severity))).length
 const overdueCapas=capas.filter(row=>openStatus(row.status)&&overdue(row.dueDate,today)).length
 const signals=[]
 const add=(priority,domain,title,detail)=>signals.push({priority,domain,title,detail})
 if(criticalUncommunicated)add(100,'laboratory',en?'Critical laboratory communication':'Γνωστοποίηση κρίσιμων εργαστηριακών',en?`${criticalUncommunicated} critical result(s) have no documented communication.`:`${criticalUncommunicated} κρίσιμα αποτελέσματα δεν έχουν τεκμηριωμένη γνωστοποίηση.`)
 if(overdueReviews)add(90,'surveillance',en?'Overdue surveillance review':'Εκπρόθεσμη επανεκτίμηση επιτήρησης',en?`${overdueReviews} active record(s) require overdue review.`:`${overdueReviews} ενεργές εγγραφές χρειάζονται εκπρόθεσμη επανεκτίμηση.`)
 if(seriousIncidents)add(85,'quality',en?'Serious open quality incidents':'Σοβαρά ανοικτά συμβάντα ποιότητας',en?`${seriousIncidents} serious incident(s) remain open.`:`${seriousIncidents} σοβαρά συμβάντα παραμένουν ανοικτά.`)
 if(overdueCapas)add(80,'quality',en?'Overdue CAPA':'Εκπρόθεσμες CAPA',en?`${overdueCapas} corrective/preventive action(s) are overdue.`:`${overdueCapas} διορθωτικές/προληπτικές ενέργειες είναι εκπρόθεσμες.`)
 if(hand!=null&&hand<70)add(75,'prevention',en?'Low hand-hygiene compliance':'Χαμηλή συμμόρφωση υγιεινής χεριών',`${hand}%`)
 if(bundles!=null&&bundles<80)add(70,'prevention',en?'Low bundle all-or-none compliance':'Χαμηλή bundle all-or-none συμμόρφωση',`${bundles}%`)
 if(amr)add(65,'amr','AMR / MDR-XDR',en?`${amr} resistance-flagged microbiology result(s).`:`${amr} μικροβιολογικά αποτελέσματα με σήμανση ανθεκτικότητας.`)
 if(active)add(40,'surveillance',en?'Active surveillance':'Ενεργή επιτήρηση',en?`${active} active surveillance record(s).`:`${active} ενεργές εγγραφές επιτήρησης.`)
 signals.sort((a,b)=>b.priority-a.priority)
 const scope=department==='all'?(en?'hospital-wide':'σε επίπεδο νοσοκομείου'):department
 const points=signals.slice(0,8).map((signal,index)=>`${index+1}. ${signal.title}: ${signal.detail}`)
 if(!points.length)points.push(en?'No high-priority operational signal emerged from the currently authorized records.':'Δεν προέκυψε σήμα υψηλής προτεραιότητας από τις διαθέσιμες εξουσιοδοτημένες εγγραφές.')
 points.push(en?'Priority reflects operational urgency and data signals, not an autonomous clinical risk score.':'Η προτεραιοποίηση αποτυπώνει λειτουργική επείγουσα ανάγκη και σήματα δεδομένων, όχι αυτόνομο κλινικό risk score.')
 return {title:en?'What needs attention?':'Τι χρειάζεται προσοχή;',subtitle:en?`Cross-domain operational view ${scope}.`:`Διατομεακή λειτουργική εικόνα ${scope}.`,points,signals,metrics:{active,overdueReviews,criticalUncommunicated,amr,handHygiene:hand,bundleCompliance:bundles,seriousIncidents,overdueCapas}}
}
