/**
 * GLENPA REAL – read-only, coded clinical data analytics.
 * Pure utilities: no Firebase account data, name directory, or remote services.
 * Charts and reports are descriptive only; no efficacy, causality or trial claims.
 */
export const STUDY_PHASES=['baseline','month3','month6'];
export const STUDY_MEASURES=[
 {key:'hba1c',en:'HbA1c',ar:'السكر التراكمي HbA1c',unit:'%',digits:1,lower:3,upper:20,reviewLower:4,reviewUpper:15},
 {key:'fpg',en:'Fasting plasma glucose',ar:'السكر الصائم',unit:'mg/dL',digits:0,lower:30,upper:1000,reviewLower:50,reviewUpper:500},
 {key:'egfr',en:'eGFR',ar:'معدل الترشيح الكلوي eGFR',unit:'mL/min/1.73m²',digits:1,lower:0,upper:200,reviewLower:0,reviewUpper:150},
 {key:'weight',en:'Weight',ar:'الوزن',unit:'kg',digits:1,lower:1,upper:400,reviewLower:25,reviewUpper:250}
];
export const STUDY_TARGET_PER_CLINIC=20;
const xml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):null;
const mean=a=>a.length?a.reduce((sum,x)=>sum+x,0)/a.length:null;
const round=(v,n=1)=>v===null||!Number.isFinite(v)?null:Number(v.toFixed(n));
export function validDate(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const timestamp=Date.parse(value+'T12:00:00Z');
 return Number.isFinite(timestamp)&&new Date(timestamp).toISOString().slice(0,10)===value;
}
function addMonths(iso,months){
 const d=new Date(iso+'T12:00:00Z');
 const day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+months);
 d.setUTCDate(Math.min(day,new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate()));
 return d.toISOString().slice(0,10);
}
export function normalizeVisits(value){
 if(value instanceof Map)return new Map(STUDY_PHASES.filter(p=>value.has(p)).map(p=>[p,value.get(p)]));
 if(Array.isArray(value))return new Map(value.filter(item=>item&&STUDY_PHASES.includes(item.phase||item.id)).map(v=>[v.phase||v.id,v.data||v]));
 return new Map();
}
export function evaluatePatient(patient,visits,today=new Date().toISOString().slice(0,10)){
 const issues=[],v=normalizeVisits(visits),add=(severity,code,en,ar,phase=null)=>issues.push({severity,code,en,ar,phase});
 const patientData=patient||{};
 const age=number(patientData.age),years=number(patientData.diabetesYears);
 if(age===null||age<18||age>110)add('error','age','Age is missing or outside 18–110.','العمر مفقود أو خارج 18–110.');
 if(years===null||years<0||years>100||(age!==null&&years>age))
  add('error','diabetesYears','Review duration of diabetes against patient age.','راجع مدة الإصابة بالسكري مقارنة بعمر المريض.');
 if(!String(patientData.history||'').trim())add('warning','history','Medical/diabetes history is not documented.','التاريخ المرضي وتاريخ السكري غير موثق.');
 if(!Array.isArray(patientData.diagnoses))add('warning','diagnoses','Comorbidities were not structured.','الأمراض المصاحبة غير منظّمة.');
 if(!String(patientData.medications||'').trim())add('notice','medications','Baseline concomitant medications are not documented (confirm none vs missing).','الأدوية المصاحبة الأساسية غير موثقة (تحقق إن كانت غير موجودة أو مفقودة).');
 if(!v.has('baseline'))add('error','missing-baseline','Baseline visit is missing.','زيارة Baseline مفقودة.');
 const previous=['baseline','month3'];
 for(let index=0;index<STUDY_PHASES.length;index++){
  const phase=STUDY_PHASES[index],visit=v.get(phase);
  if(!visit)continue;
  if(visit.phase&&visit.phase!==phase)add('error','phase-mismatch','Visit phase does not match its record.','مرحلة الزيارة لا تطابق سجلها.',phase);
  if(!validDate(visit.date))add('error','visit-date','Visit date is invalid or missing.','تاريخ الزيارة غير صالح أو مفقود.',phase);
  else if(validDate(today)&&visit.date>today)add('error','future-date','Visit date is in the future.','تاريخ الزيارة يقع في المستقبل.',phase);
  if(index>0){
   const prior=v.get(previous[index-1]);
   if(!prior)add('error','missing-prior','Preceding scheduled visit is missing.','الزيارة السابقة المطلوبة مفقودة.',phase);
   else if(validDate(prior.date)&&validDate(visit.date)&&visit.date<addMonths(prior.date,3))
    add('warning','early-followup','Follow-up occurred less than 3 calendar months after the previous visit.','المتابعة حصلت قبل مرور 3 أشهر تقويمية من الزيارة السابقة.',phase);
  }
  for(const metric of STUDY_MEASURES){
   const n=number(visit[metric.key]);
   if(n===null){
    const severity=['hba1c','fpg'].includes(metric.key)?'error':'notice';
    add(severity,'missing-'+metric.key,metric.en+' is missing.',metric.ar+' غير مسجل.',phase);
   }else if(n<metric.lower||n>metric.upper){
    add('error','range-'+metric.key,metric.en+' is outside the permitted entry range.',metric.ar+' خارج النطاق المسموح للإدخال.',phase);
   }else if(n<metric.reviewLower||n>metric.reviewUpper){
    add('warning','review-'+metric.key,metric.en+' is unusual; verify the value and unit.',metric.ar+' قيمة غير اعتيادية؛ تحقّق من القياس والوحدة.',phase);
   }
  }
  if(!['10/5 mg','25/5 mg'].includes(visit.dose))
   add('warning','dose','Glenpa strength is missing or unrecognized.','تركيز جلينبا مفقود أو غير معروف.',phase);
 }
 return {
  issues,errorCount:issues.filter(x=>x.severity==='error').length,
  warningCount:issues.filter(x=>x.severity==='warning').length,
  noticeCount:issues.filter(x=>x.severity==='notice').length,
  visitsRecorded:STUDY_PHASES.filter(p=>v.has(p)).length,
  visitsCompleted:STUDY_PHASES.every(p=>v.has(p)),
  status:issues.some(x=>x.severity==='error')?'review':issues.length?'attention':'complete'
 };
}
export function aggregateStudy(patients,visitsByPatient,clinicList=[],today=new Date().toISOString().slice(0,10)){
 const list=Array.isArray(patients)?patients:[];
 const table=visitsByPatient instanceof Map?visitsByPatient:new Map();
 const clinics=(Array.isArray(clinicList)?clinicList:[]).map(c=>{
  const enrolled=list.filter(p=>p.clinicCode===c.id);
  const visitCounts=STUDY_PHASES.map(phase=>enrolled.filter(p=>normalizeVisits(table.get(p.id)).has(phase)).length);
  return {id:c.id,doctorName:c.doctorName||'',enrolled:enrolled.length,target:STUDY_TARGET_PER_CLINIC,
    completion:Math.round(enrolled.length/STUDY_TARGET_PER_CLINIC*100),visitCounts};
 });
 const phaseStats=STUDY_PHASES.map((phase,index)=>{
  const visits=list.map(p=>normalizeVisits(table.get(p.id)).get(phase)).filter(Boolean);
  const measurements={};
  for(const metric of STUDY_MEASURES){
   const data=visits.map(v=>number(v[metric.key])).filter(x=>x!==null);
   measurements[metric.key]={mean:round(mean(data),metric.digits),n:data.length,unit:metric.unit};
  }
  const change={};
  if(index!==0){
   for(const metric of STUDY_MEASURES){
    const paired=list.map(p=>{
     const v=normalizeVisits(table.get(p.id));
     const a=number(v.get('baseline')?.[metric.key]),b=number(v.get(phase)?.[metric.key]);
     return a!==null&&b!==null?b-a:null;
    }).filter(x=>x!==null);
    change[metric.key]={mean:round(mean(paired),metric.digits),n:paired.length};
   }
  }
  return {phase,n:visits.length,measurements,change};
 });
 const issues=[];
 let recordsWithErrors=0,recordsNeedingAttention=0;
 for(const p of list){
  const analysis=evaluatePatient(p,table.get(p.id),today);
  if(analysis.errorCount)recordsWithErrors++;
  if(analysis.issues.length)recordsNeedingAttention++;
  for(const issue of analysis.issues)issues.push({clinicCode:p.clinicCode,patientCode:p.patientCode,severity:issue.severity,code:issue.code,phase:issue.phase||'',en:issue.en,ar:issue.ar});
 }
 const counts=Object.fromEntries(STUDY_PHASES.map(phase=>[phase,phaseStats.find(p=>p.phase===phase).n]));
 return {
  generatedAt:new Date().toISOString(),today,enrolled:list.length,clinicCount:clinics.length,
  totalTarget:clinics.length*STUDY_TARGET_PER_CLINIC,remaining:Math.max(0,clinics.length*STUDY_TARGET_PER_CLINIC-list.length),
  visitCounts:counts,completed:list.filter(p=>STUDY_PHASES.every(k=>normalizeVisits(table.get(p.id)).has(k))).length,
  clinics,phases:phaseStats,quality:{errors:issues.filter(x=>x.severity==='error').length,
   warnings:issues.filter(x=>x.severity==='warning').length,
   notices:issues.filter(x=>x.severity==='notice').length,
   recordsWithErrors,recordsNeedingAttention,issues}
 };
}
const phaseName=(phase,ar)=>({baseline:ar?'Baseline · الأساسية':'Baseline',month3:ar?'المتابعة الأولى · الشهر 3':'Follow-up 1 · Month 3',month6:ar?'المتابعة الثانية · الشهر 6':'Follow-up 2 · Month 6'}[phase]||phase);
const measureName=(metric,ar)=>ar?metric.ar:metric.en;
const fmt=(v,d=1)=>v===null||v===undefined?'—':Number(v).toFixed(d);
function chartSvg(values,metric,ar=false,{width=650,height=226}={}){
 const labels=STUDY_PHASES.map(x=>phaseName(x,ar));
 const points=values.map((x,i)=>({index:i,value:number(x)})).filter(x=>x.value!==null);
 if(!points.length)return '<p class="trend-no-data">'+(ar?'لا توجد قياسات مسجلة لهذا المؤشر.':'No values recorded for this measure.')+'</p>';
 const left=54,right=22,top=26,bottom=67,w=width-left-right,h=height-top-bottom;
 const collected=points.map(p=>p.value),min0=Math.min(...collected),max0=Math.max(...collected);
 const pad=Math.max((max0-min0)*.23,metric.key==='hba1c'?0.45:metric.key==='weight'?1:metric.key==='egfr'?4:10);
 const min=Math.max(metric.lower,min0-pad),max=Math.min(metric.upper,max0+pad);
 const range=Math.max(max-min,0.001);
 const x=i=>left+i*w/2,y=n=>top+(max-n)*h/range;
 const coords=points.map(p=>[x(p.index),y(p.value)]);
 const polyline=points.length>1?'<polyline fill="none" stroke="#168583" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" points="'+coords.map(([cx,cy])=>cx+','+cy).join(' ')+'"/>':'';
 const guides=Array.from({length:4},(_,i)=>{
  const yy=top+i*h/3,value=max-i*range/3;
  return '<line x1="'+left+'" x2="'+(width-right)+'" y1="'+yy.toFixed(1)+'" y2="'+yy.toFixed(1)+'" stroke="currentColor" opacity=".13" stroke-dasharray="3 6"/>'+
  '<text x="'+(left-9)+'" y="'+(yy+4).toFixed(1)+'" text-anchor="end" fill="currentColor" opacity=".8" font-size="11">'+fmt(value,metric.digits)+'</text>';
 }).join('');
 const valuesText=points.map(p=>'<circle cx="'+x(p.index)+'" cy="'+y(p.value).toFixed(1)+'" r="5.5" fill="#fff" stroke="#168583" stroke-width="3"/>'+
 '<text x="'+x(p.index)+'" y="'+(y(p.value)-12).toFixed(1)+'" text-anchor="middle" fill="currentColor" font-size="13" font-weight="700">'+fmt(p.value,metric.digits)+'</text>').join('');
 const axisLabels=labels.map((label,i)=>{
  const short=ar?['الأساسية','3 أشهر','6 أشهر'][i]:['Baseline','Month 3','Month 6'][i];
  return '<text x="'+x(i)+'" y="'+(height-24)+'" text-anchor="middle" fill="currentColor" font-size="12">'+xml(short)+'</text>';
 }).join('');
 return '<svg class="patient-trend-svg" role="img" aria-label="'+xml(measureName(metric,ar))+'" viewBox="0 0 '+width+' '+height+'" preserveAspectRatio="xMidYMid meet">'+
 guides+polyline+valuesText+axisLabels+'</svg>';
}
export function patientTrendMarkup(visits,{ar=false}={}){
 const map=normalizeVisits(visits);
 return '<div class="trend-chart-grid">'+STUDY_MEASURES.map(metric=>{
  const values=STUDY_PHASES.map(p=>map.get(p)?.[metric.key]??null);
  const available=values.filter(v=>number(v)!==null).length;
  return '<section class="trend-chart-card"><div class="trend-chart-title"><h3>'+xml(measureName(metric,ar))+'</h3>'+
   '<span>'+xml(metric.unit)+'</span></div>'+chartSvg(values,metric,ar)+
   '<p class="trend-chart-note">'+(available>1?(ar?'الاتجاه وصفي ولا يعني فعالية العلاج.':'Descriptive trend, not an estimate of treatment effect.'):
   (ar?'نقطة واحدة أو أقل: لا يمكن تحديد اتجاه.':'One or fewer measurements: no trend can be determined.'))+'</p></section>';
 }).join('')+'</div>';
}
export function patientQualityMarkup(patient,visits,{ar=false}={}){
 const result=evaluatePatient(patient,visits);
 const icon={error:'●',warning:'▲',notice:'○'};
 return '<div class="dq-summary"><strong>'+ (ar?'فحص جودة البيانات':'Data quality check')+'</strong>'+
 '<span class="dq-counter">'+result.errorCount+' '+(ar?'أخطاء':'errors')+' · '+result.warningCount+' '+(ar?'للمراجعة':'review')+' · '+result.noticeCount+' '+(ar?'ملاحظات':'notices')+'</span></div>'+
 (result.issues.length?'<ul class="dq-issues">'+result.issues.map(item=>'<li class="dq-'+item.severity+'"><span aria-hidden="true">'+icon[item.severity]+'</span><span>'+
 (item.phase?xml(phaseName(item.phase,ar))+' · ':'')+xml(ar?item.ar:item.en)+'</span></li>').join('')+'</ul>':
 '<p class="dq-clean">'+(ar?'لم يتم رصد مشكلات وفق الفحوصات المتاحة.':'No issues were detected by the available checks.')+'</p>')+
 '<p class="dq-footnote">'+(ar?'هذه تنبيهات للتحقق من البيانات وليست تشخيصًا طبيًا.':'Quality flags require verification; they are not medical diagnoses.')+'</p>';
}
function reportBody(stats,ar){
 const l=(en,arabic)=>ar?arabic:en;
 const row=(name,a,b,c)=>'<tr><td>'+xml(name)+'</td><td>'+xml(a)+'</td><td>'+xml(b)+'</td><td>'+xml(c)+'</td></tr>';
 const summary='<section class="report-summary">'+[
  [l('Enrolled participants','المشاركون المسجلون'),stats.enrolled],
  [l('Enrollment target','المستهدف'),stats.totalTarget],
  [l('Completed 3 visits','المكملون للزيارات الثلاث'),stats.completed],
  [l('Records with errors','السجلات ذات أخطاء الجودة'),stats.quality.recordsWithErrors]
 ].map(([name,n])=>'<div><small>'+xml(name)+'</small><strong>'+n+'</strong></div>').join('')+'</section>';
 const clinicTable='<h2>'+l('Enrollment by clinic','التسجيل حسب العيادة')+'</h2><table><thead><tr><th>'+l('Clinic code','رمز العيادة')+'</th><th>'+l('Enrolled / 20','المسجلون / 20')+'</th><th>'+l('Baseline','الزيارة الأساسية')+'</th><th>'+l('M3 / M6','الشهر 3 / 6')+'</th></tr></thead><tbody>'+
  stats.clinics.map(c=>row(c.id,c.enrolled+' / 20',c.visitCounts[0],c.visitCounts[1]+' / '+c.visitCounts[2])).join('')+'</tbody></table>';
 const measures=STUDY_MEASURES.map(metric=>{
  return '<h3>'+xml(measureName(metric,ar))+' ('+xml(metric.unit)+')</h3><table><thead><tr><th>'+l('Visit','الزيارة')+'</th><th>'+l('Mean','المتوسط')+'</th><th>'+l('Available n','عدد القياسات')+'</th><th>'+l('Mean change from Baseline (paired n)','متوسط التغير عن الأساسية (العدد المتطابق)')+'</th></tr></thead><tbody>'+
  stats.phases.map(phase=>'<tr><td>'+xml(phaseName(phase.phase,ar))+'</td><td>'+fmt(phase.measurements[metric.key].mean,metric.digits)+'</td><td>'+phase.measurements[metric.key].n+'</td><td>'+
  (phase.phase==='baseline'?'—':fmt(phase.change[metric.key]?.mean,metric.digits)+' ('+(phase.change[metric.key]?.n??0)+')')+'</td></tr>').join('')+'</tbody></table>';
 }).join('');
 const quality='<h2>'+l('Data quality overview','ملخص جودة البيانات')+'</h2>'+
 '<p>'+l('Errors','الأخطاء')+': '+stats.quality.errors+' · '+l('Warnings','تنبيهات المراجعة')+': '+stats.quality.warnings+
 ' · '+l('Missing/notes','النواقص والملاحظات')+': '+stats.quality.notices+'</p>'+
 '<p>'+l('Quality issues are descriptive checks only. Missing optional values are identified separately. No missing clinical outcomes are imputed.',
 'فحوصات الجودة وصفية فقط. تُعرض القيم الاختيارية المفقودة بشكل منفصل ولا تُعوض البيانات السريرية المفقودة.')+'</p>';
 return summary+clinicTable+'<h2>'+l('Visit completion','اكتمال الزيارات')+'</h2><p>'+
  'Baseline: '+stats.visitCounts.baseline+' · Follow-up 1: '+stats.visitCounts.month3+' · Follow-up 2: '+stats.visitCounts.month6+
 '</p><h2>'+l('Descriptive clinical outcomes','المؤشرات السريرية الوصفية')+'</h2>'+measures+quality;
}
export function reportHtml(stats,{ar=false}={}){
 const title=ar?'تقرير دراسة GLENPA REAL':'GLENPA REAL · Study report';
 const generated=new Date(stats.generatedAt).toLocaleString(ar?'ar-JO':'en-GB');
 const heading=ar?'تقرير مرحلي وصفي مبني على السجلات المحفوظة':'Descriptive interim report from recorded study data';
 return '<!doctype html><html lang="'+(ar?'ar':'en')+'" dir="'+(ar?'rtl':'ltr')+'"><head><meta charset="utf-8">'+
 '<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>'+xml(title)+'</title>'+
 '<style>body{font-family:system-ui,Segoe UI,Tahoma,Arial,sans-serif;background:#f5f7f5;color:#193647;margin:0;padding:30px}main{max-width:1020px;margin:auto;background:white;padding:32px 38px;border-radius:20px}h1{color:#176e70;font-size:29px}h2{margin:30px 0 12px;color:#176e70}h3{margin:22px 0 8px}.meta{color:#637e83}.report-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:25px 0}.report-summary div{background:#e8f6f1;padding:18px;border-radius:12px}.report-summary small{display:block;font-size:12px}.report-summary strong{font-size:28px}table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:22px}td,th{border-bottom:1px solid #dce7e5;padding:10px;text-align:start}th{background:#e8f6f1}.note{background:#fff8e7;padding:14px;border-inline-start:4px solid #c49a45;margin-top:20px}.foot{margin-top:28px;font-size:11px;color:#6d7b83}.print-tools{margin:14px 0 25px}.print-tools button{padding:11px 18px;background:#197b74;border:0;color:white;border-radius:10px;font-weight:800;cursor:pointer}@media print{.print-tools{display:none!important}body{background:white;padding:0}main{padding:0;max-width:none}tr{break-inside:avoid}.report-summary{gap:8px}h2{break-after:avoid}}@media(max-width:700px){body{padding:8px}main{padding:18px}.report-summary{grid-template-columns:repeat(2,1fr)}}</style></head><body><main>'+
 '<header><h1>'+xml(title)+'</h1><p>'+xml(heading)+'</p><p class="meta">'+(ar?'تاريخ الإنشاء: ':'Generated: ')+xml(generated)+'</p></header>'+
 '<div class="print-tools"><button type="button" onclick="window.print()">'+(ar?'طباعة / حفظ PDF':'Print / Save as PDF')+'</button></div>'+
 '<div class="note">'+(ar?'تقرير وصفي غير مُراجع إحصائيًا أو سريريًا. لا يتضمن أسماء أو أرقام تعريف شخصية، ولا يثبت فعالية العلاج أو سلامته.':'Descriptive, unvalidated interim output. No patient names or direct identifiers. Not evidence of treatment efficacy or safety.')+'</div>'+
 reportBody(stats,ar)+
 '<footer class="foot">'+(ar?'المصدر: سجلات Firestore المتاحة لحساب الأدمن لحظة إنشاء التقرير · يمنع نشره دون مراجعة الدراسة.':'Source: Firestore coded records available to the administrator at generation time · Subject to study review before distribution.')+
 '</footer></main></body></html>';
}
export function qualityCsv(stats,{includeIdentifiers=false}={}){
 const rows=[['clinicCode',...(includeIdentifiers?['patientCode']:[]),'visit','severity','issueCode','description']];
 for(const item of stats.quality.issues)rows.push([item.clinicCode,...(includeIdentifiers?[item.patientCode||'']:[]),item.phase,item.severity,item.code,item.en]);
 const cell=v=>'"'+String(v??'').replaceAll('"','""').replace(/^[=+\-@\t\r]/,value=>' '+value)+'"';
 return '\ufeff'+rows.map(row=>row.map(cell).join(',')).join('\r\n');
}
export function clinicSummaryCsv(stats){
 const rows=[['clinicCode','enrolled','target','baseline','followup1','followup2','completionPercent'],
  ...stats.clinics.map(c=>[c.id,c.enrolled,c.target,...c.visitCounts,c.completion])];
 return '\ufeff'+rows.map(row=>row.join(',')).join('\r\n');
}
