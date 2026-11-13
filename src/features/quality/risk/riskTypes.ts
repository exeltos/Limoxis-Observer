import type { Tables } from '../../../core/supabase/database.types'
import type { IconType } from '../../../design-system/types'
import type { RiskScore,RiskSummary } from './riskModel'

// The shapes the risk assessment screens keep (riskService translates them to
// and from the rows of quality_risk_assessments / quality_risks /
// quality_risk_opportunities; the Demo keeps whole assessments in one snapshot).
// Type aliases, not interfaces, so a record can also be read by field name
// (txt(item,'title',en)).

// The three scores of a risk.
export type RiskStage='inherent'|'residual'|'target'

// The columns riskService selects.
export type RiskAssessmentRow=Pick<Tables<'quality_risk_assessments'>,'id'|'code'|'title'|'period_label'|'period_kind'|'assessed_on'|'next_review_on'|'assessor_label'|'form_code'|'scope_note'|'status'|'approved_by_label'|'approved_on'|'source_assessment_id'|'history'|'updated_at'>
export type RiskRow=Pick<Tables<'quality_risks'>,'id'|'assessment_id'|'lineage_key'|'position'|'section'|'process'|'scope'|'hazard'|'inherent_l'|'inherent_c'|'existing_controls'|'residual_l'|'residual_c'|'consequence_rationale'|'additional_measures'|'owner_label'|'due_date'|'review_frequency'|'indicator'|'target_l'|'target_c'|'jci_chapter'|'jci_reference'|'indicator_keys'|'prioritized'|'notes'|'updated_at'>
export type OpportunityRow=Pick<Tables<'quality_risk_opportunities'>,'id'|'assessment_id'|'position'|'activity'|'opportunity'|'rating'|'action_plan'|'timeframe'|'owner_label'|'effectiveness'|'effectiveness_status'|'updated_at'>

// One step of an assessment's history (auditEvent; the Demo's trail has id, action, actor and at).
export type RiskHistoryEntry={id: string,action: string,at: string,actor?: string,actorId?: string,actorEmail?: string,reason?: string|null,detail?: unknown}
// The detail of an import from a platform template.
export type TemplateDetail={template?: string}|null|undefined

// A risk of an assessment. Demo records also carry English wording in `<field>En`.
export type Risk={
 id: string
 assessmentId: string
 lineageKey: string
 position: number
 section: string
 process: string
 processEn?: string
 scope: string
 scopeEn?: string
 hazard: string
 hazardEn?: string
 inherentL: number|null
 inherentC: number|null
 existingControls: string
 existingControlsEn?: string
 residualL: number|null
 residualC: number|null
 consequenceRationale: string
 additionalMeasures: string
 additionalMeasuresEn?: string
 owner: string
 ownerEn?: string
 dueDate: string|null
 reviewFrequency: string
 reviewFrequencyEn?: string
 indicator: string
 targetL: number|null
 targetC: number|null
 jci: string
 jciReference: string
 indicatorKeys: string[]
 prioritized: boolean
 notes: string
 updatedAt: string
 // Not set by the service or the import: the sorts read it as a tie-breaker.
 code?: string
}
// A risk being written (new, in the editor, or read from a file): any part of it.
export type RiskDraft=Partial<Risk>
// A risk read from a spreadsheet, before it belongs to an assessment.
export type ImportedRisk=Omit<Risk,'id'|'assessmentId'|'position'|'indicatorKeys'|'updatedAt'>
// The text fields of a risk the editor shows as inputs.
export type RiskTextField='process'|'scope'|'hazard'|'existingControls'|'consequenceRationale'|'additionalMeasures'|'owner'|'reviewFrequency'|'indicator'|'jci'|'jciReference'|'notes'

// An opportunity (ISO 9001 §6.1). `ratingId` is the yield as an id
// (normalizeOpportunity); `rating` the stored wording.
export type Opportunity={
 id?: string
 assessmentId?: string
 position?: number
 activity?: string
 opportunity?: string
 rating?: string
 ratingId?: string
 actionPlan?: string
 timeframe?: string
 owner?: string
 effectiveness?: string
 effectivenessStatus?: string
 updatedAt?: string
}
export type NormalizedOpportunity=Opportunity&{ratingId: string,effectivenessStatus: string,effectiveness: string}
// A row of the opportunities list.
export type OpportunityListRow={item: Opportunity,o: NormalizedOpportunity,code: string,plan: string[]}

// The header of an assessment (one period).
export type RiskAssessmentHeader={
 id: string
 code: string
 title: string
 titleEn?: string
 periodLabel: string
 periodKind: string
 assessedOn: string
 nextReviewOn: string|null
 assessorLabel: string
 formCode: string
 scopeNote: string
 status: string
 approvedByLabel: string
 approvedOn: string|null
 sourceAssessmentId: string|null
 history: RiskHistoryEntry[]
 updatedAt: string
 // Read by the list's sort when present.
 periodStart?: string
}
// An assessment with its risks (the list and one assessment) and its opportunities (one assessment).
export type RiskAssessment=RiskAssessmentHeader&{risks: Risk[],opportunities?: Opportunity[]}
// The assessment a new one carries its risks and opportunities from.
export type CarryFrom={id: string,risks?: (Risk|ImportedRisk)[],opportunities?: Opportunity[]}
// A row of the list of assessments.
export type AssessmentListRow={a: RiskAssessment,s: RiskSummary}
// A step of the approval cycle in the assessment's «⋯» menu.
export type AssessmentAction={id: string,label: string,icon: IconType,tone?: string,separatorBefore?: boolean,onClick: ()=>void}
// The header as the dialog keeps it, before the assessment exists.
export type RiskAssessmentDraft=Partial<RiskAssessmentHeader>
// The header fields the dialog shows as inputs.
export type AssessmentTextField='title'|'formCode'|'periodLabel'|'assessorLabel'

// Where an assessment sits in time.
export type RiskPeriod={kind: string,year: number|null,index: number|null}

// A warning of riskWarnings().
export type RiskWarning={id: string,tone: string}
// A risk with its three scores and its warnings, as the register and the analysis list it.
export type ScoredRisk<T=Risk>={risk: T,s: Record<RiskStage,RiskScore>,warnings: RiskWarning[]}
// A row of the analysis per process, JCI chapter or section.
export type RiskGroupRow={key: string,count: number,inherentAvg: number|null,residualAvg: number|null,residualMax: number,highOrAbove: number,level: string|null}
// A risk of the current period against the same risk in the earlier one.
export type ComparisonRow={key: string,risk: Risk,previous: Risk|null,current: number|null,before: number|null,delta: number|null,status: string}
// A heat-map cell the analysis sends to the register.
export type HeatCell={kind: RiskStage,l: number,c: number}
// What the register is opened with: a heat-map cell, a JCI chapter or a KPI card.
export type RegisterPreset={cell?: HeatCell|null,jci?: string,quick?: string}
// A row of the register table: a section's heading or a risk.
export type RegisterRow={heading: LabeledOption,risk?: undefined,s?: undefined,warnings?: undefined}|(ScoredRisk&{heading?: undefined})
// What the assessment page keeps in the history state: the tab, a filter the
// register was opened with, where a link came from and the spot to return to.
export type RiskViewState={riskTab?: string,riskPreset?: RegisterPreset|null,riskOrigin?: {tab: string,mark: string,scroll: number}|null,riskScroll?: number|null,riskMark?: string|null}

// An indicator of the Indicators module, with its 90-day value and trend.
export type IndicatorValue={key: string,titleEl: string,titleEn: string,category: string,unit?: string,unitEn?: string,target?: number|null,direction?: string,value?: number|null,previous?: number|null,status?: string,trend: string}
export type IndicatorValueMap=Map<string,IndicatorValue>
// Indicators proposed for (or linked to) one risk.
export type IndicatorLink={risk: Risk,keys: string[]}

// A record of the Quality module (incident, audit finding, corrective action),
// only the fields the risk screens read.
export type QualityRecordLink={id: string,displayId?: string,title?: string,titleEn?: string,date?: string,department?: string,departmentEn?: string,lifecycleStatus?: string,standard?: string,clauseRef?: string,sourceId?: string,dueDate?: string,status: string}
export type RiskPractice={incidents?: QualityRecordLink[],findings?: QualityRecordLink[]}
// The incidents and findings counted beside a risk.
export type RiskEvidenceCount={incidents: number,findings: number}

// A cell of a spreadsheet sheet, and a sheet as the import reads it.
export type SheetValue=string|number|boolean|null|undefined
export type ImportSheet={name: string,rows: SheetValue[][]}
// A correction made on import (a recomputed score or level, a unified process, a spelling).
export type ImportFix={lineageKey: string,field: string,before: SheetValue,after: SheetValue}
export type ImportPeriod={key: string,risks: ImportedRisk[],fixes: ImportFix[],year?: number|null}
export type ImportSheetUse={name: string,section: string,count: number}
// The columns of one score (L, C, result, level) per period of the file.
export type ScoreSlot={initial?: number,reassessment?: number}
// One assessment an import creates.
export type ImportPlanItem={header: RiskAssessmentDraft,risks: ImportedRisk[],opportunities: Opportunity[]}
// What parseRiskWorkbook reads from a file; the preview adds the file's name.
export type ParsedRiskWorkbook={meta: {formCode: string,title: string,assessedOn: string|null,nextReviewOn: string|null,assessor: string},periods: ImportPeriod[],risks: ImportedRisk[],opportunities: Opportunity[],fixes: ImportFix[],sheets: ImportSheetUse[]}
export type ImportPreview=ParsedRiskWorkbook&{file: string}

// An item of an option list (the scales, levels, ratings).
export type LabeledOption={id: string,el: string,en: string}
export type ScaleOption={value: number,el: string,en: string}
