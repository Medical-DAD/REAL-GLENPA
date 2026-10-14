
import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut, setPersistence, browserSessionPersistence } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-staging/firebase-config.js';
const app=getApps().length?getApp():initializeApp(firebaseConfig);
const auth=getAuth(app), db=getFirestore(app);
const $=id=>document.getElementById(id);
const knownEmailKey='glenpa-msl-account-email-v1';
let lastFocus=null,clicks=0,firstClick=0,busy=false,linking=false;
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
'<form id="glAdminForm">',
'<label class="gl-input-label gl-admin-user-field"><span id="glAdminUsernameLabel"></span><input id="glAdminUsername" value="msl.admin" type="text" readonly aria-readonly="true" autocomplete="off"></label>',
'<div class="gl-admin-email-step" id="glAdminEmailExplanation" hidden></div>',
'<div id="glAdminLinkArea" hidden><label class="gl-input-label" id="glAdminEmailWrap"><span id="glAdminEmailLabel"></span>',
'<input type="email" id="glAdminEmail" autocomplete="email" inputmode="email" placeholder="your.account@example.com"></label></div>',
'<label class="gl-input-label"><span id="glAdminPasswordLabel"></span>',
'<input id="glAdminPassword" type="password" required autocomplete="current-password"></label>',
'<button class="gl-login-cta" type="submit" id="glAdminSubmit"></button>',
'<p class="gl-login-status" id="glAdminStatus" aria-live="polite"></p></form>',
'<button type="button" id="glAdminChangeEmail" style="padding:4px;border:0;background:none;color:var(--primary);font-size:12px;text-decoration:underline"></button>',
'</section>'].join('');
document.body.appendChild(modal);
function renderModal(){
 const alreadyLinked=Boolean(knownEmail());
 $('glAdminTitle').textContent=translated('Administrator access','الدخول إلى لوحة المسؤول');
 $('glAdminIntro').textContent=translated('Secure access to your MSL dashboard.','دخول آمن إلى لوحة مسؤول الدراسة.');
 $('glAdminUsernameLabel').textContent=translated('Username','اسم المستخدم');
 $('glAdminUsername').value='msl.admin';
 $('glAdminLinkArea').hidden=!linking;
 $('glAdminEmail').required=linking;
 $('glAdminEmailExplanation').hidden=alreadyLinked||linking;
 $('glAdminEmailExplanation').textContent=translated('On this device, link your existing Firebase administrator account once. Your username is msl.admin; the email is used internally by Firebase only.','على هذا الجهاز فقط، اربط حساب الأدمن الموجود في فايربيس لمرة واحدة. اسم المستخدم هو msl.admin، والبريد يُستخدم داخليًا للمصادقة فقط.');
 $('glAdminEmailLabel').textContent=translated('Existing Firebase account email (one-time setup)','البريد المرتبط بحساب فايربيس (إعداد لمرة واحدة)');
 $('glAdminPasswordLabel').textContent=translated('Administrator password','كلمة مرور المسؤول');
 $('glAdminSubmit').textContent=translated('Access dashboard →','الدخول إلى لوحة المسؤول ←');
 $('glAdminChangeEmail').textContent=linking?translated('Hide setup','إخفاء الإعداد'):(alreadyLinked?translated('Change linked account','تغيير ربط الحساب'):translated('Link Firebase account once','ربط حساب فايربيس لمرة واحدة'));
 $('glAdminStatus').textContent='';
}
function openAdmin(){lastFocus=document.activeElement;linking=false;renderModal();modal.classList.add('open');modal.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';$('glAdminPassword').focus()}
function closeAdmin(){if(busy)return;modal.classList.remove('open');modal.setAttribute('aria-hidden','true');document.body.style.overflow='';$('glAdminPassword').value='';lastFocus?.focus?.()}
$('glAdminClose').addEventListener('click',closeAdmin);
modal.addEventListener('click',e=>{if(e.target===modal)closeAdmin()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal.classList.contains('open'))closeAdmin()});
$('glAdminChangeEmail').addEventListener('click',()=>{linking=!linking;renderModal();(linking?$('glAdminEmail'):$('glAdminPassword')).focus()});
$('glAdminForm').addEventListener('submit',async e=>{
 e.preventDefault();if(busy)return;
 if($('glAdminUsername').value.trim().toLowerCase()!=='msl.admin'){$('glAdminStatus').textContent=translated('Use your administrator username: msl.admin','استخدم اسم الأدمن: msl.admin');return}
 const email=linking?$('glAdminEmail').value.trim():knownEmail();
 const password=$('glAdminPassword').value;
 if(!password)return;
 if(!email){linking=true;renderModal();$('glAdminStatus').textContent=translated('Please link the Firebase email once before signing in.','يرجى ربط بريد حساب فايربيس لمرة واحدة قبل تسجيل الدخول.');$('glAdminEmail').focus();return;}
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){$('glAdminStatus').textContent=translated('Enter the email of the Firebase account you already created.','أدخل بريد حساب فايربيس الذي أنشأته سابقًا.');return}
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
