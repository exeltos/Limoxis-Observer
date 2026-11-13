import { useEffect,useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { ObserverDialog,DialogActions } from '../../design-system/ObserverDialog'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { getPlatformSettings,updatePlatformSettings,type PlatformSettings } from './platformSettingsService'
import './platformSettings.css'

// Each platform setting where it is used (owner, 10/11/2026): the Demo defaults on the Demo screen, the deletion grace
// period and the support email on the Organizations screen, the maintenance message among the Announcements. The same
// platform_settings row and the same save; a dialog changes only its own fields.
type Pair = [string,string]
// The settings these dialogs change; a number field holds the text typed in it until saved.
type SettingKey = 'defaultDemoDurationDays'|'maxDemoUsers'|'organizationDeletionGraceDays'|'supportEmail'
type SettingsForm = Omit<PlatformSettings,SettingKey> & { [K in SettingKey]: PlatformSettings[K]|string }
type SettingField = { key: SettingKey, min?: number, max?: number, email?: boolean, unit?: Pair, label: Pair, hint: Pair }
const KINDS: Record<string,SettingField[]>={
  demo:[
    {key:'defaultDemoDurationDays',min:1,max:365,unit:['ημέρες','days'],label:['Διάρκεια νέου Demo','New Demo duration'],hint:['Η λήξη που προτείνεται όταν δημιουργείτε Demo.','The end date suggested when you create a Demo.']},
    {key:'maxDemoUsers',min:1,max:20,unit:['χρήστες','users'],label:['Χρήστες ανά Demo','Users per Demo'],hint:['Το πολύ τόσοι λογαριασμοί σε κάθε Demo, μαζί με όσους προσθέτει ο Διαχειριστής του.','At most this many accounts in each Demo, including those its Administrator adds.']},
  ],
  organizations:[
    {key:'organizationDeletionGraceDays',min:1,max:365,unit:['ημέρες','days'],label:['Περίοδος χάριτος διαγραφής','Deletion grace period'],hint:['Ημέρες από τον προγραμματισμό έως την οριστική διαγραφή ενός οργανισμού.','Days from scheduling until an organization is deleted for good.']},
    {key:'supportEmail',email:true,label:['Email υποστήριξης','Support email'],hint:['Η διεύθυνση που βλέπουν τα νοσοκομεία για βοήθεια.','The address hospitals see for help.']},
  ],
}

export function PlatformSettingsDialog({kind,language='el',onClose,onSaved}: {kind: string,language?: string,onClose: ()=>void,onSaved?: (settings: PlatformSettings)=>void}){
  const en=language==='en'
  const tx=(elText: string,enText: string)=>en?enText:elText
  const {notify,notifyError}=useFeedback()
  const fields=KINDS[kind]||[]
  const [settings,setSettings]=useState<SettingsForm | null>(null)
  const [error,setError]=useState<unknown>(null)
  const [saving,setSaving]=useState(false)
  useEffect(()=>{let active=true;getPlatformSettings().then(value=>{if(active)setSettings(value)}).catch(err=>{if(active)setError(err)});return()=>{active=false}},[])
  const valid=(field: SettingField)=>{const value=settings?.[field.key];if(field.email)return !value||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());const number=Number(value);return number>=field.min!&&number<=field.max!}
  const canSave=Boolean(settings)&&fields.every(valid)&&!saving
  async function save(){
    if(!canSave)return
    setSaving(true)
    try{
      const value=await updatePlatformSettings(settings!)
      notify(tx('Οι ρυθμίσεις αποθηκεύτηκαν.','Settings saved.'),'success',{operation:'platform_settings_update'})
      onSaved?.(value)
      onClose()
    }catch(err){notifyError(err,'save',{operation:'platform_settings_update'})}
    finally{setSaving(false)}
  }
  return <ObserverDialog width="compact" title={kind==='demo'?tx('Ρυθμίσεις Demo','Demo settings'):tx('Ρυθμίσεις οργανισμών','Organization settings')} onClose={onClose} footer={<DialogActions onSave={save} disabled={!canSave}/>}>
    {error?<div className="data-access-state warning"><AlertTriangle size={16}/><span>{tx('Δεν ήταν δυνατή η φόρτωση των ρυθμίσεων.','The settings could not be loaded.')}</span></div>
    :!settings?<div className="inline-empty">{tx('Φόρτωση…','Loading…')}</div>
    :<div className="platform-settings-dialog">{fields.map(field=><label key={field.key} className="field">
      <span className="lo-field-label">{tx(...field.label)}</span>
      {field.email
        ?<input type="email" value={settings[field.key]||''} placeholder="support@example.org" onChange={event=>setSettings(current=>({...current!,[field.key]:event.target.value}))}/>
        :<div className="platform-settings-duration-control"><input type="number" min={field.min} max={field.max} value={settings[field.key]} onChange={event=>setSettings(current=>({...current!,[field.key]:event.target.value}))}/><span>{tx(...field.unit!)}</span></div>}
      <small className={valid(field)?'field-hint':'field-error'}>{valid(field)?tx(...field.hint):field.email?tx('Μη έγκυρο email.','Invalid email.'):tx(`Επιτρέπονται ${field.min}–${field.max}.`,`Allowed range is ${field.min}–${field.max}.`)}</small>
    </label>)}</div>}
  </ObserverDialog>
}
