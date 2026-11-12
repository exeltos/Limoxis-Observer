// Η τιμή του LanguageContext (LanguageProvider), για τα αρχεία TypeScript που
// διαβάζουν τη γλώσσα. Το LanguageContext.jsx τη δηλώνει με JSDoc.
export type Language = 'el' | 'en'

export interface LanguageContextValue {
  language: Language
  // false μόνο όσο μια αρχική αγγλική προβολή δείχνει ακόμη τα ελληνικά
  ready: boolean
  locale: string
  setLanguage: (next: string) => void
  t: (key: string) => string
}
