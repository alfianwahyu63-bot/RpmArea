/* Firebase cloud sync untuk Area 12 Toko.
   Satu dokumen Firestore per konfigurasi area, toko, dan PLU.
   Progress bar menunjukkan DOKUMEN yang SUDAH DIKONFIRMASI oleh Firestore,
   bukan perkiraan byte upload ataupun animasi persentase palsu.
   Admin tetap perlu mengatur keanggotaan workspaces/{workspaceId}/members/{uid}. */
const $ = selector => document.querySelector(selector);
const els = {
  dialog: $('#cloudDialog'),
  open: $('#cloudOpen'),
  status: $('#cloudStatus'),
  badge: $('#cloudBadge'),
  form: $('#cloudLogin'),
  loginBtn: $('#cloudLoginBtn'),
  email: $('#cloudEmail'),
  password: $('#cloudPassword'),
  logged: $('#cloudAuthed'),
  user: $('#cloudUser'),
  logout: $('#cloudLogout'),
  upload: $('#cloudUploadLocal'),
  progress: $('#cloudProgress'),
  progressTitle: $('#cloudProgressTitle'),
  progressPct: $('#cloudProgressPct'),
  progressTrack: $('#cloudProgressTrack'),
  progressFill: $('#cloudProgressFill'),
  progressCount: $('#cloudProgressCount'),
  progressHint: $('#cloudProgressHint')
};

els.open.addEventListener('click', () => els.dialog.showModal());
document.querySelector('#sharedUIPublish')?.addEventListener('click',()=>window.AreaApp?.publishSharedUI());
const config = window.RPM_AREA_FIREBASE || {};

function statusMsg(message, level = 'warn', badge = '') {
  els.status.textContent = message;
  els.status.dataset.level = level;
  els.badge.textContent = badge || (level === 'ok' ? 'Cloud: Aktif' : level === 'error' ? 'Cloud: Error' : 'Cloud: Lokal');
}

const valid = typeof config.apiKey === 'string' && config.apiKey.length > 16 &&
  typeof config.projectId === 'string' && typeof config.appId === 'string' &&
  /^[a-z\d_-]{3,64}$/i.test(config.workspaceId || '');

if (!valid) {
  statusMsg('Konfigurasi Firebase belum tersedia. Dashboard lokal tetap bisa digunakan.', 'error');
  els.loginBtn.disabled = true;
  els.form.addEventListener('submit', e => e.preventDefault());
} else {
  try {
    const SDK = '12.5.0';
    const [
      { initializeApp },
      { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut },
      { getFirestore, doc, collection, getDocFromServer, getDocsFromServer, onSnapshot, writeBatch, setDoc, runTransaction, serverTimestamp }
    ] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${SDK}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${SDK}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${SDK}/firebase-firestore.js`)
    ]);

    const app = initializeApp({
      apiKey: config.apiKey,
      authDomain: config.authDomain,
      projectId: config.projectId,
      appId: config.appId
    }, 'SalesPulseArea12');
    const auth = getAuth(app);
    const db = getFirestore(app);
    const wid = config.workspaceId;
    const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])) : value;
    const norm = value => JSON.stringify(canonical(value));
    const same = (x, y) => norm(x) === norm(y);
    const idKey = value => encodeURIComponent(String(value));

    function pack(model) {
      const records = new Map();
      // V11: Pengaturan tampilan disimpan sebagai 1 dokumen independen; jangan ikut batch 865 PLU.
      for (const [week, weekData] of Object.entries(model.weeks || {})) {
        for (const store of Object.values(weekData.stores || {})) {
          const base = idKey(week) + '_' + idKey(store.code);
          records.set('st_' + base, {
            type: 'store', week, code: store.code, name: store.name,
            targetQty: Number(store.targetQty) || 0,
            targetNS: Number(store.targetNS) || 0,
            brandTargets: store.brandTargets || {},
            // Jangan tulis field kosong pada store lama; mencegah konflik sinkronisasi saat upgrade V14 -> V15.
            ...(store.reportedDays && Object.keys(store.reportedDays).length ? {reportedDays:store.reportedDays} : {})
          });
          for (const item of store.items || []) {
            if (!item.id) continue;
            records.set('it_' + base + '_' + idKey(item.id), {
              type: 'item', week, code: store.code, id: item.id, plu: item.plu,
              brand: item.brand || '', description: item.description || '',
              hpp: Number(item.hpp) || 0,
              days: Array.from({ length: 7 }, (_, i) => Number(item.days?.[i]) || 0)
            });
          }
        }
      }
      return records;
    }

    let unsub = null;
    let ready = false;
    let editing = false;
    let first = false;
    let remote = new Map();
    let baseline = new Map();
    let queued = new Map();
    let inflight = new Map();
    let flushTimer = null;
    let busy = false;
    let retryTimer = null;
    let connectionVersion = 0;
    let uiUnsub=null;
    let uiTimer=null;
    let uiWaitTimer=null;
    let uiSaving=false;
    let uiMemberReady=false;
    let lastCloudUI=null;
    let lastUIError='';
    const uiConfigRef=doc(db,'workspaces',wid,'records','area_config');
    function uiMessage(message,state='pending'){
      for(const id of ['sharedUIStatus','cloudUIStatus']){
        const box=document.getElementById(id);if(!box)continue;
        box.textContent=message;box.dataset.state=state;
      }
    }
    function planUISync(delay=850){
      clearTimeout(uiTimer);uiTimer=null;
      const pending=window.AreaApp.getPendingSharedUI();
      if(!pending)return;
      if(!navigator.onLine){uiMessage('📴 Pengaturan tersimpan di HP ini, menunggu internet. Jangan hapus data aplikasi.');return}
      if(!uiMemberReady){uiMessage('💾 Pengaturan tersimpan di HP ini. Menunggu login dan izin workspace Firebase.');return}
      if(uiSaving){uiMessage('⏳ Menunggu konfirmasi perubahan tampilan sebelumnya dari Firebase.');return}
      uiMessage('⏳ Mengirim pengaturan tampilan ke semua HP… (1 dokumen, terpisah dari data PLU)');
      uiTimer=setTimeout(sendUI,delay);
    }
    async function sendUI(){
      uiTimer=null;
      const pending=window.AreaApp.getPendingSharedUI();
      if(!pending || uiSaving || !uiMemberReady || !navigator.onLine)return;
      const version=connectionVersion;
      uiSaving=true;
      const revision=pending.revision;
      uiMessage('⏳ Menyimpan pengaturan tampilan ke Firebase… menunggu konfirmasi server.');
      const startedAt=Date.now();clearInterval(uiWaitTimer);
      uiWaitTimer=setInterval(()=>{
        if(version===connectionVersion&&uiSaving&&Date.now()-startedAt>=15000){
          uiMessage('⌛ Firebase belum mengonfirmasi pengaturan selama '+Math.round((Date.now()-startedAt)/1000)+' detik. Data tampilan masih aman di HP. Periksa internet/izin Firebase.');
        }
      },5000);
      try{
        await setDoc(uiConfigRef,{
          type:'area-config', theme:pending.theme, settings:pending.settings,
          revision, editedBy:auth.currentUser?.uid||'',updatedAt:serverTimestamp()
        });
        if(version!==connectionVersion)return;
        window.AreaApp.confirmSharedUI(revision);
        lastUIError='';
        if(window.AreaApp.getPendingSharedUI()){
          uiMessage('🔄 Perubahan berikutnya sedang disiapkan…');
        }else{
          uiMessage('✅ Tersimpan di Firebase. Tampilan semua HP terhubung akan mengikuti pengaturan ini.','saved');
        }
      }catch(err){
        if(version!==connectionVersion)return;
        lastUIError=String(err.code||err.message||err);
        uiMessage('❌ Pengaturan belum tersimpan ke cloud: '+lastUIError+'. Pengaturan tetap aman di HP ini; cek izin Firestore dan koneksi.','error');
      }finally{
        clearInterval(uiWaitTimer);uiWaitTimer=null;
        if(version===connectionVersion){
          uiSaving=false;
          if(window.AreaApp.getPendingSharedUI() && !lastUIError)planUISync(400);
        }
      }
    }
    function watchUI(version){
      uiUnsub=onSnapshot(uiConfigRef,{includeMetadataChanges:true},snap=>{
        if(version!==connectionVersion)return;
        if(snap.metadata.fromCache){
          if(window.AreaApp.getPendingSharedUI())planUISync();
          else uiMessage('⏳ Mengambil pengaturan tampilan dari server…');
          return;
        }
        if(snap.metadata.hasPendingWrites)return; // Jangan terapkan echo local sebelum commit.
        const data=snap.exists()?snap.data():null;
        lastCloudUI=data?.settings?data:null;
        if(window.AreaApp.getPendingSharedUI()){
          // Lokal punya perubahan yang belum terkonfirmasi; jangan overwrite setelah refresh.
          planUISync();
        }else if(lastCloudUI?.revision){
          // Hanya terima konfigurasi V11 yang telah dikonfirmasi. Dokumen V8/V10 bisa stale.
          window.AreaApp.applySharedUI({theme:lastCloudUI.theme,settings:lastCloudUI.settings});
          uiMessage('✅ Tampilan mengikuti pengaturan area di Firebase (sinkron semua HP).','saved');
        }else if(lastCloudUI){
          uiMessage('⚠️ Cloud masih menyimpan konfigurasi versi lama. Setelan HP ini dipertahankan agar tidak kembali ke default. Tekan tombol “Jadikan tampilan HP ini untuk semua HP” untuk mengaktifkan sinkronisasi V11.');
        }else{
          uiMessage('☁ Belum ada tampilan bersama. Pilih pengaturan lalu tekan “Jadikan tampilan HP ini untuk semua HP”.');
        }
      },err=>uiMessage('❌ Gagal membaca pengaturan Firebase: '+String(err.code||err.message||err)+'. Pengaturan lokal tidak diubah.','error'));
    }
    window.addEventListener('area:ui-changed',()=>planUISync());

    // Batch awal kecil agar progres pertama terlihat lebih cepat di jaringan seluler.
    // Batch selanjutnya lebih besar agar unggahan ratusan PLU tidak memerlukan
    // terlalu banyak round-trip. Angka tetap dihitung setelah commit dikonfirmasi.
    const FIRST_CHUNK_SIZE = 25;
    const CHUNK_SIZE = 160;
    const SLOW_BATCH_MS = 20000;
    let batchStartedAt = 0;
    let waitTimer = null;
    let syncProgress = { active: false, complete: false, confirmed: 0, mode: 'auto', error: false };
    let syncBlocked = false;
    let stopRetry = false;
    let conflictCanResume = false;
    let conflictMissingKeys = [];
    const conflictBox = $('#cloudConflict');
    const conflictText = $('#cloudConflictText');
    const exportLocal = $('#cloudExportLocal');
    const exportRemote = $('#cloudExportRemote');
    const resumeSafe = $('#cloudResumeSafe');
    const restoreQty = $('#cloudRestoreQty');
    const repairMessage = $('#cloudRepairMessage');
    let repairing = false;
    function calculateConflict(localPack, cloudPack) {
      const missingLocal = [...localPack.keys()].filter(k => !cloudPack.has(k));
      const extraRemote = [...cloudPack.keys()].filter(k => !localPack.has(k));
      const changed = [...localPack].filter(([k, v]) => cloudPack.has(k) && norm(v) !== norm(cloudPack.get(k))).map(([k]) => k);
      return { missingLocal, extraRemote, changed, differs:missingLocal.length>0 || extraRemote.length>0 || changed.length>0 };
    }
    // Pemulihan terbatas: hanya perbedaan QTY ketika cloud=0, lokal>0.
    // Semua field selain days wajib identik; tidak ada dokumen yang hilang/tambahan.
    // Data 0 yang sengaja dikoreksi oleh toko lain tidak dapat dibedakan dari nilai
    // yang belum terkirim, karena itu pemulihan SELALU memerlukan izin eksplisit.
    function zeroFillPlan(localPack, cloudPack) {
      const c=calculateConflict(localPack,cloudPack);
      if(c.missingLocal.length||c.extraRemote.length||!c.changed.length)return null;
      const changes=[];let qty=0;
      for(const id of c.changed){
        const local=localPack.get(id),server=cloudPack.get(id);
        if(local?.type!=='item'||server?.type!=='item')return null;
        const {days:ld,...localMetadata}=local;
        const {days:sd,...serverMetadata}=server;
        if(!same(localMetadata,serverMetadata))return null;
        if(!Array.isArray(ld)||!Array.isArray(sd)||ld.length!==7||sd.length!==7)return null;
        const days=[];
        for(let i=0;i<7;i++){
          const l=ld[i],s=sd[i];
          if(!Number.isFinite(l)||!Number.isFinite(s)||l<0||s<0)return null;
          if(s===l)continue;
          if(!(s===0&&l>0))return null;
          days.push(i);qty+=l;
        }
        if(!days.length)return null;
        changes.push({id,local,server,days});
      }
      // Batas konservatif satu transaksi; kasus lebih besar harus ditinjau terpisah.
      if(changes.length>200)return null;
      return {changes,qty};
    }
    function showRepairOption(localPack, cloudPack){
      const plan=zeroFillPlan(localPack,cloudPack);
      restoreQty.hidden=!plan||repairing;
      if(repairMessage){
        repairMessage.hidden=!plan;
        if(plan)repairMessage.textContent=`✅ Kandidat pemulihan aman ditemukan: ${plan.changes.length} PLU dengan total ${plan.qty} QTY yang ada di HP tetapi bernilai 0 di cloud. HANYA kolom QTY kosong di cloud yang akan dilengkapi. Backup kedua data, pastikan QTY HP benar, dan jangan input dari HP lain selama proses. Tidak otomatis dijalankan.`;
      }
      return plan;
    }
    function dataCounts(model){let stores=0,items=0;for(const week of Object.values(model.weeks||{})){for(const store of Object.values(week.stores||{})){stores++;items+=(store.items||[]).length}}return {stores,items}}
    function blockSync(localPack, cloudPack, label='Cloud dan perangkat berbeda'){
      const c=calculateConflict(localPack,cloudPack);
      editing=false;syncBlocked=true;
      conflictMissingKeys=c.missingLocal;
      conflictCanResume=c.missingLocal.length>0 && c.extraRemote.length===0 && c.changed.length===0;
      conflictBox.hidden=false;
      resumeSafe.hidden=!conflictCanResume;
      const plan=showRepairOption(localPack,cloudPack);
      const counts=dataCounts(window.AreaApp.getData());
      conflictText.textContent=`${label}. Perangkat: ${counts.stores} toko, ${counts.items} PLU (${localPack.size} dokumen). Cloud: ${cloudPack.size} dokumen. Selisih lokal belum di cloud: ${c.missingLocal.length}; dokumen tambahan cloud: ${c.extraRemote.length}; berbeda: ${c.changed.length}. Tidak ada data ditimpa. Unduh backup sebelum memilih tindakan.`;
      statusMsg('🛑 Sinkronisasi DITAHAN demi keamanan data. Lokal ≠ Cloud. Buka Pusat Pemulihan atau unduh backup.', 'error', 'Cloud: Aman');
    }
    function saveJson(name,value){const blob=new Blob([JSON.stringify(value,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000)}
    function cloudState(){const state=window.AreaApp.getState();if(lastCloudUI){state.settings=lastCloudUI.settings;state.theme=lastCloudUI.theme||state.theme}state.weeks={};for(const row of remote.values()){
      if(row.type==='area-config'){state.settings=row.settings||state.settings;continue}
      if(!row.week||!row.code)continue;
      const w=(state.weeks[row.week]||={stores:{}}),st=(w.stores[row.code]||={code:row.code,name:row.code,targetQty:0,targetNS:0,items:[]});
      if(row.type==='store'){Object.assign(st,{name:row.name||st.name,targetQty:Number(row.targetQty)||0,targetNS:Number(row.targetNS)||0,brandTargets:row.brandTargets||{},reportedDays:row.reportedDays||{}})}
      if(row.type==='item'){st.items.push({id:row.id,plu:row.plu,brand:row.brand,description:row.description,hpp:Number(row.hpp)||0,days:row.days||[0,0,0,0,0,0,0]})}
    }return state;}
    exportLocal.addEventListener('click',()=>window.AreaApp.downloadLocal());
    exportRemote.addEventListener('click',()=>saveJson('Backup_RpmArea_Cloud_'+new Date().toISOString().slice(0,10)+'.json',cloudState()));
    restoreQty.addEventListener('click',async()=>{
      if(!ready||!syncBlocked||repairing||!auth.currentUser||!navigator.onLine)return;
      const before=pack(window.AreaApp.getData()),plan=zeroFillPlan(before,remote);
      if(!plan){statusMsg('Pola perbedaan sudah berubah. Pemulihan otomatis DIBATALKAN; cek ulang backup.','error','Cloud: Aman');showRepairOption(before,remote);return;}
      const approved=confirm(`PEMULIHAN TERBATAS DARI HP KE CLOUD\n\n${plan.changes.length} PLU dan ${plan.qty} QTY akan dipulihkan dari HP ini ke kolom QTY yang saat ini masih 0 di Firebase.\n\nPastikan sudah klik BACKUP LOKAL dan BACKUP CLOUD, semua QTY di HP benar, serta tidak ada toko lain yang sedang mengubah data.\n\nFirestore akan mengecek ulang dokumen; apabila berubah atau ada konflik selain QTY 0, proses dibatalkan tanpa mengubah data. Lanjutkan?`);
      if(!approved)return;
      const version=connectionVersion;
      repairing=true;restoreQty.hidden=true;resumeSafe.hidden=true;
      statusMsg('🔐 Memeriksa ulang '+plan.changes.length+' dokumen di Firebase sebelum pemulihan…','warn','Cloud: Periksa');
      try{
        // Cadangan perangkat dibuat sebelum memperbolehkan data berubah; tidak pernah
        // menghapus dokumen cloud maupun nilai lain di selain kolom QTY yang nol.
        if(window.AreaSafety && !(await window.AreaSafety.beforeRemote()))throw Error('Backup keselamatan gagal. Tidak ada perubahan dikirim.');
        const latest=pack(window.AreaApp.getData());
        if(calculateConflict(before,latest).differs)throw Error('Data HP berubah saat pemulihan. Coba lagi setelah backup.');
        let updated=0;
        await runTransaction(db,async tx=>{
          updated=0; // Transaksi dapat diulang oleh Firestore jika ada dokumen berubah.
          const snapshots=[];
          // Firestore mengharuskan SEMUA pembacaan dilakukan sebelum menulis.
          for(const change of plan.changes){
            const ref=doc(db,'workspaces',wid,'records',change.id);
            const snap=await tx.get(ref);
            if(!snap.exists())throw Error('Dokumen cloud hilang: '+change.id);
            const live=strip(snap.data());
            // Cegah overwrite terhadap perubahan yang terjadi setelah layar konflik terbuka.
            if(!same(live,change.server))throw Error('Cloud berubah pada '+change.local.code+' / '+change.local.plu+'. Pemulihan dihentikan, periksa backup.');
            snapshots.push({ref,snap,change});
          }
          for(const {ref,snap,change} of snapshots){
            const live=snap.data();
            const merged=[...(live.days||[])];
            for(const day of change.days)merged[day]=change.local.days[day];
            tx.set(ref,{...live,days:merged,updatedAt:serverTimestamp(),editedBy:auth.currentUser.uid});
            updated++;
          }
        },{maxAttempts:3});
        if(version!==connectionVersion)return;
        statusMsg('✅ Firebase mengonfirmasi '+updated+' PLU. Memverifikasi semua data…','warn','Cloud: Verifikasi');
        const snap=await getDocsFromServer(collection(db,'workspaces',wid,'records'));
        if(version!==connectionVersion)return;
        remote=new Map(snap.docs.filter(d=>d.id!=='area_config').map(d=>[d.id,strip(d.data())]));
        const localPack=pack(window.AreaApp.getData());
        const check=calculateConflict(localPack,remote);
        if(check.differs){blockSync(localPack,remote,'Pemulihan dikonfirmasi, namun masih ada perbedaan baru');return;}
        syncBlocked=false;editing=true;stopRetry=false;first=true;
        baseline=new Map(localPack);
        conflictBox.hidden=true;restoreQty.hidden=true;
        await receive();
        statusMsg('✅ PEMULIHAN BERHASIL. '+updated+' PLU tersimpan dan '+remote.size+' dokumen data sekarang sama.','ok','Cloud: Aktif');
        window.AreaApp?.notify('✓ QTY berhasil dipulihkan ke Firebase. Simpan backup terbaru.');
      }catch(err){
        const message=String(err.code||err.message||err);
        statusMsg('⛔ Pemulihan dibatalkan: '+message+'. Tidak ada penghapusan data. Periksa backup; jika sebagian data sempat diubah, bandingkan ulang.','error','Cloud: Aman');
        // Jika transaksi gagal, Firestore tidak menerapkan sebagian isinya.
      }finally{
        repairing=false;
        if(version===connectionVersion){
          const current=pack(window.AreaApp.getData());
          if(syncBlocked)showRepairOption(current,remote);
        }
      }
    });

    resumeSafe.addEventListener('click',()=>{
      if(!ready||!syncBlocked||!conflictCanResume) return;
      if(!confirm(`Cloud hanya memiliki sebagian data (${remote.size} dokumen). Lanjutkan mengirim ${conflictMissingKeys.length} dokumen yang belum ada? Simpan BACKUP JSON lokal terlebih dahulu. Data cloud lainnya tidak dihapus.`))return;
      const localPack=pack(window.AreaApp.getData());
      const c=calculateConflict(localPack,remote);
      if(c.changed.length||c.extraRemote.length){blockSync(localPack,remote,'Ada perubahan baru selama menunggu');return}
      for(const id of c.missingLocal) queued.set(id,localPack.get(id));
      baseline=new Map(localPack);editing=true;syncBlocked=false;conflictBox.hidden=true;
      beginProgress('upload');schedule();
    });

    const strip = value => {
      const { updatedAt, editedBy, ...rest } = value || {};
      return rest;
    };

    const pendingCount = () => queued.size + inflight.size;

    function renderProgress() {
      if (!syncProgress.active && !syncProgress.complete) {
        els.progress.hidden = true;
        return;
      }
      const pending = pendingCount();
      const total = syncProgress.confirmed + pending;
      const done = syncProgress.complete && pending === 0;
      const percent = done ? 100 : total ? Math.floor(100 * syncProgress.confirmed / total) : 0;
      const paused = !navigator.onLine && pending > 0;
      const failed = syncProgress.error && pending > 0 && !paused;

      els.progress.hidden = false;
      els.progress.classList.toggle('is-complete', done);
      els.progress.classList.toggle('is-paused', paused);
      els.progress.classList.toggle('is-error', failed);
      els.progress.classList.toggle('is-saving', !done && !paused && !failed);
      els.progressPct.textContent = `${percent}%`;
      els.progressFill.style.width = `${percent}%`;
      els.progressTrack.setAttribute('aria-valuenow', String(percent));
      els.progressTrack.setAttribute('aria-valuetext',
        done ? 'Semua data tersimpan di cloud' : `${syncProgress.confirmed} dari ${total} data telah disimpan`);
      els.progressTitle.textContent = done ? 'Semua data berhasil disimpan' :
        paused ? 'Menunggu koneksi internet' :
        failed ? 'Penyimpanan tertunda' :
        syncProgress.mode === 'upload' ? 'Mengunggah data awal area' : 'Menyimpan perubahan area';
      els.progressCount.textContent = `${syncProgress.confirmed.toLocaleString('id-ID')} / ${total.toLocaleString('id-ID')} data berhasil`;
      const elapsed = busy && batchStartedAt ? Date.now() - batchStartedAt : 0;
      els.progressHint.textContent = done ? '✓ Dikonfirmasi Firestore' :
        paused ? `${pending.toLocaleString('id-ID')} data menunggu online` :
        failed ? 'Akan dicoba ulang otomatis; lihat pesan error di atas' :
        elapsed >= SLOW_BATCH_MS ? `⏳ Menunggu konfirmasi Firebase ${Math.floor(elapsed / 1000)} detik · cek koneksi/izin jika terus berhenti` :
        `Sisa ${pending.toLocaleString('id-ID')} data · menunggu konfirmasi server`;
    }

    function beginProgress(mode = 'auto') {
      if (!pendingCount()) return;
      if (!syncProgress.active) {
        syncProgress = { active: true, complete: false, confirmed: 0, mode, error: false };
      }
      renderProgress();
    }

    function completeProgressIfDone() {
      if (syncProgress.active && !pendingCount() && !busy) {
        syncProgress.active = false;
        syncProgress.complete = true;
        syncProgress.error = false;
      }
      renderProgress();
    }

    function overlay() {
      const records = new Map(remote);
      for (const [key, value] of inflight) {
        if (value === null) records.delete(key);
        else records.set(key, value);
      }
      for (const [key, value] of queued) {
        if (value === null) records.delete(key);
        else records.set(key, value);
      }
      return records;
    }

    async function receive() {
      // Jangan mengubah state saat ada data lokal yang belum selesai diunggah.
      if (pendingCount() || busy) return;
      const records = overlay();
      baseline = new Map(records);
      await window.AreaApp?.applyRemote([...records.values()]);
    }

    function disconnect() {
      ++connectionVersion;
      if (unsub) { unsub(); unsub = null; }
      if (uiUnsub) { uiUnsub(); uiUnsub = null; }
      clearTimeout(uiTimer);uiTimer=null;clearInterval(uiWaitTimer);uiWaitTimer=null;uiSaving=false;uiMemberReady=false;lastUIError='';
      clearTimeout(flushTimer);
      clearTimeout(retryTimer);
      clearInterval(waitTimer);
      waitTimer = null;
      batchStartedAt = 0;
      ready = false;
      editing = false;
      first = false;
      busy = false;
      remote.clear();
      baseline.clear();
      queued.clear();
      inflight.clear();
      syncProgress = { active: false, complete: false, confirmed: 0, mode: 'auto', error: false };
      syncBlocked = false;
      repairing = false;
      stopRetry = false;
      conflictCanResume = false;
      conflictMissingKeys = [];
      conflictBox.hidden = true;
      els.progress.hidden = true;
      els.upload.hidden = true;
      els.logged.hidden = true;
      els.form.hidden = false;
    }

    function displayStatus() {
      const pending = pendingCount();
      renderProgress();
      if (!navigator.onLine) {
        if (pending) {
          statusMsg(`📶 Offline · ${pending.toLocaleString('id-ID')} data menunggu koneksi.`, 'warn', 'Cloud: Offline');
        } else {
          statusMsg('📶 Offline. Perubahan lokal akan disinkronkan setelah online.', 'warn', 'Cloud: Offline');
        }
        return;
      }
      if (syncBlocked) {
        statusMsg('🛑 Sinkronisasi ditahan: data lokal dan cloud tidak sama. Unduh backup.', 'error', 'Cloud: Aman');
        return;
      }
      if (syncProgress.error && pending) {
        statusMsg(stopRetry ? '⛔ Penyimpanan ditolak Firebase. Periksa aturan akses Firestore; data masih ada di perangkat.' : `⚠️ ${pending.toLocaleString('id-ID')} data belum tersimpan. Mencoba lagi otomatis…`, 'error');
        return;
      }
      if (pending || busy) {
        const total = syncProgress.confirmed + pending;
        const percent = total ? Math.floor(syncProgress.confirmed / total * 100) : 0;
        const elapsed = busy && batchStartedAt ? Date.now() - batchStartedAt : 0;
        const waitNote = elapsed >= SLOW_BATCH_MS ? ` · Firebase belum merespons ${Math.floor(elapsed / 1000)} detik` : '';
        statusMsg(`⏳ Menyimpan perubahan ke cloud… ${percent}% (${syncProgress.confirmed}/${total} data)${waitNote}.`, 'warn', `Cloud: ${percent}%`);
        return;
      }
      statusMsg('✅ Cloud aktif · semua perubahan sudah tersimpan dan tersedia untuk anggota area.', 'ok');
    }

    function schedule() {
      if (!ready || !editing || syncBlocked || stopRetry) return;
      if (pendingCount()) beginProgress();
      clearTimeout(flushTimer);
      if (navigator.onLine && queued.size) {
        flushTimer = setTimeout(flush, 450);
      }
      displayStatus();
    }

    async function flush() {
      if (!ready || !editing || syncBlocked || stopRetry || busy || !queued.size || !navigator.onLine) {
        displayStatus();
        return;
      }
      const version = connectionVersion;
      busy = true;
      // Unggahan pertama mengirim 25 dokumen dahulu, sisanya per 160 dokumen.
      // Ini mengurangi waktu menunggu tampilan 0% saat koneksi cukup lambat.
      const limit = syncProgress.confirmed === 0 ? FIRST_CHUNK_SIZE : CHUNK_SIZE;
      const items = [...queued.entries()].slice(0, limit);
      for (const [key, value] of items) {
        queued.delete(key);
        inflight.set(key, value);
      }
      beginProgress();
      displayStatus();

      batchStartedAt = Date.now();
      clearInterval(waitTimer);
      waitTimer = setInterval(() => {
        if (version !== connectionVersion || !busy) return;
        // Tidak menebak persentase: hanya memperbarui waktu tunggu dan status.
        if (Date.now() - batchStartedAt >= SLOW_BATCH_MS) displayStatus();
      }, 2500);

      const batch = writeBatch(db);
      for (const [id, value] of items) {
        const ref = doc(db, 'workspaces', wid, 'records', id);
        if (value === null) batch.delete(ref);
        else batch.set(ref, { ...value, updatedAt: serverTimestamp(), editedBy: auth.currentUser?.uid || '' });
      }

      try {
        await batch.commit();
        if (version !== connectionVersion) return;
        clearInterval(waitTimer);
        waitTimer = null;
        batchStartedAt = 0;
        // Firestore sudah mengonfirmasi commit batch ini (bukan sekadar antrean lokal).
        for (const [id] of items) inflight.delete(id);
        syncProgress.confirmed += items.length;
        syncProgress.error = false;
        busy = false;
        if (queued.size) {
          // Tampilkan status antar batch sebelum meneruskan pengiriman.
          displayStatus();
          schedule();
        } else {
          completeProgressIfDone();
          displayStatus();
        }
      } catch (err) {
        if (version !== connectionVersion) return;
        clearInterval(waitTimer);
        waitTimer = null;
        batchStartedAt = 0;
        for (const [id, value] of items) {
          inflight.delete(id);
          if (!queued.has(id)) queued.set(id, value);
        }
        busy = false;
        syncProgress.error = true;
        displayStatus();
        const errCode=err.code || err.message || 'periksa Firestore Rules';
        stopRetry = /permission-denied|unauthenticated|failed-precondition|invalid-argument/i.test(String(errCode));
        statusMsg('Gagal menyimpan: ' + errCode + (stopRetry ? '. Firebase menolak operasi; retry otomatis dihentikan. BACKUP JSON lokal dan periksa izin Firestore.' : '. Data tersimpan lokal dan akan dicoba ulang.'), 'error');
        clearTimeout(retryTimer);
        if(!stopRetry) retryTimer = setTimeout(schedule, 8000);
      }
    }

    window.addEventListener('online', () => { schedule(); displayStatus(); planUISync(); });
    window.addEventListener('offline', () => { if (ready) displayStatus(); if(window.AreaApp.getPendingSharedUI())uiMessage('📴 Tampilan tersimpan di HP. Akan dikirim ketika online.'); });

    window.addEventListener('area:changed', event => {
      if (!ready || !editing) return;
      const fresh = pack(event.detail || {});
      for (const [key, value] of fresh) {
        if (!same(value, baseline.get(key))) queued.set(key, value);
      }
      for (const key of baseline.keys()) {
        if (!fresh.has(key)) queued.set(key, null);
      }
      baseline = new Map(fresh);
      schedule();
    });

    async function start(user) {
      disconnect();
      const version = connectionVersion;
      els.logged.hidden = false;
      els.form.hidden = true;
      els.user.textContent = '👤 ' + (user.email || 'Pengguna') + ' · Area: ' + wid;
      statusMsg('Memeriksa keanggotaan area…');
      try {
        const member = await getDocFromServer(doc(db, 'workspaces', wid, 'members', user.uid));
        if (version !== connectionVersion) return;
        if (!member.exists()) {
          statusMsg('Akun login berhasil tetapi BELUM menjadi anggota workspace area. Admin: buat workspaces/' + wid + '/members/' + user.uid + ' (role: editor).', 'error');
          return;
        }
        uiMemberReady=true;
        watchUI(version);
        if(window.AreaApp.getPendingSharedUI())planUISync(500);
        statusMsg('⏳ Mengambil data terbaru dari Firestore…');
        unsub = onSnapshot(collection(db, 'workspaces', wid, 'records'), { includeMetadataChanges: true }, async snap => {
          if (version !== connectionVersion || repairing) return;
          if (!first && snap.metadata.fromCache) {
            statusMsg('⏳ Menunggu jawaban dari server…');
            return;
          }
          if (first && !snap.docChanges({ includeMetadataChanges: false }).some(c=>c.doc.id!=='area_config')) {
            // Perubahan tema/teks tidak perlu membaca ulang ratusan data penjualan.
            displayStatus();
            return;
          }
          remote = new Map(snap.docs.filter(record=>record.id!=='area_config').map(record => [record.id, strip(record.data())]));
          const localPack=pack(window.AreaApp.getData());
          if (!first) {
            first = true;ready = true;
            if(remote.size === 0 && localPack.size>0){
              editing=false;els.upload.hidden=false;
              statusMsg('Cloud area masih kosong. Backup JSON dahulu, lalu unggah dari satu perangkat saja.');
              return;
            }
            if(remote.size>0 && localPack.size>0){
              if(calculateConflict(localPack,remote).differs){blockSync(localPack,remote,'Data awal berbeda');return;}
            }
            editing=true;els.upload.hidden=true;
          } else if (syncBlocked) {
            const conflict=calculateConflict(localPack,remote);
            if(conflict.differs){blockSync(localPack,remote,'Data cloud berubah saat sinkronisasi ditahan');return;}
            // Jika semua dokumen sudah identik (contohnya sesudah pemulihan pada
            // perangkat lain), jangan biarkan mode aman terkunci selamanya.
            syncBlocked=false;editing=true;stopRetry=false;
            baseline=new Map(localPack);conflictBox.hidden=true;
          }
          if (editing) {
            if(pendingCount() || busy) {displayStatus();return;}
            // Server tidak boleh diam-diam menghapus atau menimpa data lokal.
            const c=calculateConflict(localPack,remote);
            if(localPack.size>1 && (c.missingLocal.length>0 || c.changed.length>0)){
              // Data dari cloud mungkin pembaruan sah dari pengguna lain. Tetap harus ada cadangan.
              // Bila cloud lebih kecil dari lokal, hentikan agar unggahan parsial tidak menghapus data.
              if(remote.size<localPack.size){blockSync(localPack,remote,'Cloud berisi lebih sedikit data daripada perangkat');return;}
            }
            try {await receive();displayStatus()}
            catch(err){editing=false;syncBlocked=true;conflictBox.hidden=false;conflictText.textContent='Gagal membuat backup sebelum menerapkan cloud: '+err.message+'. Data lokal TIDAK diubah.';statusMsg('Cloud ditahan: cadangan data lokal gagal dibuat.', 'error')}
          }
        }, err => statusMsg('Cloud gagal dibaca: ' + (err.code || err.message), 'error'));
      } catch (err) {
        if (version === connectionVersion) statusMsg('Keanggotaan gagal diverifikasi: ' + (err.code || err.message), 'error');
      }
    }

    els.upload.addEventListener('click', () => {
      if (!ready || editing || remote.size > 0) return;
      if (!confirm('PENTING: Unggah semua minggu/toko/PLU dari HP ini ke cloud area yang masih kosong? Pastikan Anda sudah BACKUP JSON dan HP lain belum mengunggah.')) return;
      editing = true;
      els.upload.hidden = true;
      const fresh = pack(window.AreaApp.getData());
      for (const [key, value] of fresh) queued.set(key, value);
      baseline = new Map(fresh);
      beginProgress('upload');
      schedule();
    });

    els.form.addEventListener('submit', async e => {
      e.preventDefault();
      els.loginBtn.disabled = true;
      statusMsg('⏳ Login ke Firebase…');
      try {
        await signInWithEmailAndPassword(auth, els.email.value.trim(), els.password.value);
        els.password.value = '';
      } catch (err) {
        statusMsg('Login gagal: ' + (err.code || err.message), 'error');
      } finally {
        els.loginBtn.disabled = false;
      }
    });

    els.logout.addEventListener('click', async () => {
      if (pendingCount() || busy || repairing || window.AreaApp.getPendingSharedUI() || uiSaving) {
        alert('Masih ada data atau pengaturan tampilan yang belum terkirim. Jangan keluar akun dahulu.');
        return;
      }
      await signOut(auth);
    });

    onAuthStateChanged(auth, user => {
      if (user) start(user);
      else {
        disconnect();
        statusMsg('🔒 Belum login · data tersimpan lokal pada perangkat ini.');
        if(window.AreaApp.getPendingSharedUI())uiMessage('💾 Perubahan tampilan aman di HP ini; login agar berlaku di semua HP.');
        else uiMessage('☁ Login Firebase untuk menyamakan tema, tulisan, dan bagian yang disembunyikan.');
      }
    });
  } catch (err) {
    statusMsg('Modul Firebase tidak bisa dimuat: ' + err.message, 'error');
    els.loginBtn.disabled = true;
  }
}
