import { register } from 'node:module'

// node --import ./tools/ts/register.mjs tools/<έλεγχος>.mjs
register('./resolveTs.mjs', import.meta.url)
