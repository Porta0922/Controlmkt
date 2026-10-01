import { load } from 'cheerio';
import type { Post, Metrics } from './social';
type Row=Record<string,unknown>;
const object=(value:unknown):Row=>value&&typeof value==='object'&&!Array.isArray(value)?value as Row:{};
const text=(value:unknown)=>typeof value==='string'||typeof value==='number'?String(value):'';
function merge(left:Row,right:Row,depth=0):Row{
 const result={...left};for(const[key,value]of Object.entries(right)){
  if(['__proto__','constructor','prototype'].includes(key)||value===null||value===undefined)continue;
  if(depth<8&&Object.keys(object(value)).length&&Object.keys(object(result[key])).length)result[key]=merge(object(result[key]),object(value),depth+1);
  else if(!Array.isArray(value)||!Array.isArray(result[key])||value.length>=(result[key] as unknown[]).length)result[key]=value;
 }return result;
}
export function extractFacebook(html:string,url:string,parseCount:(value:unknown)=>number|undefined):Post[]{
 const $=load(html),entities=new Map<string,Row>(),stories=new Map<string,Row>();let visited=0;
 function visit(value:unknown,depth=0){
  if(depth>45||++visited>300000)return;if(Array.isArray(value)){for(const child of value)visit(child,depth+1);return;}
  const row=object(value);if(!Object.keys(row).length)return;const id=text(row.id);
  if(id&&id.length<220)entities.set(id,merge(entities.get(id)||{},row));
  const postId=text(row.post_id);
  if(postId&&postId.length<150)stories.set(postId,merge(stories.get(postId)||{},row));
  for(const child of Object.values(row))if(child&&typeof child==='object')visit(child,depth+1);
 }
 $('script[type="application/json"]').each((_i,node)=>{try{visit(JSON.parse($(node).text()));}catch{/* No se ejecuta código del sitio. */}});
 const target=new URL(url);const profileId=target.searchParams.get('id')||(/^\/\d+\/?$/.test(target.pathname)?target.pathname.replaceAll('/',''):null);
 const direct=/\/(posts|videos|reel)\//.test(target.pathname)||target.searchParams.has('story_fbid')||target.pathname==='/watch/'&&target.searchParams.has('v');
 const directId=direct?(target.searchParams.get('story_fbid')||target.searchParams.get('v')||target.pathname.split('/').filter(Boolean).at(-1)):undefined;
 const result:Post[]=[];
 for(const[id,story]of stories){
  const actors=Array.isArray(story.actors)?story.actors.map(object):[];
  if(!direct&&profileId&&(!actors.length||!actors.some(actor=>text(actor.id)===profileId)))continue;
  if(!direct&&!profileId&&actors.length){const slug=target.pathname.replace(/^\/|\/$/g,'').toLowerCase();const known=actors.map(actor=>text(actor.url)).filter(Boolean);if(known.length&&!known.some(actorUrl=>{try{return new URL(actorUrl).pathname.replace(/^\/|\/$/g,'').toLowerCase()===slug;}catch{return false;}}))continue;}
  const link=text(story.permalink_url||story.url||story.wwwURL)||`${target.origin}/permalink.php?story_fbid=${encodeURIComponent(id)}${profileId?`&id=${profileId}`:''}`;
  if(direct&&directId&&id!==directId&&!link.includes(directId))continue;
  const feedbackRef=object(story.feedback);const feedback=entities.get(text(feedbackRef.id))||feedbackRef;
  const metrics:Metrics={};const values:Record<string,unknown[]>={
   reactions:[object(feedback.reaction_count).count,feedback.reaction_count],
   comments:[object(object(feedback.comment_rendering_instance).comments).total_count,feedback.total_comment_count,object(feedback.comment_count).total_count,object(feedback.comment_count).count,feedback.comment_count],
   shares:[object(feedback.share_count).count,feedback.share_count],views:[story.view_count,object(story.view_count).count,feedback.video_view_count],
  };
  for(const[key,list]of Object.entries(values))for(const value of list){const count=parseCount(value);if(count!==undefined){metrics[key]=count;break;}}
  const content=text(object(story.message).text||object(object(object(object(story.comet_sections).content).story).message).text);
  if(!actors.length&&!Object.keys(feedback).length&&!content)continue;
  let canonical=url;try{const parsed=new URL(link,url);if(parsed.protocol==='https:'&&(parsed.hostname==='facebook.com'||parsed.hostname.endsWith('.facebook.com')))canonical=parsed.toString();}catch{}
  const attachments=Array.isArray(story.attachments)?story.attachments.map(object):[];
  const isVideo=/\/(reel|videos)\//.test(canonical)||attachments.some(attachment=>object(attachment.media).__typename==='Video');
  result.push({id,text:content.slice(0,10000),url:canonical,metrics,kind:isVideo?'video':'post',publishedAt:text(story.creation_time)||undefined});if(result.length>=20)break;
 }
 return result;
}
