import { load } from 'cheerio';
import { createHash } from 'node:crypto';
import { detectPlatform, type Platform } from './platform';

export type Metrics = Record<string,number>;
export type Post = {id:string;text:string;url:string;metrics:Metrics;kind?:'video'|'post'|'unknown';publishedAt?:string};
export type SocialSnapshot = {version:1;platform:Platform;metrics:Metrics;posts:Post[];coverage:'partial'|'available';notes:string[]};
type Row=Record<string,unknown>;
function obj(value:unknown):Row{return value && typeof value==='object' && !Array.isArray(value)?value as Row:{};}
function str(value:unknown){return typeof value==='string'||typeof value==='number'?String(value):'';}
export function digest(value:unknown){return createHash('sha256').update(JSON.stringify(value)).digest('hex');}
export function parseCount(value:unknown):number|undefined {
  if(typeof value==='number')return Number.isFinite(value)&&value>=0?value:undefined;
  if(typeof value!=='string')return;
  const match=value.trim().match(/^([\d.,\s]+)\s*(k|m|b|mil|millones)?$/i);if(!match)return;
  let number=match[1].replace(/\s/g,'');const suffix=match[2]?.toLowerCase();
  if(suffix)number=number.replace(',','.');else number=number.replace(/[,.](?=\d{3}(?:[,.]|$))/g,'').replace(',','.');
  const result=Number(number)*({k:1000,mil:1000,m:1000000,millones:1000000,b:1000000000}[suffix||'']||1);
  return Number.isFinite(result)&&result>=0?Math.round(result):undefined;
}
function counts(row:Row):Metrics {
  const aliases:Record<string,string[]>={followers:['followerCount','followers_count','followersCount','edge_followed_by'],following:['followingCount','friends_count','following_count','edge_follow'],posts:['videoCount','mediaCount','media_count','edge_owner_to_timeline_media'],likes:['diggCount','like_count','favorite_count','likesCount','edge_media_preview_like'],comments:['commentCount','comment_count','reply_count','commentsCount','edge_media_to_comment'],shares:['shareCount','share_count','retweet_count','sharesCount'],views:['playCount','view_count','video_view_count','videoViewCount'],reactions:['reaction_count','reactions_count']};
  const result:Metrics={};for(const [key,fields]of Object.entries(aliases))for(const field of fields){const v=parseCount(obj(row[field]).count??row[field]);if(v!==undefined){result[key]=v;break;}}return result;
}
function visibleCounts(text:string):Metrics {
 const result:Metrics={};const expressions:Record<string,RegExp>={followers:/([\d.,]+\s*(?:[KMB]|mil|millones)?)\s+(?:followers|seguidores)/i,following:/([\d.,]+\s*(?:[KMB]|mil)?)\s+(?:following|seguidos)/i,posts:/([\d.,]+\s*(?:[KMB]|mil)?)\s+(?:posts|publicaciones|videos)/i};
 for(const[key,pattern]of Object.entries(expressions)){const match=text.match(pattern);const n=parseCount(match?.[1]);if(n!==undefined)result[key]=n;}return result;
}
export function extractSocial(html:string,url:string):SocialSnapshot {
 const platform=detectPlatform(url),$=load(html),posts=new Map<string,Post>();const metrics:Metrics={};
 const target=new URL(url);const parts=target.pathname.split('/').filter(Boolean);const handle=parts[0]?.replace(/^@/,'').toLowerCase();
 const isPost=/\/(?:status|p|reel|video|posts|videos)\//.test(target.pathname)||target.searchParams.has('story_fbid');
 const postId=isPost?(target.searchParams.get('story_fbid')||parts.at(-1)):undefined;
 const add=(post:Post,author?:string)=>{if(posts.size>=20)return;if(isPost&&postId&&post.id!==postId&&!post.url.includes(postId))return;if(!isPost&&author&&handle&&author.replace(/^@/,'').toLowerCase()!==handle)return;try{const link=new URL(post.url);if(!['http:','https:'].includes(link.protocol)||detectPlatform(link.toString())!==platform)post.url=url;}catch{post.url=url;}posts.set(post.id,post);};
 let visits=0;
 function visit(value:unknown,depth=0){
  if(depth>35||++visits>40000)return;
  if(Array.isArray(value)){for(const child of value)visit(child,depth+1);return;}
  const row=obj(value);if(!Object.keys(row).length)return;
  const stats={...counts(row),...counts(obj(row.stats)),...counts(obj(row.legacy))};const viewCount=parseCount(obj(row.views).count);if(viewCount!==undefined)stats.views=viewCount;
  const username=str(row.username||row.uniqueId||row.screen_name||obj(row.legacy).screen_name);
  if(!isPost&&username&&username.toLowerCase()===handle)Object.assign(metrics,stats);
  const userInfo=obj(row.userInfo);const user=obj(userInfo.user);
  if(!isPost&&str(user.uniqueId).toLowerCase()===handle)Object.assign(metrics,counts(obj(userInfo.stats)));
  const captionEdges=obj(row.edge_media_to_caption).edges;
  const caption=Array.isArray(captionEdges)?str(obj(obj(captionEdges[0]).node).text):'';
  const legacy=obj(row.legacy);const captionObj=obj(row.caption);
  const content=str(row.desc||row.full_text||legacy.full_text||caption||captionObj.text||obj(row.message).text||(typeof row.caption==='string'?row.caption:''));
  const id=str(row.shortcode||row.shortCode||row.rest_id||row.id_str||row.post_id||row.pk||row.id);
  if(id && content && Object.keys(stats).some(k=>['likes','comments','shares','views','reactions'].includes(k))){
   const author=obj(row.author||row.owner||row.user||obj(obj(obj(row.core).user_results).result));const authorName=str(author.uniqueId||author.username||author.screen_name||obj(author.legacy).screen_name);
   const postUrl=str(row.url||row.webVideoUrl)|| (platform==='instagram'?`https://www.instagram.com/p/${str(row.shortcode||row.shortCode)}/`:platform==='tiktok'?`https://www.tiktok.com/@${authorName}/video/${id}`:platform==='x'?`https://x.com/${authorName||handle}/status/${id}`:url);
   const media=obj(row.extended_entities||legacy.extended_entities).media;const isVideo=platform==='tiktok'||row.is_video===true||Number(row.media_type)===2||row.video!==undefined||Array.isArray(media)&&media.some(item=>['video','animated_gif'].includes(str(obj(item).type)));
   add({id:platform==='instagram'?str(row.shortcode||row.shortCode)||id:id,text:content.slice(0,10000),url:postUrl,metrics:stats,kind:isVideo?'video':platform==='x'||row.is_video===false||row.media_type===1?'post':'unknown',publishedAt:str(row.createTimeISO||row.taken_at_timestamp||row.createTime||row.created_at||legacy.created_at)||undefined},authorName);
   return; // Evita volver a agregar el legacy de un autor filtrado como si fuese propio.
  }
  // JSON-LD de una publicación: contadores semánticos, sin adivinar números.
  if(row['@type']==='SocialMediaPosting'||row['@type']==='VideoObject'){
   const interactions=Array.isArray(row.interactionStatistic)?row.interactionStatistic:[];const postMetrics:Metrics={};
   for(const entry of interactions){const interaction=obj(entry);const kind=str(obj(interaction.interactionType)['@type']||interaction.interactionType);const key=/LikeAction/.test(kind)?'likes':/CommentAction/.test(kind)?'comments':/WatchAction|ViewAction/.test(kind)?'views':/ShareAction/.test(kind)?'shares':undefined;const count=parseCount(interaction.userInteractionCount);if(key&&count!==undefined)postMetrics[key]=count;}
   const postUrl=str(row.url||row['@id']);if(isPost&&Object.keys(postMetrics).length)add({id:postId||postUrl,text:str(row.articleBody||row.description||row.name),url:postUrl||url,metrics:postMetrics,kind:row['@type']==='VideoObject'?'video':'post',publishedAt:str(row.datePublished||row.uploadDate)||undefined});
  }
  for(const child of Object.values(row))if(child&&typeof child==='object')visit(child,depth+1);
 }
 $('script[type="application/json"],script[type="application/ld+json"],script#__NEXT_DATA__,script#SIGI_STATE,script#__UNIVERSAL_DATA_FOR_REHYDRATION__').each((_i,element)=>{const text=$(element).text();if(text.length>2_000_000)return;try{visit(JSON.parse(text));}catch{/* No se ejecutan scripts del sitio. */}});
 const description=$('meta[property="og:description"]').attr('content')||$('meta[name="description"]').attr('content')||'';
 if(!isPost)Object.assign(metrics,visibleCounts(description));
 if(platform==='x'){
  $('article[data-testid="tweet"]').each((_i,element)=>{
   const article=$(element);const link=article.find('a[href*="/status/"]').filter((_j,a)=>Boolean($(a).find('time').length)).first().attr('href')||article.find('a[href*="/status/"]').filter((_j,a)=>!/\/(photo|video|analytics)\//.test($(a).attr('href')||'')).first().attr('href')||'';let path;try{path=new URL(link,'https://x.com').pathname;}catch{return;}const match=path.match(/^\/([^/]+)\/status\/(\d+)/);if(!match)return;
   const postMetrics:Metrics={};for(const[key,testid]of Object.entries({likes:'like',comments:'reply',shares:'retweet'})){const button=article.find(`[data-testid="${testid}"], [data-testid="un${testid}"]`).first();const label=button.attr('aria-label')||button.closest('[aria-label]').attr('aria-label')||button.text();const n=parseCount(label.match(/[\d.,]+\s*[KMB]?/i)?.[0]);if(n!==undefined)postMetrics[key]=n;}
   const analytics=article.find('a[href$="/analytics"]');const views=parseCount((analytics.attr('aria-label')||analytics.text()).match(/[\d.,]+\s*[KMB]?/i)?.[0]);if(views!==undefined)postMetrics.views=views;
   const existing=posts.get(match[2]);add({id:match[2],text:article.find('[data-testid="tweetText"]').first().text().trim()||existing?.text||'',url:`https://x.com/${match[1]}/status/${match[2]}`,metrics:{...existing?.metrics,...postMetrics},kind:article.find('video,[data-testid="videoPlayer"]').length?'video':existing?.kind||'post',publishedAt:article.find('time').first().attr('datetime')||existing?.publishedAt},match[1]);
  });
  if(!isPost)for(const[key,path]of Object.entries({followers:'/followers',following:'/following'})){const a=$(`a[href="/${handle}${path}"]`);const n=parseCount(a.find('span').first().text());if(n!==undefined)metrics[key]=n;}
 }
 const result=[...posts.values()].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
 const notes=['Muestra de hasta 20 publicaciones públicas cargadas; no representa toda la cuenta.','Los contadores abreviados (K/M) son aproximaciones; las métricas ausentes no se consideran cero.'];
 if(!Object.keys(metrics).length&&!result.length) {
  $('script,style').remove();const body=$('body').text();
  if(/log in|sign in|inicia sesión|iniciar sesión|captcha|access denied|temporarily blocked/i.test(body))throw new Error(`${platform}: la red exige sesión o bloqueó la consulta pública. Estadísticas no disponibles.`);
  throw new Error(`${platform}: no se encontraron publicaciones o estadísticas públicas legibles. No se confirma que la cuenta esté vacía o eliminada.`);
 }
 const coverage=!result.length||!result.some(p=>Object.keys(p.metrics).length)?'partial':'available';
 if(coverage==='partial')notes.push('Lectura parcial: faltan publicaciones o sus métricas.');
 return {version:1,platform,metrics,posts:result,coverage,notes};
}

export type Changes={newPosts:number;editedPosts:number;outsideSample:number;metrics:{name:string;before:number;after:number;delta:number}[]};
export function compareSocial(current:SocialSnapshot,previous?:SocialSnapshot):Changes {
 const changes:Changes={newPosts:0,editedPosts:0,outsideSample:0,metrics:[]};if(!previous||previous.platform!==current.platform)return changes;
 const compare=(now:Metrics,before:Metrics,prefix:string)=>{for(const[key,value]of Object.entries(now))if(before[key]!==undefined&&before[key]!==value)changes.metrics.push({name:`${prefix}${key}`,before:before[key],after:value,delta:value-before[key]});};
 compare(current.metrics,previous.metrics,'perfil.');const old=new Map(previous.posts.map(p=>[p.id,p]));
 for(const post of current.posts){const before=old.get(post.id);if(!before){changes.newPosts++;continue;}if(post.text!==before.text)changes.editedPosts++;compare(post.metrics,before.metrics,`${post.id}.`);}
 const ids=new Set(current.posts.map(p=>p.id));changes.outsideSample=previous.posts.filter(p=>!ids.has(p.id)).length;return changes;
}
export function recommendations(snapshot:SocialSnapshot,changes:Changes,hasBaseline:boolean):string[] {
 const result:string[]=[];
 if(!hasBaseline)result.push('Ejecuta otro control para medir variaciones; este control establece la referencia.');
 if(snapshot.coverage==='partial')result.push('Completa la muestra con enlaces directos a publicaciones públicas; la lectura actual es parcial.');
 const followerChange=changes.metrics.find(m=>m.name==='perfil.followers');
 if(followerChange&&followerChange.delta<0)result.push(`Se observa una baja aproximada de ${Math.abs(followerChange.delta)} seguidores. Confirma con otro control y revisa qué contenido cambió durante el intervalo.`);
 if(changes.editedPosts)result.push(`Revisa las ${changes.editedPosts} publicaciones cuyo texto cambió para verificar mensajes y enlaces.`);
 if(changes.outsideSample)result.push('Algunas publicaciones salieron de la muestra. Controla sus URLs directamente antes de asumir que fueron eliminadas.');
 const measured=snapshot.posts.filter(p=>p.metrics.views>0&&p.metrics.likes!==undefined&&p.metrics.comments!==undefined);
 if(measured.length>=3){
  const ranked=measured.map(p=>({id:p.id,rate:(p.metrics.likes+p.metrics.comments)/p.metrics.views*100})).sort((a,b)=>b.rate-a.rate);
  result.push(`En ${measured.length} publicaciones con datos comparables, ${ranked[0].id} tiene la mayor proporción visible de likes + comentarios por vista (${ranked[0].rate.toFixed(2)}%). Revisa su tema y formato para probar contenido similar; no implica causalidad.`);
 }
 if(!result.length)result.push('Mantén controles a intervalos similares y compara las mismas publicaciones para identificar tendencias.');
 return result;
}
