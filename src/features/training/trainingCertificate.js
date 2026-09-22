import { exportElementAsPdf } from '../../core/export/pdfReportExport'

const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c])
const fmt=(v,en)=>{if(!v)return '—';const d=new Date(`${String(v).slice(0,10)}T12:00:00`);return Number.isNaN(d.getTime())?'—':d.toLocaleDateString(en?'en-GB':'el-GR',{day:'2-digit',month:'2-digit',year:'numeric'})}

function buildCertificateElement({certificate,program,participantName,en}){
  const el=document.createElement('div')
  el.style.cssText='position:fixed;left:-10000px;top:0;width:1000px;padding:70px 60px;background:#fff;font-family:Georgia,"Times New Roman",serif;color:#1c2b3a;border:14px solid #174b7a;box-sizing:border-box;text-align:center'
  el.innerHTML=`
    <div style="font-size:13px;letter-spacing:3px;text-transform:uppercase;color:#5d7891;margin-bottom:22px">Limoxis Observer</div>
    <div style="font-size:30px;font-weight:700;margin-bottom:12px">${en?'Certificate of Completion':'Πιστοποιητικό Ολοκλήρωσης'}</div>
    <div style="font-size:14px;color:#5d7891;margin-bottom:36px">${en?'This certifies that':'Πιστοποιείται ότι'}</div>
    <div style="font-size:26px;font-weight:700;margin-bottom:36px">${escapeHtml(participantName||'—')}</div>
    <div style="font-size:14px;color:#5d7891;margin-bottom:10px">${en?'has successfully completed the training program':'ολοκλήρωσε επιτυχώς το πρόγραμμα εκπαίδευσης'}</div>
    <div style="font-size:20px;font-weight:700;margin-bottom:40px">${escapeHtml(program?.title||'—')}</div>
    <div style="display:flex;justify-content:center;gap:60px;font-size:12.5px;color:#33495f">
      <div><div style="color:#8794a3;margin-bottom:4px">${en?'Issued':'Ημερομηνία έκδοσης'}</div><strong>${fmt(certificate?.issuedDate,en)}</strong></div>
      <div><div style="color:#8794a3;margin-bottom:4px">${en?'Valid until':'Ισχύς έως'}</div><strong>${certificate?.validUntil?fmt(certificate.validUntil,en):(en?'No expiry':'Χωρίς λήξη')}</strong></div>
      <div><div style="color:#8794a3;margin-bottom:4px">${en?'Issuer':'Εκδότης'}</div><strong>${escapeHtml(certificate?.issuer||'Limoxis Observer')}</strong></div>
    </div>
  `
  document.body.appendChild(el)
  return el
}

export async function downloadCertificatePdf({certificate,program,participantName,en=false}){
  const el=buildCertificateElement({certificate,program,participantName,en})
  try{
    await exportElementAsPdf({element:el,filename:`${certificate?.id||'certificate'}_${participantName||''}`,orientation:'landscape'})
  }finally{
    el.remove()
  }
}
