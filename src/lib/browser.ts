import { chromium } from 'playwright-core';
import http from 'node:http';
import net from 'node:net';
import { type Socket } from 'node:net';
import { publicTarget } from './public-url';
import { detectPlatform } from './platform';
import { resolve } from 'node:path';
import { access } from 'node:fs/promises';
import { ScanError } from './scan-error';
import { loadStoredSession } from './stored-sessions';
import { parseNetworkData } from './network-data';
// Todas las conexiones del navegador pasan por este proxy local. Se resuelve y
// fija la IP pública para evitar accesos a la red privada y DNS rebinding.
async function publicProxy() {
  const sockets = new Set<Socket>();
  const server = http.createServer((request,response) => {
    void (async () => {
      const {url,address} = await publicTarget(request.url || '');
      if (url.protocol !== 'http:') throw new Error('Usa CONNECT para HTTPS.');
      const headers = {...request.headers}; delete headers['proxy-authorization']; delete headers['proxy-connection'];
      const upstream = http.request(url,{method:request.method,headers,lookup:(_host,_opts,callback)=>callback(null,address.address,address.family)}, remote => {
        response.writeHead(remote.statusCode || 502,remote.headers); remote.pipe(response);
      });
      upstream.setTimeout(15000,()=>upstream.destroy());
      upstream.on('error',()=>{if(!response.headersSent)response.writeHead(502);response.end();});
      response.on('close',()=>upstream.destroy()); request.pipe(upstream);
    })().catch(()=>{response.writeHead(403);response.end('Destino no permitido.');});
  });
  server.on('connection',socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));socket.setTimeout(30000,()=>socket.destroy());});
  server.on('connect',(request,socket,head)=>{
    void (async()=>{
      const {url,address} = await publicTarget(`https://${request.url}`);
      const tunnel = net.connect({host:address.address,port:Number(url.port || 443)});
      sockets.add(tunnel);tunnel.on('close',()=>sockets.delete(tunnel));tunnel.setTimeout(30000,()=>tunnel.destroy());
      tunnel.on('connect',()=>{socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');if(head.length)tunnel.write(head);tunnel.pipe(socket);socket.pipe(tunnel);});
      tunnel.on('error',()=>socket.destroy());socket.on('error',()=>tunnel.destroy());socket.on('close',()=>tunnel.destroy());
    })().catch(()=>{socket.end('HTTP/1.1 403 Forbidden\r\n\r\n');});
  });
  await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const address=server.address();if(!address || typeof address==='string')throw new Error('No se pudo abrir el proxy.');
  return {url:`http://127.0.0.1:${address.port}`,close:()=>{for(const socket of sockets)socket.destroy();server.close();}};
}
export async function renderPage(url: string) {
  await publicTarget(url);
  const proxy = await publicProxy();
  let browser;
  try {
    const cloud = process.env.VERCEL && process.platform === 'linux' ? (await import('@sparticuz/chromium')).default : null;
    browser = await chromium.launch({...(cloud?{executablePath:await cloud.executablePath()}:{}),headless:true,timeout:10000,proxy:{server:proxy.url,bypass:'<-loopback>'},args:[...(cloud?cloud.args.filter(arg=>arg!=='--single-process'):[]),'--disable-quic','--force-webrtc-ip-handling-policy=disable_non_proxied_udp']});
    const platform=detectPlatform(url);
    const sessionPath=resolve(process.env.SOCIAL_SESSION_DIR||'.local/sessions',`${platform}.json`);
    const sessionEnv=platform==='web'?undefined:process.env[`SOCIAL_SESSION_${platform.toUpperCase()}`];
    const importedSession=platform==='web'?undefined:await loadStoredSession(platform);
    const hasSession=!!importedSession||!!sessionEnv || platform!=='web'&&await access(sessionPath).then(()=>true,()=>false);
    const storageState=importedSession||(sessionEnv?JSON.parse(sessionEnv):sessionPath);
    const context = await browser.newContext({locale:'en-US',viewport:{width:1280,height:900},serviceWorkers:'block',acceptDownloads:false,...(hasSession?{storageState}:{})});
    await context.route('**/*',async route=>{
      if (['image','media','font'].includes(route.request().resourceType()) || !/^https?:/.test(route.request().url())) return route.abort();
      return route.continue();
    });
    const page=await context.newPage();let status=0;
    const networkData:string[]=[];const pending:Promise<void>[]=[];let bytes=0;
    // Solo se observan respuestas que la página solicitó; no se invocan APIs privadas.
    page.on('response',response=>{
      if(response.request().isNavigationRequest()&&response.frame()===page.mainFrame())status=response.status();
      const relevant=platform==='x'?/(UserTweets|TweetDetail|UserByScreenName)/.test(response.url()):platform==='facebook'?/graphql/.test(response.url()):platform==='tiktok'?/item_list|item\/detail|post\/item_list/.test(response.url()):false;
      if(!relevant||!response.ok()||pending.length>=16)return;
      const task=(async()=>{try{const body=await response.text();if(body.length>1_000_000||bytes+body.length>2_000_000)return;bytes+=body.length;for(const json of parseNetworkData(body))networkData.push(JSON.stringify(json).replaceAll('<','\\u003c'));}catch{/* Una respuesta ilegible no es una métrica cero. */}})();pending.push(task);
    });
    try{await page.goto(url,{waitUntil:'domcontentloaded',timeout:20000});}
    catch(e){const closed=e instanceof Error&&/Target page, context or browser has been closed/.test(e.message);throw new ScanError(closed?'El navegador de lectura se cerró inesperadamente. Reintenta la actualización.':`No se pudo abrir ${platform==='web'?'la página':platform}. Reintenta en unos momentos.`,status,{platform,sessionLoaded:hasSession,reason:closed?'browser_closed':'navigation_failed'});}
    if(status>=400)throw new ScanError(`${platform==='x'?'X':platform} no permitió acceder a los datos. ${platform==='x'?'Importa o renueva su sesión desde Conectar redes y vuelve a actualizar.':'Reintenta más tarde o revisa su sesión en Conectar redes.'}`,status,{platform,sessionLoaded:hasSession});
    const fragments:string[]=[];
    if(platform==='x'){
      if(/\/i\/flow\/login|\/account\/access/.test(page.url()))throw new ScanError('X requiere confirmar el acceso. Inicia sesión en tu navegador y vuelve a importar su sesión desde Conectar redes.',status,{platform,sessionLoaded:hasSession});
      await page.locator('article[data-testid="tweet"]').first().waitFor({timeout:10000}).catch(()=>undefined);
      for(let step=0;step<3;step++){
        fragments.push(await page.locator('article[data-testid="tweet"]').evaluateAll(nodes=>nodes.map(node=>node.outerHTML).join('')));
        if(step<2){await page.mouse.wheel(0,850);await page.waitForTimeout(700);}
      }
      await Promise.race([Promise.allSettled(pending),page.waitForTimeout(1500)]);
    }else {
      await page.waitForTimeout(3500);
      if(platform==='facebook'||platform==='tiktok'){await page.mouse.wheel(0,850);await page.waitForTimeout(1500);}
    }
    await Promise.race([Promise.allSettled(pending),page.waitForTimeout(1000)]);
    const visible=await page.locator('body').innerText();
    if(platform==='tiktok'&&/drag the slider|fit the puzzle|verify to continue|complete the puzzle/i.test(visible))throw new ScanError('TikTok solicita una verificación de acceso. Abre el perfil en tu navegador, completa la verificación y exporta una sesión actualizada.',status,{platform,sessionLoaded:hasSession,reason:'captcha'});
    let html=await page.content();
    html+=fragments.join('')+networkData.map(data=>`<script type="application/json">${data}</script>`).join('');
    if(Buffer.byteLength(html)>7_000_000)throw new ScanError('La página renderizada supera 7 MB.',status);
    return {html,status,finalUrl:page.url(),hasSession};
  } catch(e) {
    if(e instanceof Error && /Executable doesn't exist/.test(e.message))throw new Error('Instala Chromium con npm run browser:install.');
    throw e;
  } finally {await browser?.close();proxy.close();}
}
