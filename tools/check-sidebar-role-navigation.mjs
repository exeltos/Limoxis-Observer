import { strict as assert } from 'node:assert'
import fs from 'node:fs'
const shell=fs.readFileSync('src/app/AppShell.jsx','utf8')
assert.match(shell,/usesCompactMore=\[ROLES\.HOSPITAL_ADMIN,ROLES\.INFECTION_CONTROL_LEAD\]\.includes\(role\)/)
assert.match(shell,/const moreNavigation=usesCompactMore\?/)
assert.match(shell,/const primaryNavigation=usesCompactMore/)
console.log('Sidebar role navigation check passed: More is restricted to Hospital Admin and Infection Control Lead.')
