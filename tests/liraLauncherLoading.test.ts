import {describe,expect,it} from 'vitest'
import { readSource } from './helpers/readSource'

describe('LIRA launcher loading lifecycle',()=>{
 it('does not make loading state an effect dependency that cancels its own request',()=>{
  const source=readSource('src/features/lira/LiraAssistantLauncher.jsx')
  const effect=source.match(/useEffect\(\(\)=>\{if\(!open\|\|data[\s\S]*?\},\[open,data,[^\]]+\]\)/)?.[0]||''
  expect(effect).not.toContain('||loading||')
  expect(effect).not.toContain('[open,data,loading,')
  expect(effect).toContain('[open,data,allowed,isDemo,tenant?.id]')
 })
})
