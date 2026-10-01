const networks = {
  x: {label:'X / Twitter', domains:['x.com','twitter.com'], cookie:'auth_token'},
  instagram: {label:'Instagram', domains:['instagram.com'], cookie:'sessionid'},
  tiktok: {label:'TikTok', domains:['tiktok.com'], cookie:'sessionid'},
  facebook: {label:'Facebook', domains:['facebook.com'], cookie:'c_user'},
};
export function selectedNetwork(url) {
  let hostname;try{const parsed=new URL(url);if(parsed.protocol!=='https:')return null;hostname=parsed.hostname.toLowerCase();}catch{return null;}
  for(const [platform,config]of Object.entries(networks))if(config.domains.some(domain=>hostname===domain||hostname.endsWith('.'+domain)))return {platform,...config};
  return null;
}
export function sessionState(cookies,network) {
  const unique=new Map();
  for(const cookie of cookies){
    const domain=cookie.domain.replace(/^\./,'').toLowerCase();
    if(!network.domains.some(allowed=>domain===allowed||domain.endsWith('.'+allowed)))continue;
    // Las cookies particionadas requieren un formato distinto; no se transforman silenciosamente.
    if(cookie.partitionKey)continue;
    const value={name:cookie.name,value:cookie.value,domain:cookie.domain,path:cookie.path||'/',expires:cookie.session?-1:cookie.expirationDate??-1,httpOnly:cookie.httpOnly,secure:cookie.secure,sameSite:cookie.sameSite==='no_restriction'?'None':cookie.sameSite==='strict'?'Strict':'Lax'};
    unique.set(`${value.domain}|${value.path}|${value.name}`,value);
  }
  return {cookies:[...unique.values()],origins:[]};
}
