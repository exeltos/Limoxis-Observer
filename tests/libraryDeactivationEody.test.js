import { describe,it,expect,vi,beforeEach } from 'vitest'
import fs from 'node:fs'

const calls=[]
vi.mock('../src/core/supabase/client',()=>{
  const chain=(table,op,payload)=>{const c={is:()=>c,eq:()=>c,order:()=>c,select:()=>c,single:async()=>({data:{id:'g1',library_key:'notifiableDiseases',code:'ND-HEPA',name_el:payload?.name_el,name_en:payload?.name_en,metadata:{system:true},source_authority:'X',source_version:'current',is_active:payload?.is_active??true},error:null}),then:(res)=>res({data:[],error:null})};calls.push({table,op,payload});return c}
  return {supabase:{from:table=>({update:payload=>chain(table,'update',payload),select:()=>chain(table,'select')})}}
})
vi.mock('../src/core/data/dataEnvironment',()=>({isDemoDataEnvironment:()=>true}))
vi.mock('../src/core/data/repository',()=>({loadSnapshot:()=>({vaccines:[['Εμβόλιο Α','Vaccine A',{active:true}],['Εμβόλιο Β','Vaccine B',{active:false}]]})}))

const { updateGlobalLibraryItem }=await import('../src/features/management/managementCloudService')
const { loadLibraries }=await import('../src/features/management/useLibraries')
const { splitNotifiableRows }=await import('../src/features/management/NotifiableDiseasesTable')
const { EODY_CATALOGUE }=await import('../src/features/reporting/eodyCatalogue')
const { demoLibrarySeed }=await import('../src/features/management/managementData')

beforeEach(()=>{calls.length=0})

describe('library rows can be deactivated by the platform owner',()=>{
  it('updateGlobalLibraryItem writes is_active through the audited update path',async()=>{
    const row=['Ιογενής ηπατίτιδα Α','Viral hepatitis A',{id:'g1',system:true}]
    const saved=await updateGlobalLibraryItem(row,{nameEl:row[0],nameEn:row[1],isActive:false})
    expect(calls[0]).toMatchObject({table:'master_library_items',op:'update',payload:{is_active:false,name_el:row[0]}})
    expect(saved[2].active).toBe(false)
    await updateGlobalLibraryItem(row,{nameEl:row[0],nameEn:row[1]})
    expect(calls[1].payload).not.toHaveProperty('is_active')
  })

  it('forms do not get inactive rows (useLibraries)',async()=>{
    const {libraries}=await loadLibraries('org')
    expect(libraries.vaccines.map(item=>item.value)).toEqual(['Εμβόλιο Α'])
  })

  it('the global loader reads inactive rows too, and the panel offers one toggle in the row menu',()=>{
    const service=fs.readFileSync('src/features/management/managementCloudService.js','utf8')
    const global=service.slice(service.indexOf('export async function loadGlobalLibraryItems'),service.indexOf('export async function createGlobalLibraryItem'))
    expect(global).not.toContain(".eq('is_active',true)")
    const panel=fs.readFileSync('src/features/management/LibrariesPanel.jsx','utf8')
    expect(panel).toContain("id:'toggle'")
    expect(panel).toContain('hidden:!isPlatformOwner')
    expect(panel.match(/librariesPanel\.deactivateItem/g)).toHaveLength(1)
  })
})

describe('ΕΟΔΥ library layout',()=>{
  const rows=[...demoLibrarySeed.notifiableDiseases].reverse().concat([['Ιογενής ηπατίτιδα Α','Viral hepatitis A',{id:'l1',active:true,code:'ND-HEPA'}],['Λεγιονέλλωση','Legionellosis',{id:'l2',active:false,code:'ND-LEGIONELLA'}]])
  it('numbers the 57 entries 1-57 in ΕΟΔΥ order whatever the row order',()=>{
    const {catalogue}=splitNotifiableRows(rows)
    expect(catalogue.map(({entry})=>entry.n)).toEqual(Array.from({length:57},(_,i)=>i+1))
  })
  it('filters by deadline and by search',()=>{
    expect(splitNotifiableRows(rows,{deadline:'immediate'}).catalogue).toHaveLength(19)
    expect(splitNotifiableRows(rows,{deadline:'24h'}).catalogue.every(({entry})=>entry.deadline==='24h')).toBe(true)
    expect(splitNotifiableRows(rows,{query:'ιλαρ'}).catalogue.map(({entry})=>entry.id)).toEqual(['measles'])
  })
  it('lists legacy rows only while active and only under «Όλα»',()=>{
    expect(splitNotifiableRows(rows).legacy.map(row=>row[2].code)).toEqual(['ND-HEPA'])
    expect(splitNotifiableRows(rows,{deadline:'weekly'}).legacy).toHaveLength(0)
    expect(EODY_CATALOGUE).toHaveLength(57)
  })
})
