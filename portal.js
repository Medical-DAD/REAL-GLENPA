
import{initializeApp,deleteApp}from'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import{getAuth,onAuthStateChanged,signInWithEmailAndPassword,createUserWithEmailAndPassword,signOut,deleteUser,setPersistence,browserSessionPersistence}from'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import{getFirestore,doc,getDoc,getDocs,collection,query,where,setDoc,updateDoc,writeBatch,serverTimestamp}from'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import{firebaseConfig}from'./firebase-config.js';

const fb=initializeApp(firebaseConfig),auth=getAuth(fb),db=getFirestore(fb);
const ADMIN_EMAIL='medicaldepartmentdad@gmail.com';
// Firebase Auth requires an internal email identifier, but clinic staff never enter or see it.
// Using this app's Firebase Auth domain avoids needing real staff email addresses.
const INTERNAL_CLINIC_DOMAIN='glenpa-real.firebaseapp.com';

const WEB_URL='https://medical-dad.github.io/REAL-GLENPA/';
const $=id=>document.getElementById(id);
const current={language:'en',theme:'blue',user:null,profile:null,view:'overview',clinics:[],patients:[],users:[],patient:null,settings:{studyTitle:'GLENPA REAL',enrollmentEnabled:false},busy:false,alert:'',ready:false};
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

function patientsView(){
 const enrollment=isClinic()&&current.settings.enrollmentEnabled===true;
 const myList=isAdmin()?current.patients:current.patients.filter(p=>p.clinicCode===clinicKey());
 let patient=current.patient&&myList.find(x=>x.id===current.patient);
 if(patient)return patientView(patient);
 let heading='<div class="row"><p class="muted">'+t('Coded study records only. Patient names are not collected.','سجلات مرمّزة فقط، ولا تُجمع أسماء المرضى.')+'</p>'+
 '<div class="actions">'+(enrollment?'<button class="cta" id="newPatientBtn">'+t('Enroll patient','تسجيل مريض')+'</button>':'')+
 '<button class="secondary" id="exportCsvBtn">'+t('Export coded CSV','تصدير CSV مرمّز')+'</button></div></div>';
 if(isClinic()&&!enrollment)heading+='<div class="notice">'+t('Enrollment is currently disabled by study settings.','التسجيل متوقف حاليًا بحسب إعدادات الدراسة.')+'</div>';
 return panel(t('Patient registry','سجل المرضى'),heading+
 '<div class="table-scroll"><table><thead><tr><th>'+t('Study ID','رمز الدراسة')+'</th><th>'+t('Clinic','العيادة')+'</th><th>'+t('Age','العمر')+'</th><th>'+t('Sex','الجنس')+'</th><th>'+t('Created','تاريخ الإنشاء')+'</th><th>'+t('Details','التفاصيل')+'</th></tr></thead><tbody>'+
 myList.map(p=>'<tr><td><b>'+esc(p.patientCode)+'</b></td><td>'+esc(p.clinicCode)+'</td><td>'+esc(p.age)+'</td><td>'+esc(p.sex)+'</td><td>'+esc(p.createdAt?.toDate?.()?.toLocaleDateString?.()||'—')+'</td><td><button class="link" data-patient="'+esc(p.id)+'">'+t('Open','فتح')+'</button></td></tr>').join('')+'</tbody></table></div>'+
 (myList.length?'':'<div class="empty">'+t('No records enrolled.','لا توجد سجلات مسجلة بعد.')+'</div>'));
}
function patientView(p){
 const canWrite=isClinic()&&p.clinicCode===clinicKey();
 const conditions=Array.isArray(p.diagnoses)?p.diagnoses:[];
 const names=conditions.map(labelComorbidity);
 if(p.otherDiagnoses)names.push(esc(p.otherDiagnoses));
 const clinicalProfile=panel(t('Diabetes profile & medical history','ملف السكري والتاريخ المرضي'),
  '<div class="clinical-kv">'+
  '<div><small>'+t('Sex','الجنس')+'</small><strong>'+t(p.sex==='Female'?'Female':'Male',p.sex==='Female'?'أنثى':'ذكر')+'</strong></div>'+
  '<div><small>'+t('Diabetes duration','مدة السكري')+'</small><strong>'+showValue(p.diabetesYears)+' '+t('years','سنة')+'</strong></div>'+
  '<div><small>'+t('Medical history','التاريخ المرضي')+'</small><strong>'+showValue(p.history)+'</strong></div>'+
  '<div><small>'+t('Comorbidities','الأمراض المصاحبة')+'</small><strong>'+(names.length?names.join('، '):t('Not recorded','غير مسجّلة'))+'</strong></div>'+
  '</div><h3>'+t('Baseline concomitant medications','الأدوية المصاحبة الأساسية')+'</h3>'+
  medicationTable(medicationLines(p))+
  (canWrite?'<div class="actions"><button class="secondary" type="button" id="editMedicalProfile">'+t('Edit medical profile','تعديل التاريخ المرضي والأدوية')+'</button></div>':''));
 return '<div class="actions"><button class="secondary" type="button" id="backPatients">'+t('← Back to patient registry','← الرجوع إلى سجل المرضى')+'</button></div>'+
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
async function enrollPatient(form){
 if(!isClinic()||current.settings.enrollmentEnabled!==true)throw Error('Enrollment not authorized');
 const f=new FormData(form),id=String(f.get('patientCode')||'').trim().toUpperCase();
 if(!/^[A-Z0-9_-]{3,24}$/.test(id))throw Error('Study ID must be 3–24 uppercase letters, digits, underscores or hyphens.');
 const age=Number(f.get('age')),diabetesYears=Number(f.get('diabetesYears'));
 if(!Number.isInteger(age)||age<18||age>110||!Number.isFinite(diabetesYears)||diabetesYears<0||diabetesYears>100)throw Error('Invalid clinical values');
 const clinicCode=clinicKey(),patientId=clinicCode+'_'+id;
 const payload={clinicCode,patientCode:id,age,sex:String(f.get('sex')),diabetesYears,createdBy:current.user.uid,createdAt:serverTimestamp()};
 await setDoc(doc(db,'patients',patientId),payload);
 current.patient=null;await loadRecords();status(t('Coded patient record created.','تم إنشاء سجل المريض المرمّز.'));
}
async function saveVisit(form,patient){
 if(!eligiblePatientWrite(patient))throw Error('Visit writing not authorized');
 const f=new FormData(form),phase=String(f.get('phase'));
 if(!['baseline','month3','month6'].includes(phase))throw Error('Invalid phase');
 const hba1c=Number(f.get('hba1c')),fpg=Number(f.get('fpg'));
 const egfr=f.get('egfr')===''?null:Number(f.get('egfr'));
 const weight=f.get('weight')===''?null:Number(f.get('weight'));
 if(hba1c<3||hba1c>20||!Number.isFinite(hba1c)||fpg<30||fpg>1000||!Number.isFinite(fpg)||
 (egfr!==null&&(!Number.isFinite(egfr)||egfr<0||egfr>200))||(weight!==null&&(!Number.isFinite(weight)||weight<1||weight>400)))throw Error('Invalid laboratory values');
 const date=String(f.get('date'));
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Invalid visit date');
 if(phase!=='baseline'){
  const previous=phase==='month3'?'baseline':'month3';
  const snap=await getDoc(doc(db,'patients',patient.id,'visits',previous));
  if(!snap.exists())throw Error('Record the preceding visit first');
  const previousDate=new Date(snap.data().date+'T12:00:00Z');
  if(Number.isNaN(previousDate.valueOf()))throw Error('Invalid previous visit date');
  previousDate.setUTCMonth(previousDate.getUTCMonth()+3);
  if(date<previousDate.toISOString().slice(0,10))throw Error('At least 3 calendar months must separate study visits.');
 }
 const payload={phase,date,hba1c,fpg,egfr,weight,dose:String(f.get('dose')),
 adverseEvent:String(f.get('adverseEvent')||'').slice(0,400),medicationChanges:String(f.get('medicationChanges')||'').slice(0,400),
 notes:String(f.get('notes')||'').slice(0,400),updatedBy:current.user.uid,updatedAt:serverTimestamp()};
 await setDoc(doc(db,'patients',patient.id,'visits',phase),payload);
 await showVisits(patient);status(t('Visit saved to Firestore.','تم حفظ الزيارة في Firestore.'));
}
async function showVisits(patient){
 const area=$('visitsArea');if(!area)return;
 try{const all=await getDocs(collection(db,'patients',patient.id,'visits'));
 const order=['baseline','month3','month6'];const records=all.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>order.indexOf(a.id)-order.indexOf(b.id));
 area.innerHTML=records.map(v=>'<div class="security-note" style="margin-bottom:9px"><div class="row"><b>'+esc(v.phase)+'</b><span class="chip">'+esc(v.date)+'</span></div>'+
 '<div class="grid"><p><b>HbA1c</b><br>'+esc(v.hba1c)+'%</p><p><b>FPG</b><br>'+esc(v.fpg)+' mg/dL</p><p><b>eGFR</b><br>'+esc(v.egfr??'—')+'</p><p><b>Weight</b><br>'+esc(v.weight??'—')+' kg</p></div>'+
 '<p>'+t('Dose','الجرعة')+': '+esc(v.dose)+'</p><p>'+t('Adverse event','حدث ضار')+': '+esc(v.adverseEvent||'—')+'</p></div>').join('')||
 '<p class="muted">'+t('No visits recorded yet.','لم تُسجل أي زيارة بعد.')+'</p>';
 }catch(err){area.textContent=errorMessage(err)}
}
function openEnrollForm(){
 const markup='<form id="enrollForm"><p class="notice">'+t('Use only approved pseudonymous study IDs. Never enter a patient name, national ID or phone.','استخدم رمز دراسة مخصصًا للمريض فقط. لا تدخل أسماء المرضى أو أرقامهم الوطنية أو هواتفهم.')+'</p>'+
 '<div class="field-grid"><label>'+t('Unique study ID','رمز المريض المميز')+'<input name="patientCode" placeholder="CL01-001" maxlength="24" pattern="[A-Za-z0-9_-]{3,24}" required></label>'+
 '<label>'+t('Age','العمر')+'<input name="age" type="number" min="18" max="110" required></label>'+
 '<label>'+t('Sex','الجنس')+'<select name="sex"><option value="Male">'+t('Male','ذكر')+'</option><option value="Female">'+t('Female','أنثى')+'</option></select></label>'+
 '<label>'+t('Years with type 2 diabetes','سنوات الإصابة بالسكري من النوع الثاني')+'<input name="diabetesYears" type="number" min="0" max="100" required></label></div>'+
 '<div class="actions"><button type="submit" class="cta">'+t('Save patient','حفظ المريض')+'</button><button type="button" class="secondary" data-nav="patients">'+t('Cancel','إلغاء')+'</button></div></form>';
 $('view').innerHTML=panel(t('Patient enrollment','تسجيل المريض'),markup);
}
function openVisitForm(patient){
 const fields='<form id="visitForm"><div class="field-grid"><label>'+t('Visit','الزيارة')+'<select name="phase"><option value="baseline">'+t('Baseline','الأساسية')+'</option><option value="month3">'+t('Month 3','الشهر الثالث')+'</option><option value="month6">'+t('Month 6','الشهر السادس')+'</option></select></label>'+
 '<label>'+t('Visit date','تاريخ الزيارة')+'<input type="date" name="date" required></label>'+
 '<label>HbA1c (%)<input type="number" min="3" max="20" step=".1" name="hba1c" required></label>'+
 '<label>FPG (mg/dL)<input type="number" min="30" max="1000" step="1" name="fpg" required></label>'+
 '<label>eGFR (mL/min/1.73m²)<input type="number" min="0" max="200" step=".1" name="egfr"></label>'+
 '<label>'+t('Weight (kg)','الوزن (كغم)')+'<input type="number" min="1" max="400" step=".1" name="weight"></label>'+
 '<label>'+t('Glenpa strength','تركيز جلينبا')+'<select name="dose"><option>10/5 mg</option><option>25/5 mg</option></select></label>'+
 '<label class="span2">'+t('Adverse event (coded, no identifiers)','حدث ضار (دون معرفات شخصية)')+'<textarea name="adverseEvent" maxlength="400"></textarea></label>'+
 '<label class="span2">'+t('Medication changes','التغييرات في الأدوية')+'<textarea name="medicationChanges" maxlength="400"></textarea></label>'+
 '<label class="span2">'+t('Clinical notes (no identifiers)','ملاحظات سريرية (دون معرفات)')+'<textarea name="notes" maxlength="400"></textarea></label></div>'+
 '<div class="actions"><button class="cta" type="submit">'+t('Save visit','حفظ الزيارة')+'</button><button type="button" class="secondary" data-patient="'+esc(patient.id)+'">'+t('Cancel','إلغاء')+'</button></div></form>';
 $('view').innerHTML=panel(t('Record visit for','تسجيل زيارة للمريض')+' '+esc(patient.patientCode),fields);
}
async function provisionUser(form){
 if(!isAdmin())throw Error('Not authorized');
 const f=new FormData(form),username=parseCode(f.get('username')),clinicCode=String(f.get('clinicCode')||''),password=String(f.get('password')||'');
 const email=username+'@'+INTERNAL_CLINIC_DOMAIN;
 if(!/^[a-z0-9._-]{3,40}$/.test(username)||username==='msl.admin'||!validClinic(clinicCode)||!current.clinics.some(c=>c.id===clinicCode)||!/^[0-9]{6,32}$/.test(password))throw Error(t('Enter a valid clinic username and a numeric password of 6 to 32 digits.','أدخل اسم مستخدم صحيح وكلمة مرور رقمية من 6 إلى 32 رقمًا.'));
 if(current.users.some(u=>parseCode(u.username)===username))throw Error(t('Username already exists.','اسم المستخدم موجود مسبقًا.'));
 const existing=await getDoc(doc(db,'loginHandles',username));
 if(existing.exists())throw Error('Username already exists');
 const second=initializeApp(firebaseConfig,'provision-'+Date.now()),secondAuth=getAuth(second);
 let user=null;
 try{
  const signed=await createUserWithEmailAndPassword(secondAuth,email,password);
  user=signed.user;
  const batch=writeBatch(db);
  batch.set(doc(db,'userProfiles',user.uid),{username,role:'clinic',clinicCode,active:true,createdBy:current.user.uid,createdAt:serverTimestamp()});
  batch.set(doc(db,'loginHandles',username),{email,userUid:user.uid});
  await batch.commit();await signOut(secondAuth);
 }catch(e){
  if(user)try{await deleteUser(user)}catch(cleanup){}
  throw e;
 }finally{await deleteApp(second)}
 form.reset();await loadRecords();status(t('Clinic account created. Share the username and password privately.','تم إنشاء حساب العيادة. سلّم اسم المستخدم وكلمة المرور بشكل خاص وآمن.'));
}
async function updateSettings(form){
 if(!isAdmin())throw Error('Not authorized');
 const f=new FormData(form);const data={studyTitle:String(f.get('studyTitle')||'').slice(0,90),enrollmentEnabled:f.get('enrollmentEnabled')==='true',updatedBy:current.user.uid,updatedAt:serverTimestamp()};
 await setDoc(doc(db,'siteSettings','main'),data,{merge:true});
 await loadRecords();status(t('Study settings saved.','تم حفظ إعدادات الدراسة.'));
}
async function exportCodedCSV(){
 const cols=['clinicCode','patientCode','age','sex','diabetesYears','visit','visitDate','hba1c','fpg','egfr','weight','dose','adverseEvent','medicationChanges'];
 const rows=[cols];const all=current.patients;
 for(const p of all){
  const visits=await getDocs(collection(db,'patients',p.id,'visits'));
  if(visits.empty){rows.push([p.clinicCode,p.patientCode,p.age,p.sex,p.diabetesYears,'','','','','','','','','']);continue}
  for(const v of visits.docs){
   const d=v.data();
   rows.push([p.clinicCode,p.patientCode,p.age,p.sex,p.diabetesYears,v.id,d.date,d.hba1c,d.fpg,d.egfr,d.weight,d.dose,d.adverseEvent,d.medicationChanges]);
  }
 }
 const csv=rows.map(row=>row.map(escapeCsv).join(',')).join('\r\n');
 const url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));
 const a=document.createElement('a');a.href=url;a.download='GLENPA-REAL-Coded-Visits.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
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
 const nav=e.target.closest('[data-nav]');if(nav){current.view=nav.dataset.nav;current.patient=null;render();return}
 const patientBtn=e.target.closest('[data-patient]');if(patientBtn){current.patient=patientBtn.dataset.patient;current.view='patients';render();const patient=current.patients.find(x=>x.id===current.patient);if(patient)await showVisits(patient);return}
 const editBtn=e.target.closest('[data-editclinic]');if(editBtn){
  if(!isAdmin())return;const c=current.clinics.find(x=>x.id===editBtn.dataset.editclinic);if(!c)return;
  $('view').innerHTML=panel(t('Edit clinic','تعديل العيادة'),'<form id="clinicForm"><input type="hidden" name="code" value="'+esc(c.id)+'"><div class="field-grid"><label>'+t('Doctor','الطبيب')+'<input name="doctorName" value="'+esc(c.doctorName||'')+'" required></label><label>'+t('Specialty','الاختصاص')+'<input name="specialty" value="'+esc(c.specialty||'')+'" required></label><label>'+t('Area','المنطقة')+'<input name="area" value="'+esc(c.area||'')+'" required></label></div><button class="cta" type="submit">'+t('Save changes','حفظ التعديلات')+'</button></form>');return}
 const toggle=e.target.closest('[data-toggleuser]');if(toggle){if(!isAdmin())return;const u=current.users.find(x=>x.id===toggle.dataset.toggleuser);if(!u||u.id===current.user.uid)return;await safeAction(async()=>{await updateDoc(doc(db,'userProfiles',u.id),{active:!u.active});await loadRecords()});return}
 if(e.target.id==='newPatientBtn')openEnrollForm();
 if(e.target.id==='newVisitBtn'){const p=current.patients.find(x=>x.id===current.patient);if(p)openVisitForm(p)}
 if(e.target.id==='backPatients'){current.patient=null;render()}
 if(e.target.id==='exportCsvBtn')await safeAction(exportCodedCSV);
 if(e.target.id==='downloadQR')downloadQR();
}
// Navigation buttons live OUTSIDE #view. Without this listener every top tab is inert.
$('nav').addEventListener('click',handleClick);
$('view').addEventListener('click',handleClick);
$('view').addEventListener('submit',e=>{
 e.preventDefault();const form=e.target;
 safeAction(async()=>{
  if(form.id==='enrollForm')await enrollPatient(form);
  else if(form.id==='visitForm'){const p=current.patients.find(x=>x.id===current.patient);if(p)await saveVisit(form,p)}
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

