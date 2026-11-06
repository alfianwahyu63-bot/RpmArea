/* RPM Area V28 — insights: analisis read-only berdasarkan state lokal yg telah dipilih.
   Tidak melakukan fetch, penyimpanan, atau operasi Supabase. */
(function(root){
'use strict';
const num=x=>{const n=Number(x);return Number.isFinite(n)&&n>0?n:0};
const norm=x=>String(x||'').trim().toLocaleLowerCase('id-ID');
const iso=s=>/^\d{4}-\d{2}-\d{2}$/.test(String(s||''))?String(s):null;
function daysElapsed(week,date){if(!iso(week)||!iso(date))return 0;const delta=Math.round((Date.parse(date+'T12:00:00Z')-Date.parse(week+'T12:00:00Z'))/86400000);return Math.max(0,Math.min(7,delta+1))}
function totals(st,dayCount,brand){const limit=Math.max(0,Math.min(7,dayCount));let qty=0,ns=0;
 for(const item of st.items||[]){if(brand&&norm(item.brand)!==norm(brand))continue;const hpp=num(item.hpp);
  for(let i=0;i<limit;i++){const q=num(item.days?.[i]);qty+=q;ns+=q*hpp}}
 let tq=num(st.targetQty),tn=num(st.targetNS);
 if(brand){const entry=Object.entries(st.brandTargets||{}).find(([key])=>norm(key)===norm(brand));tq=num(entry?.[1]?.qty);tn=num(entry?.[1]?.ns)}
 const aq=tq>0?100*qty/tq:null,an=tn>0?100*ns/tn:null;
 return{qty,ns,tq,tn,aq,an,point:aq===null||an===null?null:(aq+an)/2};}
function combined(stores,days,brand){const t={qty:0,ns:0,tq:0,tn:0,missing:0,valid:0};
 for(const st of stores){const r=totals(st,days,brand);if(r.tq<=0||r.tn<=0){t.missing++;continue}t.valid++;t.qty+=r.qty;t.ns+=r.ns;t.tq+=r.tq;t.tn+=r.tn}
 return{...t,aq:t.tq>0?100*t.qty/t.tq:null,an:t.tn>0?100*t.ns/t.tn:null,point:t.tq>0&&t.tn>0?50*(t.qty/t.tq+t.ns/t.tn):null}}
function rank(stores,days,brand){return stores.map(st=>({code:String(st.code||''),name:String(st.name||st.code||''),...totals(st,days,brand)}))
 .sort((a,b)=>(b.point!==null)-(a.point!==null)||(b.point??-1)-(a.point??-1)||a.code.localeCompare(b.code,'id-ID'))}
function brands(stores){const names=new Map();for(const st of stores){for(const b of Object.keys(st.brandTargets||{}))if(norm(b)&&!names.has(norm(b)))names.set(norm(b),b);for(const item of st.items||[])if(norm(item.brand)&&!names.has(norm(item.brand)))names.set(norm(item.brand),item.brand)}return [...names.values()].sort((a,b)=>a.localeCompare(b,'id-ID'))}
function projection(total,elapsed,asOfFuture=false){if(asOfFuture||elapsed<1||total.point===null)return null;
 const remaining=7-elapsed,forecast=total.point*7/elapsed;
 return{point:forecast,remaining,qtyPerDay:remaining>0?Math.max(0,total.tq-total.qty)/remaining:0,nsPerDay:remaining>0?Math.max(0,total.tn-total.ns)/remaining:0,atRisk:forecast<100-1e-6,actual:total.point,completed:remaining===0}}
function daily(stores,day){const chosen=combined(stores,day),before=day>1?combined(stores,day-1):null;
 let qty=0,ns=0,previousQty=0,previousNS=0;
 for(const st of stores){for(const item of st.items||[]){qty+=num(item.days?.[day-1]);ns+=num(item.days?.[day-1])*num(item.hpp);if(day>1){previousQty+=num(item.days?.[day-2]);previousNS+=num(item.days?.[day-2])*num(item.hpp)}}}
 return{qty,ns,previousQty,previousNS,pointGain:chosen.point!==null&&before?.point!==null?chosen.point-before.point:null,hasPrior:day>1}}
function missingReports(stores,week,day){if(day<=0)return 0;const date=new Date(week+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+day-1);const dateIso=date.toISOString().slice(0,10);
 return stores.filter(st=>{const reported=st.reportedDays?.[dateIso];return !reported&&!(st.items||[]).some(i=>num(i.days?.[day-1])>0)}).length}
function quality(st,day){const problems=[];if(!st)return problems;const groups=new Map();let missingHpp=0,invalid=0,outlier=0;
 for(const item of st.items||[]){const id=norm(item.plu);if(id)groups.set(id,(groups.get(id)||0)+1);
  const values=(item.days||[]).slice(0,day).map(n=>Number(n));
  if(values.some(v=>!Number.isFinite(v)||v<0||!Number.isInteger(v)))invalid++;
  if(!(num(item.hpp)>0)&&values.some(v=>v>0))missingHpp++;
  const positive=values.filter(v=>Number.isFinite(v)&&v>0);
  if(positive.length>=3){const sum=positive.reduce((a,b)=>a+b,0);const peak=Math.max(...positive);if(peak>=10&&peak>((sum-peak)/(positive.length-1))*4)outlier++}
 }
 const dup=[...groups].filter(([,count])=>count>1).length;
 if(dup)problems.push({level:'warn',text:`${dup} PLU terduplikasi dalam toko. Periksa agar QTY tidak dihitung ganda.`});
 if(invalid)problems.push({level:'warn',text:`${invalid} PLU memiliki QTY negatif/desimal/tidak valid.`});
 if(missingHpp)problems.push({level:'warn',text:`${missingHpp} PLU terjual tetapi HPP/NS per unit masih Rp0. NS bisa kurang hitung.`});
 if(outlier)problems.push({level:'info',text:`${outlier} PLU memiliki lonjakan QTY >4× rata-rata hari lain; periksa input.`});
 return problems}
function warnings(stores,week,date){const day=daysElapsed(week,date),tf=day/7*100,rows=rank(stores,day),notTarget=rows.filter(r=>r.point===null);
 const behind=rows.filter(r=>r.point!==null&&r.point<tf-1e-6).sort((a,b)=>a.point-b.point);
 const miss=missingReports(stores,week,day);const found=[];
 if(behind.length)found.push({level:'danger',text:`${behind.length} toko di bawah Time Factor ${fmt(tf)}: ${behind.slice(0,3).map(r=>r.code).join(', ')}${behind.length>3?'…':''}.`});
 if(miss)found.push({level:'warn',text:`${miss} dari ${stores.length} toko belum tercatat input pada tanggal pilihan (termasuk laporan 0 QTY).`});
 if(notTarget.length)found.push({level:'warn',text:`${notTarget.length} toko belum memiliki target QTY dan NS lengkap.`});
 let missingHpp=0;for(const st of stores)missingHpp+=quality(st,day).filter(x=>x.text.includes('HPP/NS')).length;
 if(missingHpp)found.push({level:'warn',text:`Ada PLU terjual dengan HPP nol di ${missingHpp} toko; cek akurasi NS.`});
 return found}
function options(st,brand,days){const entries=(st.items||[]).filter(i=>!brand||norm(i.brand)===norm(brand)).filter(i=>num(i.hpp)>0);
 return [...entries].sort((a,b)=>num(b.hpp)-num(a.hpp)||String(a.plu).localeCompare(String(b.plu),'id-ID',{numeric:true}));}
function neededUnits(tq,tn,qty,ns,unitNS){if(!(tq>0&&tn>0))return null;const gap=2-qty/tq-ns/tn;if(gap<=1e-10)return 0;
 const perUnit=1/tq+num(unitNS)/tn;return perUnit>0?Math.max(0,Math.ceil(gap/perUnit-1e-10)):null}
function advisor(st,brand,days,planned={}){const r=totals(st,days,brand),available=options(st,brand,days);
 const additions=available.reduce((acc,i)=>{const q=num(planned[i.id]);return{qty:acc.qty+q,ns:acc.ns+q*num(i.hpp)}},{qty:0,ns:0});
 const qty=r.qty+additions.qty,ns=r.ns+additions.ns;
 const chosen=[available[0],available[Math.floor((available.length-1)/2)],available[available.length-1]].filter(Boolean);
 const scenarios=[];const used=new Set();for(const [j,item]of chosen.entries()){if(used.has(item.id))continue;used.add(item.id);const label=j===0?'QTY paling efisien':j===1?'PLU alternatif':'Harga/unit lebih rendah';
 const saved=num(planned[item.id]);const units=neededUnits(r.tq,r.tn,qty-saved,ns-saved*num(item.hpp),num(item.hpp));
 scenarios.push({label,id:item.id,plu:item.plu,description:item.description,brand:item.brand,hpp:num(item.hpp),units,point:r.point});}
 // Kombinasi 3 PLU memakai komposisi 50/30/20 kontribusi POINT, bukan prediksi stok.
 const top=available.slice(0,3),mix=[];if(r.tq>0&&r.tn>0&&top.length>1){const weights=top.length===2?[0.65,0.35]:[0.5,0.3,0.2];
 let needed=Math.max(0,2-qty/r.tq-ns/r.tn);
 for(let idx=0;idx<top.length;idx++){const i=top[idx];const per=1/r.tq+num(i.hpp)/r.tn;
 const q=idx<top.length-1?Math.max(0,Math.ceil(needed*weights[idx]/per-1e-10)):Math.max(0,Math.ceil((needed-mix.reduce((sum,x)=>sum+x.units*x.contribution,0))/per-1e-10));
 mix.push({id:i.id,plu:i.plu,brand:i.brand,units:q,contribution:per,hpp:num(i.hpp)});
 }
 }
 return {valid:r.tq>0&&r.tn>0,actual:r,planned:additions,scenarios,mix,missingHpp:(st.items||[]).filter(i=>(!brand||norm(i.brand)===norm(brand))&&num(i.hpp)<=0).length};}
const fmt=x=>Number(x||0).toLocaleString('id-ID',{maximumFractionDigits:1});
const cash=x=>'Rp'+Math.round(Number(x)||0).toLocaleString('id-ID');
const percent=x=>x===null||!Number.isFinite(x)?'—':fmt(x)+'%';
function whatsappReport(stores,week,date,areaName='AREA RPM'){
 const day=daysElapsed(week,date),tf=day/7*100,total=combined(stores,day),ranks=rank(stores,day),valid=ranks.filter(r=>r.point!==null),under=valid.filter(r=>r.point<tf-1e-6),at=valid.filter(r=>r.point>=tf-1e-6),missing=missingReports(stores,week,day),p=projection(total,day);
 const label=d=>{const x=new Date(d+'T12:00:00Z');return x.toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'})};
 return [`📊 MONITORING RPM ${String(areaName||'AREA').toUpperCase()}`,`Periode: ${label(week)} – ${label(new Date(Date.parse(week+'T12:00:00Z')+6*86400000).toISOString().slice(0,10))}`,`Update sampai: ${label(date)}`,`⏱ Time Factor: ${percent(tf)} (${day}/7 hari)`,'',`🏪 Toko: ${stores.length} | Di atas/sesuai TF: ${at.length} | Di bawah TF: ${under.length}`,`📝 Belum input tanggal pilihan: ${missing}`,`📦 QTY: ${fmt(total.qty)} / ${fmt(total.tq)} (${percent(total.aq)})`,`💰 NS: ${cash(total.ns)} / ${cash(total.tn)} (${percent(total.an)})`,`🎯 POINT: ${percent(total.point)}`,
 ...(p?[`📈 ${p.completed?'Hasil akhir':'Proyeksi akhir minggu'}: ${percent(p.point)} (${p.completed?'final':'perkiraan linear'})`]:[]),
 '', '⚠️ TOKO PRIORITAS',...(under.length?under.sort((a,b)=>a.point-b.point).slice(0,5).map((r,i)=>`${i+1}. ${r.code} ${r.name} — ${percent(r.point)}`):['Tidak ada toko valid di bawah TF.']),
 ...(total.missing?['',`⚠️ ${total.missing} toko belum punya target lengkap; total area hanya mencakup toko bertarget.`]:[]),'',`_Perhitungan POINT: 50% QTY + 50% NS. Prediksi bukan jaminan hasil._`].join('\n')}
/* V34 — laporan WA gaya supervisi: angka ACV sama dengan kolom ACV ITEM pada
   Resume per Brand: jumlah brand dengan target QTY+NS lengkap dan POINT >= TF.
   Hitung ulang berdasarkan tanggal pilihan; tidak melakukan perubahan data. */
function whatsappAcvByStore(stores,week,date){
 const day=daysElapsed(week,date),tf=day/7*100;
 const ordered=[...(stores||[])];
 // Urutan contoh supervisi dipakai jika nama/kode toko cocok; sisanya tetap urutan dashboard.
 const reference=['LMR','SWGN','RGL','CEA','GDL','POW','PUI','PLN','BCN','PIN2','PIN','PLJ'];
 const shortName=st=>{
  const code=String(st.code||'').trim(),name=String(st.name||'').trim();
  const preferred=String(st.waName||st.shortName||'').trim();
  return preferred|| (reference.includes(name.toUpperCase())?name:reference.includes(code.toUpperCase())?code:(name&&name.length<=18?name:code||name||'Toko'));
 };
 const rankName=st=>reference.indexOf(shortName(st).toUpperCase());
 ordered.sort((a,b)=>{const ra=rankName(a),rb=rankName(b);return (ra<0?999:ra)-(rb<0?999:rb)});
 const rows=ordered.map(st=>{
  // Fungsi brands() menyatukan daftar brand dari target dan item tanpa menggandakan ejaan.
  const list=brands([st]);let achieved=0,withTarget=0;
  for(const brand of list){const r=totals(st,day,brand);if(r.point===null)continue;withTarget++;if(day>0&&r.point>=tf)achieved++}
  return{code:String(st.code||''),label:shortName(st),achieved,withTarget};
 });
 return{rows,day,tf};
}
function whatsappReportSupervisi(stores,week,date){
 const start=iso(week),end=start?new Date(Date.parse(start+'T12:00:00Z')+6*86400000).toISOString().slice(0,10):null;
 if(!start||!end||!iso(date))return '';
 const a=new Date(start+'T12:00:00Z'),b=new Date(end+'T12:00:00Z');
 const name=d=>d.toLocaleDateString('id-ID',{month:'long',timeZone:'UTC'});
 const dd=d=>String(d.getUTCDate()).padStart(2,'0');
 const period=a.getUTCMonth()===b.getUTCMonth()&&a.getUTCFullYear()===b.getUTCFullYear()
  ?`${dd(a)}-${dd(b)} ${name(a)}`
  :`${dd(a)} ${name(a)} - ${dd(b)} ${name(b)}${a.getUTCFullYear()!==b.getUTCFullYear()?` ${b.getUTCFullYear()}`:''}`;
 const {rows,day}=whatsappAcvByStore(stores,week,date);
 return [`*Report RPM ${period}*`,`Secara Time Factor *${day} hk*`,'','• *ACV by Store*',
  ...(rows.length?rows.map((r,i)=>`${i+1}. ${r.label} Acv ${r.achieved} item`):['Belum ada data toko untuk minggu ini.'])].join('\n');
}
root.RpmInsights={daysElapsed,totals,combined,rank,brands,projection,daily,missingReports,quality,warnings,advisor,neededUnits,whatsappReport,whatsappAcvByStore,whatsappReportSupervisi,fmt,cash,percent};
if(typeof module!=='undefined'&&module.exports)module.exports=root.RpmInsights;
})(typeof window!=='undefined'?window:globalThis);
