import { register } from 'node:module'

// node --import ./tools/ts/register.ts tools/<έλεγχος>.ts
register('./resolveTs.ts', import.meta.url)
