import fs from 'node:fs'
import {describe,expect,it} from 'vitest'

describe('LIRA launcher loading lifecycle',()=>{
 it('does not make loading state an effect dependency that cancels its own request',()=>{
  const source=fs.readFileSync('src/features/lira/LiraAssistantLauncher.jsx','utf8')
  const effect=source.match(/useEffect\(\(\)=>\{if\(!open\|\|data[\s\S]*?\},\[open,data,[^\]]+\]\)/)?.[0]||''
  expect(effect).not.toContain('||loading||')
  expect(effect).not.toContain('[open,data,loading,')
  expect(effect).toContain('[open,data,allowed,isDemo,tenant?.id]')
 })
})
