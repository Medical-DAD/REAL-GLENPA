'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const clinic=fs.readFileSync('index.html','utf8');
const admin=fs.readFileSync('admin.html','utf8');
const app=fs.readFileSync('portal.js','utf8');
const rules=fs.readFileSync('firestore.rules','utf8');
const css=fs.readFileSync('portal.css','utf8');

test('administrator login is on a separate admin.html entry, not hidden in clinic portal',()=>{
 assert.ok(admin.includes('<body data-portal="admin">'));
 assert.ok(clinic.includes('<body data-portal="clinic">'));
 assert.ok(admin.includes('id="username" autocomplete="username" required value="msl.admin" readonly'));
 assert.ok(!clinic.includes('value="msl.admin"'));
 assert.ok(!clinic.includes('adminOverlay'));
 assert.ok(!admin.includes('adminOverlay'));
 assert.ok(app.includes("const ADMIN_PAGE=document.body.dataset.portal==='admin'"));
 assert.ok(app.includes("if(p.role==='study_oversight'&&!ADMIN_PAGE){window.location.replace('./admin.html');return}"));
 assert.ok(app.includes("if(p.role==='clinic'&&ADMIN_PAGE){window.location.replace('./index.html');return}"));
 assert.ok(app.includes("await login($('username').value,$('password').value,ADMIN_PAGE)"));
 assert.ok(!app.includes("adminLoginForm"));
});
test('static 26 and 03 counts no longer appear on clinic login and hardcoded 03 study count removed',()=>{
 assert.ok(!clinic.includes('welcome-metrics'));
 assert.ok(!clinic.includes('<b>26</b>'));
 assert.ok(!clinic.includes('<b>03</b>'));
 assert.ok(!app.includes("metric(t('Study visits','زيارات الدراسة'),'03')"));
});
test('clinic navigation only contains study records and contact (no My clinic or My account)',()=>{
 const part=app.slice(app.indexOf('function renderNav(){'),app.indexOf('function render(){'));
 assert.ok(part.includes("[['patients',t('Study records','سجلات الدراسة')],['contact',t('Contact Us','اتصل بنا')]]"));
 assert.ok(!part.includes("['account',"));
 assert.ok(app.includes("current.view=isAdmin()?'overview':'patients'"));
});
test('premium loader is included on both pages and supports reduced-motion',()=>{
 for(const html of [admin,clinic]){
  assert.ok(html.includes('id="pageLoader"'));
  assert.ok(html.includes('class="loader-orbit loader-orbit-one"'));
  assert.ok(html.includes('id="loaderMessage"'));
 }
 assert.ok(css.includes('@media(prefers-reduced-motion:reduce)'));
 assert.ok(app.includes('function showLoader('));
 assert.ok(app.includes('function hideLoader('));
 assert.ok(app.includes('showLoader(t('));
 assert.ok(app.includes('finally{hideLoader()}'));
 for(const dead of ['adminTitle','adminUsernameLabel','adminPasswordLabel','adminLoginButton','metricVisits','metricClinics']){
  assert.ok(!app.includes("$('"+dead+"')"),'unexpected missing DOM reference '+dead);
 }
});
test('admin can remove clinic study access, never remove own administrator identity',()=>{
 assert.ok(app.includes('data-removeuser'));
 assert.ok(app.includes('user.role!==\\'clinic\\'')||app.includes("user.role!=='clinic'"));
 assert.ok(app.includes('user.id===current.user.uid'));
 assert.ok(app.includes('window.confirm('));
 assert.ok(app.includes('active:false,removed:true,removedBy:current.user.uid,removedAt:serverTimestamp()'));
 assert.ok(app.includes('current.users.filter(u=>u.removed!==true)'));
 assert.ok(rules.includes('userId != request.auth.uid'));
 assert.ok(rules.includes("resource.data.role == 'clinic'"));
 assert.ok(rules.includes('request.resource.data.removed == true'));
 assert.ok(rules.includes('request.resource.data.active == false'));
 assert.ok(rules.includes('request.resource.data.removedAt == request.time'));
 assert.ok(rules.includes('allow delete: if false;'));
});
