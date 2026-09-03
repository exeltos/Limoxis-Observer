import fs from 'node:fs'
const path='src/features/workspaces/PlatformCenterPage.jsx'
let s=fs.readFileSync(path,'utf8')
s=s.replace('  Send,\n','')
s=s.replace('  const { notify, notifyError, confirm } = useFeedback()','  const { notify, notifyError } = useFeedback()')
s=s.replace('  function returnFromRecord() {\n    setSelectedUser(null)\n','  function returnFromRecord() {\n')
fs.writeFileSync(path,s)
