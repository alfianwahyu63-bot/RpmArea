/* RpmArea V17 - deterministic, conservative reconciliation preview.
   Never writes anything. Merge only non-conflicting QTY (one zero), and
   explicitly reported days present in either copy. A genuine nonzero-QTY
   disagreement, metadata change, or missing document MUST be reviewed.
   The user must approve changes before cloud.js can commit them. */
(function(root){'use strict';
  function canonical(v){
    if(Array.isArray(v))return v.map(canonical);
    if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])]));
    return v;
  }
  const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
  const noKey=(o,k)=>{const n={...o};delete n[k];return n};
  function build(local,cloud){
    if(!(local instanceof Map)||!(cloud instanceof Map))return{ok:false,reason:'Data bukan Map dokumen Firestore.',issues:[]};
    const localOnly=[...local.keys()].filter(k=>!cloud.has(k));
    const cloudOnly=[...cloud.keys()].filter(k=>!local.has(k));
    if(localOnly.length||cloudOnly.length)return{ok:false,reason:`Jumlah dokumen belum sama (hanya HP ${localOnly.length}, hanya cloud ${cloudOnly.length}). Tidak ada dokumen yang boleh dihapus.`,issues:[]};
    const changes=[],issues=[];
    let localQty=0,cloudQty=0,daysMerged=0;
    for(const [id,l] of local){
      const r=cloud.get(id);
      if(equal(l,r))continue;
      const context=`${l?.code||'?'} / ${l?.plu||'toko'}`;
      if(l?.type!==r?.type){issues.push(`${context}: jenis dokumen berbeda`);continue}
      if(l.type==='item'){
        if(!equal(noKey(l,'days'),noKey(r,'days'))){issues.push(`${context}: PLU, brand, deskripsi atau HPP berbeda`);continue}
        if(!Array.isArray(l.days)||!Array.isArray(r.days)||l.days.length!==7||r.days.length!==7){issues.push(`${context}: format 7 hari tidak cocok`);continue}
        const days=[];
        let safe=true;
        for(let d=0;d<7;d++){
          const a=l.days[d],b=r.days[d];
          if(typeof a!=='number'||typeof b!=='number'||!Number.isFinite(a)||!Number.isFinite(b)||a<0||b<0){issues.push(`${context}: QTY tanggal ${d+1} tidak valid`);safe=false;break}
          if(a===b){days.push(a);continue}
          if(a>0&&b===0){days.push(a);localQty+=a;continue}
          if(b>0&&a===0){days.push(b);cloudQty+=b;continue}
          issues.push(`${context}: QTY tanggal ${d+1} HP ${a} ≠ cloud ${b} (keduanya terisi)`);safe=false;break;
        }
        if(safe)changes.push({id,kind:'item',local:l,server:r,merged:{...r,days},write:!equal({...r,days},r)});
      }else if(l.type==='store'){
        if(!equal(noKey(l,'reportedDays'),noKey(r,'reportedDays'))){issues.push(`${context}: target atau data toko berbeda`);continue}
        const a=l.reportedDays||{},b=r.reportedDays||{};
        if(Array.isArray(a)||Array.isArray(b)||typeof a!=='object'||typeof b!=='object'){
          issues.push(`${context}: format status laporan tidak sesuai`);continue;
        }
        let valid=true;
        const merged={...b};
        for(const [day,value] of Object.entries(a)){
          if(!value||typeof value!=='object'||Array.isArray(value)){issues.push(`${context}: status laporan ${day} tidak sesuai`);valid=false;break}
          if(!Object.hasOwn(merged,day)){merged[day]=value;daysMerged++}
          else if(!merged[day]||typeof merged[day]!=='object'||Array.isArray(merged[day])){issues.push(`${context}: status laporan ${day} bertentangan`);valid=false;break}
          // When both sides reported the same date, retain cloud audit marker.
        }
        if(valid){
          const target={...r,...(Object.keys(merged).length?{reportedDays:merged}:{})};
          changes.push({id,kind:'store',local:l,server:r,merged:target,write:!equal(target,r)});
        }
      }else issues.push(`${context}: dokumen bukan toko atau PLU`);
    }
    if(issues.length)return{ok:false,reason:`${issues.length} konflik memerlukan pemeriksaan manual. Tidak ada data dikirim.`,issues:issues.slice(0,15),count:changes.length};
    if(changes.length>200)return{ok:false,reason:`${changes.length} perubahan melebihi batas 200 dokumen untuk satu transaksi aman. Simpan kedua backup dan lakukan pemeriksaan bertahap.`,issues:[]};
    return{ok:true,changes,localQty,cloudQty,daysMerged,count:changes.length,writeCount:changes.filter(c=>c.write).length,
      expected:new Map([...local].map(([id,value])=>[id,changes.find(c=>c.id===id)?.merged||value]))};
  }
  const api={build,equal};
  root.RpmSafeMerge=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
