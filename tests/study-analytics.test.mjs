import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {STUDY_MEASURES,STUDY_PHASES,validDate,normalizeVisits,evaluatePatient,aggregateStudy,patientTrendMarkup,patientQualityMarkup,reportHtml,qualityCsv,clinicSummaryCsv} from '../study-analytics.js';
const patients=[
 {id:'p1',clinicCode:'clinic01',patientCode:'SECRET-1',age:56,sex:'Female',diabetesYears:8,history:'Type 2 diabetes',diagnoses:['Hypertension'],otherDiagnoses:'',medications:'Metformin | 1000 mg | BID'},
 {id:'p2',clinicCode:'clinic01',patientCode:'SECRET-2',age:50,sex:'Male',diabetesYears:10,history:'',diagnoses:[],otherDiagnoses:'',medications:''},
 {id:'p3',clinicCode:'clinic02',patientCode:'SECRET-3',age:48,sex:'Male',diabetesYears:7,history:'Type 2 diabetes',diagnoses:[],otherDiagnoses:'',medications:'None'}
];
const visit=(phase,date,hba1c,fpg,egfr,weight)=>({phase,date,hba1c,fpg,egfr,weight,dose:'10/5 mg',adverseEvent:'',medicationChanges:'',diagnosis:'',notes:''});
const visits=new Map([
 ['p1',new Map([
  ['baseline',visit('baseline','2025-01-12',8.0,170,75,70)],
  ['month3',visit('month3','2025-04-12',7.4,145,73,68)],
  ['month6',visit('month6','2025-07-12',7.0,135,70,67)]
 ])],
 ['p2',new Map([['baseline',visit('baseline','2025-01-10',9,190,null,null)]])],
 ['p3',new Map()]
]);
test('valid dates recognize Gregorian impossible dates and leap years',()=>{
 assert.equal(validDate('2025-02-30'),false);
 assert.equal(validDate('2024-02-29'),true);
 assert.equal(validDate('2025-03-02'),true);
 assert.equal(validDate('2025-13-10'),false);
});
test('patient clinical SVG charts show real values but never infer missing measurements',()=>{
 const html=patientTrendMarkup(visits.get('p1'));
 assert.equal((html.match(/class="patient-trend-svg"/g)||[]).length,4);
 for(const v of ['8.0','7.4','7.0','170','145','135','75','73','70','67'])assert.ok(html.includes(v),'missing '+v);
 assert.ok(html.includes('Baseline'));
 assert.ok(!html.includes('SECRET-1'));
 const empty=patientTrendMarkup(visits.get('p3'));
 assert.ok(empty.includes('No values recorded'));
 assert.equal((empty.match(/<polyline/g)||[]).length,0);
});
test('quality checks flag missing baseline, absent optional lab and duration greater than age',()=>{
 const q1=evaluatePatient(patients[0],visits.get('p1'),'2025-10-01');
 assert.equal(q1.visitsRecorded,3);
 assert.equal(q1.errorCount,0);
 const q2=evaluatePatient(patients[1],visits.get('p2'),'2025-10-01');
 assert.ok(q2.issues.some(x=>x.code==='missing-egfr'));
 assert.ok(q2.issues.some(x=>x.code==='history'));
 const q3=evaluatePatient(patients[2],visits.get('p3'),'2025-10-01');
 assert.ok(q3.issues.some(x=>x.code==='missing-baseline'));
 const incompatible=evaluatePatient({...patients[0],age:19,diabetesYears:22},visits.get('p1'),'2025-10-01');
 assert.ok(incompatible.issues.some(x=>x.code==='diabetesYears'));
 assert.ok(patientQualityMarkup(patients[2],visits.get('p3')).includes('Baseline visit is missing'));
});
test('quality checks warn about early follow-up and reject impossible future dates',()=>{
 const map=new Map(visits.get('p1'));
 map.set('month3',visit('month3','2025-02-12',18,900,190,450));
 const q=evaluatePatient(patients[0],map,'2025-10-01');
 assert.ok(q.issues.some(x=>x.code==='early-followup'));
 assert.ok(q.issues.some(x=>x.code==='review-hba1c'));
 assert.ok(q.issues.some(x=>x.code==='range-weight'));
 const future=new Map([['baseline',visit('baseline','2035-10-02',8,140,null,null)]]);
 assert.ok(evaluatePatient(patients[0],future,'2025-10-01').issues.some(x=>x.code==='future-date'));
});
test('study report computes actual sample sizes and paired mean change (no imputation)',()=>{
 const stats=aggregateStudy(patients,visits,[{id:'clinic01',doctorName:'Dr 1'},{id:'clinic02',doctorName:'Dr 2'}],'2025-10-01');
 assert.equal(stats.enrolled,3);
 assert.equal(stats.totalTarget,40);
 assert.equal(stats.clinics[0].enrolled,2);
 assert.equal(stats.clinics[1].enrolled,1);
 assert.equal(stats.visitCounts.baseline,2);
 assert.equal(stats.visitCounts.month3,1);
 assert.equal(stats.visitCounts.month6,1);
 assert.equal(stats.completed,1);
 assert.equal(stats.phases[0].measurements.hba1c.mean,8.5);
 assert.equal(stats.phases[0].measurements.hba1c.n,2);
 assert.equal(stats.phases[1].measurements.hba1c.mean,7.4);
 assert.equal(stats.phases[1].change.hba1c.mean,-0.6);
 assert.equal(stats.phases[1].change.hba1c.n,1);
 assert.equal(stats.phases[0].measurements.egfr.n,1);
});
test('print-ready report and exported CSV do not contain patient names, codes or raw medication history',()=>{
 const stats=aggregateStudy(patients,visits,[{id:'clinic01'},{id:'clinic02'}],'2025-10-01');
 const html=reportHtml(stats);
 const quality=qualityCsv(stats);
 const clinicCsv=clinicSummaryCsv(stats);
 assert.ok(html.includes('Print / Save as PDF'));
 assert.ok(html.includes('</style></head>'));
 assert.ok(html.includes('Baseline'));
 assert.ok(html.includes('paired n'));
 assert.ok(clinicCsv.includes('clinic01'));
 assert.ok(quality.includes('severity'));
 for(const secret of ['SECRET-1','SECRET-2','SECRET-3','Metformin | 1000 mg | BID']){
  assert.ok(!html.includes(secret),'person/medication appeared in html');
  assert.ok(!quality.includes(secret),'person/medication appeared in quality CSV');
  assert.ok(!clinicCsv.includes(secret),'person/medication appeared in clinic summary');
 }
 assert.ok(!html.includes('patientDirectory'));
 assert.ok(!html.includes('firstName'));
});
test('admin report and clinical charts are wired in app without new external services or Firestore writes',()=>{
 const s=fs.readFileSync('portal.js','utf8'),r=fs.readFileSync('firestore.rules','utf8');
 assert.ok(s.includes("['reports',t('Reports & quality'"));
 assert.ok(s.includes("reports:reportsView"));
 assert.ok(s.includes('id="patientTrends"'));
 assert.ok(s.includes('id="patientQuality"'));
 assert.ok(s.includes("if(e.target.id==='downloadStudyReport')"));
 assert.ok(s.includes("if(e.target.id==='runStudyQuality')"));
 assert.ok(s.includes("if(e.target.id==='downloadQualityCsv')"));
 assert.ok(s.includes("if(e.target.id==='downloadClinicSummary')"));
 assert.ok(!r.includes("allow read, write: if true;"));
});
