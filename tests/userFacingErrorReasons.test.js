import { describe, expect, it } from 'vitest'
import { userFacingError } from '../src/core/feedback/userFacingError'

const el = (error) => userFacingError(error, { language: 'el', context: 'save' })

// A failed save should say why, in the user's terms, not only "could not save".
describe('save errors explain the reason', () => {
  it('names a missing required field', () => {
    expect(el(new Error('null value in column "country" of relation "organizations" violates not-null constraint'))).toBe('Λείπει υποχρεωτικό πεδίο: «Χώρα». Συμπληρώστε το και δοκιμάστε ξανά.')
    expect(el(new Error('null value in column "ward_note" of relation "x" violates not-null constraint'))).toContain('«ward note»')
  })
  it('explains Demo date and invitation problems', () => {
    expect(el(new Error('new row for relation "platform_demo_entitlements" violates check constraint "platform_demo_entitlements_check"'))).toBe('Η λήξη πρέπει να είναι μετά την έναρξη.')
    expect(el(new Error('DEMO_DATES_INVALID'))).toBe('Η λήξη πρέπει να είναι μετά την έναρξη.')
    expect(el(new Error('A user with this email address has already been registered'))).toContain('Υπάρχει ήδη λογαριασμός με αυτό το email')
  })
  it('names the duplicated value and the field of a rejected value', () => {
    expect(el({ message: 'duplicate key value violates unique constraint "organizations_code_key"', details: 'Key (code)=(DEMO-1) already exists.' })).toBe('Υπάρχει ήδη εγγραφή με το ίδιο «Κωδικός» (DEMO-1).')
    expect(el(new Error('new row for relation "organizations" violates check constraint "organizations_type_check"'))).toContain('«Τύπος»')
  })
  it('explains sign-in and length problems', () => {
    expect(el(new Error('Authentication required'))).toContain('δεν αναγνωρίστηκε συνδεδεμένος χρήστης')
    expect(el(new Error('value too long for type character varying(20)'))).toContain('περισσότερους χαρακτήρες')
  })
  it('keeps the generic message when the reason is unknown', () => {
    expect(el(new Error('something odd'))).toBe('Δεν ήταν δυνατή η αποθήκευση των στοιχείων. Δοκιμάστε ξανά.')
  })
})
