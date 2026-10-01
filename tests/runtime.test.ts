import test from 'node:test';
import assert from 'node:assert/strict';
import {readApiResponse} from '../src/lib/api-response';
import {extractSocial} from '../src/lib/social';
import {parseNetworkData} from '../src/lib/network-data';
const script=(data:unknown)=>`<script type="application/json">${JSON.stringify(data)}</script>`;
test('Respuestas vacías y HTML no exponen errores de JSON al usuario',async()=>{
 await assert.rejects(readApiResponse(new Response('',{status:504})),/tardó demasiado/);
 await assert.rejects(readApiResponse(new Response('<html>Failure</html>',{status:500})),/respuesta vacía o inválida/);
 assert.deepEqual(await readApiResponse(Response.json({ok:true})),{ok:true});
 await assert.rejects(readApiResponse(Response.json({error:'Sesión requerida'},{status:401})),/Sesión requerida/);
});
test('Facebook une publicación y contadores fragmentados sin perder cero comentarios',()=>{
 const html=script({post_id:'123',actors:[{id:'42'}],permalink_url:'https://www.facebook.com/reel/789/',feedback:{id:'feedback1'}})+script({post_id:'123',message:{text:'Campaña'}})+script({id:'feedback1',reaction_count:{count:3}})+script({id:'feedback1',comment_rendering_instance:{comments:{total_count:0}},share_count:{count:2}})+script({post_id:'999',actors:[{id:'77'}],message:{text:'Otra marca'}});
 const snapshot=extractSocial(html,'https://www.facebook.com/profile.php?id=42');
 assert.equal(snapshot.posts.length,1);assert.equal(snapshot.posts[0].text,'Campaña');assert.equal(snapshot.posts[0].kind,'video');assert.deepEqual(snapshot.posts[0].metrics,{reactions:3,comments:0,shares:2});
});
test('TikTok conserva videos sin descripción y statsV2',()=>{
 const snapshot=extractSocial(script({userInfo:{user:{uniqueId:'brand'},statsV2:{followerCount:'900'}},items:[{id:'123',video:{},author:{uniqueId:'brand'},statsV2:{diggCount:'30',commentCount:'2',playCount:'1000'}}]}),'https://www.tiktok.com/@brand');
 assert.equal(snapshot.metrics.followers,900);assert.equal(snapshot.posts[0].metrics.comments,2);
});
test('Respuestas Relay con prefijo y múltiples objetos',()=>{assert.deepEqual(parseNetworkData('for (;;);\n{"a":1}\n{"b":2}'),[{a:1},{b:2}]);});

test("X: Me gusta no convierte cuatro likes en cuatro millones",()=>{const snapshot=extractSocial('<article data-testid="tweet"><a href="/brand/status/123">Fecha</a><div data-testid="tweetText">Oferta</div><button data-testid="like" aria-label="4 Me gusta"></button></article>','https://x.com/brand');assert.equal(snapshot.posts[0].metrics.likes,4);});
