import { Link } from 'react-router-dom'
import { ArrowLeft, Languages } from 'lucide-react'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { BrandMark } from '../../design-system/BrandMark'
import { LEGAL_UPDATED, legalContent } from './legalContent'
import './legal.css'

export function LegalPage({kind}){
  const {language,setLanguage}=useLanguage()
  const en=language==='en'
  const doc=legalContent[kind][en?'en':'el']
  const updated=new Intl.DateTimeFormat(en?'en-GB':'el-GR',{dateStyle:'long'}).format(new Date(`${LEGAL_UPDATED}T12:00:00`))
  return <div className="legal-page">
    <header className="legal-header">
      <Link to="/login" className="legal-brand"><BrandMark size={34}/><strong>Limoxis Observer</strong></Link>
      <button type="button" className="auth-language legal-language" onClick={()=>setLanguage(en?'el':'en')}><Languages size={16}/>{en?'EL':'EN'}</button>
    </header>
    <main className="legal-card">
      <Link to="/login" className="legal-back"><ArrowLeft size={15}/>{en?'Back to sign in':'Επιστροφή στη σύνδεση'}</Link>
      <h1>{doc.title}</h1>
      <small>{en?'Last updated':'Τελευταία ενημέρωση'}: {updated}</small>
      <p className="legal-intro">{doc.intro}</p>
      {doc.sections.map(([title,text])=><section key={title}><h2>{title}</h2><p>{text}</p></section>)}
      <nav className="legal-links"><Link to="/privacy">{legalContent.privacy[en?'en':'el'].title}</Link><Link to="/terms">{legalContent.terms[en?'en':'el'].title}</Link></nav>
    </main>
  </div>
}
