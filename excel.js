/* Pembaca Excel .xlsx lokal; tidak mengirim file ke server. JSZip disertakan dalam paket. */
(function(){'use strict';
const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const pr='http://schemas.openxmlformats.org/package/2006/relationships';
const rr='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const get=(el,local)=>Array.from(el?.children||[]).find(x=>x.localName===local);
const find=(el,local)=>Array.from(el?.getElementsByTagName('*')||[]).filter(x=>x.localName===local);
const parse=str=>{const d=new DOMParser().parseFromString(str,'application/xml');if(d.querySelector('parsererror'))throw Error('XML Excel tidak valid');return d};
const text=el=>el?el.textContent||'':'';
function colIndex(ref){const p=String(ref||'').match(/^[A-Z]+/i)?.[0]||'';let n=0;for(const c of p.toUpperCase())n=n*26+c.charCodeAt(0)-64;return n-1}
function pathSheet(target){let p=String(target||'').replace(/\\/g,'/');if(p.startsWith('/'))return p.slice(1);if(p.startsWith('xl/'))return p;return 'xl/'+p.replace(/^\.\//,'')}
async function readExcel(file){if(typeof JSZip==='undefined')throw Error('Modul Excel tidak terbaca. Pastikan folder vendor diunggah.');const zip=await JSZip.loadAsync(file);const fileText=async p=>{const f=zip.file(p);return f?f.async('text'):null};const wb=parse((await fileText('xl/workbook.xml'))||'');const rel=parse((await fileText('xl/_rels/workbook.xml.rels'))||'');const rels={};for(const n of find(rel,'Relationship'))rels[n.getAttribute('Id')]=n.getAttribute('Target');const rawSS=await fileText('xl/sharedStrings.xml');const shared=rawSS?find(parse(rawSS),'si').map(n=>find(n,'t').map(text).join('')):[];
const out=[];for(const sh of find(wb,'sheet')){const sheetName=sh.getAttribute('name')||'Sheet';const relId=sh.getAttributeNS(rr,'id')||sh.getAttribute('r:id');const p=pathSheet(rels[relId]);const xml=await fileText(p);if(!xml)continue;const root=parse(xml),rows=[];for(const row of find(root,'sheetData').flatMap(n=>Array.from(n.children).filter(c=>c.localName==='row'))){const idx=Math.max(0,(Number(row.getAttribute('r'))||rows.length+1)-1);if(idx>50000)break;const arr=[];for(const c of Array.from(row.children).filter(x=>x.localName==='c')){const ci=colIndex(c.getAttribute('r'));if(ci<0||ci>160)continue;const typ=c.getAttribute('t'),v=text(get(c,'v'));let val=v;if(typ==='s')val=shared[Number(v)]??'';else if(typ==='inlineStr')val=find(get(c,'is'),'t').map(text).join('');else if(typ==='b')val=v==='1';else if(v!==''&&Number.isFinite(Number(v)))val=Number(v);arr[ci]=val}rows[idx]=arr}out.push({name:sheetName,rows})}
if(!out.length)throw Error('Tidak ada worksheet yang bisa dibaca.');return parseSheets(out)}
function readCSVFile(content){const rows=[];let row=[],s='',quote=false;for(let i=0;i<content.length;i++){const ch=content[i];if(quote){if(ch==='"'&&content[i+1]==='"'){s+='"';i++}else if(ch==='"')quote=false;else s+=ch}else if(ch==='"')quote=true;else if(ch===','||ch===';'&&content.split('\n')[0].includes(';')){row.push(s);s=''}else if(ch==='\n'){row.push(s);rows.push(row);row=[];s=''}else if(ch!=='\r'){s+=ch}}row.push(s);if(row.some(x=>String(x).trim()))rows.push(row);return parseSheets([{name:'CSV',rows}])}
const normalize=v=>String(v??'').trim().toUpperCase().replace(/\s+/g,' ').replace(/[._\-/()]+/g,' ').replace(/[^A-Z0-9 ]/g,'').trim();
const aliases={code:['KODE TOKO','KODE STORE','KODE CABANG','STORE CODE','STORE ID','KD TOKO','ID TOKO','KDTOKO','COD STORE','CODE','KODE'],name:['NAMA TOKO','NAMA STORE','STORE NAME','NAMA CABANG','STORE','TOKO'],qty:['TARGET QTY','QTY TARGET','TARGET QUANTITY','TARGET PCS','TGT QTY','QTY'],ns:['TARGET NS','TARGET NET SALES','TARGET SALES','TARGET NETSALES','TARGET NOMINAL','NET SALES','TGT NS','NS'],plu:['PLU','KODE PLU','SKU','KODE ITEM','ITEM CODE','BARCODE'],desc:['DESKRIPSI PRODUK','DESCRIPTION','DESKRIPSI','NAMA ITEM','NAMA PRODUK','ITEM NAME','PRODUCT NAME'],brand:['BRAND','MEREK','MERK'],hpp:['HPP','HARGA JUAL','HARGA PRODUK','HARGA UNIT','UNIT PRICE','PRICE','HARGA']};
function headMap(row){const map={};row.forEach((cell,i)=>{const label=normalize(cell);if(!label)return;for(const [field,list] of Object.entries(aliases)){if(map[field]===undefined&&list.some(n=>normalize(n)===label)){map[field]=i;break}}});return map}
function nval(input){if(typeof input==='number')return Number.isFinite(input)?input:0;let s=String(input||'').trim().replace(/Rp\s*/gi,'').replace(/\s/g,'');if(!s)return 0;if(s.includes(',')&&s.includes('.'))s=s.lastIndexOf(',')>s.lastIndexOf('.')?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'');else if(s.includes(','))s=/,\d{1,2}$/.test(s)?s.replace(',','.'):s.replace(/,/g,'');else if((s.match(/\./g)||[]).length>=2)s=s.replace(/\./g,'');const n=Number(s);return Number.isFinite(n)?Math.max(n,0):0}
function sval(v){if(v===null||v===undefined)return'';if(typeof v==='number')return Number.isInteger(v)?String(v):String(v);return String(v).trim()}

/* Format khusus file target area.xlsx:
 * TARGET PERTOKO: A=kode, B=nama; C/D=brand1 Qty/Net Sales; E/F=brand2 ...
 * LIST ITEM: A=PLU, B=BRAND, C=Deskripsi, D=HPP (jika tersedia).
 * Target masing-masing toko = total target seluruh brand di sheet TARGET PERTOKO.
 * Satu katalog LIST ITEM disalin untuk setiap toko; HPP dari Excel diisi otomatis
 * untuk setiap PLU dan tetap bisa diedit per toko tanpa mengubah toko lain.
 */
function parseAreaTargetWorkbook(sheets){
 const target=sheets.find(sh=>normalize(sh.name)==='TARGET PERTOKO'||normalize(sh.name)==='TARGET PER TOKO');
 if(!target)return null;
 const rows=target.rows||[];
 let hdr=-1;
 for(let i=0;i<Math.min(rows.length,40);i++){
  const a=normalize(rows[i]?.[0]),b=normalize(rows[i]?.[1]);
  if((a==='KODE TOKO'||a==='KODE STORE')&&(b==='NAMA TOKO'||b==='NAMA STORE')){hdr=i;break}
 }
 if(hdr<0)throw Error('Sheet TARGET PERTOKO: baris KODE TOKO / NAMA TOKO tidak ditemukan.');
 const h1=rows[hdr]||[],h2=rows[hdr+1]||[];
 const cols=[];
 for(let j=2;j<Math.max(h1.length,h2.length)-1;j++){
  const brand=sval(h1[j]);if(!brand||/^(TOTAL|KODE|NAMA)/i.test(brand))continue;
  if(normalize(h2[j])!=='QTY')continue;
  const nsLabel=normalize(h2[j+1]);if(nsLabel!=='NET SALES'&&nsLabel!=='NS'&&nsLabel!=='TARGET NS')continue;
  cols.push({brand,qtyCol:j,nsCol:j+1});j++;
 }
 if(!cols.length)throw Error('Sheet TARGET PERTOKO harus memiliki pasangan kolom BRAND → QTY / NET SALES di baris kedua.');
 const stores=[];const codes=new Set();
 for(let ri=hdr+2;ri<rows.length;ri++){
  const row=rows[ri]||[],code=sval(row[0]).trim(),name=sval(row[1]).trim();
  if(!code||!name||codes.has(code)||/^TOTAL\b/i.test(code))continue;
  const brandTargets={};let totalQty=0,totalNS=0;
  for(const col of cols){const qty=nval(row[col.qtyCol]),ns=nval(row[col.nsCol]);
   if(qty===0&&ns===0)continue;
   brandTargets[col.brand]={qty,ns};totalQty+=qty;totalNS+=ns;
  }
  stores.push({code,name,targetQty:totalQty,targetNS:totalNS,brandTargets});codes.add(code);
 }
 if(!stores.length)throw Error('Sheet TARGET PERTOKO tidak berisi kode dan nama toko.');
 const list=sheets.find(sh=>normalize(sh.name)==='LIST ITEM'||normalize(sh.name)==='DAFTAR ITEM'||normalize(sh.name)==='LIST PLU');
 const catalog=[];
 if(list){let header=-1,hm=null;for(let i=0;i<Math.min(list.rows.length,60);i++){
  const row=list.rows[i]||[];const m=headMap(row);
  if(m.plu!==undefined&&m.brand!==undefined&&m.desc!==undefined){header=i;hm=m;break}
 }
 if(header>=0){const added=new Set();for(let i=header+1;i<list.rows.length;i++){
  const row=list.rows[i]||[],raw=row[hm.plu],plu=sval(raw).replace(/\.0+$/,'').trim(),brand=sval(row[hm.brand]),description=sval(row[hm.desc]);
  // Angka HPP Excel boleh desimal; kosong berarti pertahankan HPP lama pada impor ulang.
  const rawHpp=hm.hpp===undefined?null:row[hm.hpp];
  const hpp=(rawHpp===null||rawHpp===undefined||String(rawHpp).trim()==='')?null:nval(rawHpp);
  if(!plu||!brand||!description||/^#(N\/A|VALUE|REF|DIV)/i.test(plu)||added.has(plu))continue;
  added.add(plu);catalog.push({plu,brand,description,hpp});
 }}
 }
 const items=[];for(const store of stores)for(const itm of catalog)items.push({code:store.code,...itm});
 return {stores,items,sheets:[target.name,...(list?[list.name]:[])],format:'area-brand-matrix',brands:cols.map(c=>c.brand),catalogCount:catalog.length,hppCount:catalog.filter(x=>x.hpp!==null).length};
}

function parseSheets(sheets){const area=parseAreaTargetWorkbook(sheets);if(area)return area;const stores=new Map(),items=new Map(),used=[];for(const sh of sheets){const rows=sh.rows||[];let header=-1,map=null;for(let i=0;i<Math.min(rows.length,80);i++){const m=headMap(rows[i]||[]);if(m.code!==undefined&&((m.name!==undefined&&m.qty!==undefined&&m.ns!==undefined)||(m.plu!==undefined&&m.desc!==undefined)||(m.name!==undefined&&m.plu!==undefined))){header=i;map=m;break}}if(header===-1)continue;used.push(sh.name);let qtyRows=0,itemRows=0;for(let ri=header+1;ri<rows.length;ri++){const r=rows[ri]||[],code=sval(r[map.code]);if(!code||code.length>50||normalize(code).startsWith('TOTAL'))continue;const name=map.name===undefined?'':sval(r[map.name]);const hasTarget=(map.qty!==undefined||map.ns!==undefined),hasPlu=map.plu!==undefined&&map.desc!==undefined;let existing=stores.get(code);
if(!existing)existing={code,name:name||code,targetQty:0,targetNS:0,_hasTargets:false};if(name)existing.name=name;
if(hasTarget){const q=map.qty===undefined?undefined:r[map.qty],nn=map.ns===undefined?undefined:r[map.ns];const containsValue=(v)=>v!==undefined&&v!==null&&String(v).trim()!=='';
if(containsValue(q)||containsValue(nn)){if(!existing._hasTargets){existing.targetQty=nval(q);existing.targetNS=nval(nn);existing._hasTargets=true;qtyRows++}else if(sh.name.toLowerCase().includes('master')){existing.targetQty=nval(q);existing.targetNS=nval(nn)}}}
stores.set(code,existing);
if(hasPlu){const plu=sval(r[map.plu]),desc=sval(r[map.desc]);if(plu&&desc&&!/^#(N\/A|VALUE|REF)/.test(plu)){const key=code+'\u0001'+plu;items.set(key,{code,plu,description:desc,brand:map.brand===undefined?'':sval(r[map.brand]),hpp:map.hpp===undefined||r[map.hpp]===undefined||String(r[map.hpp]).trim()===''?null:nval(r[map.hpp])});itemRows++}}
}}
if(!stores.size)throw Error('Format belum dikenali. Untuk file area asli gunakan sheet TARGET PERTOKO dan LIST ITEM; atau gunakan template MASTER TOKO dan LIST PLU.');
return {stores:[...stores.values()].map(({_hasTargets,...s})=>s),items:[...items.values()],sheets:used}}
window.AreaExcel={readExcel,readCSV:readCSVFile,parseSheets};
})();
