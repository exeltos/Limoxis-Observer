// The audit trail in words (Ιστορικό & Υγεία › Ενέργειες & πρόσβαση, the user record's Δραστηριότητα): never a table
// name or a UUID in the list. The technical identifier goes into the tooltip and the Excel export only.
import { athensTime } from './platformOverviewShared'
import type { AnyRecord } from '../../types/featureTypes'

const EVENTS: Record<string,[string,string]>={
  create:['Δημιουργία','Created'],insert:['Δημιουργία','Created'],update:['Ενημέρωση','Updated'],delete:['Διαγραφή','Deleted'],suspend:['Παύση','Suspended'],reactivate:['Επανενεργοποίηση','Reactivated'],reset_password:['Επαναφορά κωδικού','Password reset'],invite:['Πρόσκληση','Invited'],
  platform_organization_create:['Δημιουργία οργανισμού','Organization created'],platform_organization_update:['Ενημέρωση οργανισμού','Organization updated'],platform_organization_delete:['Διαγραφή οργανισμού','Organization deleted'],platform_organization_status:['Αλλαγή κατάστασης οργανισμού','Organization status changed'],
  platform_admin_assign:['Ανάθεση Διαχειριστή Νοσοκομείου','Hospital Admin assigned'],platform_admin_invite:['Πρόσκληση Διαχειριστή Νοσοκομείου','Hospital Admin invited'],platform_settings_update:['Αλλαγή ρυθμίσεων πλατφόρμας','Platform settings changed'],
  'platform.organization.purged':['Οριστική διαγραφή οργανισμού','Organization permanently deleted'],'platform.organization.purge_cleanup':['Διαγραφή αρχείων & λογαριασμών οργανισμού','Organization files & accounts removed'],
  'platform.organization_created':['Δημιουργία οργανισμού','Organization created'],'platform.organization.exported':['Δημιουργία αντιγράφου οργανισμού','Organization backup created'],'platform.demo.created':['Δημιουργία Demo','Demo created'],
  'platform.accounts.bulk_started':['Έναρξη μαζικής δημιουργίας λογαριασμών','Bulk account creation started'],'platform.accounts.bulk_finished':['Ολοκλήρωση μαζικής δημιουργίας λογαριασμών','Bulk account creation finished'],
  'organization.user.created_active':['Δημιουργία ενεργού χρήστη','Active user created'],'organization.user.created_from_employee':['Δημιουργία χρήστη από εργαζόμενο','User created from an employee'],'organization.user.linked_existing_account':['Σύνδεση υπάρχοντος λογαριασμού','Existing account linked'],
  'organization.user.access_resent':['Επαναποστολή πρόσβασης χρήστη','User access re-sent'],'organization.user.access_redeemed':['Ενεργοποίηση λογαριασμού χρήστη','User account activated'],'organization.user.invitation_link':['Δημιουργία συνδέσμου πρόσκλησης','Invitation link created'],'organization.user.creation_failed':['Αποτυχία δημιουργίας χρήστη','User creation failed'],
  'patient.admission_transferred':['Μεταφορά ασθενούς','Patient transferred'],'patient.admission_discharged':['Εξιτήριο ασθενούς','Patient discharged'],
}
export const eventLabel=(value: string,en: boolean)=>EVENTS[value]?.[en?1:0]||(en?'Other action':'Άλλη ενέργεια')

const ENTITIES: Record<string,[string,string]>={
  organization:['Οργανισμός','Organization'],organizations:['Οργανισμός','Organization'],organization_member:['Μέλος οργανισμού','Organization member'],organization_members:['Μέλος οργανισμού','Organization member'],profile:['Προφίλ','Profile'],profiles:['Προφίλ','Profile'],
  demo_entitlement:['Demo πρόσβαση','Demo access'],demo_entitlements:['Demo πρόσβαση','Demo access'],platform_demo_entitlement:['Demo πρόσβαση','Demo access'],platform_settings:['Ρυθμίσεις πλατφόρμας','Platform settings'],platform_organization_export:['Αντίγραφο οργανισμού','Organization backup'],platform_purge_tickets:['Οριστική διαγραφή οργανισμού','Organization purge'],
  account_access:['Πρόσβαση λογαριασμού','Account access'],account_invitation:['Πρόσκληση λογαριασμού','Account invitation'],account_invitations:['Πρόσκληση λογαριασμού','Account invitation'],account_creation_batch:['Μαζική δημιουργία λογαριασμών','Bulk account creation'],account_creation_batches:['Μαζική δημιουργία λογαριασμών','Bulk account creation'],
  user:['Χρήστης','User'],employee:['Εργαζόμενος','Employee'],employees:['Εργαζόμενος','Employee'],employee_certificates:['Πιστοποιητικό εργαζομένου','Employee certificate'],employee_evaluations:['Αξιολόγηση εργαζομένου','Employee evaluation'],employee_vaccinations:['Εμβολιασμός εργαζομένου','Employee vaccination'],
  departments:['Τμήμα','Department'],custom_roles:['Προσαρμοσμένος ρόλος','Custom role'],custom_role_capabilities:['Δικαιώματα ρόλου','Role permissions'],role_capabilities:['Δικαιώματα ρόλου','Role permissions'],organization_member_capabilities:['Δικαιώματα χρήστη','User permissions'],organization_member_scopes:['Εύρος χρήστη','User scope'],
  patients:['Ασθενής','Patient'],patient_admission:['Νοσηλεία','Admission'],patient_admissions:['Νοσηλεία','Admission'],clinical_assessment:['Κλινική εκτίμηση','Clinical assessment'],clinical_assessments:['Κλινική εκτίμηση','Clinical assessment'],clinical_case:['Κλινικό περιστατικό','Clinical case'],
  surveillance_cases:['Περιστατικό επιτήρησης','Surveillance case'],surveillance_devices:['Συσκευή επιτήρησης','Surveillance device'],surveillance_outcomes:['Έκβαση επιτήρησης','Surveillance outcome'],surveillance_reassessments:['Επανεκτίμηση επιτήρησης','Surveillance reassessment'],surveillance_events:['Συμβάν επιτήρησης','Surveillance event'],
  hai_classifications:['Ταξινόμηση λοίμωξης','Infection classification'],amr_classifications:['Ταξινόμηση αντοχής','Resistance classification'],isolation_episodes:['Απομόνωση','Isolation'],laboratory_sample:['Δείγμα εργαστηρίου','Laboratory sample'],laboratory_samples:['Δείγμα εργαστηρίου','Laboratory sample'],
  microbiology_results:['Μικροβιολογικό αποτέλεσμα','Microbiology result'],antimicrobial_susceptibility_results:['Αντιβιόγραμμα','Susceptibility result'],antimicrobial_therapies:['Αντιμικροβιακή αγωγή','Antimicrobial therapy'],critical_result_communications:['Ανακοίνωση κρίσιμου αποτελέσματος','Critical result notification'],
  notifiable_disease_reports:['Δήλωση νοσήματος','Disease notification'],notifiable_disease_report:['Δήλωση νοσήματος','Disease notification'],control_definitions:['Έλεγχος','Control'],controlled_document:['Ελεγχόμενο έγγραφο','Controlled document'],controlled_documents:['Ελεγχόμενο έγγραφο','Controlled document'],environmental_standards:['Περιβαλλοντικό πρότυπο','Environmental standard'],
  committees:['Επιτροπή','Committee'],committee_document:['Έγγραφο επιτροπής','Committee document'],committee_meetings:['Συνεδρίαση επιτροπής','Committee meeting'],committee_meeting_attendance:['Παρουσίες συνεδρίασης','Meeting attendance'],committee_minutes_approvals:['Έγκριση πρακτικού','Minutes approval'],committee_plan_items:['Πρόγραμμα επιτροπής','Committee plan'],
  management_announcements:['Ανακοίνωση νοσοκομείου','Hospital announcement'],management_announcement_acknowledgements:['Επιβεβαίωση ανακοίνωσης','Announcement acknowledgement'],platform_announcements:['Ανακοίνωση πλατφόρμας','Platform announcement'],master_library_items:['Στοιχείο λίστας','List item'],external_reference_versions:['Έκδοση πηγής','Source version'],
  training_records:['Εγγραφή εκπαίδευσης','Training record'],training_program:['Πρόγραμμα εκπαίδευσης','Training programme'],training_programs:['Πρόγραμμα εκπαίδευσης','Training programme'],training_assignment:['Ανάθεση εκπαίδευσης','Training assignment'],training_assignments:['Ανάθεση εκπαίδευσης','Training assignment'],
  quality_audits:['Εσωτερικός έλεγχος','Internal audit'],quality_audit:['Εσωτερικός έλεγχος','Internal audit'],quality_self_assessments:['Αυτοαξιολόγηση','Self-assessment'],quality_supplier:['Προμηθευτής','Supplier'],quality_suppliers:['Προμηθευτής','Supplier'],quality_supplier_certificate_request:['Αίτημα πιστοποιητικού προμηθευτή','Supplier certificate request'],
}
const FAMILIES: [string,string,string][]=[['quality_','Εγγραφή ποιότητας','Quality record'],['training_','Εγγραφή εκπαίδευσης','Training record'],['kitchen_','Εγγραφή κουζίνας','Kitchen record'],['hr_','Εγγραφή προσλήψεων','Recruitment record'],['committee_','Εγγραφή επιτροπής','Committee record'],['surveillance_','Εγγραφή επιτήρησης','Surveillance record'],['lira_','Εγγραφή LIRA','LIRA record'],['employee_','Εγγραφή εργαζομένου','Employee record'],['department_','Εγγραφή τμήματος','Department record'],['patient_','Εγγραφή ασθενούς','Patient record'],['control_','Εγγραφή ελέγχων','Control record'],['clinical_','Κλινική εγγραφή','Clinical record'],['platform_','Εγγραφή πλατφόρμας','Platform record']]
export function entityLabel(value: unknown,en: boolean){
  const key=String(value||''),hit=ENTITIES[key]
  if(hit)return hit[en?1:0]
  const family=FAMILIES.find(([prefix])=>key.startsWith(prefix))
  if(family)return en?family[2]:family[1]
  return en?'Other record':'Άλλη εγγραφή'
}

// «Ενημέρωση εργαζομένων» ×15 in one row: identical consecutive events of one person on one kind of record,
// each within `windowMinutes` of the one before. `rows` are newest first; so are the groups.
export function groupAuditEvents(rows: AnyRecord[]=[],{windowMinutes=15}: {windowMinutes?: number}={}){
  const groups: AnyRecord[]=[],gap=windowMinutes*60000
  for(const row of rows){
    const last=groups[groups.length-1],time=new Date(row.createdAt).getTime()
    if(last&&last.actorId===row.actorId&&last.eventType===row.eventType&&last.entityType===row.entityType&&last.organizationId===row.organizationId&&Number.isFinite(time)&&last.oldestTime-time<=gap&&last.oldestTime>=time){
      last.count+=1;last.oldestTime=time;last.from=row.createdAt;last.entityIds.push(row.entityId);last.rows.push(row)
    }else groups.push({id:row.id,actorId:row.actorId,actorName:row.actorName,actorRole:row.actorRole,organizationId:row.organizationId,metadata:row.metadata,eventType:row.eventType,entityType:row.entityType,count:1,to:row.createdAt,from:row.createdAt,oldestTime:time,entityIds:[row.entityId],rows:[row]})
  }
  return groups
}

// One readable line for a group: action (+ count), the kind of record and its name when it is known, the time.
// names: {organization(id), user({userId,memberId}), employee(id)} → name or ''. All optional.
// Ονόματα για την περιγραφή: οργανισμός (id), χρήστης ({userId, memberId}), εργαζόμενος (id).
export type AuditNames = { organization?: (id: string)=>string, user?: (ref: AnyRecord)=>string, employee?: (id: string)=>string }
export function describeAuditGroup(group: AnyRecord,{en=false,names={}}: {en?: boolean,names?: AuditNames}={}){
  const ids=[...new Set<string>(group.entityIds.filter(Boolean))]
  const one=ids.length===1?ids[0]:''
  let name=''
  if(one){
    if(group.entityType==='organization'||group.entityType==='organizations')name=names.organization?.(one)||''
    else if(['organization_member','organization_members','profile','profiles','user'].includes(group.entityType))name=names.user?.({userId:one,memberId:one})||''
    else if(group.entityType==='employee'||group.entityType==='employees')name=names.employee?.(one)||''
  }
  const action=eventLabel(group.eventType,en)+(group.count>1?` ×${group.count}`:'')
  const first=group.from,last=group.to
  const when=group.count>1&&athensTime(first)!==athensTime(last)?`${athensTime(first)}–${athensTime(last)}`:''
  return {action,entity:entityLabel(group.entityType,en),name,when,technical:ids.slice(0,5).join(', ')}
}
