/* RpmArea V33 · sinkronisasi lintas HP via Supabase PostgreSQL & RLS.
   Transaksi atomic compare-and-swap mencegah overwrite perubahan perangkat lain.
   Setiap perubahan menggunakan expected_version dan diverifikasi dengan membaca server.
   Bila request timeout, hasil TIDAK dianggap gagal atau berhasil: cek server kembali, tanpa retry tulis otomatis.
*/
const $=selector=>document.querySelector(selector);
const $id=id=>document.getElementById(id);
const cfg=window.RPM_AREA_SUPABASE||{};
const transport=window.RpmCloudREST;
const safeMerge=window.RpmSafeMerge;
const catalogAPI=window.RpmCatalogDelete;
const el={
 dialog:$('#cloudDialog'),open:$('#cloudOpen'),status:$('#cloudStatus'),badge:$('#cloudBadge'),
 form:$('#cloudLogin'),loginBtn:$('#cloudLoginBtn'),email:$('#cloudEmail'),password:$('#cloudPassword'),
 logged:$('#cloudAuthed'),user:$('#cloudUser'),logout:$('#cloudLogout'),upload:$('#cloudUploadLocal'),
 progress:$('#cloudProgress'),progressTitle:$('#cloudProgressTitle'),progressPct:$('#cloudProgressPct'),
 progressTrack:$('#cloudProgressTrack'),progressFill:$('#cloudProgressFill'),progressCount:$('#cloudProgressCount'),
 progressHint:$('#cloudProgressHint'),conflict:$('#cloudConflict'),conflictText:$('#cloudConflictText'),
 backupLocal:$('#cloudExportLocal'),backupCloud:$('#cloudExportRemote'),resync:$('#cloudResyncNow'),
 resyncStatus:$('#cloudResyncStatus'),restore:$('#cloudRestoreQty'),resume:$('#cloudResumeSafe'),
 repairNote:$('#cloudRepairMessage'),diag:$('#cloudDiagnosticBtn'),diagResult:$('#cloudDiagnosticResult'),
 sharedStatus:$('#sharedUIStatus'),cloudUIStatus:$('#cloudUIStatus'),checkNow:$('#cloudCheckNow'),
 catalogScan:$('#cloudCatalogScan'),catalogInfo:$('#cloudCatalogInfo'),
 catalogQuick:$('#cloudCatalogQuickFix'),catalogQuickText:$('#cloudCatalogQuickText'),catalogQuickScan:$('#cloudCatalogQuickScan'),
 catalogWrap:$('#cloudCatalogCandidates'),catalogList:$('#cloudCatalogList'),
 catalogAll:$('#cloudCatalogAll'),catalogDelete:$('#cloudCatalogDelete'),
 catalogBackupLocal:$('#cloudCatalogBackupLocal'),catalogBackupCloud:$('#cloudCatalogBackupCloud')
};
function status(msg,level='warn',badge=''){
 el.status.textContent=msg;el.status.dataset.level=level;
 el.badge.textContent=badge||(level==='ok'?'Cloud: Aktif':level==='error'?'Cloud: Error':'Cloud: Cek');
}
function note(msg,kind='pending'){if(el.resyncStatus){el.resyncStatus.textContent=msg;el.resyncStatus.dataset.state=kind}}
function uiNote(msg,kind='pending') {for(const item of [el.sharedStatus,el.cloudUIStatus])if(item){item.textContent=msg;item.dataset.state=kind}}
function diagNote(msg,kind='pending'){if(el.diagResult){el.diagResult.textContent=msg;el.diagResult.dataset.state=kind}}
function failText(err){const code=String(err?.code||'ERROR'),detail=String(err?.message||err||'');
 if(err?.http===403||code==='42501')return 'Akses ditolak (HTTP 403). Periksa akun anggota workspace dan izin editor pada rpm_members. '+detail;
 if(err?.http===401)return 'Sesi Supabase tidak berlaku. Login kembali. '+detail;
 if(code==='TIMEOUT_UNKNOWN')return 'BELUM TERKONFIRMASI: '+detail+' Jangan mengirim ulang sebelum Cek Cloud Sekarang.';
 if(err?.http===429)return 'Supabase sedang membatasi permintaan (HTTP 429). Hentikan polling sementara dan coba lagi nanti. '+detail;
 if(code==='P0001'||err?.http===409||code==='23505')return 'Data server berubah lebih dulu. Tidak ditimpa; lakukan sinkronisasi ulang aman. '+detail;
 return `${code}${err?.http?' (HTTP '+err.http+')':''}: ${detail}`;}
const valid=!!(transport&&window.supabase?.createClient&&typeof cfg.url==='string'&&
 cfg.url.startsWith('https://')&&!cfg.url.includes('YOUR_')&&
 typeof cfg.key==='string'&&cfg.key.length>20&&!cfg.key.includes('YOUR_')&&cfg.workspaceId);
el.open?.addEventListener('click',()=>el.dialog.showModal());
$id('sharedUIPublish')?.addEventListener('click',()=>window.AreaApp?.publishSharedUI());
if(!valid){status('Supabase belum siap. Isi supabase-config.js dengan Project URL dan publishable key (bukan service_role), lalu muat ulang. Data HP tidak berubah.','error');if(el.loginBtn)el.loginBtn.disabled=true}
else{
try{
 const sb=window.supabase.createClient(cfg.url,cfg.key,{
  auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,
   storageKey:'rpmarea_supabase_auth_v22'}
 });
 let signedUser=null;
 const auth={get currentUser(){return signedUser}};
 const rest=transport.makeClient({supabase:sb,workspaceId:cfg.workspaceId});
 window.RpmQuotaAPI={
  get authorized(){return !!signedUser&&connected},
  readDatabase:async()=>{
   const {data,error}=await sb.rpc('rpm_database_usage',{p_workspace_id:cfg.workspaceId});
   if(error)throw error;
   if(!data||!Number.isFinite(Number(data.bytes)))throw new Error('Respons ukuran database tidak valid');
   return {bytes:Number(data.bytes),checkedAt:new Date().toISOString()};
  },
  readTrend:async()=>{
   const {data,error}=await sb.rpc('rpm_quota_daily_status',{p_workspace_id:cfg.workspaceId});
   if(error)throw error;
   if(!data||!Number.isFinite(Number(data.bytes))||!Array.isArray(data.history))throw new Error('Respons riwayat database tidak valid');
   return {bytes:Number(data.bytes),checkedAt:data.checkedAt||new Date().toISOString(),history:data.history};
  }
 };
 const same=transport.same;
 const normalize=value=>Array.isArray(value)?value.map(normalize):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,normalize(value[k])])):value;
 const norm=v=>JSON.stringify(normalize(v));
 const idKey=v=>encodeURIComponent(String(v));
 function pack(model){
  const records=new Map();
  for(const [week,wk] of Object.entries(model.weeks||{}))for(const st of Object.values(wk.stores||{})){
   const base=idKey(week)+'_'+idKey(st.code);
   records.set('st_'+base,{type:'store',week,code:st.code,name:st.name,targetQty:Number(st.targetQty)||0,targetNS:Number(st.targetNS)||0,
    brandTargets:st.brandTargets||{},...(st.reportedDays&&Object.keys(st.reportedDays).length?{reportedDays:st.reportedDays}:{}),
    ...(st.clearedDays&&Object.keys(st.clearedDays).length?{clearedDays:st.clearedDays}:{})});
   for(const item of st.items||[]){if(!item.id)continue;records.set('it_'+base+'_'+idKey(item.id),{
    type:'item',week,code:st.code,id:item.id,plu:item.plu,brand:item.brand||'',description:item.description||'',
    hpp:Number(item.hpp)||0,days:Array.from({length:7},(_,i)=>Number(item.days?.[i])||0)})}
  }
  return records;
 }
 const modelMap=()=>pack(window.AreaApp.getData());
 const valueMap=records=>new Map([...records].filter(([id])=>id!=='area_config'&&id!=='catalog_sync').map(([id,r])=>[id,r.value]));
 function compare(local,server){
  const missing=[...local.keys()].filter(id=>!server.has(id));
  const extra=[...server.keys()].filter(id=>!local.has(id));
  const changed=[...local].filter(([id,row])=>server.has(id)&&!same(row,server.get(id))).map(([id])=>id);
  return{missing,extra,changed,any:!!(missing.length||extra.length||changed.length)};
 }
 function snapshotDownload(filename,model){const blob=new Blob([JSON.stringify(model,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000)}
 function cloudBackup(documents=serverDocs){const out={version:1,month:window.AreaApp.getState()?.month,week:window.AreaApp.getState()?.week,theme:window.AreaApp.getState()?.theme,settings:window.AreaApp.getState()?.settings,weeks:{},exportedAt:new Date().toISOString()};
  for(const v of valueMap(documents).values()){
   if(!v.week||!v.code)continue;
   const st=(out.weeks[v.week]??={stores:{}}).stores[v.code]??={code:v.code,name:v.code,targetQty:0,targetNS:0,brandTargets:{},reportedDays:{},clearedDays:{},items:[]};
   if(v.type==='store')Object.assign(st,{name:v.name||v.code,targetQty:v.targetQty||0,targetNS:v.targetNS||0,brandTargets:v.brandTargets||{},reportedDays:v.reportedDays||{},clearedDays:v.clearedDays||{}});
   else if(v.type==='item')st.items.push({id:v.id,plu:v.plu,brand:v.brand,description:v.description,hpp:v.hpp,days:v.days});
  }
  return out;
 }
 let serverDocs=new Map(),serverValues=new Map(),connected=false,active=false,blocked=false,writing=false,reconciling=false,loading=false,uncertain=false;
 let version=0,debounce=null,uiDebounce=null,pollTimer=null,uiWriting=false,blockReason='',lastResult='',lastUIRevision='';
 let quotaPaused=false,lastDeltaAt=0;
 let catalogPreview=null,catalogBusy=false,catalogBackupLocal=false,catalogBackupCloud=false;
 const POLL_MS=90000,OVERLAP_MS=150000; // Query updated_at delta setiap 90 detik.
 const CONFIRMED_KEY='rpmarea_confirmed_supabase_v22';
 function rememberConfirmed(){try{localStorage.setItem(CONFIRMED_KEY,JSON.stringify([...serverValues]))}catch(err){console.warn('Tidak dapat menyimpan penanda cloud; backup HP tetap terpisah.',err)}}
 function lastConfirmed(){try{const raw=JSON.parse(localStorage.getItem(CONFIRMED_KEY)||'null');return Array.isArray(raw)?new Map(raw):null}catch{return null}}

 function progress(total=0,done=0,mode='save',text=''){
  if(!total){el.progress.hidden=true;return}
  el.progress.hidden=false;
  const pct=done===total?100:Math.floor(done/total*100);
  el.progressTitle.textContent=done===total?'Data dikonfirmasi Supabase':mode==='merge'?'Menggabungkan data lokal dan cloud':'Mengirim perubahan ke Cloud';
  el.progressPct.textContent=pct+'%';el.progressFill.style.width=pct+'%';el.progressTrack.setAttribute('aria-valuenow',String(pct));
  el.progressCount.textContent=done+' / '+total+' dokumen dikonfirmasi';el.progressHint.textContent=text||(done===total?'✅ Tersimpan dan diverifikasi':'Sisa '+(total-done)+' dokumen. Tidak dihitung sebelum server menyetujui.');
 }
 function disableActions(disabled){for(const b of [el.upload,el.resync,el.restore,el.resume])if(b)b.disabled=disabled}
 function setBusy(activeBusy){writing=activeBusy;disableActions(activeBusy||reconciling)}
 function displayConflict(local,server,why){
  blocked=true;active=false;blockReason=why;
  const d=compare(local,server);
  el.conflict.hidden=false;
  const describe=(ids,from)=>ids.slice(0,3).map(id=>{const doc=from.get(id);return doc?.type==='item'?`PLU ${doc.plu} · toko ${doc.code}`:doc?.type==='store'?`toko ${doc.code} · minggu ${doc.week}`:id}).join('; ');
  const example=d.extra.length?' Dokumen hanya Cloud: '+describe(d.extra,server)+'.':d.missing.length?' Dokumen hanya HP: '+describe(d.missing,local)+'.':'';
  // When the ONLY difference is cloud-only PLU(s), lead the user to the
  // opt-in DELETE workflow. 'Safe resync' would restore them back onto the HP.
  let candidatePlan={items:[]};
  try{candidatePlan=catalogAPI?.candidates(local,server)||candidatePlan}catch(_err){}
  const onlyDeletedCatalog=d.missing.length===0&&d.changed.length===0&&
   d.extra.length>0&&d.extra.every(id=>candidatePlan.items.some(row=>row.id===id));
  const hasCandidates=candidatePlan.items.length>0;
  if(el.catalogQuick)el.catalogQuick.hidden=!hasCandidates;
  if(el.resync)el.resync.hidden=onlyDeletedCatalog;
  if(hasCandidates){
   const lead=candidatePlan.items.slice(0,3).map(row=>`Toko ${row.code} · PLU ${row.plu}`).join('; ');
   el.catalogQuickText.textContent=`${candidatePlan.items.length} PLU hanya ada di Cloud (${lead}). Jika PLU tersebut memang sengaja dihapus dari HP, pilih TINJAU di bawah. Tidak akan terhapus otomatis.`;
  }
  const guidance=onlyDeletedCatalog?
   'Gunakan TINJAU PLU CLOUD YANG AKAN DIHAPUS, bukan Sinkronisasi Ulang Aman.':
   hasCandidates?'Tinjau PLU yang sudah dihapus di HP sebelum melakukan sinkronisasi ulang.':
   'Gunakan Sinkronisasi Ulang Aman setelah backup.';
  el.conflictText.textContent=`${why}. Lokal: ${local.size} dokumen, Cloud: ${server.size}. Hanya HP: ${d.missing.length}, hanya Cloud: ${d.extra.length}, isi berbeda: ${d.changed.length}.${example} Data belum ditimpa atau dihapus. ${guidance}`;
  status('🛑 Data lokal dan Cloud berbeda. '+guidance,'error','Cloud: Konflik');
  el.restore.hidden=true;el.resume.hidden=true;
  note(guidance+' Tidak ada penghapusan otomatis.','warning');
 }
 function setActive(msg='✅ Data lokal telah sama dengan server. Sinkron antar-HP aktif.'){
  active=true;blocked=false;uncertain=false;el.conflict.hidden=true;
  if(el.catalogQuick)el.catalogQuick.hidden=true;
  if(el.resync)el.resync.hidden=false;
  rememberConfirmed();
  status(msg,'ok','Cloud: Aktif');
 }
 function onError(err,heading='Sinkronisasi gagal'){
  if(err?.http===429||err?.code==='RESOURCE_EXHAUSTED'){quotaPaused=true;active=false;clearInterval(pollTimer);pollTimer=null;clearTimeout(debounce);clearTimeout(uiDebounce);progress();uiNote('⛔ Supabase membatasi permintaan (HTTP 429). Pengaturan tetap tersimpan lokal, belum terkirim.','error');}
  const message=heading+': '+failText(err);
  status('❌ '+message,'error','Cloud: Gagal');note(message,'error');diagNote(message,'error');
 }
 async function applyServer(records){const vals=valueMap(records);await window.AreaApp.applyRemote([...vals.values()]);serverDocs=records;serverValues=vals}
 async function loadSharedUi(records){const doc=records.get('area_config')?.value;
  if(window.AreaApp.getPendingSharedUI())return;
  if(doc?.settings&&doc?.revision&&doc.revision!==lastUIRevision){window.AreaApp.applySharedUI({theme:doc.theme,settings:doc.settings});lastUIRevision=doc.revision;uiNote('✅ Tema dan tampilan diambil dari Cloud (berlaku semua HP).','saved')}
 }
 async function refresh(reason='poll'){
  if(!connected||writing||reconciling||loading||(reason==='poll'&&quotaPaused))return;
  const tokenVersion=version,startedAt=Date.now();
  loading=true;
  if(reason==='manual')status('🔍 Mengecek ulang dokumen Cloud via HTTPS…','warn','Cloud: Cek');
  try{
   // Poll reads only changed docs; manual check can still perform a full audit on demand.
   const delta=reason==='poll'?await rest.changesSince(new Date(Math.max(0,lastDeltaAt-OVERLAP_MS)).toISOString()):null;
   // Hard-deleted PLUs cannot appear in a modified-at delta. The SQL delete RPC
   // atomically updates catalog_sync, so fetch a full snapshot when it changes.
   const catalogChanged=reason==='poll'&&delta.has('catalog_sync')&&
    serverDocs.get('catalog_sync')?.updateTime!==delta.get('catalog_sync')?.updateTime;
   const latest=reason==='poll'?(catalogChanged?await rest.listRecords():new Map([...serverDocs,...delta])):await rest.listRecords();if(tokenVersion!==version)return;
   lastDeltaAt=startedAt;quotaPaused=false;
   if(reason==='poll'&&!delta.size)return; // No changes means zero large collection scans.
   await loadSharedUi(latest);
   const newValues=valueMap(latest),local=modelMap(),old=serverValues;
   serverDocs=latest;serverValues=newValues;
   const curr=compare(local,newValues);
   if(!curr.any){setActive();if(reason==='manual')note('✅ Cloud dan HP identik.','success');return}
   const localChanged=compare(local,old).any,cloudChanged=compare(old,newValues).any;
   if(!old.size&&!local.size&&newValues.size){await applyServer(latest);setActive('✅ Data dari cloud sudah dimuat di HP.');return}
   if(!localChanged&&cloudChanged){
    if(window.AreaSafety&&!(await window.AreaSafety.beforeRemote()))throw Error('Cadangan perangkat gagal dibuat. Data HP tidak diubah.');
    await applyServer(latest);setActive('✅ Ada pembaruan dari HP lain. Semua data telah dimuat dari Cloud.');
    return;
   }
   if(!cloudChanged&&localChanged&&active){scheduleUpload();return}
   if(!newValues.size&&local.size){active=false;el.upload.hidden=false;status('Cloud masih kosong. Backup lalu tekan Unggah Data Lokal untuk awal penggunaan.','warn','Cloud: Kosong');return}
   displayConflict(local,newValues,reason==='manual'?'Hasil cek ulang':'Ada perubahan di perangkat atau HP lain');
  }catch(err){if(tokenVersion===version)onError(err,'Cek Cloud tidak selesai')}
  finally{loading=false}
 }
 function scheduleUpload(){clearTimeout(debounce);if(!connected||!active||writing||blocked||uncertain||quotaPaused)return;debounce=setTimeout(()=>sendPending().catch(err=>onError(err)),900)}
 // Standard autosync only writes changed rows, after verifying the live server contents.
 // It will NOT silently delete a store/PLU or overwrite another HP's update.
 async function sendPending(){
  if(!connected||!active||writing||blocked||uncertain||loading||reconciling||quotaPaused)return;
  if(!navigator.onLine){status('Offline. Input tersimpan di HP, belum di Cloud.','warn','Cloud: Offline');return}
  const local=modelMap();const base=serverValues;
  const d=compare(local,base);if(!d.any)return;
  if(d.extra.length){displayConflict(local,base,'Penghapusan toko/PLU memerlukan pemeriksaan manual');return}
  const proposed=[...local].filter(([id,value])=>!same(value,base.get(id)));
  if(!proposed.length)return;
  setBusy(true);progress(proposed.length,0);
  let sent=0;
  try{
   // Only GET the documents being changed. Previously two full 864-document scans per edit.
   const latestById=await rest.getRecords(proposed.map(([id])=>id));
   const live=new Map(base);for(const [id,doc] of latestById){if(doc)live.set(id,doc.value);else live.delete(id)}
   for(const [id] of proposed){if(!same(live.get(id),base.get(id))&&!same(live.get(id),local.get(id))){displayConflict(local,live,'Dokumen '+id+' berubah di HP lain sebelum penulisan');return}}
   const remaining=proposed.filter(([id,value])=>!same(live.get(id),value));
   if(!remaining.length){for(const [id,doc] of latestById){if(doc)serverDocs.set(id,doc);else serverDocs.delete(id)}serverValues=live;progress(proposed.length,proposed.length);setActive();return}
   // No deletes, all writes guarded by Supabase updateTime; one 403 is visible immediately.
   for(let offset=0;offset<remaining.length;offset+=25){
    const chunk=remaining.slice(offset,offset+25);
    await rest.commit(chunk.map(([id,value])=>({id,value,previous:latestById.get(id),uid:auth.currentUser.id})),{timeout:25000});
    sent+=chunk.length;progress(proposed.length,Math.min(proposed.length-1,sent+proposed.length-remaining.length),'save','Menunggu verifikasi hasil baca balik dari server…');
   }
   // Verify only changed documents, then merge into cached server snapshot.
   const verifiedById=await rest.getRecords(remaining.map(([id])=>id));
   for(const [id,value] of remaining){const doc=verifiedById.get(id);if(!doc||!same(doc.value,value))throw Error('Konfirmasi server berbeda untuk '+id+'. Jangan menimpa data lain.');serverDocs.set(id,doc);serverValues.set(id,doc.value)}
   const now=modelMap();
   if(compare(now,serverValues).any){
    if(compare(now,local).any){active=true;blocked=false;progress(proposed.length,proposed.length);status('✅ Input sebelumnya sudah terverifikasi. Menyiapkan input terbaru…','warn','Cloud: Pending');scheduleUpload();return}
    displayConflict(now,serverValues,'Upload diverifikasi per dokumen tetapi masih ada perbedaan lokal');return;
   }
   progress(proposed.length,proposed.length);setActive('✅ '+remaining.length+' dokumen tersimpan dan diverifikasi. Perubahan akan dibaca HP lain saat sinkron delta.');
  }catch(err){
   uncertain=err?.code==='TIMEOUT_UNKNOWN';
   active=false;blocked=true;el.conflict.hidden=false;
   el.conflictText.textContent='Proses tulis dihentikan karena Supabase tidak mengonfirmasi atau menolak permintaan. Data HP tetap ada. Gunakan Cek Cloud Sekarang sebelum mencoba ulang.';
   onError(err,uncertain?'Penulisan mungkin masih berlangsung':'Supabase menolak penulisan');
   note((uncertain?'Hasil penulisan belum pasti. Jangan klik upload ulang; tekan Cek Cloud Sekarang terlebih dahulu. ':'')+failText(err),'error');
  }finally{setBusy(false);if(!blocked&&!uncertain&&active&&compare(modelMap(),serverValues).any)scheduleUpload()}
 }
 async function publishUI(){
  const pending=window.AreaApp.getPendingSharedUI();if(!pending||!connected||uiWriting||quotaPaused)return;
  if(!navigator.onLine){uiNote('📴 Tampilan tersimpan di HP. Belum terkirim karena offline.','warning');return}
  uiWriting=true;uiNote('⏳ Mengirim 1 dokumen pengaturan lewat HTTPS langsung…');
  try{
   const existing=await rest.getRecord('area_config');
   await rest.commit([{id:'area_config',previous:existing,value:{type:'area-config',theme:pending.theme,settings:pending.settings,revision:pending.revision},uid:auth.currentUser.id}]);
   const verify=await rest.getRecord('area_config');
   if(verify?.value?.revision!==pending.revision)throw Error('Konfirmasi pengaturan tidak cocok. Periksa versi Cloud sebelum mengulang.');
   serverDocs.set('area_config',verify);
   window.AreaApp.confirmSharedUI(pending.revision);lastUIRevision=pending.revision;
   uiNote('✅ Pengaturan tersimpan di Supabase. HP lain menerima saat pemeriksaan berikutnya (maksimal ±90 detik ketika online).','saved');
  }catch(err){if(err?.http===429||err?.code==='RESOURCE_EXHAUSTED')onError(err,'Supabase membatasi penulisan pengaturan');uiNote('❌ Pengaturan belum tersimpan di Cloud: '+failText(err),'error')}
  finally{uiWriting=false; if(window.AreaApp.getPendingSharedUI()&&window.AreaApp.getPendingSharedUI().revision!==pending.revision)scheduleUI()}
 }
 function scheduleUI(){clearTimeout(uiDebounce);if(connected&&!quotaPaused)uiDebounce=setTimeout(publishUI,1200)}
 function catalogNote(message,level='pending'){
  if(el.catalogInfo){el.catalogInfo.textContent=message;el.catalogInfo.dataset.state=level}
 }
 function catalogSelected(){
  return catalogPreview?[...el.catalogList.querySelectorAll('input[type="checkbox"]:checked')]
   .map(input=>input.value).filter(id=>catalogPreview.items.some(x=>x.id===id)):[];
 }
 function catalogButtons(){
  const selected=catalogSelected().length;
  for(const button of [el.catalogScan,el.catalogBackupLocal,el.catalogBackupCloud])
   if(button)button.disabled=catalogBusy||reconciling||writing;
  if(el.catalogDelete)el.catalogDelete.disabled=catalogBusy||reconciling||writing||
   !selected||!catalogBackupLocal||!catalogBackupCloud;
  if(el.catalogAll&&catalogPreview){
   el.catalogAll.checked=selected===catalogPreview.items.length;
   el.catalogAll.indeterminate=selected>0&&selected<catalogPreview.items.length;
  }
 }
 function clearCatalog(){
  catalogPreview=null;catalogBackupLocal=false;catalogBackupCloud=false;
  if(el.catalogWrap)el.catalogWrap.hidden=true;
  if(el.catalogList)el.catalogList.replaceChildren();
  catalogButtons();
 }
 async function scanCatalog(){
  if(!connected||!auth.currentUser){catalogNote('Login Supabase terlebih dahulu.','error');return}
  if(writing||reconciling||loading||catalogBusy){catalogNote('Proses sinkronisasi lain sedang berjalan. Ulangi setelah selesai.','error');return}
  if(!catalogAPI?.candidates){catalogNote('Modul PLU V33 belum termuat. Refresh aplikasi.','error');return}
  clearCatalog();catalogBusy=true;catalogButtons();catalogNote('⏳ Membaca ulang semua PLU dari Supabase tanpa mengubah data…');
  try{
   const latest=await rest.listRecords(),local=modelMap();
   const plan=catalogAPI.candidates(local,valueMap(latest));
   if(!plan.items.length){
    catalogNote('Tidak ditemukan PLU yang hanya ada di Cloud dan aman untuk ditinjau. '+
      (plan.skipped.length?plan.skipped.length+' dokumen lain perlu pemeriksaan manual.':'Daftar PLU HP dan Cloud sesuai.'),'success');return;
   }
   catalogPreview={remote:latest,local,items:plan.items};
   const f=document.createDocumentFragment();
   for(const item of plan.items){
    const label=document.createElement('label');label.className='cloud-catalog-row';
    const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.value=item.id;checkbox.checked=true;
    const span=document.createElement('span');
    span.textContent=`${item.code} · PLU ${item.plu} — ${item.description||'(tanpa deskripsi)'} · minggu ${item.week} · ${item.qty} QTY historis`;
    label.append(checkbox,span);f.append(label);
   }
   el.catalogList.replaceChildren(f);el.catalogWrap.hidden=false;
   // Keep the preview visible on small screens and inside the modal scroller.
   el.catalogWrap.scrollIntoView?.({behavior:'smooth',block:'nearest'});
   catalogNote(`${plan.items.length} PLU hanya ada di Cloud. Pilih yang benar-benar telah dihapus dari HP. `+
     `Dokumen lainnya tidak disentuh.${plan.skipped.length?' '+plan.skipped.length+' dokumen tidak memenuhi syarat dan tidak dapat dipilih.':''}`);
  }catch(err){clearCatalog();catalogNote('Gagal memeriksa Cloud: '+failText(err),'error')}
  finally{catalogBusy=false;catalogButtons()}
 }
 async function deleteSelectedCatalog(){
  if(!connected||!catalogPreview||writing||reconciling||loading||catalogBusy)return;
  const ids=catalogSelected();
  if(!ids.length||!catalogBackupLocal||!catalogBackupCloud){catalogNote('Pilih PLU dan unduh kedua backup terlebih dahulu.','error');return}
  const selected=catalogPreview.items.filter(x=>ids.includes(x.id));
  const qty=selected.reduce((total,x)=>total+x.qty,0);
  const approval=prompt(`PERINGATAN: ${selected.length} PLU dan ${qty} QTY historisnya akan DIHAPUS PERMANEN dari Cloud.\n`+
   `Data HP tidak ditimpa. Semua perangkat lain harus diperbarui ke V33.\n\n`+
   `Ketik persis: HAPUS ${selected.length} PLU`);
  if(approval!==`HAPUS ${selected.length} PLU`){catalogNote('Dibatalkan. Belum ada PLU dihapus.','pending');return}
  if(!confirm('Konfirmasi terakhir: hapus '+selected.length+' PLU yang DIPILIH di Cloud, bukan PLU lainnya?'))return;
  catalogBusy=true;reconciling=true;disableActions(true);catalogButtons();clearTimeout(debounce);
  let deleted=0;
  try{
   const currentLocal=modelMap();
   if(compare(currentLocal,catalogPreview.local).any)throw Error('Data HP berubah sejak pratinjau. Ulangi Periksa PLU.');
   const latest=await rest.listRecords();
   if(compare(valueMap(latest),valueMap(catalogPreview.remote)).any)
    throw Error('Isi Cloud berubah sejak pratinjau. Jangan menghapus memakai data lama; periksa kembali.');
   for(const row of selected){
    if(currentLocal.has(row.id))throw Error('PLU '+row.plu+' sudah ada kembali di HP. Penghapusan ditolak.');
    if(!latest.has(row.id)||latest.get(row.id).updateTime!==catalogPreview.remote.get(row.id)?.updateTime)
     throw Error('Versi PLU '+row.plu+' berubah di Cloud. Ulangi pratinjau.');
   }
   // Extra safety copy in IndexedDB; portable JSON downloads were already
   // explicitly requested using the two backup buttons.
   if(window.AreaSafety&&!(await window.AreaSafety.beforeRemote()))
    throw Error('Backup keamanan lokal gagal. Penghapusan dibatalkan.');
   for(let i=0;i<selected.length;i+=25){
    const chunk=selected.slice(i,i+25);
    const result=await rest.deleteCatalogItems(chunk.map(row=>({id:row.id,previous:latest.get(row.id)})),{timeout:30000});
    if(Number(result?.deleted)!==chunk.length)throw Error('Server tidak mengonfirmasi jumlah PLU yang dihapus.');
    deleted+=chunk.length;
    catalogNote(`⏳ ${deleted} dari ${selected.length} PLU dihapus. Memverifikasi hasil Cloud…`);
   }
   const check=await rest.listRecords();
   const remaining=selected.filter(row=>check.has(row.id));
   if(remaining.length)throw Error('Masih ada '+remaining.length+' PLU pilihan di Cloud. Penghapusan belum terverifikasi.');
   serverDocs=check;serverValues=valueMap(check);lastDeltaAt=Date.now();
   const difference=compare(modelMap(),serverValues);
   clearCatalog();
   if(difference.any){displayConflict(modelMap(),serverValues,'PLU terpilih sudah dihapus; masih ada perbedaan lain');
    catalogNote(`✅ ${deleted} PLU pilihan sudah tidak ada di Cloud. Masih ada ${difference.missing.length+difference.extra.length+difference.changed.length} perbedaan lain. Periksa dahulu sebelum sinkronisasi ulang.`,'success');
   }else{
    setActive(`✅ ${deleted} PLU dihapus dari Cloud; semua data lainnya cocok dengan HP.`);
    catalogNote(`✅ ${deleted} PLU pilihan sudah dihapus di Cloud. Daftar Cloud sekarang mengikuti daftar lokal.`, 'success');
   }
  }catch(err){
   active=false;blocked=true;
   onError(err,'Penghapusan PLU belum selesai');
   catalogNote(`❌ ${deleted} PLU batch sebelumnya sempat dikonfirmasi. ${failText(err)}. Klik Periksa PLU lagi sebelum mencoba apa pun.`, 'error');
   clearCatalog();
  }finally{catalogBusy=false;reconciling=false;disableActions(false);catalogButtons()}
 }
 // UI for selective, opt-in deletions, never executed by normal sync.
 el.catalogQuickScan?.addEventListener('click',async()=>{
  const section=$('#cloudCatalogSection');
  section?.scrollIntoView?.({behavior:'smooth',block:'start'});
  await scanCatalog();
 });
 el.catalogScan?.addEventListener('click',scanCatalog);
 el.catalogList?.addEventListener('change',catalogButtons);
 el.catalogAll?.addEventListener('change',()=>{
  el.catalogList.querySelectorAll('input[type="checkbox"]').forEach(input=>input.checked=el.catalogAll.checked);
  catalogButtons();
 });
 el.catalogBackupLocal?.addEventListener('click',()=>{
  if(!catalogPreview||catalogBusy)return;
  try{window.AreaApp.downloadLocal();catalogBackupLocal=true;catalogNote('Backup Lokal diminta. Pastikan file JSON tersimpan; lanjut unduh Backup Cloud.');catalogButtons()}
  catch(err){catalogNote('Backup lokal gagal: '+String(err.message||err),'error')}
 });
 el.catalogBackupCloud?.addEventListener('click',()=>{
  if(!catalogPreview||catalogBusy)return;
  try{
   snapshotDownload('Backup_RpmArea_Cloud_SEBELUM_HAPUS_PLU_'+new Date().toISOString().replace(/[:.]/g,'-')+'.json',cloudBackup(catalogPreview.remote));
   catalogBackupCloud=true;catalogNote('Backup Cloud diminta. Pastikan kedua file JSON tersimpan sebelum menghapus.');catalogButtons();
  }catch(err){catalogNote('Backup cloud gagal: '+String(err.message||err),'error')}
 });
 el.catalogDelete?.addEventListener('click',deleteSelectedCatalog);
 function clearConnection(){++version;clearCatalog();connected=false;active=false;blocked=false;uncertain=false;loading=false;writing=false;reconciling=false;quotaPaused=false;lastDeltaAt=0;clearTimeout(debounce);clearTimeout(uiDebounce);clearInterval(pollTimer);serverDocs=new Map();serverValues=new Map();progress();el.conflict.hidden=true;if(el.catalogQuick)el.catalogQuick.hidden=true;if(el.resync)el.resync.hidden=false;el.upload.hidden=true;el.logged.hidden=true;el.form.hidden=false}
 async function start(user){clearConnection();const current=version;lastDeltaAt=Date.now();
  el.logged.hidden=false;el.form.hidden=true;el.user.textContent='👤 '+(user.email||'Pengguna')+' · Area: '+cfg.workspaceId;
  status('🔐 Login berhasil. Memeriksa izin Supabase via HTTPS…','warn','Cloud: Periksa');
  try{
   const member=await rest.getMember(user.id);if(current!==version)return;
   if(!member?.value){status('Akun belum menjadi anggota workspace. Tambahkan user ID di tabel rpm_members.','error');return}
   if(member.value.role!=='editor'){status('Akun hanya memiliki hak baca. Hubungi admin untuk role editor sebelum melakukan input.','error');return}
   connected=true;
   const records=await rest.listRecords();if(current!==version)return;
   serverDocs=records;serverValues=valueMap(records);
   await loadSharedUi(records);
   if(window.AreaApp.getPendingSharedUI())scheduleUI();
   const local=modelMap();const diff=compare(local,serverValues);
   if(serverValues.size===0&&local.size>0){active=false;el.upload.hidden=false;status('Cloud kosong. Backup terlebih dulu lalu gunakan tombol Unggah Data Lokal.','warn','Cloud: Kosong')}
   else if(local.size===0&&serverValues.size>0){await applyServer(records);setActive('✅ Data Cloud diunduh ke HP ini. Perubahan berikutnya disinkronkan otomatis.')}
   else if(diff.any){
    const prior=lastConfirmed();
    if(prior && !compare(local,prior).any){
      // Data lokal belum berubah sejak sync terakhir: Cloud HP lain lebih baru.
      await applyServer(records);setActive('✅ Input dari HP lain berhasil diunduh dari Supabase.');
    }else if(prior && !compare(serverValues,prior).any){
      // HP ini pernah terkonfirmasi; semua perubahan sejak itu hanya berasal dari lokal.
      active=true;blocked=false;status('🔄 Ada input HP yang belum di cloud. Memverifikasi dokumen sebelum mengirim…','warn','Cloud: Pending');
      scheduleUpload();
    }else displayConflict(local,serverValues,'Data awal berbeda');
   }
   else setActive();
   // V22: baca perubahan saja, bukan membaca ulang seluruh kumpulan dokumen.
   pollTimer=setInterval(()=>refresh(),POLL_MS);
   window.dispatchEvent(new Event('rpmarea:cloud-authorized')); // V27: satu sampling kuota harian saat aplikasi digunakan.
  }catch(err){if(current===version){connected=false;onError(err,'Tidak dapat menghubungkan Supabase')}}
 }
 async function reconcile(){
  if(!connected||writing||reconciling||quotaPaused){note('Tidak bisa sinkron saat proses lain berjalan atau permintaan dibatasi. Coba Cek Cloud lagi nanti.','error');return}
  reconciling=true;disableActions(true);
  status('🔍 Memeriksa semua dokumen langsung dari server…','warn','Cloud: Cek');
  try{
   const latest=await rest.listRecords(),live=valueMap(latest),local=modelMap();
   serverDocs=latest;serverValues=live;
   const curr=compare(local,live);
   if(curr.extra.length&&catalogAPI?.candidates){
    const planOnly=catalogAPI.candidates(local,live);
    if(curr.extra.every(id=>planOnly.items.some(x=>x.id===id))&&
       !curr.missing.length&&!curr.changed.length){
      displayConflict(local,live,'Ada PLU Cloud yang sudah tidak ada di HP');
      note('⚠️ Sinkronisasi Ulang Aman dibatalkan agar PLU yang sengaja dihapus tidak kembali ke HP. Gunakan TINJAU PLU CLOUD.','warning');
      return;
    }
   }
   if(!curr.any){setActive('✅ Cloud dan HP sudah identik. Sinkronisasi kembali aktif.');note('✅ Tidak ada dokumen berbeda.','success');return}
   const plan=safeMerge?.build(local,live);
   if(!plan?.ok){displayConflict(local,live,'Konflik belum bisa digabung otomatis');note('⛔ '+(plan?.reason||'Modul safe merge tidak tersedia')+(plan?.issues?.length?' Contoh: '+plan.issues.slice(0,3).join(' | '):'')+' · Download kedua backup untuk pemeriksaan.','error');return}
   const example=(arr)=>arr.slice(0,5).map(x=>`• Toko ${x.code} / PLU ${x.plu}${x.description?' — '+x.description:''}`).join('\n');
   const catalogNote=plan.addCloud.length?`\n\n${plan.addCloud.length} PLU ADA DI CLOUD TAPI BELUM DI HP, akan DIPULIHKAN ke HP:\n${example(plan.addCloud)}`:'';
   const pendingNote=plan.addLocal.length?`\n\n${plan.addLocal.length} PLU ADA DI HP TAPI BELUM DI CLOUD, akan ditambahkan ke Cloud:\n${example(plan.addLocal)}`:'';
   note(`Perbandingan lengkap: ${plan.count} dokumen, ${plan.writeCount} perlu dikirim, ${plan.addCloud.length} PLU Cloud-only akan dipulihkan di HP, ${plan.addLocal.length} PLU HP-only akan dikirim. Tanda hapus harian diprioritaskan.`);
   // Even when nothing must be written, adding a cloud-only catalog item changes
   // the local PLU list: always ask first and preserve both independent backups.
   const mustConfirm=!!(plan.writeCount||plan.needsApproval);
   if(mustConfirm){
    const message=`SINKRONISASI ULANG AMAN — V31\n\n`+
      `${plan.count} dokumen berbeda; ${plan.writeCount} perlu ditulis ke Cloud.\n`+
      `QTY tambahan dari HP: ${plan.localQty}; dari Cloud: ${plan.cloudQty}.\n`+
      `QTY dari laporan yang ditandai HAPUS akan tetap 0.\n`+
      `PLU dan daftar toko tidak dihapus oleh proses ini.`+catalogNote+pendingNote+
      `\n\nBackup JSON LOKAL dan CLOUD akan diunduh sebelum perubahan. `+
      `Pastikan perangkat lain tidak sedang input.\n\nLanjutkan?`;
    if(!confirm(message)){note('Dibatalkan. Tidak ada data yang ditimpa atau dikirim.','warning');return}
   }
   if(window.AreaSafety&&!(await window.AreaSafety.beforeRemote()))throw Error('Backup keamanan IndexedDB gagal.');
   if(mustConfirm){
    window.AreaApp.downloadLocal();
    snapshotDownload('Backup_RpmArea_Cloud_SEBELUM_MERGE_'+new Date().toISOString().slice(0,10)+'.json',cloudBackup());
   }
   const rows=plan.changes.filter(row=>row.write);
   if(rows.length){
    let done=0;progress(rows.length,0,'merge');
    for(let i=0;i<rows.length;i+=25){const chunk=rows.slice(i,i+25);
     await rest.commit(chunk.map(row=>({id:row.id,value:row.merged,previous:latest.get(row.id),uid:auth.currentUser.id})),{timeout:25000});
     done+=chunk.length;progress(rows.length,Math.min(rows.length-1,done),'merge','Membaca ulang untuk memverifikasi dokumen…');
    }
   }
   // A fresh full read also protects against another device inserting new PLUs
   // or changing a different day while the merge was in flight.
   const check=rows.length?await rest.listRecords():latest;
   const target=valueMap(check);
   if(compare(plan.expected,target).any){displayConflict(local,target,'Verifikasi server berubah selama sinkronisasi');note('Cloud berubah selama proses. Belum diterapkan ke HP. Periksa kembali.','error');return}
   await applyServer(check);
   if(rows.length)progress(rows.length,rows.length,'merge');
   setActive('✅ Data tersinkron: '+plan.addCloud.length+' PLU dipulihkan ke HP, '+rows.length+' dokumen Cloud diverifikasi.');
   note('✅ Status Cloud Aktif. Penghapusan per tanggal dipertahankan; PLU, HPP, target dan tanggal lain terlindungi.','success');
  }catch(err){uncertain=err?.code==='TIMEOUT_UNKNOWN';active=false;blocked=true;el.conflict.hidden=false;onError(err,'Sinkronisasi ulang tidak selesai');note(failText(err)+(uncertain?' Cek Cloud dulu sebelum ulang.':''),'error')}
  finally{reconciling=false;disableActions(false)}
 }
 async function diagnostic(){
  if(!auth.currentUser){diagNote('Login Supabase terlebih dahulu.','error');return}
  if(writing||reconciling){diagNote('Ada operasi lain. Jangan menjalankan tes saat pengiriman.','error');return}
  el.diag.disabled=true;diagNote('⏳ 1/3: memeriksa izin baca melalui HTTP…');
  try{
   const member=await rest.getMember(auth.currentUser.id);
   if(!member?.value)throw Error('Tidak ada dokumen anggota workspace.');
   diagNote('✅ Anggota workspace bisa dibaca. 2/3: membaca satu dokumen toko…');
   const first=[...serverDocs].find(([,record])=>record.value?.type==='store');
   if(!first){diagNote('Tidak ada snapshot toko. Klik Cek Cloud setelah kuota pulih.','error');return}
   const preview=await rest.getRecord(first[0]);
   if(!preview)throw Error('Dokumen toko yang sebelumnya ada tidak ditemukan.');
   diagNote('✅ Baca satu toko berhasil. 3/3: tes tulis metadata.');
   if(!first){diagNote('✅ Tes baca berhasil. Tidak ada toko untuk tes tulis.','success');return}
   if(!confirm('Tes baca HTTPS berhasil. Coba TES TULIS METADATA Supabase?\n\nHanya memperbarui field waktu pada satu dokumen toko, tanpa mengubah QTY, target, PLU, atau HPP.')){diagNote('✅ Tes baca berhasil. Tes tulis dibatalkan.','success');return}
   const [id]=first,doc=preview;
   diagNote('⏳ Mengirim permintaan tulis langsung ke Supabase (maksimal 25 detik)…');
   await rest.commit([{id,value:doc.value,previous:doc,uid:auth.currentUser.id}],{timeout:25000});
   const verification=await rest.getRecord(id);
   if(!verification||!same(verification.value,doc.value))throw Error('Hasil tes tulis tidak cocok dengan data awal.');
   diagNote('✅ HTTPS BACA + TULIS BERHASIL. Security Rules menerima penulisan toko, dan data terkonfirmasi di server.','success');
  }catch(err){onError(err,'Tes Supabase gagal');diagNote('❌ '+failText(err),'error')}
  finally{el.diag.disabled=false}
 }
 // Events
 el.backupLocal?.addEventListener('click',()=>window.AreaApp.downloadLocal());
 el.backupCloud?.addEventListener('click',()=>snapshotDownload('Backup_RpmArea_Cloud_'+new Date().toISOString().slice(0,10)+'.json',cloudBackup()));
 el.resync?.addEventListener('click',reconcile);
 el.restore?.addEventListener('click',reconcile);
 el.resume?.addEventListener('click',reconcile);
 el.diag?.addEventListener('click',diagnostic);
 el.checkNow?.addEventListener('click',()=>{if(!auth.currentUser)return;quotaPaused=false;if(!connected)start(auth.currentUser);else refresh('manual').then(()=>{if(!pollTimer&&connected&&!quotaPaused)pollTimer=setInterval(()=>refresh(),POLL_MS)})});
 el.upload?.addEventListener('click',async()=>{
  if(!connected||writing||reconciling||active)return;
  if(!confirm('Unggah data lokal ke Cloud yang KOSONG? Sebelum lanjut, backup data HP. Tidak menghapus apa pun.'))return;
  try{
   const latest=await rest.listRecords();if(valueMap(latest).size>0)throw Error('Cloud tidak lagi kosong. Sinkronisasi upload dibatalkan.');
   const local=modelMap();window.AreaApp.downloadLocal();setBusy(true);progress(local.size,0,'save');
   let done=0;for(const entries of Array.from({length:Math.ceil(local.size/25)},(_,i)=>[...local].slice(i*25,(i+1)*25))){
    await rest.commit(entries.map(([id,value])=>({id,value,previous:null,uid:auth.currentUser.id})),{timeout:25000});done+=entries.length;progress(local.size,Math.min(local.size-1,done),'save','Membaca ulang untuk verifikasi…')}
   const verified=await rest.listRecords();serverDocs=verified;serverValues=valueMap(verified);
   if(compare(local,serverValues).any)throw Error('Verifikasi tidak cocok. Simpan backup dan cek ulang.');
   progress(local.size,local.size);setActive('✅ Unggahan awal telah dikonfirmasi Supabase.');el.upload.hidden=true;
  }catch(err){uncertain=err?.code==='TIMEOUT_UNKNOWN';active=false;blocked=true;el.conflict.hidden=false;onError(err,'Unggahan awal gagal atau belum pasti')}
  finally{setBusy(false)}
 });
 window.addEventListener('area:changed',()=>{if(connected){if(active)scheduleUpload();else status('💾 Input disimpan di HP, tetapi Cloud masih konflik. Gunakan Sinkronisasi Ulang Aman.','warn','Cloud: Tertahan')}});
 window.addEventListener('area:ui-changed',scheduleUI);
 window.addEventListener('online',()=>{if(connected&&!quotaPaused)refresh('poll')});
 el.form?.addEventListener('submit',async ev=>{ev.preventDefault();el.loginBtn.disabled=true;status('🔐 Login Supabase…');try{const {error}=await sb.auth.signInWithPassword({email:el.email.value.trim(),password:el.password.value});
    if(error)throw error;el.password.value=''}catch(err){onError(err,'Login gagal')}finally{el.loginBtn.disabled=false}});
 el.logout?.addEventListener('click',async()=>{if(writing||reconciling||window.AreaApp.getPendingSharedUI()||uiWriting){alert('Masih ada perubahan yang belum tersimpan. Backup dahulu.');return}await sb.auth.signOut()});
 sb.auth.onAuthStateChange((event,session)=>{
   const user=session?.user||null;
   if(user?.id===signedUser?.id)return; // Ignore token refresh / duplicated SIGNED_IN.
   signedUser=user;
   if(user)start(user);
   else{clearConnection();status('🔒 Mode lokal. Masuk Supabase agar input tersedia di semua HP.','warn','Cloud: Lokal');uiNote('☁ Login Supabase untuk menyamakan tema dan tampilan semua HP.');}
  });
}catch(err){status('❌ Modul sinkronisasi tidak dapat dijalankan: '+String(err.message||err),'error')}
}
