import { chromium } from 'playwright';
import http from 'node:http';
import net from 'node:net';
import { type Socket } from 'node:net';
import { publicTarget } from './public-url';
import { detectPlatform } from './platform';
import { resolve } from 'node:path';
import { access } from 'node:fs/promises';

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
    browser = await chromium.launch({headless:true,timeout:10000,proxy:{server:proxy.url,bypass:'<-loopback>'},args:['--disable-quic','--force-webrtc-ip-handling-policy=disable_non_proxied_udp']});
    const platform=detectPlatform(url);
    const sessionPath=resolve(process.env.SOCIAL_SESSION_DIR||'.local/sessions',`${platform}.json`);
    const hasSession=platform!=='web'&&await access(sessionPath).then(()=>true,()=>false);
    const context = await browser.newContext({locale:'en-US',viewport:{width:1280,height:900},serviceWorkers:'block',acceptDownloads:false,...(hasSession?{storageState:sessionPath}:{})});
    await context.route('**/*',async route=>{
      if (['image','media','font'].includes(route.request().resourceType()) || !/^https?:/.test(route.request().url())) return route.abort();
      return route.continue();
    });
    const page=await context.newPage();
    const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:20000});
    // Una espera corta deja renderizar los contadores; no espera tráfico infinito.
    await page.waitForTimeout(2500);
    const html=await page.content();if(Buffer.byteLength(html)>5_000_000)throw new Error('La página renderizada supera 5 MB.');
    return {html,status:response?.status() ?? 0,finalUrl:page.url(),hasSession};
  } catch(e) {
    if(e instanceof Error && /Executable doesn't exist/.test(e.message))throw new Error('Instala Chromium con npm run browser:install.');
    throw e;
  } finally {await browser?.close();proxy.close();}
}
