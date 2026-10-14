
import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut, setPersistence, browserSessionPersistence } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-staging/firebase-config.js';
const app=getApps().length?getApp():initializeApp(firebaseConfig);
const auth=getAuth(app), db=getFirestore(app);
const $=id=>document.getElementById(id);
const knownEmailKey='glenpa-msl-account-email-v1';
let lastFocus=null,clicks=0,firstClick=0,busy=false;
const ar=()=>document.documentElement.lang==='ar';
const translated=(en,arabic)=>ar()?arabic:en;
function knownEmail(){try{return localStorage.getItem(knownEmailKey)||''}catch{return ''}}
function rememberEmail(email){try{localStorage.setItem(knownEmailKey,email)}catch{}}
function forgetEmail(){try{localStorage.removeItem(knownEmailKey)}catch{}}
const modal=document.createElement('div');
modal.className='gl-admin-overlay';modal.id='glAdminOverlay';modal.setAttribute('aria-hidden','true');
modal.innerHTML=[
'<section class="gl-admin-modal" role="dialog" aria-modal="true" aria-labelledby="glAdminTitle">',
'<button type="button" class="gl-admin-x" id="glAdminClose" aria-label="Close">×</button>',
'<div class="gl-admin-sign" aria-hidden="true">✦</div>',
'<span class="gl-login-kicker"><span class="gl-login-dot"></span> GLENPA REAL · PRIVATE ACCESS</span>',
'<h2 id="glAdminTitle"></h2><p class="gl-login-desc" id="glAdminIntro"></p>',
'<form id="glAdminForm"><div class="gl-admin-email-step" id="glAdminEmailExplanation"></div>',
'<label class="gl-input-label" id="glAdminEmailWrap"><span id="glAdminEmailLabel"></span>',
'<input type="email" id="glAdminEmail" required autocomplete="username" inputmode="email" placeholder="your.account@example.com"></label>',
'<label class="gl-input-label"><span id="glAdminPasswordLabel"></span>',
'<input id="glAdminPassword" type="password" required autocomplete="current-password"></label>',
'<button class="gl-login-cta" type="submit" id="glAdminSubmit"></button>',
'<p class="gl-login-status" id="glAdminStatus" aria-live="polite"></p></form>',
'<button type="button" id="glAdminChangeEmail" style="padding:4px;border:0;background:none;color:var(--primary);font-size:12px;text-decoration:underline"></button>',
'</section>'].join('');
document.body.appendChild(modal);
function renderModal(){
 const email=knownEmail(),needs=email.length===0;
 $('glAdminTitle').textContent=translated('Administrator access','الدخول إلى لوحة المسؤول');
 $('glAdminIntro').textContent=translated('Sign in securely with your existing Firebase MSL account.','سجّل الدخول بأمان باستخدام حساب MSL الموجود في فايربيس.');
 $('glAdminEmailWrap').hidden=!needs;
 $('glAdminEmail').required=needs;
 $('glAdminEmailExplanation').hidden=!needs;
 $('glAdminEmailExplanation').textContent=translated('First time only: enter your existing Firebase administrator email. This browser remembers the email, never your password.','للمرة الأولى فقط: أدخل بريد حساب الأدمن الموجود في فايربيس. يتذكر هذا المتصفح البريد فقط، وليس كلمة المرور.');
 $('glAdminEmailLabel').textContent=translated('Firebase administrator email (first time only)','بريد حساب الأدمن في فايربيس (للمرة الأولى فقط)');
 $('glAdminPasswordLabel').textContent=translated('Administrator password','كلمة مرور المسؤول');
 $('glAdminSubmit').textContent=translated('Access dashboard →','الدخول إلى لوحة المسؤول ←');
 $('glAdminChangeEmail').textContent=needs?'':translated('Use another Firebase account','استخدام حساب فايربيس آخر');
 $('glAdminChangeEmail').hidden=needs;
 $('glAdminStatus').textContent='';
}
function openAdmin(){lastFocus=document.activeElement;renderModal();modal.classList.add('open');modal.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';(knownEmail()?$('glAdminPassword'):$('glAdminEmail')).focus()}
function closeAdmin(){if(busy)return;modal.classList.remove('open');modal.setAttribute('aria-hidden','true');document.body.style.overflow='';$('glAdminPassword').value='';lastFocus?.focus?.()}
$('glAdminClose').addEventListener('click',closeAdmin);
modal.addEventListener('click',e=>{if(e.target===modal)closeAdmin()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal.classList.contains('open'))closeAdmin()});
$('glAdminChangeEmail').addEventListener('click',()=>{forgetEmail();renderModal();$('glAdminEmail').focus()});
$('glAdminForm').addEventListener('submit',async e=>{
 e.preventDefault();if(busy)return;
 const email=knownEmail()||$('glAdminEmail').value.trim();
 const password=$('glAdminPassword').value;
 if(!email||!password)return;
 busy=true;$('glAdminSubmit').disabled=true;$('glAdminStatus').textContent=translated('Checking Firebase account and role…','جارٍ التحقق من حساب فايربيس والصلاحيات…');
 try{
  await setPersistence(auth,browserSessionPersistence);
  const signed=await signInWithEmailAndPassword(auth,email,password);
  const profile=await getDoc(doc(db,'userProfiles',signed.user.uid));
  const p=profile.exists()?profile.data():null;
  if(!p||p.active!==true||p.role!=='study_oversight'||p.username!=='msl.admin'){
   await signOut(auth);throw Error('ROLE_MISMATCH');
  }
  rememberEmail(email);
  busy=false;closeAdmin();
  window.dispatchEvent(new CustomEvent('glenpa:admin-authorized',{detail:{uid:signed.user.uid}}));
 }catch(err){
  $('glAdminStatus').textContent=err.message==='ROLE_MISMATCH'?
   translated('This Firebase account lacks an approved MSL role.','هذا الحساب ليس مخوّلًا بصلاحيات مسؤول الدراسة.'):
   translated('Sign-in failed. Verify your password and Firebase authorized domains.','تعذّر تسجيل الدخول. تحقق من كلمة المرور والنطاقات المصرّح بها في فايربيس.');
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
