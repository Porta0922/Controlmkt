import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';

const sites={x:'https://x.com/i/flow/login',instagram:'https://www.instagram.com/accounts/login/',tiktok:'https://www.tiktok.com/login',facebook:'https://www.facebook.com/'};
const platform=process.argv[2];
if(!sites[platform]){console.error('Uso: npm run social:login -- x|instagram|tiktok|facebook');process.exit(1);}
// Este comando es local e interactivo: nunca recibe ni guarda la contraseña.
const directory=resolve(process.env.SOCIAL_SESSION_DIR||'.local/sessions');
await mkdir(directory,{recursive:true});
const browser=await chromium.launch({headless:false});
const rl=createInterface({input:process.stdin,output:process.stdout});
try{
 const context=await browser.newContext();
 const page=await context.newPage();await page.goto(sites[platform],{waitUntil:'domcontentloaded'});
 await rl.question('Inicia sesión en el navegador, completa 2FA y vuelve aquí. Pulsa Enter cuando hayas terminado: ');
 await context.storageState({path:resolve(directory,`${platform}.json`),indexedDB:true});
 console.log(`Sesión guardada para ${platform}. Si caduca, repite este comando.`);
}finally{rl.close();await browser.close();}
