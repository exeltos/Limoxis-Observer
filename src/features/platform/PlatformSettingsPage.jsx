import { useEffect,useMemo,useState } from 'react'
import { AlertTriangle,Building2,Globe2,History,Megaphone,ShieldCheck,SlidersHorizontal } from 'lucide-react'
import { Card,CardHeader } from '../../design-system/Card'
import { Page } from '../../design-system/Page'
import { SaveButton } from '../../design-system/SaveButton'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { getPlatformSettings,updatePlatformSettings } from './platformSettingsService'
import './platformSettings.css'

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

  // Fetch once on mount only, using whatever `en` is at that moment — re-running this on
  // every language toggle would re-fetch and reset `draft`/`baseline`, discarding
  // in-progress edits to the settings form.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      {loading?<div className="inline-empty">{tx('Φόρτωση ρυθμίσεων…','Loading settings…')}</div>:error?<div className="data-access-state warning"><AlertTriangle size={16}/><span>{tx('Δεν ήταν δυνατή η φόρτωση των ρυθμίσεων πλατφόρμας.','Platform settings could not be loaded.')}</span></div>:<div className="platform-settings-layout">
        <div className="platform-settings-main">
          <Card className="platform-settings-card">
            <CardHeader icon={SlidersHorizontal} title={tx('Λειτουργικές προεπιλογές','Operational defaults')} subtitle={tx('Τιμές που χρησιμοποιούνται σε όλη την εγκατάσταση.','Values used across the whole installation.')}/>
            <div className="platform-settings-grid">
              <FieldBlock label={tx('Email υποστήριξης','Support email')} hint={tx('Κεντρικό email αναφοράς για την εγκατάσταση.','Central support contact for this installation.')}>
                <input type="email" value={draft.supportEmail} placeholder="support@example.org" onChange={event=>setDraft(current=>({...current,supportEmail:event.target.value}))}/>
                {!emailValid?<small className="field-error">{tx('Μη έγκυρο email.','Invalid email.')}</small>:null}
              </FieldBlock>
              <FieldBlock label={tx('Προεπιλεγμένη διάρκεια Demo','Default demo duration')} hint={tx('Καθολική προεπιλογή για τη δημιουργία νέων Demo.','Global default for new demo provisioning.')}>
                <div className="platform-settings-duration-control"><input type="number" min="1" max="365" value={draft.defaultDemoDurationDays} onChange={event=>setDraft(current=>({...current,defaultDemoDurationDays:event.target.value}))}/><span>{tx('ημέρες','days')}</span></div>
                {!durationValid?<small className="field-error">{tx('Επιτρέπονται 1–365 ημέρες.','Allowed range is 1–365 days.')}</small>:null}
              </FieldBlock>
            </div>
          </Card>

          <Card className="platform-settings-card">
            <CardHeader icon={Megaphone} title={tx('Ανακοίνωση συντήρησης','Maintenance notice')} subtitle={tx('Καθολικό λειτουργικό μήνυμα προς τους χρήστες της πλατφόρμας.','Platform-wide operational message shown to users.')} actions={<span className={`status-badge ${draft.maintenanceNoticeEnabled?'temporary':''}`}>{draft.maintenanceNoticeEnabled?tx('Ενεργή','Enabled'):tx('Ανενεργή','Disabled')}</span>}/>
            <div className="platform-settings-grid">
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
            <div className="platform-settings-preview">
              <span className="platform-settings-preview-label">{tx('Προεπισκόπηση','Preview')}</span>
              {noticeValue.trim()?<div className="platform-maintenance-banner platform-settings-preview-banner"><AlertTriangle size={16}/><span>{noticeValue}</span></div>:<div className="platform-settings-preview-empty">{tx('Γράψτε μήνυμα για να δείτε πώς θα εμφανιστεί στους χρήστες.','Type a message to see how users will see it.')}</div>}
            </div>
          </Card>
        </div>

        <Card className="platform-settings-card platform-settings-aside">
          <CardHeader icon={ShieldCheck} title={tx('Εμβέλεια & ασφάλεια','Scope & security')}/>
          <ul className="platform-settings-facts">
            <li><Globe2 size={15}/><span>{tx('Οι ρυθμίσεις ισχύουν για όλους τους οργανισμούς της εγκατάστασης.','Settings apply to every organization in this installation.')}</span></li>
            <li><ShieldCheck size={15}/><span>{tx('Μόνο ο Ιδιοκτήτης Πλατφόρμας μπορεί να τις αλλάξει.','Only the Platform Owner can change them.')}</span></li>
            <li><History size={15}/><span>{tx('Κάθε αλλαγή καταγράφεται στο Ιστορικό & Ασφάλεια.','Every change is recorded in Audit & Security.')}</span></li>
            <li><Building2 size={15}/><span>{tx('Οι ρυθμίσεις κάθε νοσοκομείου παραμένουν στο Κέντρο Διαχείρισης του οργανισμού.','Hospital settings stay in each organization’s Management Center.')}</span></li>
          </ul>
        </Card>
      </div>}
    </div>
  </Page>
}
