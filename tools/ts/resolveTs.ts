// Οι έλεγχοι (tools/*.ts) εισάγουν αρχεία του src με σκέτο Node. Στη μετάβαση
// σε TypeScript ένα αρχείο αλλάζει κατάληξη (.js → .ts): η εισαγωγή γράφει
// './roles.js' ή './roles' και εδώ βρίσκεται το './roles.ts'. Το Node 22.18+
// αφαιρεί μόνο του τους τύπους από τα .ts.
const CANDIDATES = { '.js': ['.ts'], '': ['.js', '.ts'] }

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context)
  } catch (error) {
    if (error?.code !== 'ERR_MODULE_NOT_FOUND' || !/^\.\.?\//.test(specifier)) throw error
    const match = specifier.match(/\.js$/)
    const base = match ? specifier.slice(0, -3) : specifier
    const alternates = match ? CANDIDATES['.js'] : (/\.[a-z]+$/.test(specifier) ? [] : CANDIDATES[''])
    for (const ext of alternates) {
      try {
        return await nextResolve(base + ext, context)
      } catch {
        // δοκίμασε την επόμενη κατάληξη
      }
    }
    throw error
  }
}
