'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const app=fs.readFileSync('portal.js','utf8');
const rules=fs.readFileSync('firestore.rules','utf8');
const html=fs.readFileSync('index.html','utf8');
const section=(begin,end)=>app.slice(app.indexOf(begin),app.indexOf(end,app.indexOf(begin)+begin.length));
test('new patients must enter clinical history, diseases, and baseline medicines',()=>{
 const form=section('function openEnrollForm(){','function openMedicalProfileForm(');
 assert.ok(form.includes('medicalFields()'));
 assert.ok(form.includes('STEP 03 · BASELINE'));
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
 assert.ok(enroll.includes("batch.set(doc(db,'patientDirectory',patientId)"));
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
 assert.ok(html.includes('portal.js?v=20261014-username-pattern-v2'));
});

test('rendered patient chart displays conditions, baseline medicines and visit history',()=>{
 const vm=require('node:vm');
 const start=app.indexOf('const WEB_URL=');
 const stop=app.indexOf('async function handleClick(e)',start);
 assert.ok(start>0&&stop>start);
 const elements=new Map();
 const lookup=id=>{
  if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',classList:{add(){},remove(){},toggle(){}},querySelector(){return {focus(){}}}});
  return elements.get(id);
 };
 let visitDocs=[];
 const context={
  console,document:{getElementById:lookup},window:{},
  getDocs:async()=>({docs:visitDocs,empty:visitDocs.length===0}),
  collection:()=>({}),db:{},serverTimestamp:()=>({}),
  patientTrendMarkup:()=>'<svg class="patient-trend-svg"></svg>',patientQualityMarkup:()=>'<div>quality checked</div>',
  FormData,Date,URL
 };
 vm.createContext(context);
 vm.runInContext(app.slice(start,stop)+
  '\nglobalThis.exposed={current,patientView,openEnrollForm,showVisits};',context);
 const ui=context.exposed;
 ui.current.user={uid:'clinic-test'};
 ui.current.profile={role:'clinic',active:true,clinicCode:'clinic01'};
 const patient={
  id:'clinic01_PT01',clinicCode:'clinic01',patientCode:'PT01',age:57,
  sex:'Female',diabetesYears:9,history:'Type 2 diabetes',
  diagnoses:['Hypertension'],otherDiagnoses:'',
  medications:'Metformin | 1000 mg | Twice daily | Ongoing'
 };
 ui.current.patient=patient.id;ui.current.view='patients';
 const html=ui.patientView(patient);
 assert.ok(!html.includes('PT01'),'Patient code must not appear visually on patient details.');
 for(const phrase of ['Female','Medical history','Type 2 diabetes','Hypertension','Metformin','Visit history']){
  assert.ok(html.includes(phrase),'Rendered chart missing: '+phrase);
 }
 ui.openEnrollForm();
 assert.ok(lookup('view').innerHTML.includes('STEP 03 · BASELINE'));
 visitDocs=['baseline','month3','month6'].map((id,index)=>({
  id,data:()=>({phase:id,date:'2026-0'+(1+index*3)+'-15',hba1c:8-index*.1,
   fpg:142,egfr:85,weight:72,dose:'10/5 mg',adverseEvent:'None reported',
   medicationChanges:'No changes',diagnosis:'No new disease',notes:'Routine check'})
 }));
 return ui.showVisits(patient).then(()=>{
  const cards=lookup('visitsArea').innerHTML;
  for(const phrase of ['Baseline','Follow-up 1','Follow-up 2','None reported','No changes',
   'No new disease','Routine check','142'])
   assert.ok(cards.includes(phrase),'History missing '+phrase);
  assert.equal(lookup('patientVisitCount').textContent,'3 / 3');
 });
});

test('names-only patient interface never shows a generated code in headings, cards or search labels',()=>{
 const list=section('function patientsView(){','function clinicalFact(');
 const chart=section('function patientView(p){','function usersView(){');
 const visit=section('function openVisitForm(patient,phase){','async function createClinicAccount(');
 assert.ok(!list.includes('esc(p.patientCode)'));
 assert.ok(!chart.includes('esc(p.patientCode)'));
 assert.ok(!visit.includes('esc(patient.patientCode)'));
 assert.ok(!list.includes('Study reference'));
 assert.ok(!chart.includes('Coded study ID'));
 assert.ok(app.includes("return entry?entry.firstName+' '+entry.lastName:t('Patient name not recorded','اسم المريض غير مسجل')"));
});
