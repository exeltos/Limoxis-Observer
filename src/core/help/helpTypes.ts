import type { ComponentType } from 'react'

// Μια σελίδα του εγχειριδίου (helpManual, helpManualEn, helpPlatform): κεφάλαια
// [τίτλος, κείμενο], βήματα και η οθόνη της προεπισκόπησης.
export interface HelpPage {
  title: string
  summary: string
  audience: string
  chapters: Array<[string, string]>
  steps: string[]
  preview?: string
}

export type HelpBook = Record<string, HelpPage>

// Έλεγχοι πριν ολοκληρωθεί μια εργασία, καλή πρακτική και σχετικές ενότητες ανά οθόνη.
export interface HelpExtra {
  checks?: { el: string[]; en: string[] }
  tip?: { el: string; en: string }
  related?: string[]
}

// Μια ενότητα του μενού του εγχειριδίου (από το μενού της εφαρμογής ή της πλατφόρμας).
export interface HelpNavigationItem {
  to: string
  icon?: ComponentType<{ size?: number | string }>
}
