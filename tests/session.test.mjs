import test from 'node:test';
import assert from 'node:assert/strict';
const storage=()=>{const data=new Map();return {getItem:key=>data.get(key)||null,setItem:(key,val)=>data.set(key,String(val)),removeItem:key=>data.delete(key),get length(){return data.size}}};
globalThis.sessionStorage=storage();globalThis.localStorage=storage();
const calls=[];
globalThis.fetch=async(url,opt)=>{
 calls.push({url,method:opt.method,headers:opt.headers,body:opt.body});
 const data=url.endsWith('/session')&&opt.method==='POST'
  ?{uid:'u123',token:'a'.repeat(64),expiresAt:Date.now()+3600000,profile:{role:'study_oversight',username:'msl.admin'}}
  :url.endsWith('/session')&&opt.method==='DELETE'?{ok:true}
  :url.endsWith('/data/userProfiles/u123')?{row:{id:'u123',data:{username:'msl.admin',active:true,role:'study_oversight'}}}
  :{ok:true,uid:'u123',profile:{role:'study_oversight'}};
 return {ok:true,status:200,json:async()=>data};
};
const api=await import('../secure-api.js');
test('username and password login uses backend session and not Firebase Auth',async()=>{
 let user=null;await api.initializeSession(u=>{user=u});
 assert.equal(user,null);
 await api.startSession('msl.admin','a-long-strong-password',false);
 assert.equal(user.uid,'u123');
 assert.ok(sessionStorage.getItem('glenpa-secure-session-v1'));
 assert.equal(localStorage.getItem('glenpa-secure-session-v1'),null);
 assert.ok(calls.some(c=>c.url.endsWith('/session')&&c.method==='POST'));
 const snap=await api.getDoc(api.doc(api.db,'userProfiles','u123'));
 assert.equal(snap.data().role,'study_oversight');
 assert.ok(calls.some(c=>c.headers.Authorization==='Bearer '+'a'.repeat(64)));
 await api.endSession();
 assert.equal(user,null);assert.equal(sessionStorage.getItem('glenpa-secure-session-v1'),null);
});
test('Remember Me saves session token to localStorage and Logout removes it',async()=>{
 await api.startSession('clinic01','another-strong-password',true);
 assert.ok(localStorage.getItem('glenpa-secure-session-v1'));
 assert.equal(sessionStorage.getItem('glenpa-secure-session-v1'),null);
 await api.endSession();
 assert.equal(localStorage.getItem('glenpa-secure-session-v1'),null);
});
