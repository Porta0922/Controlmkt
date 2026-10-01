import { lookup } from 'node:dns/promises';
import ipaddr from 'ipaddr.js';
export async function publicTarget(input: string) {
  const url = new URL(input);
  if (!['http:','https:'].includes(url.protocol) || url.username || url.password) throw new Error('Usa HTTP/HTTPS sin credenciales.');
  if (url.port && !['80','443'].includes(url.port)) throw new Error('Solo se permiten puertos 80 y 443.');
  const addresses = await lookup(url.hostname.replace(/^\[|\]$/g,''),{all:true});
  if (!addresses.length || addresses.some(a => ipaddr.process(a.address).range() !== 'unicast')) throw new Error('Solo se permiten destinos públicos.');
  return {url,address:addresses[0]};
}
