/* RPM Area V27 — perhitungan prediksi kapasitas (tanpa mengubah data penjualan). */
(function(root){'use strict';
 const DAY=86400000;
 function dayNumber(s){
  if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return NaN;
  const [y,m,d]=s.split('-').map(Number),t=Date.UTC(y,m-1,d),dt=new Date(t);
  return dt.getUTCFullYear()===y&&dt.getUTCMonth()===m-1&&dt.getUTCDate()===d?t/DAY:NaN;
 }
 function analyze(history,nowBytes,limit=500e6){
  const map=new Map();
  for(const row of Array.isArray(history)?history:[]){
   const date=String(row?.date||''),day=dayNumber(date),bytes=Number(row?.bytes);
   if(Number.isFinite(day)&&Number.isFinite(bytes)&&bytes>=0)map.set(date,{date,day,bytes});
  }
  const rows=[...map.values()].sort((a,b)=>a.day-b.day);
  const today=rows.at(-1),prev=rows.length>=2?rows.at(-2):null;
  const gap=prev?today.day-prev.day:0;
  const lastDelta=gap>0?today.bytes-prev.bytes:null;
  const recent=today?rows.filter(r=>today.day-r.day<=7):[];
  const first=recent.length>1?recent[0]:null;
  const span=first?today.day-first.day:0;
  const avgDaily=span>0?(today.bytes-first.bytes)/span:null;
  const valid=Number.isFinite(nowBytes)&&nowBytes>=0;
  const remaining=valid?Math.max(0,limit-nowBytes):null;
  const daysLeft=remaining!==null&&remaining===0?0:(avgDaily>0&&remaining!==null?Math.ceil(remaining/avgDaily):null);
  const utilization=valid?nowBytes/limit:0;
  const level=!valid?'unknown':utilization>=.95?'critical':utilization>=.85?'danger':utilization>=.70?'warning':'normal';
  return {rows,recent,latest:today||null,lastDelta,dayGap:gap,avgDaily,spanDays:span,daysLeft,remaining,level,samples:recent.length};
 }
 const api={analyze,dayNumber};root.RpmQuotaMath=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
