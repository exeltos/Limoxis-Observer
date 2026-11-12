// Operating profile of an organization: which parts of the platform a hospital
// uses. Set by the Platform Owner per organization (organizations.operating_profile
// + enabled_addons). A module that is off is hidden everywhere — menu, routes,
// actions, analytics tabs and dashboard tiles — by taking its capabilities away
// from every role in that organization. Its data is kept, and comes back as it
// was if the module is switched on again.
import { CAPABILITIES as C } from '../permissions/capabilityCatalogue.js'

// Ό,τι διαβάζεται από έναν οργανισμό (organizations) για τα modules του.
export interface ProfileSource {
  operating_profile?: string | null
  enabled_addons?: readonly string[] | null
  enabled_modules?: readonly string[] | null
}

interface ModuleDefinition {
  el: string
  en: string
  from: 'basic' | 'surveillance' | 'full'
  analysis: boolean
}

interface ChoiceLabel {
  el: string
  en: string
  hintEl: string
  hintEn: string
}

// The three presets fill in the module list; any other combination is stored as 'custom'.
// 'laboratory' is the former first preset: still accepted for organizations saved before
// the laboratory became an unlockable module, and read as patients + laboratory + EODY/EARS-Net.
export const OPERATING_PROFILES: readonly string[] = Object.freeze(['basic', 'surveillance', 'full'])
const LEGACY_PROFILE_MODULES: Readonly<Record<string, string[]>> = Object.freeze({ laboratory: ['patients', 'laboratory', 'national', 'analysis'] })
const CUSTOM_PROFILE = 'custom'
export const ADDONS: readonly string[] = Object.freeze(['occupational_health', 'pharmacy', 'prevalence_survey', 'lira'])
const DEFAULT_PROFILE = 'full'

export const PROFILE_LABELS: Readonly<Record<string, ChoiceLabel>> = Object.freeze({
  basic: { el: 'Βασική καταγραφή', en: 'Basic records', hintEl: 'Μόνο η καταγραφή ασθενών. Το Εργαστήριο και οι αναφορές ΕΟΔΥ & EARS-Net ξεκλειδώνονται όπου χρειάζονται.', hintEn: 'Patient records only. Laboratory and ΕΟΔΥ & EARS-Net reports can be unlocked where needed.' },
  surveillance: { el: 'Εργαστήριο & Επιτήρηση λοιμώξεων', en: 'Laboratory & infection surveillance', hintEl: 'Εργαστηριακή καταγραφή και αναφορές ΕΟΔΥ & EARS-Net, μαζί με επιτήρηση (ΛΣΦΥ, απομόνωση, αγωγή, έκβαση) και δείκτες.', hintEn: 'Laboratory records and ΕΟΔΥ & EARS-Net reports, plus surveillance (HAI, isolation, therapy, outcome) and indicators.' },
  full: { el: 'Πλήρες πρόγραμμα Ελέγχου Λοιμώξεων', en: 'Full infection control programme', hintEl: 'Ό,τι η επιτήρηση, μαζί με Πρόληψη, Ελέγχους, Ποιότητα, Εκπαίδευση, Επιτροπές και Έγγραφα.', hintEn: 'Surveillance plus Prevention, Controls, Quality, Training, Committees and Documents.' },
})
export const ADDON_LABELS: Readonly<Record<string, ChoiceLabel>> = Object.freeze({
  occupational_health: { el: 'Υγεία εργαζομένων (Ιατρός Εργασίας)', en: 'Occupational health', hintEl: 'Εμβολιασμοί, επισκέψεις Ιατρού Εργασίας και επανέλεγχοι προσωπικού.', hintEn: 'Staff vaccination, occupational physician visits and follow-ups.' },
  pharmacy: { el: 'Φαρμακείο (κατανάλωση αντιμικροβιακών)', en: 'Pharmacy (antimicrobial consumption)', hintEl: 'Κατανάλωση και χορηγήσεις αντιμικροβιακών από το φαρμακείο.', hintEn: 'Antimicrobial consumption and dispensing from the pharmacy.' },
  prevalence_survey: { el: 'Μελέτη επιπολασμού (PPS)', en: 'Point prevalence survey (PPS)', hintEl: 'Περιοδικές μετρήσεις επιπολασμού ΛΣΦΥ και χρήσης αντιβιοτικών.', hintEn: 'Periodic HAI prevalence and antibiotic use measurements.' },
  lira: { el: 'LIRA & AI', en: 'LIRA & AI', hintEl: 'Βοηθός LIRA, διερευνήσεις συρροών και σύνδεση παρόχου AI.', hintEn: 'LIRA assistant, outbreak investigations and AI provider connection.' },
})

// What each operating profile contains, cumulatively: the layout of the profile
// picker is built from this, so the screen and the rules below cannot drift apart.
export const MODULES: Readonly<Record<string, ModuleDefinition>> = Object.freeze({
  patients: { el: 'Ασθενείς', en: 'Patients', from: 'basic', analysis: false },
  laboratory: { el: 'Εργαστήριο & μικροβιολογία/AMR', en: 'Laboratory & microbiology/AMR', from: 'surveillance', analysis: true },
  national: { el: 'Αναφορές ΕΟΔΥ & EARS-Net', en: 'Δηλώσεις ΕΟΔΥ & EARS-Net', from: 'surveillance', analysis: true },
  surveillance: { el: 'Επιτήρηση λοιμώξεων (ΛΣΦΥ, απομόνωση, αγωγή, έκβαση)', en: 'Infection surveillance (HAI, isolation, therapy, outcome)', from: 'surveillance', analysis: true },
  indicators: { el: 'Δείκτες', en: 'Indicators', from: 'surveillance', analysis: false },
  prevention: { el: 'Πρόληψη & υγιεινή χεριών', en: 'Prevention & hand hygiene', from: 'full', analysis: true },
  controls: { el: 'Έλεγχοι', en: 'Controls', from: 'full', analysis: true },
  quality: { el: 'Ποιότητα (συμβάντα, διορθωτικές ενέργειες)', en: 'Quality (incidents, CAPA)', from: 'full', analysis: true },
  training: { el: 'Εκπαίδευση', en: 'Training', from: 'full', analysis: true },
  governance: { el: 'Επιτροπές & Έγγραφα', en: 'Committees & Documents', from: 'full', analysis: true },
  kitchen: { el: 'Κουζίνα (HACCP) & άσκηση ανάκλησης', en: 'Kitchen (HACCP) & recall drill', from: 'full', analysis: false },
  suppliers: { el: 'Προμηθευτές & πιστοποιητικά', en: 'Suppliers & certificates', from: 'full', analysis: false },
  interviews: { el: 'Συνεντεύξεις υποψηφίων (HR)', en: 'Candidate interviews (HR)', from: 'full', analysis: false },
  analysis: { el: 'Ανάλυση', en: 'Analysis', from: 'surveillance', analysis: false },
  executive: { el: 'Πίνακας Διοίκησης (Διευθυντής)', en: 'Executive dashboard (Director)', from: 'full', analysis: false },
})
// Always on for every organization; the Platform Owner switches the rest one by one.
export const CORE_MODULES: readonly string[] = Object.freeze(['patients'])
export const OPTIONAL_MODULES = Object.freeze(Object.keys(MODULES).filter(key => !CORE_MODULES.includes(key)))
const PROFILE_RANK: Readonly<Record<string, number>> = Object.freeze({ basic: 0, surveillance: 1, full: 2 })
export function profileModules(profile: string | null | undefined): string[] {
  const rank = PROFILE_RANK[String(profile)] ?? PROFILE_RANK[DEFAULT_PROFILE]
  return Object.keys(MODULES).filter(key => PROFILE_RANK[MODULES[key].from] <= rank)
}

// Capabilities that belong to each switchable module. Everything not listed here
// (patients, employees registry, management) is always on.
const MODULE_CAPABILITIES: Readonly<Record<string, string[]>> = Object.freeze({
  laboratory: [C.VIEW_LAB, C.MANAGE_LAB_SAMPLES, C.REQUEST_LAB_SAMPLES, C.VALIDATE_LAB_RESULTS, C.REOPEN_LAB_RECORD],
  national: [], // ΕΟΔΥ & EARS-Net reports live in Analysis; gated there
  surveillance: [
    C.VIEW_SURVEILLANCE, C.CREATE_SURVEILLANCE, C.EDIT_SURVEILLANCE, C.DELETE_SURVEILLANCE, C.CLOSE_SURVEILLANCE,
    C.REOPEN_SURVEILLANCE, C.REASSESS_SURVEILLANCE, C.RECORD_SURVEILLANCE_OUTCOME, C.MANAGE_ISOLATION,
    C.MANAGE_ANTIMICROBIAL_THERAPY, C.RECORD_CLINICAL_ASSESSMENT, C.REVIEW_CLINICAL,
  ],
  indicators: [C.VIEW_INDICATORS, C.MANAGE_INDICATORS, C.MANAGE_BED_DAYS],
  prevention: [C.VIEW_PREVENTION, C.RECORD_HAND_HYGIENE, C.RECORD_WASTE, C.RECORD_ANTISEPTIC, C.RECORD_PREVENTION_BUNDLE],
  controls: [
    C.VIEW_CONTROLS, C.MANAGE_CONTROLS, C.EXECUTE_CONTROL, C.EDIT_CONTROL_DEFINITION, C.EDIT_CONTROL_EXECUTION,
    C.VOID_CONTROL_EXECUTION, C.ARCHIVE_CONTROL_DEFINITION, C.DELETE_CONTROL_DRAFT,
  ],
  quality: [C.VIEW_QUALITY, C.MANAGE_QUALITY, C.REPORT_INCIDENT],
  training: [C.VIEW_TRAINING, C.MANAGE_TRAINING],
  kitchen: [C.VIEW_KITCHEN, C.RECORD_KITCHEN, C.MANAGE_KITCHEN],
  suppliers: [], // the Suppliers tab and record of Quality; gated there
  interviews: [C.VIEW_INTERVIEWS, C.MANAGE_INTERVIEWS],
  analysis: [C.VIEW_ANALYSIS],
  executive: [C.VIEW_EXECUTIVE_DASHBOARD],
  governance: [
    C.VIEW_COMMITTEES, C.MANAGE_COMMITTEES, C.CREATE_COMMITTEE, C.MANAGE_COMMITTEE_MEMBERS, C.CREATE_COMMITTEE_MEETING,
    C.EDIT_COMMITTEE_MINUTES, C.FINALIZE_COMMITTEE_MINUTES, C.MANAGE_COMMITTEE_DECISIONS, C.MANAGE_COMMITTEE_DOCUMENTS, C.ARCHIVE_COMMITTEE,
    C.VIEW_DOCUMENTS, C.MANAGE_DOCUMENTS, C.SUBMIT_DOCUMENT_REVIEW, C.APPROVE_DOCUMENT, C.PUBLISH_DOCUMENT,
    C.SUPERSEDE_DOCUMENT, C.ARCHIVE_DOCUMENT, C.DELETE_DOCUMENT_DRAFT,
  ],
})
const ADDON_CAPABILITIES: Readonly<Record<string, string[]>> = Object.freeze({
  occupational_health: [C.VIEW_OCCUPATIONAL_HEALTH, C.MANAGE_OCCUPATIONAL_HEALTH],
  pharmacy: [C.VIEW_PHARMACY, C.MANAGE_PHARMACY, C.RECORD_PHARMACY_CONSUMPTION],
  prevalence_survey: [C.RECORD_PREVALENCE_SURVEY],
  lira: [C.VIEW_LIRA],
})

// Modules that give little without another one (e.g. indicators are computed from surveillance
// data). Only used to warn the Platform Owner: nothing is blocked or switched on automatically.
export const MODULE_DEPENDENCIES: Readonly<Record<string, string[]>> = Object.freeze({
  surveillance: ['laboratory'],
  indicators: ['surveillance'],
  national: ['laboratory'],
  executive: ['analysis'],
})
// [module, [missing modules]] for every enabled module whose prerequisite is locked.
export function missingDependencies(modules: readonly string[] | null | undefined): Array<[string, string[]]> {
  const on = new Set(modules || [])
  return Object.entries(MODULE_DEPENDENCIES)
    .filter(([module]) => on.has(module))
    .map(([module, needs]): [string, string[]] => [module, needs.filter(need => !on.has(need))])
    .filter(([, missing]) => missing.length)
}

// The preset whose module list equals `modules`, else 'custom'.
export function profileFor(modules: readonly string[] | null | undefined): string {
  const set = new Set(modules || [])
  return OPERATING_PROFILES.find(id => { const preset = profileModules(id); return preset.length === set.size && preset.every(key => set.has(key)) }) || CUSTOM_PROFILE
}

// Modules, add-ons and profile of an organization. `enabled_modules` (set by the
// Platform Owner module by module) wins; without it the preset decides, so
// organizations saved before per-module control behave exactly as before.
export interface OperatingProfile {
  profile: string
  addons: string[]
  modules: string[]
}

export function normalizeProfile(organization: ProfileSource | null | undefined): OperatingProfile {
  const operatingProfile = String(organization?.operating_profile ?? '')
  const stored = OPERATING_PROFILES.includes(operatingProfile) || operatingProfile === CUSTOM_PROFILE || operatingProfile in LEGACY_PROFILE_MODULES ? operatingProfile : DEFAULT_PROFILE
  const addons = Array.isArray(organization?.enabled_addons) ? organization.enabled_addons.filter(item => ADDONS.includes(item)) : [...ADDONS]
  const fromProfile = LEGACY_PROFILE_MODULES[stored] || profileModules(stored === CUSTOM_PROFILE ? DEFAULT_PROFILE : stored)
  const enabledModules = organization?.enabled_modules
  const modules = Array.isArray(enabledModules)
    ? Object.keys(MODULES).filter(key => CORE_MODULES.includes(key) || enabledModules.includes(key))
    : fromProfile
  return { profile: profileFor(modules), addons, modules }
}

export function moduleEnabled(organization: ProfileSource | null | undefined, module: string): boolean {
  const { addons, modules } = normalizeProfile(organization)
  if (MODULES[module]) return modules.includes(module)
  if (ADDONS.includes(module)) return addons.includes(module)
  return true
}

// Capabilities switched off by an organization's modules (empty for a full
// profile with every add-on, and for no organization at all).
export function disabledCapabilitiesFor(organization: ProfileSource | null | undefined): Set<string> {
  if (!organization) return new Set()
  const off: string[] = []
  for (const module of OPTIONAL_MODULES) if (!moduleEnabled(organization, module)) off.push(...(MODULE_CAPABILITIES[module] || []))
  for (const addon of ADDONS) if (!moduleEnabled(organization, addon)) off.push(...ADDON_CAPABILITIES[addon])
  return new Set(off)
}
