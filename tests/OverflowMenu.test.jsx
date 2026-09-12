// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LanguageProvider } from '../src/core/i18n/LanguageContext'
import { OverflowMenu } from '../src/design-system/OverflowMenu'

function renderMenu(props={}){
  return render(<LanguageProvider><OverflowMenu label="Actions" items={[{id:'edit',label:'Edit',onClick:vi.fn()}]} {...props}/></LanguageProvider>)
}

describe('OverflowMenu',()=>{
  afterEach(()=>{cleanup();vi.restoreAllMocks()})

  it('keeps a start-aligned popover inside a narrow viewport',()=>{
    vi.spyOn(document.documentElement,'clientWidth','get').mockReturnValue(200)
    vi.spyOn(window,'innerWidth','get').mockReturnValue(200)
    vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockReturnValue({left:0,right:32,bottom:40,top:8,width:32,height:32,x:0,y:8,toJSON:()=>({})})

    renderMenu({align:'start'})
    fireEvent.click(screen.getByRole('button',{name:'Actions'}))

    expect(screen.getByRole('menu')).toHaveStyle({left:'8px',width:'184px'})
  })

  it('repositions an open popover when the viewport changes',()=>{
    let viewportWidth=500
    vi.spyOn(window,'innerWidth','get').mockImplementation(()=>viewportWidth)
    vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockReturnValue({left:450,right:482,bottom:40,top:8,width:32,height:32,x:450,y:8,toJSON:()=>({})})

    renderMenu()
    fireEvent.click(screen.getByRole('button',{name:'Actions'}))
    expect(screen.getByRole('menu')).toHaveStyle({left:'262px'})

    viewportWidth=300
    fireEvent(window,new Event('resize'))
    expect(screen.getByRole('menu')).toHaveStyle({left:'72px'})
  })
})
