import {describe,expect,it} from 'vitest'
import { readSource } from './helpers/readSource'
const ui=readSource('src/features/management/LiraOutbreakInvestigationsPanel.jsx')
describe('LIRA outbreak evidence workspace',()=>{it('loads authorized data and deterministic line list',()=>{expect(ui).toContain('loadLiraData({organizationId:tenant.id})');expect(ui).toContain('buildOutbreakLineList');expect(ui).toContain('buildOutbreakTimeline')});it('uses governed case review',()=>{expect(ui).toContain('evaluateOutbreakCaseDefinition');expect(ui).toContain('Criteria met · review required');expect(ui).toContain('δεν επιβεβαιώνουν αυτόματα')});it('shows linked evidence',()=>{expect(ui).toContain('row.hai.map');expect(ui).toContain('row.devices.map');expect(ui).toContain('row.isolation.map')})})
