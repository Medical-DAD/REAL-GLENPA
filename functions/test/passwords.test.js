'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {ITERATIONS,makePassword,checkPassword,validPassword,derivePassword}=require('../passwords');
test('uses the OrderingSystem R/auth.js PBKDF2 parameter count',()=>{
 assert.equal(ITERATIONS,150000);
});
test('different salts result in different hashes for the same password',()=>{
 const first=makePassword('a unique strong password 123');
 const second=makePassword('a unique strong password 123');
 assert.match(first.passwordSalt,/^[a-f0-9]{32}$/);
 assert.match(first.passwordHash,/^[a-f0-9]{64}$/);
 assert.notEqual(first.passwordSalt,second.passwordSalt);
 assert.notEqual(first.passwordHash,second.passwordHash);
 assert.equal(first.passwordIterations,150000);
 assert.equal(first.passwordAlgorithm,'PBKDF2-SHA256');
});
test('valid password succeeds, invalid password fails',()=>{
 const user=makePassword('correct horse battery two');
 assert.equal(checkPassword('correct horse battery two',user),true);
 assert.equal(checkPassword('wrong horse battery two',user),false);
});
test('weak, invalid or tampered hashes cannot authenticate',()=>{
 assert.equal(validPassword('short'),false);
 const user=makePassword('sufficiently unique text');
 assert.equal(checkPassword('sufficiently unique text',{...user,passwordHash:'00'}),false);
 assert.equal(checkPassword('sufficiently unique text',{...user,passwordIterations:10}),false);
 assert.equal(checkPassword('sufficiently unique text',{...user,passwordSalt:'bad'}),false);
});
