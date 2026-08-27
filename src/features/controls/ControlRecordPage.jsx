import { useState } from 'react'
import { ClipboardCheck, FileClock } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { getControl } from './controlsDemoData'

export function ControlRecordPage(){
  const {controlId}=useParams()
  const {t,language,locale}=useLanguage()
  const [tab,setTab]=useState('details')
  const record=getControl(controlId)
  if(!record)return <Page title={t('controls')}><div className="inline-empty">{t('noData')}</div></Page>
  const fmt=value=>new Intl.DateTimeFormat(locale).format(new Date(`${value}T12:00:00`))
  return <Page fill><EntityRecordShell className="control-record-shell workspace-fill" avatar={<ClipboardCheck size={19}/>} eyebrow={record.id} title={language==='el'?record.title:record.titleEn} subtitle={language==='el'?record.department:record.departmentEn} status={<span className="status-badge">{t(record.status)}</span>} tabs={[{id:'details',label:t('details'),icon:ClipboardCheck},{id:'history',label:t('history'),icon:FileClock}]} activeTab={tab} onTabChange={setTab}>
    {tab==='details'&&<div className="record-section"><div className="detail-grid quality-detail-grid"><div className="detail-item"><span>{t('code')}</span><strong>{record.id}</strong></div><div className="detail-item"><span>{t('department')}</span><strong>{language==='el'?record.department:record.departmentEn}</strong></div><div className="detail-item"><span>{t('deadline')}</span><strong>{fmt(record.due)}</strong></div><div className="detail-item"><span>{t('owner')}</span><strong>{record.owner}</strong></div></div><div className="quality-description"><span>{t('description')}</span><p>{language==='el'?record.description:record.descriptionEn}</p></div></div>}
    {tab==='history'&&<div className="record-section"><div className="inline-empty">{t('noData')}</div></div>}
  </EntityRecordShell></Page>
}
