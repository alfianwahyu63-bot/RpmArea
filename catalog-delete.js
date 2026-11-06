/* RpmArea V32 — generate a narrow, non-destructive preview for explicit PLU deletion.
   Only documents that are PRESENT in Cloud, ABSENT locally, and whose parent
   store exists in BOTH copies can be proposed. No server writes in this module. */
(function(root){'use strict';
 const parentId=v=>'st_'+encodeURIComponent(String(v?.week??''))+'_'+encodeURIComponent(String(v?.code??''));
 const itemId=v=>'it_'+encodeURIComponent(String(v?.week??''))+'_'+encodeURIComponent(String(v?.code??''))+'_'+encodeURIComponent(String(v?.id??''));
 function candidates(local,cloud){
  if(!(local instanceof Map)||!(cloud instanceof Map))throw Error('Data pembanding tidak valid.');
  const result=[],skipped=[];
  for(const [id,doc] of cloud){
   if(local.has(id))continue;
   if(doc?.type!=='item'){
    if(doc?.type!=='store')skipped.push({id,reason:'Jenis dokumen bukan PLU'});
    continue;
   }
   const parent=parentId(doc);
   if(id!==itemId(doc)||!doc.id||!String(doc.plu??'').trim()){
    skipped.push({id,reason:'Identitas PLU tidak valid'});continue;
   }
   if(local.get(parent)?.type!=='store'||cloud.get(parent)?.type!=='store'){
    skipped.push({id,reason:'Toko induk tidak sama pada HP dan Cloud'});continue;
   }
   if(!Array.isArray(doc.days)||doc.days.length!==7||doc.days.some(n=>typeof n!=='number'||!Number.isFinite(n)||n<0)){
    skipped.push({id,reason:'Data laporan PLU tidak valid'});continue;
   }
   const qty=doc.days.reduce((a,n)=>a+n,0);
   result.push({id,week:doc.week,code:doc.code,plu:String(doc.plu),description:String(doc.description??''),qty});
  }
  result.sort((a,b)=>String(a.week).localeCompare(String(b.week))||String(a.code).localeCompare(String(b.code))||String(a.plu).localeCompare(String(b.plu)));
  return {items:result,skipped};
 }
 const api={candidates};root.RpmCatalogDelete=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
