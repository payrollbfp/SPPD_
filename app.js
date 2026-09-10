const sb=supabase.createClient(window.APP_CONFIG.SUPABASE_URL,window.APP_CONFIG.SUPABASE_ANON_KEY);
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
  let picData={};
  if(payload.mengetahui1_tipe==='AREA_PROJECT_OFFICER'||payload.mengetahui2_tipe==='AREA_PROJECT_OFFICER'){
    const {data:pd}=await sb.from('project_officers').select('nama,jabatan').eq('project_mor',selectedEmployee.project_mor).eq('aktif',true).limit(1).maybeSingle();
    picData=pd||{};
  }
  const pdfData={...payload,no_sppd:data.no_sppd,employee:selectedEmployee,pic_nama:picData.nama||'',pic_jabatan:picData.jabatan||'Area Project Officer'};
  $('sppdSaved').innerHTML=`<div class="box"><b>SPPD berhasil dibuat</b><br>${esc(data.no_sppd)}<p><button onclick='downloadSppdPdf(${JSON.stringify(JSON.stringify(pdfData))})'>Download PDF SPPD</button></p></div>`;
}

function fmtDateId(v){
  if(!v)return '-';
  const d=new Date(v+'T00:00:00');
  return d.toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'});
}
function pdfSafe(v){return String(v??'');}
async function addBfpLogo(doc,x,y,w,h){
  try{
    const r=await fetch('logo.png?v=5');
    const b=await r.blob();
    const data=await new Promise((resolve,reject)=>{
      const fr=new FileReader(); fr.onload=()=>resolve(fr.result); fr.onerror=reject; fr.readAsDataURL(b);
    });
    doc.addImage(data,'PNG',x,y,w,h);
  }catch(e){console.warn('Logo gagal dimuat',e);}
}
function textPair(doc,label,value,xLabel,xValue,y,boldValue=false){
  doc.setFont('helvetica','bold');doc.text(label,xLabel,y);
  doc.setFont('helvetica','normal');doc.text(':',xValue-4,y);
  doc.setFont('helvetica',boldValue?'bold':'normal');doc.text(pdfSafe(value),xValue,y);
}

async function downloadSppdPdf(json){
  const x=JSON.parse(json),e=x.employee,{jsPDF}=window.jspdf;
  const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
  const W=210,H=297;

  doc.setDrawColor(30);doc.setLineWidth(.25);
  doc.rect(12,15,186,268);
  await addBfpLogo(doc,171,21,19,12);

  doc.setFontSize(7.5);doc.setFont('helvetica','normal');
  doc.text('No. SPPD: '+x.no_sppd,198,12,{align:'right'});

  doc.setFont('times','bold');doc.setFontSize(16);
  doc.text('SURAT PERINTAH PERJALANAN DINAS',105,43,{align:'center'});
  doc.setLineWidth(.3);doc.line(61,45,149,45);

  doc.setFont('helvetica','normal');doc.setFontSize(9.5);
  doc.text('Penugasan SPPD kepada:',18,56);

  let y=65;
  const rows=[
    ['Nama',e.nama,true],
    ['Jabatan',e.jabatan||'-',true],
    ['Lokasi Kerja',e.lokasi_kerja||'-',true],
    ['Tanggal SPPD',fmtDateId(x.tanggal_mulai)+' s.d. '+fmtDateId(x.tanggal_selesai),true],
    ['Kendaraan',x.kendaraan||'-',true],
    ['Tujuan / Lokasi',x.tujuan||'-',true],
    ['Pengikut','-',true],
    ['Agenda SPPD',x.agenda||'-',true],
    ['Project / MOR',e.project_mor||'-',true],
    ['Kode WBS',e.kode_wbs||'-',true]
  ];
  rows.forEach(r=>{textPair(doc,r[0],r[1],18,74,y,r[2]);y+=8;});

  y+=6;
  doc.setFont('helvetica','normal');doc.setFontSize(9);
  const note='Diharapkan kepada yang bersangkutan untuk membuat laporan PJPD setelah selesai melaksanakan perjalanan dinas paling lambat 7 (tujuh) hari kerja.';
  const lines=doc.splitTextToSize(note,174);
  doc.text(lines,18,y);

  const locDate=`${x.lokasi_surat}, ${new Date().toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})}`;
  doc.setFont('helvetica','bold');doc.setFontSize(10);
  doc.text(locDate,192,183,{align:'right'});
  doc.text('TANDA TANGAN / PERSETUJUAN',105,199,{align:'center'});

  const knows=[];
  if(x.mengetahui1_tipe){
    knows.push({
      title:'Mengetahui',
      nama:x.mengetahui1_tipe==='AREA_PROJECT_OFFICER' ? (x.pic_nama||'') : (x.mengetahui1_nama||''),
      jabatan:x.mengetahui1_tipe==='AREA_PROJECT_OFFICER' ? (x.pic_jabatan||'Area Project Officer') : (x.mengetahui1_jabatan||'')
    });
  }
  if(x.mengetahui2_tipe){
    knows.push({
      title:'Mengetahui',
      nama:x.mengetahui2_tipe==='AREA_PROJECT_OFFICER' ? (x.pic_nama||'') : (x.mengetahui2_nama||''),
      jabatan:x.mengetahui2_tipe==='AREA_PROJECT_OFFICER' ? (x.pic_jabatan||'Area Project Officer') : (x.mengetahui2_jabatan||'')
    });
  }

  // jika PIC dipilih, ambil dari master bila ada pada selectedEmployee payload
  const signers=[{title:'Ditugaskan Oleh',nama:x.ditugaskan_nama,jabatan:x.ditugaskan_jabatan},...knows];
  const n=Math.max(2,signers.length);
  const x0=18, y0=204, width=174, height=36, cw=width/n;
  doc.setFontSize(9);
  for(let i=0;i<n;i++){
    doc.rect(x0+i*cw,y0,cw,height);
    const s=signers[i]||{title:'Mengetahui',nama:'',jabatan:''};
    doc.setFont('helvetica','bold');doc.text(s.title,x0+i*cw+cw/2,y0+6,{align:'center'});
    doc.setFont('helvetica','bold');
    if(s.nama)doc.text(pdfSafe(s.nama),x0+i*cw+cw/2,y0+26,{align:'center'});
    doc.setFont('helvetica','normal');
    if(s.jabatan)doc.text(pdfSafe(s.jabatan),x0+i*cw+cw/2,y0+32,{align:'center'});
  }

  doc.save('SPPD_'+x.no_sppd.replaceAll('/','-')+'.pdf');
}

async function loadTariffs(){
  // Tarif standar PJPD sekarang fixed:
  // Hotel Rp375.000/hari
  // Uang Saku Rp150.000/hari
  // Uang Makan Rp75.000/hari
  return;
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
  const det=[];
  const hQty=num('pHotelQty'),hRate=375000;
  if(hQty>0)det.push({komponen:'Uang Hotel',qty:hQty,satuan:'Hari',tarif:hRate,jumlah:hQty*hRate,urutan:1});
  const sQty=num('pSakuQty'),sRate=150000;if(sQty>0||sRate>0)det.push({komponen:'Uang Saku',qty:sQty,satuan:'Hari',tarif:sRate,jumlah:sQty*sRate,urutan:2});
  const mQty=num('pMakanQty'),mRate=75000;if(mQty>0||mRate>0)det.push({komponen:'Uang Makan',qty:mQty,satuan:'Hari',tarif:mRate,jumlah:mQty*mRate,urutan:3});
  const km=num('pKmPribadi'),kmValue=kendaraanPribadiValue();if(km>0)det.push({komponen:'Kendaraan Pribadi',qty:km,satuan:'KM',tarif:3500,jumlah:kmValue,urutan:4});
  [...document.querySelectorAll('#extraRows .costrow')].forEach((r,j)=>{const q=Number(r.querySelector('.exQty').value||0),rate=Number(r.querySelector('.exRate').value||0),name=r.querySelector('.exName').value.trim();if(name)det.push({komponen:name,qty:q,satuan:r.querySelector('.exUnit').value,tarif:rate,jumlah:q*rate,urutan:10+j})});
  return det;
}
function recalc(){if($('pKmNilai'))$('pKmNilai').value=rp(kendaraanPribadiValue());const total=getDetails().reduce((a,x)=>a+x.jumlah,0),sel=total;$('sumTotal').textContent=rp(total);$('sumSelisih').textContent=rp(sel);$('sumTerbilang').textContent=terbilang(Math.abs(sel))+' Rupiah'}
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
    sppd_id:selectedSppd.id,details,
    menyetujui_nama:val('pSetNama').trim(),menyetujui_jabatan:val('pSetJab').trim(),
    mengetahui1_tipe:know1.type,mengetahui1_nama:know1.nama,mengetahui1_jabatan:know1.jabatan,
    mengetahui2_tipe:know2.type,mengetahui2_nama:know2.nama,mengetahui2_jabatan:know2.jabatan
  };
  loading(true);const {data,error}=await sb.rpc('create_pjpd',{p:payload});loading(false);if(error)return alert(error.message);
  const pdfData={...payload,no_pjpd:data.no_pjpd,total:data.total_pjpd,selisih:data.kurang_lebih_bayar,s:selectedSppd};
  $('pjpdSaved').innerHTML=`<div class="box"><b>PJPD berhasil dibuat</b><br>${esc(data.no_pjpd)}<p><button onclick='downloadPjpdPdf(${JSON.stringify(JSON.stringify(pdfData))})'>Download PDF PJPD</button></p></div>`;
}
async function downloadPjpdPdf(json){
  const x=JSON.parse(json),s=x.s,{jsPDF}=window.jspdf;
  const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
  const W=297,H=210;

  doc.setDrawColor(30);doc.setLineWidth(.25);doc.rect(6,8,285,194);
  await addBfpLogo(doc,12,13,22,13);

  doc.setFont('helvetica','normal');doc.setFontSize(7.2);
  doc.text('No. PJPD: '+x.no_pjpd,289,6,{align:'right'});
  doc.text('Referensi SPPD:',287,17,{align:'right'});
  doc.setFont('helvetica','bold');doc.text(s.no_sppd,287,21,{align:'right'});

  doc.setFont('helvetica','bold');doc.setFontSize(15);
  doc.text('PERTANGGUNGJAWABAN',148.5,18,{align:'center'});
  doc.text('PERJALANAN DINAS (PJPD)',148.5,24,{align:'center'});

  doc.setFontSize(8.5);
  let y=34;
  textPair(doc,'Tanggal PJPD',new Date().toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'}),12,58,y,false);
  textPair(doc,'Project / MOR',s.project_mor||'-',152,198,y,false); y+=6;
  textPair(doc,'Nama',s.nama,12,58,y,true);
  textPair(doc,'Kode WBS',s.kode_wbs||'-',152,198,y,false); y+=6;
  textPair(doc,'Jabatan',s.jabatan||'-',12,58,y,false);
  textPair(doc,'Lokasi Kerja',s.lokasi_kerja||'-',152,198,y,false); y+=6;
  textPair(doc,'Dari Tanggal',fmtDateId(s.tanggal_mulai),12,58,y,false);
  textPair(doc,'Sampai Tanggal',fmtDateId(s.tanggal_selesai),152,198,y,false); y+=6;
  textPair(doc,'Tujuan',s.tujuan||'-',12,58,y,false); y+=6;
  textPair(doc,'Keperluan',s.agenda||s.keperluan||'-',12,58,y,false);

  // Table
  const tx=11,ty=67,tw=275;
  const cols=[14,90,27,30,52,62];
  const headers=['No.','Rincian Biaya','Qty','Satuan','Tarif / Nominal','Jumlah'];
  let cy=ty;
  doc.setFont('helvetica','bold');doc.setFontSize(8);
  doc.rect(tx,cy,tw,8);
  let cx=tx;
  headers.forEach((h,i)=>{doc.rect(cx,cy,cols[i],8);doc.text(h,cx+cols[i]/2,cy+5.3,{align:'center'});cx+=cols[i];});
  cy+=8;

  doc.setFont('helvetica','normal');
  x.details.forEach((d,i)=>{
    cx=tx;
    const vals=[String(i+1),d.komponen,String(d.qty),d.satuan||'',rp(d.tarif),rp(d.jumlah)];
    vals.forEach((v,j)=>{
      doc.rect(cx,cy,cols[j],7);
      if(j===0||j===2||j===3) doc.text(v,cx+cols[j]/2,cy+4.8,{align:'center'});
      else if(j>=4) doc.text(v,cx+cols[j]-2,cy+4.8,{align:'right'});
      else doc.text(v,cx+2,cy+4.8);
      cx+=cols[j];
    });
    cy+=7;
  });

  function totalRow(label,value,bold=true){
    doc.rect(tx,cy,tw,7);
    const left=tx+cols[0]+cols[1]+cols[2]+cols[3];
    doc.line(left,cy,left,cy+7);
    doc.setFont('helvetica',bold?'bold':'normal');
    doc.text(label,left+cols[4]-2,cy+4.8,{align:'right'});
    doc.text(value,tx+tw-2,cy+4.8,{align:'right'});
    cy+=7;
  }
  totalRow('TOTAL PJPD',rp(x.total));
  totalRow('JUMLAH DIBAYARKAN',rp(x.selisih));

  doc.rect(tx,cy,tw,8);
  const split=tx+105;
  doc.line(split,cy,split,cy+8);
  doc.setFont('helvetica','bold');doc.text('Terbilang',tx+2,cy+5.2);
  doc.setFont('helvetica','italic');doc.text(terbilang(Math.abs(x.selisih))+' Rupiah',split+3,cy+5.2);
  cy+=8;

  const infoY=cy+5;
  textPair(doc,'Dibayarkan Kepada',s.nama,12,64,infoY,false);
  textPair(doc,'Bank',s.bank||'-',12,64,infoY+6,false);
  textPair(doc,'No. Rekening',s.no_rekening||'-',12,64,infoY+12,false);

  const signY=infoY+22;
  doc.setFont('helvetica','bold');doc.text('TANDA TANGAN / PERSETUJUAN',148.5,signY,{align:'center'});
  const y0=signY+4,h=38,x0=11,w=275,cw=w/4;
  const know1={nama:x.mengetahui1_nama||'',jabatan:x.mengetahui1_jabatan||''};
  const know2={nama:x.mengetahui2_nama||'',jabatan:x.mengetahui2_jabatan||''};
  const signers=[
    {title:'Mengajukan',nama:s.nama,jabatan:s.jabatan||''},
    {title:'Menyetujui',nama:x.menyetujui_nama,jabatan:x.menyetujui_jabatan},
    {title:'Diketahui',nama:know1.nama,jabatan:know1.jabatan},
    {title:'Mengetahui',nama:know2.nama||((x.mengetahui1_tipe==='PROJECT_OFFICER')?'':'') ,jabatan:know2.jabatan}
  ];
  // Bila PIC berada di mengetahui1, kolom 3 adalah PIC. Bila PIC di mengetahui2, kolom 4 adalah PIC.
  if(x.mengetahui1_tipe==='PROJECT_OFFICER'){
    signers[2]={title:'Diketahui',nama:s.project_officer_nama||'',jabatan:s.project_officer_jabatan||'Area Project Officer'};
  }
  if(x.mengetahui2_tipe==='PROJECT_OFFICER'){
    signers[3]={title:'Mengetahui',nama:s.project_officer_nama||'',jabatan:s.project_officer_jabatan||'Area Project Officer'};
  }
  for(let i=0;i<4;i++){
    doc.rect(x0+i*cw,y0,cw,h);
    const sg=signers[i];
    doc.setFont('helvetica','bold');doc.text(sg.title,x0+i*cw+cw/2,y0+6,{align:'center'});
    if(sg.nama){doc.text(sg.nama,x0+i*cw+cw/2,y0+28,{align:'center'});}
    doc.setFont('helvetica','normal');
    if(sg.jabatan)doc.text(sg.jabatan,x0+i*cw+cw/2,y0+34,{align:'center'});
  }

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
window.searchOpenSppd=searchOpenSppd;
window.pickSppd=pickSppd;
window.addExtra=addExtra;
window.recalc=recalc;
window.togglePjpdKnow=togglePjpdKnow;
window.submitPjpd=submitPjpd;