/* GLENPA REAL secure API client.
 * No Firebase Authentication and no direct browser access to Firestore.
 * The server validates every role and clinic, regardless of browser session fields.
 */
export const API_URL='https://us-central1-glenpa-real.cloudfunctions.net/studyApi';
const SESSION_KEY='glenpa-secure-session-v1';
let token=null,user=null,profileBrief=null,expiration=0,remember=false,initialized=false;
let observer=null;
function readStored(){
 for(const storage of [sessionStorage,localStorage]){
  try{const data=JSON.parse(storage.getItem(SESSION_KEY)||'null');
   if(data?.token&&typeof data.expiresAt==='number'&&data.expiresAt>Date.now())return {...data,persistent:storage===localStorage};
  }catch(e){}
 }
 return null;
}
function removeSaved(){
 for(const storage of [sessionStorage,localStorage])try{storage.removeItem(SESSION_KEY)}catch(e){}
}
function persist(){
 removeSaved();
 if(!token)return;
 try{(remember?localStorage:sessionStorage).setItem(SESSION_KEY,JSON.stringify({token,expiresAt:expiration,uid:profileBrief?.uid||null,username:profileBrief?.username||'',role:profileBrief?.role||''}))}catch(e){}
}
function setIdentity(identity){
 user=identity?.uid?{uid:identity.uid}:null;
 profileBrief=user?{uid:identity.uid,username:identity.profile?.username||'',role:identity.profile?.role||''}:null;
 if(observer)observer(user);
}
function clear(){token=null;expiration=0;remember=false;removeSaved();setIdentity(null)}
async function call(path,{method='GET',body,authRequired=true}={}){
 if(authRequired&&(!token||expiration<=Date.now())){clear();throw Object.assign(new Error('Session expired. Please sign in again.'),{code:'api/unauthorized'})}
 const headers={'Accept':'application/json'};
 if(body!==undefined)headers['Content-Type']='application/json';
 if(authRequired)headers.Authorization='Bearer '+token;
 let response;
 try{response=await fetch(API_URL+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',mode:'cors'})}
 catch(e){throw Object.assign(new Error('Unable to reach the study server. Please check the connection and backend deployment.'),{code:'api/unavailable'})}
 const data=await response.json().catch(()=>({error:'Unexpected response from study server'}));
 if(!response.ok){
  if(authRequired&&response.status===401)clear();
  throw Object.assign(new Error(data.error||'Server operation failed'),{code:'api/'+response.status,status:response.status});
 }
 return data;
}
export async function initializeSession(callback){
 observer=callback;
 if(initialized){observer(user);return}
 initialized=true;const saved=readStored();
 if(!saved){setIdentity(null);return}
 token=saved.token;expiration=saved.expiresAt;remember=saved.persistent;
 try{const found=await call('/session');setIdentity(found)}
 catch(e){clear()}
}
export async function startSession(username,password,rememberMe=false){
 const data=await call('/session',{method:'POST',body:{username,password,remember:rememberMe},authRequired:false});
 token=data.token;expiration=data.expiresAt;remember=Boolean(rememberMe);setIdentity(data);persist();return data;
}
export async function endSession(){
 if(token)try{await call('/session',{method:'DELETE'})}catch(e){}
 clear();
}
export async function createClinicAccount(args){return call('/users',{method:'POST',body:args})}
export async function changeAccountPassword(id,password){return call('/users/'+encodeURIComponent(id)+'/password',{method:'PUT',body:{password}})}
export async function listDirectory(){const data=await call('/directory',{authRequired:false});return data.users||[]}
/* Minimal snapshots preserve the existing clinic/patient UI with no Firebase imports. */
export const db={};
export function doc(_db,...pieces){return {path:pieces.map(String).join('/')}}
export function collection(_db,...pieces){return {path:pieces.map(String).join('/')}}
export function where(field,operator,value){return {field,operator,value}}
export function query(col,filter){return {...col,filter}}
export function serverTimestamp(){return {__serverTime:true}}
function normalize(value){
 if(value&&typeof value==='object'&&!Array.isArray(value)){
  return Object.fromEntries(Object.entries(value).map(([key,val])=>[key,normalize(val)]));
 }
 if(Array.isArray(value))return value.map(normalize);
 return value;
}
function makeSnap(obj){
 const id=obj?.id||null;
 return {id,exists:()=>Boolean(obj),data:()=>obj?normalize(obj.data):undefined};
}
function urlFor(path){
 const chunks=path.split('/').map(encodeURIComponent);
 if(chunks[0]==='patients'&&chunks.length===4&&chunks[2]==='visits')
  return '/data/patients/'+chunks[1]+'/visits/'+chunks[3];
 if(chunks[0]==='patients'&&chunks.length===3&&chunks[2]==='visits')
  return '/data/patients/'+chunks[1]+'/visits';
 if(chunks.length===2&&['clinics','patients','siteSettings','userProfiles'].includes(chunks[0]))
  return '/data/'+chunks.join('/');
 if(chunks.length===1&&['clinics','patients','userProfiles'].includes(chunks[0]))
  return '/data/'+chunks[0];
 throw Object.assign(new Error('Unsupported secure database path: '+path),{code:'api/unsupported'});
}
export async function getDoc(reference){
 const data=await call(urlFor(reference.path));
 return makeSnap(data.row);
}
export async function getDocs(reference){
 const data=await call(urlFor(reference.path));
 return {docs:(data.rows||[]).map(makeSnap),empty:!(data.rows||[]).length};
}
export async function setDoc(reference,data){
 const chunks=reference.path.split('/');
 let method;
 if(chunks[0]==='patients'&&chunks.length===2)method='POST';
 else if(chunks[0]==='patients'&&chunks.length===4)method='POST';
 else if(chunks[0]==='siteSettings'&&chunks[1]==='main')method='PUT';
 else throw Object.assign(new Error('Unsupported write path'),{code:'api/unsupported'});
 return call(urlFor(reference.path),{method,body:data});
}
export async function updateDoc(reference,data){
 const chunks=reference.path.split('/');
 if(chunks.length!==2||!['clinics','userProfiles'].includes(chunks[0]))throw Object.assign(new Error('Unsupported update path'),{code:'api/unsupported'});
 return call(urlFor(reference.path),{method:'PATCH',body:data});
}
