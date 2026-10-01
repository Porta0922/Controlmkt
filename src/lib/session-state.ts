export const sessionPlatforms=['x','instagram','tiktok','facebook'] as const;
export type SessionPlatform=typeof sessionPlatforms[number];
export type SessionState={cookies:{name:string;value:string;domain:string;path:string;expires:number;httpOnly:boolean;secure:boolean;sameSite:'Strict'|'Lax'|'None'}[];origins:{origin:string;localStorage:{name:string;value:string}[]}[]};
const domains:Record<SessionPlatform,string[]>={x:['x.com','twitter.com'],instagram:['instagram.com'],tiktok:['tiktok.com'],facebook:['facebook.com']};
const authCookies:Record<SessionPlatform,string[]>={x:['auth_token'],instagram:['sessionid'],tiktok:['sessionid','sessionid_ss'],facebook:['c_user']};
export function isSessionPlatform(value:unknown):value is SessionPlatform{return sessionPlatforms.includes(value as SessionPlatform);}
function allowed(host:string,platform:SessionPlatform){return domains[platform].some(domain=>host===domain||host.endsWith('.'+domain));}
export function validateSessionState(value:unknown,platform:SessionPlatform):SessionState {
 if(!value||typeof value!=='object')throw new Error('El archivo debe contener una sesión JSON exportada.');
 const input=value as Record<string,unknown>;
 if(!Array.isArray(input.cookies)||input.cookies.length>500)throw new Error('Formato de cookies inválido. Usa el archivo exportado por ControlMKT.');
 const cookies:SessionState['cookies']=input.cookies.map(raw=>{
  if(!raw||typeof raw!=='object')throw new Error('Formato de cookie inválido.');
  const c=raw as Record<string,unknown>;
  if(typeof c.domain!=='string'||!allowed(c.domain.replace(/^\./,'').toLowerCase(),platform))throw new Error('El archivo contiene cookies de otra red. Selecciona la red correcta.');
  if(typeof c.name!=='string'||!c.name||c.name.length>256||typeof c.value!=='string'||c.value.length>20000||typeof c.path!=='string'||!c.path.startsWith('/')||c.path.length>2048||typeof c.expires!=='number'||!Number.isFinite(c.expires)||c.expires< -1||typeof c.httpOnly!=='boolean'||typeof c.secure!=='boolean'||!['Strict','Lax','None'].includes(String(c.sameSite)))throw new Error('La sesión tiene cookies con un formato incompatible. Vuelve a exportarla.');
  return {name:c.name,value:c.value,domain:c.domain,path:c.path,expires:c.expires,httpOnly:c.httpOnly,secure:c.secure,sameSite:c.sameSite as 'Strict'|'Lax'|'None'};
 });
 if(!cookies.some(c=>authCookies[platform].includes(c.name)&&c.value&&(c.expires===-1||c.expires>Date.now()/1000)))throw new Error('No se encontró una sesión vigente de esta red. Inicia sesión y vuelve a exportar el archivo.');
 if(input.origins!==undefined&&(!Array.isArray(input.origins)||input.origins.length>20))throw new Error('Almacenamiento de sesión incompatible.');
 const origins:SessionState['origins']=(input.origins as unknown[]||[]).map(raw=>{
  if(!raw||typeof raw!=='object')throw new Error('Origen de sesión inválido.');
  const o=raw as Record<string,unknown>;let url:URL;try{url=new URL(String(o.origin));}catch{throw new Error('Origen de sesión inválido.');}
  if(url.protocol!=='https:'||url.origin!==o.origin||!allowed(url.hostname,platform)||!Array.isArray(o.localStorage)||o.localStorage.length>300)throw new Error('El almacenamiento pertenece a otra red o es incompatible.');
  const localStorage=o.localStorage.map(raw=>{const item=raw as Record<string,unknown>;if(!item||typeof item.name!=='string'||typeof item.value!=='string'||item.name.length>2048||item.value.length>100000)throw new Error('Almacenamiento de sesión inválido.');return {name:item.name,value:item.value};});
  return {origin:url.origin,localStorage};
 });
 return {cookies,origins};
}
