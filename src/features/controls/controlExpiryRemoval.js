import { updateControlExecution } from './controlCloudService'
import { markRowRemoved } from './controlExpiry'

// «Removed / replaced» on an expiry item: asks first, then marks the item's row
// in the entry it came from, so it leaves the list and stops alerting.
export async function removeExpiryItem({item,organizationId,actor,language,confirm,notify,notifyError,reload}){
 const en=language==='en'
 const ok=await confirm({title:en?'Remove item from the list':'Αφαίρεση υλικού από τη λίστα',message:en?`${item.row.item} will leave the expiry list and stop alerting. Continue?`:`Το «${item.row.item}» θα φύγει από τη λίστα λήξεων και δεν θα ειδοποιεί πια. Θέλετε να συνεχίσετε;`,confirmLabel:en?'Removed / replaced':'Αφαιρέθηκε / Αντικαταστάθηκε'})
 if(!ok)return
 const execution=item.execution
 try{
  await updateControlExecution(organizationId,item.record,item.department,execution,{value:execution.value,notes:execution.notes,hasFinding:execution.hasFinding,structuredData:markRowRemoved(execution,item.index,{actorName:actor.name}),actor,reason:`${en?'Item removed / replaced':'Αφαίρεση / αντικατάσταση υλικού'}: ${item.row.item}`})
  await reload()
  notify(en?'Item removed from the list.':'Το υλικό αφαιρέθηκε από τη λίστα.','success')
 }catch(error){notifyError(error,'save',{operation:'control_expiry_item_remove'})}
}
