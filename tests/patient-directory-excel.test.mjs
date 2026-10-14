import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {clinicTemplateBlob} from '../excel-lite.js';

const portal=fs.readFileSync('portal.js','utf8');
const rules=fs.readFileSync('firestore.rules','utf8');

test('Clinic XLSX template is a valid ZIP package with 26 rows and text-formatted numeric PINs', async()=>{
 const data=new Uint8Array(await clinicTemplateBlob().arrayBuffer());
 const view=new DataView(data.buffer);
 assert.equal(view.getUint32(0,true),0x04034b50);
 const zip={};
 let pointer=0;
 while(pointer<data.length-30 && view.getUint32(pointer,true)===0x04034b50){
  const len=view.getUint32(pointer+18,true),nameLength=view.getUint16(pointer+26,true),extraLength=view.getUint16(pointer+28,true);
  const name=new TextDecoder().decode(data.subarray(pointer+30,pointer+30+nameLength));
  const start=pointer+30+nameLength+extraLength;
  zip[name]=new TextDecoder().decode(data.subarray(start,start+len));
  pointer=start+len;
 }
 assert.ok(zip['[Content_Types].xml']);
 assert.ok(zip['xl/workbook.xml']);
 const xml=zip['xl/worksheets/sheet1.xml'];
 assert.ok(xml.includes('clinicCode'));assert.ok(xml.includes('doctorName'));assert.ok(xml.includes('username'));assert.ok(xml.includes('password'));
 assert.ok(xml.includes('clinic01'));assert.ok(xml.includes('clinic26'));
 assert.ok(!xml.includes('123456')); // Blank password template
 assert.match(zip['xl/styles.xml'],/numFmtId="49"/); // Text formatting
});
test('Patients are enrolled in one atomic batch with a private clinic-only name document',()=>{
 const code=portal.slice(portal.indexOf('async function enrollPatient(form){'),portal.indexOf('async function updateMedicalProfile'));
 assert.ok(code.includes("batch.set(doc(db,'patients',patientId),payload)"));
 assert.ok(code.includes("batch.set(doc(db,'patientDirectory',patientId)"));
 assert.ok(code.includes("batch.set(doc(db,'patients',patientId,'visits','baseline'),baseline)"));
 assert.ok(code.includes('await batch.commit()'));
 assert.ok(!code.includes("f.get('patientCode')"));
});
test('Patient name can only be read by assigned clinic, not administrator, and coded export excludes names',()=>{
 assert.equal((rules.match(/match \/patientDirectory\/\{patientId\}/g)||[]).length,1);
 assert.match(rules,/allow get, list: if clinic\(\) && resource\.data\.clinicCode == myClinic\(\)/);
 assert.ok(rules.includes('existsAfter(/databases/$(database)/documents/patientDirectory/$(patientId))'));
 assert.ok(!rules.includes('allow read, write: if true'));
 const csv=portal.slice(portal.indexOf('async function exportCodedCSV(){'),portal.indexOf('async function downloadQR()'));
 assert.ok(csv.includes('baselineMedications'));
 assert.ok(!csv.includes('firstName'));
 assert.ok(!csv.includes('lastName'));
});
test('3-step wizard, searchable patient names and XLSX bulk account imports are wired',()=>{
 for(const s of ['data-wizard-step="0"','data-wizard-step="1"','data-wizard-step="2"','wizardNext','wizardBack','setWizardStep','patientSearch','normalizeSearch','downloadClinicXlsx','clinicWorkbookFile','importClinicWorkbook','readClinicTemplate']){
  assert.ok(portal.includes(s),s);
 }
 assert.ok(portal.includes('password'));assert.ok(portal.includes('createClinicAccount'));
});
test('Firestore rules contain only one patient and directory match',()=>{
 assert.equal((rules.match(/match \/patients\/\{patientId\}/g)||[]).length,1);
 assert.equal((rules.match(/match \/patientDirectory\/\{patientId\}/g)||[]).length,1);
 assert.equal((rules.match(/rules_version = /g)||[]).length,1);
});
