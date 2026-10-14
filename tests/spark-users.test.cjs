'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const js=fs.readFileSync('portal.js','utf8'),rules=fs.readFileSync('firestore.rules','utf8');
const guide=fs.readFileSync('ADMIN_USERS_GUIDE_AR.md','utf8');
test('clinic account setup uses username and numeric six-or-more-digit PIN without asking an email',()=>{
 const begin=js.indexOf('function usersView()'),end=js.indexOf('function settingsView()',begin);
 const body=js.slice(begin,end);
 assert.ok(body.includes('pattern="[0-9]{6,32}"'));
 assert.ok(!body.includes('name="email"'));
 assert.ok(body.includes("data-toggleuser"));
 assert.ok(guide.includes('Spark'));
});
test('clinic account uses an internal Firebase email identity while preserving username login',()=>{
 assert.match(js,/const email=username\+'@'\+INTERNAL_CLINIC_DOMAIN/);
 assert.match(js,/createUserWithEmailAndPassword\(secondAuth,email,password\)/);
 assert.match(js,/batch\.set\(doc\(db,'loginHandles',username\),\{email,userUid:user\.uid\}\)/);
 assert.match(js,/signInWithEmailAndPassword\(auth,await emailForUsername\(u\),password\)/);
});
test('existing Firestore rules enforce role and clinic checks',()=>{
 assert.ok(rules.includes("function sameClinic(code)"));
 assert.ok(rules.includes("request.auth != null"));
 assert.ok(rules.includes("get(profilePath()).data.active == true"));
 assert.ok(!rules.includes("allow read, write: if true;"));
});
test('local tool handles private PIN reset and deletion but prohibits admin deletion',()=>{
 const cli=fs.readFileSync('admin-tools/manage.cjs','utf8');
 assert.ok(cli.includes('auth.updateUser(doc.id,{password:pin})'));
 assert.ok(cli.includes('auth.deleteUser(doc.id)'));
 assert.ok(cli.includes("if(profile.role!=='clinic')"));
 assert.ok(cli.includes("await doc.ref.update({active:false})"));
 assert.ok(cli.includes('GOOGLE_APPLICATION_CREDENTIALS'));
});
