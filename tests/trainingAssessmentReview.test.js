import {describe,expect,it} from 'vitest'
import fs from 'node:fs'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

describe('training participant assessment review',()=>{
 it('opens submitted participant results in a dedicated review dialog',()=>{
  const page=read('src/features/training/TrainingProductionPage.jsx')
  const review=read('src/features/training/TrainingResultsReview.jsx')
  expect(page).toContain('<TrainingResultsReview program={program} rows={assignments}')
  expect(review).toContain("Αξιολόγηση συμμετέχοντα")
  expect(review).toContain("Υποβληθείσες απαντήσεις")
  expect(review).toContain("Απαντήσεις φόρμας")
 })

 it('requires an explicit reviewer acknowledgement before saving review evidence',()=>{
  const review=read('src/features/training/TrainingResultsReview.jsx')
  expect(review).toContain('assessmentReviewedAt')
  expect(review).toContain('assessmentReviewedBy')
  expect(review).toContain('assessmentReviewAcknowledged:true')
  expect(review).toContain('Έλεγξα τις απαντήσεις και το αποτέλεσμα του εκπαιδευόμενου.')
  expect(review).toContain('disabled={busy||!reviewed}')
 })

 it('does not add a redundant close action to the review footer',()=>{
  const review=read('src/features/training/TrainingResultsReview.jsx')
  expect(review).not.toContain('cancelLabel=')
  expect(review).toContain('onClose={()=>setSelected(null)}')
 })
})
