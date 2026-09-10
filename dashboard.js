
// ============================================================
// DASHBOARD V8 — SPPD/PJPD + TIKET + TAGIHAN
// Requires app.js to be loaded first.
// ============================================================
let dashSppdRows=[];
let dashTicketRows=[];
let dashBillingItems=[];
let dashBillingBatches=[];

function closeModal(id){$(id).classList.add('hidden')}
function dateInRange(v,from,to){
  if(!v)return true;
  const d=String(v).slice(0,10);
  return (!from||d>=from)&&(!to||d<=to);
}
function xlsxDownload(rows, filename, sheetName='Data'){
  if(!rows.length){alert('Tidak ada data untuk didownload.');return}
  const ws=XLSX.utils.json_to_sheet(rows);
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,sheetName);
  XLSX.writeFile(wb,filename);
}
function checkedValues(selector){
  return [...document.querySelectorAll(selector+':checked')].map(x=>x.value);
}
function monthLabel(dateStr){
  if(!dateStr)return '';
  return new Date(dateStr+'T00:00:00').toLocaleDateString('id-ID',{month:'long',year:'numeric'});
}
function isoToday(){return new Date().toISOString().slice(0,10)}

async function dashTabV8(id){
  ['dSppd','dTicket','dBilling'].forEach(x=>$(x).classList.add('hidden'));
  $(id).classList.remove('hidden');
  if(id==='dSppd')await loadSppdDashboard();
  if(id==='dTicket')await loadTicketDashboard();
  if(id==='dBilling')await loadBillingDashboard();
}

// ---------- SPPD / PJPD ----------
async function loadSppdDashboard(){
  loading(true);
  const from=val('sppdFilterFrom'),to=val('sppdFilterTo');
  let q=sb.from('sppd')
    .select('id,no_sppd,nama,project_mor,kode_wbs,tujuan,tanggal_mulai,tanggal_selesai,created_at')
    .order('created_at',{ascending:false}).limit(3000);
  if(from)q=q.gte('tanggal_mulai',from);
  if(to)q=q.lte('tanggal_mulai',to);
  const [{data:s,error:se},{data:p,error:pe},{data:bi,error:be}]=await Promise.all([
    q,
    sb.from('pjpd').select('id,sppd_id,no_pjpd,total_pjpd,created_at').order('created_at',{ascending:false}).limit(3000),
    sb.from('billing_items').select('source_id,status,batch_id').eq('source_type','PJPD').limit(5000)
  ]);
  loading(false);
  if(se||pe||be){alert((se||pe||be).message);return}
  const pm={};(p||[]).forEach(x=>pm[x.sppd_id]=x);
  const bm={};(bi||[]).forEach(x=>bm[x.source_id]=x);
  dashSppdRows=(s||[]).map(x=>({...x,pjpd:pm[x.id]||null,billing:pm[x.id]?bm[pm[x.id].id]||null:null}));
  $('dSppdBody').innerHTML=dashSppdRows.map((x,i)=>{
    const p=x.pjpd,b=x.billing;
    const tagCell=!p
      ? '<span class="badge status-pending">Belum PJPD</span>'
      : b
        ? '<span class="badge status-final">✓</span>'
        : `<input type="checkbox" class="sppdTagCheck" value="${esc(p.id)}">`;
    const status=!p?'Belum PJPD':b?'<span class="badge status-final">Sudah Difinalisasi</span>':'<span class="badge status-ready">Belum Ditagihkan</span>';
    return `<tr>
      <td class="checkcell">${tagCell}</td>
      <td>${esc(x.no_sppd)}</td>
      <td>${esc(p?.no_pjpd||'')}</td>
      <td>${p?`<span class="link-detail" onclick="showPjpdDetail('${p.id}','${esc(p.no_pjpd)}')">Detail</span>`:'-'}</td>
      <td>${esc(x.nama)}</td><td>${esc(x.project_mor)}</td><td>${esc(x.kode_wbs||'')}</td><td>${esc(x.tujuan||'')}</td>
      <td>${esc(x.tanggal_mulai||'')}</td><td>${esc(x.tanggal_selesai||'')}</td>
      <td class="num">${rp(p?.total_pjpd||0)}</td><td>${status}</td>
    </tr>`;
  }).join('');
}
async function showPjpdDetail(pjpdId,noPjpd){
  loading(true);
  const {data,error}=await sb.from('pjpd_details')
    .select('komponen,qty,satuan,tarif,jumlah,urutan')
    .eq('pjpd_id',pjpdId).order('urutan');
  loading(false);
  if(error){alert(error.message);return}
  const total=(data||[]).reduce((a,x)=>a+Number(x.jumlah||0),0);
  $('pjpdDetailContent').innerHTML=`
    <div class="dashboard-note"><b>${esc(noPjpd)}</b></div>
    <div class="tablewrap"><table style="min-width:620px"><thead><tr><th>No</th><th>Komponen</th><th>Qty</th><th>Satuan</th><th>Tarif</th><th>Jumlah</th></tr></thead>
    <tbody>${(data||[]).map((x,i)=>`<tr><td>${i+1}</td><td>${esc(x.komponen)}</td><td>${esc(x.qty)}</td><td>${esc(x.satuan||'')}</td><td class="num">${rp(x.tarif)}</td><td class="num">${rp(x.jumlah)}</td></tr>`).join('')}
    <tr><td colspan="5"><b>TOTAL PJPD</b></td><td class="num"><b>${rp(total)}</b></td></tr></tbody></table></div>`;
  $('pjpdDetailModal').classList.remove('hidden');
}
async function finalizeSppdToBilling(){
  const ids=checkedValues('.sppdTagCheck');
  if(!ids.length){alert('Centang PJPD yang akan dimasukkan ke Rekap Tagihan.');return}
  const selected=dashSppdRows.filter(x=>x.pjpd&&ids.includes(x.pjpd.id));
  if(!confirm(`Finalisasi ${selected.length} PJPD ke antrian tagihan?`))return;
  const rows=selected.map(x=>({
    source_type:'PJPD',source_id:x.pjpd.id,source_no:x.pjpd.no_pjpd,no_sppd:x.no_sppd,
    keterangan:'SPPD/PJPD',project_mor:x.project_mor,nilai:Number(x.pjpd.total_pjpd||0),
    tanggal_sumber:String(x.pjpd.created_at||x.created_at||'').slice(0,10),status:'READY'
  }));
  loading(true);
  const {error}=await sb.from('billing_items').upsert(rows,{onConflict:'source_type,source_id',ignoreDuplicates:true});
  loading(false);
  if(error){alert(error.message);return}
  alert(`${rows.length} PJPD berhasil masuk Rekap Tagihan.`);
  await loadSppdDashboard();
}
function downloadSppdExcel(){
  const rows=dashSppdRows.map(x=>({
    'No SPPD':x.no_sppd,'No PJPD':x.pjpd?.no_pjpd||'','Nama':x.nama,'MOR':x.project_mor,
    'Kode WBS':x.kode_wbs||'','Tujuan':x.tujuan||'','Tanggal Mulai':x.tanggal_mulai||'',
    'Tanggal Selesai':x.tanggal_selesai||'','Total PJPD':Number(x.pjpd?.total_pjpd||0),
    'Status Tagih':x.pjpd?(x.billing?'SUDAH DIFINALISASI':'BELUM DITAGIHKAN'):'BELUM PJPD'
  }));
  xlsxDownload(rows,`Rekap_SPPD_PJPD_${val('sppdFilterFrom')||'awal'}_${val('sppdFilterTo')||'akhir'}.xlsx`,'SPPD-PJPD');
}

// ---------- TIKET ----------
async function loadTicketDashboard(){
  loading(true);
  const from=val('ticketFilterFrom'),to=val('ticketFilterTo');
  let q=sb.from('ticket_recap').select('*').order('created_at',{ascending:false}).limit(5000);
  if(from)q=q.gte('tanggal_berangkat',from);
  if(to)q=q.lte('tanggal_berangkat',to);
  const [{data:t,error:te},{data:bi,error:be}]=await Promise.all([
    q,
    sb.from('billing_items').select('source_id,status,batch_id').eq('source_type','TICKET').limit(7000)
  ]);
  loading(false);
  if(te||be){alert((te||be).message);return}
  const bm={};(bi||[]).forEach(x=>bm[x.source_id]=x);
  dashTicketRows=(t||[]).map(x=>({...x,billing:bm[x.id]||null}));
  $('dTicketBody').innerHTML=dashTicketRows.map(x=>{
    const b=x.billing;
    return `<tr>
      <td class="checkcell">${b?'<span class="badge status-final">✓</span>':`<input type="checkbox" class="ticketTagCheck" value="${x.id}">`}</td>
      <td>${esc(x.periode||'')}</td><td>${esc(x.no_surat||'')}</td><td>${esc(x.nama||'')}</td><td>${esc(x.project_mor||'')}</td>
      <td>${esc(x.tujuan||'')}</td><td>${esc(x.tanggal_berangkat||'')}</td><td>${esc(x.tanggal_pulang||'')}</td>
      <td class="num">${rp(x.total||0)}</td><td>${esc(x.agen||'')}</td>
      <td>${b?'<span class="badge status-final">Sudah Difinalisasi</span>':'<span class="badge status-ready">Belum Ditagihkan</span>'}</td>
    </tr>`;
  }).join('');
}
function openTicketModal(){
  ['tmPeriode','tmNoSurat','tmNip','tmNama','tmJabatan','tmMor','tmWbs','tmAgen','tmTujuan','tmKeperluan','tmBerangkat','tmPulang'].forEach(id=>$(id).value='');
  ['tmBerangkatAmt','tmPulangAmt','tmRefund','tmHotel'].forEach(id=>$(id).value='0');
  $('ticketModal').classList.remove('hidden');
}
async function saveTicketManual(){
  if(!val('tmNama').trim()||!val('tmMor').trim()||!val('tmBerangkat')){alert('Nama, MOR dan Tanggal Berangkat wajib diisi.');return}
  const ber=Number(val('tmBerangkatAmt')||0),pul=Number(val('tmPulangAmt')||0),ref=Number(val('tmRefund')||0),hotel=Number(val('tmHotel')||0);
  const row={
    periode:val('tmPeriode').trim(),no_surat:val('tmNoSurat').trim(),nip:val('tmNip').trim(),nama:val('tmNama').trim(),
    jabatan:val('tmJabatan').trim(),project_mor:val('tmMor').trim(),kode_wbs:val('tmWbs').trim(),tujuan:val('tmTujuan').trim(),
    keperluan:val('tmKeperluan').trim(),tanggal_berangkat:val('tmBerangkat'),tanggal_pulang:val('tmPulang')||null,
    harga_tiket_berangkat:ber,harga_tiket_pulang:pul,refund_tiket:ref,hotel,agen:val('tmAgen').trim(),
    total:Math.max(0,ber+pul+hotel-ref)
  };
  loading(true);const {error}=await sb.from('ticket_recap').insert(row);loading(false);
  if(error){alert(error.message);return}
  closeModal('ticketModal');await loadTicketDashboard();alert('Tiket berhasil disimpan.');
}
function downloadTicketTemplate(){
  const rows=[{
    'Periode':'September 2026','No Surat / SPPD':'','NIP':'','Nama':'','Jabatan':'','Project / MOR':'MOR IV','Kode WBS':'',
    'Tujuan':'','Keperluan':'','Tanggal Berangkat':'2026-09-01','Tanggal Pulang':'2026-09-02',
    'Harga Tiket Berangkat':0,'Harga Tiket Pulang':0,'Refund Tiket':0,'Hotel':0,'Agen':''
  }];
  xlsxDownload(rows,'Template_Upload_Tiket_BFP.xlsx','Tiket');
}
function pickCol(row,names){
  for(const n of names)if(row[n]!==undefined&&row[n]!==null)return row[n];
  return '';
}
function excelDate(v){
  if(!v)return null;
  if(typeof v==='number'){
    const d=XLSX.SSF.parse_date_code(v);if(d)return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
  }
  const s=String(v).trim();
  if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
  const m=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);if(m)return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  return null;
}
async function uploadTicketExcel(ev){
  const file=ev.target.files?.[0];ev.target.value='';if(!file)return;
  try{
    const buf=await file.arrayBuffer(),wb=XLSX.read(buf,{type:'array'}),ws=wb.Sheets[wb.SheetNames[0]];
    const raw=XLSX.utils.sheet_to_json(ws,{defval:''});
    const rows=raw.map(r=>{
      const ber=Number(pickCol(r,['Harga Tiket Berangkat','Tiket Berangkat'])||0);
      const pul=Number(pickCol(r,['Harga Tiket Pulang','Tiket Pulang'])||0);
      const ref=Number(pickCol(r,['Refund Tiket','Refund'])||0);
      const hotel=Number(pickCol(r,['Hotel'])||0);
      return {
        periode:String(pickCol(r,['Periode'])||'').trim(),
        no_surat:String(pickCol(r,['No Surat / SPPD','No Surat','No SPPD'])||'').trim(),
        nip:String(pickCol(r,['NIP','Nopeg'])||'').trim(),
        nama:String(pickCol(r,['Nama'])||'').trim(),
        jabatan:String(pickCol(r,['Jabatan'])||'').trim(),
        project_mor:String(pickCol(r,['Project / MOR','MOR','Lokasi MOR'])||'').trim(),
        kode_wbs:String(pickCol(r,['Kode WBS','WBS'])||'').trim(),
        tujuan:String(pickCol(r,['Tujuan'])||'').trim(),
        keperluan:String(pickCol(r,['Keperluan','Agenda'])||'').trim(),
        tanggal_berangkat:excelDate(pickCol(r,['Tanggal Berangkat','Berangkat'])),
        tanggal_pulang:excelDate(pickCol(r,['Tanggal Pulang','Pulang'])),
        harga_tiket_berangkat:ber,harga_tiket_pulang:pul,refund_tiket:ref,hotel,
        agen:String(pickCol(r,['Agen'])||'').trim(),
        total:Math.max(0,ber+pul+hotel-ref)
      };
    }).filter(r=>r.nama&&r.project_mor&&r.tanggal_berangkat);
    if(!rows.length){alert('Tidak ada baris valid. Pastikan Nama, Project/MOR dan Tanggal Berangkat terisi.');return}
    if(!confirm(`Upload ${rows.length} data tiket?`))return;
    loading(true);const {error}=await sb.from('ticket_recap').insert(rows);loading(false);
    if(error){alert(error.message);return}
    alert(`${rows.length} data tiket berhasil diupload.`);await loadTicketDashboard();
  }catch(e){loading(false);alert('Gagal membaca Excel: '+e.message)}
}
async function finalizeTicketToBilling(){
  const ids=checkedValues('.ticketTagCheck');
  if(!ids.length){alert('Centang tiket yang akan dimasukkan ke Rekap Tagihan.');return}
  const selected=dashTicketRows.filter(x=>ids.includes(x.id));
  if(!confirm(`Finalisasi ${selected.length} tiket ke antrian tagihan?`))return;
  const rows=selected.map(x=>({
    source_type:'TICKET',source_id:x.id,source_no:x.no_surat||('TICKET-'+x.id.slice(0,8)),no_sppd:x.no_surat||null,
    keterangan:'TIKET',project_mor:x.project_mor,nilai:Number(x.total||0),
    tanggal_sumber:x.tanggal_berangkat||String(x.created_at||'').slice(0,10),status:'READY'
  }));
  loading(true);const {error}=await sb.from('billing_items').upsert(rows,{onConflict:'source_type,source_id',ignoreDuplicates:true});loading(false);
  if(error){alert(error.message);return}
  alert(`${rows.length} tiket berhasil masuk Rekap Tagihan.`);await loadTicketDashboard();
}
function downloadTicketExcel(){
  const rows=dashTicketRows.map(x=>({
    'Periode':x.periode||'','No Surat':x.no_surat||'','NIP':x.nip||'','Nama':x.nama||'','Jabatan':x.jabatan||'',
    'MOR':x.project_mor||'','Kode WBS':x.kode_wbs||'','Tujuan':x.tujuan||'','Keperluan':x.keperluan||'',
    'Tanggal Berangkat':x.tanggal_berangkat||'','Tanggal Pulang':x.tanggal_pulang||'',
    'Harga Tiket Berangkat':Number(x.harga_tiket_berangkat||0),'Harga Tiket Pulang':Number(x.harga_tiket_pulang||0),
    'Refund':Number(x.refund_tiket||0),'Hotel':Number(x.hotel||0),'Total':Number(x.total||0),'Agen':x.agen||'',
    'Status Tagih':x.billing?'SUDAH DIFINALISASI':'BELUM DITAGIHKAN'
  }));
  xlsxDownload(rows,`Rekap_Tiket_${val('ticketFilterFrom')||'awal'}_${val('ticketFilterTo')||'akhir'}.xlsx`,'Tiket');
}

// ---------- TAGIHAN ----------
async function loadBillingDashboard(){
  loading(true);
  const from=val('billingFilterFrom'),to=val('billingFilterTo');
  let iq=sb.from('billing_items').select('*').order('created_at',{ascending:false}).limit(10000);
  if(from)iq=iq.gte('tanggal_sumber',from);
  if(to)iq=iq.lte('tanggal_sumber',to);
  let bq=sb.from('billing_batches').select('*').order('finalized_at',{ascending:false}).limit(5000);
  if(from)bq=bq.gte('tanggal_kelompok_tagih',from);
  if(to)bq=bq.lte('tanggal_kelompok_tagih',to);
  const [{data:items,error:ie},{data:batches,error:be}]=await Promise.all([iq,bq]);
  loading(false);
  if(ie||be){alert((ie||be).message);return}
  dashBillingItems=items||[];dashBillingBatches=batches||[];
  $('billingQueueBody').innerHTML=dashBillingItems.filter(x=>!x.batch_id).map(x=>`
    <tr>
      <td class="checkcell"><input type="checkbox" class="billingQueueCheck" value="${x.id}"></td>
      <td>${esc(x.keterangan)}</td><td>${esc(x.source_no||'')}</td><td>${esc(x.project_mor)}</td><td>${esc(x.tanggal_sumber||'')}</td>
      <td class="num">${rp(x.source_type==='TICKET'?x.nilai:0)}</td>
      <td class="num">${rp(x.source_type==='PJPD'?x.nilai:0)}</td>
      <td>${esc(x.tanggal_kelompok_tagih||'Belum dipilih')}</td>
      <td>${x.tanggal_kelompok_tagih?'<span class="badge status-ready">Siap Finalisasi</span>':'<span class="badge status-pending">Menunggu Tanggal</span>'}</td>
    </tr>`).join('');

  $('dBillingBody').innerHTML=dashBillingBatches.map(x=>`
    <tr>
      <td>${esc(monthLabel(x.tanggal_kelompok_tagih))}</td>
      <td>${esc(x.keterangan||'')}</td>
      <td>${esc(x.project_mor)}</td>
      <td><input class="inline-input" type="date" id="b_pic_${x.id}" value="${esc(x.tanggal_pic_share_ke_hr||'')}"></td>
      <td><input class="inline-input" type="date" id="b_hr_${x.id}" value="${esc(x.tanggal_hr_pengajuan||'')}"></td>
      <td class="num">${rp(x.realisasi_tiket)}</td>
      <td class="num">${rp(x.realisasi_aji)}</td>
      <td><input class="inline-input" type="number" min="0" id="b_fee_${x.id}" value="${Number(x.fee_vendor||0)}"></td>
      <td><input class="inline-input" type="date" id="b_real_${x.id}" value="${esc(x.tanggal_realisasi||'')}"></td>
      <td class="num"><b>${rp(x.tagihan)}</b><br><span class="badge status-final">TERKUNCI</span></td>
      <td><input class="inline-input" type="date" id="b_tgl_${x.id}" value="${esc(x.tanggal_tagihan||'')}"></td>
      <td><input class="inline-input" type="number" min="0" id="b_paid_${x.id}" value="${Number(x.tagihan_terbayar||0)}"></td>
      <td><input class="inline-input" id="b_per_${x.id}" value="${esc(x.tagihan_periode||'')}" placeholder="Contoh: Sep 2026"></td>
      <td><button class="btn-small" onclick="saveBillingBatch('${x.id}')">Simpan</button></td>
    </tr>`).join('');
}
function openAssignTagDate(){
  const ids=checkedValues('.billingQueueCheck');
  if(!ids.length){alert('Centang item tagihan terlebih dahulu.');return}
  $('assignTagDate').value=isoToday();$('assignTagModal').classList.remove('hidden');
}
async function assignTagDate(){
  const ids=checkedValues('.billingQueueCheck'),dt=val('assignTagDate');
  if(!ids.length||!dt){alert('Pilih item dan tanggal tagih.');return}
  loading(true);const {error}=await sb.from('billing_items').update({tanggal_kelompok_tagih:dt,status:'DATED'}).in('id',ids);loading(false);
  if(error){alert(error.message);return}
  closeModal('assignTagModal');await loadBillingDashboard();
}
async function finalizeBilling(){
  const ready=dashBillingItems.filter(x=>!x.batch_id&&x.tanggal_kelompok_tagih);
  if(!ready.length){alert('Belum ada item yang sudah diberi tanggal tagih.');return}
  const groups=new Set(ready.map(x=>x.project_mor+'||'+x.tanggal_kelompok_tagih));
  if(!confirm(`Finalisasi ${groups.size} kelompok / ${ready.length} item tagihan? Setelah finalisasi nominal Tagihan akan terkunci.`))return;
  loading(true);
  const {data,error}=await sb.rpc('finalize_billing_batches');
  loading(false);
  if(error){alert('Finalisasi gagal: '+error.message);return}
  alert(`Finalisasi berhasil: ${data?.groups||groups.size} kelompok, ${data?.items||ready.length} item. Nominal Tagihan sudah terkunci.`);
  await loadBillingDashboard();
}
async function saveBillingBatch(id){
  const payload={
    tanggal_pic_share_ke_hr:val('b_pic_'+id)||null,
    tanggal_hr_pengajuan:val('b_hr_'+id)||null,
    fee_vendor:Number(val('b_fee_'+id)||0),
    tanggal_realisasi:val('b_real_'+id)||null,
    tanggal_tagihan:val('b_tgl_'+id)||null,
    tagihan_terbayar:Number(val('b_paid_'+id)||0),
    tagihan_periode:val('b_per_'+id).trim()||null,
    updated_at:new Date().toISOString()
  };
  loading(true);const {error}=await sb.from('billing_batches').update(payload).eq('id',id);loading(false);
  if(error){alert(error.message);return}
  alert('Data tagihan tersimpan. Nominal Tagihan tetap terkunci.');
  await loadBillingDashboard();
}
function downloadBillingExcel(){
  const rows=dashBillingBatches.map(x=>({
    'Bulan':monthLabel(x.tanggal_kelompok_tagih),'Keterangan':x.keterangan||'','Lokasi MOR':x.project_mor,
    'Tanggal PIC Share ke HR':x.tanggal_pic_share_ke_hr||'','Tanggal HR Pengajuan':x.tanggal_hr_pengajuan||'',
    'Realisasi Tiket':Number(x.realisasi_tiket||0),'Realisasi Aji':Number(x.realisasi_aji||0),
    'Fee Vendor':Number(x.fee_vendor||0),'Tanggal Realisasi':x.tanggal_realisasi||'',
    'Tagihan':Number(x.tagihan||0),'Tanggal Tagihan':x.tanggal_tagihan||'',
    'Tagihan Terbayar':Number(x.tagihan_terbayar||0),'Tagihan Periode':x.tagihan_periode||'',
    'Outstanding':Math.max(0,Number(x.tagihan||0)-Number(x.tagihan_terbayar||0))
  }));
  xlsxDownload(rows,`Report_Tagihan_${val('billingFilterFrom')||'awal'}_${val('billingFilterTo')||'akhir'}.xlsx`,'Tagihan');
}

// override dashboard loader from app.js
dashTab=dashTabV8;
window.dashTab=dashTabV8;
window.loadSppdDashboard=loadSppdDashboard;
window.showPjpdDetail=showPjpdDetail;
window.finalizeSppdToBilling=finalizeSppdToBilling;
window.downloadSppdExcel=downloadSppdExcel;
window.loadTicketDashboard=loadTicketDashboard;
window.openTicketModal=openTicketModal;
window.saveTicketManual=saveTicketManual;
window.downloadTicketTemplate=downloadTicketTemplate;
window.uploadTicketExcel=uploadTicketExcel;
window.finalizeTicketToBilling=finalizeTicketToBilling;
window.downloadTicketExcel=downloadTicketExcel;
window.loadBillingDashboard=loadBillingDashboard;
window.openAssignTagDate=openAssignTagDate;
window.assignTagDate=assignTagDate;
window.finalizeBilling=finalizeBilling;
window.saveBillingBatch=saveBillingBatch;
window.downloadBillingExcel=downloadBillingExcel;
window.closeModal=closeModal;
