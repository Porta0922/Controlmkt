import test from 'node:test';
import assert from 'node:assert/strict';
import { detectPlatform } from '../src/lib/platform';
import { extractSocial,parseCount,compareSocial,recommendations,type SocialSnapshot } from '../src/lib/social';
import { analyze } from '../src/lib/analysis';
import { publicTarget } from '../src/lib/public-url';
const script=(data:unknown)=>`<script type="application/json">${JSON.stringify(data)}</script>`;
test('Detecta las cuatro redes sin aceptar dominios parecidos',()=>{
 for(const[host,expected]of Object.entries({'x.com':'x','mobile.twitter.com':'x','www.instagram.com':'instagram','vm.tiktok.com':'tiktok','m.facebook.com':'facebook','instagram.com.example.org':'web','notx.com':'web'}))assert.equal(detectPlatform(`https://${host}/brand`),expected);
});
test('Contadores abreviados, separadores y ausencia de datos',()=>{
 assert.equal(parseCount('1.2K'),1200);assert.equal(parseCount('1,2 M'),1200000);assert.equal(parseCount('12,345'),12345);assert.equal(parseCount('12.345'),12345);assert.equal(parseCount(0),0);assert.equal(parseCount(-1),undefined);assert.equal(parseCount(null),undefined);assert.equal(parseCount('hidden'),undefined);
});
test('Instagram: texto, contadores y seguidores desde datos públicos',()=>{
 const html=`<meta property="og:description" content="1.2K Followers, 30 Following, 10 Posts">`+script({shortcode:'ABC',id:'123',owner:{username:'brand'},edge_media_to_caption:{edges:[{node:{text:'Nueva colección'}}]},edge_media_preview_like:{count:22},edge_media_to_comment:{count:4}});
 const snapshot=extractSocial(html,'https://www.instagram.com/brand/');assert.equal(snapshot.metrics.followers,1200);assert.equal(snapshot.posts[0].text,'Nueva colección');assert.equal(snapshot.posts[0].metrics.likes,22);assert.equal(snapshot.posts[0].metrics.views,undefined);
});
test('TikTok: perfil y publicaciones; excluye otros autores sugeridos',()=>{
 const snapshot=extractSocial(script({userInfo:{user:{uniqueId:'brand'},stats:{followerCount:900,videoCount:8}},items:[{id:'123',desc:'Video uno',author:{uniqueId:'brand'},stats:{diggCount:30,commentCount:2,playCount:1000}},{id:'456',desc:'Sugerencia',author:{uniqueId:'other'},stats:{diggCount:99}}]}),'https://www.tiktok.com/@brand');
 assert.equal(snapshot.metrics.followers,900);assert.equal(snapshot.posts.length,1);assert.equal(snapshot.posts[0].metrics.views,1000);
});
test('X: extrae texto y métricas del DOM renderizado',()=>{
 const html='<article data-testid="tweet"><a href="/brand/status/123">Fecha</a><div data-testid="tweetText">Oferta nueva</div><button data-testid="like" aria-label="12 Likes"></button><button data-testid="reply" aria-label="0 Replies"></button><a href="/brand/status/123/analytics" aria-label="1.5K views"></a></article>';
 const snapshot=extractSocial(html,'https://x.com/brand/status/123');assert.equal(snapshot.posts[0].metrics.likes,12);assert.equal(snapshot.posts[0].metrics.comments,0);assert.equal(snapshot.posts[0].metrics.views,1500);
});
test('Facebook: contadores semánticos JSON-LD de publicación directa',()=>{
 const html=`<script type="application/ld+json">${JSON.stringify({'@type':'SocialMediaPosting',url:'https://facebook.com/brand/posts/123',articleBody:'Novedad',interactionStatistic:[{interactionType:{'@type':'LikeAction'},userInteractionCount:40}]})}</script>`;
 const snapshot=extractSocial(html,'https://facebook.com/brand/posts/123');assert.equal(snapshot.posts[0].metrics.likes,40);assert.equal(snapshot.posts[0].metrics.comments,undefined);
});
test('Bloqueos y muestras vacías no se presentan como cuentas saludables',()=>{
 assert.throws(()=>extractSocial('<body>Log in to continue</body>','https://instagram.com/brand/'),/exige sesión/);
 assert.throws(()=>extractSocial('<body></body>','https://facebook.com/brand/'),/No se confirma/);
 const partial=extractSocial('<meta property="og:description" content="10 Followers">','https://instagram.com/brand/');assert.equal(partial.coverage,'partial');
});
const baseline:SocialSnapshot={version:1,platform:'tiktok',metrics:{followers:100},coverage:'available',notes:[],posts:[{id:'1',text:'Uno',url:'https://tiktok.com/1',metrics:{likes:10,comments:1,views:100}},{id:'2',text:'Dos',url:'https://tiktok.com/2',metrics:{likes:2}}]};
test('Variaciones: métricas comparables, ediciones y salida de muestra',()=>{
 const now:SocialSnapshot={...baseline,metrics:{followers:98},posts:[{...baseline.posts[0],text:'Uno editado',metrics:{likes:12,views:110}},{id:'3',text:'Nueva',url:'https://tiktok.com/3',metrics:{}}]};const changes=compareSocial(now,baseline);
 assert.equal(changes.newPosts,1);assert.equal(changes.editedPosts,1);assert.equal(changes.outsideSample,1);assert.equal(changes.metrics.length,3);assert.equal(changes.metrics.find(c=>c.name==='perfil.followers')?.delta,-2);
 const tips=recommendations(now,changes,true);assert.ok(tips.some(t=>t.includes('baja aproximada')));assert.ok(tips.some(t=>t.includes('antes de asumir')));
});
test('Cambios de métricas generan alerta aunque el texto no cambie',()=>{
 const result={status:200,title:'TikTok',content:'Uno',hash:'stable',provider:'playwright' as const,platform:'tiktok' as const,snapshot:baseline};
 const old={hash:'stable',provider:'playwright',platform:'tiktok',snapshot:{...baseline,metrics:{followers:90}}};const analysis=analyze(result,old);
 assert.equal(analysis.health,'alert');assert.equal(analysis.ai_analysis_result.changed,false);assert.equal(analysis.ai_analysis_result.metricsChanged,true);
 assert.ok(analyze(result).ai_analysis_result.recommendations.some(t=>t.includes('referencia')));
});
test('Recomendación de contenido solo con una muestra comparable suficiente',()=>{
 const snapshot={...baseline,posts:[1,2,3].map(id=>({id:String(id),text:'Video',url:'https://tiktok.com',metrics:{likes:id*10,comments:2,views:1000}}))};const tips=recommendations(snapshot,compareSocial(snapshot,snapshot),true);assert.ok(tips.some(t=>t.includes('3 tiene la mayor proporción')));
});
test('Impide acceso local por HTTP, IPv6 y direcciones mapeadas',async()=>{
 for(const url of ['http://127.0.0.1','http://10.0.0.1','http://[::1]','http://[::ffff:127.0.0.1]','file:///etc/passwd','http://example.com:3000'])await assert.rejects(publicTarget(url));
});
