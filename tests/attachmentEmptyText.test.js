import { describe, expect, it } from 'vitest'
import { translate } from '../src/core/i18n/LanguageContext'

describe('attachment field', () => {
  it('has an empty-state text in the global strings (not only inside a record group)', () => {
    expect(translate('noAttachments', 'el')).toBe('Δεν υπάρχουν επισυνάψεις.')
    expect(translate('noAttachments', 'el')).not.toBe('noAttachments')
  })
})
