// Satisfaction surveys (ISO 9001 §9.1.2): the questionnaires, the templates a
// hospital starts from, and what the answers say. A survey's answers never
// carry who gave them.

export const SURVEY_AUDIENCES = [
  { value: 'patients', label: ['Ασθενείς', 'Patients'] },
  { value: 'staff', label: ['Προσωπικό', 'Staff'] },
  { value: 'visitors', label: ['Συνοδοί / επισκέπτες', 'Companions / visitors'] },
  { value: 'other', label: ['Άλλοι', 'Others'] },
]

export const SURVEY_STATUSES = [
  { value: 'draft', label: ['Προσχέδιο', 'Draft'], tone: 'info' },
  { value: 'open', label: ['Σε εξέλιξη', 'Open'], tone: 'success' },
  { value: 'closed', label: ['Ολοκληρώθηκε', 'Closed'], tone: 'neutral' },
]

export const QUESTION_TYPES = [
  { value: 'rating', label: ['Κλίμακα 1–5', 'Scale 1–5'] },
  { value: 'nps', label: ['Σύσταση 0–10', 'Recommend 0–10'] },
  { value: 'yesno', label: ['Ναι / Όχι', 'Yes / No'] },
  { value: 'single', label: ['Μία επιλογή', 'Single choice'] },
  { value: 'multiple', label: ['Πολλαπλή επιλογή', 'Multiple choice'] },
  { value: 'text', label: ['Ελεύθερο κείμενο', 'Free text'] },
]

export const RESPONSE_CHANNELS = [
  { value: 'link', label: ['Σύνδεσμος / QR', 'Link / QR'] },
  { value: 'tablet', label: ['Tablet στο τμήμα', 'Tablet at the ward'] },
  { value: 'paper', label: ['Έντυπο', 'Paper form'] },
]

const pick = (list, value, language) => list.find(item => item.value === value)?.label[language === 'en' ? 1 : 0] || value || ''
export const audienceLabel = (value, language) => pick(SURVEY_AUDIENCES, value, language)
export const surveyStatusLabel = (value, language) => pick(SURVEY_STATUSES, value, language)
export const surveyStatusTone = value => SURVEY_STATUSES.find(item => item.value === value)?.tone || 'neutral'
export const questionTypeLabel = (value, language) => pick(QUESTION_TYPES, value, language)
export const channelLabel = (value, language) => pick(RESPONSE_CHANNELS, value, language)
export const textOf = (item, language) => (language === 'en' ? item?.labelEn || item?.titleEn || item?.label || item?.title : item?.label || item?.title) || ''

// The words of a 1–5 scale, lowest first. 4 and 5 count as satisfied.
export const SCALES = [
  { value: 'quality', label: ['Πολύ κακή → Πολύ καλή', 'Very poor → Very good'], steps: [['Πολύ κακή', 'Very poor'], ['Κακή', 'Poor'], ['Μέτρια', 'Fair'], ['Καλή', 'Good'], ['Πολύ καλή', 'Very good']] },
  { value: 'rating', label: ['Μη ικανοποιητική → Άριστη', 'Unsatisfactory → Excellent'], steps: [['Μη ικανοποιητική', 'Unsatisfactory'], ['Μέτρια', 'Fair'], ['Ικανοποιητική', 'Satisfactory'], ['Πολύ καλή', 'Very good'], ['Άριστη', 'Excellent']] },
  { value: 'agree', label: ['Διαφωνώ απόλυτα → Συμφωνώ απόλυτα', 'Strongly disagree → Strongly agree'], steps: [['Διαφωνώ απόλυτα', 'Strongly disagree'], ['Διαφωνώ', 'Disagree'], ['Ούτε συμφωνώ ούτε διαφωνώ', 'Neither'], ['Συμφωνώ', 'Agree'], ['Συμφωνώ απόλυτα', 'Strongly agree']] },
  { value: 'speed', label: ['Αργή → Άμεση', 'Slow → Immediate'], steps: [['Αργή', 'Slow'], ['Μέτρια', 'Fair'], ['Ικανοποιητική', 'Satisfactory'], ['Αρκετά καλή', 'Quite good'], ['Άμεση', 'Immediate']] },
]
export const scaleOf = question => (SCALES.find(item => item.value === question?.scale) || SCALES[0]).steps
export const RATING_LABELS = SCALES[0].steps

// A question shown only after another's answer («If yes, the repair was…»).
export function isQuestionShown(question, answers = {}) {
  const rule = question?.showWhen
  if (!rule?.question) return true
  const value = answers[rule.question]
  return Array.isArray(value) ? value.includes(rule.value) : value === rule.value
}

// --- Templates ----------------------------------------------------------------------

const q = (id, section, type, label, labelEn, extra = {}) => ({ id, section, type, label, labelEn, required: type !== 'text', options: [], ...(type === 'rating' ? { scale: 'quality' } : {}), ...extra })
const opt = (value, label, labelEn) => ({ value, label, labelEn })

const INPATIENT = [
  q('admission_welcome', 'admission', 'rating', 'Υποδοχή και εξυπηρέτηση κατά την εισαγωγή', 'Welcome and service on admission'),
  q('admission_wait', 'admission', 'rating', 'Χρόνος αναμονής για την εισαγωγή', 'Waiting time for admission'),
  q('nursing_courtesy', 'nursing', 'rating', 'Ευγένεια και σεβασμός από το νοσηλευτικό προσωπικό', 'Courtesy and respect from the nurses'),
  q('nursing_response', 'nursing', 'rating', 'Ανταπόκριση όταν χρειαστήκατε βοήθεια', 'Response when you needed help'),
  q('doctor_courtesy', 'medical', 'rating', 'Ευγένεια και σεβασμός από τους ιατρούς', 'Courtesy and respect from the doctors'),
  q('doctor_information', 'medical', 'rating', 'Ενημέρωση για την κατάστασή σας και τη θεραπεία', 'Information about your condition and treatment'),
  q('pain', 'medical', 'rating', 'Αντιμετώπιση του πόνου', 'Pain management'),
  q('privacy', 'environment', 'rating', 'Σεβασμός της ιδιωτικότητάς σας', 'Respect for your privacy'),
  q('cleanliness', 'environment', 'rating', 'Καθαριότητα θαλάμου και χώρων υγιεινής', 'Cleanliness of the room and bathrooms'),
  q('quiet', 'environment', 'rating', 'Ησυχία, ιδίως τη νύχτα', 'Quiet, especially at night'),
  q('food', 'environment', 'rating', 'Ποιότητα φαγητού', 'Quality of the food'),
  q('discharge_information', 'discharge', 'rating', 'Οδηγίες για μετά την έξοδο (φάρμακα, επόμενα βήματα)', 'Instructions for after discharge (medicines, next steps)'),
  q('hand_hygiene', 'safety', 'yesno', 'Είδατε το προσωπικό να καθαρίζει τα χέρια του πριν σας εξετάσει;', 'Did you see staff clean their hands before examining you?'),
  q('identity_check', 'safety', 'yesno', 'Επιβεβαίωναν το όνομά σας πριν από φάρμακα ή εξετάσεις;', 'Did they confirm your name before medicines or tests?'),
  q('overall', 'overall', 'rating', 'Συνολική ικανοποίηση από τη νοσηλεία', 'Overall satisfaction with your stay'),
  q('recommend', 'overall', 'nps', 'Πόσο πιθανό είναι να προτείνετε το νοσοκομείο σε φίλο ή συγγενή;', 'How likely are you to recommend the hospital to a friend or relative?'),
  q('best', 'comments', 'text', 'Τι σας άρεσε περισσότερο;', 'What did you like most?'),
  q('improve', 'comments', 'text', 'Τι να βελτιώσουμε;', 'What should we improve?'),
]

const OUTPATIENT = [
  q('appointment', 'access', 'rating', 'Ευκολία να κλείσετε ραντεβού ή να εξυπηρετηθείτε', 'Ease of getting an appointment or being seen'),
  q('wait', 'access', 'rating', 'Χρόνος αναμονής μέχρι να σας δουν', 'Waiting time until you were seen'),
  q('reception', 'access', 'rating', 'Εξυπηρέτηση στη γραμματεία', 'Service at the front desk'),
  q('courtesy', 'care', 'rating', 'Ευγένεια και σεβασμός από το προσωπικό', 'Courtesy and respect from the staff'),
  q('information', 'care', 'rating', 'Κατανοητή ενημέρωση για το τι έχετε και τι πρέπει να κάνετε', 'Clear information about your condition and what to do'),
  q('cleanliness', 'care', 'rating', 'Καθαριότητα χώρων', 'Cleanliness of the premises'),
  q('overall', 'overall', 'rating', 'Συνολική ικανοποίηση από την επίσκεψη', 'Overall satisfaction with your visit'),
  q('recommend', 'overall', 'nps', 'Πόσο πιθανό είναι να προτείνετε το νοσοκομείο σε φίλο ή συγγενή;', 'How likely are you to recommend the hospital to a friend or relative?'),
  q('improve', 'comments', 'text', 'Τι να βελτιώσουμε;', 'What should we improve?'),
]

const STAFF = [
  q('workload', 'work', 'rating', 'Ο φόρτος εργασίας είναι διαχειρίσιμος', 'The workload is manageable'),
  q('equipment', 'work', 'rating', 'Έχω τον εξοπλισμό και τα υλικά που χρειάζομαι', 'I have the equipment and supplies I need'),
  q('training', 'work', 'rating', 'Η εκπαίδευση που λαμβάνω επαρκεί για τον ρόλο μου', 'The training I receive is enough for my role'),
  q('communication', 'team', 'rating', 'Η επικοινωνία μέσα στο τμήμα', 'Communication within the department'),
  q('management', 'team', 'rating', 'Η στήριξη από τους προϊσταμένους', 'Support from my managers'),
  q('safety_culture', 'safety', 'rating', 'Μπορώ να αναφέρω ένα λάθος χωρίς φόβο', 'I can report a mistake without fear'),
  q('safety_feedback', 'safety', 'yesno', 'Μαθαίνω τι άλλαξε μετά από αναφορές συμβάντων;', 'Do I learn what changed after incident reports?'),
  q('improve_areas', 'safety', 'multiple', 'Πού χρειάζεται βελτίωση;', 'Where is improvement needed?', { required: false, options: [opt('staffing', 'Στελέχωση', 'Staffing'), opt('equipment', 'Εξοπλισμός', 'Equipment'), opt('training', 'Εκπαίδευση', 'Training'), opt('communication', 'Επικοινωνία', 'Communication'), opt('shifts', 'Βάρδιες', 'Shifts'), opt('facilities', 'Χώροι', 'Facilities')] }),
  q('overall', 'overall', 'rating', 'Συνολική ικανοποίηση από την εργασία μου', 'Overall satisfaction with my work'),
  q('recommend', 'overall', 'nps', 'Πόσο πιθανό είναι να προτείνετε το νοσοκομείο ως χώρο εργασίας;', 'How likely are you to recommend the hospital as a place to work?'),
  q('comments', 'comments', 'text', 'Προτάσεις', 'Suggestions'),
]

const SECTIONS = {
  admission: ['Εισαγωγή', 'Admission'], nursing: ['Νοσηλευτική φροντίδα', 'Nursing care'], medical: ['Ιατρική φροντίδα', 'Medical care'],
  environment: ['Περιβάλλον', 'Environment'], discharge: ['Έξοδος', 'Discharge'], safety: ['Ασφάλεια', 'Safety'], overall: ['Συνολικά', 'Overall'],
  comments: ['Σχόλια', 'Comments'], access: ['Πρόσβαση και αναμονή', 'Access and waiting'], care: ['Εξυπηρέτηση', 'Care'], work: ['Εργασία', 'Work'], team: ['Ομάδα', 'Team'],
  about: ['Λίγα λόγια για εσάς', 'About you'], choice: ['Η επιλογή του νοσοκομείου', 'Choosing the hospital'], classes: ['Μαθήματα προετοιμασίας', 'Antenatal classes'],
  reception: ['Υποδοχή', 'Reception'], food: ['Διατροφή', 'Food'], meals: ['Τα γεύματα', 'The meals'], floor: ['Φροντίδα στον όροφο', 'Care on the floor'], service: ['Σερβίρισμα', 'Service'], room: ['Δωμάτιο και επισκεπτήριο', 'Room and visits'], services: ['Υπηρεσίες', 'Services'], information: ['Ενημέρωση', 'Information'],
}
// A survey's sections: its own, then any its questions name (with their usual titles).
export function sectionsOf(survey) {
  const own = (survey?.sections || []).filter(item => item?.key)
  const named = own.map(item => item.key)
  const keys = [...new Set((survey?.questions || []).map(question => question.section || '').filter(key => key && !named.includes(key)))]
  return [...own, ...keys.map(key => ({ key, label: SECTIONS[key]?.[0] || key, labelEn: SECTIONS[key]?.[1] || key }))]
}
export const sectionLabel = (key, language, sections = []) => { const own = sections.find(item => item.key === key); return own ? textOf(own, language) : SECTIONS[key]?.[language === 'en' ? 1 : 0] || key || '' }
const sectionList = keys => keys.map(key => ({ key, label: SECTIONS[key][0], labelEn: SECTIONS[key][1] }))

// The questionnaires hospitals already hand out on discharge: one for the
// maternity floor and one for the medical and surgical floors. «{hospital}»
// becomes the hospital's name when a survey is made from them.
const RATE = { scale: 'rating' }
const AGE = [opt('to25', 'Έως 25', 'Up to 25'), opt('26_35', '26–35', '26–35'), opt('36_45', '36–45', '36–45'), opt('46plus', '46+', '46+')]
const AGE_WARD = [opt('to25', 'Έως 25', 'Up to 25'), opt('26_45', '26–45', '26–45'), opt('46_65', '46–65', '46–65'), opt('66plus', '66+', '66+')]
const OCCUPATION = [opt('public', 'Δημόσιος υπάλληλος', 'Civil servant'), opt('private', 'Ιδιωτικός υπάλληλος', 'Private employee'), opt('self', 'Ελεύθερος επαγγελματίας', 'Self-employed'), opt('home', 'Οικιακά', 'Homemaker'), opt('retired', 'Συνταξιούχος', 'Retired'), opt('student', 'Φοιτητής/τρια', 'Student'), opt('unemployed', 'Άνεργος/η', 'Unemployed'), opt('other', 'Άλλο', 'Other')]
const ABOUT = [
  q('nationality', 'about', 'single', 'Υπηκοότητα', 'Nationality', { required: false, options: [opt('greek', 'Ελληνική', 'Greek'), opt('other', 'Άλλη', 'Other')] }),
  q('reason', 'choice', 'single', 'Ο λόγος που επιλέξατε το {hospital}', 'Why you chose {hospital}', { required: false, options: [opt('reputation', 'Η φήμη του', 'Its reputation'), opt('others', 'Σύσταση τρίτων', 'Recommended by others'), opt('doctor', 'Σύσταση ιατρού', 'Recommended by a doctor'), opt('care', 'Υψηλή φροντίδα νοσηλείας', 'High standard of care')] }),
  q('heard', 'choice', 'single', 'Πώς ενημερωθήκατε για το {hospital};', 'How did you hear about {hospital}?', { required: false, options: [opt('doctor', 'Από τον ιατρό μου', 'From my doctor'), opt('friends', 'Από φιλικό ή συγγενικό πρόσωπο', 'From a friend or relative'), opt('ads', 'Από διαφήμιση, προωθητικές ενέργειες, ΜΜΕ', 'From advertising or the media'), opt('insurer', 'Από την ασφαλιστική μου', 'From my insurer')] }),
]
const STAY = [
  q('admission_process', 'reception', 'rating', 'Η διαδικασία εισαγωγής στο τμήμα Υποδοχής', 'The admission process at Reception', RATE),
  q('reception_staff', 'reception', 'rating', 'Η συμπεριφορά του προσωπικού της Υποδοχής', 'The behaviour of the Reception staff', RATE),
]
const AFTER = [
  q('food_quality', 'food', 'rating', 'Η ποιότητα του φαγητού (αν δεν ακολουθήσατε ειδική δίαιτα)', 'The quality of the food (if you were not on a special diet)', { ...RATE, required: false }),
  q('food_service', 'food', 'rating', 'Η εξυπηρέτηση των τραπεζοκόμων', 'The service of the catering staff', { ...RATE, required: false }),
  q('cleanliness', 'room', 'rating', 'Η καθαριότητα του δωματίου', 'The cleanliness of the room', RATE),
  q('visitors', 'room', 'rating', 'Το επισκεπτήριο: ο αριθμός επισκεπτών στο δωμάτιο', 'Visiting: the number of visitors in the room', RATE),
  q('visiting_hours', 'room', 'rating', 'Το επισκεπτήριο: η τήρηση του ωραρίου', 'Visiting: keeping to the visiting hours', RATE),
  q('technical', 'room', 'yesno', 'Αντιμετωπίσατε τεχνικά προβλήματα (κλιματισμός, φώτα κ.λπ.) κατά την παραμονή σας;', 'Did you have technical problems (air conditioning, lights, etc.) during your stay?'),
  q('technical_fix', 'room', 'rating', 'Εάν ναι, η επίλυσή τους ήταν:', 'If so, they were solved:', { scale: 'speed', required: false, showWhen: { question: 'technical', value: true } }),
  q('accounting', 'services', 'rating', 'Η εξυπηρέτηση από το Λογιστήριο Ασθενών', 'The service of the Patient Accounts office', RATE),
]
const CLOSING = [
  q('overall', 'overall', 'rating', 'Συνολικά, η διαμονή σας στο {hospital} ήταν:', 'Overall, your stay at {hospital} was:', RATE),
  q('previous', 'overall', 'single', 'Σε σχέση με προηγούμενη νοσηλεία είστε:', 'Compared with a previous stay you are:', { required: false, options: [opt('more', 'Περισσότερο ικανοποιημένοι', 'More satisfied'), opt('same', 'Το ίδιο ικανοποιημένοι', 'As satisfied'), opt('less', 'Λιγότερο ικανοποιημένοι', 'Less satisfied'), opt('first', 'Νοσηλεύομαι πρώτη φορά', 'This is my first stay')] }),
  q('info_staff', 'information', 'rating', 'Η ενημέρωση για τις διαδικασίες της Κλινικής από το προσωπικό', 'Information on the clinic’s procedures from the staff', RATE),
  q('info_leaflets', 'information', 'rating', 'Η ενημέρωση από τα ενημερωτικά έντυπα', 'Information from the leaflets', { ...RATE, required: false }),
  q('info_website', 'information', 'rating', 'Η ενημέρωση από τον ιστότοπο', 'Information from the website', { ...RATE, required: false }),
  q('recommend_yes', 'overall', 'yesno', 'Θα συστήνατε το {hospital};', 'Would you recommend {hospital}?'),
  q('choose_again', 'overall', 'yesno', 'Θα επιλέγατε ξανά το {hospital} στο μέλλον;', 'Would you choose {hospital} again?'),
  q('missing', 'comments', 'text', 'Ελλείψεις υπηρεσιών που εντοπίσατε', 'Services you found missing'),
  q('comments', 'comments', 'text', 'Σχόλια', 'Comments'),
]
const MATERNITY = [
  ABOUT[0],
  q('age', 'about', 'single', 'Ηλικία', 'Age', { required: false, options: AGE }),
  q('occupation', 'about', 'single', 'Επάγγελμα', 'Occupation', { required: false, options: OCCUPATION.filter(item => !['retired', 'student'].includes(item.value)) }),
  ...ABOUT.slice(1),
  q('class_care', 'classes', 'yesno', 'Παρακολουθήσατε τα δωρεάν μαθήματα Μαιευτικής Φροντίδας και Μητρικής Τέχνης;', 'Did you attend the free classes in maternity care and mothercraft?', { required: false }),
  q('class_nutrition', 'classes', 'yesno', 'Παρακολουθήσατε τα μαθήματα Διατροφής στην Κύηση;', 'Did you attend the classes on nutrition in pregnancy?', { required: false }),
  q('class_psychology', 'classes', 'yesno', 'Παρακολουθήσατε τα μαθήματα Ψυχολογίας στην Κύηση;', 'Did you attend the classes on psychology in pregnancy?', { required: false }),
  ...STAY,
  q('delivery_room', 'floor', 'rating', 'Η φροντίδα και η εξυπηρέτηση του προσωπικού της Αίθουσας Τοκετών', 'The care and service of the Delivery Room staff', RATE),
  q('nursing', 'floor', 'rating', 'Οι υπηρεσίες του νοσηλευτικού προσωπικού στον όροφο, συνολικά', 'The nursing staff’s services on the floor, overall', RATE),
  q('breastfeeding', 'floor', 'rating', 'Η ενημέρωση σε θέματα θηλασμού και φροντίδας νεογνού', 'Information on breastfeeding and newborn care', RATE),
  q('paediatricians', 'floor', 'rating', 'Οι επισκέψεις των παιδιάτρων και η πληροφόρηση που σας παρείχαν', 'The paediatricians’ visits and the information they gave', RATE),
  q('doctors', 'floor', 'rating', 'Οι επισκέψεις των ιατρών και η πληροφόρηση που σας παρείχαν', 'The doctors’ visits and the information they gave', RATE),
  ...AFTER,
  ...CLOSING,
]
const WARDS = [
  ABOUT[0],
  q('sex', 'about', 'single', 'Φύλο', 'Sex', { required: false, options: [opt('male', 'Άνδρας', 'Man'), opt('female', 'Γυναίκα', 'Woman')] }),
  q('age', 'about', 'single', 'Ηλικία', 'Age', { required: false, options: AGE_WARD }),
  q('occupation', 'about', 'single', 'Επάγγελμα', 'Occupation', { required: false, options: OCCUPATION }),
  ...ABOUT.slice(1),
  ...STAY,
  q('nursing', 'floor', 'rating', 'Οι υπηρεσίες του νοσηλευτικού προσωπικού στον όροφο, συνολικά', 'The nursing staff’s services on the floor, overall', RATE),
  q('doctors', 'floor', 'rating', 'Οι επισκέψεις των ιατρών και η πληροφόρηση που σας παρείχαν', 'The doctors’ visits and the information they gave', RATE),
  q('physiotherapy', 'floor', 'rating', 'Η ομάδα των Φυσικοθεραπευτών (αν σας παρασχέθηκε φυσικοθεραπεία)', 'The physiotherapy team (if you had physiotherapy)', { ...RATE, required: false }),
  ...AFTER,
  ...CLOSING,
]
const STAY_SECTIONS = ['about', 'choice', 'reception', 'floor', 'food', 'room', 'services', 'overall', 'information', 'comments']
// The kitchen's questionnaire: the meals as patients receive them on the floor.
const KITCHEN = [
  q('diet', 'meals', 'yesno', 'Ακολουθήσατε ειδική δίαιτα κατά τη νοσηλεία σας;', 'Were you on a special diet during your stay?', { required: false }),
  q('diet_kept', 'meals', 'rating', 'Η δίαιτα που σας ορίστηκε τηρήθηκε στα γεύματα', 'The diet you were given was kept in the meals', { scale: 'agree', required: false, showWhen: { question: 'diet', value: true } }),
  q('taste', 'meals', 'rating', 'Η γεύση του φαγητού', 'The taste of the food', RATE),
  q('temperature', 'meals', 'rating', 'Η θερμοκρασία του φαγητού όταν σας σερβιρίστηκε', 'The temperature of the food when served', RATE),
  q('variety', 'meals', 'rating', 'Η ποικιλία του μενού', 'The variety of the menu', RATE),
  q('portion', 'meals', 'rating', 'Η ποσότητα των μερίδων', 'The size of the portions', RATE),
  q('presentation', 'meals', 'rating', 'Η εμφάνιση και η παρουσίαση του δίσκου', 'How the tray looked', RATE),
  q('choice_menu', 'meals', 'yesno', 'Σας δόθηκε η δυνατότητα να επιλέξετε από το μενού;', 'Could you choose from the menu?', { required: false }),
  q('times', 'service', 'rating', 'Η τήρηση των ωρών των γευμάτων', 'Meals served on time', RATE),
  q('waiters', 'service', 'rating', 'Η εξυπηρέτηση και η ευγένεια των τραπεζοκόμων', 'The service and courtesy of the catering staff', RATE),
  q('cleanliness', 'service', 'rating', 'Η καθαριότητα των σκευών και του δίσκου', 'The cleanliness of the dishes and the tray', RATE),
  q('overall', 'overall', 'rating', 'Συνολικά, το φαγητό στο {hospital} ήταν:', 'Overall, the food at {hospital} was:', RATE),
  q('improve', 'comments', 'text', 'Τι θα βελτιώνατε στο φαγητό;', 'What would you improve in the food?'),
]

export const SURVEY_TEMPLATES = [
  { key: 'maternity', audience: 'patients', title: 'Ερωτηματολόγιο Μαιευτικού ορόφου', titleEn: 'Maternity floor questionnaire', description: 'Η γνώμη σας μάς βοηθά να βελτιώνουμε τις υπηρεσίες μας. Λίγα λεπτά, ανώνυμα.', descriptionEn: 'Your opinion helps us improve our services. A few minutes, anonymous.', sections: sectionList(['about', 'choice', 'classes', 'reception', 'floor', 'food', 'room', 'services', 'overall', 'information', 'comments']), questions: MATERNITY },
  { key: 'wards', audience: 'patients', title: 'Ερωτηματολόγιο Νοσηλευτικού ορόφου', titleEn: 'Ward questionnaire', description: 'Η γνώμη σας μάς βοηθά να βελτιώνουμε τις υπηρεσίες μας. Λίγα λεπτά, ανώνυμα.', descriptionEn: 'Your opinion helps us improve our services. A few minutes, anonymous.', sections: sectionList(STAY_SECTIONS), questions: WARDS },
  { key: 'kitchen', audience: 'patients', title: 'Ερωτηματολόγιο Κουζίνας', titleEn: 'Kitchen questionnaire', description: 'Πείτε μας πώς ήταν τα γεύματά σας. Λίγα λεπτά, ανώνυμα.', descriptionEn: 'Tell us how your meals were. A few minutes, anonymous.', sections: sectionList(['meals', 'service', 'overall', 'comments']), questions: KITCHEN },
  { key: 'inpatient', audience: 'patients', title: 'Ικανοποίηση νοσηλευόμενων ασθενών', titleEn: 'Inpatient satisfaction', description: 'Πείτε μας πώς ήταν η νοσηλεία σας. Συμπληρώνεται κατά την έξοδο.', descriptionEn: 'Tell us how your stay was. Filled in on discharge.', sections: sectionList(['admission', 'nursing', 'medical', 'environment', 'discharge', 'safety', 'overall', 'comments']), questions: INPATIENT },
  { key: 'outpatient', audience: 'patients', title: 'Ικανοποίηση εξωτερικών ασθενών και ΤΕΠ', titleEn: 'Outpatient and emergency satisfaction', description: 'Πείτε μας πώς ήταν η επίσκεψή σας στα εξωτερικά ιατρεία ή στο ΤΕΠ.', descriptionEn: 'Tell us how your visit to the outpatient clinics or the emergency department was.', sections: sectionList(['access', 'care', 'overall', 'comments']), questions: OUTPATIENT },
  { key: 'staff', audience: 'staff', title: 'Ικανοποίηση προσωπικού', titleEn: 'Staff satisfaction', description: 'Ετήσια έρευνα για το εργασιακό περιβάλλον και την κουλτούρα ασφάλειας.', descriptionEn: 'Yearly survey of the work environment and safety culture.', sections: sectionList(['work', 'team', 'safety', 'overall', 'comments']), questions: STAFF },
  { key: 'blank', audience: 'patients', title: 'Νέα έρευνα', titleEn: 'New survey', description: '', descriptionEn: '', sections: [], questions: [] },
]

// hospital: the name that takes the place of «{hospital}» in the questions.
export function surveyFromTemplate(key, { hospital = '' } = {}) {
  const template = SURVEY_TEMPLATES.find(item => item.key === key) || SURVEY_TEMPLATES[0]
  const named = text => String(text || '').replaceAll('{hospital}', hospital || 'νοσοκομείο')
  const namedEn = text => String(text || '').replaceAll('{hospital}', hospital || 'the hospital')
  return {
    id: '', code: '', templateKey: template.key, audience: template.audience, title: template.title, titleEn: template.titleEn,
    description: template.description, descriptionEn: template.descriptionEn, departmentIds: [], sections: structuredClone(template.sections || []),
    questions: structuredClone(template.questions).map(question => ({ ...question, label: named(question.label), labelEn: namedEn(question.labelEn) })),
    status: 'draft', opensOn: '', closesOn: '', targetResponses: '', satisfiedTarget: 80, publicToken: '',
  }
}

// SRV-2026-01, SRV-2026-02… numbered within the year.
export function nextSurveyCode(codes = [], year = new Date().getFullYear()) {
  const numbers = codes.map(code => Number(String(code || '').match(new RegExp(`^SRV-${year}-(\\d+)$`))?.[1] || 0))
  return `SRV-${year}-${String(Math.max(0, ...numbers) + 1).padStart(2, '0')}`
}

// Whether a survey takes answers on a given day.
export function isSurveyOpen(survey, today = new Date().toISOString().slice(0, 10)) {
  return survey?.status === 'open' && (!survey.opensOn || survey.opensOn <= today) && (!survey.closesOn || survey.closesOn >= today)
}

// What a survey needs before it opens.
export function surveyProblems(survey, language = 'el') {
  const en = language === 'en', problems = []
  if (!String(survey.title || '').trim()) problems.push(en ? 'A title' : 'Τίτλος')
  if (!survey.departmentIds?.length) problems.push(en ? 'The department it is about' : 'Το τμήμα που αφορά')
  if (!survey.questions?.length) problems.push(en ? 'At least one question' : 'Τουλάχιστον μία ερώτηση')
  for (const question of survey.questions || []) {
    if (!String(question.label || '').trim()) { problems.push(en ? 'Every question needs its text' : 'Κάθε ερώτηση θέλει κείμενο'); break }
  }
  for (const question of survey.questions || []) {
    if (['single', 'multiple'].includes(question.type) && (question.options || []).filter(item => String(item.label || '').trim()).length < 2) { problems.push(en ? 'Choice questions need at least two options' : 'Οι ερωτήσεις επιλογής θέλουν τουλάχιστον δύο επιλογές'); break }
  }
  if (survey.opensOn && survey.closesOn && survey.closesOn < survey.opensOn) problems.push(en ? 'The end comes before the start' : 'Η λήξη είναι πριν από την έναρξη')
  return problems
}

// The answers a respondent gave, kept as the database keeps them: only the
// survey's questions, each value of its kind. Null when a required one is missing.
export function cleanAnswers(questions = [], answers = {}) {
  const kept = {}
  for (const question of questions) {
    // An answer to a question the respondent no longer sees is not kept.
    if (!isQuestionShown(question, answers)) continue
    const value = answers[question.id]
    const empty = value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length)
    if (empty) { if (question.required) return null; continue }
    const allowed = (question.options || []).map(item => item.value)
    if (question.type === 'rating' && [1, 2, 3, 4, 5].includes(value)) kept[question.id] = value
    else if (question.type === 'nps' && Number.isInteger(value) && value >= 0 && value <= 10) kept[question.id] = value
    else if (question.type === 'yesno' && typeof value === 'boolean') kept[question.id] = value
    else if (question.type === 'single' && allowed.includes(value)) kept[question.id] = value
    else if (question.type === 'multiple' && Array.isArray(value) && value.every(item => allowed.includes(item))) kept[question.id] = value
    else if (question.type === 'text' && typeof value === 'string') kept[question.id] = value.trim().slice(0, 2000)
    else if (question.required) return null
  }
  return Object.keys(kept).length ? kept : null
}

// --- Analysis -----------------------------------------------------------------------

const round = value => (value == null || !Number.isFinite(value) ? null : Math.round(value * 10) / 10)
const share = (part, whole) => (whole ? round((part / whole) * 100) : null)
const monthOf = value => String(value || '').slice(0, 7)

// One question's answers: how many, the mean and the share satisfied (4–5) of a
// scale, the score of a recommendation question (promoters 9–10 minus detractors
// 0–6), the share of Yes, the count of each option, the texts.
export function questionResult(question, responses = []) {
  const values = responses.map(response => response.answers?.[question.id]).filter(value => value !== undefined && value !== null && value !== '' && !(Array.isArray(value) && !value.length))
  const result = { question, count: values.length }
  if (question.type === 'rating') {
    const numbers = values.map(Number).filter(Number.isFinite)
    result.mean = numbers.length ? round(numbers.reduce((sum, value) => sum + value, 0) / numbers.length) : null
    result.satisfied = share(numbers.filter(value => value >= 4).length, numbers.length)
    result.distribution = [1, 2, 3, 4, 5].map(score => numbers.filter(value => value === score).length)
  } else if (question.type === 'nps') {
    const numbers = values.map(Number).filter(Number.isFinite)
    const promoters = numbers.filter(value => value >= 9).length, detractors = numbers.filter(value => value <= 6).length
    result.promoters = share(promoters, numbers.length)
    result.detractors = share(detractors, numbers.length)
    result.nps = numbers.length ? Math.round(((promoters - detractors) / numbers.length) * 100) : null
    result.distribution = Array.from({ length: 11 }, (_, score) => numbers.filter(value => value === score).length)
  } else if (question.type === 'yesno') {
    result.yes = share(values.filter(value => value === true).length, values.length)
  } else if (['single', 'multiple'].includes(question.type)) {
    result.options = (question.options || []).map(item => {
      const count = values.filter(value => (Array.isArray(value) ? value.includes(item.value) : value === item.value)).length
      return { ...item, count, share: share(count, values.length) }
    })
  } else if (question.type === 'text') {
    result.texts = responses.filter(response => String(response.answers?.[question.id] || '').trim()).map(response => ({ id: response.id, text: response.answers[question.id], department: response.department || '', departmentEn: response.departmentEn || response.department || '', submittedAt: response.submittedAt }))
  }
  return result
}

// The survey's headline figures: responses, the share of satisfied answers over
// every 1–5 question, the recommendation score, and the questions below target.
export function surveySummary(survey, responses = []) {
  const results = (survey.questions || []).map(question => questionResult(question, responses))
  const ratings = results.filter(result => result.question.type === 'rating')
  const answered = ratings.reduce((sum, result) => sum + result.count, 0)
  const satisfiedAnswers = ratings.reduce((sum, result) => sum + (result.distribution?.[3] || 0) + (result.distribution?.[4] || 0), 0)
  const recommend = results.find(result => result.question.type === 'nps')
  const target = Number(survey.satisfiedTarget) || 80
  return {
    responses: responses.length,
    satisfied: share(satisfiedAnswers, answered),
    nps: recommend?.nps ?? null,
    target,
    progress: survey.targetResponses ? Math.min(100, Math.round((responses.length / Number(survey.targetResponses)) * 100)) : null,
    // Few answers make a share unreliable: below 10 a question is not flagged.
    below: ratings.filter(result => result.count >= 10 && result.satisfied != null && result.satisfied < target).sort((a, b) => a.satisfied - b.satisfied),
    comments: results.filter(result => result.question.type === 'text').reduce((sum, result) => sum + result.texts.length, 0),
    results,
  }
}

// The same figures for each department the responses are about.
export function departmentBreakdown(survey, responses = [], language = 'el') {
  const en = language === 'en'
  const groups = new Map()
  for (const response of responses) {
    const key = response.departmentId || ''
    const group = groups.get(key) || { key, department: (en ? response.departmentEn : response.department) || response.department || (en ? 'No department' : 'Χωρίς τμήμα'), responses: [] }
    group.responses.push(response)
    groups.set(key, group)
  }
  return [...groups.values()].map(group => ({ ...group, ...surveySummary(survey, group.responses) })).sort((a, b) => b.responses - a.responses)
}

// Satisfied share and responses month by month, the oldest first.
export function monthlyTrend(survey, responses = []) {
  const months = [...new Set(responses.map(response => monthOf(response.submittedAt)).filter(Boolean))].sort()
  return months.map(month => {
    const own = responses.filter(response => monthOf(response.submittedAt) === month)
    const summary = surveySummary(survey, own)
    return { month, responses: own.length, satisfied: summary.satisfied, nps: summary.nps }
  })
}

// The responses that match the filters of the results screen.
export function filterResponses(responses = [], { query = '', department = 'all', channel = 'all', from = '', to = '' } = {}) {
  const q = String(query || '').trim().toLowerCase()
  return responses
    .filter(response => !q || Object.values(response.answers || {}).some(value => typeof value === 'string' && value.toLowerCase().includes(q)))
    .filter(response => department === 'all' || (response.departmentId || '') === department)
    .filter(response => channel === 'all' || response.channel === channel)
    .filter(response => !from || String(response.submittedAt).slice(0, 10) >= from)
    .filter(response => !to || String(response.submittedAt).slice(0, 10) <= to)
}

// CSV for Excel: one row per response, one column per question.
export function responsesExport(survey, responses = [], language = 'el') {
  const en = language === 'en'
  const value = (question, answer) => {
    if (answer === undefined || answer === null) return ''
    if (question.type === 'yesno') return answer ? (en ? 'Yes' : 'Ναι') : (en ? 'No' : 'Όχι')
    if (question.type === 'single') return textOf((question.options || []).find(item => item.value === answer), language) || answer
    if (question.type === 'multiple') return (Array.isArray(answer) ? answer : [answer]).map(item => textOf((question.options || []).find(option => option.value === item), language) || item).join(', ')
    return answer
  }
  return {
    name: `${survey.code || 'survey'}_${en ? 'responses' : 'apantiseis'}`,
    headers: [en ? 'Date' : 'Ημερομηνία', en ? 'Department' : 'Τμήμα', en ? 'Channel' : 'Τρόπος', ...(survey.questions || []).map(question => textOf(question, language))],
    rows: responses.map(response => [String(response.submittedAt || '').slice(0, 10), (en ? response.departmentEn : response.department) || response.department || '', channelLabel(response.channel, language), ...(survey.questions || []).map(question => value(question, response.answers?.[question.id]))]),
  }
}
