/* RpmArea V10 Safety Vault: backups perangkat di IndexedDB. Tidak pernah menghapus data utama. */
(()=>{'use strict';
 const MAIN='salespulse_area12_v1', DB='rpmarea-safety-v10', STORE='snapshots';
 let dbPromise;
 function openDB(){if(!('indexedDB'in window))return Promise.reject(Error('IndexedDB tidak tersedia'));
  if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore(STORE,{keyPath:'id',autoIncrement:true});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error||Error('IndexedDB'))});
  return dbPromise;}
 function count(raw){try{const s=JSON.parse(raw);if(!s||typeof s.weeks!=='object')return null;let weeks=0,stores=0,items=0;for(const w of Object.values(s.weeks||{})){const arr=Object.values(w.stores||{});if(arr.length)weeks++;stores+=arr.length;for(const store of arr)items+=(store.items||[]).length;}return{weeks,stores,items};}catch{return null}}
 function eligible(raw){const c=count(raw);return !!c&&(c.stores>0||c.items>0)}
 async function snapshot(label,raw){if(!eligible(raw))return false;
  const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite'),table=tx.objectStore(STORE);table.add({savedAt:new Date().toISOString(),label:String(label||'manual'),count:count(raw),raw});let seen=0;const cursor=table.openCursor(null,'prev');cursor.onsuccess=()=>{const cur=cursor.result;if(!cur)return;if(++seen>12)cur.delete();cur.continue()};tx.oncomplete=()=>resolve(true);tx.onerror=()=>reject(tx.error);});}
 async function list(){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly'),r=tx.objectStore(STORE).getAll();r.onsuccess=()=>resolve(r.result.sort((a,b)=>b.id-a.id));r.onerror=()=>reject(r.error)});}
 async function downloadRecord(id){const rows=await list(),r=rows.find(x=>x.id===id);if(!r)return false;download('RpmArea_Pemulihan_'+r.savedAt.replace(/[:.]/g,'-')+'.json',r.raw);return true;}
 function download(name,raw){const url=URL.createObjectURL(new Blob([raw],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
 let timer;
 function backupSoon(raw){if(!eligible(raw))return;clearTimeout(timer);timer=setTimeout(()=>snapshot('perubahan lokal',raw).catch(console.warn),1500)}
 async function beforeRemote(){const raw=localStorage.getItem(MAIN);if(!eligible(raw))return true;
  // Dua tempat berbeda (IndexedDB dan cadangan localStorage) sebelum cloud boleh menimpa data.
  try{await snapshot('SEBELUM DATA CLOUD DITERAPKAN',raw);return true}catch(e){console.error('Safety vault error:',e);return false}}
 window.AreaSafety={snapshot,list,downloadRecord,download,count,backupSoon,beforeRemote,getCurrent:()=>localStorage.getItem(MAIN)};
 const initial=localStorage.getItem(MAIN);if(eligible(initial))snapshot('Saat aplikasi dibuka',initial).catch(console.warn);
})();
