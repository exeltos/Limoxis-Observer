const technicalTerms=/\b(supabase|postgres|postgresql|rls|row level security|rpc|storage bucket|service[_ -]?role|anon key|jwt|edge function|database|sql)\b/gi

function text(error){return String(error?.message||error?.error_description||error?.details||error||'').trim()}

export function userFacingError(error,{language='el',context='generic'}={}){
  const raw=text(error)
  const lower=raw.toLowerCase()
  const en=language==='en'

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
