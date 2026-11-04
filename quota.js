/* RPM Area V27 — catatan pertumbuhan DB harian & estimasi sisa hari.
   Riwayat disimpan server (RPC anggota workspace); tidak ada secret key di browser. */
(()=>{'use strict';
 const $=s=>document.querySelector(s), KEY='rpmarea_quota_local_v25';
 const DB_LIMIT=500e6, EGRESS_LIMIT=5e9, DAY=86400000;
 let state={};try{state=JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch{}
 const fmtMB=b=>(b/1e6).toLocaleString('id-ID',{minimumFractionDigits:0,maximumFractionDigits:2})+' MB';
 const signedMB=b=>(b>0?'+':b<0?'−':'')+fmtMB(Math.abs(b));
 const pct=(used,max)=>(100*used/max).toLocaleString('id-ID',{maximumFractionDigits:1})+'%';
 const status=(msg,kind='info')=>{const el=$('#quotaStatus');if(el){el.textContent=msg;el.dataset.kind=kind}};
 function persist(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch(err){console.warn('Tidak bisa menyimpan cache kuota',err)}}
 function dateWIB(){const p=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Jakarta',day:'2-digit',month:'2-digit',year:'numeric'}).formatToParts(new Date());const x=Object.fromEntries(p.map(t=>[t.type,t.value]));return x.year+'-'+x.month+'-'+x.day}
 function paint(prefix,used,limit){
  const valid=Number.isFinite(used)&&used>=0;
  $('#quota'+prefix+'Used').textContent=valid?fmtMB(used):'—';
  $('#quota'+prefix+'Left').textContent=valid?fmtMB(Math.max(0,limit-used)):'—';
  $('#quota'+prefix+'Percent').textContent=valid?pct(used,limit):'—';
  const bar=$('#quota'+prefix+'Bar');bar.style.width=(valid?Math.min(100,used/limit*100):0)+'%';
  bar.dataset.level=valid&&used>=limit*.95?'full':valid&&used>=limit*.70?'warn':'ok';
 }
 function trendRender(){
  const bytes=Number.isFinite(state.databaseBytes)?state.databaseBytes:NaN;
  const raw=Array.isArray(state.history)?state.history:[];
  const result=window.RpmQuotaMath.analyze(raw,bytes,DB_LIMIT);
  $('#quotaTrendSampleCount').textContent=result.rows.length?`${result.rows.length} tanggal tercatat (WIB)`:'Belum ada riwayat';
  $('#quotaDailyDelta').textContent=result.lastDelta===null?'—':signedMB(result.lastDelta);
  $('#quotaDailyDetail').textContent=result.dayGap===1?'Perubahan dari hari sebelumnya':result.dayGap>1?`Perubahan selama ${result.dayGap} hari (ada jeda pengukuran)`:'Butuh pengukuran pada dua tanggal berbeda';
  $('#quotaAverage7d').textContent=result.avgDaily===null?'—':signedMB(result.avgDaily)+'/hari';
  $('#quotaAverageDetail').textContent=result.avgDaily===null?'Butuh minimal 2 tanggal dalam 7 hari':'Rata-rata dari '+result.spanDays+' hari antar sampel (maks. 7 hari)';
  $('#quotaDaysLeft').textContent=result.daysLeft===null?'—':result.daysLeft===0?'0 hari':result.daysLeft.toLocaleString('id-ID')+' hari';
  $('#quotaEstimateNote').textContent=result.daysLeft===null?'Prediksi muncul setelah ada tren kenaikan':'Perkiraan linear; tidak menjamin kuota atau tanggal pasti';
  if(result.daysLeft!==null){
   const end=new Date(Date.now()+result.daysLeft*DAY);
   $('#quotaEstimatedDate').textContent=result.daysLeft===0?'Sudah melewati batas estimasi':end.toLocaleDateString('id-ID',{timeZone:'Asia/Jakarta',day:'numeric',month:'short',year:'numeric'});
  }else $('#quotaEstimatedDate').textContent='—';
  const warning=$('#quotaTrendWarning');warning.dataset.level=result.level;
  const warnText={normal:'🟢 Database masih di bawah 70% batas perkiraan.',warning:'🟡 Peringatan: pemakaian DB telah mencapai 70%. Pertimbangkan arsip dan pantau pertumbuhan.',danger:'🟠 Waspada: pemakaian DB mencapai 85%. Periksa kapasitas sebelum menyimpan data baru.',critical:'🔴 Kritis: pemakaian DB mencapai 95%. Segera periksa Usage resmi dan strategi kapasitas.',unknown:'Belum ada pembacaan database.'};
  warning.textContent=warnText[result.level];
  const history=$('#quotaTrendHistory');history.replaceChildren();
  const rows=result.rows.slice(-7);if(!rows.length){const e=document.createElement('p');e.textContent='Riwayat kosong. Login lalu tekan Perbarui DB setelah menjalankan SQL V27.';history.append(e);return}
  const table=document.createElement('table'),head=document.createElement('thead'),tr=document.createElement('tr');
  for(const label of ['Tanggal WIB','Total DB','Selisih']){const th=document.createElement('th');th.textContent=label;tr.append(th)}head.append(tr);table.append(head);
  const body=document.createElement('tbody');
  rows.forEach((row,i)=>{const tr=document.createElement('tr'),prev=rows[i-1],gap=prev?row.day-prev.day:0;
   const col=[row.date,fmtMB(row.bytes),prev?signedMB(row.bytes-prev.bytes)+(gap>1?' / '+gap+' hari':''):'—'];
   col.forEach(v=>{const td=document.createElement('td');td.textContent=v;tr.append(td)});body.append(tr)
  });table.append(body);history.append(table);
 }
 function render(){
  paint('Db',Number.isFinite(state.databaseBytes)?state.databaseBytes:NaN,DB_LIMIT);
  paint('Egress',Number.isFinite(state.egressBytes)?state.egressBytes:NaN,EGRESS_LIMIT);
  $('#quotaEgressInput').value=Number.isFinite(state.egressBytes)?String(Math.round(state.egressBytes/1e4)/100):'';
  $('#quotaEgressDate').textContent=state.egressAt?'Diisi manual: '+new Date(state.egressAt).toLocaleString('id-ID')+' • hanya HP ini':'Belum dicatat di perangkat ini.';
  trendRender();
  if(Number.isFinite(state.databaseBytes)&&state.dbAt)status('Ukuran database terakhir: '+new Date(state.dbAt).toLocaleString('id-ID')+'. Tekan Perbarui DB untuk angka terkini.','info');
 }
 let working=false;
 async function refresh({automatic=false}={}){
  if(working)return;
  const api=window.RpmQuotaAPI;if(!api?.authorized){if(!automatic)status('Masuk ke Supabase melalui menu Cloud dan tunggu status terhubung, lalu coba lagi.','warn');return}
  working=true;const btn=$('#quotaRefresh');btn.disabled=true;status('Mencatat ukuran database dan mengambil riwayat…','pending');
  let trendFailed=false;
  try{
   let result;
   try{result=await api.readTrend()}
   catch(err){
    const msg=String(err?.message||err);
    if(/Could not find the function|PGRST202|404|schema cache/i.test(msg)){
     trendFailed=true;result=await api.readDatabase();
    }else throw err;
   }
   state.databaseBytes=result.bytes;state.dbAt=result.checkedAt;
   if(Array.isArray(result.history)){state.history=result.history;state.autoSuccessDay=dateWIB()}
   persist();render();
   if(trendFailed)status('⚠️ Ukuran DB berhasil dibaca, tetapi riwayat belum aktif. Jalankan SQL_KUOTA_RPM_V27.txt di Supabase SQL Editor untuk mencatat pertumbuhan harian.','warn');
   else status('✅ Ukuran DB '+fmtMB(result.bytes)+' tercatat. '+(result.history.length<2?'Hari pertama adalah nilai awal, bukan pemakaian sehari. Perlu tanggal pengukuran berikutnya untuk prediksi.':'Perubahan harian & estimasi diperbarui.')+' Angka DB bukan total pemakaian Supabase.','ok');
  }catch(err){
   let msg=String(err?.message||err);
   if(/permission|42501|JWT|401/i.test(msg))msg='Pastikan login sebagai anggota workspace. '+msg;
   status('⚠️ Belum dapat membaca kuota: '+msg+(state.dbAt?' (angka sebelumnya masih ditampilkan)':''),'warn');
  }finally{working=false;btn.disabled=false}
 }
 function maybeAutomatic(){
  if(!window.RpmQuotaAPI?.authorized||!navigator.onLine)return;
  const today=dateWIB();if(state.autoSuccessDay===today||state.lastAutoTryDay===today)return;
  state.lastAutoTryDay=today;persist();refresh({automatic:true});
 }
 $('#quotaRefresh').addEventListener('click',()=>refresh());
 $('#quotaEgressInput').addEventListener('change',e=>{
  if(e.target.value.trim()===''){delete state.egressBytes;delete state.egressAt}
  else{const n=Number(e.target.value);if(!Number.isFinite(n)||n<0){status('Masukkan angka MB yang valid.','warn');return}state.egressBytes=n*1e6;state.egressAt=new Date().toISOString()}
  persist();render();status('Egress dicatat manual dari Dashboard Usage. Ini bukan pembacaan otomatis.','ok');
 });
 $('#cloudOpen').addEventListener('click',()=>{if(!state.dbAt)status('Login ke Supabase. Jalankan SQL_KUOTA_RPM_V27.txt untuk riwayat.','info');maybeAutomatic()});
 window.addEventListener('rpmarea:cloud-authorized',maybeAutomatic);
 window.addEventListener('online',maybeAutomatic);
 // Memeriksa pergantian hari tanpa melakukan polling database berulang.
 setInterval(maybeAutomatic,30*60*1000);
 render();
})();
