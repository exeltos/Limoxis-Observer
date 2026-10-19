import { CheckCircle2, Pencil, Paperclip, Plus, Trash2 } from 'lucide-react'
import { useLanguage } from '../core/i18n/LanguageContext'
import { useTenant } from '../core/tenant/TenantContext'
import { useFeedback } from '../core/feedback/FeedbackContext'
import { canPerform, UI_ACTIONS } from '../core/actions/actionPolicy'
import { ActionButton } from './ActionButton'
import { ExportMenu } from './ExportMenu'

const config={
 create:{icon:Plus,key:'create',tone:'primary'},
 edit:{icon:Pencil,key:'edit',tone:'edit'},
 delete:{icon:Trash2,key:'delete',tone:'danger'},
 attach:{icon:Paperclip,key:'attachments',tone:'neutral'},
 complete:{icon:CheckCircle2,key:'complete',tone:'success'},
 approve:{icon:CheckCircle2,key:'approval',tone:'success'},
}
export function RecordActions({actions=[],resourceCapability,actionCapabilities={},actionLabels={},locked=false,onAction=()=>{},iconOnly=false}){
 const {t}=useLanguage()
 const {role,actualRole,membership}=useTenant()
 const {confirm}=useFeedback()
 const permissionRole=role||actualRole
 const addOns=membership?.capabilities??[]
 const customCapabilities=membership?.customCapabilities??[]
 async function dispatch(action){
  if(action===UI_ACTIONS.DELETE){
   const ok=await confirm({title:t('delete'),message:t('deleteConfirm'),confirmLabel:t('delete'),danger:true})
   if(!ok)return
  }
  onAction(action)
 }
 const allowed=actions.filter(action=>canPerform({role:permissionRole,addOns,customCapabilities,action,resourceCapability:actionCapabilities[action]??resourceCapability,locked}))
 // Print and export join the one export control (ExportMenu: Print, Excel).
 const exportable=allowed.filter(action=>action===UI_ACTIONS.PRINT||action===UI_ACTIONS.EXPORT)
 return <div className="record-actions">
  {exportable.length>0&&<ExportMenu onPrint={exportable.includes(UI_ACTIONS.PRINT)?()=>dispatch(UI_ACTIONS.PRINT):undefined} onExcel={exportable.includes(UI_ACTIONS.EXPORT)?()=>dispatch(UI_ACTIONS.EXPORT):undefined}/>}
  {allowed.filter(action=>!exportable.includes(action)).map(action=>{const item=config[action];if(!item)return null;const Icon=item.icon;const compact=iconOnly;const label=actionLabels[action]||t(item.key);return <ActionButton key={action} label={label} tone={item.tone} iconOnly={compact} onClick={()=>dispatch(action)}><Icon size={15}/>{!compact&&<span>{label}</span>}</ActionButton>})}
 </div>
}
