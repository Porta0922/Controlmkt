import type { Metrics, Post, SocialSnapshot } from './social';
export type RankingMode = 'interactions'|'views'|'rate'|'growth';
export type PerformanceRow = {post:Post;interactions:number|null;partial:boolean;views:number|null;rate:number|null;growth:number|null;viewGrowth:number|null};
const finite=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
function components(metrics:Metrics){
 // Reacciones ya incluye likes en Facebook: se cuenta una sola vez.
 const reaction=finite(metrics.reactions)?'reactions':'likes';
 const keys=[reaction,'comments','shares'];
 const available=keys.filter(key=>finite(metrics[key]));
 return {keys:available,partial:available.length<keys.length,total:available.length?available.reduce((sum,key)=>sum+metrics[key],0):null};
}
export function postPerformance(post:Post,previous?:Post):PerformanceRow {
 const current=components(post.metrics);const before=previous?components(previous.metrics):null;
 const comparable=before&&current.keys.join(',')===before.keys.join(',')&&current.total!==null&&before.total!==null;
 const views=finite(post.metrics.views)?post.metrics.views:null;
 return {post,interactions:current.total,partial:current.partial,views,rate:views!==null&&views>0&&current.total!==null?current.total/views*100:null,growth:comparable?current.total!-before!.total!:null,viewGrowth:views!==null&&previous&&finite(previous.metrics.views)?views-previous.metrics.views:null};
}
export function rankPosts(snapshot:SocialSnapshot,mode:RankingMode='interactions',previous?:SocialSnapshot,kind='all'):PerformanceRow[]{
 const old=new Map((previous?.platform===snapshot.platform?previous.posts:[]).map(post=>[post.id,post]));
 return snapshot.posts.map(post=>({...post,kind:post.kind||(snapshot.platform==='tiktok'||/\/(video|videos|reel|reels)\//.test(post.url)?'video':'unknown')} as Post)).filter(post=>kind==='all'||post.kind===kind).map(post=>postPerformance(post,old.get(post.id))).sort((a,b)=>{
  const left=mode==='interactions'?a.interactions:mode==='views'?a.views:mode==='rate'?a.rate:a.growth;
  const right=mode==='interactions'?b.interactions:mode==='views'?b.views:mode==='rate'?b.rate:b.growth;
  if(left===null&&right===null)return a.post.id.localeCompare(b.post.id);if(left===null)return 1;if(right===null)return -1;return right-left||a.post.id.localeCompare(b.post.id);
 });
}
export function performanceAdvice(snapshot:SocialSnapshot,previous?:SocialSnapshot):string[]{
 const result:string[]=[];const rows=rankPosts(snapshot);const top=rows.find(row=>row.interactions!==null);
 if(top)result.push(`En la muestra, ${top.post.id} registra más interacciones observadas (${top.interactions}${top.partial?', suma parcial':''}). Revisa su tema, formato y llamado a la acción para planear una prueba similar.`);
 const byViews=rankPosts(snapshot,'views').find(row=>row.views!==null);
 if(byViews)result.push(`${byViews.post.id} registra más vistas (${byViews.views}). Las vistas son reproducciones o visualizaciones, no alcance único confirmado.`);
 const complete=snapshot.posts.filter(post=>{const row=postPerformance(post);return !row.partial&&row.rate!==null;});
 if(complete.length>=3){const best=rankPosts({...snapshot,posts:complete},'rate')[0];result.push(`${best.post.id} tiene la mejor tasa de interacción por vista (${best.rate!.toFixed(2)}%) entre ${complete.length} publicaciones con métricas completas. Compara formatos dentro de esta red; una tasa alta no demuestra causalidad.`);}
 const growing=rankPosts(snapshot,'growth',previous).find(row=>row.growth!==null&&row.growth>0);
 if(growing)result.push(`${growing.post.id} ganó ${growing.growth} interacciones observadas entre los dos controles comparables. Prioriza revisar ese contenido mientras mantiene actividad.`);
 if(rows.some(row=>row.partial))result.push('Parte de las sumas es parcial. No compares como equivalentes publicaciones con contadores faltantes; abre sus URLs y vuelve a controlarlas.');
 return result;
}
