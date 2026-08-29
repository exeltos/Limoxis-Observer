import fs from 'node:fs'
import path from 'node:path'

const repo=fs.readFileSync('src/core/data/repository.js','utf8')
const status=fs.readFileSync('src/core/data/DataAccessStatus.jsx','utf8')
const hook=fs.readFileSync('src/core/data/useRepositoryData.js','utf8')
const migration=fs.readFileSync('supabase/migrations/202608290014_v0271_data_access_foundation.sql','utf8')
const checks=[
 [repo,'export async function load(table'],
 [repo,'export async function save(table'],
 [repo,'export function loadSnapshot'],
 [repo,'export function saveSnapshot'],
 [hook,'export function useRepositoryData'],
 [status,"status==='loading'"],
 [status,"status==='saving'"],
 [status,"status==='error'"],
 [migration,'create table if not exists public.training_records'],
 [migration,'create table if not exists public.environmental_standards'],
 [migration,'create table if not exists public.control_drafts'],
 [migration,'alter table public.training_records enable row level security'],
 [migration,'create or replace function public.current_user_has_capability'],
 [migration,'create policy training_records_read'],
 [migration,'create policy environmental_standards_read'],
 [migration,'create policy control_drafts_read'],
]
let failed=0
for(const [text,needle] of checks){
 if(!text.includes(needle)){console.error(`Missing ${needle}`);failed++}
}
function walk(dir){
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const full=path.join(dir,entry.name)
  if(entry.isDirectory())walk(full)
  else if(/\.(js|jsx)$/.test(entry.name)&&full!=='src/core/data/repository.js'){
   const text=fs.readFileSync(full,'utf8')
   if(text.includes('localStorage.')){console.error(`Direct localStorage outside repository: ${full}`);failed++}
   if(/catch\s*\{\s*\}/.test(text)){console.error(`Silent empty catch: ${full}`);failed++}
  }
 }
}
walk('src')
if(failed)process.exit(1)
console.log(`Data access foundation passed: ${checks.length}/${checks.length} + global storage/error scan`)
