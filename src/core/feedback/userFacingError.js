const technicalTerms=/\b(supabase|postgres|postgresql|rls|row level security|rpc|storage bucket|service[_ -]?role|anon key|jwt|edge function|database|sql)\b/gi

function text(error){return String(error?.message||error?.error_description||error?.details||error||'').trim()}

export function userFacingError(error,{language='el',context='generic'}={}){
  const raw=text(error)
  const lower=raw.toLowerCase()
  const en=language==='en'

  if(lower.includes('committee_meeting_cancellation_reason_required')){
    return en?'Enter a reason before cancelling the meeting.':'Συμπληρώστε αιτιολογία πριν ακυρώσετε τη συνεδρίαση.'
  }
  if(lower.includes('committee_meeting_cancellation_not_allowed')||lower.includes('committee_meeting_cancelled_immutable')){
    return en?'This meeting can no longer be cancelled or restored.':'Η συγκεκριμένη συνεδρίαση δεν μπορεί πλέον να ακυρωθεί ή να επανενεργοποιηθεί.'
  }
  if(lower.includes('committee_meeting_not_found')){
    return en?'The meeting could not be found. Refresh the committee and try again.':'Η συνεδρίαση δεν βρέθηκε. Ανανεώστε την επιτροπή και δοκιμάστε ξανά.'
  }
  if(lower.includes('committee_minutes_approver_account_required')){
    return en?'The minutes cannot be submitted for approval because one or more present voting members do not have a linked user account.':'Δεν είναι δυνατή η υποβολή των πρακτικών για έγκριση, επειδή ένα ή περισσότερα παρόντα μέλη με δικαίωμα ψήφου δεν διαθέτουν συνδεδεμένο λογαριασμό.'
  }
  if(lower.includes('committee_minutes_approval_required')){
    return en?'The minutes must complete the approval workflow before they can be finalized.':'Τα πρακτικά πρέπει να ολοκληρώσουν τη διαδικασία έγκρισης πριν οριστικοποιηθούν.'
  }
  if(lower.includes('committee_approval_rejection_comment_required')||lower.includes('committee_minutes_approval_comment_required')){
    return en?'Describe the required corrections before sending the request.':'Περιγράψτε τις απαιτούμενες διορθώσεις πριν αποστείλετε το αίτημα.'
  }
  if(lower.includes('committee_approval_already_decided')||lower.includes('committee_minutes_approval_already_decided')){
    return en?'Your decision has already been recorded and cannot be changed.':'Η απόφασή σας έχει ήδη καταγραφεί και δεν μπορεί να αλλάξει.'
  }
  if(lower.includes('approval_not_available')||lower.includes('committee_approval_not_available')){
    return en?'This approval request is no longer available. It may already have been completed or replaced by a newer request.':'Το αίτημα έγκρισης δεν είναι πλέον διαθέσιμο. Μπορεί να έχει ήδη ολοκληρωθεί ή να έχει αντικατασταθεί από νεότερο αίτημα.'
  }
  if(lower.includes('committee_membership_approval_not_available')){
    return en?'This participation request is no longer available for approval.':'Το αίτημα συμμετοχής δεν είναι πλέον διαθέσιμο για έγκριση.'
  }
  if(lower.includes('committee_member_user_not_in_organization')){
    return en?'The selected member account does not belong to this organization.':'Ο λογαριασμός του επιλεγμένου μέλους δεν ανήκει σε αυτόν τον οργανισμό.'
  }
  if(lower.includes('committee_membership_approval_status_invalid')||lower.includes('invalid_committee_membership_approval_status')){
    return en?'The participation approval status is not valid.':'Η κατάσταση έγκρισης συμμετοχής δεν είναι έγκυρη.'
  }
  if(lower.includes('permission')||lower.includes('not authorized')||lower.includes('row-level security')||lower.includes('rls')){
    return en?'You do not have permission to complete this action.':'Δεν έχετε δικαίωμα να ολοκληρώσετε αυτή την ενέργεια.'
  }
  if(lower.includes('duplicate')||lower.includes('23505')||lower.includes('already exists')){
    return en?'A record with the same identifying information already exists.':'Υπάρχει ήδη εγγραφή με τα ίδια αναγνωριστικά στοιχεία.'
  }
  if(lower.includes('foreign key')||lower.includes('23503')||lower.includes('still referenced')){
    return en?'This record cannot be deleted because it is used by other information in the system.':'Η εγγραφή δεν μπορεί να διαγραφεί επειδή χρησιμοποιείται από άλλα στοιχεία της εφαρμογής.'
  }
  if(lower.includes('network')||lower.includes('fetch')||lower.includes('timeout')||lower.includes('offline')){
    return en?'The service is temporarily unavailable. Check your connection and try again.':'Η υπηρεσία δεν είναι προσωρινά διαθέσιμη. Ελέγξτε τη σύνδεσή σας και δοκιμάστε ξανά.'
  }
  if(lower.includes('production_')||lower.includes('not configured')||lower.includes('configuration')){
    return en?'The application is not ready to complete this action. Please contact the administrator.':'Η εφαρμογή δεν είναι έτοιμη να ολοκληρώσει αυτή την ενέργεια. Επικοινωνήστε με τον διαχειριστή.'
  }
  if(lower.includes('invalid login')||lower.includes('invalid credentials')||lower.includes('email not confirmed')){
    return en?'Sign in failed. Check your username and password.':'Η σύνδεση απέτυχε. Ελέγξτε το όνομα χρήστη και τον κωδικό πρόσβασης.'
  }

  const generic={
    save:en?'The information could not be saved. Please try again.':'Δεν ήταν δυνατή η αποθήκευση των στοιχείων. Δοκιμάστε ξανά.',
    delete:en?'The record could not be deleted. Please try again.':'Δεν ήταν δυνατή η διαγραφή της εγγραφής. Δοκιμάστε ξανά.',
    load:en?'The information could not be loaded. Please try again.':'Δεν ήταν δυνατή η φόρτωση των στοιχείων. Δοκιμάστε ξανά.',
    login:en?'Sign in could not be completed. Please try again.':'Δεν ήταν δυνατή η σύνδεση. Δοκιμάστε ξανά.',
    upload:en?'The file could not be uploaded. Please try again.':'Δεν ήταν δυνατή η αποστολή του αρχείου. Δοκιμάστε ξανά.',
    generic:en?'The action could not be completed. Please try again.':'Δεν ήταν δυνατή η ολοκλήρωση της ενέργειας. Δοκιμάστε ξανά.',
  }
  return generic[context]||generic.generic
}

export function sanitizeUserMessage(message,{language='el'}={}){
  const value=String(message||'').trim()
  if(!value)return userFacingError(null,{language})
  if(!technicalTerms.test(value))return value
  technicalTerms.lastIndex=0
  return userFacingError(null,{language})
}
