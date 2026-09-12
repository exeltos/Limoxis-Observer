// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LanguageProvider } from '../src/core/i18n/LanguageContext'
import { LaboratoryWorkflowNavigator } from '../src/features/laboratory/components/LaboratoryWorkflowNavigator'

const order=['summary','result','documents']
const labels={summary:'Σύνοψη',result:'Αποτέλεσμα',documents:'Έγγραφα'}

afterEach(cleanup)

function renderNavigator(props={}){
  const onMove=props.onMove||vi.fn()
  render(<LanguageProvider><LaboratoryWorkflowNavigator active="summary" order={order} labels={labels} canOpen={()=>true} onMove={onMove} {...props}/></LanguageProvider>)
  return onMove
}

describe('LaboratoryWorkflowNavigator',()=>{
  it('keeps the next step visible when it is still locked',()=>{
    renderNavigator({canOpen:id=>id==='summary'})

    expect(screen.getByRole('navigation',{name:'Πλοήγηση βημάτων εργαστηρίου'})).toBeInTheDocument()
    expect(screen.getByRole('button',{name:/Επόμενο βήμα\s*Αποτέλεσμα/})).toBeDisabled()
    expect(screen.getByText('Βήμα 1 από 3')).toBeInTheDocument()
  })

  it('moves to the next step after it becomes available',()=>{
    const onMove=renderNavigator()

    fireEvent.click(screen.getByRole('button',{name:/Επόμενο βήμα\s*Αποτέλεσμα/}))
    expect(onMove).toHaveBeenCalledWith('result')
  })
})
