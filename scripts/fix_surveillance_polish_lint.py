from pathlib import Path
p=Path('src/features/surveillance/PatientClinicalCanonicalPage.jsx')
s=p.read_text()
s=s.replace("const esc=value=>String(value??'—').replace(/[&<>\\\"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','\\\"':'&quot;'}[ch]))","const esc=escapeReport")
s=s.replace("<\\/script>","</script>")
p.write_text(s)
