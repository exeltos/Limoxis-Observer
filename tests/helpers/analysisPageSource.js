import { readSource } from './readSource'

// The Analysis page is split across AnalysisPage.tsx, AnalysisPanels.tsx and
// analysisPageModel.ts; source-level assertions read them as one text.
export const ANALYSIS_PAGE_FILES = [
  'src/features/analysis/AnalysisPage.tsx',
  'src/features/analysis/AnalysisPanels.tsx',
  'src/features/analysis/analysisPageModel.ts',
]
export function readAnalysisPageSource() {
  return ANALYSIS_PAGE_FILES.map(file => readSource(new URL(`../../${file}`, import.meta.url))).join('\n')
}
