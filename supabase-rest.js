/* RpmArea V32 — Supabase PostgREST transport.
   Access controlled by RLS, all writes via atomic compare-and-swap RPC rpm_commit.
   No deletes and no blind overwrite of existing records. */
(function(root){'use strict';
class CloudError extends Error {constructor(message,code='CLOUD_ERROR',http=0){super(message);this.name='CloudError';this.code=code;this.http=http;}}
function canonical(v){return Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v}
const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
function makeClient({supabase,workspaceId}){
 if(!supabase||!workspaceId)throw new CloudError('Konfigurasi Supabase tidak tersedia','CONFIG_ERROR');
 const pageSize=450;
 const mapRow=row=>({value:row.value,updateTime:row.version,updatedAt:row.updated_at});
 function convertError(error){
  const code=String(error?.code||'CLOUD_ERROR');let http=Number(error?.status)||Number(error?.http)||0;
  if(!http&&code==='42501')http=403;
  if(!http&&code==='P0001')http=409;
  if(!http&&code==='23505')http=409;
  if(!http&&/JWT|token|unauthorized/i.test(error?.message||''))http=401;
  const message=String(error?.message||'Kesalahan Supabase');
  return new CloudError(message,code,http);
 }
 async function checked(query,{timeout=30000,writing=false}={}){
  const ac=new AbortController(),timer=setTimeout(()=>ac.abort(),timeout);
  try{
   const res=await (typeof query.abortSignal==='function'?query.abortSignal(ac.signal):query);
   if(ac.signal.aborted)throw new CloudError('Permintaan melewati batas waktu','NETWORK_TIMEOUT');
   if(res.error)throw convertError(res.error);
   return res.data;
  }catch(e){
   if(ac.signal.aborted||e?.name==='AbortError'||/aborted|aborterror/i.test(e?.message||''))
    throw new CloudError(writing?'Penulisan mungkin sudah diproses server. Cek Cloud sebelum mengirim ulang.':'Pembacaan tidak mendapat jawaban server sebelum batas waktu.',
      writing?'TIMEOUT_UNKNOWN':'NETWORK_TIMEOUT');
   if(e instanceof CloudError)throw e;
   throw convertError(e);
  }finally{clearTimeout(timer)}
 }
 async function getMember(uid){
  const data=await checked(supabase.from('rpm_members').select('role')
   .eq('workspace_id',workspaceId).eq('user_id',uid).maybeSingle());
  return data?{value:data,updateTime:null}:null;
 }
 async function getRecord(id){
  const data=await checked(supabase.from('rpm_records').select('id,value,version,updated_at')
   .eq('workspace_id',workspaceId).eq('id',id).maybeSingle());
  return data?mapRow(data):null;
 }
 async function getRecords(ids){
  const unique=Array.from(new Set(ids||[])),result=new Map(unique.map(id=>[id,null]));
  for(let i=0;i<unique.length;i+=70){
   const chunk=unique.slice(i,i+70);
   const data=await checked(supabase.from('rpm_records').select('id,value,version,updated_at')
    .eq('workspace_id',workspaceId).in('id',chunk));
   for(const row of data||[])result.set(row.id,mapRow(row));
  }
  return result;
 }
 async function pages({since=null}={}){
  const output=new Map();let offset=0;
  for(let guard=0;guard<1000;guard++){
   let query=supabase.from('rpm_records').select('id,value,version,updated_at')
    .eq('workspace_id',workspaceId);
   if(since)query=query.gte('updated_at',since);
   query=since?query.order('updated_at',{ascending:true}).order('id',{ascending:true}):query.order('id',{ascending:true});
   const data=await checked(query.range(offset,offset+pageSize-1));
   for(const row of data||[])output.set(row.id,mapRow(row));
   if((data||[]).length<pageSize)return output;
   offset+=pageSize;
  }
  throw new CloudError('Jumlah halaman melebihi batas keamanan','INVALID_PAGINATION');
 }
 const listRecords=()=>pages();
 function changesSince(ts){
  if(!ts||Number.isNaN(new Date(ts).getTime()))throw new CloudError('Penanda waktu sinkronisasi tidak valid','INVALID_CURSOR');
  return pages({since:new Date(ts).toISOString()});
 }
 async function commit(changes,{timeout=30000}={}){
  if(!Array.isArray(changes)||!changes.length)return {writeResults:[]};
  if(changes.length>75)throw new CloudError('Maksimal 75 dokumen per transaksi','INVALID_BATCH');
  const payload=changes.map(change=>{
   if(!change.id||!change.value||typeof change.value!=='object'||Array.isArray(change.value))
    throw new CloudError('Data dokumen tidak valid','INVALID_DATA');
   return {id:String(change.id),value:change.value,
     expected_version:change.previous?.updateTime??null};
  });
  // RPC satu transaksi; bila waktu habis status belum pasti, tidak boleh blind retry.
  return checked(supabase.rpc('rpm_commit',{
    p_workspace_id:workspaceId,p_changes:payload
  }),{timeout,writing:true});
 }
 async function deleteCatalogItems(items,{timeout=30000}={}){
  if(!Array.isArray(items)||!items.length||items.length>75)
   throw new CloudError('Pilih 1–75 PLU per batch','INVALID_DELETE_BATCH');
  const payload=items.map(item=>{
   const v=item?.previous?.updateTime;
   if(typeof item?.id!=='string'||!item.id.startsWith('it_')||
      !Number.isSafeInteger(Number(v))||Number(v)<1)
    throw new CloudError('ID/versi PLU tidak valid: '+String(item?.id),'INVALID_DELETE_DATA');
   return {id:item.id,expected_version:Number(v)};
  });
  // Only the dedicated editor-checked RPC can delete, with a CAS precondition.
  return checked(supabase.rpc('rpm_delete_catalog_items',{
   p_workspace_id:workspaceId,p_items:payload
  }),{timeout,writing:true});
 }
 return {getMember,getRecord,getRecords,listRecords,changesSince,commit,deleteCatalogItems};
}
const api={makeClient,CloudError,canonical,same};
root.RpmCloudREST=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
