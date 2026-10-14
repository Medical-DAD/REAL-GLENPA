'use strict';
const crypto=require('node:crypto');
const ITERATIONS=150000;
function validPassword(value){return typeof value==='string'&&value.length>=14&&value.length<=128}
function timingEqual(a,b){
 const left=Buffer.from(String(a||''),'utf8'),right=Buffer.from(String(b||''),'utf8');
 return left.length===right.length&&crypto.timingSafeEqual(left,right);
}
function derivePassword(secret,salt){
 if(!/^[0-9a-f]{32}$/.test(salt))throw new Error('Invalid password salt');
 return crypto.pbkdf2Sync(secret,Buffer.from(salt,'hex'),ITERATIONS,32,'sha256').toString('hex');
}
function makePassword(secret){
 if(!validPassword(secret))throw new Error('Invalid password length');
 const passwordSalt=crypto.randomBytes(16).toString('hex');
 return {passwordSalt,passwordHash:derivePassword(secret,passwordSalt),passwordAlgorithm:'PBKDF2-SHA256',passwordIterations:ITERATIONS};
}
function checkPassword(secret,user){
 if(typeof secret!=='string'||secret.length>128||!user||!/^[0-9a-f]{32}$/.test(user.passwordSalt||'')||
 !/^[0-9a-f]{64}$/.test(user.passwordHash||'')||user.passwordIterations!==ITERATIONS)return false;
 return timingEqual(derivePassword(secret,user.passwordSalt),user.passwordHash);
}
module.exports={ITERATIONS,validPassword,timingEqual,derivePassword,makePassword,checkPassword};
