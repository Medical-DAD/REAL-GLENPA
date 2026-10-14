
import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut, setPersistence, browserSessionPersistence } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-staging/firebase-config.js';
const app=getApps().length?getApp():initializeApp(firebaseConfig);
const auth=getAuth(app), db=getFirestore(app);
const $=id=>document.getElementById(id);
const ADMIN_IDENTITY={username:'msl.admin',firebaseEmail:'medicaldepartmentdad@gmail.com'};
let lastFocus=null,clicks=0,firstClick=0,busy=false;
const ar=()=>document.documentElement.lang==='ar';
const translated=(en,arabic)=>ar()?arabic:en;
const modal=document.createElement('div');
modal.className='gl-admin-overlay';modal.id='glAdminOverlay';modal.setAttribute('aria-hidden','true');
modal.innerHTML=[
'<section class="gl-admin-modal" role="dialog" aria-modal="true" aria-labelledby="glAdminTitle">',
'<button type="button" class="gl-admin-x" id="glAdminClose" aria-label="Close">×</button>',
'<div class="gl-admin-sign" aria-hidden="true">✦</div>',
'<span class="gl-login-kicker"><span class="gl-login-dot"></span> GLENPA REAL · PRIVATE ACCESS</span>',
'<h2 id="glAdminTitle"></h2><p class="gl-login-desc" id="glAdminIntro"></p>',
'<form id="glAdminForm">',
'<label class="gl-input-label gl-admin-user-field"><span id="glAdminUsernameLabel"></span><input id="glAdminUsername" value="msl.admin" type="text" readonly aria-readonly="true" autocomplete="off"></label>',
'<label class="gl-input-label"><span id="glAdminPasswordLabel"></span>',
'<input id="glAdminPassword" type="password" required autocomplete="current-password"></label>',
'<button class="gl-login-cta" type="submit" id="glAdminSubmit"></button>',
'<p class="gl-login-status" id="glAdminStatus" aria-live="polite"></p></form>',
'</section>'].join('');
document.body.appendChild(modal);
function renderModal(){
 $('glAdminTitle').textContent=translated('Administrator access','الدخول إلى لوحة المسؤول');
 $('glAdminIntro').textContent=translated('Secure access to your MSL dashboard.','دخول آمن إلى لوحة مسؤول الدراسة.');
 $('glAdminUsernameLabel').textContent=translated('Username','اسم المستخدم');
 $('glAdminUsername').value=ADMIN_IDENTITY.username;
 $('glAdminPasswordLabel').textContent=translated('Password','كلمة المرور');
 $('glAdminSubmit').textContent=translated('Access dashboard →','الدخول إلى لوحة المسؤول ←');
 $('glAdminStatus').textContent='';
}
function openAdmin(){lastFocus=document.activeElement;renderModal();modal.classList.add('open');modal.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';$('glAdminPassword').focus()}
function closeAdmin(){if(busy)return;modal.classList.remove('open');modal.setAttribute('aria-hidden','true');document.body.style.overflow='';$('glAdminPassword').value='';lastFocus?.focus?.()}
$('glAdminClose').addEventListener('click',closeAdmin);
modal.addEventListener('click',e=>{if(e.target===modal)closeAdmin()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal.classList.contains('open'))closeAdmin()});
$('glAdminForm').addEventListener('submit',async e=>{
 e.preventDefault();if(busy)return;
 const username=$('glAdminUsername').value.trim().toLowerCase();
 if(username!==ADMIN_IDENTITY.username){
  $('glAdminStatus').textContent=translated('Invalid administrator username.','اسم مستخدم المسؤول غير صحيح.');return;
 }
 const password=$('glAdminPassword').value;
 if(!password)return;
 busy=true;$('glAdminSubmit').disabled=true;$('glAdminStatus').textContent=translated('Checking Firebase account and role…','جارٍ التحقق من حساب فايربيس والصلاحيات…');
 try{
  await setPersistence(auth,browserSessionPersistence);
  const signed=await signInWithEmailAndPassword(auth,ADMIN_IDENTITY.firebaseEmail,password);
  const profile=await getDoc(doc(db,'userProfiles',signed.user.uid));
  const p=profile.exists()?profile.data():null;
  if(!p||p.active!==true||p.role!=='study_oversight'||p.username!==ADMIN_IDENTITY.username){
   await signOut(auth);throw Error('ROLE_MISMATCH');
  }
  busy=false;closeAdmin();
  window.dispatchEvent(new CustomEvent('glenpa:admin-authorized',{detail:{uid:signed.user.uid}}));
 }catch(err){
  $('glAdminStatus').textContent=err.message==='ROLE_MISMATCH'?
   translated('This Firebase account lacks an approved MSL role.','هذا الحساب ليس مخوّلًا بصلاحيات مسؤول الدراسة.'):
   translated('Sign-in failed. Use the password of your existing Firebase administrator account.','تعذّر تسجيل الدخول. استخدم كلمة مرور حساب الأدمن الذي أنشأته في فايربيس.');
 }finally{busy=false;$('glAdminSubmit').disabled=false}
});
const brand=document.querySelector('header .brand');
if(brand){
 brand.classList.add('gl-brand-trigger');brand.setAttribute('tabindex','0');brand.setAttribute('role','button');brand.setAttribute('aria-label','GLENPA REAL');
 function trigger(){const now=Date.now();if(now-firstClick>4500){clicks=0;firstClick=now}clicks++;if(clicks>=5){clicks=0;firstClick=0;openAdmin()}}
 brand.addEventListener('click',trigger);
 brand.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();trigger()}});
}
window.GLENPA_AUTH={signOutAdmin:()=>signOut(auth)};
