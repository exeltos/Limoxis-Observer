const technicalTerms=/\b(supabase|postgres|postgresql|rls|row level security|rpc|storage bucket|service[_ -]?role|anon key|jwt|edge function|database|sql)\b/gi

function text(error){return String(error?.message||error?.error_description||error?.details||error||'').trim()}

// Field names as the user sees them in the forms, for messages that name the
// field a save failed on. Columns not listed fall back to a readable form of
// the column name.
const FIELD_LABELS={
 country:['Χώρα','Country'],name:['Επωνυμία / Όνομα','Name'],label:['Επωνυμία','Name'],code:['Κωδικός','Code'],title:['Τίτλος','Title'],
 type:['Τύπος','Type'],status:['Κατάσταση','Status'],city:['Πόλη','City'],region:['Περιφέρεια','Region'],health_region:['Υγειονομική Περιφέρεια','Health region'],
 contact_email:['Email','Email'],email:['Email','Email'],contact_phone:['Τηλέφωνο','Phone'],phone:['Τηλέφωνο','Phone'],username:['Όνομα χρήστη','Username'],
 valid_from:['Έναρξη','Start'],valid_until:['Λήξη','End'],starts_at:['Έναρξη','Start'],ends_at:['Λήξη','End'],
 department_id:['Τμήμα','Department'],department:['Τμήμα','Department'],first_name:['Όνομα','First name'],last_name:['Επώνυμο','Last name'],
 admission_date:['Ημερομηνία εισαγωγής','Admission date'],birth_date:['Ημερομηνία γέννησης','Date of birth'],date:['Ημερομηνία','Date'],
 patient_code:['Κωδικός ασθενούς','Patient code'],employee_code:['Κωδικός εργαζομένου','Employee code'],version:['Έκδοση','Version'],
 bed_capacity:['Δυναμικότητα κλινών','Bed capacity'],message:['Μήνυμα','Message'],description:['Περιγραφή','Description'],
}
function fieldLabel(column,en){
 const known=FIELD_LABELS[column]
 if(known)return known[en?1:0]
 return String(column||'').replace(/_id$/,'').replaceAll('_',' ')
}

// Database rejections that say exactly what is wrong: name the field or the
// rule instead of a generic "could not be saved".
function describeRejection(raw,error,en){
 const lower=raw.toLowerCase()
 const all=`${raw} ${error?.details||''} ${error?.hint||''}`
 const notNull=raw.match(/null value in column "([^"]+)"/i)
 if(notNull){const f=fieldLabel(notNull[1],en);return en?`A required field is missing: “${f}”. Fill it in and try again.`:`Λείπει υποχρεωτικό πεδίο: «${f}». Συμπληρώστε το και δοκιμάστε ξανά.`}
 if(lower.includes('demo_dates_invalid')||lower.includes('platform_demo_entitlements_check')||lower.includes('invalid demo dates')){
  return en?'The end date must be after the start date.':'Η λήξη πρέπει να είναι μετά την έναρξη.'
 }
 if(lower.includes('demo_email_required')||lower.includes('missing demo fields')){
  return en?'Fill in the name, the invitation email and the start date.':'Συμπληρώστε επωνυμία, email πρόσκλησης και ημερομηνία έναρξης.'
 }
 if(lower.includes('already been registered')||lower.includes('email address is already')||lower.includes('user already registered')){
  return en?'An account with this email already exists. Use a different email address.':'Υπάρχει ήδη λογαριασμός με αυτό το email. Χρησιμοποιήστε άλλο email.'
 }
 if(lower.includes('rate limit')){
  return en?'Too many emails were sent in a short time. Wait a few minutes and try again.':'Στάλθηκαν πολλά email σε λίγο χρόνο. Περιμένετε λίγα λεπτά και δοκιμάστε ξανά.'
 }
 if(lower.includes('authentication required')||lower.includes('auth_session_missing')||lower.includes('unauthorized')){
  return en?'The action was rejected because no signed-in user was recognised. Sign out, sign in again and retry; if it persists, contact support.':'Η ενέργεια απορρίφθηκε επειδή δεν αναγνωρίστηκε συνδεδεμένος χρήστης. Αποσυνδεθείτε, συνδεθείτε ξανά και δοκιμάστε· αν επιμένει, επικοινωνήστε με την υποστήριξη.'
 }
 if(lower.includes('organization membership required')||lower.includes('forbidden')){
  return en?'Your account is not allowed to make this change in this organization.':'Ο λογαριασμός σας δεν έχει δικαίωμα για αυτή την αλλαγή σε αυτόν τον οργανισμό.'
 }
 const duplicate=all.match(/Key \(([^)]+)\)=\(([^)]*)\) already exists/i)
 if(duplicate){const f=duplicate[1].split(',').map(c=>fieldLabel(c.trim(),en)).join(' + ');return en?`A record with the same “${f}” (${duplicate[2]}) already exists.`:`Υπάρχει ήδη εγγραφή με το ίδιο «${f}» (${duplicate[2]}).`}
 const check=raw.match(/violates check constraint "([^"]+)"/i)
 if(check){
  const name=check[1],column=Object.keys(FIELD_LABELS).sort((a,b)=>b.length-a.length).find(c=>name.includes(`_${c}_`)||name.endsWith(`_${c}_check`))
  return column
   ?(en?`The value of “${fieldLabel(column,en)}” is not accepted. Check it and try again.`:`Η τιμή στο πεδίο «${fieldLabel(column,en)}» δεν είναι αποδεκτή. Ελέγξτε την και δοκιμάστε ξανά.`)
   :(en?'One of the values does not meet the rules for this record (for example dates out of order). Check the fields and try again.':'Μία από τις τιμές δεν τηρεί τους κανόνες της εγγραφής (π.χ. ημερομηνίες σε λάθος σειρά). Ελέγξτε τα πεδία και δοκιμάστε ξανά.')
 }
 if(lower.includes('value too long')||lower.includes('22001')){
  return en?'A field has more characters than allowed. Shorten it and try again.':'Ένα πεδίο έχει περισσότερους χαρακτήρες από όσους επιτρέπονται. Συντομεύστε το και δοκιμάστε ξανά.'
 }
 const syntax=raw.match(/invalid input syntax for type (\w+)/i)
 if(syntax){
  const kind={date:en?'a date':'μια ημερομηνία',integer:en?'a number':'ένας αριθμός',numeric:en?'a number':'ένας αριθμός',uuid:en?'a selection':'μια επιλογή',timestamp:en?'a date':'μια ημερομηνία'}[syntax[1].toLowerCase()]||(en?'a field':'ένα πεδίο')
  return en?`The form contains an invalid value (${kind}). Check the fields and try again.`:`Η φόρμα έχει μη έγκυρη τιμή (${kind}). Ελέγξτε τα πεδία και δοκιμάστε ξανά.`
 }
 return null
}

export function userFacingError(error,{language='el',context='generic'}={}){
  const raw=text(error)
  const lower=raw.toLowerCase()
  const en=language==='en'

  if(error?.code==='CONFLICT'){
    return en?'Someone else already changed this data. Reload the page and re-apply your changes.':'Κάποιος άλλος έχει ήδη αλλάξει αυτά τα δεδομένα. Ανανεώστε τη σελίδα και επαναλάβετε τις αλλαγές σας.'
  }
  if(lower.includes('training_access_not_available'))return en?'This training link is no longer available. Ask the training coordinator for the current QR.':'Ο σύνδεσμος εκπαίδευσης δεν είναι πλέον διαθέσιμος. Ζητήστε από τον υπεύθυνο εκπαίδευσης το τρέχον QR.'
  if(lower.includes('training_assignment_not_found'))return en?'Your account is not assigned to this training. Contact the training coordinator if you believe this is incorrect.':'Ο λογαριασμός σας δεν έχει ανατεθεί σε αυτή την εκπαίδευση. Επικοινωνήστε με τον υπεύθυνο εκπαίδευσης αν θεωρείτε ότι αυτό δεν είναι σωστό.'
  if(lower.includes('training_already_completed'))return en?'This training completion has already been recorded.':'Η ολοκλήρωση αυτής της εκπαίδευσης έχει ήδη καταγραφεί.'
  if(lower.includes('training_assessment_not_configured'))return en?'The knowledge assessment has not been configured yet. Contact the training coordinator.':'Η αξιολόγηση γνώσεων δεν έχει διαμορφωθεί ακόμη. Επικοινωνήστε με τον υπεύθυνο εκπαίδευσης.'
  if(lower.includes('training_assessment_incomplete'))return en?'Answer all required questions before submitting.':'Απαντήστε σε όλες τις απαιτούμενες ερωτήσεις πριν από την υποβολή.'
  if(lower.includes('training_auth_required'))return en?'Sign in before recording this training action.':'Συνδεθείτε πριν καταγράψετε αυτή την ενέργεια εκπαίδευσης.'
  if(lower.includes('committee_meeting_cancellation_reason_required')){
    return en?'Enter a reason before cancelling the meeting.':'Συμπληρώστε αιτιολογία πριν ακυρώσετε τη συνεδρίαση.'
  }
  if(lower.includes('committee_meeting_cancellation_not_allowed')||lower.includes('committee_meeting_cancelled_immutable')){
    return en?'This meeting can no longer be cancelled or restored.':'Η συγκεκριμένη συνεδρίαση δεν μπορεί πλέον να ακυρωθεί ή να επανενεργοποιηθεί.'
  }
  if(lower.includes('committee_meeting_not_found')){
    return en?'The meeting could not be found. Refresh the committee and try again.':'Η συνεδρίαση δεν βρέθηκε. Ανανεώστε την επιτροπή και δοκιμάστε ξανά.'
  }
  if(lower.includes('committee_minutes_submission_not_allowed')){
    return en?'These minutes cannot be submitted again in their current status. Refresh the meeting to see the latest approval state.':'Τα πρακτικά δεν μπορούν να υποβληθούν ξανά στην τρέχουσα κατάστασή τους. Ανανεώστε τη συνεδρίαση για να δείτε την τελευταία κατάσταση έγκρισης.'
  }
  if(lower.includes('committee_minutes_approver_account_required')){
    return en?'The minutes cannot be submitted for approval because one or more present voting members do not have a linked user account.':'Δεν είναι δυνατή η υποβολή των πρακτικών για έγκριση, επειδή ένα ή περισσότερα παρόντα μέλη με δικαίωμα ψήφου δεν διαθέτουν συνδεδεμένο λογαριασμό.'
  }
  if(lower.includes('committee_member_account_required_for_participation_approval')){
    return en?'Participation approval cannot be requested because the selected employee does not have a uniquely linked active account in this organization. Check the employee email and user account first.':'Δεν είναι δυνατή η αποστολή αιτήματος αποδοχής συμμετοχής, επειδή ο επιλεγμένος εργαζόμενος δεν διαθέτει μοναδικά συνδεδεμένο ενεργό λογαριασμό στον οργανισμό. Ελέγξτε πρώτα το email του εργαζομένου και τον λογαριασμό χρήστη.'
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
  const rejection=describeRejection(raw,error,en)
  if(rejection)return rejection
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
