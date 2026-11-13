import type { useRegistryMemory } from '../../../core/navigation/useRegistryMemory'
import type { LibraryDepartment } from '../../management/useLibraries'

// The shapes the survey screens keep (surveyService translates them to and from
// quality_surveys / quality_survey_responses in database.types). Questions,
// sections and answers are stored as JSON, so they are type aliases (an
// interface is not assignable to Json).

// One answer: a score (1–5 or 0–10), Yes/No, an option, several options, a text.
export type SurveyAnswer = string | number | boolean | string[]
// A response's answers, by question id. Never who gave them.
export type SurveyAnswers = Record<string, SurveyAnswer | undefined>

// An option of a single- or multiple-choice question.
export type SurveyOption = { value: string, label: string, labelEn?: string }
// A question shown only after another's answer (Yes/No or an option).
export type SurveyShowWhen = { question: string, value?: string | boolean }
export type SurveyQuestion = {
  id: string
  section?: string
  type: string
  label: string
  labelEn?: string
  required?: boolean
  options?: SurveyOption[]
  // The words of a 1–5 scale (SCALES).
  scale?: string
  showWhen?: SurveyShowWhen | null
}
export type SurveySection = { key: string, label: string, labelEn?: string }

// What a form needs to be answered: the questions and the titles of their sections.
export interface SurveyContent { questions: SurveyQuestion[], sections?: SurveySection[] }

// A questionnaire a hospital starts from.
export interface SurveyTemplate extends SurveyContent {
  key: string
  audience: string
  title: string
  titleEn: string
  description: string
  descriptionEn: string
  sections: SurveySection[]
}

// A survey as the screens use it.
export interface Survey extends SurveyContent {
  id: string
  code: string
  templateKey: string
  audience: string
  title: string
  titleEn?: string
  description?: string
  descriptionEn?: string
  departmentIds: string[]
  sections: SurveySection[]
  status: string
  opensOn: string
  closesOn: string
  // As typed in the editor ('' when none), a number from the database.
  targetResponses: number | string
  satisfiedTarget: number
  publicToken: string
  createdAt?: string
  updatedAt?: string
}
// A survey of the list, with how many responses it has (all, and in the last 30 days).
export interface SurveyListItem extends Survey { responseCount: number, recentCount: number }

// One response; the department's names are added when it is read.
export interface SurveyResponse {
  id: string
  surveyId?: string
  departmentId: string
  department?: string
  departmentEn?: string
  channel: string
  answers: SurveyAnswers
  submittedAt: string
}

// A department a survey is about (the hospital's departments, or the demo's).
export type SurveyDepartment = Pick<LibraryDepartment, 'id' | 'name'> & { nameEn?: string }

// What the public link reads (survey_public): no account, no token of the survey.
export interface PublicSurvey extends SurveyContent {
  open: boolean
  title: string
  titleEn?: string
  description?: string
  descriptionEn?: string
  audience: string
  organizationName?: string
  sections: SurveySection[]
  departments: SurveyDepartment[]
}

// --- Analysis ---------------------------------------------------------------------

// What the figures read of a survey and of its responses. The Analysis and the
// management review pass their own rows too, so every field may be missing.
export type SurveyFigures = Partial<Pick<Survey, 'questions' | 'satisfiedTarget' | 'targetResponses'>>
export type SurveyResponseInput = Partial<SurveyResponse>

// A comment of a free-text question.
export interface SurveyComment { id?: string, text: SurveyAnswer | undefined, department: string, departmentEn: string, submittedAt?: string }
export interface SurveyOptionResult extends SurveyOption { count: number, share: number | null }
// One question's answers; the figures depend on its kind (questionResult).
export interface SurveyQuestionResult {
  question: SurveyQuestion
  count: number
  // 1–5
  mean?: number | null
  satisfied?: number | null
  distribution?: number[]
  // 0–10
  promoters?: number | null
  detractors?: number | null
  nps?: number | null
  // Yes/No
  yes?: number | null
  // Choice
  options?: SurveyOptionResult[]
  // Text
  texts?: SurveyComment[]
}
export interface SatisfactionCounts { answered: number, satisfied: number }

// --- Screens ----------------------------------------------------------------------

// The list's filters (the Quality page keeps them; a type alias, so they stay a plain record there).
export type SurveyFilters = { query?: string, audience?: string, status?: string, quick?: string | null }
export type SurveyRegistry = ReturnType<typeof useRegistryMemory>
// A response being typed in from paper or on a tablet.
export interface SurveyEntry { departmentId: string, channel: string, answers: SurveyAnswers, missing: string[] }
// The question open in the editor's window (previousId null for a new one).
export interface SurveyEditing { question: SurveyQuestion, previousId: string | null }
// A poster of the Collection tab.
export interface SurveyPoster { id: string, name: string }
