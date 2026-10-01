import http from 'node:http';
import https from 'node:https';
import { load } from 'cheerio';
import { createHash } from 'node:crypto';
import { validateUrl } from './db';
import { publicTarget } from './public-url';
import { renderPage } from './browser';
import { detectPlatform, platformNames } from './platform';
import { extractSocial, digest, type SocialSnapshot } from './social';
import { ScanError } from './scan-error';
export type ScanResult = {status:number;title:string;content:string;hash:string;platform:ReturnType<typeof detectPlatform>;provider:'http'|'playwright';snapshot?:SocialSnapshot};
async function download(input: string, redirects = 0): Promise<{status: number; html: string}> {
  const {url,address} = await publicTarget(validateUrl(input));
  return new Promise((resolve, reject) => {
    const request = (url.protocol === 'https:' ? https : http).get(url, { headers: {'User-Agent':'ControlMKT/1.0','Accept':'text/html'}, lookup: (_host, _opts, callback) => callback(null, address.address, address.family) }, response => {
      const status = response.statusCode ?? 0;
      if ([301,302,303,307,308].includes(status) && response.headers.location) { response.resume(); if (redirects >= 4) return reject(new Error('Demasiadas redirecciones.')); download(new URL(response.headers.location,url).toString(), redirects + 1).then(resolve,reject); return; }
      if (!response.headers['content-type']?.includes('text/html')) { response.resume(); resolve({status,html:''}); return; }
      const chunks: Buffer[] = []; let size = 0;
      response.on('data', chunk => { size += chunk.length; if (size > 2_000_000) { response.destroy(new Error('La página supera 2 MB.')); return; } chunks.push(chunk); });
      response.on('error', reject); response.on('end', () => resolve({status, html:Buffer.concat(chunks).toString('utf8')}));
    });
    const timer = setTimeout(() => request.destroy(new Error('Tiempo de espera agotado.')), 15000);
    request.on('close', () => clearTimeout(timer)); request.on('error', reject);
  });
}
export async function scan(url:string,method='auto'):Promise<ScanResult> {
 const platform=detectPlatform(url);const provider=platform!=='web'||method==='browser'?'playwright':'http';
 const page=provider==='playwright'?await renderPage(url):await download(url);const {status,html}=page;
 if(platform!=='web'){
  if(status>=400)throw new ScanError(`${platformNames[platform]} respondió HTTP ${status}. No hay estadísticas confirmadas.`,status);
  const finalUrl='finalUrl' in page&&typeof page.finalUrl==='string'?page.finalUrl:url;
  if(detectPlatform(finalUrl)!==platform)throw new Error('La red redirigió a otro sitio; no se confirmaron estadísticas.');
  try{
   const snapshot=extractSocial(html,finalUrl);const content=snapshot.posts.map(p=>p.text).join('\n\n');
   return {status,title:`${platformNames[platform]} · ${snapshot.posts.length} publicaciones en muestra`,content,hash:digest(snapshot.posts.map(post=>({id:post.id,text:post.text,url:post.url}))),platform,provider,snapshot};
  }catch(e){throw new ScanError(e instanceof Error?e.message:'No se pudieron extraer estadísticas.',status,{platform,sessionLoaded:'hasSession'in page?page.hasSession:false});}
 }
 const $=load(html);const title=$('title').first().text().trim();$('script,style,nav,footer').remove();
 const content=($('main').text()||$('body').text()).replace(/\s+/g,' ').trim().slice(0,50000);
 if(status<400&&!content)throw new Error('No hay texto HTML accesible. Prueba el modo navegador si la web carga con JavaScript.');
 return {status,title,content,hash:createHash('sha256').update(title+'\n'+content).digest('hex'),platform,provider};
}
