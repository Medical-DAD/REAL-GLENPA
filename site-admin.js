
/* GLENPA REAL Site Administration STAGING: metadata only. No password storage. */
(function(){
'use strict';
if(typeof admin!=='function'||typeof state==='undefined')return;
const KEY='glenpa-site-settings-preview-v1',UKEY='glenpa-user-inventory-preview-v1',CKEY='glenpa-doctor-overrides-preview-v1';
const SITE='https://medical-dad.github.io/REAL-GLENPA/';
let tab='users',editClinic=null,search='';
const defaults={siteTitle:'GLENPA REAL',enrollmentEnabled:true,defaultTheme:'blue',studyStatus:'Planning'};
function read(key,def){try{const v=JSON.parse(localStorage.getItem(key));return v??def}catch(e){return def}}
function save(key,v){try{localStorage.setItem(key,JSON.stringify(v))}catch(e){}}
let config=Object.assign({},defaults,read(KEY,{}));
let customUsers=read(UKEY,[]);
const previousOverrides=read(CKEY,{});
for(const [key,entry] of Object.entries(previousOverrides)){const i=Number(key)-1;if(i>=0&&i<DOCTORS.length)Object.assign(DOCTORS[i],entry)}
// Corrected first doctor's spelling, including earlier copies of the demo.
if(DOCTORS[0])DOCTORS[0].name='Ahmad Omary';
function tr(en,ar){return t(en,ar)}
function cell(v){return esc(String(v??''))}
function btn(value,text,klass){return '<button type="button" class="'+(klass||'adm-cta')+'" data-adm="'+cell(value)+'">'+text+'</button>'}
function navLabel(){return tr('Site administration','إدارة الموقع')}
function notice(){return '<div class="adm-alert">'+tr('DEMO CONTROL PANEL: Settings and user inventory here are saved in this browser only. They do not create real sign-ins or edit Firebase. Never enter passwords or real patient records.','لوحة إدارة تجريبية: الإعدادات وقائمة المستخدمين تُحفظ في هذا المتصفح فقط، ولا تنشئ حسابات دخول فعلية ولا تعدّل فايربيس. لا تدخل كلمات سر أو بيانات مرضى حقيقيين.')+'</div>'}
function tabNav(){
const tabs=[['users','♙',tr('Users','المستخدمون')],['clinics','▦',tr('Clinics','العيادات')],['study','▣',tr('Study settings','إعدادات الدراسة')],['appearance','◈',tr('Appearance','المظهر')],['qr','▧','QR Code'],['security','♢',tr('Security','الأمان')]];
return '<nav class="adm-tabs" aria-label="Admin sections">'+tabs.map(x=>'<button type="button" class="adm-tab '+(tab===x[0]?'active':'')+'" data-adm="tab:'+x[0]+'" aria-current="'+(tab===x[0]?'page':'false')+'">'+x[1]+' '+x[2]+'</button>').join('')+'</nav>';
}
function baselineUsers(){
return [{username:'msl.admin',role:'study_oversight',display:tr('MSL administrator','مسؤول الدراسة'),clinic:'—',active:true,builtIn:true}].concat(DOCTORS.map((d,i)=>({username:'clinic'+pad(i+1),role:'doctor',display:'Dr. '+d.name,clinic:'clinic'+pad(i+1),active:true,builtIn:true})));
}
function allUsers(){return baselineUsers().concat(customUsers)}
function userPanel(){
const us=allUsers().filter(u=>(u.username+' '+u.display+' '+u.clinic).toLowerCase().includes(search.toLowerCase()));
return '<section class="adm-surface"><h3>'+tr('User inventory and access planning','قائمة المستخدمين وتخطيط الصلاحيات')+'</h3><p>'+tr('27 default profiles (26 clinics + MSL). Add role assignments for later approved provisioning.','٢٧ ملفًا افتراضيًا (٢٦ عيادة ومسؤول دراسة). يمكنك إعداد بيانات مستخدمين إضافيين للمراجعة قبل التفعيل الآمن.')+'</p>'+notice()+
'<form id="admUserForm"><div class="adm-grid"><label class="adm-field">'+tr('Username','اسم المستخدم')+'<input name="username" placeholder="clinic27" required pattern="[a-zA-Z0-9._-]{3,40}"></label><label class="adm-field">'+tr('Display name','الاسم الظاهر')+'<input name="display" required maxlength="90"></label><label class="adm-field">'+tr('Role','الصلاحية')+'<select name="role"><option value="doctor">'+tr('Physician','طبيب')+'</option><option value="clinic_assistant">'+tr('Clinic assistant','مساعد العيادة')+'</option><option value="study_oversight">MSL (pending review)</option></select></label><label class="adm-field">'+tr('Clinic code','رمز العيادة')+'<select name="clinic"><option value="">'+tr('Unassigned','غير محدد')+'</option>'+DOCTORS.map((d,i)=>'<option value="clinic'+pad(i+1)+'">clinic'+pad(i+1)+' · '+cell(d.name)+'</option>').join('')+'</select></label></div><div class="adm-toolbar"><button type="submit" class="adm-cta">'+tr('Add user to planning list','إضافة المستخدم للقائمة التجريبية')+'</button></div></form>'+
'<div class="adm-toolbar"><label class="adm-field" style="flex:1;max-width:360px">'+tr('Search users','بحث المستخدمين')+'<input id="admUserSearch" value="'+cell(search)+'" placeholder="clinic01 / Ahmad"></label><span class="adm-chip">'+us.length+' '+tr('profiles','ملف مستخدم')+'</span></div>'+
'<div class="adm-table"><table><thead><tr><th>'+tr('Username','المستخدم')+'</th><th>'+tr('Name','الاسم')+'</th><th>'+tr('Role','الدور')+'</th><th>'+tr('Clinic','العيادة')+'</th><th>'+tr('Status','الحالة')+'</th><th>'+tr('Action','الإجراء')+'</th></tr></thead><tbody>'+
us.map(u=>'<tr><td><b>'+cell(u.username)+'</b></td><td>'+cell(u.display)+'</td><td><span class="adm-chip">'+cell(u.role)+'</span></td><td>'+cell(u.clinic||'—')+'</td><td>'+cell(u.active?tr('Planned active','نشط تجريبي'):tr('Inactive preview','غير نشط تجريبي'))+'</td><td>'+(u.builtIn?'<span class="adm-help">'+tr('Default','افتراضي')+'</span>':btn('toggleUser:'+u.username,u.active?tr('Deactivate preview','تعطيل تجريبي'):tr('Activate preview','تفعيل تجريبي'),'adm-smallbtn adm-ghost')+' '+btn('removeUser:'+u.username,tr('Remove','حذف'),'adm-smallbtn adm-ghost'))+'</td></tr>').join('')+'</tbody></table></div>'+
'<p class="adm-help">'+tr('Passwords are intentionally not collected here. This staging list does not grant or revoke real access.','لا تُجمع كلمات السر هنا. هذه القائمة التجريبية لا تمنح أو تلغي صلاحيات دخول حقيقية.')+'</p></section>';
}
function clinicsPanel(){
let c=editClinic?DOCTORS[editClinic-1]:null;
return '<section class="adm-surface"><h3>'+tr('Participating clinics','العيادات المشاركة')+'</h3><p>'+tr('Update local demo doctor labels and specialties for review. Firestore clinic profiles are not changed.','تعديل أسماء الأطباء واختصاصاتهم المعروضة في النسخة التجريبية، دون تغيير بيانات فايرستور.')+'</p>'+notice()+
(c?'<form id="admClinicForm"><input type="hidden" name="index" value="'+editClinic+'"><div class="adm-grid"><label class="adm-field">'+tr('Doctor name','اسم الطبيب')+'<input name="name" value="'+cell(c.name)+'" required></label><label class="adm-field">'+tr('Specialty','الاختصاص')+'<select name="specialty"><option value="Endocrinologist" '+(c.specialty==='Endocrinologist'?'selected':'')+'>Endocrinologist</option><option value="IM" '+(c.specialty==='IM'?'selected':'')+'>Internal Medicine</option></select></label><label class="adm-field">'+tr('Area','المنطقة')+'<input name="area" value="'+cell(c.area)+'" required></label></div><div class="adm-toolbar"><button type="submit" class="adm-cta">'+tr('Save in this browser','حفظ في هذا المتصفح')+'</button>'+btn('cancelClinic',tr('Cancel','إلغاء'),'adm-ghost')+'</div></form>':'')+
'<div class="adm-table"><table><thead><tr><th>#</th><th>'+tr('Doctor','الطبيب')+'</th><th>'+tr('Specialty','الاختصاص')+'</th><th>'+tr('Area','المنطقة')+'</th><th>'+tr('Action','الإجراء')+'</th></tr></thead><tbody>'+DOCTORS.map((d,i)=>'<tr><td>'+pad(i+1)+'</td><td><b>Dr. '+cell(d.name)+'</b></td><td>'+cell(d.specialty)+'</td><td>'+cell(d.area)+'</td><td>'+btn('editClinic:'+(i+1),tr('Edit','تعديل'),'adm-smallbtn adm-ghost')+'</td></tr>').join('')+'</tbody></table></div></section>';
}
function studyPanel(){
return '<section class="adm-surface"><h3>'+tr('Study configuration','إعدادات الدراسة')+'</h3>'+notice()+
'<form id="admStudyForm"><div class="adm-grid"><label class="adm-field">'+tr('Study name','اسم الدراسة')+'<input name="siteTitle" maxlength="65" value="'+cell(config.siteTitle)+'" required></label><label class="adm-field">'+tr('Study status (local preview)','حالة الدراسة (معاينة)')+'<select name="studyStatus"><option value="Planning" '+(config.studyStatus==='Planning'?'selected':'')+'>'+tr('Planning','تخطيط')+'</option><option value="Demo" '+(config.studyStatus==='Demo'?'selected':'')+'>'+tr('Fictional-data testing','اختبار ببيانات افتراضية')+'</option><option value="Paused" '+(config.studyStatus==='Paused'?'selected':'')+'>'+tr('Paused','متوقفة')+'</option></select></label><label class="adm-field">'+tr('Fictional enrollment (this browser)','التسجيل التجريبي (هذا المتصفح)')+'<select name="enrollmentEnabled"><option value="yes" '+(config.enrollmentEnabled?'selected':'')+'>'+tr('Enabled for fictional data','مسموح للبيانات الافتراضية')+'</option><option value="no" '+(!config.enrollmentEnabled?'selected':'')+'>'+tr('Paused','متوقف')+'</option></select></label></div><div class="adm-toolbar"><button type="submit" class="adm-cta">'+tr('Save local settings','حفظ الإعدادات المحلية')+'</button></div></form><div class="adm-notice">'+tr('The visit schedule remains Baseline, Month 3 and Month 6. Clinical form changes require approved protocol versioning.','جدول الزيارات يبقى الأساسية، الشهر الثالث، الشهر السادس. تعديل نماذج الدراسة السريرية يتطلب ضبط الإصدارات وموافقة البروتوكول.')+'</div></section>';
}
function appearancePanel(){
return '<section class="adm-surface"><h3>'+tr('Appearance and language','المظهر واللغة')+'</h3><p>'+tr('Changes here affect only the present browser until central settings are implemented.','هذه التغييرات تظهر على هذا المتصفح فقط حتى تفعيل إدارة مركزية للإعدادات.')+'</p><div class="adm-grid">'+[['blue','Executive Navy & Teal'],['green','Sage Green'],['violet','Violet'],['dark','Midnight']].map(x=>'<button class="adm-ghost" type="button" data-adm="appearance:'+x[0]+'">'+(x[0]===state.theme?'✓ ':'')+x[1]+'</button>').join('')+'</div><div class="adm-toolbar">'+btn('language:ar','العربية · Almarai','adm-ghost')+btn('language:en','English','adm-ghost')+'</div><div class="adm-notice">'+tr('Almarai is used throughout the Arabic interface, with Arabic system fonts as fallback when Google Fonts is unavailable.','الخط العربي المعتمد هو Almarai في جميع أجزاء الواجهة العربية، مع خط بديل عند تعذر تحميل Google Fonts.')+'</div></section>';
}
function qrPanel(){
return '<section class="adm-surface"><div class="adm-qrlayout"><div class="adm-qrinfo"><span class="adm-chip">GLENPA REAL · DIGITAL ACCESS</span><h3>'+tr('Premium QR for your website','رمز QR فاخر للموقع')+'</h3><p>'+tr('A high-resolution, scannable PNG card for clinic invitations, printed materials and WhatsApp sharing.','بطاقة PNG عالية الدقة قابلة للمسح، مناسبة لدعوات الأطباء والمطبوعات والمشاركة عبر واتساب.')+'</p><p class="adm-url">'+SITE+'</p><div class="adm-toolbar">'+btn('downloadQR','⬇ '+tr('Download Premium PNG','تنزيل صورة PNG فاخرة'))+btn('copyQR',tr('Copy website link','نسخ رابط الموقع'),'adm-ghost')+'</div><p class="adm-help">'+tr('The QR links to the published demonstration website. It does not grant access to protected records.','الرمز يفتح الموقع المنشور، ولا يمنح صلاحيات الدخول إلى بيانات محمية.')+'</p></div><div class="adm-preview"><canvas id="glenpaQrCanvas" width="960" height="1200" role="img" aria-label="GLENPA REAL QR code"></canvas></div></div></section>';
}
function securityPanel(){
return '<section class="adm-surface"><h3>'+tr('Security and account provisioning','الأمان وإدارة الحسابات')+'</h3><div class="adm-alert">'+tr('Do not store raw passwords, reversible passwords, or password hashes readable by a browser in Firestore. For actual accounts, a trusted server must verify strong salted password hashes, rate-limit attempts, and issue Firebase custom tokens. This is not available in the current Spark-only browser demo.','لا تخزّن كلمات السر كنص واضح أو بصيغة قابلة للفك، ولا تسمح للمتصفح بقراءة تجزئات كلمات السر من فايرستور. الحسابات الحقيقية تحتاج خادمًا موثوقًا للتحقق من تجزئات قوية ومملّحة ومنع محاولات الدخول المتكررة وإصدار رموز مصادقة. هذا غير متاح في النسخة التجريبية الحالية على Spark فقط.')+'</div><div class="adm-secgrid">'+
'<div class="adm-secitem"><b>01 · '+tr('Credentials','بيانات الدخول')+'</b>'+tr('Protected server-only credential collection using Argon2id hashes and unique salts, never plaintext.','مجموعة بيانات لا يصل إليها إلا الخادم، تحتوي تجزئات Argon2id مع ملح فريد، وليس كلمات سر مكشوفة.')+'</div>'+
'<div class="adm-secitem"><b>02 · '+tr('Access','الصلاحيات')+'</b>'+tr('Clinic-isolated Firestore Security Rules tested in the Emulator Suite.','قواعد صلاحيات Firestore خاصة بكل عيادة، تختبر بالمحاكي.')+'</div>'+
'<div class="adm-secitem"><b>03 · '+tr('Audit trail','سجل التغييرات')+'</b>'+tr('Immutable, attributable changes and administrative action logs.','سجل تغييرات وإجراءات إدارية قابل للتتبع ولا يمكن العبث به.')+'</div>'+
'<div class="adm-secitem"><b>04 · '+tr('Research readiness','جاهزية البحث')+'</b>'+tr('Approved hosting, privacy assessment, protocol governance and validation before patient data.','موافقة الاستضافة والخصوصية وحوكمة البروتوكول والتحقق قبل إدخال بيانات المرضى.')+'</div></div></section>';
}
function content(){
return '<div class="siteadm"><div class="adm-lead"><span class="adm-badge">✦ GLENPA REAL · ADMIN STUDIO</span><h2>'+tr('Your study workspace. Beautifully organised.','مساحة إدارة دراستك، بتفاصيل منظمة وأنيقة.')+'</h2><p>'+tr('Manage the demonstration site, plan clinic users and prepare premium QR materials from one place.','إعدادات النسخة التجريبية، إدارة قائمة المستخدمين، وتجهيز مواد QR بصورة احترافية من مكان واحد.')+'</p></div>'+tabNav()+
(tab==='users'?userPanel():tab==='clinics'?clinicsPanel():tab==='study'?studyPanel():tab==='appearance'?appearancePanel():tab==='qr'?qrPanel():securityPanel())+'</div>';
}
const baseAdmin=admin;
admin=function(){
 let html=baseAdmin();
 const menu='<button class="rail-link '+(state.view==='siteAdmin'?'active':'')+'" data-action="nav:siteAdmin"><span class="rail-icon">⚙</span>'+navLabel()+'<span class="rail-arrow">›</span></button>';
 html=html.replace('<div class="rail-divider">',menu+'<div class="rail-divider">');
 if(state.view==='siteAdmin'&&!state.patient){
  let start=html.indexOf('<div class="content-area">'),end=html.indexOf('<footer class="portal-footer">',start);
  if(start>=0&&end>=0)html=html.slice(0,start)+'<div class="content-area">'+content()+'</div>'+html.slice(end);
  html=html.replace('<h1>'+tr('Overview','نظرة عامة')+'</h1>','<h1>'+navLabel()+'</h1>');
  if(tab==='qr')requestAnimationFrame(drawQr);
 }
 return html;
};
const oldEnroll=enroll;
enroll=function(){
 if(config.enrollmentEnabled===false)return '<section class="card"><h2>'+tr('Fictional enrollment paused','التسجيل التجريبي متوقف')+'</h2><p>'+tr('Re-enable it in Site administration → Study settings.','يمكن تفعيله من إدارة الموقع ← إعدادات الدراسة.')+'</p></section>';
 return oldEnroll();
};
function rerender(){if(state.role==='admin')render()}
document.addEventListener('click',function(e){
 const a=e.target.closest('[data-adm]');if(!a)return;
 e.preventDefault();e.stopImmediatePropagation();
 const act=a.dataset.adm;
 if(act.startsWith('tab:')){tab=act.slice(4);rerender()}
 else if(act.startsWith('editClinic:')){editClinic=Number(act.slice(11));rerender()}
 else if(act==='cancelClinic'){editClinic=null;rerender()}
 else if(act.startsWith('toggleUser:')){let u=customUsers.find(x=>x.username===act.slice(11));if(u){u.active=!u.active;save(UKEY,customUsers);rerender()}}
 else if(act.startsWith('removeUser:')){customUsers=customUsers.filter(x=>x.username!==act.slice(11));save(UKEY,customUsers);rerender()}
 else if(act.startsWith('appearance:')){setTheme(act.slice(11));config.defaultTheme=state.theme;save(KEY,config);rerender()}
 else if(act.startsWith('language:')){state.language=act.slice(9);rerender()}
 else if(act==='copyQR'){if(navigator.clipboard?.writeText)navigator.clipboard.writeText(SITE).catch(()=>{});}
 else if(act==='downloadQR'){let c=document.getElementById('glenpaQrCanvas');if(c){drawQr();c.toBlob(function(blob){if(!blob)return;let u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='GLENPA-REAL-Premium-QR.png';a.click();setTimeout(()=>URL.revokeObjectURL(u),1500)},'image/png')}}
},true);
document.addEventListener('input',function(e){if(e.target.id==='admUserSearch'){search=e.target.value;}},true);
document.addEventListener('submit',function(e){
 let form=e.target;if(!['admUserForm','admClinicForm','admStudyForm'].includes(form.id))return;
 e.preventDefault();e.stopImmediatePropagation();
 const f=new FormData(form),val=k=>String(f.get(k)||'').trim();
 if(form.id==='admUserForm'){
  const username=val('username').toLowerCase();
  if(!/^[a-z0-9._-]{3,40}$/.test(username)||allUsers().some(u=>u.username===username)){alert(tr('Invalid or existing username','اسم المستخدم غير صالح أو موجود'));return}
  const role=val('role'),clinic=val('clinic');if(role!=='study_oversight'&&!clinic){alert(tr('Select a clinic','حدد العيادة'));return}
  customUsers.push({username,display:val('display').slice(0,90),role,clinic,active:false,builtIn:false});
  save(UKEY,customUsers);
 }else if(form.id==='admClinicForm'){
  let i=Number(val('index'));if(i>=1&&i<=26){let d={name:val('name').slice(0,90),specialty:val('specialty'),area:val('area').slice(0,90)};Object.assign(DOCTORS[i-1],d);const edits=read(CKEY,{});edits[i]=d;save(CKEY,edits);editClinic=null}
 }else{
  config.siteTitle=val('siteTitle').slice(0,65);config.studyStatus=val('studyStatus');config.enrollmentEnabled=val('enrollmentEnabled')==='yes';save(KEY,config);
 }
 rerender();
},true);
const matrix=[
'1111111001101011101001000010001111111','1000001010110101011110001110101000001','1011101010100101101010100101101011101','1011101011010000010010110100001011101','1011101011000000110110001110101011101','1000001011101100011101010000101000001','1111111010101010101010101010101111111','0000000000111011000101111011100000000','0010011110001001001010010010110111110','0101000100111010100100101100100101111','1101011111100000110011101001111111101','0110100010001011110010001010000110010','0000001110110001111000001001101101010','0010110110111011111100110001111100101','0100101111100010000111001101000011101','1001110010001111000110100000000101000','0010111100101100100010001010111100001','0000000011111001110011101101101100101','0100001101011101011110101001111010101','1100110110001000101011111010101001001','1000011111101101101010000101111001010','0111110010100100000101100111001101000','1010101111100000000000110001101111101','1000010100110110010100111011010101010','1100111100001011010100110110001111011','0011110000101001101010100100100101101','1110101011010101100010010101111000101','0001000001010110011100000011111101011','1101001001111100000001111000111111101','0000000010110110011110001100100011001','1111111011111010001100110000101011101','1000001011010101011011101001100011010','1011101001101111011111111001111110001','1011101000101001111110001000100110001','1011101010111001000110001010000010011','1000001000010001010010111000111001000','1111111001011101111100001100101101001'
];
let brandImage=null;
function drawQr(){
 const canvas=document.getElementById('glenpaQrCanvas');if(!canvas)return;
 const g=canvas.getContext('2d');if(!g)return;const w=960,h=1200;canvas.width=w;canvas.height=h;
 const bg=g.createLinearGradient(0,0,960,1200);bg.addColorStop(0,'#13283F');bg.addColorStop(.65,'#175B60');bg.addColorStop(1,'#169785');g.fillStyle=bg;g.fillRect(0,0,w,h);
 g.strokeStyle='#ffffff32';g.lineWidth=4;g.beginPath();g.arc(920,20,240,0,Math.PI*2);g.stroke();g.beginPath();g.arc(30,1160,220,0,Math.PI*2);g.stroke();
 g.fillStyle='#FFFFFF';g.font='bold 60px system-ui';g.textAlign='center';g.fillText('GLENPA REAL',480,128);
 g.font='bold 25px system-ui';g.fillStyle='#c7eae1';g.fillText('CLINICAL STUDY · DIGITAL ACCESS',480,179);
 // White quiet zone is kept intact for reliable scanning.
 const x0=89,y0=236,cellsize=18,quiet=4,n=matrix.length,size=(n+quiet*2)*cellsize;
 g.fillStyle='#FFFFFF';g.beginPath();g.roundRect(x0,y0,size,size,34);g.fill();
 g.fillStyle='#153E49';for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(matrix[y][x]==='1'){g.fillRect(x0+(x+quiet)*cellsize,y0+(y+quiet)*cellsize,cellsize,cellsize)}
 g.fillStyle='#FFFFFF';g.font='bold 43px system-ui';g.fillText('SCAN TO OPEN',480,1107);
 g.fillStyle='#e3f7f4';g.font='26px system-ui';g.fillText('medical-dad.github.io/REAL-GLENPA',480,1155);
}
window.glenpaDrawQr=drawQr;
})();
