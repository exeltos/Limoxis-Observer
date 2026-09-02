import { calculateHaiRate,HAI_DEVICE_RULES } from './liraHaiMetrics'

const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
const dateOf=row=>new Date(row?.signalDate||row?.date||row?.resultedAt||row?.classifiedAt||0)
const inWindow=(row,window)=>{if(!window)return true;const date=dateOf(row);return Number.isFinite(date.getTime())&&date>=new Date(`${window.start}T00:00:00Z`)&&date<=new Date(`${window.end}T23:59:59Z`)}
const departmentOf=row=>row?.department||row?.departmentEl||row?.departmentEn||'—'
const scoped=(rows,department,window)=>(rows||[]).filter(row=>(department==='all'||departmentOf(row)===department)&&inWindow(row,window))
const weightedHand=rows=>{let observations=0,compliant=0;for(const row of rows){const n=Number(row.observations)||0;observations+=n;compliant+=n*(Number(row.rate)||0)/100}return observations?Math.round(compliant/observations*100):null}
const bundleRate=rows=>rows.length?Math.round(rows.filter(row=>row.allOrNone).length/rows.length*100):null

export function analyzeHaiContext(data,type,{department='all',window=null,today=new Date().toISOString().slice(0,10),language='el'}={}){
 const en=language==='en';const hai=calculateHaiRate(data,type,{department,window,today});if(!hai)return null
 const hand=weightedHand(scoped(data?.handHygiene,department,window));const bundle=bundleRate(scoped(data?.bundles,department,window));const lab=scoped(data?.laboratory,department,window);const amr=lab.filter(row=>Boolean(row.resistance)).length;const positive=lab.filter(row=>normalize(row.result)==='positive').length
 const points=[]
 points.push(hai.normalized?`${type.toUpperCase()}: ${hai.rate}${hai.unit} (${hai.events}/${hai.deviceDays}).`:(en?`${type.toUpperCase()}: ${hai.events} eligible HAI records; device-days unavailable.`:`${type.toUpperCase()}: ${hai.events} επιλέξιμες HAI εγγραφές· δεν υπάρχουν διαθέσιμα device-days.`))
 if(hand!=null)points.push(en?`Hand-hygiene compliance in the same scope: ${hand}%.`:`Συμμόρφωση υγιεινής χεριών στο ίδιο πλαίσιο: ${hand}%.`)
 if(bundle!=null)points.push(en?`Bundle all-or-none compliance in the same scope: ${bundle}%.`:`Bundle all-or-none συμμόρφωση στο ίδιο πλαίσιο: ${bundle}%.`)
 if(positive||amr)points.push(en?`Microbiology in the same scope: ${positive} positive results, ${amr} resistance-flagged.`:`Μικροβιολογία στο ίδιο πλαίσιο: ${positive} θετικά αποτελέσματα, ${amr} με σήμανση ανθεκτικότητας.`)
 points.push(en?'These are concurrent signals, not proof of causation. Review case validation, device exposure, bundle elements, hand hygiene and microbiology together before attributing a cause.':'Πρόκειται για ταυτόχρονα σήματα και όχι για απόδειξη αιτιότητας. Απαιτείται συνδυαστική αξιολόγηση επικύρωσης περιστατικών, έκθεσης σε συσκευές, στοιχείων bundle, υγιεινής χεριών και μικροβιολογίας πριν αποδοθεί αιτία.')
 return {title:en?`Why might ${type.toUpperCase()} have changed?`:`Διερεύνηση μεταβολής ${type.toUpperCase()}`,subtitle:en?`Structured epidemiological context using authorized Limoxis records.`:`Δομημένο επιδημιολογικό πλαίσιο από εξουσιοδοτημένες εγγραφές Limoxis.`,points,metrics:{hai,handHygiene:hand,bundleCompliance:bundle,positiveMicrobiology:positive,amr}}
}

export function compareHaiContext(data,type,current,reference,{department='all',today=new Date().toISOString().slice(0,10),language='el'}={}){
 const en=language==='en';const a=analyzeHaiContext(data,type,{department,window:current,today,language});const b=analyzeHaiContext(data,type,{department,window:reference,today,language});const rule=HAI_DEVICE_RULES[type];const points=[]
 if(a.metrics.hai.rate!=null&&b.metrics.hai.rate!=null)points.push(`${type.toUpperCase()}: ${current.label} ${a.metrics.hai.rate} vs ${reference.label} ${b.metrics.hai.rate} / 1,000 ${rule.denominator}.`)
 else points.push(en?'Comparable device-associated incidence rates are not available for both periods.':'Δεν υπάρχουν συγκρίσιμοι device-associated δείκτες και για τις δύο περιόδους.')
 if(a.metrics.handHygiene!=null||b.metrics.handHygiene!=null)points.push(en?`Hand hygiene: ${current.label} ${a.metrics.handHygiene??'—'}% vs ${reference.label} ${b.metrics.handHygiene??'—'}%.`:`Υγιεινή χεριών: ${current.label} ${a.metrics.handHygiene??'—'}% έναντι ${reference.label} ${b.metrics.handHygiene??'—'}%.`)
 if(a.metrics.bundleCompliance!=null||b.metrics.bundleCompliance!=null)points.push(`Bundle all-or-none: ${current.label} ${a.metrics.bundleCompliance??'—'}% vs ${reference.label} ${b.metrics.bundleCompliance??'—'}%.`)
 points.push(en?`Microbiology/AMR: ${current.label} ${a.metrics.positiveMicrobiology}/${a.metrics.amr} vs ${reference.label} ${b.metrics.positiveMicrobiology}/${b.metrics.amr} (positive/resistance-flagged).`:`Μικροβιολογία/AMR: ${current.label} ${a.metrics.positiveMicrobiology}/${a.metrics.amr} έναντι ${reference.label} ${b.metrics.positiveMicrobiology}/${b.metrics.amr} (θετικά/με ανθεκτικότητα).`)
 points.push(en?'Changes occurring together may justify targeted epidemiological review, but LIRA does not infer that one signal caused another.':'Παράλληλες μεταβολές μπορούν να δικαιολογούν στοχευμένη επιδημιολογική διερεύνηση, αλλά η LIRA δεν συμπεραίνει ότι ένα σήμα προκάλεσε κάποιο άλλο.')
 return {title:en?`${type.toUpperCase()} contextual comparison`:`Συσχετιστική διερεύνηση ${type.toUpperCase()}`,subtitle:en?'HAI rate, device exposure, prevention compliance and microbiology are reviewed together.':'HAI δείκτης, έκθεση σε συσκευές, συμμόρφωση πρόληψης και μικροβιολογία αξιολογούνται μαζί.',points}
}
