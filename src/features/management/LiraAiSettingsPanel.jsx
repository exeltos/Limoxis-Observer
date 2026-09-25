import { useEffect,useState } from 'react'
import { KeyRound,ShieldCheck } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { supabase,invokeAuthenticatedFunction } from '../../core/supabase/client'

export function LiraAiSettingsPanel(){
 const {language}=useLanguage(),en=language==='en';const {tenant,isDemo}=useTenant();const {notify}=useFeedback()
 const [form,setForm]=useState({provider:'none',model:'gpt-5.6',apiKey:'',keyHint:'',allowAggregateData:true,allowPatientLevelData:false});const [loading,setLoading]=useState(true)
 useEffect(()=>{if(isDemo||!tenant?.id){setLoading(false);return}let active=true;supabase.rpc('get_lira_ai_provider_settings',{p_organization_id:tenant.id}).then(({data,error})=>{if(error)throw error;const row=data?.[0];if(active&&row)setForm(v=>({...v,provider:row.provider,model:row.model||'gpt-5.6',keyHint:row.key_hint||'',allowAggregateData:row.allow_aggregate_data,allowPatientLevelData:row.allow_patient_level_data}))}).catch(e=>active&&notify(e.message,'error')).finally(()=>active&&setLoading(false));return()=>{active=false}},[tenant?.id,isDemo,notify])
 async function save(){try{await invokeAuthenticatedFunction('lira-provider-settings',{action:'save',organizationId:tenant.id,provider:form.provider,model:form.model,apiKey:form.apiKey,allowAggregateData:form.allowAggregateData,allowPatientLevelData:form.allowPatientLevelData});setForm(v=>({...v,apiKey:'',keyHint:v.apiKey?`••••${v.apiKey.slice(-4)}`:v.keyHint}));notify(en?'LIRA AI settings saved.':'Οι ρυθμίσεις LIRA AI αποθηκεύτηκαν.','success')}catch(e){notify(e.message,'error')}}
 async function disconnect(){try{await invokeAuthenticatedFunction('lira-provider-settings',{action:'disconnect',organizationId:tenant.id});setForm(v=>({...v,provider:'none',apiKey:'',keyHint:''}));notify(en?'AI provider disconnected.':'Ο πάροχος AI αποσυνδέθηκε.','success')}catch(e){notify(e.message,'error')}}
 if(loading)return <div className="inline-empty">{en?'Loading…':'Φόρτωση…'}</div>
 const permissions=[
  {key:'allowAggregateData',title:en?'Aggregate, de-identified data':'Συγκεντρωτικά, ανώνυμα δεδομένα',text:en?'Counts, rates and trends without patient identifiers.':'Αριθμοί, δείκτες και τάσεις χωρίς στοιχεία ταυτότητας ασθενών.'},
  {key:'allowPatientLevelData',title:en?'Patient-level data':'Δεδομένα επιπέδου ασθενούς',text:en?'Off by default. Enable only with the hospital’s data-protection approval.':'Ανενεργό από προεπιλογή. Ενεργοποιήστε μόνο με έγκριση προστασίας δεδομένων του νοσοκομείου.'},
 ]
 return <section className="management-section management-scroll-section management-lira-ai"><div className="section-toolbar"><div><h2>LIRA & AI</h2><p>{en?'Connect an AI provider for this hospital. Without one, LIRA keeps working with its built-in rules.':'Συνδέστε πάροχο τεχνητής νοημοσύνης για αυτό το νοσοκομείο. Χωρίς πάροχο, η LIRA συνεχίζει να λειτουργεί με τους ενσωματωμένους κανόνες της.'}</p></div></div>
 <div className="management-card-grid">
 <section className="record-section"><div className="record-section-header"><div><span className="eyebrow">{en?'PROVIDER':'ΠΑΡΟΧΟΣ'}</span><h3><KeyRound size={15}/> {en?'AI connection':'Σύνδεση AI'}</h3></div>{form.keyHint&&<span className="status-badge active">{en?'Connected':'Συνδεδεμένο'} {form.keyHint}</span>}</div>
 <div className="entry-form-grid"><label className="field"><span>{en?'AI provider':'Πάροχος AI'}</span><select value={form.provider} disabled={isDemo} onChange={e=>setForm(v=>({...v,provider:e.target.value}))}><option value="none">{en?'No AI provider':'Χωρίς πάροχο AI'}</option><option value="openai">OpenAI API</option></select></label>
 <label className="field"><span>{en?'Model':'Μοντέλο'}</span><input value={form.model} disabled={isDemo||form.provider==='none'} onChange={e=>setForm(v=>({...v,model:e.target.value}))}/></label>
 <label className="field field-wide"><span>{en?'API key':'Κλειδί API'}</span><input type="password" autoComplete="new-password" value={form.apiKey} disabled={isDemo||form.provider==='none'} placeholder={form.keyHint||'sk-…'} onChange={e=>setForm(v=>({...v,apiKey:e.target.value}))}/><small>{en?'Stored encrypted on the server and never shown again.':'Αποθηκεύεται κρυπτογραφημένο στον διακομιστή και δεν εμφανίζεται ξανά.'}</small></label>
 </div></section>
 <section className="record-section"><div className="record-section-header"><div><span className="eyebrow">{en?'PRIVACY':'ΑΠΟΡΡΗΤΟ'}</span><h3><ShieldCheck size={15}/> {en?'Data LIRA may use':'Δεδομένα που μπορεί να χρησιμοποιεί η LIRA'}</h3></div></div>
 <div className="management-ai-permissions">{permissions.map(item=><label key={item.key} className={`management-ai-permission ${form[item.key]?'selected':''}`}><input type="checkbox" checked={form[item.key]} disabled={isDemo} onChange={e=>setForm(v=>({...v,[item.key]:e.target.checked}))}/><span><strong>{item.title}</strong><small>{item.text}</small></span><span className={`status-badge ${form[item.key]?'active':'temporary'}`}>{form[item.key]?(en?'Allowed':'Επιτρέπεται'):(en?'Off':'Ανενεργό')}</span></label>)}</div>
 </section></div>
 {isDemo&&<div className="management-lira-demo-note">{en?'Read-only in the demo.':'Μόνο για προβολή στο demo.'}</div>}
 <div className="dialog-actions"><Button variant="secondary" disabled={isDemo||!form.keyHint} onClick={disconnect}>{en?'Disconnect':'Αποσύνδεση'}</Button><SaveButton disabled={isDemo} onClick={save}>{en?'Save':'Αποθήκευση'}</SaveButton></div></section>
}
