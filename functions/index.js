'use strict';
/* GLENPA REAL study API. Firestore access is ONLY through the Admin SDK.
 * Account and clinic roles are enforced on every request, not in browser JS. */
const express = require('express');
const crypto = require('node:crypto');
const admin = require('firebase-admin');
const {onRequest} = require('firebase-functions/v2/https');
const {defineSecret} = require('firebase-functions/params');
admin.initializeApp();
const db = admin.firestore();
const BOOTSTRAP_KEY = defineSecret('GLENPA_BOOTSTRAP_KEY');
const app = express();
const ORIGIN = 'https://medical-dad.github.io';
const ITERATIONS = 150000;
const SESSION_MAX = 12 * 60 * 60 * 1000;
const REMEMBER_MAX = 30 * 24 * 60 * 60 * 1000;
const MAX_PATIENTS = 2500;
const NOW = () => Date.now();
const fail = (status, message) => Object.assign(new Error(message), {status});
const cleanName = s => String(s || '').trim().toLowerCase();
const validName = s => /^[a-z0-9._-]{3,40}$/.test(s);
const validClinic = s => /^clinic(0[1-9]|1[0-9]|2[0-6])$/.test(s);
const validPassword = s => typeof s === 'string' && s.length >= 14 && s.length <= 128;
const ownKeys = (x, fields) => x && typeof x === 'object' && !Array.isArray(x) && Object.keys(x).every(k => fields.includes(k));
const safeUser = (id, d) => ({
  id, username:d.username, role:d.role, clinicCode:d.clinicCode || '',
  active:d.active === true, displayName:d.displayName || d.username,
  createdAt: d.createdAt || null
});
function timingEqual(a,b){
 const lhs=Buffer.from(String(a||''),'utf8'),rhs=Buffer.from(String(b||''),'utf8');
 return lhs.length === rhs.length && crypto.timingSafeEqual(lhs,rhs);
}
function passwordHash(secret,salt){
 return crypto.pbkdf2Sync(secret,Buffer.from(salt,'hex'),ITERATIONS,32,'sha256').toString('hex');
}
function makePassword(secret){
 const passwordSalt=crypto.randomBytes(16).toString('hex');
 return {passwordSalt,passwordHash:passwordHash(secret,passwordSalt),passwordIterations:ITERATIONS,passwordAlgorithm:'PBKDF2-SHA256'};
}
function checkPassword(secret,user){
 if(!/^[0-9a-f]{32}$/.test(user.passwordSalt||'')||!/^[0-9a-f]{64}$/.test(user.passwordHash||'')||user.passwordIterations!==ITERATIONS)return false;
 return timingEqual(passwordHash(secret,user.passwordSalt),user.passwordHash);
}
function dateField(input){return typeof input==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(input)&&!Number.isNaN(Date.parse(input+'T12:00:00Z'));}
function toJson(value){
 if(value && typeof value.toDate==='function')return value.toDate().toISOString();
 if(Array.isArray(value))return value.map(toJson);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,toJson(v)]));
 return value;
}
const originAllowed = origin => !origin || origin===ORIGIN;
app.disable('x-powered-by');
app.use((req,res,next)=>{
 res.set('Cache-Control','no-store').set('X-Content-Type-Options','nosniff').set('Referrer-Policy','no-referrer');
 const origin=req.headers.origin;
 if(!originAllowed(origin))return res.status(403).json({error:'Origin is not allowed'});
 if(origin){res.set('Access-Control-Allow-Origin',ORIGIN).set('Vary','Origin');}
 res.set('Access-Control-Allow-Headers','Content-Type, Authorization').set('Access-Control-Allow-Methods','GET,POST,PUT,PATCH,DELETE,OPTIONS');
 if(req.method==='OPTIONS')return res.status(204).end();
 next();
});
app.use(express.json({limit:'40kb'}));
const asyncRoute = fn => (req,res,next)=>Promise.resolve(fn(req,res)).catch(next);
async function audit(action,userId,target){
 try{await db.collection('_studyAudit').add({action,userId:userId||null,target:target||null,at:admin.firestore.FieldValue.serverTimestamp()})}
 catch(e){console.error('Audit log unavailable',action,e.code||e.message)}
}
async function findUser(username){
 const result=await db.collection('userProfiles').where('username','==',username).limit(2).get();
 if(result.size!==1)return null;
 return result.docs[0];
}
async function checkThrottle(username,ip){
 const now=NOW(),id=crypto.createHash('sha256').update(username+'|'+ip).digest('hex');
 const doc=db.collection('_studyLoginAttempts').doc(id),snap=await doc.get();
 const d=snap.data()||{};
 if(d.until&&d.until>now)throw fail(429,'Too many attempts. Try again later.');
 return {ref:doc,data:d};
}
async function recordFailure(ref,d){
 const now=NOW(),count=(d.windowStart&&now-d.windowStart<900000?d.count||0:0)+1;
 await ref.set({count,windowStart: d.windowStart&&now-d.windowStart<900000?d.windowStart:now,until: count>=5?now+900000:0});
}
async function authorize(req,res,next){
 try{
  const match=String(req.headers.authorization||'').match(/^Bearer ([a-f0-9]{64})$/);
  if(!match)throw fail(401,'Please sign in.');
  const tokenHash=crypto.createHash('sha256').update(match[1]).digest('hex');
  const sessionSnap=await db.collection('_studySessions').doc(tokenHash).get();
  if(!sessionSnap.exists)throw fail(401,'Session has expired.');
  const session=sessionSnap.data();
  if(session.expiresAt<=NOW())throw fail(401,'Session has expired.');
  const doc=await db.collection('userProfiles').doc(session.uid).get();
  if(!doc.exists)throw fail(401,'Account is unavailable.');
  const profile=doc.data();
  if(profile.active!==true||!['clinic','study_oversight'].includes(profile.role)||profile.sessionVersion!==session.version&&!(profile.sessionVersion==null&&session.version===0))throw fail(401,'Account is disabled or session revoked.');
  if(profile.role==='clinic'&&!validClinic(profile.clinicCode))throw fail(403,'Clinic assignment invalid.');
  req.actor={id:doc.id,...profile};req.sessionHash=tokenHash;
  next();
 }catch(err){next(err)}
}
function needAdmin(req){if(req.actor.role!=='study_oversight')throw fail(403,'Administrator role required.')}
function needClinic(req){if(req.actor.role!=='clinic')throw fail(403,'Clinic role required.')}
async function getPatient(req,patientId){
 const doc=await db.collection('patients').doc(patientId).get();
 if(!doc.exists)throw fail(404,'Patient record not found.');
 const value=doc.data();
 if(req.actor.role==='clinic'&&value.clinicCode!==req.actor.clinicCode)throw fail(403,'Clinic access denied.');
 return {ref:doc.ref,data:value};
}
function snapItem(s){return {id:s.id,data:toJson(s.data())};}
function rows(s){return {rows:s.docs.map(snapItem)}}
function profileSnapshot(s){return {id:s.id,data:toJson(safeUser(s.id,s.data()))}}
app.get('/health',(_req,res)=>res.json({ok:true,service:'glenpa-study-api',auth:'username-password-server'}));
app.get('/directory',asyncRoute(async(_req,res)=>{
 const result=await db.collection('userProfiles').where('active','==',true).limit(200).get();
 res.json({users:result.docs.filter(d=>d.data().passwordHash&&validName(d.data().username)).map(d=>safeUser(d.id,d.data()))});
}));
app.post('/bootstrap',asyncRoute(async(req,res)=>{
 const secret=BOOTSTRAP_KEY.value();
 if(!secret||!timingEqual(req.body?.setupKey,secret))throw fail(403,'Invalid setup key.');
 const password=req.body?.password;
 if(!validPassword(password))throw fail(400,'Admin password must be 14–128 characters.');
 const snap=await findUser('msl.admin');
 if(!snap)throw fail(409,'The existing msl.admin profile must exist uniquely in userProfiles.');
 const d=snap.data();
 if(d.role!=='study_oversight')throw fail(403,'The account is not the study administrator.');
 if(d.passwordHash)throw fail(409,'Administrator is already configured.');
 await snap.ref.update({...makePassword(password),active:true,sessionVersion:0,updatedAt:admin.firestore.FieldValue.serverTimestamp()});
 await audit('admin.bootstrap',snap.id,'msl.admin');
 res.status(201).json({ok:true,username:'msl.admin'});
}));
app.post('/session',asyncRoute(async(req,res)=>{
 const username=cleanName(req.body?.username),password=req.body?.password;
 if(!validName(username)||typeof password!=='string'||password.length>128)throw fail(401,'Invalid username or password.');
 const throttled=await checkThrottle(username,req.ip||'unknown');
 const snap=await findUser(username);
 const match=snap&&snap.data().active===true&&checkPassword(password,snap.data());
 if(!match){await recordFailure(throttled.ref,throttled.data);throw fail(401,'Invalid username or password.')}
 await throttled.ref.delete().catch(()=>{});
 const token=crypto.randomBytes(32).toString('hex'),hashed=crypto.createHash('sha256').update(token).digest('hex');
 const ttl=req.body?.remember===true?REMEMBER_MAX:SESSION_MAX;
 await db.collection('_studySessions').doc(hashed).set({
  uid:snap.id,version:snap.data().sessionVersion||0,
  createdAt:admin.firestore.FieldValue.serverTimestamp(),expiresAt:NOW()+ttl
 });
 await audit('session.login',snap.id,null);
 res.json({token,expiresAt:NOW()+ttl,uid:snap.id,profile:safeUser(snap.id,snap.data())});
}));
app.get('/session',authorize,(req,res)=>res.json({uid:req.actor.id,profile:safeUser(req.actor.id,req.actor),ok:true}));
app.delete('/session',authorize,asyncRoute(async(req,res)=>{
 await db.collection('_studySessions').doc(req.sessionHash).delete();res.json({ok:true});
}));
app.use('/data',authorize);
app.use('/users',authorize);
app.get('/data/clinics',asyncRoute(async(req,res)=>{
 if(req.actor.role==='clinic'){const s=await db.collection('clinics').doc(req.actor.clinicCode).get();return res.json({rows:s.exists?[snapItem(s)]:[]})}
 res.json(rows(await db.collection('clinics').limit(200).get()));
}));
app.get('/data/clinics/:id',asyncRoute(async(req,res)=>{
 if(req.actor.role==='clinic'&&req.actor.clinicCode!==req.params.id)throw fail(403,'Clinic access denied.');
 const doc=await db.collection('clinics').doc(req.params.id).get();
 res.json({row:doc.exists?snapItem(doc):null});
}));
app.patch('/data/clinics/:id',asyncRoute(async(req,res)=>{
 needAdmin(req);
 const {id}=req.params,b=req.body;
 if(!validClinic(id)||!ownKeys(b,['doctorName','specialty','area'])||!['doctorName','specialty','area'].every(k=>typeof b[k]==='string'&&b[k].trim()&&b[k].length<101))throw fail(400,'Invalid clinic update.');
 const ref=db.collection('clinics').doc(id);
 if(!(await ref.get()).exists)throw fail(404,'Unknown clinic.');
 await ref.update({doctorName:b.doctorName.slice(0,100),specialty:b.specialty.slice(0,80),area:b.area.slice(0,80)});
 await audit('clinic.update',req.actor.id,id);res.json({ok:true});
}));
app.get('/data/patients',asyncRoute(async(req,res)=>{
 const col=db.collection('patients');
 const q=req.actor.role==='clinic'?col.where('clinicCode','==',req.actor.clinicCode):col;
 res.json(rows(await q.limit(MAX_PATIENTS).get()));
}));
app.get('/data/patients/:id',asyncRoute(async(req,res)=>{
 const p=await getPatient(req,req.params.id);res.json({row:{id:p.ref.id,data:toJson(p.data)}});
}));
app.post('/data/patients/:id',asyncRoute(async(req,res)=>{
 needClinic(req);
 const b=req.body,id=req.params.id;
 const settings=await db.collection('siteSettings').doc('main').get();
 if(!settings.exists||settings.data().enrollmentEnabled!==true)throw fail(403,'Study enrollment is disabled.');
 if(!ownKeys(b,['clinicCode','patientCode','age','sex','diabetesYears','createdBy','createdAt'])||
 b.clinicCode!==req.actor.clinicCode||!/^[A-Z0-9_-]{3,24}$/.test(b.patientCode||'')||
 id!==req.actor.clinicCode+'_'+b.patientCode||!Number.isInteger(b.age)||b.age<18||b.age>110||
 !['Male','Female'].includes(b.sex)||typeof b.diabetesYears!=='number'||b.diabetesYears<0||b.diabetesYears>100)throw fail(400,'Invalid coded patient record.');
 const ref=db.collection('patients').doc(id);
 await ref.create({clinicCode:req.actor.clinicCode,patientCode:b.patientCode,age:b.age,sex:b.sex,diabetesYears:b.diabetesYears,createdBy:req.actor.id,createdAt:admin.firestore.FieldValue.serverTimestamp()}).catch(err=>{if(err.code===6)throw fail(409,'Study ID already exists.');throw err});
 await audit('patient.create',req.actor.id,id);res.status(201).json({ok:true});
}));
app.get('/data/patients/:id/visits',asyncRoute(async(req,res)=>{
 await getPatient(req,req.params.id);
 res.json(rows(await db.collection('patients').doc(req.params.id).collection('visits').limit(3).get()));
}));
app.get('/data/patients/:id/visits/:phase',asyncRoute(async(req,res)=>{
 await getPatient(req,req.params.id);
 const doc=await db.collection('patients').doc(req.params.id).collection('visits').doc(req.params.phase).get();
 res.json({row:doc.exists?snapItem(doc):null});
}));
app.post('/data/patients/:id/visits/:phase',asyncRoute(async(req,res)=>{
 needClinic(req);
 const patient=await getPatient(req,req.params.id),phase=req.params.phase,b=req.body;
 if(!['baseline','month3','month6'].includes(phase))throw fail(400,'Invalid visit phase.');
 const permitted=['phase','date','hba1c','fpg','egfr','weight','dose','adverseEvent','medicationChanges','notes','updatedBy','updatedAt'];
 if(!ownKeys(b,permitted)||b.phase!==phase||!dateField(b.date)||
 typeof b.hba1c!=='number'||b.hba1c<3||b.hba1c>20||
 typeof b.fpg!=='number'||b.fpg<30||b.fpg>1000||
 (b.egfr!=null&&(typeof b.egfr!=='number'||b.egfr<0||b.egfr>200))||
 (b.weight!=null&&(typeof b.weight!=='number'||b.weight<1||b.weight>400))||
 !['10/5 mg','25/5 mg'].includes(b.dose)||
 !['adverseEvent','medicationChanges','notes'].every(k=>typeof b[k]==='string'&&b[k].length<=400)
 )throw fail(400,'Invalid clinical visit values.');
 const path=patient.ref.collection('visits'),predecessor=phase==='month6'?'month3':phase==='month3'?'baseline':null;
 if(predecessor){
  const earlier=await path.doc(predecessor).get();
  if(!earlier.exists)throw fail(409,'Previous scheduled visit must be recorded first.');
  const earliest=new Date(earlier.data().date+'T12:00:00Z');earliest.setUTCMonth(earliest.getUTCMonth()+3);
  if(b.date<earliest.toISOString().slice(0,10))throw fail(409,'Visits must be separated by 3 calendar months.');
 }
 await path.doc(phase).create({phase,date:b.date,hba1c:b.hba1c,fpg:b.fpg,egfr:b.egfr??null,weight:b.weight??null,
  dose:b.dose,adverseEvent:b.adverseEvent,medicationChanges:b.medicationChanges,notes:b.notes,updatedBy:req.actor.id,updatedAt:admin.firestore.FieldValue.serverTimestamp()})
 .catch(err=>{if(err.code===6)throw fail(409,'Visit already recorded.');throw err});
 await audit('visit.create',req.actor.id,req.params.id+':'+phase);
 res.status(201).json({ok:true});
}));
app.get('/data/siteSettings/main',asyncRoute(async(req,res)=>{
 const snap=await db.collection('siteSettings').doc('main').get();
 res.json({row:snap.exists?snapItem(snap):null});
}));
app.put('/data/siteSettings/main',asyncRoute(async(req,res)=>{
 needAdmin(req);const b=req.body;
 if(!ownKeys(b,['studyTitle','enrollmentEnabled','updatedBy','updatedAt'])||typeof b.studyTitle!=='string'||b.studyTitle.length>90||typeof b.enrollmentEnabled!=='boolean')throw fail(400,'Invalid study settings.');
 await db.collection('siteSettings').doc('main').set({
  studyTitle:b.studyTitle,enrollmentEnabled:b.enrollmentEnabled,updatedBy:req.actor.id,updatedAt:admin.firestore.FieldValue.serverTimestamp()
 },{merge:true});
 await audit('settings.update',req.actor.id,'main');res.json({ok:true});
}));
app.get('/data/userProfiles',asyncRoute(async(req,res)=>{
 needAdmin(req);const result=await db.collection('userProfiles').limit(200).get();res.json({rows:result.docs.map(profileSnapshot)});
}));
app.get('/data/userProfiles/:id',asyncRoute(async(req,res)=>{
 if(req.actor.role!=='study_oversight'&&req.params.id!==req.actor.id)throw fail(403,'User access denied.');
 const snap=await db.collection('userProfiles').doc(req.params.id).get();
 res.json({row:snap.exists?profileSnapshot(snap):null});
}));
app.patch('/data/userProfiles/:id',asyncRoute(async(req,res)=>{
 needAdmin(req);if(req.params.id===req.actor.id)throw fail(400,'You cannot disable your own administrator account.');
 if(!ownKeys(req.body,['active'])||typeof req.body.active!=='boolean')throw fail(400,'Invalid account status.');
 const ref=db.collection('userProfiles').doc(req.params.id);
 if(!(await ref.get()).exists)throw fail(404,'Unknown user.');
 await ref.update({active:req.body.active});
 await audit('user.status',req.actor.id,req.params.id);res.json({ok:true});
}));
app.post('/users',asyncRoute(async(req,res)=>{
 needAdmin(req);
 const b=req.body,username=cleanName(b?.username),password=b?.password,clinicCode=b?.clinicCode;
 if(!ownKeys(b,['username','password','clinicCode','displayName'])||!validName(username)||username==='msl.admin'||!validPassword(password)||!validClinic(clinicCode))throw fail(400,'Invalid account details.');
 if(!(await db.collection('clinics').doc(clinicCode).get()).exists)throw fail(400,'Clinic not found.');
 const id=crypto.randomUUID(),ref=db.collection('userProfiles').doc(id),handle=db.collection('loginHandles').doc(username);
 await db.runTransaction(async trx=>{
  const existing=await trx.get(handle);
  const dupe=await trx.get(db.collection('userProfiles').where('username','==',username).limit(1));
  if(existing.exists||!dupe.empty)throw fail(409,'Username already exists.');
  trx.create(handle,{userUid:id});
  trx.create(ref,{username,role:'clinic',clinicCode,displayName:String(b.displayName||username).slice(0,80),active:true,...makePassword(password),
   sessionVersion:0,createdBy:req.actor.id,createdAt:admin.firestore.FieldValue.serverTimestamp()});
 });
 await audit('user.create',req.actor.id,id);res.status(201).json({ok:true,id});
}));
app.put('/users/:id/password',asyncRoute(async(req,res)=>{
 needAdmin(req);const password=req.body?.password;
 if(!validPassword(password))throw fail(400,'Password must be 14–128 characters.');
 const ref=db.collection('userProfiles').doc(req.params.id);
 if(!(await ref.get()).exists)throw fail(404,'Unknown account.');
 await ref.update({...makePassword(password),sessionVersion:admin.firestore.FieldValue.increment(1),updatedAt:admin.firestore.FieldValue.serverTimestamp()});
 await audit('password.rotate',req.actor.id,req.params.id);res.json({ok:true});
}));
app.use((err,req,res,_next)=>{
 const status=Number(err.status)||500;
 if(status>=500)console.error('GLENPA API request failed',req.method,req.path,err.code||err.message);
 res.status(status).json({error:status>=500?'Server operation failed.':err.message,code:err.code||'request-error'});
});
exports.studyApi = onRequest({region:'us-central1',cors:false,secrets:[BOOTSTRAP_KEY],maxInstances:5,timeoutSeconds:60,memory:'512MiB'},app);
