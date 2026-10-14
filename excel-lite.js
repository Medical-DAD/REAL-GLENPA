/* Offline XLSX for GLENPA REAL clinic roster. No CDNs or external services.
 * Generates valid OOXML ZIP STORE and parses normal Excel ZIP DEFLATE workbooks.
 * Password cells are TEXT to preserve leading zeroes.
 */
import inflateRaw from './vendor/tiny-inflate.js';
const headers=['clinicCode','doctorName','specialty','area','username','password'];
const encoder=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true});
const xmlEscape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const u16=(arr,i,n)=>{arr[i]=n&255;arr[i+1]=(n>>>8)&255};
const u32=(arr,i,n)=>{u16(arr,i,n);u16(arr,i+2,n>>>16)};
const read16=(arr,i)=>arr[i]|arr[i+1]<<8;
const read32=(arr,i)=>(arr[i]|arr[i+1]<<8|arr[i+2]<<16|arr[i+3]<<24)>>>0;
const bytes=s=>encoder.encode(s);
const crcTable=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let j=0;j<8;j++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
function crc32(data){let c=0xffffffff;for(const b of data)c=crcTable[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0}
function zipStore(files){
 const chunks=[],central=[];let cursor=0;
 for(const [path,content]of Object.entries(files)){
  const name=bytes(path),body=bytes(content),crc=crc32(body);
  const local=new Uint8Array(30+name.length);u32(local,0,0x04034b50);u16(local,4,20);u16(local,6,2048);u16(local,8,0);u32(local,14,crc);
  u32(local,18,body.length);u32(local,22,body.length);u16(local,26,name.length);local.set(name,30);
  const record=new Uint8Array(46+name.length);u32(record,0,0x02014b50);u16(record,4,20);u16(record,6,20);u16(record,8,2048);
  u16(record,10,0);u32(record,16,crc);u32(record,20,body.length);u32(record,24,body.length);u16(record,28,name.length);u32(record,42,cursor);
  record.set(name,46);central.push(record);chunks.push(local,body);cursor+=local.length+body.length;
 }
 const offset=cursor;for(const c of central){chunks.push(c);cursor+=c.length}
 const end=new Uint8Array(22);u32(end,0,0x06054b50);u16(end,8,central.length);u16(end,10,central.length);
 u32(end,12,cursor-offset);u32(end,16,offset);chunks.push(end);
 return new Blob(chunks,{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
function rowXml(values,rowIndex){
 return '<row r="'+rowIndex+'">'+values.map((value,col)=>{
  if(value===null||value===undefined||value==='')return '';
  const addr=String.fromCharCode(65+col)+rowIndex;
  return '<c r="'+addr+'" s="'+(rowIndex===1?0:1)+'" t="inlineStr"><is><t>'+xmlEscape(value)+'</t></is></c>';
 }).join('')+'</row>';
}
export function clinicTemplateBlob(){
 const lines=[headers,...Array.from({length:26},(_,i)=>['clinic'+String(i+1).padStart(2,'0'),'','','','',''])];
 const worksheet='<?xml version="1.0" encoding="utf-8" standalone="yes"?>'+
 '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:F27"/><sheetViews><sheetView workbookViewId="0"/></sheetViews>'+
 '<cols><col min="1" max="1" width="16" customWidth="1"/><col min="2" max="2" width="32" customWidth="1"/>'+
 '<col min="3" max="3" width="24" customWidth="1"/><col min="4" max="4" width="21" customWidth="1"/>'+
 '<col min="5" max="5" width="22" customWidth="1"/><col min="6" max="6" width="20" customWidth="1"/></cols>'+
 '<sheetData>'+lines.map((v,i)=>rowXml(v,i+1)).join('')+'</sheetData>'+
 '<sheetProtection sheet="0"/><autoFilter ref="A1:F27"/></worksheet>';
 const files={
  '[Content_Types].xml':'<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'+
   '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'+
   '<Default Extension="xml" ContentType="application/xml"/>'+
   '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'+
   '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'+
   '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
  '_rels/.rels':'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
   '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
  'xl/_rels/workbook.xml.rels':'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
   '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'+
   '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
  'xl/workbook.xml':'<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'+
   '<sheets><sheet name="Clinics" sheetId="1" r:id="rId1"/></sheets></workbook>',
  'xl/styles.xml':'<?xml version="1.0"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+
   '<fonts count="2"><font><sz val="11"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Aptos"/></font></fonts>'+
   '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF237D7B"/><bgColor indexed="64"/></patternFill></fill></fills>'+
   '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'+
   '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'+
   '<cellXfs count="2"><xf numFmtId="0" fontId="1" fillId="1" borderId="0" xfId="0" applyFill="1" applyFont="1"/>'+
   '<xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs></styleSheet>',
  'xl/worksheets/sheet1.xml':worksheet
 };
 return zipStore(files);
}
async function extractXlsx(file){
 if(file.size>1024*1024)throw Error('Excel file exceeds 1 MB');
 const data=new Uint8Array(await file.arrayBuffer());
 let end=-1;for(let i=data.length-22;i>=Math.max(0,data.length-65557);i--)if(read32(data,i)===0x06054b50){end=i;break}
 if(end<0)throw Error('Not a valid .xlsx ZIP workbook');
 const count=read16(data,end+10),offset=read32(data,end+16);let p=offset;
 const wanted=new Set(['xl/worksheets/sheet1.xml','xl/sharedStrings.xml']);
 const result={};
 for(let i=0;i<count;i++){
  if(read32(data,p)!==0x02014b50)throw Error('Invalid workbook index');
  const flags=read16(data,p+8),method=read16(data,p+10),compressed=read32(data,p+20),uncompressed=read32(data,p+24);
  const nlen=read16(data,p+28),extra=read16(data,p+30),comment=read16(data,p+32),start=read32(data,p+42);
  const name=decoder.decode(data.subarray(p+46,p+46+nlen));
  p+=46+nlen+extra+comment;
  if(!wanted.has(name))continue;
  if(uncompressed>3*1024*1024)throw Error('Excel worksheet is too large');
  if(read32(data,start)!==0x04034b50)throw Error('Invalid worksheet ZIP entry');
  const startAt=start+30+read16(data,start+26)+read16(data,start+28);
  const payload=data.subarray(startAt,startAt+compressed);
  if(flags&1)throw Error('Encrypted Excel files are not supported');
  let decoded;
  if(method===0)decoded=payload;
  else if(method===8){
   // Some mobile browsers lack deflate-raw. Keep ZIP decoding entirely local and offline.
   let nativeDecoder=null;
   if(typeof DecompressionStream!=='undefined'){
    try{nativeDecoder=new DecompressionStream('deflate-raw')}catch(_){}
   }
   if(nativeDecoder){
    const stream=new Blob([payload]).stream().pipeThrough(nativeDecoder);
    decoded=new Uint8Array(await new Response(stream).arrayBuffer());
   }else decoded=inflateRaw(payload,new Uint8Array(uncompressed));
  }else throw Error('Unsupported Excel compression method');
  if(decoded.length!==uncompressed)throw Error('Invalid Excel worksheet size');
  if(crc32(decoded)!==read32(data,p-(46+nlen+extra+comment)+16))throw Error('Excel worksheet integrity check failed');
  result[name]=decoder.decode(decoded);
 }
 if(!result['xl/worksheets/sheet1.xml'])throw Error('Workbook has no first worksheet');
 return result;
}
// XML documents may expose childNodes but not Element.children (e.g. some parsers).
const children=(node,name)=>Array.from(node?.childNodes||[]).filter(x=>
 x.nodeType===1 && (x.localName||x.nodeName?.split(':').pop())===name);
const first=(node,name)=>children(node,name)[0];
function docXml(input){
 const d=new DOMParser().parseFromString(input,'application/xml');
 if(d.getElementsByTagName('parsererror').length)throw Error('The Excel worksheet could not be read');
 return d;
}
export async function readClinicTemplate(file){
 if(!/\.xlsx$/i.test(file?.name||''))throw Error('Please upload a .xlsx Excel file');
 const data=await extractXlsx(file);
 const shared=data['xl/sharedStrings.xml']?children(docXml(data['xl/sharedStrings.xml']).documentElement,'si')
   .map(si=>Array.from(si.getElementsByTagName('*')).filter(n=>n.localName==='t').map(n=>n.textContent||'').join('')):[];
 const xml=docXml(data['xl/worksheets/sheet1.xml']);
 const sheetData=Array.from(xml.getElementsByTagName('*')).find(n=>n.localName==='sheetData');
 const rows=[];
 for(const row of children(sheetData,'row')){
  const values=Array(6).fill('');
  for(const cell of children(row,'c')){
   const letters=(cell.getAttribute('r')||'').match(/^[A-Z]+/i)?.[0]?.toUpperCase()||'';
   if(letters.length!==1)continue;
   const col=letters.charCodeAt(0)-65;if(col<0||col>5)continue;
   const v=first(cell,'v'),inline=first(cell,'is'),type=cell.getAttribute('t')||'';
   if(type==='e')throw Error('An Excel cell contains an error');
   if(first(cell,'f'))throw Error('Excel formulas are not allowed in clinic credentials');
   values[col]=type==='s'?shared[Number(v?.textContent)]||'':
    type==='inlineStr'?Array.from(inline?.getElementsByTagName('*')||[]).filter(n=>n.localName==='t').map(n=>n.textContent||'').join(''):
    v?.textContent||'';
  }
  if(values.some(v=>String(v).trim()))rows.push(values.map(v=>String(v).trim()));
  if(rows.length>60)throw Error('Excel file contains too many rows');
 }
 if(!rows.length||rows[0].join('|')!==headers.join('|'))throw Error('Excel headers must be clinicCode, doctorName, specialty, area, username, password');
 return rows.slice(1).filter(r=>r.some(v=>v!=='')&&r.slice(1).some(Boolean)).map((values,index)=>
  Object.fromEntries(headers.map((h,i)=>[h,values[i]||''])));
}
export function downloadClinicTemplate(){
 const url=URL.createObjectURL(clinicTemplateBlob()),a=document.createElement('a');
 a.href=url;a.download='GLENPA-REAL-Clinic-Accounts-Template.xlsx';a.click();
 setTimeout(()=>URL.revokeObjectURL(url),2000);
}
