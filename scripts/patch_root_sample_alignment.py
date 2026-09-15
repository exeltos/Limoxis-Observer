from pathlib import Path
p=Path('src/features/surveillance/PatientClinicalCanonicalPage.jsx')
s=p.read_text()
old="style={{paddingLeft:`${32+depth*28}px`}}"
new="style={{paddingLeft:`${linked?32:depth*28}px`}}"
assert old in s
s=s.replace(old,new,1)
p.write_text(s)

css=Path('src/styles/canonical-registry-visual.css')
c=css.read_text()
c=c.replace('.surveillance-tree-sample:not(.is-followup)>span:first-child{padding-left:18px}\n','')
c=c.replace('.surveillance-sample-actions{display:flex;gap:8px;align-items:center;justify-content:flex-start;overflow:visible;min-width:286px}', '.surveillance-sample-actions{display:flex;gap:8px;align-items:center;justify-content:flex-end;overflow:visible;min-width:286px;margin-left:auto}')
c += '\n/* Independent root samples align with surveillance episode rows; only follow-ups indent. */\n.surveillance-independent-samples .surveillance-tree-sample.is-unlinked:not(.is-followup)>span:first-child{padding-left:14px}\n.surveillance-tree-sample>span:last-child{justify-self:stretch}\n.surveillance-sample-actions .sample-followup-action{margin-left:auto}\n'
css.write_text(c)
