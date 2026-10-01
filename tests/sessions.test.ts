import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSessionState} from '../src/lib/session-state';
import {encryptSession,decryptSession} from '../src/lib/stored-sessions';
const state={cookies:[{name:'auth_token',value:'private-test-token',domain:'.x.com',path:'/',expires:-1,httpOnly:true,secure:true,sameSite:'Lax'}],origins:[]};
test('Importación exige la cookie de acceso y restringe dominios',()=>{
 assert.equal(validateSessionState(state,'x').cookies.length,1);
 assert.throws(()=>validateSessionState(state,'facebook'),/otra red/);
 assert.throws(()=>validateSessionState({...state,cookies:[{...state.cookies[0],domain:'x.com.example.org'}]},'x'),/otra red/);
 assert.throws(()=>validateSessionState({...state,cookies:[{...state.cookies[0],expires:1}]},'x'),/vigente/);
 assert.throws(()=>validateSessionState({...state,origins:[{origin:'https://example.org',localStorage:[]}]},'x'),/otra red/);
});
test('Sesiones cifradas no exponen cookies y rechazan alteraciones o claves distintas',()=>{
 const prior=process.env.SESSION_SECRET;process.env.SESSION_SECRET='test-secret-for-session-encryption-32-characters';
 try{const valid=validateSessionState(state,'x');const encrypted=encryptSession(valid,'x');assert.ok(!encrypted.includes('private-test-token'));assert.deepEqual(decryptSession(encrypted,'x'),valid);assert.throws(()=>decryptSession(encrypted,'facebook'));const broken=JSON.parse(encrypted);broken.tag=Buffer.alloc(16).toString('base64');assert.throws(()=>decryptSession(JSON.stringify(broken),'x'));process.env.SESSION_SECRET='other-test-secret-for-encryption-32-characters';assert.throws(()=>decryptSession(encrypted,'x'));}finally{if(prior===undefined)delete process.env.SESSION_SECRET;else process.env.SESSION_SECRET=prior;}
});
