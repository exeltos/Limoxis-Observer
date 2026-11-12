import { CheckCircle2, Pencil, Paperclip, Plus, Trash2 } from 'lucide-react'
import { useLanguage } from '../core/i18n/LanguageContext'
import { useTenant } from '../core/tenant/TenantContext'
import { useFeedback } from '../core/feedback/FeedbackContext'
import { canPerform, UI_ACTIONS } from '../core/actions/actionPolicy'
import { ActionButton } from './ActionButton'
import { ExportMenu } from './ExportMenu'
import type { IconType } from './types'

// What this component reads from the tenant (TenantContext is not typed yet).
interface TenantView { role?: string | null; actualRole?: string | null; membership?: { capabilities?: string[]; customCapabilities?: string[] } | null }

const config: Record<string, { icon: IconType; key: string; tone: string }>={
 create:{icon:Plus,key:'create',tone:'primary'},
 edit:{icon:Pencil,key:'edit',tone:'edit'},
 delete:{icon:Trash2,key:'delete',tone:'danger'},
 attach:{icon:Paperclip,key:'attachments',tone:'neutral'},
 complete:{icon:CheckCircle2,key:'complete',tone:'success'},
 approve:{icon:CheckCircle2,key:'approval',tone:'success'},
}
interface RecordActionsProps {
  // UI_ACTIONS values (create, edit, delete, attach, complete, approve, print, export)
  actions?: string[]
  resourceCapability?: string
  actionCapabilities?: Record<string, string>
  actionLabels?: Record<string, string>
  locked?: boolean
  onAction?: (action: string) => void
  iconOnly?: boolean
}

export function RecordActions({actions=[],resourceCapability,actionCapabilities={},actionLabels={},locked=false,onAction=()=>{},iconOnly=false}: RecordActionsProps){
 const {t}=useLanguage()
 const {role,actualRole,membership}=useTenant() as TenantView
 const {confirm}=useFeedback()
 const permissionRole=role||actualRole
 const addOns=membership?.capabilities??[]
 const customCapabilities=membership?.customCapabilities??[]
 async function dispatch(action: string){
  if(action===UI_ACTIONS.DELETE){
   const ok=await confirm({title:t('delete'),message:t('deleteConfirm'),confirmLabel:t('delete'),danger:true})
   if(!ok)return
  }
  onAction(action)
 }
 const allowed=actions.filter(action=>canPerform({role:permissionRole,addOns,customCapabilities,action,resourceCapability:actionCapabilities[action]??resourceCapability,locked}))
 // Print and export join the one export control (ExportMenu: Print, Excel).
 const exportable: string[]=allowed.filter(action=>action===UI_ACTIONS.PRINT||action===UI_ACTIONS.EXPORT)
 return <div className="record-actions">
  {exportable.length>0&&<ExportMenu onPrint={exportable.includes(UI_ACTIONS.PRINT)?()=>dispatch(UI_ACTIONS.PRINT):undefined} onExcel={exportable.includes(UI_ACTIONS.EXPORT)?()=>dispatch(UI_ACTIONS.EXPORT):undefined}/>}
  {allowed.filter(action=>!exportable.includes(action)).map(action=>{const item=config[action];if(!item)return null;const Icon=item.icon;const compact=iconOnly;const label=actionLabels[action]||t(item.key);return <ActionButton key={action} label={label} tone={item.tone} iconOnly={compact} onClick={()=>dispatch(action)}><Icon size={15}/>{!compact&&<span>{label}</span>}</ActionButton>})}
 </div>
}
