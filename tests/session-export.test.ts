import test from 'node:test';
import assert from 'node:assert/strict';
import {selectedNetwork,sessionState} from '../browser-extension/session.mjs';
test('Exportación solo en dominios reales de la red y HTTPS',()=>{
 assert.equal(selectedNetwork('https://x.com/brand')?.platform,'x');assert.equal(selectedNetwork('https://www.facebook.com')?.platform,'facebook');assert.equal(selectedNetwork('https://x.com.evil.test'),null);assert.equal(selectedNetwork('http://x.com'),null);
});
test('Convierte cookies a Playwright y excluye dominios ajenos y particionados',()=>{
 const base={name:'auth_token',value:'fixture-not-a-real-secret',domain:'.x.com',path:'/',session:true,httpOnly:true,secure:true,sameSite:'no_restriction'};
 const state=sessionState([base,base,{...base,domain:'.facebook.com'},{...base,name:'partitioned',partitionKey:{topLevelSite:'https://x.com'}}],selectedNetwork('https://x.com'));
 assert.equal(state.cookies.length,1);assert.equal(state.cookies[0].expires,-1);assert.equal(state.cookies[0].sameSite,'None');assert.equal(state.cookies[0].httpOnly,true);assert.deepEqual(state.origins,[]);
});
