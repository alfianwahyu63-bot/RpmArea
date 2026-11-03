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
      { getFirestore, doc, collection, getDocFromServer, onSnapshot, writeBatch, serverTimestamp }
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
    const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
    const idKey = value => encodeURIComponent(String(value));

    function pack(model) {
      const records = new Map();
      records.set('area_config', { type: 'area-config', settings: model.settings });
      for (const [week, weekData] of Object.entries(model.weeks || {})) {
        for (const store of Object.values(weekData.stores || {})) {
          const base = idKey(week) + '_' + idKey(store.code);
          records.set('st_' + base, {
            type: 'store', week, code: store.code, name: store.name,
            targetQty: Number(store.targetQty) || 0,
            targetNS: Number(store.targetNS) || 0,
            brandTargets: store.brandTargets || {}
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

    // Batch awal kecil agar progres pertama terlihat lebih cepat di jaringan seluler.
    // Batch selanjutnya lebih besar agar unggahan ratusan PLU tidak memerlukan
    // terlalu banyak round-trip. Angka tetap dihitung setelah commit dikonfirmasi.
    const FIRST_CHUNK_SIZE = 25;
    const CHUNK_SIZE = 160;
    const SLOW_BATCH_MS = 20000;
    let batchStartedAt = 0;
    let waitTimer = null;
    let syncProgress = { active: false, complete: false, confirmed: 0, mode: 'auto', error: false };

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

    function receive() {
      const records = overlay();
      baseline = new Map(records);
      window.AreaApp?.applyRemote([...records.values()]);
    }

    function disconnect() {
      ++connectionVersion;
      if (unsub) { unsub(); unsub = null; }
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
      if (syncProgress.error && pending) {
        statusMsg(`⚠️ ${pending.toLocaleString('id-ID')} data belum tersimpan. Mencoba lagi otomatis…`, 'error');
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
      if (!ready || !editing) return;
      if (pendingCount()) beginProgress();
      clearTimeout(flushTimer);
      if (navigator.onLine && queued.size) {
        flushTimer = setTimeout(flush, 450);
      }
      displayStatus();
    }

    async function flush() {
      if (!ready || !editing || busy || !queued.size || !navigator.onLine) {
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
        statusMsg('Gagal menyimpan: ' + (err.code || err.message || 'periksa Firestore Rules') + '. Data masih menunggu untuk dicoba ulang.', 'error');
        clearTimeout(retryTimer);
        retryTimer = setTimeout(schedule, 8000);
      }
    }

    window.addEventListener('online', () => { schedule(); displayStatus(); });
    window.addEventListener('offline', () => { if (ready) displayStatus(); });

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
        statusMsg('⏳ Mengambil data terbaru dari Firestore…');
        unsub = onSnapshot(collection(db, 'workspaces', wid, 'records'), { includeMetadataChanges: true }, snap => {
          if (version !== connectionVersion) return;
          if (!first && snap.metadata.fromCache) {
            statusMsg('⏳ Menunggu jawaban dari server…');
            return;
          }
          // SDK dapat mengirim event hanya untuk metadata cache/write pending.
          // Hindari rebuild dashboard ratusan PLU jika tidak ada data yang berubah.
          if (first && typeof snap.docChanges === 'function' &&
              !snap.docChanges({ includeMetadataChanges: false }).length) {
            displayStatus();
            return;
          }
          remote = new Map(snap.docs.map(record => [record.id, strip(record.data())]));
          if (!first) {
            first = true;
            ready = true;
            const local = window.AreaApp.getData();
            const hasLocal = Object.values(local.weeks || {}).some(week => Object.keys(week.stores || {}).length > 0);
            if (remote.size <= 1 && hasLocal) {
              editing = false;
              els.upload.hidden = false;
              statusMsg('Cloud area masih kosong. Backup JSON dulu, lalu klik “Unggah data lokal ke area” hanya dari SATU HP.');
              return;
            }
            editing = true;
            els.upload.hidden = true;
            receive();
            displayStatus();
          } else if (editing) {
            receive();
            displayStatus();
          }
        }, err => statusMsg('Cloud gagal dibaca: ' + (err.code || err.message), 'error'));
      } catch (err) {
        if (version === connectionVersion) statusMsg('Keanggotaan gagal diverifikasi: ' + (err.code || err.message), 'error');
      }
    }

    els.upload.addEventListener('click', () => {
      if (!ready || editing || remote.size > 1) return;
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
      if (pendingCount() || busy) {
        alert('Masih ada data yang belum terkirim. Jangan keluar akun dahulu.');
        return;
      }
      await signOut(auth);
    });

    onAuthStateChanged(auth, user => {
      if (user) start(user);
      else {
        disconnect();
        statusMsg('🔒 Belum login · data tersimpan lokal pada perangkat ini.');
      }
    });
  } catch (err) {
    statusMsg('Modul Firebase tidak bisa dimuat: ' + err.message, 'error');
    els.loginBtn.disabled = true;
  }
}
