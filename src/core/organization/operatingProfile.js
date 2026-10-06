// Operating profile of an organization: which parts of the platform a hospital
// uses. Set by the Platform Owner per organization (organizations.operating_profile
// + enabled_addons). A module that is off is hidden everywhere — menu, routes,
// actions, analytics tabs and dashboard tiles — by taking its capabilities away
// from every role in that organization. Its data is kept, and comes back as it
// was if the module is switched on again.
import { CAPABILITIES as C } from '../permissions/capabilityCatalogue.js'

export const OPERATING_PROFILES = Object.freeze(['laboratory', 'surveillance', 'full'])
export const ADDONS = Object.freeze(['occupational_health', 'pharmacy', 'prevalence_survey', 'lira'])
export const DEFAULT_PROFILE = 'full'

export const PROFILE_LABELS = Object.freeze({
  laboratory: { el: 'Εργαστηριακή καταγραφή', en: 'Laboratory records', hintEl: 'Ασθενείς, Εργαστήριο, μικροβιολογία/AMR και αναφορές ΕΟΔΥ & EARS-Net. Χωρίς επιτήρηση λοιμώξεων.', hintEn: 'Patients, Laboratory, microbiology/AMR and ΕΟΔΥ & EARS-Net reports. No infection surveillance.' },
  surveillance: { el: 'Εργαστήριο & Επιτήρηση λοιμώξεων', en: 'Laboratory & infection surveillance', hintEl: 'Ό,τι η εργαστηριακή καταγραφή, μαζί με επιτήρηση (HAI, απομόνωση, αγωγή, έκβαση) και δείκτες.', hintEn: 'Laboratory records plus surveillance (HAI, isolation, therapy, outcome) and indicators.' },
  full: { el: 'Πλήρες πρόγραμμα Ελέγχου Λοιμώξεων', en: 'Full infection control programme', hintEl: 'Ό,τι η επιτήρηση, μαζί με Πρόληψη, Ελέγχους, Ποιότητα, Εκπαίδευση, Επιτροπές και Έγγραφα.', hintEn: 'Surveillance plus Prevention, Controls, Quality, Training, Committees and Documents.' },
})
export const ADDON_LABELS = Object.freeze({
  occupational_health: { el: 'Υγεία εργαζομένων (Ιατρός Εργασίας)', en: 'Occupational health', hintEl: 'Εμβολιασμοί, επισκέψεις Ιατρού Εργασίας και επανέλεγχοι προσωπικού.', hintEn: 'Staff vaccination, occupational physician visits and follow-ups.' },
  pharmacy: { el: 'Φαρμακείο (κατανάλωση αντιμικροβιακών)', en: 'Pharmacy (antimicrobial consumption)', hintEl: 'Κατανάλωση και χορηγήσεις αντιμικροβιακών από το φαρμακείο.', hintEn: 'Antimicrobial consumption and dispensing from the pharmacy.' },
  prevalence_survey: { el: 'Μελέτη επιπολασμού (PPS)', en: 'Point prevalence survey (PPS)', hintEl: 'Περιοδικές μετρήσεις επιπολασμού HAI και χρήσης αντιβιοτικών.', hintEn: 'Periodic HAI prevalence and antibiotic use measurements.' },
  lira: { el: 'LIRA & AI', en: 'LIRA & AI', hintEl: 'Βοηθός LIRA, διερευνήσεις συρροών και σύνδεση παρόχου AI.', hintEn: 'LIRA assistant, outbreak investigations and AI provider connection.' },
})

// What each operating profile contains, cumulatively: the layout of the profile
// picker is built from this, so the screen and the rules below cannot drift apart.
export const MODULES = Object.freeze({
  patients: { el: 'Ασθενείς', en: 'Patients', from: 'laboratory' },
  laboratory: { el: 'Εργαστήριο & μικροβιολογία/AMR', en: 'Laboratory & microbiology/AMR', from: 'laboratory' },
  national: { el: 'Αναφορές ΕΟΔΥ & EARS-Net', en: 'ΕΟΔΥ & EARS-Net reports', from: 'laboratory' },
  surveillance: { el: 'Επιτήρηση λοιμώξεων (HAI, απομόνωση, αγωγή, έκβαση)', en: 'Infection surveillance (HAI, isolation, therapy, outcome)', from: 'surveillance' },
  indicators: { el: 'Δείκτες', en: 'Indicators', from: 'surveillance' },
  prevention: { el: 'Πρόληψη & υγιεινή χεριών', en: 'Prevention & hand hygiene', from: 'full' },
  controls: { el: 'Έλεγχοι', en: 'Controls', from: 'full' },
  quality: { el: 'Ποιότητα (συμβάντα, CAPA)', en: 'Quality (incidents, CAPA)', from: 'full' },
  training: { el: 'Εκπαίδευση', en: 'Training', from: 'full' },
  governance: { el: 'Επιτροπές & Έγγραφα', en: 'Committees & Documents', from: 'full' },
})
const PROFILE_RANK = Object.freeze({ laboratory: 0, surveillance: 1, full: 2 })
export function profileModules(profile) {
  const rank = PROFILE_RANK[profile] ?? PROFILE_RANK[DEFAULT_PROFILE]
  return Object.keys(MODULES).filter(key => PROFILE_RANK[MODULES[key].from] <= rank)
}

// Capabilities that belong to each switchable part. Everything not listed here
// (patients, laboratory, employees registry, analytics, management) is always on.
const SURVEILLANCE = [
  C.VIEW_SURVEILLANCE, C.CREATE_SURVEILLANCE, C.EDIT_SURVEILLANCE, C.DELETE_SURVEILLANCE, C.CLOSE_SURVEILLANCE,
  C.REOPEN_SURVEILLANCE, C.REASSESS_SURVEILLANCE, C.RECORD_SURVEILLANCE_OUTCOME, C.MANAGE_ISOLATION,
  C.MANAGE_ANTIMICROBIAL_THERAPY, C.RECORD_CLINICAL_ASSESSMENT, C.REVIEW_CLINICAL,
  C.VIEW_INDICATORS, C.MANAGE_INDICATORS, C.MANAGE_BED_DAYS,
]
const PROGRAMME = [
  C.VIEW_PREVENTION, C.RECORD_HAND_HYGIENE, C.RECORD_WASTE, C.RECORD_ANTISEPTIC, C.RECORD_PREVENTION_BUNDLE,
  C.VIEW_CONTROLS, C.MANAGE_CONTROLS, C.EXECUTE_CONTROL, C.EDIT_CONTROL_DEFINITION, C.EDIT_CONTROL_EXECUTION,
  C.VOID_CONTROL_EXECUTION, C.ARCHIVE_CONTROL_DEFINITION, C.DELETE_CONTROL_DRAFT,
  C.VIEW_QUALITY, C.MANAGE_QUALITY, C.REPORT_INCIDENT,
  C.VIEW_TRAINING, C.MANAGE_TRAINING,
  C.VIEW_COMMITTEES, C.MANAGE_COMMITTEES, C.CREATE_COMMITTEE, C.MANAGE_COMMITTEE_MEMBERS, C.CREATE_COMMITTEE_MEETING,
  C.EDIT_COMMITTEE_MINUTES, C.FINALIZE_COMMITTEE_MINUTES, C.MANAGE_COMMITTEE_DECISIONS, C.MANAGE_COMMITTEE_DOCUMENTS, C.ARCHIVE_COMMITTEE,
  C.VIEW_DOCUMENTS, C.MANAGE_DOCUMENTS, C.SUBMIT_DOCUMENT_REVIEW, C.APPROVE_DOCUMENT, C.PUBLISH_DOCUMENT,
  C.SUPERSEDE_DOCUMENT, C.ARCHIVE_DOCUMENT, C.DELETE_DOCUMENT_DRAFT,
]
const ADDON_CAPABILITIES = Object.freeze({
  occupational_health: [C.VIEW_OCCUPATIONAL_HEALTH, C.MANAGE_OCCUPATIONAL_HEALTH],
  pharmacy: [C.VIEW_PHARMACY, C.MANAGE_PHARMACY, C.RECORD_PHARMACY],
  prevalence_survey: [C.RECORD_PREVALENCE_SURVEY],
  lira: [C.VIEW_LIRA],
})

export function normalizeProfile(organization) {
  const profile = OPERATING_PROFILES.includes(organization?.operating_profile) ? organization.operating_profile : DEFAULT_PROFILE
  const addons = Array.isArray(organization?.enabled_addons) ? organization.enabled_addons.filter(item => ADDONS.includes(item)) : [...ADDONS]
  return { profile, addons }
}

export function moduleEnabled(organization, module) {
  const { profile, addons } = normalizeProfile(organization)
  if (module === 'surveillance') return profile !== 'laboratory'
  if (module === 'programme') return profile === 'full'
  if (ADDONS.includes(module)) return addons.includes(module)
  return true
}

// Capabilities switched off by an organization's profile (empty for a full
// profile with every add-on, and for no organization at all).
export function disabledCapabilitiesFor(organization) {
  if (!organization) return new Set()
  const off = []
  if (!moduleEnabled(organization, 'surveillance')) off.push(...SURVEILLANCE)
  if (!moduleEnabled(organization, 'programme')) off.push(...PROGRAMME)
  for (const addon of ADDONS) if (!moduleEnabled(organization, addon)) off.push(...ADDON_CAPABILITIES[addon])
  return new Set(off)
}
