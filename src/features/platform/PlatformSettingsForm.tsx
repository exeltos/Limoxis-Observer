import './platformScreens.css'
import { useState } from 'react'
import { FormCard,FormGrid } from '../../design-system/FormCard'
import { SaveButton } from '../../design-system/SaveButton'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { updatePlatformSettings,type PlatformSettings } from './platformSettingsService'
import './platformSettings.css'

// The platform settings, one form per tab of «Ρυθμίσεις πλατφόρμας» (owner, 21/11/2026): Οργανισμοί (deletion grace
// period, support email), Demo (new Demo duration, users per Demo) and Σελίδα παρουσίασης (the contact details of the
// public page before sign-in). The same platform_settings row; a tab saves only its own fields over the saved row.
type Pair = [string,string]
export type PlatformSettingsKind = 'organizations'|'demo'|'presentation'
// The settings these forms change; a number field holds the text typed in it until saved.
type SettingKey = 'defaultDemoDurationDays'|'maxDemoUsers'|'organizationDeletionGraceDays'|'supportEmail'
type PublicKey = 'publicName'|'publicEmail'|'publicPhone'|'publicWebsite'
type SettingsForm = Omit<PlatformSettings,SettingKey> & { [K in SettingKey]: PlatformSettings[K]|string }
type SettingField = { key: SettingKey, min?: number, max?: number, email?: boolean, unit?: Pair, label: Pair, hint: Pair }
type PublicField = { key: PublicKey, type: 'text'|'email'|'tel'|'url', placeholder: string, label: Pair, hint: Pair }
const PUBLIC_FIELDS: PublicField[]=[
  {key:'publicName',type:'text',placeholder:'Exeltos',label:['Εταιρεία','Company'],hint:['Το όνομα στην ενότητα «Επικοινωνία» και στο κάτω μέρος της σελίδας.','The name in the “Contact” section and at the foot of the page.']},
  {key:'publicEmail',type:'email',placeholder:'info@exeltos.com',label:['Email επικοινωνίας','Contact email'],hint:['Εδώ φτάνουν τα αιτήματα παρουσίασης και στέλνει το «Στείλτε email».','Where demo requests arrive and “Send an email” writes to.']},
  {key:'publicPhone',type:'tel',placeholder:'694 247 1022',label:['Τηλέφωνο','Phone'],hint:['Όπως θα εμφανίζεται· χωρίς κωδικό χώρας μπαίνει το +30.','As it will be shown; without a country code +30 is added.']},
  {key:'publicWebsite',type:'url',placeholder:'https://exeltos.com/',label:['Ιστοσελίδα','Website'],hint:['Ανοίγει σε νέα καρτέλα.','Opens in a new tab.']},
]
const validEmail=(value: unknown)=>!value||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim())
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
const TITLES: Record<PlatformSettingsKind,[Pair,Pair]>={
  organizations:[['Οργανισμοί','Organizations'],['Ισχύουν για όλους τους οργανισμούς.','They apply to every organization.']],
  demo:[['Demo','Demo'],['Οι προτάσεις όταν δημιουργείτε Demo.','The defaults when you create a Demo.']],
  presentation:[['Σελίδα παρουσίασης','Presentation page'],['Η δημόσια σελίδα πριν τη σύνδεση· ένα κενό πεδίο δείχνει την αρχική τιμή.','The public page before sign-in; an empty field shows the built-in value.']],
}

export function PlatformSettingsForm({kind,settings,language='el',onSaved}: {kind: PlatformSettingsKind,settings: PlatformSettings,language?: string,onSaved?: (settings: PlatformSettings)=>void}){
  const en=language==='en'
  const tx=(elText: string,enText: string)=>en?enText:elText
  const {notify,notifyError}=useFeedback()
  const fields=KINDS[kind]||[]
  const publicFields=kind==='presentation'?PUBLIC_FIELDS:[]
  const keys=[...fields.map(field=>field.key),...publicFields.map(field=>field.key)]
  const [draft,setDraft]=useState<SettingsForm>(settings)
  const [saving,setSaving]=useState(false)
  const valid=(field: SettingField)=>{const value=draft[field.key];if(field.email)return validEmail(value);const number=Number(value);return number>=field.min!&&number<=field.max!}
  const publicValid=(field: PublicField)=>field.type!=='email'||validEmail(draft[field.key])
  const changed=keys.some(key=>String(draft[key]??'')!==String(settings[key]??''))
  const canSave=changed&&fields.every(valid)&&publicFields.every(publicValid)&&!saving
  async function save(){
    if(!canSave)return
    setSaving(true)
    try{
      // Only this tab's fields over the saved row: the other tabs keep what is saved.
      const value=await updatePlatformSettings({...settings,...Object.fromEntries(keys.map(key=>[key,draft[key]]))})
      notify(tx('Οι ρυθμίσεις αποθηκεύτηκαν.','Settings saved.'),'success',{operation:'platform_settings_update'})
      setDraft(value)
      onSaved?.(value)
    }catch(err){notifyError(err,'save',{operation:'platform_settings_update'})}
    finally{setSaving(false)}
  }
  const [title,hint]=TITLES[kind]
  return <FormCard className="platform-settings-form" title={tx(...title)} hint={tx(...hint)}>
    {/* The presentation page spans the screen: its four fields side by side (two per row on a tablet). */}
    <FormGrid columns={kind==='presentation'?undefined:2} className={kind==='presentation'?'platform-settings-public-grid':''}>
      {fields.map(field=><label key={field.key} className="field">
        <span className="lo-field-label">{tx(...field.label)}</span>
        {field.email
          ?<input type="email" value={draft[field.key]||''} placeholder="support@example.org" onChange={event=>setDraft(current=>({...current,[field.key]:event.target.value}))}/>
          :<div className="platform-settings-duration-control"><input type="number" min={field.min} max={field.max} value={draft[field.key]} onChange={event=>setDraft(current=>({...current,[field.key]:event.target.value}))}/><span>{tx(...field.unit!)}</span></div>}
        <small className={valid(field)?'field-hint':'field-error'}>{valid(field)?tx(...field.hint):field.email?tx('Μη έγκυρο email.','Invalid email.'):tx(`Επιτρέπονται ${field.min}–${field.max}.`,`Allowed range is ${field.min}–${field.max}.`)}</small>
      </label>)}
      {publicFields.map(field=><label key={field.key} className="field">
        <span className="lo-field-label">{tx(...field.label)}</span>
        <input type={field.type} value={draft[field.key]||''} placeholder={field.placeholder} onChange={event=>setDraft(current=>({...current,[field.key]:event.target.value}))}/>
        <small className={publicValid(field)?'field-hint':'field-error'}>{publicValid(field)?tx(...field.hint):tx('Μη έγκυρο email.','Invalid email.')}</small>
      </label>)}
    </FormGrid>
    <div className="platform-settings-form-actions"><SaveButton onClick={save} disabled={!canSave} loading={saving} savingLabel={tx('Αποθήκευση…','Saving…')}>{tx('Αποθήκευση','Save')}</SaveButton></div>
  </FormCard>
}
