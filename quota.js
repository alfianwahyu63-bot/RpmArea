/* RPM Area V25 — statistik pemakaian, tanpa menaruh token admin di browser. */
(()=>{'use strict';
 const $=s=>document.querySelector(s), KEY='rpmarea_quota_local_v25';
 const DB_LIMIT=500e6, EGRESS_LIMIT=5e9;
 let state={};try{state=JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch{}
 const fmtMB=b=>(b/1e6).toLocaleString('id-ID',{maximumFractionDigits:2})+' MB';
 const fmtGB=b=>(b/1e9).toLocaleString('id-ID',{maximumFractionDigits:2})+' GB';
 const pct=(used,max)=>(100*used/max).toLocaleString('id-ID',{maximumFractionDigits:1})+'%';
 const status=(msg,kind='info')=>{const el=$('#quotaStatus');if(!el)return;el.textContent=msg;el.dataset.kind=kind};
 function paint(prefix,used,limit){
  const valid=Number.isFinite(used)&&used>=0;
  $('#quota'+prefix+'Used').textContent=valid?fmtMB(used):'—';
  $('#quota'+prefix+'Left').textContent=valid?fmtMB(Math.max(0,limit-used)):'—';
  $('#quota'+prefix+'Percent').textContent=valid?pct(used,limit):'—';
  const bar=$('#quota'+prefix+'Bar');bar.style.width=(valid?Math.min(100,used/limit*100):0)+'%';
  bar.dataset.level=valid&&used>=limit?'full':valid&&used>=limit*.8?'warn':'ok';
 }
 function render(){
  paint('Db',Number.isFinite(state.databaseBytes)?state.databaseBytes:NaN,DB_LIMIT);
  paint('Egress',Number.isFinite(state.egressBytes)?state.egressBytes:NaN,EGRESS_LIMIT);
  $('#quotaEgressInput').value=Number.isFinite(state.egressBytes)?String(Math.round(state.egressBytes/1e4)/100):'';
  $('#quotaEgressDate').textContent=state.egressAt?'Diisi manual: '+new Date(state.egressAt).toLocaleString('id-ID')+' • hanya HP ini':'Belum dicatat di perangkat ini.';
  if(Number.isFinite(state.databaseBytes)&&state.dbAt)status('Ukuran database terakhir: '+new Date(state.dbAt).toLocaleString('id-ID')+'. Tekan Perbarui DB untuk angka terkini.','info');
 }
 async function refresh(){
  const btn=$('#quotaRefresh');btn.disabled=true;status('Mengukur ukuran database...','pending');
  try{
   if(!window.RpmQuotaAPI?.readDatabase)throw new Error('Modul cloud belum siap. Muat ulang dan pastikan internet aktif.');
   const {bytes,checkedAt}=await window.RpmQuotaAPI.readDatabase();
   state.databaseBytes=bytes;state.dbAt=checkedAt;localStorage.setItem(KEY,JSON.stringify(state));
   render();status('✅ Ukuran DB diperiksa: '+fmtMB(bytes)+' dari 500 MB. Ini perkiraan ukuran PostgreSQL, bukan total penggunaan semua layanan Supabase.','ok');
  }catch(err){
   let msg=String(err?.message||err);
   if(/Could not find the function|PGRST202|404|schema cache/i.test(msg))msg='Jalankan supabase-quota-rpc.sql dari ZIP V25 di Supabase SQL Editor, lalu coba lagi.';
   else if(/permission|42501|JWT|401/i.test(msg))msg='Login sebagai anggota workspace melalui menu Cloud, lalu coba lagi. '+msg;
   status('⚠️ Belum dapat membaca otomatis: '+msg+(state.dbAt?' (angka terakhir masih tersimpan)':''),'warn');
  }finally{btn.disabled=false}
 }
 $('#quotaRefresh').addEventListener('click',refresh);
 $('#quotaEgressInput').addEventListener('change',e=>{
  if(e.target.value.trim()===''){delete state.egressBytes;delete state.egressAt}
  else{const n=Number(e.target.value);if(!Number.isFinite(n)||n<0){status('Masukkan angka MB yang valid.','warn');return}state.egressBytes=n*1e6;state.egressAt=new Date().toISOString()}
  localStorage.setItem(KEY,JSON.stringify(state));render();status('Egress dicatat secara manual dari dashboard. Nilai ini bukan pembacaan otomatis.','ok');
 });
 $('#cloudOpen').addEventListener('click',()=>{
  if(!state.dbAt)status('Login Supabase lalu tekan Perbarui DB. Untuk pertama kali, jalankan supabase-quota-rpc.sql.','info');
 });
 render();
})();
