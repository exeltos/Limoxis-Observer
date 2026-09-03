import { useState } from 'react'
import { KeyRound,LogIn,PauseCircle,Pencil,PlayCircle,Trash2 } from 'lucide-react'
import { IconButton } from '../../design-system/IconButton'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { listOrganizationMembersDetailed,manageOrganizationUser } from '../../core/tenant/tenantService'

export function PlatformOrganizationActions({organization,language='el',onEnter,onEdit,onTogglePause,onDelete}){
  const en=language==='en',suspended=organization.status==='suspended'
  const {notify,notifyError,confirm}=useFeedback()
  const [resetting,setResetting]=useState(false)

  async function resetHospitalAdminPassword(){
    if(resetttingGuard())return
    setResetting(true)
    try{
      const users=await listOrganizationMembersDetailed(organization.id)
      const admin=users.find(user=>user.role==='hospital_admin')
      if(!admin){
        notify(en?'No Hospital Admin is assigned to this organization.':'Δεν έχει οριστεί Hospital Admin για τον οργανισμό.','warning',{operation:'platform_admin_reset_password'})
        return
      }
      if(admin.status==='disabled'){
        notify(en?'Reactivate the Hospital Admin before resetting the password.':'Επανενεργοποίησε πρώτα τον Hospital Admin πριν από επαναφορά κωδικού.','warning',{operation:'platform_admin_reset_password'})
        return
      }

      const invited=admin.status==='invited'
      const ok=await confirm({
        title:invited?(en?'Resend Hospital Admin invitation':'Επαναποστολή πρόσκλησης Hospital Admin'):(en?'Reset Hospital Admin password':'Επαναφορά κωδικού Hospital Admin'),
        message:invited
          ?(en?`The Hospital Admin invitation for “${organization.name}” will be sent again to ${admin.email||'the registered email address'}. Do you want to continue?`:`Η πρόσκληση του Hospital Admin για τον οργανισμό «${organization.name}» θα αποσταλεί ξανά στο ${admin.email||'καταχωρημένο email'}. Θέλεις να συνεχίσεις;`)
          :(en?`A password-reset email will be sent to the Hospital Admin of “${organization.name}” at ${admin.email||'the registered email address'}. No password will be changed until the recipient completes the secure reset flow. Do you want to continue?`:`Θα αποσταλεί email ασφαλούς επαναφοράς κωδικού στον Hospital Admin του οργανισμού «${organization.name}» στο ${admin.email||'καταχωρημένο email'}. Ο κωδικός δεν αλλάζει μέχρι ο παραλήπτης να ολοκληρώσει τη διαδικασία. Θέλεις να συνεχίσεις;`),
        confirmLabel:invited?(en?'Resend invitation':'Επαναποστολή'):(en?'Send reset email':'Αποστολή email'),
      })
      if(!ok)return

      if(invited){
        const result=await manageOrganizationUser({organizationId:organization.id,userId:admin.userId,action:'resend_invitation'})
        notify(result?.emailSent?(en?'Hospital Admin invitation resent.':'Η πρόσκληση του Hospital Admin επαναποστάλθηκε.'):(en?'Invitation refreshed.':'Η πρόσκληση ανανεώθηκε.'),'success',{operation:'platform_admin_resend_invitation'})
        return
      }

      await manageOrganizationUser({organizationId:organization.id,userId:admin.userId,action:'reset_password'})
      notify(en?'Password reset email sent to the Hospital Admin.':'Στάλθηκε email επαναφοράς κωδικού στον Hospital Admin.','success',{operation:'platform_admin_reset_password'})
    }catch(error){notifyError(error,'action',{operation:'platform_admin_reset_password'})}
    finally{setResetting(false)}
  }

  function resetttingGuard(){return resetting||!organization?.id}

  return <div className="platform-org-actions" aria-label={en?'Organization actions':'Ενέργειες οργανισμού'}>
    <Action icon={<LogIn size={18}/>} tone="primary" label={en?'Enter':'Είσοδος'} title={en?'Enter organization':'Είσοδος στον οργανισμό'} onClick={onEnter}/>
    <Action icon={<Pencil size={17}/>} tone="edit" label={en?'Edit':'Επεξεργασία'} title={en?'Edit organization':'Επεξεργασία οργανισμού'} onClick={onEdit}/>
    <Action icon={<KeyRound size={17}/>} tone="neutral" label={en?'Reset password':'Επαναφορά κωδικού'} title={en?'Reset Hospital Admin password':'Επαναφορά κωδικού Hospital Admin'} disabled={resetting} onClick={resetHospitalAdminPassword}/>
    <Action icon={suspended?<PlayCircle size={17}/>:<PauseCircle size={17}/>} tone={suspended?'success':'neutral'} label={suspended?(en?'Reactivate':'Ενεργοποίηση'):(en?'Suspend':'Παύση')} title={suspended?(en?'Reactivate organization':'Ενεργοποίηση οργανισμού'):(en?'Suspend organization':'Παύση οργανισμού')} onClick={onTogglePause}/>
    <Action icon={<Trash2 size={17}/>} tone="danger" label={en?'Delete':'Διαγραφή'} title={en?'Delete permanently':'Οριστική διαγραφή'} onClick={onDelete}/>
  </div>
}

function Action({icon,tone,label,title,onClick,disabled=false}){
  return <div className="platform-org-action-item"><IconButton tone={tone} label={title} disabled={disabled} onClick={onClick}>{icon}</IconButton><span>{label}</span></div>
}
