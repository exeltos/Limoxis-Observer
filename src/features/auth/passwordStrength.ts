// The password policy of activation and reset (12–128 characters, uppercase and
// lowercase, a number, a symbol) and the strength meter of the activation page:
// four bars, one per rule met, and a hint for the first rule still missing.
export function passwordRules(password = '', confirm = '') {
  return {
    length: password.length >= 12 && password.length <= 128,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /\d/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
    match: password === confirm && password.length > 0,
  }
}

const HINTS = {
  length: ['χρησιμοποιήστε τουλάχιστον 12 χαρακτήρες', 'use at least 12 characters'],
  case: ['προσθέστε κεφαλαίο και πεζό γράμμα', 'add an uppercase and a lowercase letter'],
  number: ['προσθέστε έναν αριθμό', 'add a number'],
  symbol: ['προσθέστε ένα σύμβολο (π.χ. ! ή #)', 'add a symbol (e.g. ! or #)'],
}
const LEVELS = [
  ['πολύ αδύναμη', 'very weak'],
  ['αδύναμη', 'weak'],
  ['αδύναμη', 'weak'],
  ['μέτρια', 'fair'],
  ['ισχυρή', 'strong'],
]

export function passwordStrength(password = '', language = 'el') {
  const rules = passwordRules(password)
  const checks = [['length', rules.length], ['case', rules.upper && rules.lower], ['number', rules.number], ['symbol', rules.symbol]]
  const score = password ? checks.filter(([, ok]) => ok).length : 0
  const index = language === 'en' ? 1 : 0
  const missing = checks.find(([, ok]) => !ok)?.[0]
  return { score, level: score >= 4 ? 'strong' : score === 3 ? 'fair' : 'weak', label: LEVELS[score][index], hint: missing ? HINTS[missing][index] : '' }
}
