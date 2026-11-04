/* SalesPulse Area 12 Toko — terpisah dari aplikasi RPM per-brand. */
(()=>{'use strict';
const KEY='salespulse_area12_v1';const UI_PENDING_KEY='rpmarea_shared_ui_pending_v11_'+(window.RPM_AREA_SUPABASE?.workspaceId||'rpm-area-12');const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const dayNames=['Sen','Sel','Rab','Kam','Jum','Sab','Min'];const longMonths=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const defaults={appName:'SalesPulse Area',title:'Monitoring Penjualan 12 Toko',description:'Pantau pencapaian POINT setiap toko dibandingkan Time Factor mingguan.',area:'Area RPM'};
const themes={neon:['Neon Lime','#a3fa64','#3dd5b3'],violet:['Electric Violet','#a679ff','#e472e5'],coral:['Coral Night','#ff806e','#ffb46a'],cyber:['Cyber Blue','#58b7ff','#55e4e8'],aurora:['Aurora','#7652e7','#11b9ca'],midnight:['Midnight','#7361ff','#152544'],ocean:['Ocean','#147ab6','#0fc5ac'],sunset:['Sunset','#eb7559','#f5ba60'],forest:['Forest','#168569','#b3ce59']};
const escapeHTML=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>'Rp '+(Number(n)||0).toLocaleString('id-ID',{maximumFractionDigits:0});const fmt=n=>(Number(n)||0).toLocaleString('id-ID',{maximumFractionDigits:2});const pct=n=>n===null||!Number.isFinite(n)?'—':(Number(n)).toLocaleString('id-ID',{minimumFractionDigits:1,maximumFractionDigits:1})+'%';
const number=n=>{let x=Number(n);return Number.isFinite(x)&&x>=0?x:0};const newid=()=>crypto.randomUUID?.()||('id'+Date.now().toString(36)+Math.random().toString(36).slice(2,9));
const today=()=>{const n=new Date();return dateISO(n)};function dateISO(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}const pdate=s=>new Date(String(s)+'T12:00:00');function addDays(s,delta){const d=pdate(s);d.setDate(d.getDate()+delta);return dateISO(d)}
const monthOf=s=>s.slice(0,7);function monday(s){const d=pdate(s),dow=(d.getDay()+6)%7;d.setDate(d.getDate()-dow);return dateISO(d)}
function monthWeeks(ym){if(!/^\d{4}-\d{2}$/.test(ym))return[];const first=ym+'-01';let wk=monday(first);const out=[];for(let i=0;i<6;i++){if(wk.slice(0,7)>ym)break;const after=addDays(wk,6);if(after.slice(0,7)>=ym)out.push(wk);wk=addDays(wk,7)}return out}
const dateMini=s=>{const d=pdate(s);return d.getDate()+' '+longMonths[d.getMonth()].slice(0,3)};const weekTitle=w=>dateMini(w)+' – '+dateMini(addDays(w,6));
function weekTF(w,asOfDate=today()){const td=asOfDate;if(td<w)return 0;const d7=addDays(w,6);if(td>d7)return 7;return Math.max(0,Math.min(7,Math.round((pdate(td)-pdate(w))/86400000)+1))}
function defaultState(){const now=today();return {version:1,month:monthOf(now),week:monday(now),page:'dashboard',theme:'neon',settings:{...defaults},weeks:{},inputStore:'',search:'',inputSort:'brand-asc',inputFilter:'',resumeStyle:'classic',reportWatchDate:'',reportManualDate:false,reportFilter:'all'}}
let S=defaultState();let cloudApplying=false;let hasData=false;
try{const raw=JSON.parse(localStorage.getItem(KEY)||'null');if(raw&&raw.weeks&&typeof raw.weeks==='object'){S={...S,...raw,settings:{...defaults,...raw.settings},weeks:raw.weeks};hasData=true}}catch(e){console.warn('Data lokal rusak:',e)}
if(!monthWeeks(S.month).includes(S.week))S.week=monthWeeks(S.month)[0]||monday(today());if(!themes[S.theme])S.theme='neon';if(!['dashboard','input','stores','history','settings'].includes(S.page))S.page='dashboard';

/* Personalization v7: these definitions are the single source for every editable dashboard label.
   Sales metrics, Excel import and stored quantities are deliberately never changed by presentation edits. */
const copyGroups=[
 ['Identitas & Navigasi',[
  ['appName','Nama aplikasi','SalesPulse Area','#sideBrand'],
  ['sideSubtitle','Keterangan logo','MONITORING 12 TOKO','#sideSubtitle'],
  ['saveStateLabel','Label status tersimpan','Data tersimpan lokal','#saveState'],
  ['sidebarFootnote','Teks info di sidebar','POINT = 50% QTY + 50% NS • Week: Senin—Minggu','#sidebarFootnote'],
  ['eyebrow','Label kecil header','AREA PERFORMANCE • LIVE MONITORING','#eyebrow'],
  ['title','Judul utama','Monitoring Penjualan 12 Toko','#mainTitle'],
  ['description','Deskripsi utama','Pantau pencapaian POINT setiap toko dibandingkan Time Factor mingguan.','#mainDescription'],
  ['periodLabel','Judul filter periode','PERIODE LAPORAN','#periodLabel'],
  ['weekLabel','Judul filter minggu','PILIH MINGGU · SENIN—MINGGU','#weekLabel'],
  ['weekName','Kata awal tombol minggu','Minggu'],
  ['navDashboard','Menu Dashboard','Dashboard Area'],['navInput','Menu Input','Input 7 Hari'],
  ['navStores','Menu Master Toko','Master Toko & Excel'],['navHistory','Menu Riwayat','Riwayat Bulanan'],
  ['navSettings','Menu Pengaturan','Pengaturan'],['settingsShortcut','Tombol pengaturan','Pengaturan','#settingsShortcut span']
 ]],
 ['Headline & Time Factor',[
  ['heroKicker','Label kecil hero','◉ WEEKLY AREA SCORECARD','#heroKicker'],
  ['heroTitleLine','Judul hero awal','Performa area,','#heroTitleLine'],
  ['heroHighlight','Judul hero sorotan','12 toko dalam satu layar.','#heroHighlight'],
  ['heroDescription','Deskripsi hero','Achievement QTY dan Net Sales masing-masing berbobot 50%. Status ditentukan dari total POINT dibandingkan Time Factor hari berjalan.','#heroDescription'],
  ['timeFactorLabel','Label Time Factor','TIME FACTOR','#timeFactorLabel'],
  ['dayUnit','Satuan jumlah hari','HARI']
 ]],
 ['Empat Kartu KPI',[
  ['kpiStores','Kartu jumlah toko','Total Toko Terdata'],['kpiStoresHint','Keterangan jumlah toko','Toko yang memiliki target minggu ini'],
  ['kpiArea','Kartu POINT area','Total POINT Area'],['kpiAreaHint','Keterangan POINT','Bobot: QTY 50% + NS 50%'],
  ['kpiAbove','Kartu di atas TF','DIATAS TF'],['kpiAboveHint','Keterangan di atas TF','Melebihi TF'],
  ['kpiBelow','Kartu di bawah TF','DIBAWAH TF'],['kpiBelowHint','Keterangan di bawah TF','Belum mencapai TF'],
  ['storeUnit','Satuan jumlah toko','Toko']
 ]],
 ['Pemantauan Input Harian',[
  ['dailyTitle','Judul pemantauan laporan','📋 Status Input Harian','#dailyReportTitle'],
  ['dailySubtitle','Keterangan status input','Toko yang sudah dan belum memasukkan penjualan pada tanggal terpilih.','#dailyReportSubtitle'],
  ['dailyDone','Label sudah input','Sudah Input'],
  ['dailyPending','Label belum input','Belum Input'],
  ['dailyAll','Label filter semua toko','Semua Toko']
 ]],
 ['Tabel Resume per Brand',[
  ['resumeTitle','Judul resume','📊 Resume RPM per Brand · 12 Toko','#resumeTitle'],
  ['resumeDescription','Keterangan resume','POINT per brand, status terhadap TF, rata-rata POINT dan pencapaian area berbobot target gabungan.','#resumeDescription'],
  ['resumeExport','Tombol export PNG','🖼️ Buat Gambar PNG','#exportResumePng'],
  ['resumeNote','Catatan bawah resume','ACV AREA dihitung dari total aktual seluruh toko ÷ total target seluruh toko, bukan rata-rata persentase toko. Brand tanpa target QTY atau NS ditampilkan —.','#resumeNote'],
  ['resumeColCode','Kolom kode','KODE'],['resumeColStore','Kolom nama toko','NAMA TOKO'],
  ['resumeColPoint','Kolom POINT','POINT'],['resumeColStatus','Kolom keterangan','KET'],
  ['resumeColAcv','Kolom ACV item','ACV ITEM'],['resumeColAvg','Kolom rata-rata','AVG POINT'],
  ['resumeAreaLabel','Baris total area','ACV AREA'],
  ['statusAbove','Status di atas TF','DIATAS TF'],['statusBelow','Status di bawah TF','DIBAWAH TF'],
  ['statusEqual','Status sesuai TF','SESUAI TF'],['statusNoTarget','Status target belum diisi','TARGET BELUM DIISI'],['statusNotStarted','Status belum mulai','BELUM MULAI']
 ]],
 ['Grafik & Ring Area',[
  ['chartTitle','Judul grafik toko','POINT per Toko','#chartTitle'],
  ['chartDescription','Keterangan grafik toko','Perbandingan POINT 50/50 terhadap target Time Factor','#chartDescription'],
  ['areaTitle','Judul ring area','Pencapaian Area','#areaTitle'],
  ['areaDescription','Keterangan ring area','Agregat dari target 12 toko','#areaDescription'],
  ['ringLabel','Label tengah lingkaran','POINT AREA'],
  ['breakQty','Ringkasan QTY','Pencapaian QTY'],
  ['breakNS','Ringkasan Net Sales','Pencapaian NS'],
  ['breakTF','Ringkasan Time Factor','Time Factor'],
  ['breakActual','Ringkasan aktual NS','Actual NS Area']
 ]],
 ['Scorecard & Tabel Toko',[
  ['scoreTitle','Judul scorecard','Scorecard 12 Toko','#scoreTitle'],
  ['scoreDescription','Keterangan scorecard','Kode, nama toko, pencapaian QTY, NS, POINT dan keterangan Time Factor.','#scoreDescription'],
  ['scoreSearch','Placeholder pencarian','Cari kode / nama toko','#storeSearch'],
  ['scoreExport','Tombol export CSV','↓ Ekspor CSV','#exportScorecard'],
  ['colStoreCode','Kolom kode toko','KODE TOKO'],['colStoreName','Kolom nama toko','NAMA TOKO'],
  ['colTargetQty','Kolom target QTY','TARGET QTY'],['colTargetNS','Kolom target NS','TARGET NS'],
  ['colActualQty','Kolom aktual QTY','AKTUAL QTY'],['colActualNS','Kolom aktual NS','AKTUAL NS'],
  ['colAchQty','Kolom ACV QTY','ACV QTY'],['colAchNS','Kolom ACV NS','ACV NS'],
  ['colWeightQty','Kolom bobot QTY','BOBOT QTY 50%'],['colWeightNS','Kolom bobot NS','BOBOT NS 50%'],
  ['colPoint','Kolom POINT','POINT'],['colStatus','Kolom keterangan','KETERANGAN'],
  ['emptyStore','Pesan saat data kosong','Upload Excel kode & target toko untuk mengisi scorecard 12 toko.'],
  ['emptyChart','Pesan grafik kosong','Belum ada toko. Upload file Excel melalui Master Toko & Excel.']
 ]],
 ['Footer',[
  ['footerLeft','Footer kiri','SalesPulse Area · 12 Store · EXCEL HPP OTOMATIS v6.0','#footerLeft'],
  ['footerRight','Footer kanan','QTY 50% + NS 50% = POINT • TF Senin–Minggu','#footerRight']
 ]]
];
const copyDefs=new Map(copyGroups.flatMap(([,entries])=>entries.map(([key,name,fallback,selector])=>[key,{name,fallback,selector}])));
const layoutGroups=[
 ['Ringkasan & Filter',[
  ['filters','Filter bulan dan minggu'],['hero','Banner headline mingguan'],['kpis','Seluruh kartu KPI'],
  ['kpiStores','Kartu jumlah toko'],['kpiArea','Kartu POINT area'],['kpiAbove','Kartu di atas TF'],['kpiBelow','Kartu di bawah TF'],['dailyReport','Status input harian 12 toko'],['pointGoals','Kekurangan QTY, NS & target 100% POINT']
 ]],
 ['Grafik & Tabel',[
  ['resume','Tabel resume per brand'],['charts','Seluruh grafik'],['storeChart','Grafik POINT toko'],
  ['areaChart','Ring pencapaian area'],['scorecard','Tabel scorecard 12 toko'],['footer','Footer halaman']
 ]]
];
function textFor(key){if(S.settings?.hiddenText?.[key])return '';const custom=S.settings?.copy?.[key];if(typeof custom==='string')return custom;const base=(key==='appName'||key==='title'||key==='description')?S.settings?.[key]:null;return typeof base==='string'?base:(copyDefs.get(key)?.fallback||'')}
const htmlFor=key=>escapeHTML(textFor(key));
function ensurePersonalization(){if(!S.settings||typeof S.settings!=='object')S.settings={...defaults};if(!S.settings.copy||typeof S.settings.copy!=='object')S.settings.copy={};if(!S.settings.hiddenText||typeof S.settings.hiddenText!=='object')S.settings.hiddenText={};if(!S.settings.layout||typeof S.settings.layout!=='object')S.settings.layout={};if(!S.settings.visual||typeof S.settings.visual!=='object')S.settings.visual={};}
function applyStaticCopy(){
 for(const [key,d] of copyDefs){if(!d.selector)continue;const el=$(d.selector);if(!el)continue;if(key==='scoreSearch')el.placeholder=textFor(key);else el.textContent=textFor(key)}
 const heads=$$('.scoretable thead th');const keys=['colStoreCode','colStoreName','colTargetQty','colTargetNS','colActualQty','colActualNS','colAchQty','colAchNS','colWeightQty','colWeightNS','colPoint','colStatus'];keys.forEach((k,i)=>{if(heads[i])heads[i].textContent=textFor(k)});
 const navKeys={dashboard:'navDashboard',input:'navInput',stores:'navStores',history:'navHistory',settings:'navSettings'};
 $$('[data-page].navbtn').forEach(btn=>{const key=navKeys[btn.dataset.page];if(!key)return;const full=btn.querySelector('.nav-text');if(full)full.textContent=textFor(key);const short=btn.querySelector('.nav-short');if(short){short.textContent=textFor(key)?((S.settings.copy?.[key]!==undefined?textFor(key):{dashboard:'Home',input:'Input',stores:'Toko',history:'Arsip',settings:'Setelan'}[btn.dataset.page])):''}btn.setAttribute('aria-label',textFor(key)||'Menu');});
}
function applyLayout(){for(const el of $$('[data-layout-key]'))el.classList.toggle('is-section-hidden',S.settings.layout[el.dataset.layoutKey]===false)}
function applyVisual(){const v=S.settings.visual||{};document.body.classList.toggle('no-glow',v.glow===false);document.body.classList.toggle('compact-ui',v.compact===true)}
let settingsTab='theme';
function settingsChooseTab(tab){if(!['theme','text','layout'].includes(tab))return;settingsTab=tab;$$('[data-settings-tab]').forEach(b=>{const active=b.dataset.settingsTab===tab;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active))});$$('.settings-panel').forEach(p=>p.classList.toggle('active',p.id==='settings'+tab[0].toUpperCase()+tab.slice(1)+'Panel'))}
function renderSettings(){ensurePersonalization();const wrap=$('#settingsThemeGrid');wrap.innerHTML=Object.entries(themes).map(([id,[name,first,second]])=>`<button type="button" class="settings-theme-choice ${S.theme===id?'selected':''}" data-setting-theme="${id}" aria-pressed="${S.theme===id}"><span class="settings-swatch" style="--swatch-first:${first};--swatch-second:${second}"><i></i><i></i><i></i></span><strong>${escapeHTML(name)}</strong><small>${S.theme===id?'✓ Aktif':'Gunakan tema'}</small></button>`).join('');
 $('#settingGlow').checked=S.settings.visual.glow!==false;$('#settingCompact').checked=S.settings.visual.compact===true;
 const editor=$('#settingsTextEditor');editor.innerHTML=copyGroups.map(([group,items])=>`<div class="settings-text-group"><h4>${escapeHTML(group)}</h4><div class="settings-text-list">${items.map(([key,name])=>{const value=S.settings.copy[key]??((['title','description','appName'].includes(key)&&S.settings[key])?S.settings[key]:(copyDefs.get(key)?.fallback||''));const visible=!S.settings.hiddenText[key];return `<div class="settings-text-row" data-text-row="${key}" data-search-label="${escapeHTML((name+' '+value).toLowerCase())}"><label class="settings-field-label" for="text-${key}">${escapeHTML(name)}<input id="text-${key}" type="text" data-copy-input="${key}" maxlength="360" value="${escapeHTML(value)}" ${visible?'':'disabled'}></label><label class="text-visible"><input type="checkbox" data-hide-text="${key}" ${visible?'checked':''}><span>Tampil</span></label><button class="text-reset-btn" type="button" title="Reset hanya teks ini" aria-label="Reset ${escapeHTML(name)}" data-reset-text="${key}">↺</button></div>`}).join('')}</div></div>`).join('');$('#textItemCount').textContent=copyDefs.size+' teks dapat diatur';
 const l=$('#settingsLayoutEditor');l.innerHTML=layoutGroups.map(([group,items])=>`<div class="settings-layout-group"><h4>${escapeHTML(group)}</h4>${items.map(([key,label])=>`<label class="settings-toggle"><span><strong>${escapeHTML(label)}</strong><small>${key==='kpis'?'Kontrol kartu satu per satu tetap bisa diatur di bawah.':'Tidak menghapus data atau angka pada laporan.'}</small></span><input type="checkbox" data-layout-toggle="${key}" ${S.settings.layout[key]===false?'':'checked'}></label>`).join('')}</div>`).join('');settingsChooseTab(settingsTab);filterTextOptions();}
function filterTextOptions(){const search=($('#settingsTextSearch')?.value||'').trim().toLowerCase();let found=0;$$('.settings-text-group').forEach(group=>{let count=0;group.querySelectorAll('[data-text-row]').forEach(row=>{const key=row.dataset.textRow;const display=(!search||row.dataset.searchLabel.includes(search)||key.toLowerCase().includes(search));row.hidden=!display;if(display){count++;found++}});group.hidden=!count});if(!found&&search)$('#textItemCount').textContent='Tidak ditemukan';else $('#textItemCount').textContent=found+' teks dapat diatur'}
function wireSettings(){
 document.addEventListener('click',e=>{const tab=e.target.closest('[data-settings-tab]');if(tab){settingsChooseTab(tab.dataset.settingsTab);return}const theme=e.target.closest('[data-setting-theme]');if(theme){S.theme=theme.dataset.settingTheme;save('ui');renderShell();renderSettings();toast('Tema '+themes[S.theme][0]+' aktif');return}const reset=e.target.closest('[data-reset-text]');if(reset){const key=reset.dataset.resetText;delete S.settings.copy[key];delete S.settings.hiddenText[key];if(['appName','title','description'].includes(key))S.settings[key]=defaults[key];save('ui');renderShell();renderSettings();toast('Satu label dikembalikan ke default');return}});
 $('#settingsTextEditor').addEventListener('input',e=>{const inp=e.target.closest('[data-copy-input]');if(!inp)return;S.settings.copy[inp.dataset.copyInput]=inp.value;save('ui');renderShell();});
 $('#settingsTextEditor').addEventListener('change',e=>{const inp=e.target.closest('[data-hide-text]');if(!inp)return;const key=inp.dataset.hideText;S.settings.hiddenText[key]=!inp.checked;const field=$('#text-'+key);if(field)field.disabled=!inp.checked;save('ui');renderShell()});
 $('#settingsTextSearch').addEventListener('input',filterTextOptions);
 $('#settingsLayoutEditor').addEventListener('change',e=>{const inp=e.target.closest('[data-layout-toggle]');if(!inp)return;S.settings.layout[inp.dataset.layoutToggle]=inp.checked;save('ui');applyLayout()});
 $('#settingGlow').addEventListener('change',e=>{S.settings.visual.glow=e.target.checked;save('ui');applyVisual()});
 $('#settingCompact').addEventListener('change',e=>{S.settings.visual.compact=e.target.checked;save('ui');applyVisual()});
 $('#resetTextSettings').addEventListener('click',()=>{if(!confirm('Kembalikan semua judul dan label dashboard ke default? Data toko dan penjualan tetap aman.'))return;S.settings.copy={};S.settings.hiddenText={};for(const k of Object.keys(defaults))S.settings[k]=defaults[k];save('ui');renderShell();renderSettings();toast('Semua teks kembali ke default')});
 $('#resetLayoutSettings').addEventListener('click',()=>{S.settings.layout={};save('ui');applyLayout();renderSettings();toast('Seluruh komponen ditampilkan kembali')});
 $('#settingsBackup').addEventListener('click',backup);$('#settingsRestore').addEventListener('click',()=>$('#jsonFile').click());
}

function wk(create=false){if(create){S.weeks[S.week] ||= {stores:{}};S.weeks[S.week].stores ||= {};return S.weeks[S.week]}return S.weeks[S.week]||{stores:{}}}
function storeEntries(){return Object.values(wk().stores||{}).sort((a,b)=>(a.code||'').localeCompare(b.code||'','id',{numeric:true}))}
function inputSortLabel(mode){return({'brand-asc':'Brand A–Z → PLU ↑','description-asc':'Deskripsi A–Z','plu-asc':'PLU kecil–besar','plu-desc':'PLU besar–kecil'}[mode]||'Brand A–Z → PLU ↑')}
function sortStoreItems(items,mode='brand-asc',keyword=''){const list=[...(items||[])];const q=String(keyword||'').trim().toLowerCase();const txt=v=>String(v||'').trim();const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0};const cmpText=(a,b)=>txt(a).localeCompare(txt(b),'id',{numeric:true,sensitivity:'base'});const comparator=(a,b)=>{switch(mode){case 'description-asc':return cmpText(a.description,b.description)||cmpText(a.brand,b.brand)||cmpText(a.plu,b.plu);case 'plu-desc':return num(b.plu)-num(a.plu)||cmpText(b.plu,a.plu)||cmpText(a.brand,b.brand)||cmpText(a.description,b.description);case 'plu-asc':return num(a.plu)-num(b.plu)||cmpText(a.plu,b.plu)||cmpText(a.brand,b.brand)||cmpText(a.description,b.description);case 'brand-asc':default:return cmpText(a.brand,b.brand)||num(a.plu)-num(b.plu)||cmpText(a.plu,b.plu)||cmpText(a.description,b.description);}};const filtered=q?list.filter(item=>[item.plu,item.brand,item.description].some(v=>String(v||'').toLowerCase().includes(q))):list;return filtered.sort(comparator)}
function toast(message){const t=$('#toast');t.textContent=message;t.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('show'),3800)}
function sharedUi(){ensurePersonalization();return {theme:S.theme,settings:JSON.parse(JSON.stringify(S.settings))}}
function pendingUi(){try{return JSON.parse(localStorage.getItem(UI_PENDING_KEY)||'null')}catch{return null}}
function save(kind='data'){
 try{
  const uiChanged=kind==='ui'||kind==='all';
  const pending=uiChanged?{...sharedUi(),revision:newid(),changedAt:Date.now()}:null;
  // Tanda perubahan UI tersimpan lebih dulu. Saat refresh, cloud lama tidak boleh me-reset UI ini.
  if(pending)localStorage.setItem(UI_PENDING_KEY,JSON.stringify(pending));
  const raw=JSON.stringify(S);localStorage.setItem(KEY,raw);
  window.AreaSafety?.backupSoon(raw);
  $('#saveState').textContent=textFor('saveStateLabel');
  if(!cloudApplying){
   if(kind!=='ui')window.dispatchEvent(new CustomEvent('area:changed',{detail:{weeks:S.weeks}}));
   if(pending)window.dispatchEvent(new CustomEvent('area:ui-changed',{detail:pending}));
  }
 }catch(e){toast('Penyimpanan HP penuh. Lakukan Backup JSON.');console.error(e)}
}
function saveViewPreference(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){console.error('Pengaturan tampilan belum tersimpan lokal:',e);toast('Penyimpanan lokal penuh. Backup JSON dahulu.')}}
function compute(store,asOfDate=null){let qty=0,ns=0;const daily=Array(7).fill(0),limit=asOfDate===null?7:weekTF(S.week,asOfDate);for(const item of store.items||[]){const hpp=number(item.hpp);for(let i=0;i<limit;i++){const q=number(item.days?.[i]);qty+=q;ns+=hpp*q;daily[i]+=hpp*q}}const tq=number(store.targetQty),tn=number(store.targetNS);const aq=tq>0?qty/tq*100:null,an=tn>0?ns/tn*100:null,pt=aq!==null&&an!==null?(aq+an)/2:null,tf=weekTF(S.week,asOfDate===null?today():asOfDate)/7*100;let status='TARGET BELUM DIISI',type='pending';if(pt!==null){if(weekTF(S.week,asOfDate===null?today():asOfDate)===0&&qty===0){status='BELUM MULAI';type='pending'}else if(pt>tf+0.00001){status='DIATAS TF';type='up'}else if(pt<tf-0.00001){status='DIBAWAH TF';type='down'}else{status='SESUAI TF';type='equal'}}return{qty,ns,aq,an,pt,tf,status,type,days:daily}}
function areaCalc(stores,asOfDate=null){const t={qty:0,ns:0,actualQty:0,actualNS:0};for(const s of stores){const c=compute(s,asOfDate);t.qty+=number(s.targetQty);t.ns+=number(s.targetNS);t.actualQty+=c.qty;t.actualNS+=c.ns}t.aq=t.qty>0?t.actualQty/t.qty*100:null;t.an=t.ns>0?t.actualNS/t.ns*100:null;t.point=t.aq!==null&&t.an!==null?(t.aq+t.an)/2:null;return t}
function reportDateForWeek(){
 const min=S.week,max=addDays(S.week,6),current=today();
 if(S.reportManualDate&&S.reportWatchDate>=min&&S.reportWatchDate<=max)return S.reportWatchDate;
 if(current>=min&&current<=max)return current;
 if(S.reportWatchDate>=min&&S.reportWatchDate<=max)return S.reportWatchDate;
 return current<min?min:max;
}
/* Pemilih tanggal bersifat tampilan lokal: tidak mengirim perubahan data ke Supabase. */
function viewDate(){return reportDateForWeek()}
function viewDateLabel(date){const d=pdate(date);return dayNames[(d.getDay()+6)%7]+', '+dateMini(date)+' '+d.getFullYear()}
function setViewDate(date,autoToday=false){
 const first=S.week,last=addDays(S.week,6);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(String(date||'')))return;
 S.reportWatchDate=date<first?first:date>last?last:date;
 S.reportManualDate=!autoToday&&S.reportWatchDate!==today();
 saveViewPreference();render();
}
function shiftViewDate(delta){const current=viewDate(),candidate=addDays(current,delta);if(candidate<S.week||candidate>addDays(S.week,6))return;setViewDate(candidate)}
function dailyQty(store,index){return (store.items||[]).reduce((sum,item)=>sum+number(item.days?.[index]),0)}
function dailyReportInfo(store,date){
 const i=Math.round((pdate(date)-pdate(S.week))/86400000);
 if(i<0||i>6)return{reported:false,qty:0,source:''};
 const qty=dailyQty(store,i),flag=store.reportedDays?.[date];
 // Explicit saved report/zero marker takes priority; older records only prove input when QTY > 0.
 return{reported:Boolean(flag)||qty>0,qty,source:flag?.source|| (qty>0?'riwayat':''),explicit:Boolean(flag)};
}
function markDayReported(store,date,source){
 if(!store||date<S.week||date>addDays(S.week,6))return;
 store.reportedDays||={};
 store.reportedDays[date]={source,at:new Date().toISOString()};
}
function renderDailyReport(){
 const date=reportDateForWeek();S.reportWatchDate=date;
 const select=$('#dailyReportDate');if(!select)return;
 select.innerHTML=Array.from({length:7},(_,i)=>{const d=addDays(S.week,i);return `<option value="${d}" ${date===d?'selected':''}>${escapeHTML(dateMini(d))} (${dayNames[i]})${d===today()?' • Hari ini':''}</option>`}).join('');
 const stores=storeEntries();const tracked=stores.map(store=>({store,info:dailyReportInfo(store,date)}));
 const done=tracked.filter(x=>x.info.reported).length,missing=tracked.length-done;
 $('#dailyDoneCount').textContent=done;
 $('#dailyMissingCount').textContent=missing;
 $('#dailyDoneTotal').textContent=tracked.length;
 const pctVal=tracked.length?Math.round(done/tracked.length*100):0;
 $('#dailyReportPct').textContent=pctVal+'%';
 const bar=$('#dailyReportBar');bar.style.width=pctVal+'%';bar.parentElement.setAttribute('aria-valuenow',String(pctVal));
 $$('[data-report-label]').forEach(el=>el.textContent=textFor(el.dataset.reportLabel==='done'?'dailyDone':'dailyPending'));$$('[data-report-filter]').forEach(el=>el.textContent=textFor(({all:'dailyAll',done:'dailyDone',missing:'dailyPending'})[el.dataset.reportFilter]||'dailyAll'));const chosen=S.reportFilter||'all';
 $$('[data-report-filter]').forEach(btn=>{btn.classList.toggle('selected',btn.dataset.reportFilter===chosen);btn.setAttribute('aria-pressed',String(btn.dataset.reportFilter===chosen))});
 const filtered=tracked.filter(({info})=>chosen==='all'||(chosen==='done'&&info.reported)||(chosen==='missing'&&!info.reported));
 const list=$('#dailyReportList');list.innerHTML=filtered.map(({store,info})=>{
   const name=escapeHTML(store.name||store.code),code=escapeHTML(store.code);
   const state=info.reported?'is-done':'is-missing';
   const label=htmlFor(info.reported?'dailyDone':'dailyPending');
   const detail=info.reported?(info.qty>0?fmt(info.qty)+' QTY':'0 QTY • laporan tercatat'):'Belum ada input terdeteksi';
   const explicitZero=info.explicit&&info.qty===0;
   return `<article class="daily-store ${state}"><div class="daily-store-top"><strong class="daily-store-code">${code}</strong><span class="daily-store-badge ${state}">${info.reported?'✓':'!'} ${label}</span></div><div class="daily-store-name" title="${name}">${name}</div><div class="daily-store-detail">${detail}</div><div class="daily-store-actions"><button type="button" class="daily-store-go" data-report-open="${code}" aria-label="Input penjualan ${code}">↗ Input</button>${!info.reported?`<button type="button" class="daily-store-zero" data-report-zero="${code}" title="Konfirmasi tidak ada penjualan">0 QTY ✓</button>`:explicitZero?`<button type="button" class="daily-store-unmark" data-report-unmark="${code}" title="Batalkan tanda laporan nol">Batalkan</button>`:''}</div></article>`;
 }).join('')||`<p class="daily-report-empty">${tracked.length?'Tidak ada toko dalam filter ini.':'Belum ada toko dalam minggu terpilih.'}</p>`;
 $('#dailyReportHelp').textContent='✓ Status muncul setelah input QTY/manual atau simpan laporan WA. Untuk laporan 0 QTY, tekan “0 QTY ✓”. Data lama yang QTY-nya nol tidak dapat dipastikan pernah dilaporkan. Indikator ini tidak berarti unggahan cloud sudah selesai.';
}
function kpi(key,value,hint,type=''){return `<div class="kpi ${type}" data-layout-key="${key}"><span class="cap">${htmlFor(key)}</span><strong>${value}</strong><span class="hint">${hint}</span></div>`}
function renderShell(){ensurePersonalization();document.body.dataset.theme=S.theme;document.body.classList.toggle('page-settings',S.page==='settings');applyVisual();applyStaticCopy();applyLayout();$('#monthInput').value=S.month;const chosenDate=viewDate(),daysPassed=weekTF(S.week,chosenDate);$('#heroTF').textContent=pct(daysPassed/7*100);$('#heroDay').textContent=daysPassed+' / 7 '+textFor('dayUnit');$('#tfSelectedDate').textContent=viewDateLabel(chosenDate);$('#tfPrevDay').disabled=chosenDate<=S.week;$('#tfNextDay').disabled=chosenDate>=addDays(S.week,6);$('#tfGoToday').disabled=chosenDate===today()||today()<S.week||today()>addDays(S.week,6);
const weeks=monthWeeks(S.month);$('#weeks').innerHTML=weeks.map((w,i)=>`<button class="week-item ${S.week===w?'selected':''} ${monday(today())===w?'today':''}" type="button" data-week="${w}"><strong>${htmlFor('weekName')} ${i+1}</strong>${escapeHTML(weekTitle(w))}</button>`).join('');$$('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===S.page));$$('.view').forEach(v=>v.classList.toggle('active',v.id==='view-'+S.page));}
function renderDashboard(){const stores=storeEntries(),asOf=viewDate(),total=areaCalc(stores,asOf),tf=weekTF(S.week,asOf)/7*100,valid=stores.filter(s=>compute(s,asOf).pt!==null),up=valid.filter(s=>compute(s,asOf).type==='up').length,down=valid.filter(s=>compute(s,asOf).type==='down').length;
$('#kpis').innerHTML=kpi('kpiStores',stores.length+' <small style="font-size:14px;color:var(--muted)">/ 12</small>',htmlFor('kpiStoresHint'))+kpi('kpiArea',pct(total.point),htmlFor('kpiAreaHint'),'teal')+kpi('kpiAbove',up+' '+htmlFor('storeUnit'),htmlFor('kpiAboveHint')+' '+pct(tf),'green')+kpi('kpiBelow',down+' '+htmlFor('storeUnit'),htmlFor('kpiBelowHint'),'red');$('#chartCount').textContent=stores.length+' / 12 '+textFor('storeUnit').toUpperCase();
renderGoals();renderDailyReport();renderResume();$('#pointBars').innerHTML=stores.length?stores.map(s=>{const c=compute(s,asOf),v=c.pt??0;return `<div class="barrow"><div class="barname" title="${escapeHTML(s.name)}">${escapeHTML(s.name)}<small>${escapeHTML(s.code)}</small></div><div class="bar-track" style="--tf:${Math.min(100,tf)}%"><div class="bar-fill" style="width:${Math.max(0,Math.min(100,v))}%"></div><div class="bar-tf"></div></div><div class="barpoint">${pct(c.pt)}</div></div>`}).join(''):`<div class="table-empty">${htmlFor('emptyChart')}</div>`;
$('#areaRing').style.setProperty('--progress',Math.max(0,Math.min(100,total.point||0))+'%');$('#areaRing').innerHTML=`<div class="ring-inner"><b>${pct(total.point)}</b><span>${htmlFor('ringLabel')}</span></div>`;
$('#areaBreakdown').innerHTML=`<div class="detailrow"><span>${htmlFor('breakQty')}</span><strong>${pct(total.aq)}</strong></div><div class="detailrow"><span>${htmlFor('breakNS')}</span><strong>${pct(total.an)}</strong></div><div class="detailrow"><span>${htmlFor('breakTF')}</span><strong>${pct(tf)}</strong></div><div class="detailrow"><span>${htmlFor('breakActual')}</span><strong>${money(total.actualNS)}</strong></div>`;
const filtered=stores.filter(s=>(s.code+' '+s.name).toLowerCase().includes(S.search.toLowerCase()));$('#scoreBody').innerHTML=filtered.map(s=>{const c=compute(s,asOf);return `<tr><td class="code">${escapeHTML(s.code)}</td><td><strong>${escapeHTML(s.name)}</strong></td><td>${fmt(s.targetQty)}</td><td>${money(s.targetNS)}</td><td>${fmt(c.qty)}</td><td>${money(c.ns)}</td><td>${pct(c.aq)}</td><td>${pct(c.an)}</td><td>${pct(c.aq===null?null:c.aq*.5)}</td><td>${pct(c.an===null?null:c.an*.5)}</td><td class="point">${pct(c.pt)}<small>TF ${pct(tf)}</small></td><td><span class="status ${c.type}">${htmlFor(c.status==='BELUM MULAI'?'statusNotStarted':c.status==='TARGET BELUM DIISI'?'statusNoTarget':c.type==='up'?'statusAbove':c.type==='down'?'statusBelow':'statusEqual')}</span></td></tr>`}).join('')||`<tr><td class="table-empty" colspan="12">${stores.length?'Tidak ada toko yang cocok.':htmlFor('emptyStore')}</td></tr>`;applyLayout()}
/* V25 — Target POINT penuh, berdasarkan QTY dan NS yang sama dengan scorecard. */
let goalFilter='',goalPLU={};
function unitsToPoint(tq,tn,qty,ns,unitNS){
 const point=50*(qty/tq+ns/tn);
 if(point>=100-1e-9)return 0;
 if(!(tq>0&&tn>0&&unitNS>0))return null;
 const remain=2-qty/tq-ns/tn,contribution=1/tq+unitNS/tn;
 if(!(contribution>0))return null;
 // tolerance kecil untuk menghindari ceil +1 akibat error floating-point.
 return Math.max(0,Math.ceil(remain/contribution-1e-9));
}
function goalMetrics(targetQty,targetNS,actualQty,actualNS,unitNS){
 const tq=number(targetQty),tn=number(targetNS),qty=number(actualQty),ns=number(actualNS);
 if(!(tq>0&&tn>0))return{valid:false};
 const point=50*(qty/tq+ns/tn);
 return{valid:true,point,pointGap:Math.max(0,100-point),
  qtyGap:Math.max(0,Math.ceil(tq-qty-1e-9)),nsGap:Math.max(0,tn-ns),
  units:unitsToPoint(tq,tn,qty,ns,unitNS),unitNS};
}
function renderGoals(){
 const asOf=viewDate(),stores=storeEntries(),area=areaCalc(stores,asOf),el=$('#goalAreaSummary');
 $('#goalAsOf').textContent='📅 s.d. '+viewDateLabel(asOf);
 const avgArea=area.actualQty>0&&area.actualNS>0?area.actualNS/area.actualQty:null;
 const metrics=goalMetrics(area.qty,area.ns,area.actualQty,area.actualNS,avgArea);
 if(!metrics.valid){
  el.innerHTML='<div class="goal-empty">Isi <b>target QTY dan target NS</b> terlebih dahulu melalui menu Toko / Import Excel untuk menghitung kebutuhan mencapai 100% POINT.</div>';
 }else{
  const unitText=metrics.units===null?'Perlu data penjualan/HPP':fmt(metrics.units)+' QTY';
  el.innerHTML=`<div class="goal-area-main"><span>POINT AREA SAAT INI</span><strong>${pct(metrics.point)}</strong><small>Masih kurang <b>${pct(metrics.pointGap)}</b> menuju 100%</small></div>
   <div class="goal-area-stat"><span>Kekurangan QTY 100%</span><strong>${fmt(metrics.qtyGap)}</strong><small>Target QTY ${fmt(area.qty)} • aktual ${fmt(area.actualQty)}</small></div>
   <div class="goal-area-stat"><span>Kekurangan NS 100%</span><strong>${money(metrics.nsGap)}</strong><small>Target NS ${money(area.ns)} • aktual ${money(area.actualNS)}</small></div>
   <div class="goal-area-stat emphasize"><span>Estimasi tambahan QTY untuk POINT 100%</span><strong>${unitText}</strong><small>${avgArea?'Berdasarkan rata-rata NS per QTY: '+money(avgArea)+'/unit':'Belum ada NS/unit dari penjualan aktual'}</small></div>`;
 }
 const select=$('#goalStoreFilter');
 if(!stores.some(s=>s.code===goalFilter))goalFilter='';
 select.innerHTML='<option value="">Semua toko ('+stores.length+')</option>'+stores.map(s=>`<option value="${escapeHTML(s.code)}">${escapeHTML(s.code+' · '+s.name)}</option>`).join('');
 select.value=goalFilter;
 const chosen=stores.filter(s=>!goalFilter||s.code===goalFilter);
 $('#goalStoreCards').innerHTML=chosen.map(s=>{
  const c=compute(s,asOf),autoUnit=c.qty>0&&c.ns>0?c.ns/c.qty:null;
  const eligible=(s.items||[]).filter(i=>number(i.hpp)>0);
  const choice=goalPLU[s.code]||'auto';
  const selected=eligible.find(i=>i.id===choice);
  const unit=selected?number(selected.hpp):autoUnit;
  const g=goalMetrics(s.targetQty,s.targetNS,c.qty,c.ns,unit);
  if(!g.valid)return `<article class="goal-store-card"><header><b>${escapeHTML(s.code)} · ${escapeHTML(s.name)}</b><span class="goal-status missing">Target belum lengkap</span></header><p>Target QTY dan NS harus lebih dari nol.</p></article>`;
  const done=g.units===0,missing=g.units===null;
  return `<article class="goal-store-card"><header><div><strong>${escapeHTML(s.code)}</strong><span>${escapeHTML(s.name)}</span></div><span class="goal-status ${done?'done':missing?'missing':'pending'}">${done?'✓ POINT ≥100%':'Kurang '+pct(g.pointGap)}</span></header>
    <div class="goal-current"><span>POINT sekarang</span><strong>${pct(g.point)}</strong></div>
    <div class="goal-store-metrics"><div><span>QTY kurang*</span><b>${fmt(g.qtyGap)}</b></div><div><span>NS kurang*</span><b>${money(g.nsGap)}</b></div></div>
    <div class="goal-estimate"><span>QTY tambahan agar POINT ≥100%</span><strong>${missing?'— pilih PLU':fmt(g.units)+' QTY'}</strong><small>${done?'Target POINT sudah terpenuhi':missing?'Belum cukup data untuk menghitung estimasi':selected?'Asumsi tambahan 1 unit PLU = '+money(unit)+' NS':'Asumsi rata-rata NS/QTY aktual = '+money(unit)+'/unit'}</small></div>
    <label class="goal-select-label">Simulasi NS tiap QTY<select data-goal-plu="${escapeHTML(s.code)}" aria-label="Harga produk untuk simulasi ${escapeHTML(s.code)}"><option value="auto" ${!selected?'selected':''}>Rata-rata penjualan aktual${autoUnit?' ('+money(autoUnit)+')':' (belum tersedia)'}</option>${eligible.map(i=>`<option value="${escapeHTML(i.id)}" ${selected?.id===i.id?'selected':''}>${escapeHTML(i.plu+' · '+(i.description||'Produk'))} — ${money(i.hpp)}</option>`).join('')}</select></label>
    <button class="goal-input-link" type="button" data-goal-open="${escapeHTML(s.code)}">↗ Input QTY toko</button>
  </article>`;
 }).join('')||'<div class="goal-empty">Belum ada toko pada minggu ini.</div>';
}
function brandSummary(stores,asOfDate=null){const limit=asOfDate===null?7:weekTF(S.week,asOfDate),names=new Set();for(const s of stores){Object.keys(s.brandTargets||{}).forEach(b=>names.add(b));(s.items||[]).forEach(i=>{if(i.brand)names.add(i.brand)})}const brands=[...names].sort((a,b)=>a.localeCompare(b,'id'));function calc(s,b){const target=Object.entries(s.brandTargets||{}).find(([key])=>key.toLowerCase().trim()===b.toLowerCase().trim())?.[1]||{};let qty=0,ns=0;for(const i of s.items||[])if(String(i.brand||'').trim().toLowerCase()===b.toLowerCase().trim()){const q=(i.days||[]).slice(0,limit).reduce((v,n)=>v+number(n),0);qty+=q;ns+=q*number(i.hpp)}return{tq:number(target.qty),tn:number(target.ns),qty,ns}}function point(c){return c.tq>0&&c.tn>0?((c.qty/c.tq*100)+(c.ns/c.tn*100))/2:null}const per=stores.map(s=>({store:s,values:brands.map(b=>{const c=calc(s,b);return{...c,point:point(c)}})}));const area=brands.map((b,i)=>{const c={tq:0,tn:0,qty:0,ns:0};for(const r of per)for(const k of Object.keys(c))c[k]+=r.values[i][k];return{...c,point:point(c)}});return{brands,per,area}}
function renderResume(){const stores=storeEntries(),asOf=viewDate(),{brands,per,area}=brandSummary(stores,asOf),tf=weekTF(S.week,asOf)/7*100,overall=areaCalc(stores,asOf);const table=$('#resumeTable');if(!table)return;const label=p=>p===null?'—':pct(p);const klass=p=>p===null?'resume-none':p>=tf?'resume-up':'resume-down';const status=p=>p===null?'—':p>=tf?textFor('statusAbove'):textFor('statusBelow');const average=values=>{const valid=values.filter(v=>v.point!==null);return valid.length?valid.reduce((a,v)=>a+v.point,0)/valid.length:null};table.innerHTML='<thead><tr><th rowspan="2">'+htmlFor('resumeColCode')+'</th><th rowspan="2">'+htmlFor('resumeColStore')+'</th>'+brands.map(b=>'<th colspan="2">'+escapeHTML(b)+'</th>').join('')+'<th rowspan="2">'+htmlFor('resumeColAcv')+'</th><th rowspan="2">'+htmlFor('resumeColAvg')+'</th></tr><tr>'+brands.map(()=>'<th>'+htmlFor('resumeColPoint')+'</th><th>'+htmlFor('resumeColStatus')+'</th>').join('')+'</tr></thead><tbody>'+per.map(r=>'<tr><td><b>'+escapeHTML(r.store.code)+'</b></td><td>'+escapeHTML(r.store.name)+'</td>'+r.values.map(v=>'<td class="'+klass(v.point)+'">'+label(v.point)+'</td><td class="'+klass(v.point)+'">'+escapeHTML(status(v.point))+'</td>').join('')+'<td>'+r.values.filter(v=>v.point!==null&&v.point>=tf).length+' / '+r.values.filter(v=>v.point!==null).length+'</td><td class="resume-avg">'+label(average(r.values))+'</td></tr>').join('')+'<tr class="resume-area"><td colspan="2">'+htmlFor('resumeAreaLabel')+'</td>'+area.map(v=>'<td class="'+klass(v.point)+'">'+label(v.point)+'</td><td class="'+klass(v.point)+'">'+escapeHTML(status(v.point))+'</td>').join('')+'<td>'+area.filter(v=>v.point!==null&&v.point>=tf).length+' / '+area.filter(v=>v.point!==null).length+'</td><td class="resume-avg">'+label(average(area))+'</td></tr></tbody>';table.dataset.overall=pct(overall.point);const picker=$('#resumeStyle');if(picker)picker.value=S.resumeStyle||'classic';const preview=$('#resumeStylePreview');if(preview)preview.textContent='Mode unduh: '+({classic:'Tabel Klasik',dark:'Dark Neon',glass:'Glass Soft',executive:'Executive Navy',minimal:'Minimal White',emerald:'Emerald Pro',sunset:'Sunset Coral'}[S.resumeStyle]||'Tabel Klasik')}
function exportResumeClassic(){const stores=storeEntries();if(!stores.length){alert('Upload master target toko terlebih dahulu.');return}const asOf=viewDate(),{brands,per,area}=brandSummary(stores,asOf),tf=weekTF(S.week,asOf)/7*100,overall=areaCalc(stores,asOf),scale=2;const width=Math.max(1250,460+brands.length*200+185),rh=46,header=148,height=header+rh*(stores.length+3)+112;const canvas=document.createElement('canvas');canvas.width=width*scale;canvas.height=height*scale;const c=canvas.getContext('2d');c.scale(scale,scale);const fill=(x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(x,y,w,h)};const text=(v,x,y,size=15,color='#101828',bold=false,align='center')=>{c.fillStyle=color;c.font=(bold?'bold ':'')+size+'px Arial,sans-serif';c.textAlign=align;c.textBaseline='middle';c.fillText(String(v),x,y)};const cell=(x,y,w,h,value,bg='#fff',size=14,bold=false)=>{fill(x,y,w,h,bg);c.strokeStyle='#45515e';c.lineWidth=.7;c.strokeRect(x+.35,y+.35,w-.7,h-.7);text(value,x+w/2,y+h/2,size,'#121827',bold)};const col=[112,340,...brands.flatMap(()=>[90,110]),85,100];const start=(width-col.reduce((a,b)=>a+b,0))/2;let xs=[start];for(const w of col)xs.push(xs[xs.length-1]+w);fill(0,0,width,height,'#f6f8fb');fill(0,0,width,85,'#00e8e9');text(textFor('resumeTitle')+' · '+weekTitle(S.week).toUpperCase(),width/2,44,34,'#06151d',true);fill(0,85,width,43,'#fff35a');text('HINGGA: '+pdate(asOf).toLocaleDateString('id-ID'),start+10,106,17,'#17212d',true,'left');text('TIME FACTOR: '+pct(tf),width-start-8,106,18,'#17212d',true,'right');let y=128;cell(xs[0],y,col[0],rh*2,textFor('resumeColCode'),'#fff300',15,true);cell(xs[1],y,col[1],rh*2,textFor('resumeColStore'),'#fff300',15,true);for(let i=0;i<brands.length;i++){const x=xs[2+i*2];cell(x,y,col[2+i*2]+col[3+i*2],rh,brands[i].toUpperCase(),'#fff300',15,true);cell(x,y+rh,col[2+i*2],rh,textFor('resumeColPoint'),'#f3f4f6',13,true);cell(x+col[2+i*2],y+rh,col[3+i*2],rh,textFor('resumeColStatus'),'#f3f4f6',13,true)}cell(xs[col.length-2],y,col.at(-2),rh*2,textFor('resumeColAcv'),'#fff300',12,true);cell(xs[col.length-1],y,col.at(-1),rh*2,'AVG','#fff300',15,true);y+=rh*2;const color=p=>p===null?'#e5e7eb':p>=tf?'#9fe1b1':p>=tf*.6?'#ffe09a':'#ffa0a8';const label=p=>p===null?'—':pct(p);const status=p=>p===null?'—':p>=tf?textFor('statusAbove'):textFor('statusBelow');const avg=arr=>{const v=arr.filter(x=>x.point!==null);return v.length?v.reduce((a,x)=>a+x.point,0)/v.length:null};const drawRow=(code,name,vals,areaRow=false,rowIndex=0)=>{const base=areaRow?'#a8f0f4':rowIndex%2?'#edf0f3':'#fff';cell(xs[0],y,col[0],rh,code,base,15,true);cell(xs[1],y,col[1],rh,name.length>37?name.slice(0,35)+'…':name,base,14,true);vals.forEach((v,i)=>{const j=2+i*2;cell(xs[j],y,col[j],rh,label(v.point),color(v.point),14,true);cell(xs[j+1],y,col[j+1],rh,status(v.point),v.point===null?'#e5e7eb':v.point>=tf?'#bff3ce':'#ffd0d5',11,true)});cell(xs[col.length-2],y,col.at(-2),rh,vals.filter(v=>v.point!==null&&v.point>=tf).length+'/'+vals.filter(v=>v.point!==null).length,base,15,true);const a=avg(vals);cell(xs[col.length-1],y,col.at(-1),rh,label(a),color(a),15,true);y+=rh};per.forEach((r,i)=>drawRow(r.store.code,r.store.name,r.values,false,i));drawRow('AREA',textFor('resumeAreaLabel'),area,true);y+=16;fill(start,y,width-2*start,60,'#dceefa');text('POINT AREA (QTY 50% + NS 50%): '+pct(overall.point)+'     |     QTY: '+pct(overall.aq)+'     |     NS: '+pct(overall.an),width/2,y+24,18,'#143451',true);text('Area = total aktual ÷ total target seluruh toko • HPP diperlukan untuk menghitung NS',width/2,height-24,14,'#64748b');canvas.toBlob(blob=>{if(!blob){alert('Gagal membuat gambar');return}const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='RESUME_RPM_AREA_'+S.week+'_HINGGA_'+asOf+'.png';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000)},'image/png')}
function collectResumeData(){const stores=storeEntries(),asOf=viewDate(),summary=brandSummary(stores,asOf),tf=weekTF(S.week,asOf)/7*100,overall=areaCalc(stores,asOf);const label=p=>p===null?'—':pct(p);const status=p=>p===null?'—':p>=tf?textFor('statusAbove'):textFor('statusBelow');const average=values=>{const valid=values.filter(v=>v.point!==null);return valid.length?valid.reduce((a,v)=>a+v.point,0)/valid.length:null};return{stores,brands:summary.brands,per:summary.per,area:summary.area,tf,overall,label,status,average}}

function exportResumeImage(){const mode=S.resumeStyle||'classic';if(mode==='classic'){exportResumeClassic();return}const data=collectResumeData();if(!data.stores.length){alert('Upload master target toko terlebih dahulu.');return}if(mode==='glass')drawResumeGlass(data);else if(['executive','minimal','emerald','sunset'].includes(mode))drawResumeModern(data,mode);else drawResumeDark(data)}
function resumeFilename(mode){return 'RESUME_RPM_AREA_'+String(mode||'classic').toUpperCase()+'_'+S.week+'_HINGGA_'+viewDate()+'.png'}
function downloadCanvas(canvas,filename){canvas.toBlob(blob=>{if(!blob){alert('Gagal membuat gambar');return}const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000)},'image/png')}
function drawResumeDark(data){const {brands,per,area,tf,overall,label,status,average}=data,scale=2;const width=Math.max(1260,460+brands.length*180+170),rowH=42,headerH=154,pad=32,height=headerH+(per.length+3)*rowH+96;const canvas=document.createElement('canvas');canvas.width=width*scale;canvas.height=height*scale;const c=canvas.getContext('2d');c.scale(scale,scale);const rect=(x,y,w,h,r,color,stroke='')=>{c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();c.fillStyle=color;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=1;c.stroke()}};const text=(v,x,y,size=14,color='#fff',weight=500,align='center')=>{c.fillStyle=color;c.font=`${weight} ${size}px Arial,sans-serif`;c.textAlign=align;c.textBaseline='middle';c.fillText(String(v),x,y)};const bg=c.createLinearGradient(0,0,width,height);bg.addColorStop(0,'#07111f');bg.addColorStop(.55,'#0f1a30');bg.addColorStop(1,'#152647');c.fillStyle=bg;c.fillRect(0,0,width,height);rect(pad,pad,width-pad*2,86,26,'rgba(8,17,31,.72)','rgba(120,234,211,.2)');text(textFor('resumeTitle'),pad+26,pad+30,30,'#f8fafc',700,'left');text(weekTitle(S.week)+' • hingga '+dateMini(viewDate())+' • Template Dark Neon',pad+26,pad+59,16,'#9bb2cb',500,'left');rect(width-pad-250,pad+18,220,48,18,'rgba(17,185,202,.18)','rgba(17,185,202,.32)');text('TF '+pct(tf),width-pad-140,pad+42,20,'#79f6ff',700);let y=headerH;const cols=[94,310,...brands.flatMap(()=>[84,96]),82,96];const tableW=cols.reduce((a,b)=>a+b,0);let xs=[(width-tableW)/2];for(const w of cols)xs.push(xs[xs.length-1]+w);rect(xs[0]-8,y-18,tableW+16,(per.length+2)*rowH+20,24,'rgba(3,10,20,.2)','rgba(130,146,196,.16)');const cell=(x,y,w,h,value,bg='rgba(13,20,35,.92)',fg='#eef2ff',weight=600)=>{rect(x,y,w,h,0,bg,'rgba(120,140,178,.13)');text(value,x+w/2,y+h/2,12,fg,weight)};cell(xs[0],y,cols[0],rowH*2,textFor('resumeColCode'),'rgba(56,189,248,.15)','#bdeafe',700);cell(xs[1],y,cols[1],rowH*2,textFor('resumeColStore'),'rgba(56,189,248,.15)','#bdeafe',700);for(let i=0;i<brands.length;i++){const j=2+i*2;cell(xs[j],y,cols[j]+cols[j+1],rowH,brands[i].toUpperCase(),'rgba(20,34,56,.98)','#f6f8fc',700);cell(xs[j],y+rowH,cols[j],rowH,textFor('resumeColPoint'),'rgba(8,14,24,.94)','#81f2d8',700);cell(xs[j+1],y+rowH,cols[j+1],rowH,textFor('resumeColStatus'),'rgba(8,14,24,.94)','#81f2d8',700)}cell(xs[cols.length-2],y,cols.at(-2),rowH*2,textFor('resumeColAcv'),'rgba(56,189,248,.15)','#bdeafe',700);cell(xs[cols.length-1],y,cols.at(-1),rowH*2,textFor('resumeColAvg'),'rgba(56,189,248,.15)','#bdeafe',700);y+=rowH*2;const bgPoint=p=>p===null?['rgba(87,98,120,.25)','#cbd5e1']:p>=tf?['rgba(34,197,94,.22)','#bbf7d0']:p>=tf*.6?['rgba(250,204,21,.2)','#fde68a']:['rgba(244,63,94,.22)','#fecdd3'];const avg=arr=>{const v=arr.filter(x=>x.point!==null);return v.length?v.reduce((a,x)=>a+x.point,0)/v.length:null};const drawRow=(code,name,vals,isArea=false,index=0)=>{const base=isArea?'rgba(20,68,79,.52)':index%2?'rgba(255,255,255,.03)':'rgba(255,255,255,.05)';cell(xs[0],y,cols[0],rowH,code,base,'#f8fafc',700);cell(xs[1],y,cols[1],rowH,name.length>33?name.slice(0,31)+'…':name,base,'#f8fafc',700);vals.forEach((v,i)=>{const j=2+i*2;const [bgc,fgc]=bgPoint(v.point);cell(xs[j],y,cols[j],rowH,label(v.point),bgc,fgc,700);cell(xs[j+1],y,cols[j+1],rowH,status(v.point),base,'#b4c5d9',600)});cell(xs[cols.length-2],y,cols.at(-2),rowH,vals.filter(v=>v.point!==null&&v.point>=tf).length+'/'+vals.filter(v=>v.point!==null).length,base,'#f8fafc',700);const a=avg(vals);const [bgc,fgc]=bgPoint(a);cell(xs[cols.length-1],y,cols.at(-1),rowH,label(a),bgc,fgc,700);y+=rowH};per.forEach((r,i)=>drawRow(r.store.code,r.store.name,r.values,false,i));drawRow('AREA',textFor('resumeAreaLabel'),area,true);rect(pad,height-68,width-pad*2,38,14,'rgba(255,255,255,.05)','rgba(255,255,255,.08)');text('POINT AREA '+pct(overall.point)+'  •  ACV QTY '+pct(overall.aq)+'  •  ACV NS '+pct(overall.an)+'  •  ACV AREA = total aktual ÷ total target',width/2,height-49,14,'#d3def0',600);downloadCanvas(canvas,resumeFilename('dark'))}
function drawResumeGlass(data){const {brands,per,area,tf,overall,label,status,average}=data,scale=2;const width=Math.max(1260,460+brands.length*180+170),rowH=42,headerH=166,pad=34,height=headerH+(per.length+3)*rowH+110;const canvas=document.createElement('canvas');canvas.width=width*scale;canvas.height=height*scale;const c=canvas.getContext('2d');c.scale(scale,scale);const rect=(x,y,w,h,r,color,stroke='')=>{c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();c.fillStyle=color;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=1;c.stroke()}};const text=(v,x,y,size=14,color='#fff',weight=500,align='center')=>{c.fillStyle=color;c.font=`${weight} ${size}px Arial,sans-serif`;c.textAlign=align;c.textBaseline='middle';c.fillText(String(v),x,y)};const bg=c.createLinearGradient(0,0,width,height);bg.addColorStop(0,'#f3f7ff');bg.addColorStop(.5,'#eef4ff');bg.addColorStop(1,'#f9fbff');c.fillStyle=bg;c.fillRect(0,0,width,height);c.fillStyle='rgba(118,82,231,.08)';c.beginPath();c.arc(180,110,110,0,Math.PI*2);c.fill();c.fillStyle='rgba(17,185,202,.1)';c.beginPath();c.arc(width-170,140,120,0,Math.PI*2);c.fill();rect(pad,pad,width-pad*2,92,28,'rgba(255,255,255,.72)','rgba(118,132,172,.15)');text(textFor('resumeTitle'),pad+26,pad+32,30,'#111b36',700,'left');text(weekTitle(S.week)+' • hingga '+dateMini(viewDate())+' • Template Glass Soft',pad+26,pad+62,16,'#5d6b87',500,'left');rect(width-pad-250,pad+20,210,50,18,'rgba(118,82,231,.12)','rgba(118,82,231,.18)');text('AREA '+pct(overall.point),width-pad-145,pad+45,22,'#5d36d6',700);let y=headerH;const cols=[94,310,...brands.flatMap(()=>[84,96]),82,96];const tableW=cols.reduce((a,b)=>a+b,0);let xs=[(width-tableW)/2];for(const w of cols)xs.push(xs[xs.length-1]+w);rect(xs[0]-8,y-18,tableW+16,(per.length+2)*rowH+20,24,'rgba(255,255,255,.66)','rgba(150,162,192,.22)');const cell=(x,y,w,h,value,bg='rgba(255,255,255,.8)',fg='#162238',weight=600)=>{rect(x,y,w,h,0,bg,'rgba(161,171,196,.18)');text(value,x+w/2,y+h/2,12,fg,weight)};cell(xs[0],y,cols[0],rowH*2,textFor('resumeColCode'),'rgba(118,82,231,.12)','#4d2ebb',700);cell(xs[1],y,cols[1],rowH*2,textFor('resumeColStore'),'rgba(118,82,231,.12)','#4d2ebb',700);for(let i=0;i<brands.length;i++){const j=2+i*2;cell(xs[j],y,cols[j]+cols[j+1],rowH,brands[i].toUpperCase(),'rgba(17,185,202,.11)','#0f6b77',700);cell(xs[j],y+rowH,cols[j],rowH,textFor('resumeColPoint'),'rgba(239,244,255,.96)','#5b6b86',700);cell(xs[j+1],y+rowH,cols[j+1],rowH,textFor('resumeColStatus'),'rgba(239,244,255,.96)','#5b6b86',700)}cell(xs[cols.length-2],y,cols.at(-2),rowH*2,textFor('resumeColAcv'),'rgba(118,82,231,.12)','#4d2ebb',700);cell(xs[cols.length-1],y,cols.at(-1),rowH*2,textFor('resumeColAvg'),'rgba(118,82,231,.12)','#4d2ebb',700);y+=rowH*2;const bgPoint=p=>p===null?['rgba(225,231,240,.86)','#6b778c']:p>=tf?['rgba(185,247,210,.78)','#12643a']:p>=tf*.6?['rgba(255,238,179,.85)','#8d6511']:['rgba(255,210,215,.9)','#a12543'];const avg=arr=>{const v=arr.filter(x=>x.point!==null);return v.length?v.reduce((a,x)=>a+x.point,0)/v.length:null};const drawRow=(code,name,vals,isArea=false,index=0)=>{const base=isArea?'rgba(221,248,255,.92)':index%2?'rgba(255,255,255,.84)':'rgba(248,251,255,.92)';cell(xs[0],y,cols[0],rowH,code,base,'#111b36',700);cell(xs[1],y,cols[1],rowH,name.length>33?name.slice(0,31)+'…':name,base,'#111b36',700);vals.forEach((v,i)=>{const j=2+i*2;const [bgc,fgc]=bgPoint(v.point);cell(xs[j],y,cols[j],rowH,label(v.point),bgc,fgc,700);cell(xs[j+1],y,cols[j+1],rowH,status(v.point),base,'#5f6d85',600)});cell(xs[cols.length-2],y,cols.at(-2),rowH,vals.filter(v=>v.point!==null&&v.point>=tf).length+'/'+vals.filter(v=>v.point!==null).length,base,'#111b36',700);const a=avg(vals);const [bgc,fgc]=bgPoint(a);cell(xs[cols.length-1],y,cols.at(-1),rowH,label(a),bgc,fgc,700);y+=rowH};per.forEach((r,i)=>drawRow(r.store.code,r.store.name,r.values,false,i));drawRow('AREA',textFor('resumeAreaLabel'),area,true);rect(pad,height-76,width-pad*2,46,15,'rgba(255,255,255,.7)','rgba(176,186,210,.22)');text('ACV AREA memakai total aktual seluruh toko ÷ total target seluruh toko • TF '+pct(tf)+' • ACV QTY '+pct(overall.aq)+' • ACV NS '+pct(overall.an),width/2,height-53,14,'#56657f',600);downloadCanvas(canvas,resumeFilename('glass'))}

/* V24 — 4 template tambahan: output PNG resolusi tinggi, seluruh baris & brand. */
function drawResumeModern(data,mode){
 const palettes={
  executive:{title:'EXECUTIVE NAVY',bg:'#edf2f8',cover:'#112743',cover2:'#23496b',accent:'#32c9bf',ink:'#152b42',muted:'#677b90',head:'#d7e3ef',stripe:'#f5f8fc',white:'#ffffff',stroke:'#ced9e4',above:'#dcf6e9',below:'#ffe4e2',na:'#eff2f5',area:'#d4e9f7'},
  minimal:{title:'MINIMAL WHITE',bg:'#ffffff',cover:'#15191f',cover2:'#373e49',accent:'#333b46',ink:'#1c2430',muted:'#637082',head:'#e9edf1',stripe:'#f7f9fa',white:'#ffffff',stroke:'#dce2e8',above:'#e0f5e7',below:'#ffe8e1',na:'#f2f4f5',area:'#dce7ee'},
  emerald:{title:'EMERALD PRO',bg:'#ecf6f1',cover:'#103d31',cover2:'#1d6755',accent:'#b3fdc2',ink:'#173c33',muted:'#667d72',head:'#d6efe2',stripe:'#f4faf6',white:'#ffffff',stroke:'#cbded2',above:'#d8f6db',below:'#ffe9dc',na:'#e9f1ed',area:'#c2e9d5'},
  sunset:{title:'SUNSET CORAL',bg:'#fff6ee',cover:'#5b2837',cover2:'#a84e59',accent:'#ffcf9c',ink:'#4d3038',muted:'#886e72',head:'#ffe2d4',stripe:'#fff8f3',white:'#ffffff',stroke:'#ead3ca',above:'#e1f4df',below:'#ffe1de',na:'#f7efec',area:'#ffd2c1'}
 };
 const p=palettes[mode]||palettes.executive;
 const {brands,per,area,tf,overall,label,status,average}=data;
 const col=[90,280,...brands.flatMap(()=>[106,116]),86,106];
 const totalWidth=col.reduce((a,b)=>a+b,0);
 const margin=42, width=Math.max(1200,totalWidth+2*margin),scale=2, rowH=47,headH=46;
 const top=200, tableHeight=headH*2+rowH*(per.length+1);
 const height=top+tableHeight+116;
 const canvas=document.createElement('canvas');canvas.width=width*scale;canvas.height=height*scale;
 const c=canvas.getContext('2d');c.scale(scale,scale);
 const block=(x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(x,y,w,h)};
 const txt=(value,x,y,size=14,color=p.ink,weight=600,align='left',maxWidth=9999)=>{
  c.fillStyle=color;c.font=`${weight} ${size}px Arial,sans-serif`;
  c.textAlign=align;c.textBaseline='middle';
  let v=String(value??'');
  while(v.length>2&&c.measureText(v).width>maxWidth)v=v.slice(0,-2)+'…';
  c.fillText(v,x,y);
 };
 const cell=(x,y,w,h,value,bg,fg=p.ink,weight=600,font=13,align='center')=>{
  block(x,y,w,h,bg);c.strokeStyle=p.stroke;c.lineWidth=.75;c.strokeRect(x+.375,y+.375,w-.75,h-.75);
  txt(value,align==='left'?x+12:x+w/2,y+h/2,font,fg,weight,align,w-20);
 };
 const statusBg=point=>point===null?p.na:point>=tf?p.above:p.below;
 const start=(width-totalWidth)/2;const xs=[start];for(const w of col)xs.push(xs.at(-1)+w);
 block(0,0,width,height,p.bg);
 // Header berwarna, nama template dan tanggal pantau.
 const grad=c.createLinearGradient(0,0,width,0);grad.addColorStop(0,p.cover);grad.addColorStop(1,p.cover2);
 block(0,0,width,158,grad);block(0,158,width,5,p.accent);
 txt('RPM AREA 12 • RESUME PER BRAND',start,42,29,'#ffffff',800,'left',width-360);
 txt(weekTitle(S.week)+'  |  Hingga '+viewDateLabel(viewDate()),start,83,18,'#e9f1f6',500,'left',width-360);
 txt(p.title,start,117,14,p.accent,700,'left');
 block(width-305,38,260,80,'#ffffff1b');
 txt('TIME FACTOR',width-175,60,13,'#e8f2f3',650,'center');
 txt(pct(tf),width-175,91,29,p.accent,800,'center');
 let y=top;
 cell(xs[0],y,col[0],headH*2,'KODE',p.head,p.ink,750,13);
 cell(xs[1],y,col[1],headH*2,'NAMA TOKO',p.head,p.ink,750,13);
 for(let i=0;i<brands.length;i++){
  const j=2+i*2;
  cell(xs[j],y,col[j]+col[j+1],headH,brands[i].toUpperCase(),p.head,p.ink,800,13);
  cell(xs[j],y+headH,col[j],headH,'POINT',p.stripe,p.ink,700,12);
  cell(xs[j+1],y+headH,col[j+1],headH,'STATUS',p.stripe,p.ink,700,12);
 }
 cell(xs.at(-3),y,col.at(-2),headH*2,'ACV',p.head,p.ink,750,13);
 cell(xs.at(-2),y,col.at(-1),headH*2,'AVG',p.head,p.ink,750,13);
 y+=headH*2;
 const row=(code,name,values,index,isArea=false)=>{
  const bg=isArea?p.area:(index%2===0?p.white:p.stripe);
  cell(xs[0],y,col[0],rowH,code,bg,p.ink,800,13);
  cell(xs[1],y,col[1],rowH,name,bg,p.ink,isArea?800:600,13,'left');
  values.forEach((v,i)=>{
   const j=2+i*2;
   cell(xs[j],y,col[j],rowH,label(v.point),statusBg(v.point),p.ink,700,13);
   cell(xs[j+1],y,col[j+1],rowH,status(v.point),statusBg(v.point),p.ink,700,11);
  });
  const active=values.filter(v=>v.point!==null);
  cell(xs.at(-3),y,col.at(-2),rowH,active.filter(v=>v.point>=tf).length+' / '+active.length,bg,p.ink,700,13);
  const avg=average(values);cell(xs.at(-2),y,col.at(-1),rowH,label(avg),statusBg(avg),p.ink,800,13);
  y+=rowH;
 };
 per.forEach((r,i)=>row(r.store.code,r.store.name,r.values,i));
 row('AREA',textFor('resumeAreaLabel'),area,per.length,true);
 // Ringkasan bawaan gambar dipotong sampai tanggal terpilih.
 block(start,y+22,totalWidth,58,p.head);
 txt('POINT AREA: '+pct(overall.point),start+18,y+50,18,p.ink,800,'left',235);
 txt('QTY: '+pct(overall.aq)+'    NET SALES: '+pct(overall.an),start+250,y+50,16,p.ink,700,'left',totalWidth-280);
 txt('Status dihitung terhadap TF '+pct(tf)+' • ACV area = total aktual / total target seluruh toko.',start,height-25,13,p.muted,500,'left',totalWidth);
 downloadCanvas(canvas,resumeFilename(mode));
}

function renderInput(){waRenderDate();const stores=storeEntries(),sel=$('#inputStore');if(!stores.some(x=>x.code===S.inputStore))S.inputStore=stores[0]?.code||'';sel.innerHTML=stores.map(s=>`<option value="${escapeHTML(s.code)}" ${S.inputStore===s.code?'selected':''}>${escapeHTML(s.code+' · '+s.name)}</option>`).join('')||'<option value="">Belum ada toko</option>';$('#addPlu').disabled=!S.inputStore;const s=wk().stores?.[S.inputStore],c=s?compute(s):null;$('#inputWeekLabel').textContent=weekTitle(S.week);$('#inputStoreTitle').textContent=s?`${s.code} · ${s.name}`:'Pilih toko terlebih dahulu';const sortField=$('#inputSort');if(sortField)sortField.value=S.inputSort||'brand-asc';const searchField=$('#inputSearch');if(searchField&&searchField!==document.activeElement)searchField.value=S.inputFilter||'';$('#inputSummary').innerHTML=c?[['Target QTY',fmt(s.targetQty)],['Aktual QTY',fmt(c.qty)],['Sub NS',money(c.ns)],['POINT',pct(c.pt)]].map(([k,v])=>`<div class="smallstat"><span>${k}</span><strong>${v}</strong></div>`).join(''):'<div class="smallstat" style="grid-column:1/-1"><span>Belum ada toko. Tambahkan toko di halaman Master Toko & Excel.</span></div>';
renderInputRows(s,c)}
function renderInputRows(s,c){const sortedItems=sortStoreItems(s?.items||[],S.inputSort||'brand-asc',S.inputFilter||'');const totalCount=s?.items?.length||0;const sortMeta=$('#inputSortMeta');if(sortMeta)sortMeta.textContent=(S.inputFilter?sortedItems.length+' dari '+totalCount:'Semua '+totalCount)+' PLU • Urutan '+inputSortLabel(S.inputSort||'brand-asc');const rows=sortedItems.map((item,idx)=>{const q=(item.days||[]).reduce((x,y)=>x+number(y),0);return `<tr data-id="${escapeHTML(item.id)}"><td class="sticky-col"><input class="plu" data-field="plu" value="${escapeHTML(item.plu)}" aria-label="PLU ${idx+1}"></td><td><input class="brand" data-field="brand" value="${escapeHTML(item.brand||'')}" aria-label="Brand ${idx+1}"></td><td><input class="description" data-field="description" value="${escapeHTML(item.description||'')}" aria-label="Deskripsi ${idx+1}"></td><td><input class="hpp" data-field="hpp" type="number" min="0" step="any" value="${number(item.hpp)}" aria-label="HPP ${idx+1}"></td>${Array.from({length:7},(_,i)=>`<td><input class="qty" type="number" min="0" step="any" data-day="${i}" value="${number(item.days?.[i])||''}" placeholder="0" aria-label="QTY ${dayNames[i]} PLU ${escapeHTML(item.plu)}"></td>`).join('')}<td><b>${fmt(q)}</b></td><td><b>${money(q*number(item.hpp))}</b></td><td><button class="tinybtn" data-delete-item="${escapeHTML(item.id)}" type="button" title="Hapus PLU">×</button></td></tr>`}).join('');$('#entryBody').innerHTML=rows||`<tr><td class="table-empty" colspan="14">${totalCount?'Tidak ada PLU yang cocok.':'Belum ada PLU untuk toko ini. Tekan + PLU atau upload Excel LIST PLU.'}</td></tr>`;$('#entryFoot').innerHTML=c?`<tr><td colspan="4">TOTAL ${escapeHTML(s.name)}</td>${c.days.map(v=>`<td>${money(v)}</td>`).join('')}<td>${fmt(c.qty)}</td><td>${money(c.ns)}</td><td></td></tr>`:''}
function renderMaster(){const stores=storeEntries();$('#masterSub').textContent=stores.length+' dari 12 toko terisi · '+weekTitle(S.week);$('#masterBody').innerHTML=stores.map(s=>`<tr data-store="${escapeHTML(s.code)}"><td><strong>${escapeHTML(s.code)}</strong></td><td>${escapeHTML(s.name)}${s.brandTargets&&Object.keys(s.brandTargets).length?`<details class="brand-target-details"><summary>${Object.keys(s.brandTargets).length} brand · lihat rincian target</summary><div class="brand-target-list">${Object.entries(s.brandTargets).map(([b,t])=>`<div><span>${escapeHTML(b)}</span><b>${fmt(t.qty)} QTY</b><b>${money(t.ns)}</b></div>`).join('')}</div></details>`:''}</td><td>${fmt(s.targetQty)}</td><td>${money(s.targetNS)}</td><td>${s.items?.length||0} PLU</td><td><div class="actions"><button class="btn secondary" type="button" data-edit-store="${escapeHTML(s.code)}">Edit</button><button class="btn danger" type="button" data-delete-store="${escapeHTML(s.code)}">Hapus</button></div></td></tr>`).join('')||'<tr><td colspan="6" class="table-empty">Belum ada toko untuk minggu ini. Upload Excel atau tekan Tambah Toko.</td></tr>'}
function renderHistory(){const weeks=Object.keys(S.weeks).filter(w=>monthWeeks(S.month).includes(w)).sort(),html=weeks.map(w=>{const ss=Object.values(S.weeks[w]?.stores||{});const c=areaCalc(ss);return `<div class="history-card"><h3>📅 ${escapeHTML(weekTitle(w))}</h3><p>${ss.length} toko • Target QTY ${fmt(c.qty)} • Target NS ${money(c.ns)}</p><strong>${pct(c.point)}</strong><span class="pill muted" style="margin-left:10px">POINT 50/50</span><div class="history-pills"><button type="button" data-open-week="${w}" class="btn secondary">Lihat Minggu</button></div></div>`}).join('');$('#historyContent').innerHTML=html||'<div class="history-card"><h3>Belum ada riwayat untuk bulan ini</h3><p>Data minggu lain akan tersimpan dan ditampilkan di sini.</p></div>'}
function render(){renderShell();if(S.page==='dashboard')renderDashboard();else if(S.page==='input')renderInput();else if(S.page==='stores')renderMaster();else if(S.page==='history')renderHistory();else if(S.page==='settings')renderSettings()}
function switchPage(page){S.page=page;saveViewPreference();render();window.scrollTo({top:0,behavior:'smooth'})}
function changeMonth(delta){const [year,month]=S.month.split('-').map(Number);const d=new Date(year,month-1+delta,1);S.month=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');const candidates=monthWeeks(S.month);S.week=candidates.includes(monday(today()))?monday(today()):candidates[0]||monday(today());saveViewPreference();render()}
function storeUpsert(code,name,targetQty,targetNS,oldCode){const items=wk(true).stores;code=String(code||'').trim();if(!code||!name)throw Error('Kode dan nama toko wajib diisi.');if((!oldCode||code!==oldCode)&&Object.keys(items).length>=12&&!items[code])throw Error('Maksimal 12 toko pada satu minggu.');if(oldCode&&oldCode!==code&&items[code])throw Error('Kode toko sudah terdaftar.');let prev=oldCode?items[oldCode]:items[code];if(oldCode&&oldCode!==code)delete items[oldCode];items[code]={code,name:String(name).trim(),targetQty:number(targetQty),targetNS:number(targetNS),items:prev?.items||[],brandTargets:prev?.brandTargets||{},reportedDays:prev?.reportedDays||{}};S.inputStore=code;save();render()}
function makeItem(p){return{id:newid(),plu:String(p.plu||'').trim(),brand:String(p.brand||''),description:String(p.description||''),hpp:number(p.hpp),days:Array(7).fill(0)}}
function addItem(plu,brand,description,hpp){const s=wk(true).stores[S.inputStore];if(!s)throw Error('Pilih toko terlebih dahulu.');if(s.items.some(it=>it.plu===plu))throw Error('PLU sudah ada untuk toko ini.');s.items.push(makeItem({plu,brand,description,hpp}));save();renderInput()}
function download(filename,content,mime){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([content],{type:mime}));a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)}
const safeCSV=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
function csvExport(rows,filename){download(filename,'\ufeff'+rows.map(x=>x.map(safeCSV).join(',')).join('\r\n'),'text/csv;charset=utf-8')}
function scoreCsv(){const asOf=viewDate(),rows=[['MINGGU','TANGGAL PANTAU','KODE TOKO','NAMA TOKO','TARGET QTY','TARGET NS','AKTUAL QTY','AKTUAL NS','ACV QTY %','ACV NS %','POINT QTY 50%','POINT NS 50%','TOTAL POINT %','TF %','KETERANGAN']];for(const s of storeEntries()){const c=compute(s,asOf);rows.push([S.week,asOf,s.code,s.name,s.targetQty,s.targetNS,c.qty,c.ns,c.aq??'',c.an??'',c.aq===null?'':c.aq*.5,c.an===null?'':c.an*.5,c.pt??'',c.tf,c.status])}return rows}
function backup(){download('Backup_SalesPulse_Area_'+today()+'.json',JSON.stringify({...S,exportedAt:new Date().toISOString()},null,2),'application/json')}
function applyImport(parsed){const newStores=parsed.stores||[],newItems=parsed.items||[];if(newStores.length>12)throw Error('Excel berisi '+newStores.length+' toko. Batas versi area ini 12 toko per minggu.');if(!newStores.length)throw Error('Tidak ada toko yang berhasil dibaca.');const current=wk().stores||{},hasExisting=Object.keys(current).length>0;const replace=hasExisting?confirm('Minggu '+weekTitle(S.week)+' sudah memiliki '+Object.keys(current).length+' toko. Tekan OK untuk MEMPERBARUI target/list PLU (QTY sebelumnya dipertahankan untuk PLU yang cocok). Cancel untuk batal.') :true;if(!replace)return;const obj={};for(const st of newStores){const old=current[st.code],entries=(newItems||[]).filter(p=>p.code===st.code);const existsMap=new Map((old?.items||[]).map(i=>[String(i.plu),i]));let items;if(entries.length){items=entries.map(i=>{const exist=existsMap.get(String(i.plu));return{...makeItem(i),id:exist?.id||newid(),hpp:i.hpp===null||i.hpp===undefined?number(exist?.hpp):number(i.hpp),days:exist?.days||Array(7).fill(0)}})}else items=old?.items||[];obj[st.code]={code:String(st.code),name:st.name||old?.name||st.code,targetQty:number(st.targetQty),targetNS:number(st.targetNS),brandTargets:st.brandTargets||old?.brandTargets||{},reportedDays:old?.reportedDays||{},items}}S.weeks[S.week]={stores:obj};S.inputStore=newStores[0].code;save();render();toast('Terimpor '+newStores.length+' toko · '+(parsed.catalogCount??newItems.length)+' PLU · '+(parsed.brands?.length||'')+' brand · '+(parsed.hppCount??'')+' HPP ke '+weekTitle(S.week));if(parsed.format==='area-brand-matrix'&&newStores.length<12)alert('Impor selesai: file memuat '+newStores.length+' toko dari kapasitas 12 toko. '+(12-newStores.length)+' toko sisanya bisa ditambahkan manual. Target total toko merupakan penjumlahan target semua brand. Jika kolom HPP terdapat dalam Excel, harganya otomatis masuk untuk semua toko. HPP dapat diedit per PLU.')}

/* Text laporan WhatsApp: impor QTY satu tanggal, terpisah per toko dan minggu. */
let waWeek=null,waDay='',waDraft=null;
function waResetPreview(message){waDraft=null;const btn=$('#waApplyBtn');if(btn)btn.disabled=true;const panel=$('#waPreview');if(panel)panel.innerHTML='<div class="wa-empty">'+escapeHTML(message||'Tempel chat WhatsApp dan klik Periksa Laporan.')+'</div>'}
function waRenderDate(){const field=$('#waDaySelect');if(!field)return;const changed=waWeek!==S.week;if(changed){waWeek=S.week;waDay=(today()>=S.week&&today()<=addDays(S.week,6))?today():'';waResetPreview('Pilih tanggal penjualan dan periksa kembali chat untuk minggu ini.')}const sel=waDay;field.innerHTML='<option value="">— Pilih tanggal penjualan —</option>'+Array.from({length:7},(_,i)=>{const d=addDays(S.week,i);return `<option value="${d}" ${sel===d?'selected':''}>${dayNames[i]} · ${dateMini(d)} ${pdate(d).getFullYear()}</option>`}).join('');field.value=sel;}
function waClean(line){return String(line||'').replace(/[\u200b-\u200f\u2060\uFEFF]/g,'').replace(/\u00a0/g,' ').replace(/^\s*[>•-]+\s*/, '').trim()}
function waBrand(s){const clean=String(s||'').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g,'');return clean==='hs'||clean==='headshoulders'?'headshoulders':clean}
function waPeriodOK(period,week){
 if(!period)return true;
 const months={'jan':1,'januari':1,'feb':2,'februari':2,'mar':3,'maret':3,'apr':4,'april':4,'mei':5,'may':5,'jun':6,'juni':6,'jul':7,'juli':7,'agu':8,'ags':8,'agustus':8,'aug':8,'sep':9,'sept':9,'september':9,'okt':10,'oct':10,'oktober':10,'october':10,'nov':11,'november':11,'des':12,'dec':12,'desember':12,'december':12};
 const normalized=String(period||'').trim();
 // Bisa memeriksa kedua gaya: 2-8 Nov maupun 26 Okt - 1 Nov.
 const sameMonth=normalized.match(/^(\d{1,2})\s*[-–—]\s*(\d{1,2})\s+([a-zA-Z]+)(?:\s+(\d{4}))?$/i);
 let startDay,endDay,startMonth,endMonth,year;
 if(sameMonth){startDay=Number(sameMonth[1]);endDay=Number(sameMonth[2]);startMonth=endMonth=months[sameMonth[3].toLowerCase()];year=sameMonth[4]&&Number(sameMonth[4]);}
 else{const crossMonth=normalized.match(/^(\d{1,2})\s+([a-zA-Z]+)\s*[-–—]\s*(\d{1,2})\s+([a-zA-Z]+)(?:\s+(\d{4}))?$/i);if(!crossMonth)return null;startDay=Number(crossMonth[1]);startMonth=months[crossMonth[2].toLowerCase()];endDay=Number(crossMonth[3]);endMonth=months[crossMonth[4].toLowerCase()];year=crossMonth[5]&&Number(crossMonth[5]);}
 if(!startMonth||!endMonth)return null;
 const begin=pdate(week),end=pdate(addDays(week,6));
 return startDay===begin.getDate()&&startMonth===begin.getMonth()+1&&endDay===end.getDate()&&endMonth===end.getMonth()+1&&(!year||year===end.getFullYear());
}
function waTemplatePeriod(week){const begin=pdate(week),end=pdate(addDays(week,6));return begin.getMonth()===end.getMonth()&&begin.getFullYear()===end.getFullYear()?begin.getDate()+'-'+end.getDate()+' '+longMonths[end.getMonth()].slice(0,3):dateMini(week)+' - '+dateMini(addDays(week,6))}
function waBuildTemplate(store,week){
 const items=sortStoreItems(store?.items||[],'brand-asc');
 const lines=['Format RPM per PLU','Periode: '+waTemplatePeriod(week),'Kode Toko: '+String(store.code||''),''];
 let current=null;
 for(const item of items){const brand=String(item.brand||'LAINNYA').trim().toUpperCase();if(brand!==current){if(current!==null)lines.push('');lines.push('✅*'+brand+'*');current=brand}lines.push(String(item.plu).trim()+'/')}
 return lines.join('\n');
}
async function waCopyTemplate(){
 const store=wk().stores?.[S.inputStore];
 if(!store){toast('Pilih toko dengan master PLU terlebih dahulu.');return}
 if(!store.items?.length){toast('Daftar PLU toko ini masih kosong. Upload Excel terlebih dahulu.');return}
 const text=waBuildTemplate(store,S.week);
 // Clipboard membutuhkan HTTPS; fallback memasukkan template ke kotak edit agar tetap bisa disalin.
 try{if(!navigator.clipboard?.writeText)throw Error('Clipboard tidak tersedia');await navigator.clipboard.writeText(text);toast('✅ Template '+store.code+' ('+store.items.length+' PLU) disalin ke clipboard. Tempel ke WhatsApp.');}
 catch(err){const box=$('#waText');if(box.value.trim()&&!confirm('Clipboard tidak tersedia. Ganti isi kotak chat dengan template '+store.code+'?'))return;box.value=text;waResetPreview('Template dibuat untuk '+store.code+'. Salin isinya dari kotak chat.');box.focus();box.select();toast('Template ditaruh di kotak chat. Tekan Salin pada menu HP.');}
}
function waParse(text){
 const result={store:'',storeHeader:false,period:'',entries:[],totals:[],issues:[],unrecognized:[]};
 let brand='';const lines=String(text||'').split(/\r?\n/);
 if(lines.length>1200)throw Error('Chat terlalu panjang, batasi 1 laporan toko tiap proses.');
 for(let i=0;i<lines.length;i++){
  let line=waClean(lines[i]);if(!line)continue;
  if(/^format\s+rpm\s*(?:\/|per)\s*plu\s*$/i.test(line))continue;
  let match=line.match(/^periode\s*[:：]\s*(.*?)\s*$/i);
  if(match){result.period=match[1].trim();continue}
  match=line.match(/^(?:kode\s+)?toko\s*[:：]\s*(.*?)\s*$/i);
  if(match){result.storeHeader=true;result.store=match[1].trim().toUpperCase();continue}
  match=line.match(/^\*?total\s*\/\s*([\d.,]+)\s*\*?$/i);
  if(match){if(!brand)result.issues.push('Baris '+(i+1)+': Total tanpa nama brand.');else result.totals.push({brand,declared:Number(match[1].replace(/[,.]/g,'')),line:i+1});continue}
  match=line.match(/^[✅✔☑]\s*(.+?)\s*$/u);
  if(match){brand=match[1].trim().replace(/^\*+|\*+$/g,'').replace(/[:\s]+$/g,'').trim();continue}
  match=line.match(/^\*?(\d{4,14})\s*\/\s*(\d*)\s*\*?$/);
  if(match){if(!brand)result.issues.push('Baris '+(i+1)+': PLU '+match[1]+' belum memiliki judul brand (✅ ...).');result.entries.push({plu:match[1],qty:match[2]?Number(match[2]):0,emptyQty:match[2]==='',brand:brand||'(tanpa brand)',line:i+1});continue}
  if(/^\*+$/.test(line)||/^[-=\s]+$/.test(line))continue;
  result.unrecognized.push('Baris '+(i+1)+': '+line.slice(0,75));
 }
 return result;
}
function waPreviewReport(){const pane=$('#waPreview'),btn=$('#waApplyBtn'),text=$('#waText').value.trim();btn.disabled=true;waDraft=null;if(!text){waResetPreview('Salin dan tempel teks laporan WhatsApp terlebih dahulu.');return}if(!waDay){waResetPreview('Pilih tanggal penjualan sebelum memeriksa teks.');return}let report;try{report=waParse(text)}catch(e){waResetPreview(e.message);return}const problems=[...report.issues],warnings=[];if(!report.entries.length)problems.push('Tidak ditemukan PLU/QTY. Contoh: 265287/6');const fallbackStore=!report.store&&report.storeHeader&&S.inputStore;const effectiveCode=report.store|| (fallbackStore?S.inputStore:'');if(!effectiveCode)problems.push('Isi baris "Kode Toko: SC94" (atau "Toko: SC94") agar laporan tidak masuk ke toko yang salah.');if(fallbackStore)warnings.push('Kode Toko pada chat kosong. Laporan akan diarahkan ke toko yang sedang dipilih: '+S.inputStore+'. Pastikan sudah benar.');const store=storeEntries().find(x=>String(x.code).toUpperCase()===effectiveCode);if(effectiveCode&&!store)problems.push('Toko '+effectiveCode+' belum ada pada minggu '+weekTitle(S.week)+'. Upload target toko terlebih dahulu.');if(report.period){const same=waPeriodOK(report.period,S.week);if(same===false)problems.push('Periode WA ('+report.period+') berbeda dari minggu '+weekTitle(S.week)+'. Pilih minggu yang sesuai.');else if(same===null)warnings.push('Periode "'+report.period+'" tidak bisa divalidasi. Periksa minggu yang dipilih.')}else warnings.push('Laporan tanpa baris Periode. Pastikan minggu terpilih sudah benar.');if(report.unrecognized.length)warnings.push('Baris tidak dikenali: '+report.unrecognized.join(' | '));const entriesByPlu=new Map();for(const e of report.entries){if(entriesByPlu.has(e.plu))problems.push('PLU '+e.plu+' dilaporkan lebih dari sekali (baris '+e.line+').');entriesByPlu.set(e.plu,e)}for(const total of report.totals){const actual=report.entries.filter(e=>waBrand(e.brand)===waBrand(total.brand)).reduce((sum,e)=>sum+e.qty,0);if(actual!==total.declared)problems.push('Total '+total.brand+' tidak cocok: chat '+total.declared+', jumlah PLU '+actual+'.')}
const catalog=store?new Map((store.items||[]).map(i=>[String(i.plu).trim(),i])):new Map();const unknown=report.entries.filter(e=>!catalog.has(e.plu));const addUnknown=$('#waAddUnknown').checked;if(unknown.length&&!addUnknown)problems.push(unknown.length+' PLU belum ada di Master: '+unknown.map(e=>e.plu).join(', ')+'. Centang opsi tambah PLU dengan HPP Rp0 jika memang produk baru.');if(unknown.length&&addUnknown)warnings.push(unknown.length+' PLU baru akan dibuat dengan HPP Rp0. Lengkapi HPP sesudah impor sebelum memakai angka Net Sales.');if(store&&report.entries.length){const offBrands=report.entries.filter(e=>{const item=catalog.get(e.plu);return item&&waBrand(e.brand)!==waBrand(item.brand)});if(offBrands.length)warnings.push('Nama brand berbeda di '+offBrands.length+' baris dibanding katalog. Pencocokan tetap berdasarkan kode PLU.');}if(report.totals.length===0)warnings.push('Tidak ada ringkasan Total/brand. QTY dihitung langsung dari tiap PLU.');const totalQty=report.entries.reduce((a,e)=>a+e.qty,0);const emptyQtyCount=report.entries.filter(e=>e.emptyQty).length;if(emptyQtyCount===report.entries.length&&report.entries.length)problems.push('Semua '+emptyQtyCount+' QTY masih kosong (PLU/). Isi angka QTY dahulu sebelum menyimpan supaya data sebelumnya tidak terhapus. Jika penjualan nol, tulis PLU/0.');else if(emptyQtyCount)warnings.push(emptyQtyCount+' PLU bertanda / tanpa angka akan dibaca QTY 0. Pastikan ini sesuai laporan.');const title=store?store.code+' · '+store.name:effectiveCode||'Belum ditentukan';let out=`<div class="wa-resulthead"><span>Hasil baca: ${escapeHTML(title)}</span><span>${escapeHTML(waDay)} · ${escapeHTML(dayNames[(pdate(waDay).getDay()+6)%7])}</span></div><div class="wa-badges"><span class="wa-badge">${report.entries.length} PLU</span><span class="wa-badge">${fmt(totalQty)} QTY</span><span class="wa-badge">${report.totals.length} Total brand dicek</span><span class="wa-badge">${unknown.length} PLU baru</span></div>`;for(const x of problems)out+=`<div class="wa-notice bad">⛔ ${escapeHTML(x)}</div>`;for(const x of warnings)out+=`<div class="wa-notice warn">⚠ ${escapeHTML(x)}</div>`;if(!problems.length)out+='<div class="wa-notice good">✅ Format cocok. Periksa jumlah di tabel sebelum simpan.</div>';out+='<div class="wa-tablewrap"><table class="wa-previewtable"><thead><tr><th>Brand</th><th>PLU</th><th>QTY</th><th>HPP</th><th>Penanda</th></tr></thead><tbody>'+report.entries.map(e=>{const it=catalog.get(e.plu);return `<tr><td>${escapeHTML(e.brand)}</td><td><b>${escapeHTML(e.plu)}</b></td><td class="num">${fmt(e.qty)}</td><td>${it?money(it.hpp):'Rp0'}</td><td>${it?'Terdaftar':'PLU Baru'}</td></tr>`}).join('')+'</tbody></table></div>';pane.innerHTML=out;if(!problems.length){waDraft={week:S.week,date:waDay,storeCode:store.code,report,addUnknown,mode:$('#waSaveMode').value,usedFallbackStore:Boolean(fallbackStore)};btn.disabled=false}}
function waApplyReport(){if(!waDraft)return;const d=waDraft;if(d.week!==S.week||d.date!==waDay||d.mode!==$('#waSaveMode').value||d.addUnknown!==$('#waAddUnknown').checked){waResetPreview('Pilihan berubah. Tekan Periksa Laporan lagi.');return}const store=wk().stores[d.storeCode];if(!store){waResetPreview('Toko tidak ditemukan pada minggu ini.');return}const dayIndex=Math.round((pdate(d.date)-pdate(S.week))/86400000);if(dayIndex<0||dayIndex>6){waResetPreview('Tanggal berada di luar minggu yang dipilih.');return}const qty=d.report.entries.reduce((a,e)=>a+e.qty,0);const message=`Simpan laporan WA untuk toko ${d.storeCode} pada ${d.date}?\n${d.report.entries.length} PLU · ${qty} QTY.\nMode: ${d.mode==='replace'?'GANTI nilai pada PLU yang disebut':'TAMBAH ke QTY sebelumnya'}.\nPLU lain pada hari tersebut TIDAK diubah.`;if(!confirm(message+(d.usedFallbackStore?'\n⚠ KODE TOKO DI CHAT KOSONG. Data akan dimasukkan ke toko terpilih: '+d.storeCode+'.':'')))return;const lookup=new Map((store.items||[]).map(i=>[String(i.plu).trim(),i]));for(const entry of d.report.entries){let item=lookup.get(entry.plu);if(!item&&d.addUnknown){item=makeItem({plu:entry.plu,brand:entry.brand,description:'',hpp:0});store.items.push(item);lookup.set(entry.plu,item)}if(!item)continue;if(!Array.isArray(item.days))item.days=Array(7).fill(0);item.days[dayIndex]=d.mode==='add'?number(item.days[dayIndex])+entry.qty:entry.qty}markDayReported(store,d.date,'whatsapp');S.inputStore=d.storeCode;save();renderInput();waResetPreview('✅ Tersimpan: '+d.storeCode+' • '+dateMini(d.date)+' • '+fmt(qty)+' QTY dari '+d.report.entries.length+' PLU. Jika Cloud aktif, perubahan dikirim melalui sinkronisasi yang sama.');toast('Laporan WhatsApp tersimpan untuk '+d.storeCode+' · '+dateMini(d.date))}
function waWire(){const reset=()=>waResetPreview('Input berubah. Klik Periksa Laporan sebelum menyimpan.');$('#waText').addEventListener('input',reset);$('#waDaySelect').addEventListener('change',e=>{waDay=e.target.value;reset()});$('#waSaveMode').addEventListener('change',reset);$('#waAddUnknown').addEventListener('change',reset);$('#waPreviewBtn').addEventListener('click',waPreviewReport);$('#waApplyBtn').addEventListener('click',waApplyReport);$('#waClearBtn').addEventListener('click',()=>{$('#waText').value='';reset()});$('#waTemplateBtn').addEventListener('click',waCopyTemplate)}

function setupDialogs(){$$('[data-close]').forEach(b=>b.addEventListener('click',()=>document.getElementById(b.dataset.close).close()));$('#themeOpen').addEventListener('click',()=>{$('#themeOptions').innerHTML=Object.entries(themes).map(([id,[name,a,b]])=>`<button type="button" data-theme-option="${id}" class="theme-btn ${S.theme===id?'selected':''}"><div class="theme-sample" style="background:linear-gradient(110deg,${a},${b})"></div><strong>${name}</strong></button>`).join('');$('#themeDialog').showModal()});$('#textOpen').addEventListener('click',()=>{const f=$('#editTextForm');for(const [key,value] of Object.entries(S.settings))if(f.elements.namedItem(key))f.elements.namedItem(key).value=value;$('#textDialog').showModal()});$('#editTextForm').addEventListener('submit',e=>{e.preventDefault();const f=e.currentTarget;for(const k of Object.keys(defaults))S.settings[k]=String(f.elements.namedItem(k).value||defaults[k]);save('ui');renderShell();$('#textDialog').close();toast('Judul dan keterangan diperbarui')});$('#storeForm').addEventListener('submit',e=>{e.preventDefault();const f=e.currentTarget;try{storeUpsert(f.elements.code.value,f.elements.name.value,f.elements.targetQty.value,f.elements.targetNS.value,f.elements.oldCode.value);$('#storeDialog').close();toast('Data toko tersimpan untuk minggu terpilih')}catch(err){alert(err.message)}});$('#pluForm').addEventListener('submit',e=>{e.preventDefault();const f=e.currentTarget;try{addItem(f.elements.plu.value.trim(),f.elements.brand.value.trim(),f.elements.description.value.trim(),f.elements.hpp.value);$('#pluDialog').close();f.reset()}catch(err){alert(err.message)}})}
function openStore(code){const existing=wk().stores[code],f=$('#storeForm');f.reset();f.elements.oldCode.value=existing?.code||'';f.elements.code.value=existing?.code||'';f.elements.name.value=existing?.name||'';f.elements.targetQty.value=existing?.targetQty??0;f.elements.targetNS.value=existing?.targetNS??0;$('#storeDialogTitle').textContent=existing?'Edit Target Toko':'Tambah Toko';$('#storeDialog').showModal()}
function wireEvents(){$('#exportResumePng').onclick=exportResumeImage;$('#resumeStyle').onchange=e=>{S.resumeStyle=e.target.value||'classic';saveViewPreference();renderResume();toast('Template PNG dipilih: '+({classic:'Tabel Klasik',dark:'Dark Neon',glass:'Glass Soft',executive:'Executive Navy',minimal:'Minimal White',emerald:'Emerald Pro',sunset:'Sunset Coral'}[S.resumeStyle]||'Tabel Klasik'))};$('#prevMonth').onclick=()=>changeMonth(-1);$('#nextMonth').onclick=()=>changeMonth(1);$('#monthInput').onchange=e=>{const ym=e.target.value;if(!/^\d{4}-\d{2}$/.test(ym))return;S.month=ym;const options=monthWeeks(ym);S.week=options.includes(monday(today()))?monday(today()):options[0]||monday(today());saveViewPreference();render()};$('#storeSearch').oninput=e=>{S.search=e.target.value;renderDashboard()};$('#goalStoreFilter').onchange=e=>{goalFilter=e.target.value;renderGoals()};$('#goalStoreCards').addEventListener('change',e=>{const pick=e.target.closest('[data-goal-plu]');if(!pick)return;goalPLU[pick.dataset.goalPlu]=pick.value;renderGoals()});$('#dailyReportDate').onchange=e=>setViewDate(e.target.value);$('#tfPrevDay').onclick=()=>shiftViewDate(-1);$('#tfNextDay').onclick=()=>shiftViewDate(1);$('#tfGoToday').onclick=()=>setViewDate(today(),true);$('#inputStore').onchange=e=>{S.inputStore=e.target.value;saveViewPreference();renderInput()};$('#inputSort').onchange=e=>{S.inputSort=e.target.value||'brand-asc';saveViewPreference();renderInputRows(wk().stores?.[S.inputStore],wk().stores?.[S.inputStore]?compute(wk().stores[S.inputStore]):null)};$('#inputSearch').oninput=e=>{S.inputFilter=e.target.value||'';renderInputRows(wk().stores?.[S.inputStore],wk().stores?.[S.inputStore]?compute(wk().stores[S.inputStore]):null)};$('#addPlu').onclick=()=>$('#pluDialog').showModal();$('#addStore').onclick=()=>openStore('');$('#uploadExcel').onclick=()=>$('#excelFile').click();$('#uploadCsv').onclick=()=>$('#csvFile').click();$('#exportScorecard').onclick=()=>csvExport(scoreCsv(),'Scorecard_12_Toko_'+S.week+'_HINGGA_'+viewDate()+'.csv');$('#historyExport').onclick=()=>{const rows=[['MINGGU','KODE TOKO','NAMA TOKO','TARGET QTY','TARGET NS','AKTUAL QTY','AKTUAL NS','POINT %']];for(const w of monthWeeks(S.month)){const original=S.week;S.week=w;for(const s of storeEntries()){const c=compute(s);rows.push([w,s.code,s.name,s.targetQty,s.targetNS,c.qty,c.ns,c.pt??''])}S.week=original}csvExport(rows,'Riwayat_Area_'+S.month+'.csv')};$('#backupBtn').onclick=backup;$('#restoreBtn').onclick=()=>$('#jsonFile').click();$('#clearWeekBtn').onclick=()=>{if(!Object.keys(wk().stores||{}).length){toast('Minggu ini belum memiliki data');return}if(confirm('HAPUS seluruh toko, target, PLU dan QTY hanya untuk minggu '+weekTitle(S.week)+'? Data minggu lain tetap aman.')){delete S.weeks[S.week];S.inputStore='';save();render();toast('Data minggu terpilih dihapus')}};
$('#excelFile').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;const note=$('#importStatus');if(note){note.className='import-feedback';note.textContent='⏳ Membaca '+file.name+'...'}try{const data=await window.AreaExcel.readExcel(file);applyImport(data);if(note){note.className='import-feedback ok';note.textContent='✅ Impor selesai: '+data.stores.length+' toko, '+(data.catalogCount??data.items.length)+' PLU, '+(data.brands?.length||0)+' brand · '+(data.hppCount??data.items.filter(i=>i.hpp!==null&&i.hpp!==undefined).length)+' HPP PLU terisi otomatis ke minggu '+weekTitle(S.week)+'. Data minggu lain tetap terpisah.'}}catch(err){if(note){note.className='import-feedback bad';note.textContent='❌ Gagal membaca '+file.name+': '+err.message}alert('Impor Excel gagal: '+err.message+'\n\nPastikan memakai versi FIX EXCEL ASLI v2.1 dan file target area.xlsx (sheet TARGET PERTOKO + LIST ITEM).')}finally{e.target.value=''}};
$('#csvFile').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{applyImport(window.AreaExcel.readCSV(await f.text()))}catch(err){alert('Impor CSV gagal: '+err.message)}finally{e.target.value=''}};
$('#jsonFile').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{const d=JSON.parse(await f.text());if(!d?.weeks||typeof d.weeks!=='object')throw Error('File bukan backup SalesPulse Area');if(confirm('Restore backup akan mengganti seluruh data area lokal. Lanjutkan?')){S={...defaultState(),...d,settings:{...defaults,...d.settings}};save('all');render();toast('Data backup dipulihkan')}}catch(err){alert('Restore gagal: '+err.message)}finally{e.target.value=''}};
document.addEventListener('click',e=>{const targetGoal=e.target.closest('[data-goal-open]');if(targetGoal){S.inputStore=targetGoal.dataset.goalOpen;switchPage('input');return}const nav=e.target.closest('[data-page]');if(nav){switchPage(nav.dataset.page);return}const w=e.target.closest('[data-week]');if(w){S.week=w.dataset.week;saveViewPreference();render();return}const th=e.target.closest('[data-theme-option]');if(th){S.theme=th.dataset.themeOption;save('ui');renderShell();$('#themeDialog').close();toast('Tema '+themes[S.theme][0]+' aktif');return}const filt=e.target.closest('[data-report-filter]');if(filt){S.reportFilter=filt.dataset.reportFilter;saveViewPreference();renderDailyReport();return}
 const go=e.target.closest('[data-report-open]');if(go){S.inputStore=go.dataset.reportOpen;const selected=reportDateForWeek();switchPage('input');waDay=selected;waWeek=S.week;waRenderDate();return}
 const zero=e.target.closest('[data-report-zero]');if(zero){const store=wk().stores?.[zero.dataset.reportZero],date=reportDateForWeek();if(!store)return;if(dailyReportInfo(store,date).reported)return;if(!confirm('Tandai '+store.code+' telah melaporkan 0 QTY untuk '+dateMini(date)+'? Ini hanya status laporan, tidak mengubah nilai penjualan.'))return;markDayReported(store,date,'zero');save();renderDailyReport();toast('Laporan 0 QTY '+store.code+' tercatat untuk '+dateMini(date));return}
 const unmark=e.target.closest('[data-report-unmark]');if(unmark){const store=wk().stores?.[unmark.dataset.reportUnmark],date=reportDateForWeek();if(!store||dailyQty(store,Math.round((pdate(date)-pdate(S.week))/86400000))>0)return;if(!confirm('Batalkan penanda laporan 0 QTY untuk '+store.code+' pada '+dateMini(date)+'?'))return;if(store.reportedDays)delete store.reportedDays[date];save();renderDailyReport();toast('Penanda laporan dibatalkan');return}
 const ed=e.target.closest('[data-edit-store]');if(ed){openStore(ed.dataset.editStore);return}const del=e.target.closest('[data-delete-store]');if(del){const code=del.dataset.deleteStore;if(confirm('Hapus toko '+code+' serta semua PLU/QTY pada minggu ini?')){delete wk(true).stores[code];save();render();toast('Toko dihapus khusus minggu ini')}return}const diel=e.target.closest('[data-delete-item]');if(diel){const s=wk().stores[S.inputStore];if(s&&confirm('Hapus PLU ini dari toko '+s.name+'?')){s.items=s.items.filter(x=>x.id!==diel.dataset.deleteItem);save();renderInput()}return}const his=e.target.closest('[data-open-week]');if(his){S.week=his.dataset.openWeek;S.month=monthOf(addDays(S.week,3));switchPage('dashboard');return}});
$('#entryBody').addEventListener('change',e=>{const input=e.target.closest('input');if(!input)return;const row=input.closest('tr[data-id]'),st=wk(true).stores[S.inputStore],item=st?.items.find(i=>i.id===row?.dataset.id);if(!item)return;const f=input.dataset.field;if(f){if(f==='hpp')item.hpp=number(input.value);else if(f==='plu'){const newPlu=input.value.trim();if(!newPlu){toast('PLU tidak boleh kosong');return renderInput()}if(st.items.some(i=>i!==item&&i.plu===newPlu)){toast('PLU harus unik dalam satu toko');return renderInput()}item.plu=newPlu}else item[f]=input.value.trim()}else if(input.dataset.day!==undefined){const dayIndex=Number(input.dataset.day),reportDate=addDays(S.week,dayIndex);item.days[dayIndex]=number(input.value);if(input.value.trim()!=='')markDayReported(st,reportDate,'manual');else if(dailyQty(st,dayIndex)===0&&st.reportedDays?.[reportDate]?.source==='manual')delete st.reportedDays[reportDate]}save();const c=compute(st);const rr=row.cells;if(rr.length>=14){const q=(item.days||[]).reduce((sum,v)=>sum+number(v),0);rr[11].textContent=fmt(q);rr[12].textContent=money(q*number(item.hpp))}$('#inputSummary').innerHTML=[['Target QTY',fmt(st.targetQty)],['Aktual QTY',fmt(c.qty)],['Sub NS',money(c.ns)],['POINT',pct(c.pt)]].map(([k,v])=>`<div class="smallstat"><span>${k}</span><strong>${v}</strong></div>`).join('');$('#entryFoot').innerHTML=`<tr><td colspan="4">TOTAL ${escapeHTML(st.name)}</td>${c.days.map(v=>`<td>${money(v)}</td>`).join('')}<td>${fmt(c.qty)}</td><td>${money(c.ns)}</td><td></td></tr>`;if(['plu','brand','description'].includes(f))renderInputRows(st,c)})}
function install(){setupDialogs();wireEvents();waWire();wireSettings();render();if('serviceWorker'in navigator&&/^https?:$/.test(location.protocol))window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'}).catch(console.warn));window.setInterval(()=>{if(today()!==window._areaLastDay){window._areaLastDay=today();render()}},120000)}
window.AreaApp={
 getData:()=>({weeks:JSON.parse(JSON.stringify(S.weeks)),settings:JSON.parse(JSON.stringify(S.settings))}),
 getState:()=>JSON.parse(JSON.stringify(S)),
 getSharedUI:sharedUi,
 getPendingSharedUI:pendingUi,
 publishSharedUI:()=>{save('ui');toast('Tampilan disimpan di HP. Menunggu konfirmasi cloud.');},
 confirmSharedUI:(revision)=>{const pending=pendingUi();if(pending?.revision===revision){localStorage.removeItem(UI_PENDING_KEY);return true}return false},
 applySharedUI:(payload)=>{
  if(!payload?.settings||typeof payload.settings!=='object'||pendingUi())return false;
  cloudApplying=true;
  try{
   S.settings={...defaults,...payload.settings};
   if(payload.theme&&themes[payload.theme])S.theme=payload.theme;
   localStorage.setItem(KEY,JSON.stringify(S));
   render();
   return true;
  }finally{cloudApplying=false}
 },
 downloadLocal:()=>backup(),
 async applyRemote(records){
  // KRITIS: data lokal tidak boleh diganti sebelum berhasil di-backup secara lokal.
  if(window.AreaSafety && !(await window.AreaSafety.beforeRemote())){
    throw Error('Cadangan keamanan perangkat gagal. Data cloud tidak diterapkan; unduh Backup JSON manual terlebih dulu.');
  }
  cloudApplying=true;
  try{
   const obj={};
   for(const row of records){
    if(row.type==='area-config')continue;
    if(!row.week||!row.code)continue;
    const w=(obj[row.week] ||= {stores:{}});
    if(row.type==='store'){
     const st=(w.stores[row.code] ||= {code:row.code,name:row.name||row.code,targetQty:0,targetNS:0,items:[]});
     Object.assign(st,{name:row.name||st.name,targetQty:number(row.targetQty),targetNS:number(row.targetNS),brandTargets:row.brandTargets||st.brandTargets||{},reportedDays:row.reportedDays||st.reportedDays||{}});
    }else if(row.type==='item'){
     const st=(w.stores[row.code] ||= {code:row.code,name:row.code,targetQty:0,targetNS:0,items:[]});
     st.items.push({id:String(row.id||newid()),plu:String(row.plu||''),brand:String(row.brand||''),description:String(row.description||''),hpp:number(row.hpp),days:Array.from({length:7},(_,i)=>number(row.days?.[i]))});
    }
   }
   S.weeks=obj;
   const raw=JSON.stringify(S);localStorage.setItem(KEY,raw);
   window.AreaSafety?.backupSoon(raw);
   render();
  }finally{cloudApplying=false}
 },notify:toast
};
install();
})();
