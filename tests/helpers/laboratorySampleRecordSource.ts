import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readSource } from './readSource'

// Resolved without the global URL, which is jsdom's in jsdom test files.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

// The laboratory sample record is split across
// LaboratorySampleRecordFunctionalView.jsx and the modules below; source-level
// assertions read them as one text.
export const LABORATORY_SAMPLE_RECORD_FILES = [
  'src/features/laboratory/laboratorySampleFormat.js',
  'src/features/laboratory/LaboratorySampleRecordFunctionalView.jsx',
  'src/features/laboratory/LaboratorySampleViews.jsx',
  'src/features/laboratory/LaboratorySampleDialogs.jsx',
]
export function readLaboratorySampleRecordSource() {
  return LABORATORY_SAMPLE_RECORD_FILES.map(file => readSource(path.join(root, file))).join('\n')
}
