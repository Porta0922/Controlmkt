import {selectedNetwork,sessionState} from './session.mjs';
const button=document.querySelector('#save');const status=document.querySelector('#status');
const [tab]=await chrome.tabs.query({active:true,currentWindow:true});const network=selectedNetwork(tab?.url);
document.querySelector('#network').textContent=network?`Red detectada: ${network.label}`:'Abre X, Instagram, TikTok o Facebook en una pestaña e inicia sesión.';
button.disabled=!network;
button.addEventListener('click',async()=>{
  button.disabled=true;status.textContent='Solicitando acceso a las cookies de esta red…';
  try{
    const granted=await chrome.permissions.request({origins:network.domains.map(domain=>`https://*.${domain}/*`)});
    if(!granted)throw new Error('No se concedió acceso a esta red. No se exportó la sesión.');
    const stores=await chrome.cookies.getAllCookieStores();const store=stores.find(store=>store.tabIds.includes(tab.id));
    if(!store)throw new Error('No se encontró el almacén de cookies de esta pestaña.');
    const all=[];for(const domain of network.domains)all.push(...await chrome.cookies.getAll({domain,storeId:store.id}));
    const state=sessionState(all,network);
    if(!state.cookies.length)throw new Error('No hay cookies para guardar. Inicia sesión y vuelve a abrir la extensión.');
    const authenticated=state.cookies.some(cookie=>cookie.name===network.cookie||network.platform==='tiktok'&&['sessionid_ss','sid_tt'].includes(cookie.name));
    if(!authenticated)throw new Error('No se encontró una cookie de sesión reconocida. Completa el inicio de sesión en esta pestaña y reintenta.');
    const url='data:application/json;charset=utf-8,'+encodeURIComponent(JSON.stringify(state,null,2));
    await chrome.downloads.download({url,filename:`${network.platform}.json`,saveAs:true,conflictAction:'overwrite'});
    // El navegador gestiona la descarga. El contenido no se envía por red ni se imprime.
    status.textContent=`Guarda ${network.platform}.json en .local/sessions y luego vuelve a ejecutar el control. Una sesión exportada puede requerir renovarse.`;
  }catch(error){status.textContent=error.message||'No se pudo guardar la sesión.';}
  finally{button.disabled=false;}
});
