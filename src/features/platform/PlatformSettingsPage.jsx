import { useEffect,useMemo,useState } from 'react'
import { AlertTriangle,Settings2,ShieldCheck } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { SaveButton } from '../../design-system/SaveButton'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { getPlatformSettings,updatePlatformSettings } from './platformSettingsService'

function FieldBlock({label,hint,children}){
  return <label className="field"><span>{label}</span>{children}{hint?<small className="field-hint">{hint}</small>:null}</label>
}

export function PlatformSettingsPage(){
  const {language}=useLanguage()
  const {notify,notifyError}=useFeedback()
  const en=language==='en'
  const tx=(elText,enText)=>en?enText:elText
  const [loading,setLoading]=useState(true)
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState(null)
  const [draft,setDraft]=useState({supportEmail:'',defaultDemoDurationDays:30,maintenanceNoticeEnabled:false,maintenanceNoticeEl:'',maintenanceNoticeEn:''})
  const [baseline,setBaseline]=useState(null)

  useEffect(()=>{
    let active=true
    ;(async()=>{
      setLoading(true);setError(null)
      try{
        const value=await getPlatformSettings()
        if(!active)return
        setDraft(value);setBaseline(value)
      }catch(err){if(active)setError(err)}finally{if(active)setLoading(false)}
    })()
    return ()=>{active=false}
  },[])

  const dirty=useMemo(()=>baseline?JSON.stringify({supportEmail:draft.supportEmail,defaultDemoDurationDays:Number(draft.defaultDemoDurationDays),maintenanceNoticeEnabled:Boolean(draft.maintenanceNoticeEnabled),maintenanceNoticeEl:draft.maintenanceNoticeEl,maintenanceNoticeEn:draft.maintenanceNoticeEn})!==JSON.stringify({supportEmail:baseline.supportEmail,defaultDemoDurationDays:Number(baseline.defaultDemoDurationDays),maintenanceNoticeEnabled:Boolean(baseline.maintenanceNoticeEnabled),maintenanceNoticeEl:baseline.maintenanceNoticeEl,maintenanceNoticeEn:baseline.maintenanceNoticeEn}):false,[draft,baseline])
  const emailValid=!draft.supportEmail||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.supportEmail.trim())
  const durationValid=Number(draft.defaultDemoDurationDays)>=1&&Number(draft.defaultDemoDurationDays)<=365
  const noticeValid=!draft.maintenanceNoticeEnabled||(draft.maintenanceNoticeEl.trim()&&draft.maintenanceNoticeEn.trim())
  const canSave=dirty&&emailValid&&durationValid&&noticeValid&&!saving

  async function save(){
    if(!canSave)return
    setSaving(true)
    try{
      const value=await updatePlatformSettings(draft)
      setDraft(value);setBaseline(value)
      notify(tx('Οι ρυθμίσεις πλατφόρμας αποθηκεύτηκαν.','Platform settings saved.'),'success',{operation:'platform_settings_update'})
    }catch(err){notifyError(err,'save',{operation:'platform_settings_update'})}
    finally{setSaving(false)}
  }

  return <Page
    title={tx('Ρυθμίσεις Πλατφόρμας','Platform Settings')}
    subtitle={tx('Μόνο καθολικές ρυθμίσεις που ισχύουν για όλη την εγκατάσταση Limoxis Observer.','Only global settings that apply across the entire Limoxis Observer installation.')}
    actions={<SaveButton onClick={save} loading={saving} disabled={!canSave}>{tx('Αποθήκευση','Save')}</SaveButton>}
  >
    <div className="platform-registry-shell">
      {loading?<div className="inline-empty">{tx('Φόρτωση ρυθμίσεων…','Loading settings…')}</div>:error?<div className="data-access-state warning"><AlertTriangle size={16}/><span>{tx('Δεν ήταν δυνατή η φόρτωση των ρυθμίσεων πλατφόρμας.','Platform settings could not be loaded.')}</span></div>:<>
        <section className="platform-form-section">
          <header><strong>{tx('Λειτουργικές προεπιλογές','Operational defaults')}</strong></header>
          <div className="platform-form-grid">
            <FieldBlock label={tx('Email υποστήριξης','Support email')} hint={tx('Κεντρικό email αναφοράς για την εγκατάσταση.','Central support contact for this installation.')}>
              <input type="email" value={draft.supportEmail} onChange={event=>setDraft(current=>({...current,supportEmail:event.target.value}))}/>
              {!emailValid?<small className="field-error">{tx('Μη έγκυρο email.','Invalid email.')}</small>:null}
            </FieldBlock>
            <FieldBlock label={tx('Προεπιλεγμένη διάρκεια Demo','Default demo duration')} hint={tx('Χρησιμοποιείται ως αρχική διάρκεια κατά τη δημιουργία νέου Demo.','Used as the initial duration when creating a new demo.')}>
              <div className="platform-settings-number"><input type="number" min="1" max="365" value={draft.defaultDemoDurationDays} onChange={event=>setDraft(current=>({...current,defaultDemoDurationDays:event.target.value}))}/><span>{tx('ημέρες','days')}</span></div>
              {!durationValid?<small className="field-error">{tx('Επιτρέπονται 1–365 ημέρες.','Allowed range is 1–365 days.')}</small>:null}
            </FieldBlock>
          </div>
        </section>

        <section className="platform-form-section">
          <header><strong>{tx('Ανακοίνωση συντήρησης','Maintenance notice')}</strong><span>{tx('Καθολικό μήνυμα λειτουργίας της πλατφόρμας. Δεν αφορά δεδομένα νοσοκομείου.','Global platform operational message. It does not contain hospital data.')}</span></header>
          <div className="platform-settings-toggle-row">
            <div><strong>{tx('Ενεργή ανακοίνωση','Notice enabled')}</strong><small>{tx('Το μήνυμα αποθηκεύεται κεντρικά και είναι διαθέσιμο για καθολική προβολή.','The message is stored centrally and is available for global display.')}</small></div>
            <label className="switch-control"><input type="checkbox" checked={draft.maintenanceNoticeEnabled} onChange={event=>setDraft(current=>({...current,maintenanceNoticeEnabled:event.target.checked}))}/><span/></label>
          </div>
          <div className="platform-form-grid">
            <FieldBlock label={tx('Μήνυμα στα Ελληνικά','Greek message')}><textarea rows="4" value={draft.maintenanceNoticeEl} onChange={event=>setDraft(current=>({...current,maintenanceNoticeEl:event.target.value}))}/></FieldBlock>
            <FieldBlock label={tx('Μήνυμα στα Αγγλικά','English message')}><textarea rows="4" value={draft.maintenanceNoticeEn} onChange={event=>setDraft(current=>({...current,maintenanceNoticeEn:event.target.value}))}/></FieldBlock>
          </div>
          {draft.maintenanceNoticeEnabled&&!noticeValid?<div className="data-access-state warning"><AlertTriangle size={16}/><span>{tx('Όταν η ανακοίνωση είναι ενεργή απαιτείται μήνυμα και στις δύο γλώσσες.','When enabled, a message is required in both languages.')}</span></div>:null}
        </section>

        <div className="platform-governance"><ShieldCheck size={17}/>{tx('Οι ρυθμίσεις αυτές είναι καθολικές, προστατεύονται με Platform Owner RLS και κάθε αλλαγή καταγράφεται στο Audit & Ασφάλεια. Οι ρυθμίσεις νοσοκομείου παραμένουν μέσα στον αντίστοιχο οργανισμό.','These settings are global, protected by Platform Owner RLS, and every change is recorded in Audit & Security. Hospital-specific settings remain inside each organization.')}</div>
      </>}
    </div>
  </Page>
}
