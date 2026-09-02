import { describe,expect,it } from 'vitest'
import fs from 'node:fs'
import { calculateCloudDefinition } from '../src/features/indicators/indicatorCloudService'

const cloud=fs.readFileSync(new URL('../src/features/indicators/IndicatorsCloudPage.jsx',import.meta.url),'utf8')
const service=fs.readFileSync(new URL('../src/features/indicators/indicatorCloudService.js',import.meta.url),'utf8')
const panel=fs.readFileSync(new URL('../src/features/management/IndicatorsPanel.jsx',import.meta.url),'utf8')

describe('indicator governance production wiring',()=>{
 it('uses active database definitions instead of a local core definition list',()=>{expect(service).toContain(".eq('status','active')");expect(cloud).toContain('loadOperationalIndicatorDefinitions');expect(cloud).not.toContain('const coreDefinitions=')})
 it('supports manual governed indicators without inventing values',()=>{const row=calculateCloudDefinition({id:'manual',calculation:'manual',manualValue:'87',target:90,direction:'higher',multiplier:1},{});expect(row.value).toBe(87);expect(row.status).toBe('attention')})
 it('supports snapshot approval with reviewer attribution',()=>{expect(service).toContain("status:'approved'");expect(service).toContain('reviewed_by');expect(cloud).toContain('approveIndicatorSnapshot')})
 it('uses the database lifecycle names in management center',()=>{expect(panel).toContain('draft → review → active → retired');expect(panel).toContain('<option value="active">active</option>');expect(panel).not.toContain('<option value="approved">approved</option>')})
 it('gates management operations by manage_indicators capability',()=>{expect(panel).toContain('CAPABILITIES.MANAGE_INDICATORS');expect(cloud).toContain('CAPABILITIES.MANAGE_INDICATORS')})
})
