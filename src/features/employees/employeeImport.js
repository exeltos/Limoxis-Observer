// Staff import from a spreadsheet: one row per employee, matched to the
// hospital's departments, professional categories and job positions. Rows
// whose code already exists update that employee (when asked); everything is
// checked before anything is saved.

// [key, Greek header, English header, other accepted headers]
export const IMPORT_COLUMNS=[
 ['code','Κωδικός','Code',['κωδικός εργαζομένου','κωδικός φακέλου','employee code','id']],
 ['lastName','Επώνυμο','Last name',['surname']],
 ['firstName','Όνομα','First name',['name']],
 ['fatherName','Πατρώνυμο','Father name',['όνομα πατρός']],
 ['department','Τμήμα','Department',['κλινική','τμήμα / κλινική']],
 ['profession','Επαγγελματική κατηγορία','Professional category',['κατηγορία','ειδικότητα','profession','category']],
 ['position','Θέση εργασίας','Job position',['θέση','position']],
 ['status','Κατάσταση','Status',[]],
 ['email','Email','Email',['e-mail','ηλεκτρονικό ταχυδρομείο']],
 ['phone','Τηλέφωνο','Phone',['κινητό','mobile']],
 ['hireDate','Ημερομηνία πρόσληψης','Hire date',['πρόσληψη']],
 ['birthDate','Ημερομηνία γέννησης','Birth date',['γέννηση','date of birth']],
]
const REQUIRED=['code','lastName','firstName','department','profession']

const norm=value=>String(value??'').trim().toLocaleLowerCase('el').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\s+/g,' ')

export function templateRows(en=false){
 return {
  headers:IMPORT_COLUMNS.map(column=>en?column[2]:column[1]),
  example:en?['1001','Papadopoulou','Maria','Georgios','ICU','Nurse','ICU Nurse','Active','m.papadopoulou@example.org','6900000000','2020-03-01','1985-06-15']:['1001','Παπαδοπούλου','Μαρία','Γεώργιος','ΜΕΘ','Νοσηλευτής/τρια','Νοσηλευτής/τρια ΜΕΘ','Ενεργός','m.papadopoulou@example.org','6900000000','01/03/2020','15/06/1985'],
 }
}

// Column index per key, from the header row (Greek or English, any case or accents).
export function mapHeaders(header=[]){
 const map={}
 header.forEach((cell,index)=>{
  const value=norm(cell)
  if(!value)return
  const column=IMPORT_COLUMNS.find(([key,el,en,aliases])=>map[key]==null&&[el,en,...aliases].some(name=>norm(name)===value))
  if(column)map[column[0]]=index
 })
 return map
}

// YYYY-MM-DD from ISO, DD/MM/YYYY (or - .), or an Excel day number.
export function normalizeDate(value){
 const text=String(value??'').trim()
 if(!text)return ''
 if(/^\d{4}-\d{2}-\d{2}/.test(text))return text.slice(0,10)
 const dmy=/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(text)
 if(dmy){const [,d,m,y]=dmy;if(Number(m)<=12&&Number(d)<=31)return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;return null}
 if(/^\d{4,5}(\.\d+)?$/.test(text)){const date=new Date(Date.UTC(1899,11,30)+Math.floor(Number(text))*86400000);return date.toISOString().slice(0,10)}
 return null
}

function normalizeStatus(value){
 const text=norm(value)
 if(!text||['ενεργος','ενεργη','active','ναι','yes'].includes(text))return 'active'
 if(['ανενεργος','ανενεργη','inactive','οχι','no'].includes(text))return 'inactive'
 return null
}

// departments: [{id,name,nameEn}]; professions/positions: library rows [el,en,...].
export function planEmployeeImport(rows,{existing=[],departments=[],professions=[],positions=[],updateExisting=false,en=false}={}){
 const [header=[],...body]=rows
 const columns=mapHeaders(header)
 const missingColumns=REQUIRED.filter(key=>columns[key]==null).map(key=>IMPORT_COLUMNS.find(c=>c[0]===key)[en?2:1])
 if(missingColumns.length)return {missingColumns,items:[],counts:{create:0,update:0,skip:0,error:0}}
 const byCode=new Map(existing.map(employee=>[norm(employee.id||employee.employeeCode),employee]))
 const departmentBy=new Map();for(const d of departments){departmentBy.set(norm(d.name),d);if(d.nameEn)departmentBy.set(norm(d.nameEn),d)}
 const libraryBy=list=>{const map=new Map();for(const row of list){if(row?.[0])map.set(norm(row[0]),row);if(row?.[1])map.set(norm(row[1]),row)}return map}
 const professionBy=libraryBy(professions),positionBy=libraryBy(positions)
 const seen=new Set()
 const cell=(row,key)=>columns[key]==null?'':String(row[columns[key]]??'').trim()
 const items=body.map((row,index)=>{
  const line=index+2,errors=[],warnings=[]
  const code=cell(row,'code')
  const value={id:code,employeeCode:code,firstName:cell(row,'firstName'),lastName:cell(row,'lastName'),fatherName:cell(row,'fatherName'),email:cell(row,'email'),phone:cell(row,'phone')}
  for(const key of REQUIRED)if(!cell(row,key))errors.push(en?`${IMPORT_COLUMNS.find(c=>c[0]===key)[2]} is empty`:`Κενό: ${IMPORT_COLUMNS.find(c=>c[0]===key)[1]}`)
  if(code&&seen.has(norm(code)))errors.push(en?'Code repeated in the file':'Ο κωδικός επαναλαμβάνεται στο αρχείο')
  if(code)seen.add(norm(code))
  const departmentText=cell(row,'department'),department=departmentBy.get(norm(departmentText))
  if(departmentText&&!department)errors.push(en?`Unknown department “${departmentText}”`:`Άγνωστο τμήμα «${departmentText}»`)
  if(department)Object.assign(value,{department:department.name,departmentEn:department.nameEn||department.name,departmentId:department.id&&department.id!==department.name?department.id:null})
  const professionText=cell(row,'profession'),profession=professionBy.get(norm(professionText))
  if(professionText&&!profession)errors.push(en?`Unknown professional category “${professionText}”`:`Άγνωστη επαγγελματική κατηγορία «${professionText}»`)
  if(profession)Object.assign(value,{profession:profession[0],professionEn:profession[1]||profession[0]})
  const positionText=cell(row,'position'),position=positionBy.get(norm(positionText))
  if(positionText&&!position)errors.push(en?`Unknown job position “${positionText}”`:`Άγνωστη θέση εργασίας «${positionText}»`)
  Object.assign(value,{position:position?.[0]||'',positionEn:position?.[1]||position?.[0]||''})
  const status=normalizeStatus(cell(row,'status'))
  if(status==null)errors.push(en?`Unknown status “${cell(row,'status')}”`:`Άγνωστη κατάσταση «${cell(row,'status')}»`)
  value.employmentStatus=status||'active'
  for(const key of ['hireDate','birthDate']){
   const date=normalizeDate(cell(row,key))
   if(date==null)errors.push(en?`Unreadable date “${cell(row,key)}”`:`Μη αναγνωρίσιμη ημερομηνία «${cell(row,key)}»`)
   value[key]=date||''
  }
  if(value.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email))warnings.push(en?'Email looks wrong':'Το email δεν φαίνεται σωστό')
  Object.assign(value,{firstNameEn:value.firstName,lastNameEn:value.lastName,fatherNameEn:value.fatherName})
  const current=byCode.get(norm(code))
  let action=current?(updateExisting?'update':'skip'):'create'
  if(errors.length)action='error'
  return {line,code,name:[value.lastName,value.firstName].filter(Boolean).join(' '),value,current:current||null,action,errors,warnings}
 })
 const counts={create:0,update:0,skip:0,error:0}
 for(const item of items)counts[item.action]+=1
 return {missingColumns:[],items,counts}
}
