/* RPM Area V35: extension UI, local audit/recycle bin, reports and workbook exporter.
   Deliberately never performs unreviewed Supabase writes or deletes. */
(function(root){'use strict';
const $=q=>document.querySelector(q), E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=x=>{const v=Number(x);return Number.isFinite(v)&&v>0?v:0}, fmt=x=>Number(x||0).toLocaleString('id-ID',{maximumFractionDigits:1}), money=x=>'Rp '+Math.round(x||0).toLocaleString('id-ID');
const trashKey='rpmarea_v35_local_recycle_'+(root.RPM_AREA_SUPABASE?.workspaceId||'rpm-area-12'),logKey='rpmarea_v35_activity_'+(root.RPM_AREA_SUPABASE?.workspaceId||'rpm-area-12');
const clone=v=>JSON.parse(JSON.stringify(v));
const isoAdd=(s,d)=>{const date=new Date(s+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+d);return date.toISOString().slice(0,10)};
const dayCount=(w,d)=>Math.max(0,Math.min(7,Math.round((Date.parse(d+'T12:00:00Z')-Date.parse(w+'T12:00:00Z'))/86400000)+1));
const point=r=>r.tq>0&&r.tn>0?50*(r.qty/r.tq+r.ns/r.tn):null;
const pct=x=>x===null?'—':fmt(x)+'%';
const read=(key,fallback=[])=>{try{const v=JSON.parse(localStorage.getItem(key)||'null');return Array.isArray(v)?v:fallback}catch{return fallback}};
const write=(key,v)=>localStorage.setItem(key,JSON.stringify(v));
const now=()=>new Date().toISOString();
const ttl=30*86400000;
function recycle(){const t=Date.now();return read(trashKey).filter(x=>x&&Date.parse(x.at)>t-ttl).slice(0,35)}
function logs(){return read(logKey).slice(0,180)}
function record(text,kind='perubahan'){try{const list=logs();list.unshift({at:now(),kind,text:String(text).slice(0,240)});write(logKey,list.slice(0,180))}catch(err){console.warn('Log perangkat tidak tersimpan:',err)}}
function stash(entry){
 try{
  if(!entry||!['item','store','week','day'].includes(entry.type)||!entry.week)return false;
  const all=recycle(),row={...clone(entry),at:now(),id:crypto.randomUUID?.()||String(Date.now())+'-'+Math.random().toString(36).slice(2)};
  all.unshift(row);write(trashKey,all.slice(0,35));
  record('Dicadangkan ke Recycle Bin: '+label(row),'hapus');return true;
 }catch(err){console.error('Recycle Bin penuh / gagal:',err);return false}
}
function label(r){if(r.type==='item')return `PLU ${r.item?.plu||'-'} · ${r.code} · ${r.week}`;
 if(r.type==='store')return `Toko ${r.code} · ${r.week}`;
 if(r.type==='week')return `1 minggu ${r.week}`;
 return `Laporan ${r.date} · ${r.storeCode||'1 area'}`}
const state=()=>root.AreaApp?.getState()||{week:'',weeks:{},reportWatchDate:'',inputStore:''};
function active(){const s=state(),end=isoAdd(s.week,6),selected=s.reportWatchDate;
 const todayLocal=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
 const date=(selected&&selected>=s.week&&selected<=end)?selected:(todayLocal()>=s.week&&todayLocal()<=end?todayLocal():(todayLocal()<s.week?s.week:end));
 return {...s,date,day:dayCount(s.week,date),stores:Object.values(s.weeks?.[s.week]?.stores||{}),tf:dayCount(s.week,date)/7*100};}
function getItemSum(st,day){let qty=0,ns=0;for(const it of st.items||[])for(let i=0;i<day;i++){const q=n(it.days?.[i]);qty+=q;ns+=q*n(it.hpp)}return {qty,ns}}
function totals(st,day,brand=''){
 const b=String(brand).trim().toLowerCase();const selected=(st.items||[]).filter(x=>!b||String(x.brand).trim().toLowerCase()===b);
 let qty=0,ns=0;for(const it of selected)for(let i=0;i<day;i++){const q=n(it.days?.[i]);qty+=q;ns+=q*n(it.hpp)}
 let tq=n(st.targetQty),tn=n(st.targetNS);
 if(b){const target=Object.entries(st.brandTargets||{}).find(([x])=>x.trim().toLowerCase()===b)?.[1];tq=n(target?.qty);tn=n(target?.ns)}
 return{qty,ns,tq,tn,point:point({qty,ns,tq,tn})};}
function areaTotal(stores,day){const t={qty:0,ns:0,tq:0,tn:0};for(const st of stores){const a=totals(st,day);for(const key of Object.keys(t))t[key]+=a[key]}t.point=point(t);return t}
function acvBrands(ctx){const brands=root.RpmInsights?.brands(ctx.stores)||[],rows=[];
 for(const brand of brands){let eligible=0,achieved=0;for(const st of ctx.stores){const r=totals(st,ctx.day,brand);if(r.point===null)continue;eligible++;if(r.point>=ctx.tf-1e-6)achieved++}rows.push({brand,eligible,achieved,remaining:eligible-achieved})}
 return rows.sort((a,b)=>b.remaining-a.remaining||a.brand.localeCompare(b.brand,'id'))}
function acvStore(ctx,st){return acvBrands({...ctx,stores:[st]}).filter(x=>x.eligible&&x.achieved).length}
function storeRows(ctx){return ctx.stores.map(st=>({st,...totals(st,ctx.day),acv:acvStore(ctx,st)}))}
function reportStatus(st,week,date,index){return Boolean(st.reportedDays?.[date])||(st.items||[]).some(i=>n(i.days?.[index])>0)}
function missing(ctx){const index=ctx.day-1;if(index<0)return[];return ctx.stores.filter(st=>!reportStatus(st,ctx.week,ctx.date,index))}
function recovery(ctx){return storeRows(ctx).map(r=>{
 const remain=7-ctx.day,days=Math.max(remain,1),valid=r.point!==null;
 const qtyGap=Math.max(0,r.tq-r.qty),nsGap=Math.max(0,r.tn-r.ns);
 const forecast=ctx.day>0&&valid?r.point*7/ctx.day:null;
 return{...r,remain,qtyGap,nsGap,qtyPerDay:qtyGap/days,nsPerDay:nsGap/days,forecast};
 }).sort((a,b)=>(a.forecast??-1)-(b.forecast??-1));}
function anomalies(ctx){const out=[];const end=Math.min(ctx.day,7);
 for(const st of ctx.stores){const seen=new Set();for(const it of st.items||[]){
  const plu=String(it.plu||'').trim();if(plu&&seen.has(plu))out.push(`${st.code} • PLU ${plu} ganda`);seen.add(plu);
  const days=it.days||[];if(days.some(q=>q!==null&&q!==''&&(!Number.isFinite(Number(q))||Number(q)<0||!Number.isInteger(Number(q)))))out.push(`${st.code} • ${plu} QTY tidak valid`);
  if(n(it.hpp)===0&&days.slice(0,end).some(q=>n(q)>0))out.push(`${st.code} • ${plu} HPP kosong meski QTY terjual`);
  for(let i=2;i<end;i++){const prev=days.slice(Math.max(0,i-3),i).map(n),base=prev.reduce((a,b)=>a+b,0)/prev.length,current=n(days[i]);
   if(current>=10&&base>0&&current>base*5)out.push(`${st.code} • ${plu} lonjakan hari ${i+1}: ${fmt(current)} vs rata² ${fmt(base)}`);
  }
 }}return out.slice(0,60)}
function formatDate(d){return new Date(d+'T12:00:00Z').toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric',timeZone:'UTC'})}
function WA(ctx,mode='morning'){
 if(mode==='acv')return root.RpmInsights?.whatsappReportSupervisi(ctx.stores,ctx.week,ctx.date)||'';
 const rows=storeRows(ctx),missingCodes=missing(ctx).map(x=>x.code),area=areaTotal(ctx.stores,ctx.day),priority=recovery(ctx).filter(r=>r.point!==null).slice(0,5);
 const period=`${formatDate(ctx.week)} – ${formatDate(isoAdd(ctx.week,6))}`;
 const header=[`*REPORT RPM • ${mode==='morning'?'MORNING':mode==='evening'?'EVENING':'WEEKLY'}*`,`Periode: ${period}`,`Data s.d.: ${formatDate(ctx.date)}`,`Time Factor: ${fmt(ctx.tf)}% (${ctx.day} hk)`,''];
 const at=rows.filter(x=>x.point!==null&&x.point>=ctx.tf).length;
 const base=[`Toko di atas/sesuai TF: ${at}/${rows.filter(x=>x.point!==null).length}`,`POINT Area: ${pct(area.point)}`,`QTY: ${fmt(area.qty)} / ${fmt(area.tq)}`,`Net Sales: ${money(area.ns)} / ${money(area.tn)}`];
 const ranked=[...rows].sort((a,b)=>(b.point??-1)-(a.point??-1));
 if(mode==='morning')return [...header,'*PENCAPAIAN TERAKHIR*',...base,'',`*BELUM INPUT TANGGAL ${ctx.date}*`,missingCodes.join(', ')||'Semua toko sudah input','', '*TOKO PRIORITAS*',...(priority.length?priority.map((r,i)=>`${i+1}. ${r.st.code} • ${pct(r.point)} | ${Math.ceil(r.qtyPerDay)} QTY/hari`):['Belum ada target lengkap'])].join('\n');
 if(mode==='evening'){
  let dailyQty=0,dailyNS=0;for(const st of ctx.stores)for(const it of st.items||[]){const q=n(it.days?.[ctx.day-1]);dailyQty+=q;dailyNS+=q*n(it.hpp)}
  return [...header,'*HASIL HARI PILIHAN*',`QTY hari ini: ${fmt(dailyQty)}`,`NS hari ini: ${money(dailyNS)}`,...base,'',`Belum input: ${missingCodes.join(', ')||'Tidak ada'}`,'',`*TOP 3 TOKO*`,...ranked.slice(0,3).map((r,i)=>`${i+1}. ${r.st.code}: ${pct(r.point)}`)].join('\n');
 }
 return [...header,'*REKAP KUMULATIF*',...base,'',`*RANKING ${rows.length} TOKO*`,...ranked.map((r,i)=>`${i+1}. ${r.st.code}: ${pct(r.point)} | ${r.acv} ACV brand`),'',`Belum input tanggal pilihan: ${missingCodes.length} toko`,'_Dihitung dari data yang tampil saat laporan dibuat._'].join('\n');
}
function metricCard(title,value,detail=''){return `<div class="v35-metric"><small>${E(title)}</small><b>${E(value)}</b>${detail?`<span>${E(detail)}</span>`:''}</div>`}
function topRows(rows,header=''){return `<div class="v35-table-scroll"><table class="v35-table"><tbody>${header?`<tr class="v35-head">${header}</tr>`:''}${rows.join('')}</tbody></table></div>`}
function render(){const panel=$('#v35Status');if(!panel)return;const ctx=active();if(!ctx.week)return;
 panel.textContent=`Minggu ${formatDate(ctx.week)} – ${formatDate(isoAdd(ctx.week,6))} · s.d. ${formatDate(ctx.date)} · ${ctx.stores.length} toko · ${fmt(ctx.tf)}% Time Factor`;
 const badge=$('#cloudBadge')?.textContent||'Belum dicek';$('#v35SyncInfo').innerHTML=`<p class="v35-note">Status saat ini: <strong>${E(badge)}</strong>. Penghapusan PLU hanya di Cloud perlu konfirmasi pada menu Cloud; tidak ada pemaksaan sinkronisasi.</p>`;
 $('#v35Trash').innerHTML=recycle().length?recycle().map(r=>`<div class="v35-row"><span><b>${E(label(r))}</b><small>${E(formatDate(r.at.slice(0,10)))} · tersimpan di perangkat ini</small></span><button type="button" class="btn secondary" data-restore-id="${E(r.id)}">Pulihkan</button></div>`).join(''):'<p class="v35-note">Belum ada item yang masuk Recycle Bin perangkat ini.</p>';
 const brand=acvBrands(ctx);$('#v35BrandACV').innerHTML=topRows(brand.slice(0,30).map(r=>`<tr><td>${E(r.brand)}</td><td><b>${r.achieved}/${r.eligible}</b><small>${r.remaining} belum ACV</small></td></tr>`))||'<p>Belum ada target brand.</p>';
 const plans=recovery(ctx);$('#v35Recovery').innerHTML=topRows(plans.map(r=>`<tr><td><b>${E(r.st.code)}</b><small>Prediksi ${pct(r.forecast)}</small></td><td><b>${pct(r.point)}</b><small>Butuh ${fmt(r.qtyGap)} QTY &amp; ${money(r.nsGap)} NS</small><small>Rata-rata ${fmt(r.qtyPerDay)} QTY/hari · ${money(r.nsPerDay)} NS/hari</small></td></tr>`));
 const prev=isoAdd(ctx.week,-7),past=Object.values(ctx.weeks[prev]?.stores||{}),a=areaTotal(ctx.stores,7),b=areaTotal(past,7);
 const gap=a.point!==null&&b.point!==null?a.point-b.point:null;
 $('#v35WoW').innerHTML=`<div class="v35-metrics">${metricCard('POINT saat ini (7 hari)',pct(a.point))}${metricCard('POINT minggu sebelumnya',pct(b.point),past.length+' toko')}${metricCard('Selisih POINT',gap===null?'—':(gap>=0?'+':'')+pct(gap))}${metricCard('Perubahan QTY',past.length?fmt(a.qty-b.qty):'—')}${metricCard('Perubahan NS',past.length?money(a.ns-b.ns):'—')}</div><p class="v35-note">Hanya minggu sebelumnya yang tersedia dalam data lokal. Tidak menggabungkan daftar PLU berbeda minggu.</p>`;
 const bad=anomalies(ctx);$('#v35Anomalies').innerHTML=bad.length?bad.map(x=>`<div class="v35-warn">⚠ ${E(x)}</div>`).join(''):'<p class="v35-success">✓ Tidak ada anomali dasar yang terdeteksi.</p>';
 const ranks=storeRows(ctx),which=$('#v35RankMetric')?.value||'point';ranks.sort((a,b)=>(b[which]??-Infinity)-(a[which]??-Infinity));
 $('#v35Ranks').innerHTML=topRows(ranks.map((r,i)=>`<tr><td>${i+1}. <b>${E(r.st.code)}</b><small>${E(r.st.name||'')}</small></td><td><b>${which==='point'?pct(r.point):which==='ns'?money(r.ns):fmt(r[which])}</b></td></tr>`));
 const due=missing(ctx);$('#v35Reminders').innerHTML=due.length?`<div class="v35-warning-count">${due.length} toko belum input</div><p>${E(due.map(x=>x.code).join(', '))}</p><button id="v35CopyReminder" type="button" class="btn secondary">📋 Salin Pengingat WA</button>`:'<p class="v35-success">✓ Semua toko telah mengirim laporan hari pilihan.</p>';
 const choose=$('#v35ScanStore'),saved=choose.value||ctx.inputStore||'';choose.innerHTML='<option value="">Pilih toko</option>'+ctx.stores.map(s=>`<option value="${E(s.code)}">${E(s.code)} · ${E(s.name)}</option>`).join('');choose.value=ctx.stores.some(x=>x.code===saved)?saved:'';
 $('#v35WAPreview').textContent=WA(ctx,$('#v35WAMode').value||'morning');
 $('#v35Activity').innerHTML=logs().slice(0,25).map(x=>`<div class="v35-row"><span><b>${E(x.text)}</b><small>${E(new Date(x.at).toLocaleString('id-ID'))} · ${E(x.kind)}</small></span></div>`).join('')||'<p class="v35-note">Log dimulai saat versi V35 digunakan.</p>';
 lookupBarcode();
}
function backupFile(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000)}
async function copy(text){try{await navigator.clipboard.writeText(text);return true}catch{const a=document.createElement('textarea');a.value=text;document.body.appendChild(a);a.select();const ok=document.execCommand('copy');a.remove();return ok}}
async function restore(id){const rows=recycle(),rec=rows.find(r=>r.id===id);if(!rec)return alert('Cadangan tidak ditemukan / masa 30 hari berakhir.');
 if(!confirm(`Pulihkan ${label(rec)}?\n\nHanya penyimpanan lokal perangkat ini yang dipulihkan. Cloud mungkin mendeteksi konflik yang harus diselesaikan manual.`))return;
 try{
  await root.AreaSafety?.snapshot('SEBELUM RESTORE V35 '+label(rec),JSON.stringify(state()));
  root.AreaApp.mutateLocal(weeks=>{
   const w=weeks[rec.week];
   if(rec.type==='week'){if(w&&Object.keys(w.stores||{}).length)throw Error('Minggu sudah mempunyai data. Tidak akan ditimpa.');weeks[rec.week]=clone(rec.data)}
   else if(rec.type==='store'){if(!w)throw Error('Minggu asal tidak ada. Pulihkan backup mingguan lebih dahulu.');if(w.stores?.[rec.code])throw Error('Toko sudah ada, tidak ditimpa.');w.stores[rec.code]=clone(rec.store)}
   else if(rec.type==='item'){const st=w?.stores?.[rec.code];if(!st)throw Error('Toko asal tidak ada.');if(st.items.some(x=>x.id===rec.item.id||String(x.plu)===String(rec.item.plu)))throw Error('PLU sudah ada atau kodenya sama. Tidak ditimpa.');st.items.push(clone(rec.item))}
   else if(rec.type==='day'){
    if(!w)throw Error('Minggu tidak tersedia.');const idx=dayCount(rec.week,rec.date)-1;
    if(idx<0||idx>6)throw Error('Tanggal cadangan tidak valid.');
    for(const [code,old] of Object.entries(rec.stores||{})){
     const curr=w.stores?.[code];if(!curr)throw Error('Toko '+code+' tidak ditemukan.');
     if((curr.items||[]).some(i=>n(i.days?.[idx])>0)||curr.reportedDays?.[rec.date])throw Error('Ada input baru pada '+rec.date+' toko '+code+'. Pemulihan otomatis dibatalkan agar data baru aman.');
     const cur=new Map((curr.items||[]).map(i=>[i.id,i]));
     for(const past of old.items||[]){const q=n(past.days?.[idx]);if(q>0&&!cur.has(past.id))throw Error('PLU '+past.plu+' hilang; pulihkan PLU dahulu.');}
    }
    for(const [code,old] of Object.entries(rec.stores||{})){
     const curr=w.stores[code],oldItems=new Map((old.items||[]).map(i=>[i.id,i]));for(const it of curr.items||[]){const oldItem=oldItems.get(it.id);if(oldItem){it.days[idx]=n(oldItem.days?.[idx])}}
     curr.reportedDays||={};if(old.reportedDays?.[rec.date])curr.reportedDays[rec.date]=clone(old.reportedDays[rec.date]);else delete curr.reportedDays[rec.date];
     if(curr.clearedDays)delete curr.clearedDays[rec.date];
    }
   }
  });
  write(trashKey,rows.filter(x=>x.id!==id));record('Dipulihkan: '+label(rec),'restore');render();alert('Pemulihan lokal berhasil. Periksa Cloud sebelum melanjutkan input di perangkat lain.');
 }catch(e){alert('Pemulihan dibatalkan: '+e.message)}
}
function lookupBarcode(){const node=$('#v35ScanResult');if(!node)return;const code=$('#v35Barcode').value.trim(),ctx=active(),st=ctx.stores.find(x=>x.code===$('#v35ScanStore').value);
 if(!code){node.textContent='Ketik kode PLU atau gunakan kamera.';return}if(!st){node.textContent='Pilih toko terlebih dahulu.';return}
 const found=(st.items||[]).filter(x=>String(x.plu).trim()===code);
 node.innerHTML=found.length?found.map(x=>`<p class="v35-success">✓ <strong>${E(x.plu)}</strong> · ${E(x.brand||'')}<br>${E(x.description||'')} · HPP ${money(n(x.hpp))}</p>`).join(''):'<p class="v35-warn">PLU/barcode ini belum ada di list toko. Barcode kemasan mungkin berbeda dari kode PLU.</p>';
}
let stream=null,timer=null;
function stopScan(){clearTimeout(timer);if(stream)for(const track of stream.getTracks())track.stop();stream=null;const video=$('#v35Video');if(video){video.pause();video.srcObject=null;video.hidden=true}}
async function startScan(){stopScan();if(!root.BarcodeDetector||!navigator.mediaDevices?.getUserMedia){alert('Pemindaian kamera tidak didukung oleh WebView/browser ini. Ketik PLU manual.');return}
 const video=$('#v35Video');try{
  const detector=new BarcodeDetector({formats:['ean_13','ean_8','code_128','upc_a','upc_e','qr_code']});stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
  video.srcObject=stream;video.hidden=false;await video.play();const expires=Date.now()+60000;
  const scan=async()=>{if(!stream)return;try{const codes=await detector.detect(video);if(codes.length){$('#v35Barcode').value=codes[0].rawValue||'';stopScan();lookupBarcode();return}}catch(e){console.warn(e)}if(Date.now()>expires){stopScan();return}timer=setTimeout(scan,350)};scan();
 }catch(e){stopScan();alert('Tidak bisa membuka kamera: '+e.message+'. Gunakan input manual.')}
}
// Minimal standards-compliant, multi-sheet XLSX; all strings are inline, never formulas.
const xml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const col=i=>{let out='';for(i++;i>0;i=Math.floor((i-1)/26))out=String.fromCharCode(65+(i-1)%26)+out;return out};
function sheetXML(rows){let content=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="16"/><sheetData>`;
 rows.forEach((cells,r)=>{content+=`<row r="${r+1}"${r===0?' ht="25" customHeight="1"':''}>`;cells.forEach((v,c)=>{if(v===undefined||v===null)return;const cell=col(c)+(r+1),style=r===0?' s="1"':'';
  if(typeof v==='number'&&Number.isFinite(v))content+=`<c r="${cell}"${style}><v>${v}</v></c>`;
  else content+=`<c r="${cell}" t="inlineStr"${style}><is><t xml:space="preserve">${xml(v)}</t></is></c>`});content+='</row>'});content+='</sheetData></worksheet>';return content}
function excelData(ctx){const day=ctx.day,week=ctx.week,rows=storeRows(ctx),brands=acvBrands(ctx);
 const score=[['KODE TOKO','NAMA TOKO','TARGET QTY','TARGET NS','AKTUAL QTY','AKTUAL NS','POINT %','ACV BRAND','WEEK','S/D TANGGAL'],...rows.map(r=>[r.st.code,r.st.name,n(r.tq),n(r.tn),r.qty,r.ns,r.point??'',r.acv,week,ctx.date])];
 const daily=[['WEEK','TANGGAL','TOKO','PLU','BRAND','DESKRIPSI','QTY','HPP/UNIT','NET SALES','STATUS LAPORAN']];
 const item=[['WEEK','TOKO','PLU','BRAND','DESKRIPSI','HPP','TOTAL QTY','TOTAL NS',...Array.from({length:7},(_,i)=>isoAdd(week,i))]];
 for(const st of ctx.stores){for(const it of st.items||[]){let sum=0;for(let i=0;i<7;i++){const q=n(it.days?.[i]);sum+=q;daily.push([week,isoAdd(week,i),st.code,String(it.plu||''),String(it.brand||''),String(it.description||''),q,n(it.hpp),q*n(it.hpp),reportStatus(st,week,isoAdd(week,i),i)?'Sudah Input':'Belum Input'])}
  item.push([week,st.code,String(it.plu||''),String(it.brand||''),String(it.description||''),n(it.hpp),sum,sum*n(it.hpp),...Array.from({length:7},(_,i)=>n(it.days?.[i]))])}}
 const brandRows=[['BRAND','TOKO TARGET LENGKAP','TOKO ACV','TOKO BELUM ACV','TIME FACTOR %'],...brands.map(b=>[b.brand,b.eligible,b.achieved,b.remaining,ctx.tf])];
 const prev=Object.values(ctx.weeks?.[isoAdd(week,-7)]?.stores||{}),a=areaTotal(ctx.stores,7),b=areaTotal(prev,7);
 const wow=[['METRIK','MINGGU INI','MINGGU SEBELUMNYA','SELISIH'],['POINT (%)',a.point??'',b.point??'',a.point!==null&&b.point!==null?a.point-b.point:''],['QTY',a.qty,b.qty,a.qty-b.qty],['NET SALES',a.ns,b.ns,a.ns-b.ns],['TOKO',ctx.stores.length,prev.length,ctx.stores.length-prev.length]];
 return [['SCORECARD',score],['HARIAN',daily],['BRAND',brandRows],['PLU',item],['MINGGUAN',wow]];
}
async function exportExcel(){if(typeof JSZip==='undefined'){alert('Library Excel tidak tersedia. Pastikan vendor/jszip.min.js ikut diunggah.');return}
 const workbook=excelData(active()),zip=new JSZip();
 zip.file('[Content_Types].xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+workbook.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')+'</Types>');
 zip.file('_rels/.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
 const rns='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
 zip.file('xl/workbook.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${rns}"><sheets>${workbook.map(([name],i)=>`<sheet name="${xml(name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`);
 zip.file('xl/_rels/workbook.xml.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${workbook.map((_,i)=>`<Relationship Id="rId${i+1}" Type="${rns}/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId${workbook.length+1}" Type="${rns}/styles" Target="styles.xml"/></Relationships>`);
 zip.file('xl/styles.xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF122540"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1"/></cellXfs></styleSheet>');
 workbook.forEach(([,rows],i)=>zip.file('xl/worksheets/sheet'+(i+1)+'.xml',sheetXML(rows)));
 const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE'});backupFile(blob,`RPM_Area_V35_${active().week}.xlsx`);
}
function csv(log){return ['WAKTU,AKTIVITAS,KATEGORI',...log.map(r=>[r.at,r.text,r.kind].map(x=>'"'+String(x||'').replace(/"/g,'""')+'"').join(','))].join('\r\n')}
let baseline=null;
function digest(s){const map=new Map();for(const [w,data]of Object.entries(s?.weeks||{}))for(const [code,st]of Object.entries(data?.stores||{})){
 map.set(`${w}/${code}`,'store|'+JSON.stringify([st.name,st.targetQty,st.targetNS,st.reportedDays,st.clearedDays,st.brandTargets]));for(const it of st.items||[])map.set(`${w}/${code}/${it.id}`,'item|'+JSON.stringify([it.plu,it.brand,it.description,it.hpp,it.days]));}return map}
function changed(){const fresh=digest(state()),old=baseline||new Map();const added=[...fresh].filter(([id])=>!old.has(id)),removed=[...old].filter(([id])=>!fresh.has(id)),modified=[...fresh].filter(([id,value])=>old.has(id)&&old.get(id)!==value);
 baseline=fresh;if(!added.length&&!removed.length&&!modified.length)return;
 const sample=[...modified.map(([k])=>k),...added.map(([k])=>k),...removed.map(([k])=>k)].slice(0,3).join(', ');
 record(`Berubah ${modified.length} · tambah ${added.length} · hilang ${removed.length} dokumen. ${sample}`,'data-lokal');if($('#view-tools')?.classList.contains('active'))render();}
function install(){if(!root.AreaApp)return;baseline=digest(state());const rootNode=$('#view-tools');if(!rootNode)return;
 window.addEventListener('area:changed',changed);window.addEventListener('area:remote-applied',()=>{baseline=digest(state());record('Data lokal diterapkan dari Cloud (tanpa klaim identitas operator)','cloud')});
 rootNode.addEventListener('click',async e=>{
  const restoreId=e.target.closest('[data-restore-id]')?.dataset.restoreId;if(restoreId)return restore(restoreId);
  if(e.target.closest('#v35GoCloud'))return $('#cloudDialog')?.showModal();
  if(e.target.closest('#v35CopyWA'))return alert((await copy($('#v35WAPreview').textContent))?'Laporan disalin.':'Gagal menyalin teks.');
  if(e.target.closest('#v35ShareWA')){const msg=$('#v35WAPreview').textContent;if(navigator.share){try{await navigator.share({text:msg});return}catch(err){if(err.name==='AbortError')return}}root.open('https://wa.me/?text='+encodeURIComponent(msg),'_blank','noopener,noreferrer');return}
  if(e.target.closest('#v35CopyReminder'))return alert((await copy(`Mohon update laporan RPM ${active().date} untuk toko: ${missing(active()).map(x=>x.code).join(', ')}. Terima kasih.`))?'Pengingat disalin.':'Gagal menyalin.');
  if(e.target.closest('#v35ScanStart'))return startScan();if(e.target.closest('#v35ScanStop'))return stopScan();
  if(e.target.closest('#v35ExportExcel'))try{await exportExcel()}catch(err){console.error(err);alert('Ekspor XLSX gagal: '+err.message)};
  if(e.target.closest('#v35ExportLog'))backupFile(new Blob(['\ufeff'+csv(logs())],{type:'text/csv;charset=utf-8'}),'RPM_V35_Log_Perangkat.csv');
 });
 $('#v35WAMode').addEventListener('change',render);$('#v35RankMetric').addEventListener('change',render);$('#v35ScanStore').addEventListener('change',lookupBarcode);$('#v35Barcode').addEventListener('input',lookupBarcode);
 document.addEventListener('click',e=>{if(e.target.closest('[data-page]')&&!e.target.closest('[data-page="tools"]'))stopScan()});document.addEventListener('visibilitychange',()=>{if(document.hidden)stopScan()});
 render();
}
root.RpmV35={render,stash,restore,analysis:{active,totals,areaTotal,acvBrands,recovery,anomalies,missing,WA,excelData},stopScan};
if(typeof module!=='undefined'&&module.exports)module.exports=root.RpmV35;
if(typeof document!=='undefined')setTimeout(install,0);
})(typeof window!=='undefined'?window:globalThis);
