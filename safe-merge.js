/* RpmArea V31 — conservative Supabase reconciliation for one-day report clears.
   Missing catalog items are restored, never deleted. A clearedDays marker wins
   over an older report/QTY, and never restores an intentionally cleared day.
   Returns a PLAN ONLY: caller must confirm, back up and CAS-verify any writes. */
(function(root){'use strict';
 const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
 const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
 const without=(v,...keys)=>{const out={...v};for(const key of keys)delete out[key];return out};
 const own=(v,k)=>Object.prototype.hasOwnProperty.call(v||{},k);
 const storeId=v=>'st_'+encodeURIComponent(String(v?.week||''))+'_'+encodeURIComponent(String(v?.code||''));
 function dateAt(week,i){
  const t=Date.parse(String(week)+'T00:00:00Z');
  if(!Number.isFinite(t))return null;
  return new Date(t+i*86400000).toISOString().slice(0,10);
 }
 function isValidDate(week,date){return typeof date==='string'&&Array.from({length:7},(_,i)=>dateAt(week,i)).includes(date)}
 function mapObject(v){return !!v&&typeof v==='object'&&!Array.isArray(v)}
 function timestamp(v){const t=Date.parse(v?.at);return Number.isFinite(t)?t:null}
 function isValidQty(v){return typeof v==='number'&&Number.isFinite(v)&&v>=0}
 function docLabel(v){return `${v?.code||'?'} / ${v?.type==='item'?(v?.plu||v?.id||'PLU'):'toko'} (${v?.week||'?'})`}
 function build(local,cloud){
  if(!(local instanceof Map)||!(cloud instanceof Map))return {ok:false,reason:'Format data Cloud tidak sesuai.',issues:[]};
  const issues=[],changes=[],addCloud=[],addLocal=[];
  const merged=new Map(),storeClears=new Map();
  let localQty=0,cloudQty=0,daysMerged=0,clearedQty=0,clearedItems=0;
  const ids=[...new Set([...local.keys(),...cloud.keys()])];
  // Validate store records FIRST, because their clearedDays markers determine item QTY.
  for(const id of ids){
   const l=local.get(id),r=cloud.get(id),v=l||r;
   if(v?.type!=='store')continue;
   const name=docLabel(v);
   if(!l||!r){issues.push(`${name}: dokumen toko hanya di ${l?'HP':'Cloud'}. Tidak dipulihkan tanpa pemeriksaan manual.`);continue}
   if(l.type!=='store'||r.type!=='store'||id!==storeId(l)||id!==storeId(r)){
    issues.push(`${name}: identitas dokumen toko berbeda.`);continue;
   }
   if(!equal(without(l,'reportedDays','clearedDays'),without(r,'reportedDays','clearedDays'))){
    issues.push(`${name}: target atau identitas toko berbeda. Tidak boleh ditimpa.`);continue;
   }
   const lc=l.clearedDays||{},rc=r.clearedDays||{},lr=l.reportedDays||{},rr=r.reportedDays||{};
   if(![lc,rc,lr,rr].every(mapObject)){issues.push(`${name}: status input harian tidak valid.`);continue}
   const dates=new Set([...Object.keys(lc),...Object.keys(rc),...Object.keys(lr),...Object.keys(rr)]);
   const clears={},reports={};let invalid=false;
   for(const date of dates){
    if(!isValidDate(l.week,date)){issues.push(`${name}: tanggal status ${date} di luar minggu.`);invalid=true;continue}
    const leftClear=lc[date],rightClear=rc[date],leftReport=lr[date],rightReport=rr[date];
    if((leftClear!==undefined&&(!mapObject(leftClear)||timestamp(leftClear)===null))||
       (rightClear!==undefined&&(!mapObject(rightClear)||timestamp(rightClear)===null))||
       (leftReport!==undefined&&!mapObject(leftReport))||(rightReport!==undefined&&!mapObject(rightReport))){
     issues.push(`${name}: informasi audit tanggal ${date} tidak valid.`);invalid=true;continue;
    }
    const clear=leftClear&&rightClear?(timestamp(leftClear)>=timestamp(rightClear)?leftClear:rightClear):(leftClear||rightClear);
    if(clear){
     // A later report might be a genuine re-entry on a different device; never guess.
     const newer=[leftReport,rightReport].find(report=>report&&timestamp(report)!==null&&timestamp(report)>=timestamp(clear));
     if(newer){issues.push(`${name}: input baru tanggal ${date} lebih baru dari penghapusan. Periksa dua backup.`);invalid=true;continue}
     // Same copy having both a deletion and a report is internally inconsistent.
     if((leftClear&&leftReport)||(rightClear&&rightReport)){
      issues.push(`${name}: penanda hapus dan laporan ${date} bertabrakan pada perangkat yang sama.`);invalid=true;continue;
     }
     clears[date]=clear;
     if(leftReport||rightReport)daysMerged++;
    }else if(leftReport||rightReport){
     reports[date]=rightReport||leftReport;
     if(!rightReport&&leftReport)daysMerged++;
    }
   }
   if(invalid)continue;
   const target={...r};
   if(Object.keys(reports).length)target.reportedDays=reports;else delete target.reportedDays;
   if(Object.keys(clears).length)target.clearedDays=clears;else delete target.clearedDays;
   storeClears.set(id,{local:lc,cloud:rc,merged:clears});
   merged.set(id,target);
   if(!equal(l,r)||!equal(target,r))changes.push({id,kind:'store',local:l,server:r,merged:target,write:!equal(target,r)});
  }
  // Index catalog by store/PLU to catch a changed item UUID masquerading as a new PLU.
  const localItems=new Map(),cloudItems=new Map();
  for(const [source,out] of [[local,localItems],[cloud,cloudItems]])for(const [id,v] of source){
   if(v?.type!=='item')continue;
   const key=storeId(v)+'\u0000'+String(v.plu??'').trim();
   if(out.has(key)&&out.get(key)!==id)issues.push(`${docLabel(v)}: terdapat dua ID untuk PLU yang sama.`);
   out.set(key,id);
  }
  for(const id of ids){
   const l=local.get(id),r=cloud.get(id),v=l||r;
   if(v?.type!=='item'){
    if(v?.type!=='store')issues.push(`${id}: jenis dokumen tidak dikenali.`);
    else if((l&&l.type!=='store')||(r&&r.type!=='store'))issues.push(`${id}: jenis dokumen berbeda.`);
    continue;
   }
   const label=docLabel(v),parent=storeId(v),marker=storeClears.get(parent);
   if(!marker){issues.push(`${label}: induk toko berbeda atau belum dapat digabung.`);continue}
   if((l&&l.type!=='item')||(r&&r.type!=='item')||
      (l&&storeId(l)!==parent)||(r&&storeId(r)!==parent)){
    issues.push(`${label}: identitas jenis dokumen/induk toko berbeda.`);continue;
   }
   if(l&&r&&!equal(without(l,'days'),without(r,'days'))){
    issues.push(`${label}: PLU, brand, deskripsi, atau HPP berbeda.`);continue;
   }
   const key=parent+'\u0000'+String(v.plu??'').trim();
   if(!l&&localItems.has(key)){issues.push(`${label}: PLU sudah ada di HP dengan ID berbeda. Jangan menggandakan.`);continue}
   if(!r&&cloudItems.has(key)){issues.push(`${label}: PLU sudah ada di Cloud dengan ID berbeda. Jangan menggandakan.`);continue}
   if(!Array.isArray(v.days)||v.days.length!==7||
      (l&&(!Array.isArray(l.days)||l.days.length!==7))||
      (r&&(!Array.isArray(r.days)||r.days.length!==7))){
    issues.push(`${label}: format QTY 7 hari tidak sesuai.`);continue;
   }
   const days=[];let valid=true;
   for(let i=0;i<7;i++){
    const a=l?.days?.[i],b=r?.days?.[i],date=dateAt(v.week,i);
    if((l&&!isValidQty(a))||(r&&!isValidQty(b))){issues.push(`${label}: QTY ${date} tidak valid.`);valid=false;break}
    if(marker.merged[date]){
     if((marker.local[date]&&l&&a!==0)||(marker.cloud[date]&&r&&b!==0)){
      issues.push(`${label}: data ${date} tidak konsisten dengan penanda hapus pada perangkat yang sama.`);valid=false;break;
     }
     if((a||0)>0||(b||0)>0){clearedQty+=(a||0)+(b||0);clearedItems++}
     days.push(0);
    }else if(l&&r){
     if(a===b)days.push(a);
     else if(a>0&&b===0){days.push(a);localQty+=a}
     else if(b>0&&a===0){days.push(b);cloudQty+=b}
     else{issues.push(`${label}: QTY ${date} berbeda (${a} vs ${b}); keduanya terisi.`);valid=false;break}
    }else days.push(l?a:b);
   }
   if(!valid)continue;
   const target={...v,days};
   merged.set(id,target);
   if(!l)addCloud.push({id,week:v.week,code:v.code,plu:v.plu,description:v.description});
   if(!r)addLocal.push({id,week:v.week,code:v.code,plu:v.plu,description:v.description});
   if(!l||!r||!equal(l,r)||!equal(target,r))changes.push({id,kind:'item',local:l||null,server:r||null,merged:target,write:!equal(target,r)});
  }
  if(issues.length)return{ok:false,reason:`${issues.length} masalah perlu diperiksa. Tidak ada data dikirim atau dihapus.`,issues:issues.slice(0,20),count:changes.length};
  if(changes.length>2000)return{ok:false,reason:`${changes.length} perubahan melampaui batas 2000 dokumen. Backup dan bagi per minggu.`,issues:[],count:changes.length};
  const expected=new Map([...merged]);
  return {ok:true,changes,expected,count:changes.length,
   writeCount:changes.filter(row=>row.write).length,localQty,cloudQty,daysMerged,
   clearedQty,clearedItems,addCloud,addLocal,
   needsApproval:!!(addCloud.length||addLocal.length||clearedItems)};
 }
 const api={build,equal};root.RpmSafeMerge=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
