import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { extractSocial } from '../src/lib/social';
test('El navegador ejecuta JavaScript antes de extraer estadísticas',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage();
  await page.setContent(`<body><script>setTimeout(()=>{document.body.innerHTML='<article data-testid="tweet"><a href="/brand/status/123">Publicación</a><div data-testid="tweetText">Texto renderizado</div><button data-testid="like" aria-label="25 Likes"></button></article>';},100);</script></body>`);
  await page.waitForSelector('[data-testid="tweet"]');
  const snapshot=extractSocial(await page.content(),'https://x.com/brand/status/123');
  assert.equal(snapshot.posts[0].metrics.likes,25);assert.equal(snapshot.posts[0].text,'Texto renderizado');
 }finally{await browser.close();}
});
