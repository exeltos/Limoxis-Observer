import { CheckCircle2, Pencil, Download, Paperclip, Plus, Printer, Trash2 } from 'lucide-react'
import { useLanguage } from '../core/i18n/LanguageContext'
import { useTenant } from '../core/tenant/TenantContext'
import { useFeedback } from '../core/feedback/FeedbackContext'
import { canPerform, UI_ACTIONS } from '../core/actions/actionPolicy'
import { ActionButton } from './ActionButton'

const config={
 create:{icon:Plus,key:'create',tone:'primary'},
 edit:{icon:Pencil,key:'edit',tone:'edit'},
 delete:{icon:Trash2,key:'delete',tone:'danger'},
 attach:{icon:Paperclip,key:'attachments',tone:'neutral'},
 print:{icon:Printer,key:'print',tone:'neutral'},
 export:{icon:Download,key:'export',tone:'neutral'},
 complete:{icon:CheckCircle2,key:'complete',tone:'success'},
 approve:{icon:CheckCircle2,key:'approval',tone:'success'},
}
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
 return <div className="record-actions">{actions.filter(action=>canPerform({role,addOns,customCapabilities,action,resourceCapability:actionCapabilities[action]??resourceCapability,locked})).map(action=>{const item=config[action];if(!item)return null;const Icon=item.icon;const compact=iconOnly||action===UI_ACTIONS.PRINT||action===UI_ACTIONS.EXPORT;return <ActionButton key={action} label={t(item.key)} tone={item.tone} iconOnly={compact} onClick={()=>dispatch(action)}><Icon size={15}/>{!compact&&<span>{t(item.key)}</span>}</ActionButton>})}</div>
}
