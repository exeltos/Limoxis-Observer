import { readSessionValue, writeSessionValue } from '../../core/storage/browserStorage'

// The Quality Center tab to show when the user comes back from a record.
export const QUALITY_RETURN_KEY = 'limoxis.quality.returnSection'
export const rememberQualitySection = (section) => writeSessionValue(QUALITY_RETURN_KEY, section)
export const readQualitySection = () => readSessionValue(QUALITY_RETURN_KEY, '')
