import fs from 'node:fs'

// The Analysis page is split across AnalysisPage.jsx, AnalysisPanels.jsx and
// analysisPageModel.js; source-level assertions read them as one text.
export const ANALYSIS_PAGE_FILES = [
  'src/features/analysis/AnalysisPage.jsx',
  'src/features/analysis/AnalysisPanels.jsx',
  'src/features/analysis/analysisPageModel.js',
]
export function readAnalysisPageSource() {
  return ANALYSIS_PAGE_FILES.map(file => fs.readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8')).join('\n')
}
