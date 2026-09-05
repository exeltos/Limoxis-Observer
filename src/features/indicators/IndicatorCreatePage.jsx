import { useState } from 'react'
import { Gauge } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { ManualDateField } from '../../design-system/ManualDateField'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { createIndicatorDefinition,INDICATOR_METRICS } from './indicatorCloudService'

const metricLabels={patient_days:['Νοσηλευτικές ημέρες','Patient days'],active_surveillance:['Ενεργές επιτηρήσεις','Active surveillance'],resistant_active_surveillance:['Ενεργές επιτηρήσεις με MDR/XDR/PDR','Active surveillance with MDR/XDR/PDR'],hh_compliant_actions:['Συμμορφούμενες ενέργειες υγιεινής χεριών','Compliant hand-hygiene actions'],hh_opportunities:['Ευκαιρίες υγιεινής χεριών','Hand-hygiene opportunities'],bundle_all_or_none_pass:['Πλήρως συμμορφούμενα bundles','All-or-none bundle passes'],bundle_executions:['Εκτελέσεις bundles','Bundle executions'],abhr_litres:['Λίτρα αντισηπτικού','Antiseptic litres'],active_staff:['Ενεργοί εργαζόμενοι','Active staff'],active_staff_with_vaccination:['Εργαζόμενοι με εμβολιασμό','Staff with vaccination'],training_completed:['Ολοκληρωμένες εκπαιδεύσεις','Completed training'],training_assignments:['Αναθέσεις εκπαίδευσης','Training assignments'],open_high_incidents:['Ανοιχτά συμβάντα υψηλής σοβαρότητας','Open high-severity incidents'],mdro_bsi:['MDRO θετικές καλλιέργειες','MDRO positive cultures']}
const today=()=>new Date().toISOString().slice(0,10)

export function IndicatorCreatePage(){
 const navigate=useNavigate();const {language}=useLanguage();const el=language==='el';const {tenant}=useTenant();const {notify}=useFeedback()
 const [saving,setSaving]=useState(false)
 const [v,setV]=useState({titleEl:'',indicatorKey:'',category:'quality',calculationType:'manual',numeratorMetric:'active_surveillance',denominatorMetric:'',numeratorDefinition:'',denominatorDefinition:'',multiplier:'1',unit:'',targetValue:'',direction:'context',sourceAuthority:'Hospital-defined',version:'1.0',effectiveFrom:today(),effectiveTo:'',status:'active'})
 const set=(k,value)=>setV(s=>({...s,[k]:value}))
 const automatic=v.calculationType==='auto'
 const valid=v.titleEl.trim()&&v.effectiveFrom&&(v.calculationType==='manual'||v.numeratorMetric)&&(!v.effectiveTo||v.effectiveTo>=v.effectiveFrom)
 async function save(){if(!valid||saving)return;setSaving(true);try{await createIndicatorDefinition(tenant.id,v);notify(el?'Ο νέος δείκτης δημιουργήθηκε.':'Indicator created.','success');navigate('/indicators',{replace:true})}catch(error){notify(error?.message||(el?'Δεν ήταν δυνατή η δημιουργία του δείκτη.':'Could not create indicator.'),'error')}finally{setSaving(false)}}
 return <Page fill><EntityRecordShell className="indicator-create-shell workspace-fill" avatar={<Gauge size={19}/>} eyebrow={el?'Δείκτες':'Indicators'} title={el?'Νέος δείκτης':'New indicator'} subtitle={el?'Δημιουργία οργανωτικού δείκτη':'Create organization indicator'} tabs={[]} activeTab="" onTabChange={()=>{}} onBack={()=>navigate('/indicators')}>
  <div className="record-section indicator-create-form">
   <div className="entry-grid">
    <label className="entry-span-2"><span>{el?'Τίτλος *':'Title *'}</span><input autoFocus value={v.titleEl} onChange={e=>set('titleEl',e.target.value)}/></label>
    <label><span>{el?'Κωδικός δείκτη':'Indicator key'}</span><input value={v.indicatorKey} onChange={e=>set('indicatorKey',e.target.value)} placeholder="custom_indicator"/></label>
    <label><span>{el?'Έκδοση':'Version'}</span><input value={v.version} onChange={e=>set('version',e.target.value)}/></label>
    <label><span>{el?'Κατηγορία':'Category'}</span><select value={v.category} onChange={e=>set('category',e.target.value)}><option value="surveillance">{el?'Επιτήρηση':'Surveillance'}</option><option value="prevention">{el?'Πρόληψη':'Prevention'}</option><option value="laboratory">{el?'Εργαστήριο':'Laboratory'}</option><option value="workforce">{el?'Προσωπικό':'Workforce'}</option><option value="quality">{el?'Ποιότητα':'Quality'}</option></select></label>
    <label><span>{el?'Τρόπος υπολογισμού':'Calculation type'}</span><select value={v.calculationType} onChange={e=>set('calculationType',e.target.value)}><option value="manual">{el?'Χειροκίνητος':'Manual'}</option><option value="auto">{el?'Αυτόματος από δεδομένα':'Automatic from data'}</option></select></label>
    {automatic&&<><label><span>{el?'Metric αριθμητή *':'Numerator metric *'}</span><select value={v.numeratorMetric} onChange={e=>set('numeratorMetric',e.target.value)}>{INDICATOR_METRICS.map(x=><option key={x} value={x}>{metricLabels[x]?.[el?0:1]||x}</option>)}</select></label><label><span>{el?'Metric παρονομαστή':'Denominator metric'}</span><select value={v.denominatorMetric} onChange={e=>set('denominatorMetric',e.target.value)}><option value="">{el?'Χωρίς παρονομαστή':'No denominator'}</option>{INDICATOR_METRICS.map(x=><option key={x} value={x}>{metricLabels[x]?.[el?0:1]||x}</option>)}</select></label><label className="entry-span-2"><span>{el?'Ορισμός αριθμητή':'Numerator definition'}</span><textarea rows="3" value={v.numeratorDefinition} onChange={e=>set('numeratorDefinition',e.target.value)} placeholder={el?'Περιγράψτε ακριβώς τι μετρά ο αριθμητής.':'Describe exactly what the numerator measures.'}/></label><label className="entry-span-2"><span>{el?'Ορισμός παρονομαστή':'Denominator definition'}</span><textarea rows="3" value={v.denominatorDefinition} onChange={e=>set('denominatorDefinition',e.target.value)} placeholder={el?'Περιγράψτε ακριβώς τον παρονομαστή, όπου εφαρμόζεται.':'Describe the denominator, where applicable.'}/></label><label><span>{el?'Πολλαπλασιαστής':'Multiplier'}</span><input type="number" step="any" value={v.multiplier} onChange={e=>set('multiplier',e.target.value)}/></label><label><span>{el?'Μονάδα':'Unit'}</span><input value={v.unit} onChange={e=>set('unit',e.target.value)} placeholder="%, /1.000, L"/></label></>}
    <label><span>{el?'Στόχος':'Target'}</span><input type="number" step="any" value={v.targetValue} onChange={e=>set('targetValue',e.target.value)}/></label>
    <label><span>{el?'Κατεύθυνση στόχου':'Target direction'}</span><select value={v.direction} onChange={e=>set('direction',e.target.value)}><option value="context">{el?'Πληροφοριακός':'Context only'}</option><option value="higher">{el?'Υψηλότερα είναι καλύτερα':'Higher is better'}</option><option value="lower">{el?'Χαμηλότερα είναι καλύτερα':'Lower is better'}</option></select></label>
    <label><span>{el?'Πηγή / Αρχή':'Source / authority'}</span><input value={v.sourceAuthority} onChange={e=>set('sourceAuthority',e.target.value)}/></label>
    <label><span>{el?'Κατάσταση':'Status'}</span><select value={v.status} onChange={e=>set('status',e.target.value)}><option value="draft">{el?'Πρόχειρο':'Draft'}</option><option value="review">{el?'Σε έλεγχο':'In review'}</option><option value="active">{el?'Ενεργό':'Active'}</option></select></label>
    <ManualDateField label={el?'Ισχύς από *':'Effective from *'} value={v.effectiveFrom} onChange={x=>set('effectiveFrom',x)}/>
    <ManualDateField label={el?'Ισχύς έως':'Effective to'} value={v.effectiveTo} onChange={x=>set('effectiveTo',x)} optional/>
    {v.effectiveTo&&v.effectiveTo<v.effectiveFrom&&<div className="source-truth-note entry-span-2">{el?'Η ημερομηνία λήξης δεν μπορεί να προηγείται της έναρξης.':'Effective-to cannot be before effective-from.'}</div>}
   </div>
   <div className="inline-edit-footer"><Button variant="secondary" onClick={()=>navigate('/indicators')}>{el?'Ακύρωση':'Cancel'}</Button><SaveButton loading={saving} disabled={!valid||saving} onClick={save}>{el?'Αποθήκευση':'Save'}</SaveButton></div>
  </div>
 </EntityRecordShell></Page>
}
