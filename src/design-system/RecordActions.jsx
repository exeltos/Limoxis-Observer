import { CheckCircle2, Edit3, Download, Paperclip, Plus, Printer, Trash2 } from 'lucide-react'
import { useLanguage } from '../core/i18n/LanguageContext'
import { useTenant } from '../core/tenant/TenantContext'
import { useFeedback } from '../core/feedback/FeedbackContext'
import { canPerform, UI_ACTIONS } from '../core/actions/actionPolicy'

const config={create:{icon:Plus,key:'create'},edit:{icon:Edit3,key:'edit'},delete:{icon:Trash2,key:'delete'},attach:{icon:Paperclip,key:'attachments'},print:{icon:Printer,key:'print'},export:{icon:Download,key:'export'},complete:{icon:CheckCircle2,key:'complete'},approve:{icon:CheckCircle2,key:'approval'}}
export function RecordActions({actions=[],resourceCapability,actionCapabilities={},locked=false,onAction=()=>{},iconOnly=false}){
 const {t}=useLanguage()
 const {role,membership}=useTenant()
 const {confirm}=useFeedback()
 const addOns=membership?.capabilities??[]
 const customCapabilities=membership?.customCapabilities??[]
 async function dispatch(action){
  if(action===UI_ACTIONS.DELETE){
   const ok=await confirm({title:t('delete'),message:t('deleteConfirm'),confirmLabel:t('delete'),danger:true})
   if(!ok)return
  }
  onAction(action)
 }
 return <div className="record-actions">{actions.filter(action=>canPerform({role,addOns,customCapabilities,action,resourceCapability:actionCapabilities[action]??resourceCapability,locked})).map(action=>{const item=config[action];if(!item)return null;const Icon=item.icon;const compact=iconOnly||action===UI_ACTIONS.PRINT||action===UI_ACTIONS.EXPORT;return <button type="button" key={action} className={`action-button ${compact?'icon-only':''} ${action===UI_ACTIONS.DELETE?'danger':''}`} onClick={()=>dispatch(action)} title={t(item.key)} aria-label={t(item.key)}><Icon size={15}/>{!compact&&<span>{t(item.key)}</span>}</button>})}</div>
}
