import { LogIn,PauseCircle,Pencil,PlayCircle,Trash2 } from 'lucide-react'
import { IconButton } from '../../design-system/IconButton'

export function PlatformOrganizationActions({organization,language='el',onEnter,onEdit,onTogglePause,onDelete}){
  const en=language==='en',suspended=organization.status==='suspended'
  return <div className="platform-org-actions">
    <IconButton tone="primary" label={en?'Enter organization':'Είσοδος στον οργανισμό'} onClick={onEnter}><LogIn size={18}/></IconButton>
    <IconButton tone="edit" label={en?'Edit organization':'Επεξεργασία οργανισμού'} onClick={onEdit}><Pencil size={17}/></IconButton>
    <IconButton tone={suspended?'success':'neutral'} label={suspended?(en?'Reactivate':'Ενεργοποίηση'):(en?'Suspend':'Παύση')} onClick={onTogglePause}>{suspended?<PlayCircle size={17}/>:<PauseCircle size={17}/>}</IconButton>
    <IconButton tone="danger" label={en?'Delete permanently':'Οριστική διαγραφή'} onClick={onDelete}><Trash2 size={17}/></IconButton>
  </div>
}
