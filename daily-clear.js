/* RpmArea V31 — reset sales reports for one store OR the whole area on one date.
   The store/item catalog, prices, targets, and every other date are untouched. */
(function(root){'use strict';
 const DAY_MS=86400000;
 function asUTC(s){
  if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return NaN;
  const ms=Date.parse(s+'T00:00:00.000Z');
  return Number.isFinite(ms)&&new Date(ms).toISOString().slice(0,10)===s?ms:NaN;
 }
 function dayIndex(week,date){
  const start=asUTC(week),day=asUTC(date);
  if(!Number.isFinite(start)||!Number.isFinite(day))throw Error('Tanggal laporan tidak valid.');
  const index=(day-start)/DAY_MS;
  if(!Number.isInteger(index)||index<0||index>6)throw Error('Tanggal laporan harus berada dalam minggu yang dipilih.');
  return index;
 }
 // Pass null/undefined as storeCode to select the whole area; otherwise exactly one store.
 // Reject empty/unknown codes rather than silently escalating to an area-wide deletion.
 function targetStores(weeks,week,storeCode){
  const all=weeks?.[week]?.stores||{};
  if(storeCode===null||storeCode===undefined)return Object.values(all);
  if(typeof storeCode!=='string'||!storeCode.trim()||!Object.hasOwn(all,storeCode)){
   throw Error('Pilih toko yang valid sebelum menghapus laporan.');
  }
  return [all[storeCode]];
 }
 function preview(weeks,week,date,storeCode=null){
  const index=dayIndex(week,date),all=weeks?.[week]?.stores||{},stores=targetStores(weeks,week,storeCode);
  const result={week,date,index,scope:storeCode===null||storeCode===undefined?'area':'store',
   storeCode:storeCode??null,totalStores:Object.keys(all).length,selectedStores:stores.length,
   affectedStores:0,reportedStores:0,affectedItems:0,qty:0};
  for(const store of stores){
   const hadReport=Object.hasOwn(store.reportedDays||{},date);
   let changedItems=0;
   for(const item of store.items||[]){
    const raw=item.days?.[index];
    if(raw!==undefined&&raw!==null&&Number(raw)!==0){
     changedItems++;
     if(Number.isFinite(Number(raw))&&Number(raw)>0)result.qty+=Number(raw);
    }
   }
   if(hadReport)result.reportedStores++;
   if(hadReport||changedItems){result.affectedStores++;result.affectedItems+=changedItems;}
  }
  return result;
 }
 // Timestamp stays the fourth positional argument for V29 compatibility.
 // The fifth argument selects one store, or null for an entire area.
 function clear(weeks,week,date,at=new Date().toISOString(),storeCode=null){
  const info=preview(weeks,week,date,storeCode);
  if(!info.affectedStores)return info;
  if(!Number.isFinite(Date.parse(at)))throw Error('Waktu penghapusan tidak valid.');
  for(const store of targetStores(weeks,week,storeCode)){
   const hadReport=Object.hasOwn(store.reportedDays||{},date);
   let changed=false;
   for(const item of store.items||[]){
    if(item.days&&item.days[info.index]!==undefined&&item.days[info.index]!==null&&Number(item.days[info.index])!==0){
     item.days[info.index]=0;
     changed=true;
    }
   }
   if(!hadReport&&!changed)continue;
   if(hadReport)delete store.reportedDays[date];
   // Per-store tombstone: prevents conflict-resolution from reviving the deleted day.
   if(!store.clearedDays||typeof store.clearedDays!=='object'||Array.isArray(store.clearedDays))store.clearedDays={};
   store.clearedDays[date]={at,source:info.scope==='store'?'store-day-clear':'bulk-day-clear'};
  }
  return info;
 }
 const api={dayIndex,preview,clear};
 root.RpmDailyClear=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
