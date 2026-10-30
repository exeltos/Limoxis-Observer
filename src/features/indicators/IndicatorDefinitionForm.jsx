import { ManualDateField } from '../../design-system/ManualDateField'
import { MultiSelect } from '../../design-system/MultiSelect'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import { ChoiceField } from '../../design-system/ChoiceField'
import { YesNoField } from '../../design-system/YesNoField'
import { INDICATOR_METRICS,allowedIndicatorDenominators,indicatorMetricCombinationIsValid,indicatorMetricRule } from './indicatorDefinitionService'

const organismLabels={ecoli:['E. coli','E. coli'],proteus:['Proteus spp.','Proteus spp.'],acinetobacter:['Acinetobacter spp.','Acinetobacter spp.'],klebsiella:['Klebsiella spp.','Klebsiella spp.'],enterobacter:['Enterobacter spp.','Enterobacter spp.'],pseudomonas:['Pseudomonas spp.','Pseudomonas spp.'],saureus:['S. aureus','S. aureus'],enterococcus:['Enterococcus spp.','Enterococcus spp.']}
const bacteremiaLabels=Object.fromEntries(Object.entries(organismLabels).map(([key,[el,en]])=>[`bacteremia_${key}`,[`Βακτηριαιμίες από ${el}`,`${en} bacteremia`]]))
const amrLabels=Object.fromEntries(Object.entries(organismLabels).flatMap(([key,[el,en]])=>[[`amr_tested_${key}`,[`Εξετασθέντα στελέχη ${el}`,`${en} isolates tested`]],[`amr_resistant_${key}`,[`Ανθεκτικά στελέχη ${el}`,`${en} resistant isolates`]]]))
const mdrIsolationLabels=Object.fromEntries(Object.entries(organismLabels).map(([key,[el,en]])=>[`mdr_isolation_${key}`,[`Απομονώσεις MDR ${el}`,`MDR ${en} isolations`]]))
const bwLabels={le750:['ΒΓ ≤750g','BW ≤750g'],bw751_1000:['ΒΓ 751-1000g','BW 751-1000g'],bw1001_1500:['ΒΓ 1001-1500g','BW 1001-1500g'],bw1501_2500:['ΒΓ 1501-2500g','BW 1501-2500g'],gt2500:['ΒΓ >2500g','BW >2500g']}
const clabsiByWeightLabels=Object.fromEntries(Object.entries(bwLabels).flatMap(([key,[el,en]])=>[[`clabsi_events_${key}`,[`Συμβάντα CLABSI (${el})`,`CLABSI events (${en})`]],[`central_line_days_${key}`,[`Ημέρες κεντρικού καθετήρα (${el})`,`Central line days (${en})`]]]))
export const metricLabels={patient_days:['Νοσηλευτικές ημέρες','Patient days'],active_surveillance:['Ενεργές επιτηρήσεις','Active surveillance'],resistant_active_surveillance:['Ενεργές επιτηρήσεις με MDR/XDR/PDR','Active surveillance with MDR/XDR/PDR'],hh_compliant_actions:['Συμμορφούμενες ενέργειες υγιεινής χεριών','Compliant hand-hygiene actions'],hh_opportunities:['Ευκαιρίες υγιεινής χεριών','Hand-hygiene opportunities'],bundle_all_or_none_pass:['Δέσμες μέτρων με πλήρη συμμόρφωση','All-or-none bundle passes'],bundle_executions:['Αξιολογήσεις δεσμών μέτρων','Bundle executions'],abhr_litres:['Λίτρα αντισηπτικού','Antiseptic litres'],active_staff:['Ενεργοί εργαζόμενοι','Active staff'],active_staff_with_vaccination:['Εργαζόμενοι με εμβολιασμό','Staff with vaccination'],training_completed:['Ολοκληρωμένες εκπαιδεύσεις','Completed training'],training_assignments:['Αναθέσεις εκπαίδευσης','Training assignments'],open_high_incidents:['Ανοιχτά συμβάντα υψηλής σοβαρότητας','Open high-severity incidents'],mdro_bsi:['MDRO θετικές καλλιέργειες','MDRO positive cultures'],
 ...bacteremiaLabels,bacteremia_total:['Σύνολο βακτηριαιμιών','Total bacteremia'],
 ...amrLabels,
 antibiotic_ddd_total:['Σύνολο DDD αντιβιοτικών','Total antibiotic DDD'],aware_access_ddd_total:['DDD αντιβιοτικών κατηγορίας AWaRe Access','AWaRe Access category antibiotic DDD'],
 ...mdrIsolationLabels,mdr_isolation_total:['Σύνολο απομονώσεων MDR','Total MDR isolations'],
 pps_patients_total:['Σύνολο ασθενών μελέτης επιπολασμού','PPS total patients'],pps_patients_with_hai:['Ασθενείς με νοσοκομειακή λοίμωξη','Patients with healthcare-associated infection'],pps_patients_on_antibiotics:['Ασθενείς υπό αντιβιοτική αγωγή','Patients on antibiotic therapy'],
 clabsi_events:['Συμβάντα CLABSI','CLABSI events'],central_line_days:['Ημέρες κεντρικού καθετήρα','Central line days'],cauti_events:['Συμβάντα CAUTI','CAUTI events'],urinary_catheter_days:['Ημέρες ουροκαθετήρα','Urinary catheter days'],vap_events:['Συμβάντα VAP','VAP events'],ventilator_days:['Ημέρες αναπνευστήρα','Ventilator days'],
 ...clabsiByWeightLabels,
}
const CATEGORY_OPTIONS=[['surveillance','Επιτήρηση','Surveillance'],['prevention','Πρόληψη','Prevention'],['laboratory','Εργαστήριο','Laboratory'],['workforce','Προσωπικό','Workforce'],['quality','Ποιότητα','Quality']]
export const indicatorMetricLabel=(key,language='el')=>metricLabels[key]?.[language==='en'?1:0]||key

export const createEmptyIndicatorDefinition=()=>({id:null,system:false,key:'',version:'1.0',titleEl:'',category:'surveillance',calculationType:'auto',numeratorMetric:'',denominatorMetric:'',numeratorDefinition:{description:''},denominatorDefinition:{description:''},multiplier:1,unit:'',targetValue:'',direction:'context',sourceAuthority:'',effectiveFrom:new Date().toISOString().slice(0,10),effectiveTo:'',status:'draft',visibleDepartmentIds:[]})

export function indicatorDefinitionIsValid(v){return Boolean(v?.key?.trim()&&v?.titleEl?.trim()&&v?.version?.trim()&&(v.calculationType!=='auto'||(v?.numeratorMetric?.trim()&&indicatorMetricCombinationIsValid(v.numeratorMetric,v.denominatorMetric||'')))&&(!v?.effectiveFrom||!v?.effectiveTo||v.effectiveTo>=v.effectiveFrom))}

export function IndicatorDefinitionForm({value,onChange,language='el',readOnly=false,showSystem=false,lockKey=false,hideKey=false,departments=[]}){
 const el=language==='el',v=value||createEmptyIndicatorDefinition(),set=(key,next)=>onChange({...v,[key]:next}),automatic=v.calculationType==='auto'
 const visibleDepartmentIds=v.visibleDepartmentIds||[]
 const denominatorOptions=automatic?allowedIndicatorDenominators(v.numeratorMetric):[]
 const ratioRule=automatic&&v.denominatorMetric?indicatorMetricRule(v.numeratorMetric):null
 const ratioLocked=Boolean(ratioRule&&ratioRule.denominator===v.denominatorMetric)
 const fromMetric=el?'Ορίζεται από τη μετρική':'Set by the metric'
 const combinationValid=!automatic||!v.numeratorMetric||indicatorMetricCombinationIsValid(v.numeratorMetric,v.denominatorMetric||'')
 const setNumerator=next=>{
  const allowed=allowedIndicatorDenominators(next)
  const denominator=allowed.includes(v.denominatorMetric)?v.denominatorMetric:''
  onChange({...v,numeratorMetric:next,denominatorMetric:denominator,multiplier:denominator?indicatorMetricRule(next)?.multiplier??v.multiplier:v.multiplier,unit:denominator?indicatorMetricRule(next)?.unit??v.unit:v.unit})
 }
 const setDenominator=next=>{
  const rule=indicatorMetricRule(v.numeratorMetric)
  onChange({...v,denominatorMetric:next,multiplier:next&&rule?.denominator===next?rule.multiplier:v.multiplier,unit:next&&rule?.denominator===next?rule.unit:v.unit})
 }
 return <div className="entry-grid">
  <label className="entry-span-2"><span>{el?'Τίτλος *':'Title *'}</span><input autoFocus value={v.titleEl||''} disabled={readOnly} onChange={e=>set('titleEl',e.target.value)}/></label>
  {!hideKey&&<label><span>{el?'Κωδικός δείκτη *':'Indicator key *'}</span><input value={v.key||''} disabled={readOnly||lockKey} onChange={e=>set('key',e.target.value)} placeholder="custom_indicator"/></label>}
  <label><span>{el?'Έκδοση *':'Version *'}</span><input value={v.version||''} disabled={readOnly} onChange={e=>set('version',e.target.value)}/></label>
  <SearchableSelect label={el?'Κατηγορία':'Category'} value={v.category||'surveillance'} disabled={readOnly} onChange={x=>set('category',x||'surveillance')} options={CATEGORY_OPTIONS.map(([value,elLabel,enLabel])=>({value,label:el?elLabel:enLabel}))}/>
  <ChoiceField label={el?'Τύπος υπολογισμού':'Calculation type'} value={v.calculationType||'auto'} disabled={readOnly} onChange={x=>set('calculationType',x)} options={[{value:'auto',label:el?'Αυτόματος από δεδομένα':'Automatic from data'},{value:'manual',label:el?'Χειροκίνητος':'Manual'}]}/>
  {automatic&&<><SearchableSelect label={el?'Μέγεθος αριθμητή *':'Numerator metric *'} value={v.numeratorMetric||''} disabled={readOnly} onChange={x=>setNumerator(x||'')} placeholder={el?'Επιλέξτε μετρική…':'Select metric…'} options={INDICATOR_METRICS.map(x=>({value:x,label:indicatorMetricLabel(x,language)}))}/><SearchableSelect label={el?'Μέγεθος παρονομαστή':'Denominator metric'} value={v.denominatorMetric||''} disabled={readOnly||!v.numeratorMetric} onChange={x=>setDenominator(x||'')} options={[{value:'',label:el?'Χωρίς παρονομαστή · απλή μέτρηση':'No denominator · raw measure'},...denominatorOptions.map(x=>({value:x,label:indicatorMetricLabel(x,language)}))]}/><label className="entry-span-2"><span>{el?'Ορισμός αριθμητή':'Numerator definition'}</span><textarea rows="3" value={v.numeratorDefinition?.description||''} disabled={readOnly} onChange={e=>set('numeratorDefinition',{...(v.numeratorDefinition||{}),description:e.target.value})}/></label><label className="entry-span-2"><span>{el?'Ορισμός παρονομαστή':'Denominator definition'}</span><textarea rows="3" value={v.denominatorDefinition?.description||''} disabled={readOnly} onChange={e=>set('denominatorDefinition',{...(v.denominatorDefinition||{}),description:e.target.value})}/></label><label><span>{el?'Πολλαπλασιαστής':'Multiplier'}{ratioLocked&&<small className="field-label-note"> · {fromMetric}</small>}</span><input type="number" step="any" value={v.multiplier??1} disabled={readOnly||ratioLocked} onChange={e=>set('multiplier',e.target.value)}/></label><label><span>{el?'Μονάδα':'Unit'}{ratioLocked&&<small className="field-label-note"> · {fromMetric}</small>}</span><input value={v.unit||''} disabled={readOnly||ratioLocked} onChange={e=>set('unit',e.target.value)} placeholder="%, /1.000, L"/></label></>}
  <label><span>{el?'Στόχος':'Target'}</span><input type="number" step="any" value={v.targetValue??''} disabled={readOnly} onChange={e=>set('targetValue',e.target.value)}/></label>
  <ChoiceField label={el?'Κατεύθυνση στόχου':'Target direction'} value={v.direction||'context'} disabled={readOnly} onChange={x=>set('direction',x)} options={[{value:'context',label:el?'Πληροφοριακός':'Context only'},{value:'higher',label:el?'Υψηλότερα καλύτερα':'Higher is better'},{value:'lower',label:el?'Χαμηλότερα καλύτερα':'Lower is better'}]}/>
  <label><span>{el?'Πηγή / Αρχή':'Source / authority'}</span><input value={v.sourceAuthority||''} disabled={readOnly} onChange={e=>set('sourceAuthority',e.target.value)}/></label>
  <SearchableSelect label={el?'Κατάσταση':'Status'} value={v.status||'draft'} disabled={readOnly} onChange={x=>set('status',x||'draft')} options={[{value:'draft',label:el?'Πρόχειρο':'Draft'},{value:'review',label:el?'Σε έλεγχο':'In review'},{value:'active',label:el?'Ενεργό':'Active'},{value:'retired',label:el?'Αποσυρμένο':'Retired'}]}/>
  <ManualDateField label={el?'Ισχύει από':'Effective from'} value={v.effectiveFrom||''} onChange={x=>set('effectiveFrom',x)} optional/>
  <ManualDateField label={el?'Ισχύει έως':'Effective to'} value={v.effectiveTo||''} onChange={x=>set('effectiveTo',x)} optional/>
  {showSystem&&<YesNoField label={el?'Ορισμός συστήματος · διαχείριση από τον Ιδιοκτήτη πλατφόρμας':'System definition · Platform Owner managed'} value={Boolean(v.system)} onChange={x=>!readOnly&&set('system',x)}/>}
  {departments.length>0&&<MultiSelect className="entry-span-2" label={el?'Ορατότητα ανά τμήμα':'Visibility by department'} options={departments.map(d=>({value:d.id,label:d.name}))} selected={visibleDepartmentIds} onChange={next=>set('visibleDepartmentIds',next)} disabled={readOnly} placeholder={el?'Ορατό σε όλα τα τμήματα':'Visible to every department'} searchPlaceholder={el?'Αναζήτηση τμήματος…':'Search department…'} emptyLabel={el?'Κανένα τμήμα δεν ταιριάζει':'No department matches'} selectAllLabel={el?'Επιλογή όλων':'Select all'} clearAllLabel={el?'Αποεπιλογή όλων':'Clear all'} countLabel={n=>el?`${n} τμήματα`:`${n} departments`}/>}
  {automatic&&v.numeratorMetric&&denominatorOptions.length>0&&!v.denominatorMetric&&<div className="source-truth-note entry-span-2">{el?`Για αναλογικό δείκτη, ο συμβατός παρονομαστής είναι «${indicatorMetricLabel(denominatorOptions[0],language)}». Χωρίς παρονομαστή ο δείκτης αποθηκεύεται ως απλή μέτρηση.`:`For a ratio indicator, the compatible denominator is “${indicatorMetricLabel(denominatorOptions[0],language)}”. Without a denominator the indicator is stored as a raw measure.`}</div>}
  {!combinationValid&&<div className="source-truth-note entry-span-2">{el?'Ο επιλεγμένος αριθμητής και παρονομαστής δεν αποτελούν υποστηριζόμενο συνδυασμό.':'The selected numerator and denominator are not a supported combination.'}</div>}
  {v.effectiveFrom&&v.effectiveTo&&v.effectiveTo<v.effectiveFrom&&<div className="source-truth-note entry-span-2">{el?'Η ημερομηνία λήξης δεν μπορεί να προηγείται της έναρξης.':'Effective-to cannot be before effective-from.'}</div>}
 </div>
}
