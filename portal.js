
import{initializeApp,deleteApp}from'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import{getAuth,onAuthStateChanged,signInWithEmailAndPassword,createUserWithEmailAndPassword,signOut,deleteUser,setPersistence,browserSessionPersistence}from'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import{getFirestore,doc,getDoc,getDocs,collection,query,where,setDoc,updateDoc,writeBatch,serverTimestamp}from'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import{firebaseConfig}from'./firebase-config.js';
import{downloadClinicTemplate,readClinicTemplate}from'./excel-lite.js';

const fb=initializeApp(firebaseConfig),auth=getAuth(fb),db=getFirestore(fb);
const ADMIN_EMAIL='medicaldepartmentdad@gmail.com';
// Firebase Auth requires an internal email identifier, but clinic staff never enter or see it.
// Using this app's Firebase Auth domain avoids needing real staff email addresses.
const INTERNAL_CLINIC_DOMAIN='glenpa-real.firebaseapp.com';

const WEB_URL='https://medical-dad.github.io/REAL-GLENPA/';
const $=id=>document.getElementById(id);
const current={language:'en',theme:'blue',user:null,profile:null,view:'overview',clinics:[],patients:[],users:[],patient:null,visitDocs:new Map(),patientNames:new Map(),settings:{studyTitle:'GLENPA REAL',enrollmentEnabled:false},busy:false,alert:'',ready:false};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;',"'":'&#39;'}[c]));
const t=(en,ar)=>current.language==='ar'?ar:en;
const isAdmin=()=>current.profile?.role==='study_oversight';
const clinicKey=()=>current.profile?.clinicCode||'';
const isClinic=()=>current.profile?.role==='clinic';
const isAuthorized=()=>current.user&&current.profile?.active===true&&(isAdmin()||isClinic());
const parseCode=s=>String(s||'').toLowerCase().trim();
const validClinic=s=>/^clinic(0[1-9]|1[0-9]|2[0-6])$/.test(s);
async function emailForUsername(u){if(u==='msl.admin')return ADMIN_EMAIL;const handle=await getDoc(doc(db,'loginHandles',u));if(!handle.exists())throw Error('Account has not been provisioned.');return handle.data().email;}
function escapeCsv(x){let v=String(x??'');if(/^[\s]*[=+@-]/.test(v))v="'"+v;return '"'+v.replace(/"/g,'""')+'"'}
function status(message,kind){current.alert=message;const el=$('globalStatus');el.textContent=message;el.classList.toggle('hidden',!message);el.classList.toggle('critical',kind==='error')}
function settingsTheme(){try{current.theme=localStorage.getItem('glenpa-theme')||'blue'}catch(e){}document.documentElement.dataset.theme=current.theme}
function themeNext(){const a=['blue','green','violet','dark'];current.theme=a[(a.indexOf(current.theme)+1)%a.length];document.documentElement.dataset.theme=current.theme;try{localStorage.setItem('glenpa-theme',current.theme)}catch(e){}}
function updateLanguage(){
 document.documentElement.lang=current.language;document.documentElement.dir=current.language==='ar'?'rtl':'ltr';
 $('language').textContent=current.language==='ar'?'English':'العربية';
 $('signout').textContent=t('Sign out','تسجيل الخروج');
 $('welcomeTitle').textContent=t('Clinical study, connected.','دراستك السريرية، في منصة واحدة.');
 $('welcomeDesc').textContent=t('Secure access for participating clinics. Study records are synchronized through the research database.','دخول مخصص للعيادات المشاركة، وسجلات دراسة متصلة بقاعدة البيانات.');
 $('metricClinics').textContent=t('Participating clinics','عيادة مشاركة');$('metricVisits').textContent=t('Study visits','زيارات الدراسة');
 $('loginTitle').textContent=t('Login','تسجيل الدخول');$('loginDesc').textContent=t('Access your assigned study workspace.','ادخل إلى مساحة العمل المخصصة لعيادتك.');
 $('usernameLabel').textContent=t('Username','اسم المستخدم');$('passwordLabel').textContent=t('Password','كلمة المرور');
 $('loginButton').textContent=t('Enter portal →','دخول بوابة الدراسة ←');
 $('adminTitle').textContent=t('Administrator Access','دخول مسؤول الدراسة');
 $('adminUsernameLabel').textContent=t('Username','اسم المستخدم');$('adminPasswordLabel').textContent=t('Password','كلمة المرور');
 $('adminLoginButton').textContent=t('Access dashboard →','الدخول إلى لوحة الإدارة ←');
 if(isAuthorized())render();
}
function setBusy(id,bool){const el=$(id);if(el)el.disabled=bool}
function errorMessage(err){
 const code=String(err?.code||'');
 if(code==='auth/invalid-credential'||code==='auth/wrong-password'||code==='auth/user-not-found')return t('The Firebase account or password is incorrect. Verify the administrator account linked to msl.admin.','حساب فايربيس أو كلمة مروره غير صحيحة. تأكد من حساب الأدمن المرتبط باسم msl.admin.');
 if(code==='auth/unauthorized-domain')return t('Add medical-dad.github.io to Firebase Authentication authorized domains.','يجب إضافة medical-dad.github.io إلى النطاقات المسموحة في Firebase Authentication.');
 if(code==='auth/operation-not-allowed')return t('Enable Email/Password in Firebase Authentication sign-in methods.','يجب تفعيل تسجيل الدخول بالبريد وكلمة المرور في Firebase Authentication.');
 if(code==='auth/email-already-in-use')return t('A Firebase account already exists for this username. Please choose another username or manage the previous account using the local administration tool.','يوجد حساب Firebase بنفس اسم المستخدم. اختر اسمًا آخر أو استخدم أداة الإدارة المحلية لإدارة الحساب القديم.');
 if(code==='auth/weak-password')return t('Firebase requires a password of at least six digits.','يتطلب Firebase كلمة مرور من ستة أرقام على الأقل.');
 if(code.includes('permission-denied'))return t('Firestore denied this operation. Confirm published rules and the active user profile.','رفضت Firestore العملية. تأكد من نشر القواعد وصلاحية حساب المستخدم.');
 if(code.includes('unavailable'))return t('Database temporarily unavailable. Retry.','قاعدة البيانات غير متاحة مؤقتًا. حاول مجددًا.');
 if(err?.message?.startsWith('No study access profile')||err?.message?.startsWith('Inactive or invalid study access profile'))return t('Firebase login succeeded, but this account has no active study access profile.','تم تسجيل الدخول إلى Firebase، لكن حسابك لا يملك صلاحية دراسة مفعلة.');
 return t('Could not complete operation.','تعذّر إكمال العملية.')+' '+String(err?.message||'').slice(0,140);
}
async function login(username,password,admin){
 const u=parseCode(username);
 if(admin&&u!=='msl.admin')throw Error('Invalid administrator username');
 if(!admin&&(!/^[a-z0-9._-]{3,40}$/.test(u)||u==='msl.admin'))throw Error('Invalid clinic username');
 await setPersistence(auth,browserSessionPersistence);
 await signInWithEmailAndPassword(auth,await emailForUsername(u),password);
}
function renderNav(){
 const links=isAdmin()?[
 ['overview',t('Overview','نظرة عامة')],['clinics',t('Clinics','العيادات')],['patients',t('Study records','سجلات الدراسة')],['users',t('Users','المستخدمون')],['settings',t('Settings','الإعدادات')],['qr','QR Code']]:
 [['overview',t('My clinic','عيادتي')],['patients',t('Study records','سجلات الدراسة')],['account',t('My account','حسابي')],['contact',t('Contact Us','اتصل بنا')]];
 $('nav').innerHTML=links.map(([key,name])=>'<button type="button" data-nav="'+key+'" class="'+(current.view===key?'active':'')+'">'+esc(name)+'</button>').join('');
}
function render(){
 $('authScreen').classList.toggle('hidden',isAuthorized());
 $('appScreen').classList.toggle('hidden',!isAuthorized());
 $('signout').classList.toggle('hidden',!isAuthorized());
 if(!isAuthorized())return;
 renderNav();
 $('scopeCaption').textContent=isAdmin()?t('STUDY OVERSIGHT','الإشراف على الدراسة'):t('PARTICIPATING CLINIC','العيادة المشاركة');
 const label={overview:t('Study overview','نظرة عامة على الدراسة'),clinics:t('Participating clinics','العيادات المشاركة'),patients:t('Patient records','سجلات المرضى'),users:t('Access management','إدارة المستخدمين'),settings:t('Study settings','إعدادات الدراسة'),qr:'QR Code',account:t('My account','حسابي'),contact:t('Contact Us','اتصل بنا')};
 $('sectionTitle').textContent=label[current.view]||label.overview;
 $('sectionSub').textContent=isAdmin()?t('Authorized medical affairs workspace','مساحة الإشراف الطبي المخوّلة'):
   (current.clinics.find(c=>c.id===clinicKey())?.doctorName||clinicKey());
 $('roleBadge').textContent=isAdmin()?t('Study administrator','مسؤول الدراسة'):t('Clinic account','حساب العيادة');
 if(!current.ready){$('view').innerHTML=panel(t('Connecting to study database','جارٍ الاتصال بقاعدة بيانات الدراسة'),'<p>'+t('Clinical functions remain unavailable until the database permission checks complete.','تبقى الوظائف السريرية غير متاحة حتى يكتمل التحقق من صلاحيات قاعدة البيانات.')+'</p>');return;}
 const views={overview:overview,clinics:clinicsView,patients:patientsView,users:usersView,settings:settingsView,qr:qrView,account:accountView,contact:contactView};
 $('view').innerHTML=(views[current.view]||overview)();
 if(current.view==='qr')setTimeout(renderQR,0);
 if(current.view==='patients'&&current.patient){const p=current.patients.find(x=>x.id===current.patient);if(p)showVisits(p)}
}
function panel(title,body){return '<section class="panel"><h2>'+title+'</h2>'+body+'</section>'}
function metric(title,value){return '<article class="metric"><small>'+title+'</small><b class="tabular">'+value+'</b></article>'}
function overview(){
 const cnt=current.patients.length,all=current.clinics.length;
 return '<div class="grid">'+metric(t('Enrolled coded records','السجلات المرمّزة المسجلة'),cnt)+metric(t('Participating clinics','العيادات المشاركة'),all)+metric(t('Study visits','زيارات الدراسة'),'03')+'</div>'+
 panel(t('Research data workspace','مساحة بيانات الدراسة'),
 '<p class="muted">'+t('All clinical records here are retrieved from Firestore. Access to each clinic is restricted by database authorization rules.','تُقرأ سجلات الدراسة مباشرة من Firestore، وتُفرض صلاحيات كل عيادة من قواعد قاعدة البيانات.')+'</p>'+
 '<div class="actions"><button class="cta" data-nav="patients">'+t('Open study records','فتح سجلات الدراسة')+'</button>'+
 (isAdmin()?'<button class="secondary" data-nav="clinics">'+t('Clinic roster','قائمة العيادات')+'</button>':'')+'</div>')+
 panel(t('Data protection','حماية البيانات'),'<div class="security-note">'+t('Use coded study IDs only. Do not enter patient names, civil IDs, telephone numbers or other direct identifiers. Follow your approved protocol, ethics, privacy and pharmacovigilance procedures.','استخدم رموز مرضى الدراسة فقط. يمنع إدخال أسماء المرضى أو الأرقام الوطنية أو الهواتف أو أي معرف مباشر. يجب الالتزام بالبروتوكول المعتمد وإجراءات الأخلاقيات والخصوصية واليقظة الدوائية.')+'</div>');
}
function clinicsView(){
 if(!isAdmin())return panel(t('Restricted','غير مخوّل'),t('Clinic management requires administrator permission.','إدارة العيادات تتطلب صلاحية المسؤول.'));
 return panel(t('Doctor and clinic roster','قائمة الأطباء والعيادات'),
 '<div class="table-scroll"><table><thead><tr><th>'+t('Code','الرمز')+'</th><th>'+t('Doctor','الطبيب')+'</th><th>'+t('Specialty','الاختصاص')+'</th><th>'+t('Area','المنطقة')+'</th><th>'+t('Edit','تعديل')+'</th></tr></thead><tbody>'+
 current.clinics.map(c=>'<tr><td>'+esc(c.id)+'</td><td><b>'+esc(c.doctorName||c.name||'')+'</b></td><td>'+esc(c.specialty||'')+'</td><td>'+esc(c.area||'')+'</td><td><button class="link" data-editclinic="'+esc(c.id)+'">'+t('Edit','تعديل')+'</button></td></tr>').join('')+
 '</tbody></table></div>');
}
// Clinical profile fields mirror the original GLENPA REAL baseline form.
// No patient names or other direct identifiers are collected.
const COMORBIDITIES=[
 ['Hypertension','ارتفاع ضغط الدم'],
 ['Dyslipidemia','اضطراب شحميات الدم'],
 ['Chronic kidney disease','مرض الكلى المزمن'],
 ['Coronary artery disease','مرض الشريان التاجي'],
 ['Heart failure','قصور القلب'],
 ['Obesity','السمنة'],
 ['Hypothyroidism','قصور الغدة الدرقية'],
 ['Atrial fibrillation','الرجفان الأذيني'],
 ['Peripheral arterial disease','مرض الشرايين المحيطية'],
 ['Stroke or TIA','السكتة الدماغية أو النوبة الإقفارية العابرة'],
 ['Chronic liver disease','مرض الكبد المزمن'],
 ['Chronic obstructive pulmonary disease','داء الانسداد الرئوي المزمن'],
 ['Asthma','الربو'],
 ['Other','أخرى']
];
const VISIT_PHASES=['baseline','month3','month6'];
const visitLabel=phase=>({baseline:t('Baseline · Visit 1','الزيارة الأساسية · Baseline'),month3:t('Follow-up 1 · Month 3','المتابعة الأولى · الشهر الثالث'),month6:t('Follow-up 2 · Month 6','المتابعة الثانية · الشهر السادس')})[phase]||phase;
const showValue=value=>value===undefined||value===null||String(value).trim()===''?t('Not recorded','غير مسجّل'):esc(value);
const labelComorbidity=value=>{const pair=COMORBIDITIES.find(c=>c[0]===value);return pair?t(pair[0],pair[1]):esc(value)};
function medicationLines(p){
 if(Array.isArray(p.medications))return p.medications.map(m=>typeof m==='string'?m:[m.name,m.dose,m.frequency,m.status].filter(Boolean).join(' | ')).join('\n');
 return String(p.medications||'');
}
function medicationTable(value){
 const lines=String(value||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean).slice(0,25);
 if(!lines.length)return '<p class="muted">'+t('No baseline medications entered.','لم تُسجل أدوية أساسية بعد.')+'</p>';
 return '<div class="table-scroll"><table class="medications-table"><thead><tr><th>'+t('Medicine','الدواء')+'</th><th>'+t('Dose','الجرعة')+'</th><th>'+t('Frequency','التكرار')+'</th><th>'+t('Status','الحالة')+'</th></tr></thead><tbody>'+
 lines.map(line=>{const a=line.split('|').map(s=>s.trim());return '<tr>'+Array.from({length:4},(_,i)=>'<td>'+showValue(a[i])+'</td>').join('')+'</tr>'}).join('')+'</tbody></table></div>';
}
function diagnosisSelector(selected=[]){
 return '<div class="diagnosis-grid">'+COMORBIDITIES.map(([en,ar])=>
  '<label class="diagnosis-option"><input type="checkbox" name="diagnoses" value="'+esc(en)+'" '+(selected.includes(en)?'checked':'')+'><span>'+t(en,ar)+'</span></label>'
 ).join('')+'</div>';
}
function medicalFields(p={}){
 const diagnoses=Array.isArray(p.diagnoses)?p.diagnoses:[];
 return '<div class="field-grid">'+
 '<label class="span2">'+t('Medical history','التاريخ المرضي')+'<textarea name="history" maxlength="1500" rows="3" placeholder="'+t('Coded clinical background only, no names or contact information','تاريخ مرضي دون أسماء أو بيانات تواصل')+'">'+esc(p.history||'')+'</textarea></label>'+
 '<div class="span2"><span class="field-label">'+t('Comorbidities (select all applicable)','الأمراض المصاحبة (اختر جميع الحالات)')+'</span>'+diagnosisSelector(diagnoses)+'</div>'+
 '<label class="span2">'+t('Other comorbidities (specify)','أمراض مصاحبة أخرى (حدّد)')+'<input name="otherDiagnoses" maxlength="500" value="'+esc(p.otherDiagnoses||'')+'"></label>'+
 '<label class="span2">'+t('Concomitant medications · medicine | dose | frequency | status (one per line)','الأدوية المصاحبة · الدواء | الجرعة | التكرار | الحالة (سطر لكل دواء)')+
 '<textarea name="medications" maxlength="1600" rows="5" placeholder="Metformin | 1000 mg | Twice daily | Ongoing">'+esc(medicationLines(p))+'</textarea></label></div>'+
 '<p class="help">'+t('Do not enter names, national IDs, phone numbers or other direct patient identifiers.','يرجى عدم إدخال أسماء أو أرقام وطنية أو هواتف أو أي معرفات شخصية مباشرة.')+'</p>';
}
function readMedicalFields(form){
 const f=new FormData(form);
 const diagnoses=f.getAll('diagnoses').map(String);
 return {
  history:String(f.get('history')||'').trim(),
  diagnoses:COMORBIDITIES.filter(pair=>diagnoses.includes(pair[0])).map(pair=>pair[0]),
  otherDiagnoses:String(f.get('otherDiagnoses')||'').trim(),
  medications:String(f.get('medications')||'').trim()
 };
}

function patientName(p){
 const entry=current.patientNames.get(p.id);
 return entry?entry.firstName+' '+entry.lastName:p.patientCode;
}
const normalizeSearch=value=>String(value||'').normalize('NFKD').replace(/[\u064B-\u065F\u0670]/g,'').toLocaleLowerCase().trim().replace(/\s+/g,' ');
function patientsView(){
 const enrollment=isClinic()&&current.settings.enrollmentEnabled===true;
 const myList=isAdmin()?current.patients:current.patients.filter(p=>p.clinicCode===clinicKey());
 const patient=current.patient&&myList.find(x=>x.id===current.patient);
 if(patient)return patientView(patient);
 const search=isClinic()?'<label class="patient-search">'+t('Search patients by first and last name','ابحث عن المريض بالاسم الأول واسم العائلة')+
 '<input id="patientSearch" type="search" autocomplete="off" placeholder="'+t('Type the patient name…','اكتب اسم المريض…')+'"></label>':'';
 const heading='<div class="row"><p class="muted">'+t('Clinic staff can search patient names. Study reporting remains coded.','العيادة تستطيع البحث باسم المريض، بينما تبقى بيانات الدراسة مرمّزة.')+'</p>'+
 '<div class="actions">'+(enrollment?'<button class="cta" id="newPatientBtn">'+t('+ Enroll patient','+ تسجيل مريض')+'</button>':'')+
 '<button class="secondary" id="exportCsvBtn">'+t('Export coded study data','تصدير بيانات الدراسة المرمّزة')+'</button></div></div>';
 const notice=isClinic()&&!enrollment?'<div class="notice">'+t('New enrollment is currently disabled.','تسجيل المرضى الجدد متوقف حاليًا.')+'</div>':'';
 return panel(t('Patient registry','سجل المرضى'),heading+notice+search+
 '<div class="table-scroll"><table><thead><tr><th>'+t('Patient','المريض')+'</th><th>'+t('Clinic','العيادة')+'</th><th>'+t('Age / Sex','العمر / الجنس')+'</th><th>'+t('Diabetes years','سنوات السكري')+'</th><th>'+t('History','السجل')+'</th></tr></thead><tbody>'+
 myList.map(p=>'<tr class="patient-list-row" data-patient-search="'+esc(normalizeSearch(patientName(p)+' '+p.patientCode))+'">'+
 '<td><b>'+esc(patientName(p))+'</b>'+(isClinic()?'<small class="subtle-id">'+t('Study reference','رمز الدراسة')+': '+esc(p.patientCode)+'</small>':'')+'</td>'+
 '<td>'+esc(p.clinicCode)+'</td><td>'+esc(p.age)+' / '+esc(p.sex)+'</td><td>'+esc(p.diabetesYears)+'</td>'+
 '<td><button class="link" data-patient="'+esc(p.id)+'">'+t('View patient','عرض الملف')+'</button></td></tr>').join('')+
 '</tbody></table></div>'+'<p id="patientSearchEmpty" class="empty hidden">'+t('No matching patients.','لا يوجد مرضى مطابقون للبحث.')+'</p>'+
 (myList.length?'':'<div class="empty">'+t('No patients enrolled.','لا يوجد مرضى مسجلون.')+'</div>'));
}
function clinicalFact(label,value,suffix=''){
 return '<div class="clinical-fact"><span>'+label+'</span><strong>'+showValue(value)+(value!==null&&value!==undefined&&String(value)!==''?suffix:'')+'</strong></div>';
}
function patientView(p){
 const canWrite=isClinic()&&p.clinicCode===clinicKey();
 const conditions=Array.isArray(p.diagnoses)?p.diagnoses:[];
 const names=conditions.map(labelComorbidity);
 if(p.otherDiagnoses)names.push(esc(p.otherDiagnoses));
 const fullName=current.patientNames.get(p.id);
 const clinicalProfile=panel(t('Diabetes profile & medical history','ملف السكري والتاريخ المرضي'),
  '<div class="clinical-kv">'+
  '<div><small>'+t('Sex','الجنس')+'</small><strong>'+(p.sex==='Female'?t('Female','أنثى'):p.sex==='Male'?t('Male','ذكر'):showValue(p.sex))+'</strong></div>'+
  '<div><small>'+t('Diabetes duration','مدة السكري')+'</small><strong>'+showValue(p.diabetesYears)+' '+t('years','سنة')+'</strong></div>'+
  '<div><small>'+t('Medical history','التاريخ المرضي')+'</small><strong>'+showValue(p.history)+'</strong></div>'+
  '<div><small>'+t('Comorbidities','الأمراض المصاحبة')+'</small><strong>'+(names.length?names.join('، '):t('Not recorded','غير مسجّلة'))+'</strong></div>'+
  '</div><h3>'+t('Baseline concomitant medications','الأدوية المصاحبة الأساسية')+'</h3>'+
  medicationTable(medicationLines(p))+
  (canWrite?'<div class="actions"><button class="secondary" type="button" id="editMedicalProfile">'+t('Edit medical profile','تعديل التاريخ المرضي والأدوية')+'</button></div>':''));
 return '<div class="actions"><button class="secondary" type="button" id="backPatients">'+t('← Back to patient registry','← الرجوع إلى سجل المرضى')+'</button></div>'+ 
 (fullName?'<div class="patient-name-hero"><h2>'+esc(fullName.firstName+' '+fullName.lastName)+'</h2><small>'+t('Internal study reference','الرمز الداخلي للدراسة')+': '+esc(p.patientCode)+'</small></div>':
 '<div class="patient-name-hero"><h2>'+t('Patient name not recorded','اسم المريض غير مسجل')+'</h2><small>'+esc(p.patientCode)+'</small></div>')+
 (canWrite?'<div class="actions"><button class="secondary" id="editPatientName">'+t(fullName?'Correct patient name':'Add patient name',fullName?'تصحيح اسم المريض':'إضافة اسم المريض')+'</button></div>':'')+
 '<div class="grid">'+metric(t('Coded study ID','رمز المريض'),esc(p.patientCode))+
 metric(t('Age','العمر'),esc(p.age))+
 metric(t('Recorded study visits','الزيارات المسجّلة'),'<span id="patientVisitCount">…</span>')+'</div>'+
 clinicalProfile+
 panel(t('Visit history · Baseline & follow-ups','سجل الزيارات · Baseline والمتابعات'),
 '<p class="muted">'+t('Open each visit to review its clinical values, therapy changes, newly diagnosed diseases, adverse events and notes.','افتح أي زيارة لمراجعة نتائجها السريرية وتغييرات الأدوية والتشخيصات الجديدة والأحداث الضارة والملاحظات.')+'</p>'+
 '<div id="visitsArea" class="visit-history">'+t('Loading patient visit history…','جارٍ تحميل سجل زيارات المريض…')+'</div>'+
 '<div class="security-note">'+t('Safety entries here do not replace formal pharmacovigilance reporting.','تسجيل الأحداث الضارة هنا لا يحل محل إجراءات الإبلاغ الرسمية لليقظة الدوائية.')+'</div>');
}
function usersView(){
 if(!isAdmin())return '';
 return panel(t('Account directory','دليل الحسابات'),
 '<p class="muted">'+t('Create clinic usernames and numeric passwords. No email address is required from doctors.','أنشئ حسابات العيادات بأسماء مستخدمين وكلمات مرور رقمية، بدون طلب إيميل من الأطباء.')+'</p>'+
 '<form id="createUserForm"><div class="field-grid"><label>'+t('Username','اسم المستخدم')+'<input name="username" placeholder="clinic01" pattern="[a-zA-Z0-9._-]{3,40}" required></label>'+
 '<label>'+t('Clinic','العيادة')+'<select name="clinicCode" required>'+current.clinics.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.id+' · '+(c.doctorName||''))+'</option>').join('')+'</select></label>'+
 '<label>'+t('Numeric password (6 digits minimum)','كلمة مرور رقمية (6 أرقام على الأقل)')+'<input type="password" name="password" inputmode="numeric" pattern="[0-9]{6,32}" required minlength="6" maxlength="32" autocomplete="new-password" title="6 to 32 digits"></label></div>'+
 '<div class="actions"><button class="cta" type="submit">'+t('Create clinic account','إنشاء حساب العيادة')+'</button></div></form>'+
 '<p class="help">'+t('Six digits are the minimum, not a strong medical-data password. Disable users instantly here. Password resets and permanent account deletion are performed using the private local administrator tool, without Blaze or additional hosting.','ستة أرقام هي الحد الأدنى وليست كلمة مرور قوية لبيانات طبية. يمكنك تعطيل الحسابات هنا فورًا. تغيير كلمات المرور والحذف النهائي يتمان عبر أداة إدارة خاصة على جهازك دون Blaze أو استضافة إضافية.')+'</p>'+
 '<div class="excel-import-card"><div class="row"><div><h3>'+t('Import clinic accounts from Excel','استيراد حسابات العيادات من Excel')+'</h3>'+
 '<p class="muted">'+t('Download the template, fill doctor details, username and PIN, then upload the .xlsx file. Up to 26 clinics.','نزّل القالب واملأ اسم الطبيب والتخصص والمنطقة واسم المستخدم والرقم السري ثم ارفع ملف Excel. حتى 26 عيادة.')+'</p></div></div>'+
 '<div class="actions"><button type="button" class="secondary" id="downloadClinicXlsx">'+t('Download Excel template','تنزيل قالب Excel')+'</button>'+
 '<label class="file-button">'+t('Choose completed Excel file','اختيار ملف Excel المعبّأ')+'<input id="clinicWorkbookFile" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"></label>'+
 '<button type="button" class="cta" id="importClinicWorkbook" disabled>'+t('Import clinic accounts','استيراد حسابات العيادات')+'</button></div>'+
 '<p id="clinicWorkbookStatus" class="muted" aria-live="polite"></p>'+
 '<p class="help">'+t('Excel contains PINs in plain text: keep it private and delete it after import. Existing users are not reset by import.','ملف Excel يحتوي الأرقام السرية بنص واضح. احتفظ به بشكل خاص واحذفه بعد الاستيراد. الاستيراد لا يغيّر كلمات مرور الحسابات الموجودة.')+'</p></div>'+
 '<p class="help"><a href="https://github.com/Medical-DAD/REAL-GLENPA/blob/main/ADMIN_USERS_GUIDE_AR.md" target="_blank" rel="noopener noreferrer">'+t('Local password reset and permanent account deletion instructions','تعليمات تغيير كلمة المرور والحذف النهائي على جهاز الأدمن')+'</a></p>'+ 
 '<h3>'+t('Existing profiles','الحسابات المسجلة')+'</h3>'+
 '<div class="table-scroll"><table><thead><tr><th>'+t('Username','المستخدم')+'</th><th>'+t('Role','الصلاحية')+'</th><th>'+t('Clinic','العيادة')+'</th><th>'+t('Status','الحالة')+'</th><th>'+t('Action','الإجراء')+'</th></tr></thead><tbody>'+
 current.users.map(u=>'<tr><td>'+esc(u.username)+'</td><td>'+esc(u.role)+'</td><td>'+esc(u.clinicCode||'—')+'</td><td><span class="pill">'+(u.active?t('Active','نشط'):t('Disabled','معطّل'))+'</span></td><td>'+(!u.active||u.id!==current.user.uid?'<button class="link" data-toggleuser="'+esc(u.id)+'">'+(u.active?t('Disable','تعطيل'):t('Enable','تفعيل'))+'</button>':'—')+'</td></tr>').join('')+'</tbody></table></div>');
}
function settingsView(){
 if(!isAdmin())return '';
 return panel(t('Study configuration','إعدادات الدراسة'),
 '<form id="settingsForm"><div class="field-grid"><label>'+t('Study title','اسم الدراسة')+'<input name="studyTitle" value="'+esc(current.settings.studyTitle||'GLENPA REAL')+'" maxlength="90" required></label>'+
 '<label>'+t('Patient enrollment','تسجيل المرضى')+'<select name="enrollmentEnabled"><option value="false" '+(!current.settings.enrollmentEnabled?'selected':'')+'>'+t('Disabled','متوقف')+'</option><option value="true" '+(current.settings.enrollmentEnabled?'selected':'')+'>'+t('Enabled','مفعّل')+'</option></select></label></div>'+
 '<div class="actions"><button class="cta" type="submit">'+t('Save to Firestore','حفظ في Firestore')+'</button></div></form>'+
 '<p class="help">'+t('Turn on enrollment only after approving access controls, clinical governance and validation.','لا تفعّل تسجيل المرضى إلا بعد اعتماد الصلاحيات والحوكمة السريرية والتحقق من النظام.')+'</p>');
}
function qrView(){
 return panel(t('Website QR code','رمز QR للموقع'),
 '<p class="muted">'+t('Download a high-resolution card linking to the study portal.','نزّل بطاقة عالية الدقة تحتوي على رابط بوابة الدراسة.')+'</p>'+
 '<div id="qrContainer" class="hidden"></div><canvas id="qrCanvas" class="qr-card" width="960" height="1220"></canvas>'+
 '<p class="url">'+WEB_URL+'</p><button class="cta" id="downloadQR" disabled>'+t('Download Premium PNG','تنزيل صورة PNG فاخرة')+'</button>');
}
function accountView(){
 return panel(t('Account details','بيانات الحساب'),
 '<p>'+t('Username','اسم المستخدم')+': <b>'+esc(current.profile.username)+'</b></p>'+
 '<p>'+t('Clinic','العيادة')+': <b>'+esc(clinicKey())+'</b></p>'+
 '<div class="security-note">'+t('To change your own password, use the account recovery process approved for your organization.','لتغيير كلمة المرور اتبع إجراءات استعادة الحساب المعتمدة لدى مؤسستك.')+'</div>');
}
function contactView(){
 return panel(t('Medical Department · Clinic Support','القسم الطبي · دعم العيادات'),
 '<p>'+t('For study coordination, operational questions and technical assistance, please contact:','للتنسيق بخصوص الدراسة والاستفسارات التشغيلية والمساعدة التقنية، يرجى التواصل مع:')+'</p>'+
 '<p><b>Tareq M. Jrab</b><br>'+t('Regional Medical Science Liaison','مسؤول الارتباط العلمي الطبي الإقليمي')+'</p>'+
 '<p>'+t('Office','هاتف المكتب')+': <a href="tel:+96262222200">+962 6 2222200</a> '+t('extension','تحويلة')+' 779</p>'+
 '<p>'+t('Mobile','هاتف محمول')+': <a href="tel:+962770078453">+962 77 0078453</a></p>'+
 '<p><a href="https://www.dadgroup.com/" target="_blank" rel="noopener noreferrer">dadgroup.com</a></p>');
}
function renderQR(){
 const c=$('qrCanvas');if(!c)return;
 const button=$('downloadQR');if(button)button.disabled=true;
 const ctx=c.getContext('2d');const gradient=ctx.createLinearGradient(0,0,960,1220);gradient.addColorStop(0,'#132e46');gradient.addColorStop(.7,'#1a6f73');gradient.addColorStop(1,'#1f9c88');
 ctx.fillStyle=gradient;ctx.fillRect(0,0,960,1220);ctx.textAlign='center';
 ctx.fillStyle='#fff';ctx.font='bold 57px system-ui';ctx.fillText('GLENPA REAL',480,125);
 ctx.fillStyle='#c8ece8';ctx.font='25px system-ui';ctx.fillText('STUDY PORTAL · DIGITAL ACCESS',480,172);
 // A QR code is only displayed after the QR library has generated a scannable matrix.
 const square=720,x=120,y=242;
 ctx.fillStyle='#fff';ctx.fillRect(x,y,square,square);
 if(typeof window.QRCode==='undefined'){ctx.fillStyle='#193448';ctx.font='23px system-ui';ctx.fillText('QR code service unavailable',480,620);return}
 const holder=$('qrContainer');holder.replaceChildren();
 new window.QRCode(holder,{text:WEB_URL,width:640,height:640,colorDark:'#173e49',colorLight:'#ffffff',correctLevel:window.QRCode.CorrectLevel.H});
 setTimeout(()=>{
   const matrix=holder.querySelector('canvas')||holder.querySelector('img');
   if(!matrix)return;
   try{ctx.drawImage(matrix,160,282,640,640);if(button)button.disabled=false}catch(err){status(t('QR preview unavailable','معاينة QR غير متاحة'),'error')}
 },90);
 ctx.fillStyle='#fff';ctx.font='bold 42px system-ui';ctx.fillText('SCAN TO OPEN',480,1060);
 ctx.font='25px system-ui';ctx.fillText('medical-dad.github.io/REAL-GLENPA',480,1120);
}
async function loadRecords(){
 if(!isAuthorized())return;
 try{
  const cs=isAdmin()?await getDocs(collection(db,'clinics')):null;
  const own=isClinic()?await getDoc(doc(db,'clinics',clinicKey())):null;
  current.clinics=isAdmin()?cs.docs.map(d=>({id:d.id,...d.data()})):own?.exists()?[{id:own.id,...own.data()}]:[];
  current.clinics.sort((a,b)=>a.id.localeCompare(b.id));
  const ps=isAdmin()?await getDocs(collection(db,'patients')):await getDocs(query(collection(db,'patients'),where('clinicCode','==',clinicKey())));
  current.patients=ps.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>a.id.localeCompare(b.id));
  if(isClinic()){
   const directory=await getDocs(query(collection(db,'patientDirectory'),where('clinicCode','==',clinicKey())));
   current.patientNames=new Map(directory.docs.map(d=>[d.id,d.data()]));
  }else current.patientNames=new Map();
  try{const settings=await getDoc(doc(db,'siteSettings','main'));current.settings=settings.exists()?settings.data():{studyTitle:'GLENPA REAL',enrollmentEnabled:false}}catch(e){current.settings={studyTitle:'GLENPA REAL',enrollmentEnabled:false}}
  if(isAdmin()){
   const users=await getDocs(collection(db,'userProfiles'));current.users=users.docs.map(d=>({id:d.id,...d.data()}));
  }
  current.ready=true;status('');render();
 }catch(e){
  current.ready=false;status(errorMessage(e),'error');
  $('view').innerHTML=panel(t('Configuration required','الإعدادات المطلوبة'),
    '<p>'+t('The authenticated study backend has not been enabled for this account. No records are stored locally or substituted with fabricated content.','الخادم المعتمد للدراسة غير مفعّل لهذا الحساب. لا تُحفظ سجلات محليًا ولا تُستبدل ببيانات مصطنعة.')+'</p>');
 }
}
function eligiblePatientWrite(patient){
 return isClinic()&&patient.clinicCode===clinicKey();
}
function getVisitValues(form,phase){
 const f=new FormData(form),date=String(f.get('date')||'').trim();
 const hba1c=Number(f.get('hba1c')),fpg=Number(f.get('fpg'));
 const egfr=f.get('egfr')===''?null:Number(f.get('egfr'));
 const weight=f.get('weight')===''?null:Number(f.get('weight'));
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date+'T12:00:00Z')))throw Error(t('Enter a valid visit date.','أدخل تاريخ زيارة صحيحًا.'));
 if(!Number.isFinite(hba1c)||hba1c<3||hba1c>20||!Number.isFinite(fpg)||fpg<30||fpg>1000||
 (egfr!==null&&(!Number.isFinite(egfr)||egfr<0||egfr>200))||
 (weight!==null&&(!Number.isFinite(weight)||weight<1||weight>400)))throw Error(t('Check clinical measurements and units.','تحقق من القياسات السريرية ووحداتها.'));
 const dose=String(f.get('dose')||'');
 if(!['10/5 mg','25/5 mg'].includes(dose))throw Error('Invalid Glenpa strength');
 const value=k=>String(f.get(k)||'').trim().slice(0,400);
 return {phase,date,hba1c,fpg,egfr,weight,dose,
  adverseEvent:value('adverseEvent'),medicationChanges:value('medicationChanges'),
  diagnosis:value('diagnosis'),notes:value('notes'),
  updatedBy:current.user.uid,updatedAt:serverTimestamp()};
}
async function enrollPatient(form){
 if(!isClinic()||current.settings.enrollmentEnabled!==true)throw Error(t('Enrollment is disabled.','تسجيل المرضى متوقف حاليًا.'));
 const f=new FormData(form);
 const firstName=String(f.get('firstName')||'').trim();
 const lastName=String(f.get('lastName')||'').trim();
 const namePattern=/^[\p{L}][\p{L}\p{M}'-]{1,59}$/u;
 if(!namePattern.test(firstName)||!namePattern.test(lastName))throw Error(t('Enter the first and last name as two separate words (2–60 characters each).','أدخل الاسم الأول واسم العائلة، كل واحد كلمة مستقلة من حرفين إلى 60 حرفًا.'));
 // Patient study identifiers are opaque and never need to be memorized by clinicians.
 const random=new Uint8Array(12);crypto.getRandomValues(random);
 const id='P-'+Array.from(random,b=>b.toString(16).padStart(2,'0')).join('').toUpperCase();
 const age=Number(f.get('age')),diabetesYears=Number(f.get('diabetesYears'));
 if(!Number.isInteger(age)||age<18||age>110||!Number.isFinite(diabetesYears)||diabetesYears<0||diabetesYears>100)throw Error(t('Invalid demographic or diabetes values.','قيم العمر أو مدة السكري غير صحيحة.'));
 const medical=readMedicalFields(form);
 if(medical.history.length>1500||medical.otherDiagnoses.length>500||medical.medications.length>1600)throw Error(t('Clinical text exceeds permitted limits.','النص السريري أطول من الحد المسموح.'));
 const clinicCode=clinicKey(),patientId=clinicCode+'_'+id;
 if(current.patients.some(p=>p.id===patientId))throw Error(t('Study ID already exists in this clinic.','رمز هذا المريض موجود مسبقًا في العيادة.'));
 const baseline=getVisitValues(form,'baseline');
 const payload={clinicCode,patientCode:id,age,sex:String(f.get('sex')),diabetesYears,...medical,
  createdBy:current.user.uid,createdAt:serverTimestamp()};
 // Atomic write: both the patient profile and baseline must succeed together.
 const batch=writeBatch(db);
 batch.set(doc(db,'patients',patientId),payload);
 batch.set(doc(db,'patientDirectory',patientId),{
  clinicCode,firstName,lastName,createdBy:current.user.uid,createdAt:serverTimestamp()
 });
 batch.set(doc(db,'patients',patientId,'visits','baseline'),baseline);
 await batch.commit();
 current.patient=patientId;current.view='patients';
 await loadRecords();
 const patient=current.patients.find(p=>p.id===patientId);
 if(patient){render();await showVisits(patient)}
 status(t('Patient and Baseline visit saved together.','تم حفظ المريض وزيارة Baseline معًا.'));
}
async function updateMedicalProfile(form,patient){
 if(!eligiblePatientWrite(patient))throw Error(t('Only the assigned clinic may edit medical history.','العيادة المسؤولة فقط يمكنها تعديل التاريخ المرضي.'));
 const medical=readMedicalFields(form);
 if(medical.history.length>1500||medical.otherDiagnoses.length>500||medical.medications.length>1600)throw Error(t('Clinical text exceeds permitted limits.','النص السريري أطول من الحد المسموح.'));
 await updateDoc(doc(db,'patients',patient.id),{...medical,updatedBy:current.user.uid,updatedAt:serverTimestamp()});
 current.patient=patient.id;current.view='patients';
 await loadRecords();
 status(t('Medical history and medicines saved. Previous visits remain unchanged.','تم حفظ التاريخ المرضي والأدوية دون تغيير الزيارات السابقة.'));
}

async function saveVisit(form,patient){
 if(!eligiblePatientWrite(patient))throw Error('Visit writing not authorized');
 const phase=String(new FormData(form).get('phase')||'');
 if(!VISIT_PHASES.includes(phase))throw Error('Invalid phase');
 const prior=phase==='month3'?'baseline':phase==='month6'?'month3':null;
 const existing=await getDocs(collection(db,'patients',patient.id,'visits'));
 if(existing.docs.some(v=>v.id===phase))throw Error(t('This visit has already been saved.','هذه الزيارة مسجّلة مسبقًا.'));
 const previous=prior?existing.docs.find(v=>v.id===prior):null;
 if(prior&&!previous)throw Error(t('Save the previous visit first.','يجب حفظ الزيارة السابقة أولًا.'));
 const visit=getVisitValues(form,phase);
 if(previous){
  const prevDate=new Date(previous.data().date+'T12:00:00Z');
  if(Number.isNaN(prevDate.valueOf()))throw Error('Invalid previous visit date');
  prevDate.setUTCMonth(prevDate.getUTCMonth()+3);
  if(visit.date<prevDate.toISOString().slice(0,10))throw Error(t('Follow-up is due at least 3 calendar months after the previous visit.','تُسجل المتابعة بعد 3 أشهر تقويمية على الأقل من الزيارة السابقة.'));
 }
 await setDoc(doc(db,'patients',patient.id,'visits',phase),visit);
 render();await showVisits(patient);
 status(t('Visit saved in the patient history.','تم حفظ الزيارة في سجل المريض.'));
}
async function showVisits(patient){
 const container=$('visitsArea');
 if(!container||current.patient!==patient.id)return;
 try{
  const result=await getDocs(collection(db,'patients',patient.id,'visits'));
  if(current.patient!==patient.id||current.view!=='patients'||!$('visitsArea'))return;
  const records=new Map(result.docs.map(d=>[d.id,d.data()]));
  current.visitDocs=records;
  const n=VISIT_PHASES.filter(phase=>records.has(phase)).length;
  if($('patientVisitCount'))$('patientVisitCount').textContent=n+' / 3';
  const canWrite=isClinic()&&patient.clinicCode===clinicKey();
  $('visitsArea').innerHTML=VISIT_PHASES.map((phase,index)=>{
   const v=records.get(phase),prior=index===0||records.has(VISIT_PHASES[index-1]);
   const step='<span class="visit-step">'+(index+1)+'</span>';
   if(!v)return '<article class="visit-card pending"><div class="visit-title-line">'+step+'<div><strong>'+visitLabel(phase)+'</strong><div class="muted">'+t('Not recorded yet','لم تُسجّل بعد')+'</div></div>'+
    '<span class="visit-status">'+t('Pending','بانتظار التسجيل')+'</span></div>'+
    (canWrite&&prior?'<button class="cta" type="button" data-addvisit="'+phase+'">'+t('Record this visit','تسجيل هذه الزيارة')+'</button>':
     canWrite?'<p class="help">'+t('Record the preceding visit first.','سجّل الزيارة السابقة أولًا.')+'</p>':'')+
    '</article>';
   return '<details class="visit-card completed" open><summary class="visit-title-line">'+step+
   '<div><strong>'+visitLabel(phase)+'</strong><div class="muted">'+showValue(v.date)+'</div></div>'+
   '<span class="visit-status">'+t('Recorded','مسجّلة')+'</span></summary>'+
   '<div class="visit-content"><div class="clinical-kv">'+
    clinicalFact('HbA1c',v.hba1c,'%')+
    clinicalFact(t('Fasting glucose','السكر الصائم'),v.fpg,' mg/dL')+
    clinicalFact('eGFR',v.egfr,' mL/min/1.73m²')+
    clinicalFact(t('Weight','الوزن'),v.weight,' kg')+
    clinicalFact(t('Glenpa strength','تركيز جلينبا'),v.dose)+
   '</div><div class="visit-notes">'+
   '<div><b>'+t('Adverse events','الأحداث الضارة')+'</b><p>'+showValue(v.adverseEvent)+'</p></div>'+
   '<div><b>'+t('Concomitant medication changes','التغييرات في الأدوية المصاحبة')+'</b><p>'+showValue(v.medicationChanges)+'</p></div>'+
   '<div><b>'+t('New diagnoses / comorbidities','تشخيصات أو أمراض جديدة')+'</b><p>'+showValue(v.diagnosis)+'</p></div>'+
   '<div><b>'+t('Clinical visit notes','ملاحظات الزيارة')+'</b><p>'+showValue(v.notes)+'</p></div>'+
   '</div></div></details>';
  }).join('');
 }catch(err){
  const target=$('visitsArea');
  if(target&&current.patient===patient.id)target.textContent=errorMessage(err);
 }
}
function openEnrollForm(){
 const form='<form id="enrollForm" class="patient-wizard">'+
 '<div class="wizard-progress"><div class="wizard-progress-head"><span>'+t('New patient · Guided registration','مريض جديد · تسجيل بخطوات سهلة')+'</span><strong id="wizardProgressText">1 / 3</strong></div>'+
 '<div class="wizard-track"><span id="wizardProgressFill" style="width:33.33%"></span></div></div>'+
 '<section class="wizard-step" data-wizard-step="0">'+
 '<div class="wizard-kicker">'+t('STEP 01 · PATIENT','الخطوة 01 · المريض')+'</div>'+
 '<h2>'+t('What is the patient’s name?','ما اسم المريض؟')+'</h2>'+
 '<p class="muted">'+t('First and last name only. The secure clinic directory stores the name separately from the study records.','الاسم الأول واسم العائلة فقط. يُحفظ الاسم بدليل خاص بالعيادة منفصل عن سجلات الدراسة.')+'</p>'+
 '<div class="field-grid"><label>'+t('First name','الاسم الأول')+'<input name="firstName" maxlength="60" autocomplete="off" required placeholder="'+t('First name','الاسم الأول')+'"></label>'+
 '<label>'+t('Last name','اسم العائلة')+'<input name="lastName" maxlength="60" autocomplete="off" required placeholder="'+t('Family name','اسم العائلة')+'"></label>'+
 '<label>'+t('Age','العمر')+'<input name="age" type="number" min="18" max="110" required></label>'+
 '<label>'+t('Sex','الجنس')+'<select name="sex"><option value="Male">'+t('Male','ذكر')+'</option><option value="Female">'+t('Female','أنثى')+'</option></select></label>'+
 '<label>'+t('Years since type 2 diabetes diagnosis','سنوات الإصابة بالسكري من النوع الثاني')+
 '<input name="diabetesYears" type="number" min="0" max="100" step="1" required></label></div></section>'+
 '<section class="wizard-step" data-wizard-step="1" hidden>'+
 '<div class="wizard-kicker">'+t('STEP 02 · HISTORY','الخطوة 02 · التاريخ المرضي')+'</div>'+
 '<h2>'+t('Diabetes history and medication','تاريخ السكري والأدوية')+'</h2>'+
 '<p class="muted">'+t('Select comorbidities and record baseline medications, doses and frequency.','اختر الأمراض المصاحبة وسجّل الأدوية الأساسية وجرعاتها وتكرارها.')+'</p>'+
 medicalFields()+'</section>'+
 '<section class="wizard-step" data-wizard-step="2" hidden>'+
 '<div class="wizard-kicker">'+t('STEP 03 · BASELINE','الخطوة 03 · الزيارة الأساسية')+'</div>'+
 '<h2>'+t('Complete the first visit','أكمل تفاصيل الزيارة الأولى')+'</h2>'+
 '<p class="muted">'+t('Baseline is saved together with the new patient in one operation.','تُحفظ زيارة Baseline مع المريض الجديد في عملية واحدة.')+'</p>'+
 '<div class="field-grid"><label>'+t('Baseline visit date','تاريخ الزيارة الأساسية')+'<input type="date" name="date" required></label>'+
 '<label>HbA1c (%)<input type="number" min="3" max="20" step="0.1" name="hba1c" required></label>'+
 '<label>'+t('Fasting glucose (mg/dL)','السكر الصائم (ملغم/دل)')+'<input type="number" min="30" max="1000" step="1" name="fpg" required></label>'+
 '<label>eGFR (mL/min/1.73m²)<input type="number" min="0" max="200" step="0.1" name="egfr"></label>'+
 '<label>'+t('Weight (kg)','الوزن (كغم)')+'<input type="number" min="1" max="400" step="0.1" name="weight"></label>'+
 '<label>'+t('Glenpa strength','تركيز جلينبا')+'<select name="dose"><option value="10/5 mg">10/5 mg</option><option value="25/5 mg">25/5 mg</option></select></label>'+
 '<label class="span2">'+t('Adverse events','الأحداث الضارة')+'<textarea name="adverseEvent" maxlength="400" rows="2"></textarea></label>'+
 '<label class="span2">'+t('Baseline medication changes','تغييرات الأدوية في الزيارة الأساسية')+'<textarea name="medicationChanges" maxlength="400" rows="2"></textarea></label>'+
 '<label class="span2">'+t('New diagnoses','التشخيصات الجديدة')+'<textarea name="diagnosis" maxlength="400" rows="2"></textarea></label>'+
 '<label class="span2">'+t('Clinical notes','الملاحظات السريرية')+'<textarea name="notes" maxlength="400" rows="2"></textarea></label></div></section>'+
 '<div class="wizard-actions"><button class="secondary" type="button" id="wizardBack" hidden>'+t('← Previous','← السابق')+'</button>'+
 '<button class="cta" type="button" id="wizardNext">'+t('Continue →','متابعة ←')+'</button>'+
 '<button class="cta" type="submit" id="wizardSave" hidden>'+t('Save patient + Baseline','حفظ المريض والزيارة الأساسية')+'</button>'+
 '<button class="secondary" type="button" data-nav="patients">'+t('Cancel','إلغاء')+'</button></div>'+
 '<p class="wizard-hint">'+t('Enter to continue. No patient data is saved until the final confirmation.','اضغط Enter للمتابعة. لا تُحفظ أي بيانات قبل التأكيد النهائي.')+'</p></form>';
 $('view').innerHTML=panel(t('Patient registration','تسجيل مريض'),form);
 const first=$('view').querySelector('[name="firstName"]');first?.focus();
}
function wizardStep(form){
 return Number(form.dataset.wizardStep||0);
}
function setWizardStep(form,index){
 const step=Math.max(0,Math.min(2,index));
 form.dataset.wizardStep=String(step);
 form.querySelectorAll('[data-wizard-step]').forEach(section=>{section.hidden=Number(section.dataset.wizardStep)!==step;});
 const next=form.querySelector('#wizardNext'),back=form.querySelector('#wizardBack'),save=form.querySelector('#wizardSave');
 if(next)next.hidden=step===2;
 if(back)back.hidden=step===0;
 if(save)save.hidden=step!==2;
 const text=form.querySelector('#wizardProgressText'),fill=form.querySelector('#wizardProgressFill');
 if(text)text.textContent=(step+1)+' / 3';
 if(fill)fill.style.width=((step+1)/3*100)+'%';
 form.querySelector('[data-wizard-step="'+step+'"] input:not([type="hidden"]), [data-wizard-step="'+step+'"] textarea')?.focus();
}
function nextWizardStep(form){
 const currentStep=wizardStep(form);
 const section=form.querySelector('[data-wizard-step="'+currentStep+'"]');
 for(const input of section.querySelectorAll('input,textarea,select')){
  if(!input.checkValidity()){input.reportValidity();return}
 }
 if(currentStep===0){
  const first=String(new FormData(form).get('firstName')||'').trim(),last=String(new FormData(form).get('lastName')||'').trim();
  const correct=/^[\p{L}][\p{L}\p{M}'-]{1,59}$/u;
  if(!correct.test(first)||!correct.test(last)){status(t('Enter exactly two name parts, without additional spaces.','أدخل الاسم الأول واسم العائلة دون فراغات داخل كل جزء.'),'error');return}
 }
 if(currentStep<2)setWizardStep(form,currentStep+1);
}
function openPatientNameForm(patient){
 if(!eligiblePatientWrite(patient))return;
 const existing=current.patientNames.get(patient.id)||{};
 $('view').innerHTML=panel(t('Patient name · clinic directory','اسم المريض · دليل العيادة'),
 '<p class="muted">'+t('Names are visible only to staff of the assigned clinic, not the study oversight dashboard or coded CSV.','الاسم متاح لعيادة المريض فقط، ولا يظهر في لوحة الإشراف أو تصدير سجلات الدراسة.')+'</p>'+
 '<form id="patientNameForm"><input type="hidden" name="patientId" value="'+esc(patient.id)+'">'+
 '<div class="field-grid"><label>'+t('First name','الاسم الأول')+'<input name="firstName" maxlength="60" value="'+esc(existing.firstName||'')+'" required></label>'+
 '<label>'+t('Last name','اسم العائلة')+'<input name="lastName" maxlength="60" value="'+esc(existing.lastName||'')+'" required></label></div>'+
 '<div class="actions"><button class="cta" type="submit">'+t('Save patient name','حفظ اسم المريض')+'</button>'+
 '<button class="secondary" type="button" data-patient="'+esc(patient.id)+'">'+t('Cancel','إلغاء')+'</button></div></form>');
}
async function savePatientName(form){
 if(!isClinic())throw Error('Clinic access required');
 const data=new FormData(form),patientId=String(data.get('patientId')||'');
 const patient=current.patients.find(p=>p.id===patientId);
 if(!patient||patient.clinicCode!==clinicKey())throw Error('Patient access denied');
 const firstName=String(data.get('firstName')||'').trim(),lastName=String(data.get('lastName')||'').trim();
 const pat=/^[\p{L}][\p{L}\p{M}'-]{1,59}$/u;
 if(!pat.test(firstName)||!pat.test(lastName))throw Error(t('Name must be two separate parts.','يجب أن يكون الاسم من مقطعين: اسم أول واسم عائلة.'));
 const reference=doc(db,'patientDirectory',patient.id),existing=current.patientNames.get(patient.id);
 if(existing){
  await updateDoc(reference,{firstName,lastName,updatedBy:current.user.uid,updatedAt:serverTimestamp()});
 }else{
  await setDoc(reference,{clinicCode:clinicKey(),firstName,lastName,createdBy:current.user.uid,createdAt:serverTimestamp()});
 }
 current.patient=patient.id;await loadRecords();
 status(t('Patient name updated in the private clinic directory.','تم حفظ اسم المريض في دليل العيادة الخاص.'));
}
function openMedicalProfileForm(patient){
 if(!eligiblePatientWrite(patient))return;
 $('view').innerHTML=panel(t('Edit medical history & baseline medicines','تعديل التاريخ المرضي والأدوية الأساسية'),
 '<div class="actions"><button class="secondary" type="button" data-patient="'+esc(patient.id)+'">'+t('← Back to patient history','← العودة لسجل المريض')+'</button></div>'+
 '<form id="medicalProfileForm"><input type="hidden" name="patientId" value="'+esc(patient.id)+'">'+
 medicalFields(patient)+
 '<div class="actions"><button type="submit" class="cta">'+t('Save medical profile','حفظ الملف الطبي')+'</button></div></form>');
}
function openVisitForm(patient,phase){
 if(!eligiblePatientWrite(patient)||!VISIT_PHASES.includes(phase))return;
 const previous=phase==='month3'?'baseline':phase==='month6'?'month3':null;
 if(current.visitDocs?.has(phase))return status(t('This visit is already recorded.','هذه الزيارة مسجّلة مسبقًا.'),'error');
 if(previous&&!current.visitDocs?.has(previous))return status(t('Complete the previous scheduled visit first.','أكمل الزيارة السابقة أولًا.'),'error');
 const prior=previous?current.visitDocs.get(previous):null;
 const context='<div class="security-note">'+t('The patient’s recorded history and medication profile remain in the chart. Enter only results and changes relevant to this visit.','تُحفظ بيانات المريض والأدوية الأساسية في الملف. سجّل نتائج وتغييرات هذه الزيارة فقط.')+
 (prior?'<p>'+t('Previous visit: ','الزيارة السابقة: ')+visitLabel(previous)+' · '+showValue(prior.date)+' · HbA1c '+showValue(prior.hba1c)+'%</p>':'')+
 '</div>';
 const fields='<form id="visitForm"><input type="hidden" name="phase" value="'+phase+'">'+
 '<div class="field-grid"><label>'+t('Visit date','تاريخ الزيارة')+'<input type="date" name="date" required></label>'+
 '<label>HbA1c (%)<input type="number" min="3" max="20" step=".1" name="hba1c" required></label>'+
 '<label>'+t('Fasting glucose (mg/dL)','سكر صائم (ملغم/دل)')+'<input type="number" min="30" max="1000" step="1" name="fpg" required></label>'+
 '<label>eGFR (mL/min/1.73m²)<input type="number" min="0" max="200" step=".1" name="egfr"></label>'+
 '<label>'+t('Weight (kg)','الوزن (كغم)')+'<input type="number" min="1" max="400" step=".1" name="weight"></label>'+
 '<label>'+t('Glenpa strength','تركيز جلينبا')+'<select name="dose"><option value="10/5 mg">10/5 mg</option><option value="25/5 mg">25/5 mg</option></select></label>'+
 '<label class="span2">'+t('Adverse events (coded, no identifiers)','الأحداث الضارة (بدون معلومات تعريفية)')+'<textarea name="adverseEvent" maxlength="400" rows="2"></textarea></label>'+
 '<label class="span2">'+t('New, changed or stopped medicines','أدوية جديدة أو معدلة أو موقوفة')+'<textarea name="medicationChanges" maxlength="400" rows="2"></textarea></label>'+
 '<label class="span2">'+t('New diagnoses / comorbidities','التشخيصات أو الأمراض المصاحبة الجديدة')+'<textarea name="diagnosis" maxlength="400" rows="2"></textarea></label>'+
 '<label class="span2">'+t('Clinical notes','الملاحظات السريرية')+'<textarea name="notes" maxlength="400" rows="2"></textarea></label></div>'+
 '<div class="actions"><button class="cta" type="submit">'+t('Save '+visitLabel(phase),'حفظ '+visitLabel(phase))+'</button>'+
 '<button class="secondary" type="button" data-patient="'+esc(patient.id)+'">'+t('Cancel','إلغاء')+'</button></div></form>';
 $('view').innerHTML=panel(visitLabel(phase)+' · '+esc(patient.patientCode),context+fields);
}

async function createClinicAccount({username,clinicCode,password}){
 if(!isAdmin())throw Error('Not authorized');
 const u=parseCode(username),clinic=String(clinicCode||''),pin=String(password||'');
 const email=u+'@'+INTERNAL_CLINIC_DOMAIN;
 if(!/^[a-z0-9._-]{3,40}$/.test(u)||u==='msl.admin'||!validClinic(clinic)||
 !current.clinics.some(c=>c.id===clinic)||!/^[0-9]{6,32}$/.test(pin))throw Error(t('Invalid clinic account. Use 6–32 digits for PIN.','بيانات الحساب غير صحيحة. استخدم 6 إلى 32 رقمًا للرمز السري.'));
 if(current.users.some(user=>parseCode(user.username)===u))throw Error(t('Username already exists.','اسم المستخدم موجود مسبقًا.'));
 const existing=await getDoc(doc(db,'loginHandles',u));
 if(existing.exists())throw Error(t('Username already exists.','اسم المستخدم موجود مسبقًا.'));
 const second=initializeApp(firebaseConfig,'provision-'+crypto.randomUUID()),secondAuth=getAuth(second);
 let authUser=null;
 try{
  const result=await createUserWithEmailAndPassword(secondAuth,email,pin);
  authUser=result.user;
  const batch=writeBatch(db);
  batch.set(doc(db,'userProfiles',authUser.uid),{
   username:u,role:'clinic',clinicCode:clinic,active:true,createdBy:current.user.uid,createdAt:serverTimestamp()
  });
  batch.set(doc(db,'loginHandles',u),{email,userUid:authUser.uid});
  await batch.commit();
  await signOut(secondAuth);
  return authUser.uid;
 }catch(error){
  if(authUser)try{await deleteUser(authUser)}catch(cleanup){}
  throw error;
 }finally{await deleteApp(second)}
}
async function provisionUser(form){
 const values=new FormData(form);
 await createClinicAccount({username:values.get('username'),clinicCode:values.get('clinicCode'),password:values.get('password')});
 form.reset();await loadRecords();
 status(t('Clinic account created. Share credentials privately.','تم إنشاء حساب العيادة. سلّم البيانات بشكل خاص.'));
}
const clinicWorkbookColumns=['clinicCode','doctorName','specialty','area','username','password'];
function verifyClinicWorkbook(rows){
 if(!rows.length||rows.length>26)throw Error(t('Enter 1–26 clinic rows.','يجب إدخال 1 إلى 26 عيادة.'));
 const codes=new Set(),users=new Set();
 for(let i=0;i<rows.length;i++){
  const row=rows[i],clinic=String(row.clinicCode||'').trim().toLowerCase(),u=parseCode(row.username),pin=String(row.password||'');
  const doctor=String(row.doctorName||'').trim(),specialty=String(row.specialty||'').trim(),area=String(row.area||'').trim();
  if(!validClinic(clinic)||codes.has(clinic))throw Error(t('Duplicate or invalid clinic code in row ','رمز عيادة مكرر أو غير صحيح في السطر ')+(i+2));
  if(!/^[a-z0-9._-]{3,40}$/.test(u)||u==='msl.admin'||users.has(u))throw Error(t('Invalid or duplicate username in row ','اسم مستخدم غير صحيح أو مكرر في السطر ')+(i+2));
  if(!/^[0-9]{6,32}$/.test(pin))throw Error(t('Numeric PIN must have 6–32 digits, row ','الرقم السري يجب أن يتكوّن من 6 إلى 32 رقمًا، السطر ')+(i+2));
  if(!doctor||doctor.length>100||!specialty||specialty.length>80||!area||area.length>80)throw Error(t('Complete doctor, specialty, and area in row ','أكمل اسم الطبيب والتخصص والمنطقة في السطر ')+(i+2));
  codes.add(clinic);users.add(u);
 }
}
async function prepareClinicWorkbook(file){
 if(!isAdmin())throw Error('Not authorized');
 current.bulkRows=null;
 const rows=await readClinicTemplate(file);
 verifyClinicWorkbook(rows);
 current.bulkRows=rows;
 const box=$('clinicWorkbookStatus'),button=$('importClinicWorkbook');
 if(box)box.textContent=t('Ready to create ','جاهز لإنشاء ')+rows.length+t(' clinic account(s). Review the file and click Import. Existing usernames will be skipped.',' حساب عيادة. راجع الملف ثم اضغط استيراد. سيتم تخطي أسماء المستخدمين الموجودة.');
 if(button)button.disabled=false;
}
async function importClinicWorkbook(){
 if(!isAdmin()||!current.bulkRows?.length)throw Error('No Excel file selected');
 const rows=current.bulkRows;current.bulkRows=null;
 let created=0,skipped=0;
 const issues=[],progress=$('clinicWorkbookStatus');
 const log=(text)=>{if(progress)progress.textContent=text};
 try{
  for(const [index,row]of rows.entries()){
   const clinicCode=String(row.clinicCode).trim().toLowerCase(),username=parseCode(row.username);
   log(t('Processing row ','معالجة السطر ')+(index+1)+' / '+rows.length+' · '+clinicCode);
   if(current.users.some(u=>parseCode(u.username)===username)){skipped++;continue}
   try{
    const details={doctorName:String(row.doctorName).trim(),specialty:String(row.specialty).trim(),area:String(row.area).trim()};
    const clinicDoc=doc(db,'clinics',clinicCode);
    const found=await getDoc(clinicDoc);
    if(found.exists())await updateDoc(clinicDoc,details);
    else await setDoc(clinicDoc,details);
    if(!current.clinics.some(c=>c.id===clinicCode))current.clinics.push({id:clinicCode,...details});
    await createClinicAccount({username,clinicCode,password:String(row.password)});
    current.users.push({username,id:'created-'+index,role:'clinic',clinicCode,active:true});
    created++;
   }catch(err){
    issues.push(clinicCode+' ('+username+'): '+String(err.message||'Failed').slice(0,130));
   }
  }
 }finally{
  for(const row of rows)row.password=''; // Clear PINs from in-memory array immediately.
 }
 await loadRecords();
 const summary=t('Created: ','تم الإنشاء: ')+created+t(' · Skipped: ',' · تم التخطي: ')+skipped+t(' · Failed: ',' · تعذّر: ')+issues.length;
 status(summary+(issues.length?' · '+issues.join(' | '):''),issues.length?'error':'success');
}
async function updateSettings(form){
 if(!isAdmin())throw Error('Not authorized');
 const f=new FormData(form);const data={studyTitle:String(f.get('studyTitle')||'').slice(0,90),enrollmentEnabled:f.get('enrollmentEnabled')==='true',updatedBy:current.user.uid,updatedAt:serverTimestamp()};
 await setDoc(doc(db,'siteSettings','main'),data,{merge:true});
 await loadRecords();status(t('Study settings saved.','تم حفظ إعدادات الدراسة.'));
}
async function exportCodedCSV(){
 const cols=['clinicCode','patientCode','age','sex','diabetesYears','medicalHistory','comorbidities','otherComorbidities','baselineMedications',
   'visit','visitDate','hba1c','fpg','egfr','weight','dose','adverseEvent','medicationChanges','newDiagnoses','clinicalNotes'];
 const rows=[cols];
 for(const p of current.patients){
  const visits=await getDocs(collection(db,'patients',p.id,'visits'));
  const shared=[p.clinicCode,p.patientCode,p.age,p.sex,p.diabetesYears,p.history,
   Array.isArray(p.diagnoses)?p.diagnoses.join('; '):'',p.otherDiagnoses,medicationLines(p).replace(/\r?\n/g,'; ')];
  if(visits.empty){rows.push([...shared,...Array(cols.length-shared.length).fill('')]);continue}
  for(const visit of visits.docs){
   const d=visit.data();
   rows.push([...shared,visit.id,d.date,d.hba1c,d.fpg,d.egfr,d.weight,d.dose,
    d.adverseEvent,d.medicationChanges,d.diagnosis,d.notes]);
  }
 }
 const csv=rows.map(row=>row.map(escapeCsv).join(',')).join('\r\n');
 const url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));
 const link=document.createElement('a');link.href=url;link.download='GLENPA-REAL-Complete-Patient-History.csv';link.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function downloadQR(){
 const canvas=$('qrCanvas');if(!canvas||typeof window.QRCode==='undefined')return status(t('QR generator is unavailable.','مولّد QR غير متاح.'),'error');
 const a=document.createElement('a');a.href=canvas.toDataURL('image/png');a.download='GLENPA-REAL-QR.png';a.click();
}
async function safeAction(job){
 if(current.busy)return;current.busy=true;
 try{await job()}catch(e){status(errorMessage(e),'error')}finally{current.busy=false}
}
async function handleClick(e){
 const nav=e.target.closest('[data-nav]');if(nav){current.view=nav.dataset.nav;current.patient=null;current.visitDocs=new Map();render();return}
 const patientBtn=e.target.closest('[data-patient]');if(patientBtn){current.patient=patientBtn.dataset.patient;current.visitDocs=new Map();current.view='patients';render();return}
 const editBtn=e.target.closest('[data-editclinic]');if(editBtn){
  if(!isAdmin())return;const c=current.clinics.find(x=>x.id===editBtn.dataset.editclinic);if(!c)return;
  $('view').innerHTML=panel(t('Edit clinic','تعديل العيادة'),'<form id="clinicForm"><input type="hidden" name="code" value="'+esc(c.id)+'"><div class="field-grid"><label>'+t('Doctor','الطبيب')+'<input name="doctorName" value="'+esc(c.doctorName||'')+'" required></label><label>'+t('Specialty','الاختصاص')+'<input name="specialty" value="'+esc(c.specialty||'')+'" required></label><label>'+t('Area','المنطقة')+'<input name="area" value="'+esc(c.area||'')+'" required></label></div><button class="cta" type="submit">'+t('Save changes','حفظ التعديلات')+'</button></form>');return}
 const toggle=e.target.closest('[data-toggleuser]');if(toggle){if(!isAdmin())return;const u=current.users.find(x=>x.id===toggle.dataset.toggleuser);if(!u||u.id===current.user.uid)return;await safeAction(async()=>{await updateDoc(doc(db,'userProfiles',u.id),{active:!u.active});await loadRecords()});return}
 if(e.target.id==='downloadClinicXlsx'){if(isAdmin())downloadClinicTemplate();return}
 if(e.target.id==='importClinicWorkbook'){await safeAction(importClinicWorkbook);return}
 if(e.target.id==='newPatientBtn')openEnrollForm();
 if(e.target.id==='editMedicalProfile'){const p=current.patients.find(x=>x.id===current.patient);if(p)openMedicalProfileForm(p)}
 if(e.target.id==='editPatientName'){const p=current.patients.find(x=>x.id===current.patient);if(p)openPatientNameForm(p)}
 if(e.target.id==='wizardNext'){const form=$('view').querySelector('#enrollForm');if(form)nextWizardStep(form);return}
 if(e.target.id==='wizardBack'){const form=$('view').querySelector('#enrollForm');if(form)setWizardStep(form,wizardStep(form)-1);return}
 const nextVisit=e.target.closest('[data-addvisit]');
 if(nextVisit){const p=current.patients.find(x=>x.id===current.patient);if(p)openVisitForm(p,nextVisit.dataset.addvisit)}
 if(e.target.id==='backPatients'){current.patient=null;current.visitDocs=new Map();render()}
 if(e.target.id==='exportCsvBtn')await safeAction(exportCodedCSV);
 if(e.target.id==='downloadQR')downloadQR();
}
// Navigation buttons live OUTSIDE #view. Without this listener every top tab is inert.
$('nav').addEventListener('click',handleClick);
$('view').addEventListener('click',handleClick);
$('view').addEventListener('change',e=>{
 if(e.target.id!=='clinicWorkbookFile'||!isAdmin())return;
 const file=e.target.files?.[0];if(!file)return;
 e.target.value='';
 safeAction(async()=>await prepareClinicWorkbook(file));
});
$('view').addEventListener('input',e=>{
 if(e.target.id!=='patientSearch')return;
 const term=normalizeSearch(e.target.value);
 let visible=0;
 $('view').querySelectorAll('.patient-list-row').forEach(row=>{
  const match=normalizeSearch(row.dataset.patientSearch).includes(term);
  row.hidden=!match;if(match)visible++;
 });
 const empty=$('patientSearchEmpty');if(empty)empty.classList.toggle('hidden',visible>0);
});
$('view').addEventListener('submit',e=>{
 e.preventDefault();const form=e.target;
 safeAction(async()=>{
  if(form.id==='enrollForm'){if(wizardStep(form)<2){nextWizardStep(form);return}await enrollPatient(form);}
  else if(form.id==='patientNameForm')await savePatientName(form);
  else if(form.id==='visitForm'){const p=current.patients.find(x=>x.id===current.patient);if(p)await saveVisit(form,p)}
  else if(form.id==='medicalProfileForm'){const p=current.patients.find(x=>x.id===current.patient);if(p)await updateMedicalProfile(form,p)}
  else if(form.id==='createUserForm')await provisionUser(form);
  else if(form.id==='settingsForm')await updateSettings(form);
  else if(form.id==='clinicForm'){
   if(!isAdmin())throw Error('Unauthorized');
   const f=new FormData(form),code=String(f.get('code'));
   if(!current.clinics.some(x=>x.id===code))throw Error('Invalid clinic');
   await updateDoc(doc(db,'clinics',code),{doctorName:String(f.get('doctorName')).slice(0,100),specialty:String(f.get('specialty')).slice(0,80),area:String(f.get('area')).slice(0,80)});
   current.view='clinics';await loadRecords();
  }
 });
});
$('theme').onclick=themeNext;
$('language').onclick=()=>{current.language=current.language==='en'?'ar':'en';updateLanguage()};
$('signout').onclick=()=>safeAction(async()=>{await signOut(auth);current.profile=null;current.user=null;current.patient=null;current.patients=[];current.users=[];current.clinics=[];status('');render()});
$('loginForm').onsubmit=e=>{
 e.preventDefault();
 safeAction(async()=>{setBusy('loginButton',true);try{
  await login($('username').value,$('password').value,false);
  $('password').value='';$('authMessage').textContent='';
 }catch(err){$('authMessage').textContent=errorMessage(err)}finally{setBusy('loginButton',false)}});
};
const overlay=$('adminOverlay');let taps=0,startTaps=0;
function openAdmin(){overlay.classList.remove('hidden');overlay.setAttribute('aria-hidden','false');$('adminMessage').textContent='';$('adminPassword').focus()}
function closeAdmin(){overlay.classList.add('hidden');overlay.setAttribute('aria-hidden','true');$('adminPassword').value=''}
$('brand').onclick=()=>{const now=Date.now();if(now-startTaps>4500){taps=0;startTaps=now}if(++taps===5){taps=0;openAdmin()}};
$('closeAdmin').onclick=closeAdmin;overlay.onclick=e=>{if(e.target===overlay)closeAdmin()};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!overlay.classList.contains('hidden'))closeAdmin()});
$('adminLoginForm').onsubmit=e=>{
 e.preventDefault();
 safeAction(async()=>{setBusy('adminLoginButton',true);try{
  await login($('adminUsername').value,$('adminPassword').value,true);
  $('adminMessage').textContent='';closeAdmin();
 }catch(err){$('adminMessage').textContent=errorMessage(err)}finally{setBusy('adminLoginButton',false)}});
};
onAuthStateChanged(auth,async user=>{
 current.user=user;current.profile=null;current.patient=null;current.patients=[];current.clinics=[];current.users=[];current.ready=false;
 if(!user){render();return}
 try{
  const profile=await getDoc(doc(db,'userProfiles',user.uid));
  if(!profile.exists())throw Error('No study access profile has been provisioned for this account.');
  const p=profile.data();
  if(p.active!==true||!['clinic','study_oversight'].includes(p.role)||p.role==='clinic'&&!validClinic(p.clinicCode)||p.role==='study_oversight'&&p.username!=='msl.admin')throw Error('Inactive or invalid study access profile.');
  current.profile=p;current.view='overview';render();await loadRecords();
 }catch(e){await signOut(auth);status(errorMessage(e),'error')}
});
settingsTheme();updateLanguage();render();

/* Mobile installation retains the prior standalone app invitation. */
(function installShortcut(){
 const invitation=$('installInvite'),guide=$('installGuide');
 const installed=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
 const mobile=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)||matchMedia('(max-width:819px) and (pointer:coarse)').matches;
 const ios=/iPhone|iPad|iPod/i.test(navigator.userAgent);
 let deferred=null;
 function hide(){invitation.classList.add('hidden');try{sessionStorage.setItem('glenpa-install-dismissed','1')}catch(e){}}
 function guideOpen(){
  $('installGuideTitle').textContent=t('Install GLENPA REAL','تثبيت تطبيق جلينبا REAL');
  $('installGuideText').textContent=ios?t('Open in Safari → Share → Add to Home Screen → Add.','افتح الموقع عبر Safari ثم مشاركة ← إضافة إلى الشاشة الرئيسية ← إضافة.'):
   t('Open the browser menu (⋮), then choose Install App or Add to Home Screen.','افتح قائمة المتصفح (⋮) ثم اختر تثبيت التطبيق أو إضافة إلى الشاشة الرئيسية.');
  $('installGuideClose').textContent=t('Got it','فهمت');
  guide.classList.remove('hidden');guide.setAttribute('aria-hidden','false');
 }
 if(mobile&&!installed){let dismissed=false;try{dismissed=sessionStorage.getItem('glenpa-install-dismissed')==='1'}catch(e){}if(!dismissed)invitation.classList.remove('hidden')}
 window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;if(mobile&&!installed)invitation.classList.remove('hidden')});
 $('installDismiss').onclick=hide;
 $('installButton').onclick=async()=>{
  if(deferred){const event=deferred;deferred=null;try{await event.prompt();if((await event.userChoice).outcome==='accepted'){hide();return}}catch(e){}}
  guideOpen();
 };
 $('installGuideClose').onclick=()=>{guide.classList.add('hidden');guide.setAttribute('aria-hidden','true')};
 guide.addEventListener('click',e=>{if(e.target===guide)$('installGuideClose').click()});
 window.addEventListener('appinstalled',hide);
})();

