import fs from 'node:fs'

// The committee record page is split across committeeRecordFormat.js,
// CommitteeRecordPage.jsx, CommitteeRecordSections.jsx and
// CommitteeRecordDialogs.jsx; source-level assertions read them as one text,
// in the order the code had before the split.
export const COMMITTEE_RECORD_FILES = [
  'src/features/committees/committeeRecordFormat.js',
  'src/features/committees/CommitteeRecordPage.jsx',
  'src/features/committees/CommitteeRecordSections.jsx',
  'src/features/committees/CommitteeRecordDialogs.jsx',
]
export function readCommitteeRecordSource() {
  return COMMITTEE_RECORD_FILES.map(file => fs.readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8')).join('\n')
}
