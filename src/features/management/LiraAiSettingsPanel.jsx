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
 return <section className="management-section management-scroll-section"><div className="section-toolbar"><div><h2>{en?'LIRA & AI':'LIRA & AI'}</h2><p>{en?'Connect an AI provider for this hospital. LIRA continues to work deterministically without one.':'Συνδέστε πάροχο AI για αυτό το νοσοκομείο. Η LIRA συνεχίζει να λειτουργεί ντετερμινιστικά και χωρίς πάροχο.'}</p></div><ShieldCheck size={22}/></div>
 <div className="entry-form-grid"><label className="field"><span>{en?'AI provider':'Πάροχος AI'}</span><select value={form.provider} disabled={isDemo} onChange={e=>setForm(v=>({...v,provider:e.target.value}))}><option value="none">{en?'No generative AI':'Χωρίς generative AI'}</option><option value="openai">OpenAI API</option></select></label>
 <label className="field"><span>{en?'Model':'Μοντέλο'}</span><input value={form.model} disabled={isDemo||form.provider==='none'} onChange={e=>setForm(v=>({...v,model:e.target.value}))}/></label>
 <label className="field"><span>API key</span><input type="password" autoComplete="new-password" value={form.apiKey} disabled={isDemo||form.provider==='none'} placeholder={form.keyHint||'sk-…'} onChange={e=>setForm(v=>({...v,apiKey:e.target.value}))}/><small>{en?'Stored encrypted in Supabase Vault; never returned to the browser.':'Αποθηκεύεται κρυπτογραφημένο στο Supabase Vault και δεν επιστρέφεται ποτέ στον browser.'}</small></label>
 </div>
 <div className="management-ai-permissions"><label><input type="checkbox" checked={form.allowAggregateData} disabled={isDemo} onChange={e=>setForm(v=>({...v,allowAggregateData:e.target.checked}))}/>{en?'Allow aggregate/de-identified operational context':'Να επιτρέπονται συγκεντρωτικά/αποταυτοποιημένα λειτουργικά δεδομένα'}</label><label><input type="checkbox" checked={form.allowPatientLevelData} disabled={isDemo} onChange={e=>setForm(v=>({...v,allowPatientLevelData:e.target.checked}))}/>{en?'Allow patient-level context (off by default)':'Να επιτρέπονται δεδομένα επιπέδου ασθενούς (ανενεργό από προεπιλογή)'}</label></div>
 <div className="dialog-actions">{form.keyHint&&<span><KeyRound size={14}/> {en?'Credential configured':'Έχει καταχωριστεί credential'} {form.keyHint}</span>}<Button variant="secondary" disabled={isDemo||!form.keyHint} onClick={disconnect}>{en?'Disconnect':'Αποσύνδεση'}</Button><SaveButton disabled={isDemo} onClick={save}>{en?'Save':'Αποθήκευση'}</SaveButton></div></section>
}
