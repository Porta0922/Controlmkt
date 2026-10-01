// Facebook puede responder varios objetos JSON separados por líneas y un prefijo anti-XSSI.
export function parseNetworkData(raw:string):unknown[]{
 const body=raw.replace(/^\s*for\s*\(;;\);\s*/,'').trim();
 try{return [JSON.parse(body)];}catch{}
 const result:unknown[]=[];for(const line of body.split('\n').slice(0,100)){try{result.push(JSON.parse(line));}catch{}}
 return result;
}
