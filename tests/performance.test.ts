import test from 'node:test';
import assert from 'node:assert/strict';
import {postPerformance,rankPosts,performanceAdvice} from '../src/lib/performance';
import {extractSocial,type SocialSnapshot,type Post} from '../src/lib/social';
import {ScanError} from '../src/lib/scan-error';
const post=(id:string,metrics:Post['metrics'],kind:Post['kind']='post'):Post=>({id,text:id,url:`https://facebook.com/brand/posts/${id}`,metrics,kind});
const sample=(posts:Post[]):SocialSnapshot=>({version:1,platform:'facebook',posts,metrics:{},coverage:'available',notes:[]});
test('Suma las interacciones sin duplicar likes dentro de reacciones',()=>{
 const result=postPerformance(post('1',{likes:30,reactions:50,comments:4,shares:6,views:1000}));assert.equal(result.interactions,60);assert.equal(result.rate,6);assert.equal(result.partial,false);
});
test('Una métrica ausente no se vuelve cero ni una suma completa',()=>{
 const result=postPerformance(post('1',{likes:30}));assert.equal(result.interactions,30);assert.equal(result.partial,true);assert.equal(result.rate,null);assert.equal(postPerformance(post('2',{})).interactions,null);
 assert.equal(postPerformance(post('3',{likes:0,comments:0,shares:0,views:0})).interactions,0);assert.equal(postPerformance(post('3',{likes:0,comments:0,shares:0,views:0})).rate,null);
});
test('Rankings independientes por interacciones, vistas, tasa y formato',()=>{
 const snapshot=sample([post('A',{likes:100,comments:0,shares:0,views:10000},'video'),post('B',{likes:50,comments:5,shares:5,views:100},'post'),post('C',{},'unknown')]);
 assert.equal(rankPosts(snapshot)[0].post.id,'A');assert.equal(rankPosts(snapshot,'rate')[0].post.id,'B');assert.equal(rankPosts(snapshot,'views')[0].post.id,'A');assert.equal(rankPosts(snapshot,'interactions',undefined,'video').length,1);assert.equal(rankPosts(snapshot).at(-1)?.post.id,'C');
});
test('Crecimiento compara las mismas métricas y no mezcla posts nuevos',()=>{
 const before=sample([post('1',{likes:10,comments:2,shares:0}),post('2',{likes:100,comments:0,shares:0})]);
 const now=sample([post('1',{likes:30,comments:4,shares:1}),post('2',{likes:105}),post('3',{likes:1000,comments:10,shares:3})]);const ranked=rankPosts(now,'growth',before);
 assert.equal(ranked[0].growth,23);assert.equal(ranked.find(r=>r.post.id==='2')?.growth,null);assert.equal(ranked.find(r=>r.post.id==='3')?.growth,null);
 assert.ok(performanceAdvice(now,before).some(t=>t.includes('ganó 23')));
});
test('Contadores que bajan conservan la corrección negativa',()=>{
 assert.equal(postPerformance(post('1',{likes:8}),post('1',{likes:10})).growth,-2);
});
test('Snapshots antiguos de TikTok siguen siendo filtrables como videos',()=>{
 const snapshot={...sample([post('1',{likes:10})]),platform:'tiktok' as const};delete snapshot.posts[0].kind;assert.equal(rankPosts(snapshot,'interactions',undefined,'video').length,1);
});
test('X: GraphQL de la propia página y botones de una publicación ya marcada',()=>{
 const data={tweets:[{rest_id:'123',legacy:{id_str:'123',full_text:'Video propio',favorite_count:10,reply_count:2,retweet_count:3,extended_entities:{media:[{type:'video'}]}},views:{count:'500'},core:{user_results:{result:{legacy:{screen_name:'brand'}}}}},{rest_id:'456',legacy:{id_str:'456',full_text:'Otro autor',favorite_count:900},core:{user_results:{result:{legacy:{screen_name:'other'}}}}}]};
 const html=`<script type="application/json">${JSON.stringify(data)}</script><article data-testid="tweet"><a href="https://x.com/brand/status/123"><time datetime="2026-10-01">Hoy</time></a><div data-testid="tweetText">Video propio</div><button data-testid="unlike" aria-label="11 Likes"></button></article>`;
 const snapshot=extractSocial(html,'https://x.com/brand');assert.equal(snapshot.posts.length,1);assert.equal(snapshot.posts[0].metrics.likes,11);assert.equal(snapshot.posts[0].metrics.views,500);assert.equal(snapshot.posts[0].kind,'video');
});
test('Los fallos de extracción conservan el código HTTP real',()=>{
 const error=new ScanError('X respondió HTTP 403',403,{sessionLoaded:false});assert.equal(error.httpStatus,403);assert.equal(error.diagnostic.sessionLoaded,false);
});
