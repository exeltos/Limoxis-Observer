import { useEffect,useMemo,useState } from 'react'
import { AlertTriangle,ShieldCheck } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { SaveButton } from '../../design-system/SaveButton'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { getPlatformSettings,updatePlatformSettings } from './platformSettingsService'

function FieldBlock({label,hint,children,className=''}){
  return <label className={`field ${className}`.trim()}><span>{label}</span>{children}{hint?<small className="field-hint">{hint}</small>:null}</label>
}

export function PlatformSettingsPage(){
  const {language}=useLanguage()
  const {notify,notifyError}=useFeedback()
  const en=language==='en'
  const tx=(elText,enText)=>en?enText:elText
  const [loading,setLoading]=useState(true)
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState(null)
  const [noticeLanguage,setNoticeLanguage]=useState(en?'en':'el')
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
        if(en&&value.maintenanceNoticeEn)setNoticeLanguage('en')
        else if(!en&&value.maintenanceNoticeEl)setNoticeLanguage('el')
        else if(value.maintenanceNoticeEl)setNoticeLanguage('el')
        else if(value.maintenanceNoticeEn)setNoticeLanguage('en')
      }catch(err){if(active)setError(err)}finally{if(active)setLoading(false)}
    })()
    return ()=>{active=false}
  },[])

  const dirty=useMemo(()=>baseline?JSON.stringify({supportEmail:draft.supportEmail,defaultDemoDurationDays:Number(draft.defaultDemoDurationDays),maintenanceNoticeEnabled:Boolean(draft.maintenanceNoticeEnabled),maintenanceNoticeEl:draft.maintenanceNoticeEl,maintenanceNoticeEn:draft.maintenanceNoticeEn})!==JSON.stringify({supportEmail:baseline.supportEmail,defaultDemoDurationDays:Number(baseline.defaultDemoDurationDays),maintenanceNoticeEnabled:Boolean(baseline.maintenanceNoticeEnabled),maintenanceNoticeEl:baseline.maintenanceNoticeEl,maintenanceNoticeEn:baseline.maintenanceNoticeEn}):false,[draft,baseline])
  const emailValid=!draft.supportEmail||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.supportEmail.trim())
  const durationValid=Number(draft.defaultDemoDurationDays)>=1&&Number(draft.defaultDemoDurationDays)<=365
  const noticeValid=!draft.maintenanceNoticeEnabled||Boolean(draft.maintenanceNoticeEl.trim()||draft.maintenanceNoticeEn.trim())
  const canSave=dirty&&emailValid&&durationValid&&noticeValid&&!saving
  const noticeValue=noticeLanguage==='en'?draft.maintenanceNoticeEn:draft.maintenanceNoticeEl

  function setNoticeValue(value){
    setDraft(current=>noticeLanguage==='en'?{...current,maintenanceNoticeEn:value}:{...current,maintenanceNoticeEl:value})
  }

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
    <div className="platform-registry-shell platform-settings-page">
      {loading?<div className="inline-empty">{tx('Φόρτωση ρυθμίσεων…','Loading settings…')}</div>:error?<div className="data-access-state warning"><AlertTriangle size={16}/><span>{tx('Δεν ήταν δυνατή η φόρτωση των ρυθμίσεων πλατφόρμας.','Platform settings could not be loaded.')}</span></div>:<>
        <section className="platform-form-section">
          <header><strong>{tx('Λειτουργικές προεπιλογές','Operational defaults')}</strong></header>
          <div className="platform-form-grid platform-settings-defaults-grid">
            <FieldBlock label={tx('Email υποστήριξης','Support email')} hint={tx('Κεντρικό email αναφοράς για την εγκατάσταση.','Central support contact for this installation.')}>
              <input type="email" value={draft.supportEmail} onChange={event=>setDraft(current=>({...current,supportEmail:event.target.value}))}/>
              {!emailValid?<small className="field-error">{tx('Μη έγκυρο email.','Invalid email.')}</small>:null}
            </FieldBlock>
            <FieldBlock label={tx('Προεπιλεγμένη διάρκεια Demo','Default demo duration')} hint={tx('Καθολική προεπιλογή για provisioning νέων Demo.','Global default for new demo provisioning.')}>
              <div className="platform-settings-duration-control"><input type="number" min="1" max="365" value={draft.defaultDemoDurationDays} onChange={event=>setDraft(current=>({...current,defaultDemoDurationDays:event.target.value}))}/><span>{tx('ημέρες','days')}</span></div>
              {!durationValid?<small className="field-error">{tx('Επιτρέπονται 1–365 ημέρες.','Allowed range is 1–365 days.')}</small>:null}
            </FieldBlock>
          </div>
        </section>

        <section className="platform-form-section">
          <header><strong>{tx('Ανακοίνωση συντήρησης','Maintenance notice')}</strong><span>{tx('Καθολικό λειτουργικό μήνυμα προς τους χρήστες της πλατφόρμας.','Platform-wide operational message shown to users.')}</span></header>
          <div className="platform-form-grid platform-settings-notice-grid">
            <FieldBlock label={tx('Κατάσταση ανακοίνωσης','Notice status')}>
              <select value={draft.maintenanceNoticeEnabled?'enabled':'disabled'} onChange={event=>setDraft(current=>({...current,maintenanceNoticeEnabled:event.target.value==='enabled'}))}>
                <option value="disabled">{tx('Ανενεργή','Disabled')}</option>
                <option value="enabled">{tx('Ενεργή','Enabled')}</option>
              </select>
            </FieldBlock>
            <FieldBlock label={tx('Γλώσσα μηνύματος','Message language')}>
              <select value={noticeLanguage} onChange={event=>setNoticeLanguage(event.target.value)}>
                <option value="el">Ελληνικά</option>
                <option value="en">English</option>
              </select>
            </FieldBlock>
            <FieldBlock className="platform-settings-message-field" label={tx('Μήνυμα','Message')} hint={tx('Αρκεί να καταχωριστεί σε μία γλώσσα. Αν δεν υπάρχει μετάφραση, εμφανίζεται το διαθέσιμο μήνυμα.','A single language is sufficient. If no translation exists, the available message is shown.')}>
              <textarea rows="4" value={noticeValue} onChange={event=>setNoticeValue(event.target.value)} placeholder={noticeLanguage==='en'?'Type the maintenance message…':'Γράψτε το μήνυμα συντήρησης…'}/>
            </FieldBlock>
          </div>
          {draft.maintenanceNoticeEnabled&&!noticeValid?<div className="data-access-state warning"><AlertTriangle size={16}/><span>{tx('Για ενεργή ανακοίνωση απαιτείται μήνυμα σε τουλάχιστον μία γλώσσα.','An enabled notice requires a message in at least one language.')}</span></div>:null}
        </section>

        <div className="platform-governance"><ShieldCheck size={17}/>{tx('Οι ρυθμίσεις αυτές είναι καθολικές, προστατεύονται με Platform Owner RLS και κάθε αλλαγή καταγράφεται στο Audit & Ασφάλεια. Οι ρυθμίσεις νοσοκομείου παραμένουν μέσα στον αντίστοιχο οργανισμό.','These settings are global, protected by Platform Owner RLS, and every change is recorded in Audit & Security. Hospital-specific settings remain inside each organization.')}</div>
      </>}
    </div>
  </Page>
}
