import {describe,expect,it} from 'vitest'
import {interpretLiraQuestion,LIRA_TOPICS} from '../src/features/lira/liraQuestionModel'
import fs from 'node:fs'
describe('LIRA direct microbiology drill-down',()=>{it('understands Greek microbe wording without prior context',()=>{const p=interpretLiraQuestion('σε ποια τμήματα έχω μικρόβια;');expect(p.topic).toBe(LIRA_TOPICS.INFECTIONS)});it('does not require follow-up state to answer department dimension',()=>{const ui=fs.readFileSync('src/features/lira/LiraAssistantLauncher.jsx','utf8');expect(ui).toContain('if(asksDepartments||asksOrganisms)');expect(ui).not.toContain('if(plan.followUp&&(asksDepartments||asksOrganisms))');expect(ui).toContain("filter(x=>x.organism||x.result==='positive')")})})
