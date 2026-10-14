'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('portal.js','utf8');
const begin=source.indexOf('const WEB_URL=');
const end=source.indexOf('async function handleClick(e){',begin);
const element=new Map();
function lookup(id){if(!element.has(id))element.set(id,{textContent:'',innerHTML:'',classList:{add(){},remove(){},toggle(){}},querySelector(){return null}});return element.get(id)}
const context={console,document:{getElementById:lookup},window:{},Date,URL,FormData};
vm.createContext(context);
vm.runInContext(source.slice(begin,end)+"\nglobalThis.testUI={current,clinicsView,clinicDetailView,patientView,clinicPatientLabel,CLINIC_PATIENT_TARGET};",context);
const ui=context.testUI;
const patients=[
 {id:'clinic01_A',patientCode:'A',clinicCode:'clinic01',age:61,sex:'Male',diabetesYears:12,
  diagnoses:['Hypertension'],history:'Type 2 diabetes',medications:'Metformin | 1 g | Twice daily | Ongoing'},
 {id:'clinic01_B',patientCode:'B',clinicCode:'clinic01',age:50,sex:'Female',diabetesYears:7,diagnoses:['Obesity'],medications:''},
 {id:'clinic02_C',patientCode:'C',clinicCode:'clinic02',age:46,sex:'Male',diabetesYears:4,diagnoses:[],medications:''}
];
const clinics=[
 {id:'clinic01',doctorName:'Dr First',specialty:'Endocrinologist',area:'Khaldi'},
 {id:'clinic02',doctorName:'Dr Second',specialty:'Internal Medicine',area:'Amman'}
];
function init(){
 ui.current.user={uid:'admin-1'};
 ui.current.profile={role:'study_oversight',active:true};
 ui.current.patients=patients;
 ui.current.clinics=clinics;
 ui.current.patientNames=new Map();
 ui.current.view='clinics';
 ui.current.selectedClinic=null;
}
test('admin clinic roster counts actual Firestore records against target 20, not visit count',()=>{
 init();
 const html=ui.clinicsView();
 assert.equal(ui.CLINIC_PATIENT_TARGET,20);
 assert.ok(html.includes('3 / 40'),'total participant target is 2 clinics x 20');
 assert.ok(html.includes('2 / 20'),'clinic01');
 assert.ok(html.includes('1 / 20'),'clinic02');
 assert.ok(html.includes('data-viewclinic="clinic01"'));
 assert.ok(html.includes('Refresh clinic counts'));
 assert.ok(!html.includes('clinic01_A'),'internal patient document ID not visible');
});
test('admin drilldown shows only selected clinic patients with clinical demographics',()=>{
 init();
 ui.current.selectedClinic='clinic01';
 const html=ui.clinicsView();
 assert.ok(html.includes('Dr First'));
 assert.ok(html.includes('2 / 20'));
 assert.ok(html.includes('Patient 01'));
 assert.ok(html.includes('Patient 02'));
 assert.ok(html.includes('Hypertension'));
 assert.ok(html.includes('data-patient="clinic01_A"'));
 assert.ok(!html.includes('Dr Second'));
 assert.ok(!html.includes('clinic02_C'));
 assert.ok(!html.includes('View patient names'));
});
test('admin patient detail presents clinical history and baseline medicines without displaying real names or coded identifier',()=>{
 init();
 ui.current.selectedClinic='clinic01';
 const html=ui.patientView(patients[0]);
 for(const term of ['Patient 01','Medical history','Type 2 diabetes','Hypertension','Metformin','Visit history','visitsArea']){
  assert.ok(html.includes(term),'missing '+term);
 }
 assert.ok(html.includes('Back to clinic patients'));
 assert.ok(!html.includes('clinic01_A'));
 assert.ok(!html.includes('Coded study ID'));
 assert.ok(!html.includes('Patient name not recorded'));
});
test('clinic drilldown navigation and refresh click actions are wired',()=>{
 assert.ok(source.includes("const clinicButton=e.target.closest('[data-viewclinic]')"));
 assert.ok(source.includes("current.selectedClinic=clinicId;current.patient=null;current.view='clinics';render();return"));
 assert.ok(source.includes("if(isAdmin()&&current.selectedClinic)current.view='clinics'"));
 assert.ok(source.includes("if(e.target.id==='refreshClinicProgress'){if(isAdmin())await safeAction(loadRecords);return}"));
});
