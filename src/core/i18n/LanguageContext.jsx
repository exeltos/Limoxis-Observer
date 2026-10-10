import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { readLocalValue, writeLocalValue } from '../storage/browserStorage'
import { productStringsEl, stringsEl } from './stringsEl.js'

const LanguageContext = createContext(null)

// Greek is bundled with the app; English is attached by loadLanguage('en').
export const strings = { el: stringsEl }

export const productStrings = { el: productStringsEl }

// Supports both flat keys (t('save')) and dot-namespaced keys for domain-scoped
// translations (t('environmentalStandards.protocolCode')) added to prevent the
// cross-domain key collisions this dictionary has repeatedly run into as flat
// generic words (e.g. 'room', 'source', 'scope') get reused by unrelated features.
function lookupTranslation(key, language) {
  const path = key.split('.')
  const read = (dict) => path.reduce((acc, part) => acc?.[part], dict)
  return read(productStrings[language]) ?? read(strings[language]) ?? read(productStrings.el) ?? read(strings.el) ?? key
}

// For code outside a component (or with only a language flag in scope) that
// still needs dictionary text, e.g. translate('copy.occupationalCopy.date', 'en').
export const translate = (key, language) => lookupTranslation(key, language === 'en' ? 'en' : 'el')

const LANGUAGE_STORAGE_KEY = 'limoxis.language'

function initialLanguage() {
  const previewLanguage = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('helpLang') : null
  const requested = previewLanguage || readLocalValue(LANGUAGE_STORAGE_KEY)
  return requested === 'en' ? 'en' : 'el'
}

// English strings live in their own chunk (./stringsEn.js); Greek is bundled.
// Until English has loaded, lookups fall back to Greek, so callers switch the
// language only after loadLanguage() resolves.
let englishLoad = null
const isLanguageLoaded = language => language !== 'en' || Boolean(strings.en)
export function loadLanguage(language) {
  if (isLanguageLoaded(language)) return Promise.resolve()
  englishLoad ||= import('./stringsEn.js').then(module => {
    strings.en = module.stringsEn
    productStrings.en = module.productStringsEn
  }).catch(error => { englishLoad = null; throw error })
  return englishLoad
}
// Called before the first render so a returning English user never sees Greek.
export const preloadInitialLanguage = () => loadLanguage(initialLanguage()).catch(() => {})

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(initialLanguage)
  const [loadedLanguage, setLoadedLanguage] = useState(() => (isLanguageLoaded(language) ? language : null))
  // Initial English without a preload (tests, embedded previews): render with
  // the Greek fallback, then re-render once the English chunk arrives.
  useEffect(() => {
    if (isLanguageLoaded(language)) return undefined
    let active = true
    loadLanguage(language).then(() => { if (active) setLoadedLanguage(language) }).catch(() => {})
    return () => { active = false }
  }, [language])
  const setLanguage = useCallback((next) => {
    const target = next === 'en' ? 'en' : 'el'
    loadLanguage(target).then(() => setLanguageState(target)).catch(() => setLanguageState('el'))
  }, [])
  // Keep <html lang> in sync (screen readers, hyphenation, and the error/status
  // fallbacks that render outside this provider read it) and remember the choice
  // across reloads.
  useEffect(() => {
    if (typeof document !== 'undefined') document.documentElement.lang = language
    writeLocalValue(LANGUAGE_STORAGE_KEY, language)
  }, [language])
  const value = useMemo(() => ({
    language,
    // false only while an initial English render is still on the Greek fallback
    ready: loadedLanguage === language || isLanguageLoaded(language),
    locale: language === 'el' ? 'el-GR' : 'en-GB',
    setLanguage,
    t: (key) => lookupTranslation(key, language),
  }), [language, setLanguage, loadedLanguage])
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider')
  return context
}

