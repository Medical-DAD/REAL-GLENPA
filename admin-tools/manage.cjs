#!/usr/bin/env node
'use strict';
/* GLENPA REAL: run locally, with a private service-account key NEVER uploaded to GitHub.
 * Commands: list | reset USERNAME | delete USERNAME
 */
const fs=require('node:fs');
const path=require('node:path');
const readline=require('node:readline');
const admin=require('firebase-admin');
const PROJECT='glenpa-real';
const USER=/^[a-z0-9._-]{3,40}$/;
const PIN=/^[0-9]{6,32}$/;

async function secretPrompt(label) {
 if(!process.stdin.isTTY||!process.stdout.isTTY)throw Error('Run in an interactive terminal; never pass a PIN as an argument.');
 process.stdout.write(label);
 return await new Promise((resolve,reject)=>{
  let value='';
  process.stdin.setRawMode(true);process.stdin.resume();process.stdin.setEncoding('utf8');
  function close(error) {
   process.stdin.removeListener('data',keyHandler);
   process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');
   if(error)reject(error);else resolve(value);
  }
  function keyHandler(key){
   if(key==='\u0003'||key==='\u0004'){close(Error('Cancelled'));return}
   if(key==='\r'||key==='\n'){close();return}
   if(key==='\u007f'||key==='\b'){if(value){value=value.slice(0,-1);process.stdout.write('\b \b')}return}
   if(/^[0-9]$/.test(key)&&value.length<32){value+=key;process.stdout.write('*')}
  }
  process.stdin.on('data',keyHandler);
 });
}
async function confirm(question){
 const rl=readline.createInterface({input:process.stdin,output:process.stdout});
 try{return await new Promise(done=>rl.question(question,done))}
 finally{rl.close()}
}
async function run(){
 const [action,username,...more]=process.argv.slice(2);
 if(more.length||!['list','reset','delete'].includes(action)||action!=='list'&&!username){
  throw Error('Usage: node manage.cjs list | reset USERNAME | delete USERNAME');
 }
 const keypath=process.env.GOOGLE_APPLICATION_CREDENTIALS;
 if(!keypath)throw Error('Set GOOGLE_APPLICATION_CREDENTIALS to your locally stored Firebase service-account JSON path.');
 const file=path.resolve(keypath);
 if(!fs.existsSync(file))throw Error('Service-account file not found.');
 const creds=JSON.parse(fs.readFileSync(file,'utf8'));
 if(creds.project_id!==PROJECT)throw Error('Wrong Firebase project. Expected '+PROJECT);
 if(!creds.private_key||!creds.client_email)throw Error('Invalid service-account key.');
 admin.initializeApp({credential:admin.credential.cert(creds),projectId:PROJECT});
 const db=admin.firestore(),auth=admin.auth();
 if(action==='list'){
  const query=await db.collection('userProfiles').limit(500).get();
  console.table(query.docs.map(doc=>{
   const p=doc.data();return {username:p.username||'?',role:p.role||'?',clinic:p.clinicCode||'—',active:p.active===true?'Yes':'No'};
  }).sort((a,b)=>a.username.localeCompare(b.username)));
  return;
 }
 const name=String(username).trim().toLowerCase();
 if(!USER.test(name))throw Error('Invalid username.');
 const query=await db.collection('userProfiles').where('username','==',name).limit(2).get();
 if(query.size!==1)throw Error('Username not found or not unique in userProfiles.');
 const doc=query.docs[0],profile=doc.data();
 if(action==='reset'){
  const pin=await secretPrompt('New numeric PIN (6-32 digits): ');
  if(!PIN.test(pin))throw Error('PIN must be 6 to 32 digits.');
  const second=await secretPrompt('Confirm new PIN: ');
  if(pin!==second)throw Error('PINs do not match. No changes made.');
  await auth.updateUser(doc.id,{password:pin});
  await auth.revokeRefreshTokens(doc.id);
  console.log('Password changed for '+name+'. Previously issued ID tokens can remain valid briefly.');
  return;
 }
 if(profile.role!=='clinic')throw Error('Only clinic accounts can be permanently deleted. Cannot delete administrator.');
 const answer=await confirm('Permanently delete '+name+'? Type DELETE '+name+': ');
 if(answer!=='DELETE '+name){console.log('Cancelled');return}
 // Block access before account deletion.
 await doc.ref.update({active:false});
 try{await auth.deleteUser(doc.id)}
 catch(e){if(e.code!=='auth/user-not-found')throw Error('Account disabled; Auth deletion failed: '+e.message)}
 const batch=db.batch();
 batch.delete(doc.ref);
 batch.delete(db.collection('loginHandles').doc(name));
 await batch.commit();
 console.log('Deleted '+name+' from Auth and Firestore directory. Existing coded study records were preserved.');
}
run().catch(e=>{console.error('Error: '+e.message);process.exitCode=1}).finally(async()=>{
 if(admin.apps.length)await admin.app().delete().catch(()=>{});
});
