'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const app=fs.readFileSync('portal.js','utf8');
const rules=fs.readFileSync('firestore.rules','utf8');
const html=fs.readFileSync('index.html','utf8');
const section=(begin,end)=>app.slice(app.indexOf(begin),app.indexOf(end,app.indexOf(begin)+begin.length));
test('new patients must enter clinical history, diseases, and baseline medicines',()=>{
 const form=section('function openEnrollForm(){','function openMedicalProfileForm(');
 assert.ok(form.includes('medicalFields()'));
 assert.ok(form.includes('Baseline · Visit 1 (saved automatically)'));
 for(const name of ['date','hba1c','fpg','egfr','weight','dose','adverseEvent','medicationChanges','diagnosis','notes']){
  assert.ok(form.includes('name="'+name+'"'),name);
 }
 const history=section('function medicalFields(','function patientsView(){');
 for(const field of ['history','diagnoses','otherDiagnoses','medications'])assert.ok(history.includes(field));
});
test('patient registration commits profile and Baseline together atomically',()=>{
 const enroll=section('async function enrollPatient(form){','async function updateMedicalProfile(');
 assert.ok(enroll.includes("const baseline=getVisitValues(form,'baseline')"));
 assert.ok(enroll.includes("batch.set(doc(db,'patients',patientId),payload)"));
 assert.ok(enroll.includes("batch.set(doc(db,'patients',patientId,'visits','baseline'),baseline)"));
 assert.ok(enroll.includes('await batch.commit()'));
 assert.ok(!enroll.includes('await setDoc('));
});
test('visit history has Baseline, follow-up 1 and follow-up 2 with complete clinical details',()=>{
 const visit=section('async function showVisits(patient){','function openEnrollForm(){');
 assert.ok(app.includes("['baseline','month3','month6']"));
 for(const part of ['v.hba1c','v.fpg','v.egfr','v.weight','v.dose','v.adverseEvent','v.medicationChanges','v.diagnosis','v.notes']){
  assert.ok(visit.includes(part),part);
 }
 assert.ok(visit.includes('visit-card completed'));
 assert.ok(visit.includes('visit-card pending'));
});
test('new patient Baseline is required by Firestore and clinic isolation remains',()=>{
 assert.ok(rules.includes('existsAfter(/databases/$(database)/documents/patients/$(patientId)/visits/baseline)'));
 assert.ok(rules.includes('getAfter(patientPath(patientId)).data.clinicCode == myClinic()'));
 assert.ok(rules.includes("request.auth != null"));
 assert.ok(!rules.includes('allow read, write: if true;'));
});
test('CSV preserves patient clinical history, medicines and all visits',()=>{
 const csv=section('async function exportCodedCSV(){','async function downloadQR(){');
 for(const col of ['medicalHistory','comorbidities','baselineMedications','newDiagnoses','adverseEvent','clinicalNotes'])assert.ok(csv.includes(col));
 assert.ok(html.includes('portal.js?v=20261014-clinical-history-v1'));
});
