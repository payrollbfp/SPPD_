const sb=supabase.createClient(APP_CONFIG.SUPABASE_URL,APP_CONFIG.SUPABASE_ANON_KEY);
const $=id=>document.getElementById(id);
let selectedEmployee=null,selectedSppd=null,tariffs=[],extraSeq=0;
const rp=n=>'Rp'+Math.round(Number(n||0)).toLocaleString('id-ID');
const val=id=>$(id)?.value||'';
const num=id=>Number(val(id)||0);
function loading(v){$('loading').classList.toggle('hidden',!v)}
function hideAll(){['home','sppd','pjpd','dashboardLogin','dashboard'].forEach(x=>$(x).classList.add('hidden'))}
function goHome(){hideAll();$('home').classList.remove('hidden')}

async function openDashboard(){
  const {data:{session}} = await sb.auth.getSession();
  if(session){
    hideAll();
    $('dashboard').classList.remove('hidden');
    await dashTab('dSppd');
    return;
  }
  hideAll();
  $('dashboardLogin').classList.remove('hidden');
}

async function loginDashboard(){
  const email=val('dashEmail').trim();
  const password=val('dashPassword');
  if(!email || !password){
    $('dashLoginMsg').innerHTML='<span class="err">Email dan password wajib diisi.</span>';
    return;
  }
  $('dashLoginMsg').textContent='Memeriksa...';
  const {data,error}=await sb.auth.signInWithPassword({email,password});
  if(error){
    $('dashLoginMsg').innerHTML='<span class="err">Login gagal: '+esc(error.message)+'</span>';
    return;
  }
  $('dashLoginMsg').innerHTML='<span class="ok">Login berhasil.</span>';
  hideAll();
  $('dashboard').classList.remove('hidden');
  await dashTab('dSppd');
}

async function logoutDashboard(){
  await sb.auth.signOut();
  $('dashPassword').value='';
  $('dashLoginMsg').textContent='';
  goHome();
}
async function openPage(p){
  hideAll();
  $(p).classList.remove('hidden');
  if(p==='pjpd'){await loadTariffs();await searchOpenSppd();}
}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

let empTimer;
function searchEmployees(){
  clearTimeout(empTimer);
  const q=val('sNamaQ').trim();
  if(q.length<2){$('sEmpResults').classList.add('hidden');return}
  empTimer=setTimeout(async()=>{
    const {data,error}=await sb.from('employees').select('id,nip,nama,jabatan,lokasi_kerja,project_mor,mor_code,kode_wbs').eq('aktif',true).ilike('nama','%'+q+'%').limit(15);
    if(error){alert(error.message);return}
    $('sEmpResults').innerHTML=(data||[]).map((e,i)=>`<div onclick='pickEmployee(${JSON.stringify(i)})'><b>${esc(e.nama)}</b><br><span class="muted">${esc(e.nip)} • ${esc(e.lokasi_kerja)} • ${esc(e.project_mor)}</span></div>`).join('');
    $('sEmpResults')._data=data||[];$('sEmpResults').classList.remove('hidden');
  },250);
}
function pickEmployee(i){
  const e=$('sEmpResults')._data[i];selectedEmployee=e;$('sNamaQ').value=e.nama;$('sNip').value=e.nip||'';$('sJabatan').value=e.jabatan||'';$('sLokasi').value=e.lokasi_kerja||'';$('sMor').value=e.project_mor||'';$('sWbs').value=e.kode_wbs||'';$('sEmpResults').classList.add('hidden');$('sDitNama').value='';$('sDitJab').value='';checkDuplicateNow()
}
async function checkDuplicateNow(){
  if(!selectedEmployee||!val('sMulai'))return;
  const {data,error}=await sb.rpc('check_sppd_duplicate',{p_employee_id:selectedEmployee.id,p_tanggal_mulai:val('sMulai')});
  if(error){$('dupMsg').textContent=error.message;return}
  $('dupMsg').innerHTML=data?'<span class="err">Karyawan ini sudah memiliki SPPD pada tanggal tersebut.</span>':'<span class="ok">Tanggal tersedia.</span>'
}
function toggleKnow(n){$(n===1?'sM1Manual':'sM2Manual').classList.toggle('hidden',val(n===1?'sM1Tipe':'sM2Tipe')!=='LAINNYA')}
async function submitSppd(){
  if(!selectedEmployee)return alert('Pilih karyawan.');
  if(!val('sLokasiSurat')||!val('sMulai')||!val('sSelesai')||!val('sTujuan')||!val('sAgenda'))return alert('Data perjalanan wajib dilengkapi.');
  if(!val('sDitNama').trim()||!val('sDitJab').trim())return alert('Ditugaskan Oleh wajib diisi Nama dan Jabatan.');
  if(val('sSelesai')<val('sMulai'))return alert('Tanggal selesai tidak boleh sebelum tanggal mulai.');
  loading(true);
  const payload={
    employee_id:selectedEmployee.id,lokasi_surat:val('sLokasiSurat'),kendaraan:val('sKendaraan'),
    tanggal_mulai:val('sMulai'),tanggal_selesai:val('sSelesai'),tujuan:val('sTujuan'),agenda:val('sAgenda'),
    ditugaskan_nama:val('sDitNama').trim(),ditugaskan_jabatan:val('sDitJab').trim(),
    mengetahui1_tipe:val('sM1Tipe'),mengetahui1_nama:val('sM1Nama'),mengetahui1_jabatan:val('sM1Jab'),
    mengetahui2_tipe:val('sM2Tipe'),mengetahui2_nama:val('sM2Nama'),mengetahui2_jabatan:val('sM2Jab')
  };
  const {data,error}=await sb.rpc('create_sppd',{p:payload});loading(false);
  if(error)return alert(error.message);
  $('sppdSaved').innerHTML=`<div class="box"><b>SPPD berhasil dibuat</b><br>${esc(data.no_sppd)}<p><button onclick='downloadSppdPdf(${JSON.stringify(JSON.stringify({...payload,no_sppd:data.no_sppd,employee:selectedEmployee}))})'>Download PDF SPPD</button></p></div>`;
}
function downloadSppdPdf(json){
  const x=JSON.parse(json),e=x.employee,{jsPDF}=window.jspdf,doc=new jsPDF();
  doc.setFontSize(14);doc.text('SURAT PERINTAH PERJALANAN DINAS',105,18,{align:'center'});doc.setFontSize(10);
  let y=30;[['Nomor',x.no_sppd],['Nama',e.nama],['NIP',e.nip||'-'],['Jabatan',e.jabatan||'-'],['Lokasi Kerja',e.lokasi_kerja],['Project / MOR',e.project_mor],['Kode WBS',e.kode_wbs||'-'],['Tujuan',x.tujuan],['Agenda',x.agenda],['Periode',x.tanggal_mulai+' s.d. '+x.tanggal_selesai],['Kendaraan',x.kendaraan||'-']].forEach(r=>{doc.text(r[0],18,y);doc.text(': '+String(r[1]),55,y);y+=7});
  y+=10;doc.text(`${x.lokasi_surat}, ${new Date().toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})}`,190,y,{align:'right'});y+=10;
  doc.text('Ditugaskan Oleh',25,y);doc.text('Mengetahui',105,y);y+=30;doc.text(x.ditugaskan_nama,25,y);doc.text(x.mengetahui1_nama||'',105,y);
  doc.save('SPPD_'+x.no_sppd.replaceAll('/','-')+'.pdf');
}

async function loadTariffs(){
  if(tariffs.length)return;
  const {data,error}=await sb.from('tariffs').select('komponen,label,nominal,tipe,urutan').eq('aktif',true).order('komponen').order('urutan');
  if(error)return alert(error.message);tariffs=data||[];
  fillTariff('pHotelTarif','HOTEL');fillTariff('pSakuTarif','UANG_SAKU');fillTariff('pMakanTarif','UANG_MAKAN');
}
function fillTariff(id,k){$(id).innerHTML='<option value="">Pilih tarif</option>'+tariffs.filter(t=>t.komponen===k).map(t=>`<option value="${t.nominal}" data-tipe="${t.tipe}">${esc(t.label)}</option>`).join('')}
let sppdTimer;
async function searchOpenSppd(){
  clearTimeout(sppdTimer);sppdTimer=setTimeout(async()=>{
    const {data,error}=await sb.rpc('search_open_sppd',{p_q:val('pSearch').trim()});if(error)return alert(error.message);
    $('pResults')._data=data||[];$('pResults').innerHTML=(data||[]).map((s,i)=>`<div onclick="pickSppd(${i})"><b>${esc(s.no_sppd)}</b> — ${esc(s.nama)}<br><span class="muted">${esc(s.project_mor)} • ${esc(s.kode_wbs||'')} • ${esc(s.tujuan)}</span></div>`).join('');
  },200);
}
function pickSppd(i){
  const s=$('pResults')._data[i];selectedSppd=s;$('pIdentity').classList.remove('hidden');
  $('pNoSppd').value=s.no_sppd;$('pNama').value=s.nama;$('pJabatan').value=s.jabatan||'';$('pMor').value=s.project_mor;$('pWbs').value=s.kode_wbs||'';$('pTujuan').value=s.tujuan||'';
  $('pBank').value=s.bank||'';$('pRek').value=s.no_rekening||'';$('pPengaju').value=s.nama;$('pPengajuJab').value=s.jabatan||'';$('pPicNama').value=s.project_officer_nama||'';$('pPicJab').value=s.project_officer_jabatan||'Area Project Officer';
  recalc();
}
function hotelTariffChanged(){const o=$('pHotelTarif').selectedOptions[0];$('pHotelManualWrap').classList.toggle('hidden',o?.dataset.tipe!=='SESUAI_TAGIHAN');recalc()}
function addExtra(){
  extraSeq++;const d=document.createElement('div');d.className='costrow';d.dataset.id=extraSeq;
  d.innerHTML=`<div><label>Komponen</label><input class="exName"></div><div><label>Qty</label><input class="exQty" type="number" value="1" min="0" oninput="recalc()"></div><div><label>Satuan</label><input class="exUnit" placeholder="kali/hari"></div><div><label>Tarif</label><input class="exRate" type="number" min="0" oninput="recalc()"></div><button class="red" onclick="this.parentElement.remove();recalc()">Hapus</button>`;
  $('extraRows').appendChild(d)
}
function kendaraanPribadiValue(){
  const km=Math.max(0,num('pKmPribadi'));
  return Math.min(km*3500,700000);
}
function togglePjpdKnow(n){
  const type=val(n===1?'pKnow1Type':'pKnow2Type');
  $(n===1?'pKnow1Manual':'pKnow2Manual').classList.toggle('hidden',type!=='LAINNYA');
}
function resolvePjpdKnow(type,nama,jabatan){
  if(type==='PROJECT_OFFICER') return {type,nama:val('pPicNama').trim(),jabatan:val('pPicJab').trim()};
  if(type==='LAINNYA') return {type,nama:nama.trim(),jabatan:jabatan.trim()};
  return {type:'',nama:'',jabatan:''};
}
function getDetails(){
  const det=[];const hQty=num('pHotelQty'),opt=$('pHotelTarif').selectedOptions[0],hRate=opt?.dataset.tipe==='SESUAI_TAGIHAN'?num('pHotelManual'):num('pHotelTarif');
  if(hQty>0||hRate>0)det.push({komponen:'Hotel',qty:hQty,satuan:'hari',tarif:hRate,jumlah:hQty*hRate,urutan:1});
  const sQty=num('pSakuQty'),sRate=num('pSakuTarif');if(sQty>0||sRate>0)det.push({komponen:'Uang Saku',qty:sQty,satuan:'hari',tarif:sRate,jumlah:sQty*sRate,urutan:2});
  const mQty=num('pMakanQty'),mRate=num('pMakanTarif');if(mQty>0||mRate>0)det.push({komponen:'Uang Makan',qty:mQty,satuan:'hari',tarif:mRate,jumlah:mQty*mRate,urutan:3});
  const km=num('pKmPribadi'),kmValue=kendaraanPribadiValue();if(km>0)det.push({komponen:'Kendaraan Pribadi',qty:km,satuan:'km',tarif:3500,jumlah:kmValue,urutan:4});
  [...document.querySelectorAll('#extraRows .costrow')].forEach((r,j)=>{const q=Number(r.querySelector('.exQty').value||0),rate=Number(r.querySelector('.exRate').value||0),name=r.querySelector('.exName').value.trim();if(name)det.push({komponen:name,qty:q,satuan:r.querySelector('.exUnit').value,tarif:rate,jumlah:q*rate,urutan:10+j})});
  return det;
}
function recalc(){if($('pKmNilai'))$('pKmNilai').value=rp(kendaraanPribadiValue());const total=getDetails().reduce((a,x)=>a+x.jumlah,0),panjar=num('pPanjar'),sel=total-panjar;$('sumTotal').textContent=rp(total);$('sumPanjar').textContent=rp(panjar);$('sumSelisih').textContent=rp(sel);$('sumTerbilang').textContent=terbilangKL(sel)}
function terbilang(n){n=Math.floor(Math.abs(Number(n)||0));const a=['','Satu','Dua','Tiga','Empat','Lima','Enam','Tujuh','Delapan','Sembilan','Sepuluh','Sebelas'];function b(x){if(x<12)return a[x];if(x<20)return b(x-10)+' Belas';if(x<100)return b(Math.floor(x/10))+' Puluh '+b(x%10);if(x<200)return 'Seratus '+b(x-100);if(x<1000)return b(Math.floor(x/100))+' Ratus '+b(x%100);if(x<2000)return 'Seribu '+b(x-1000);if(x<1e6)return b(Math.floor(x/1000))+' Ribu '+b(x%1000);if(x<1e9)return b(Math.floor(x/1e6))+' Juta '+b(x%1e6);if(x<1e12)return b(Math.floor(x/1e9))+' Miliar '+b(x%1e9);return String(x)}return b(n).replace(/\s+/g,' ').trim()}
function terbilangKL(n){if(Number(n)===0)return'Nihil';return(Number(n)>0?'Kurang Bayar — ':'Lebih Bayar — ')+terbilang(n)+' Rupiah'}
async function submitPjpd(){
  if(!selectedSppd)return alert('Pilih SPPD.');
  if(!val('pBank')||!val('pRek'))return alert('Bank/No Rekening belum ada di master karyawan.');
  if(!val('pSetNama').trim()||!val('pSetJab').trim())return alert('Menyetujui (User) wajib diisi.');

  const know1=resolvePjpdKnow(val('pKnow1Type'),val('pKnow1Nama'),val('pKnow1Jab'));
  const know2=resolvePjpdKnow(val('pKnow2Type'),val('pKnow2Nama'),val('pKnow2Jab'));
  if(!know1.type)return alert('Mengetahui 1 wajib dipilih.');
  if(know1.type==='LAINNYA'&&(!know1.nama||!know1.jabatan))return alert('Mengetahui 1 - Lainnya wajib diisi Nama dan Jabatan.');

  if(know1.type!=='PROJECT_OFFICER'){
    if(know2.type!=='PROJECT_OFFICER')return alert('Jika Mengetahui 1 memilih Lainnya, Mengetahui 2 wajib Project Officer.');
  }else if(know2.type==='LAINNYA'&&(!know2.nama||!know2.jabatan)){
    return alert('Jika Mengetahui 2 - Lainnya diisi, Nama dan Jabatan wajib lengkap.');
  }

  const details=getDetails();if(!details.length)return alert('Rincian biaya belum diisi.');
  const payload={
    sppd_id:selectedSppd.id,panjar:num('pPanjar'),details,
    menyetujui_nama:val('pSetNama').trim(),menyetujui_jabatan:val('pSetJab').trim(),
    mengetahui1_tipe:know1.type,mengetahui1_nama:know1.nama,mengetahui1_jabatan:know1.jabatan,
    mengetahui2_tipe:know2.type,mengetahui2_nama:know2.nama,mengetahui2_jabatan:know2.jabatan
  };
  loading(true);const {data,error}=await sb.rpc('create_pjpd',{p:payload});loading(false);if(error)return alert(error.message);
  $('pjpdSaved').innerHTML=`<div class="box"><b>PJPD berhasil dibuat</b><br>${esc(data.no_pjpd)}</div>`;
}
function downloadPjpdPdf(json){
  const x=JSON.parse(json),s=x.s,{jsPDF}=window.jspdf,doc=new jsPDF();doc.setFontSize(14);doc.text('PERTANGGUNGJAWABAN PERJALANAN DINAS',105,16,{align:'center'});doc.setFontSize(9);
  let y=27;[['No PJPD',x.no_pjpd],['No SPPD',s.no_sppd],['Nama',s.nama],['Jabatan',s.jabatan||'-'],['MOR',s.project_mor],['WBS',s.kode_wbs||'-'],['Bank',s.bank],['No. Rekening',s.no_rekening]].forEach(r=>{doc.text(r[0],15,y);doc.text(': '+String(r[1]),52,y);y+=6});
  y+=4;doc.text('Rincian Biaya',15,y);y+=6;x.details.forEach(d=>{doc.text(`${d.komponen} (${d.qty} ${d.satuan||''} x ${rp(d.tarif)})`,18,y);doc.text(rp(d.jumlah),190,y,{align:'right'});y+=6});
  y+=3;doc.text('Total PJPD',130,y);doc.text(rp(x.total),190,y,{align:'right'});y+=6;doc.text('Panjar',130,y);doc.text(rp(x.panjar),190,y,{align:'right'});y+=6;doc.text('Kurang / (Lebih) Bayar',130,y);doc.text(rp(x.selisih),190,y,{align:'right'});y+=6;doc.text('Terbilang: '+terbilangKL(x.selisih),15,y);
  y+=18;['Mengajukan','Menyetujui','Diketahui','Mengetahui'].forEach((t,i)=>doc.text(t,27+i*52,y,{align:'center'}));y+=28;doc.text(s.nama,27,y,{align:'center'});doc.text(x.menyetujui_nama,79,y,{align:'center'});doc.text(x.diketahui_nama||'-',131,y,{align:'center'});doc.text(s.project_officer_nama||'',183,y,{align:'center'});
  doc.save('PJPD_'+x.no_pjpd.replaceAll('/','-')+'.pdf');
}

async function dashTab(id){
  ['dSppd','dTicket','dBilling'].forEach(x=>$(x).classList.add('hidden'));$(id).classList.remove('hidden');loading(true);
  if(id==='dSppd'){
    const [{data:s},{data:p}]=await Promise.all([sb.from('sppd').select('id,no_sppd,nama,project_mor,kode_wbs,tujuan,tanggal_mulai,tanggal_selesai').order('created_at',{ascending:false}).limit(1000),sb.from('pjpd').select('sppd_id,no_pjpd,total_pjpd').limit(1000)]);
    const pm={};(p||[]).forEach(x=>pm[x.sppd_id]=x);$('dSppdBody').innerHTML=(s||[]).map(x=>`<tr><td>${esc(x.no_sppd)}</td><td>${esc(pm[x.id]?.no_pjpd||'')}</td><td>${esc(x.nama)}</td><td>${esc(x.project_mor)}</td><td>${esc(x.kode_wbs||'')}</td><td>${esc(x.tujuan)}</td><td>${esc(x.tanggal_mulai)}</td><td>${esc(x.tanggal_selesai)}</td><td class="num">${rp(pm[x.id]?.total_pjpd||0)}</td></tr>`).join('');
  }
  if(id==='dTicket'){
    const {data}=await sb.from('ticket_recap').select('*').order('created_at',{ascending:false}).limit(1000);$('dTicketBody').innerHTML=(data||[]).map(x=>`<tr><td>${esc(x.periode)}</td><td>${esc(x.no_surat)}</td><td>${esc(x.nama)}</td><td>${esc(x.tujuan)}</td><td>${esc(x.tanggal_berangkat||'')}</td><td>${esc(x.tanggal_pulang||'')}</td><td class="num">${rp(x.total)}</td><td>${esc(x.agen)}</td></tr>`).join('');
  }
  if(id==='dBilling'){
    const {data}=await sb.from('billing_recap').select('*').order('created_at',{ascending:false}).limit(1500);$('dBillingBody').innerHTML=(data||[]).map(x=>`<tr><td>${esc(x.bulan)}</td><td>${esc(x.keterangan)}</td><td>${esc(x.lokasi_mor)}</td><td>${esc(x.tanggal_pic_share_ke_hr||'')}</td><td>${esc(x.tanggal_hr_pengajuan||'')}</td><td class="num">${rp(x.realisasi_tiket)}</td><td class="num">${rp(x.realisasi_aji)}</td><td class="num">${rp(x.fee_vendor)}</td><td>${esc(x.tanggal_realisasi||'')}</td><td class="num">${rp(x.tagihan)}</td><td>${esc(x.tanggal_tagihan||'')}</td><td class="num">${rp(x.tagihan_terbayar)}</td><td>${esc(x.tagihan_periode)}</td></tr>`).join('');
  }
  loading(false);
}

window.searchEmployees=searchEmployees;
window.pickEmployee=pickEmployee;
window.checkDuplicateNow=checkDuplicateNow;
window.toggleKnow=toggleKnow;
window.submitSppd=submitSppd;
window.hotelTariffChanged=hotelTariffChanged;
window.searchOpenSppd=searchOpenSppd;
window.pickSppd=pickSppd;
window.addExtra=addExtra;
window.recalc=recalc;
window.togglePjpdKnow=togglePjpdKnow;
window.submitPjpd=submitPjpd;