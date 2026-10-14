import test from 'node:test';
import assert from 'node:assert/strict';
import {Blob} from 'node:buffer';
import {deflateRawSync,crc32} from 'node:zlib';
import {DOMParser} from '@xmldom/xmldom';
import {readClinicTemplate,clinicTemplateBlob} from '../excel-lite.js';
import inflateRaw from '../vendor/tiny-inflate.js';
globalThis.DOMParser=DOMParser;
const heads=['clinicCode','doctorName','specialty','area','username','password'];
function compressZip(name,content){
 const n=Buffer.from(name),raw=Buffer.from(content,'utf8'),z=deflateRawSync(raw);
 const checksum=crc32(raw);
 const local=Buffer.alloc(30+n.length);
 local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(2048,6);
 local.writeUInt16LE(8,8);local.writeUInt32LE(checksum,14);local.writeUInt32LE(z.length,18);
 local.writeUInt32LE(raw.length,22);local.writeUInt16LE(n.length,26);n.copy(local,30);
 const central=Buffer.alloc(46+n.length);
 central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);
 central.writeUInt16LE(2048,8);central.writeUInt16LE(8,10);
 central.writeUInt32LE(checksum,16);central.writeUInt32LE(z.length,20);
 central.writeUInt32LE(raw.length,24);central.writeUInt16LE(n.length,28);n.copy(central,46);
 const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);
 end.writeUInt16LE(1,8);end.writeUInt16LE(1,10);
 end.writeUInt32LE(central.length,12);end.writeUInt32LE(local.length+z.length,16);
 return Buffer.concat([local,z,central,end]);
}
function sheet(values,encoding='inlineStr'){
 const encode=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;');
 return '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+
 '<sheetData>'+values.map((row,i)=>'<row r="'+(i+1)+'">'+row.map((v,j)=>{
  const ref=String.fromCharCode(65+j)+(i+1);
  return encoding==='inlineStr'?'<c r="'+ref+'" t="inlineStr"><is><t>'+encode(v)+'</t></is></c>':
   '<c r="'+ref+'" t="str"><v>'+encode(v)+'</v></c>';
 }).join('')+'</row>').join('')+'</sheetData></worksheet>';
}
function file(zip){
 const f=new Blob([zip],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
 Object.defineProperty(f,'name',{value:'clinics.xlsx'});
 return f;
}
test('downloaded blank Excel is valid and readable, with all 26 clinic codes',async()=>{
 const blob=clinicTemplateBlob();Object.defineProperty(blob,'name',{value:'template.xlsx'});
 const rows=await readClinicTemplate(blob);
 assert.equal(rows.length,0,'Blank template has no credentials yet');
});
test('upload of a normal compressed Excel sheet reads clinic and PIN with leading zeros',async()=>{
 const source=sheet([heads,['clinic01','Dr Example','Endocrinology','Amman','clinic01','001234']],'str');
 const rows=await readClinicTemplate(file(compressZip('xl/worksheets/sheet1.xml',source)));
 assert.equal(rows.length,1);
 assert.equal(rows[0].clinicCode,'clinic01');
 assert.equal(rows[0].password,'001234');
 assert.equal(rows[0].doctorName,'Dr Example');
});
test('the offline inflate fallback decodes real Excel deflate data',async()=>{
 const source=sheet([heads,['clinic02','Dr Example','GP','Irbid','clinic02','987654']]);
 const compressed=deflateRawSync(Buffer.from(source));
 assert.equal(Buffer.from(inflateRaw(compressed,new Uint8Array(Buffer.byteLength(source)))).toString(),source);
 const previous=globalThis.DecompressionStream;
 globalThis.DecompressionStream=undefined;
 try{
  const rows=await readClinicTemplate(file(compressZip('xl/worksheets/sheet1.xml',source)));
  assert.equal(rows[0].username,'clinic02');
 }finally{globalThis.DecompressionStream=previous}
});
