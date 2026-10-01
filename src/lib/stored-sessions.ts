import {createCipheriv,createDecipheriv,hkdfSync,randomBytes} from 'node:crypto';
import {db} from './db';
import {validateSessionState,type SessionPlatform,type SessionState} from './session-state';
const bucket='controlmkt-sessions';
const path=(platform:SessionPlatform)=>`admin/${platform}.enc`;
function key(){const secret=process.env.SESSION_SECRET;if(!secret||secret.length<32)throw new Error('Configura SESSION_SECRET antes de importar sesiones.');return Buffer.from(hkdfSync('sha256',secret,'controlmkt','social-sessions-v1',32));}
export function encryptSession(state:SessionState,platform:SessionPlatform){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(),iv);cipher.setAAD(Buffer.from(platform));const data=Buffer.concat([cipher.update(JSON.stringify(state),'utf8'),cipher.final()]);return JSON.stringify({version:1,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')});}
export function decryptSession(raw:string,platform:SessionPlatform){const value=JSON.parse(raw);if(value.version!==1)throw new Error('Versión de sesión incompatible.');const decipher=createDecipheriv('aes-256-gcm',key(),Buffer.from(value.iv,'base64'));decipher.setAAD(Buffer.from(platform));decipher.setAuthTag(Buffer.from(value.tag,'base64'));return validateSessionState(JSON.parse(Buffer.concat([decipher.update(Buffer.from(value.data,'base64')),decipher.final()]).toString('utf8')),platform);}
export async function saveSession(platform:SessionPlatform,state:SessionState){
 const client=db();let {data:existing,error}=await client.storage.getBucket(bucket);
 if(error){const created=await client.storage.createBucket(bucket,{public:false,fileSizeLimit:1000000,allowedMimeTypes:['application/json']});if(created.error&&created.error.statusCode!=='409')throw new Error('No se pudo crear el almacén privado de sesiones.');({data:existing,error}=await client.storage.getBucket(bucket));}
 if(error||!existing||existing.public)throw new Error('El almacén de sesiones debe ser privado.');
 const {error:uploadError}=await client.storage.from(bucket).upload(path(platform),encryptSession(state,platform),{contentType:'application/json',upsert:true});
 if(uploadError)throw new Error('No se pudo guardar la sesión. Revisa la configuración de Supabase Storage.');
}
export async function loadStoredSession(platform:SessionPlatform){
 const client=db();const {data:info,error:infoError}=await client.storage.getBucket(bucket);
 if(infoError){if(infoError.statusCode==='404'||infoError.message.toLowerCase().includes('not found'))return undefined;throw new Error('No se pudo consultar el almacén de sesiones.');}
 if(info.public)throw new Error('El almacén de sesiones debe ser privado.');
 const {data,error}=await client.storage.from(bucket).download(path(platform));
 if(error){if(['404','400'].includes(error.statusCode||'')||error.message.toLowerCase().includes('not found'))return undefined;throw new Error('No se pudo leer la sesión guardada.');}
 try{return decryptSession(await data.text(),platform);}catch{throw new Error('La sesión guardada venció o no se puede descifrar. Vuelve a importarla desde Conectar redes.');}
}
export async function listSessions(){const {data,error}=await db().storage.from(bucket).list('admin');if(error){if(error.message.toLowerCase().includes('not found'))return [];throw new Error('No se pudieron consultar las sesiones.');}return data.filter(file=>file.name.endsWith('.enc')).map(file=>({platform:file.name.replace('.enc',''),updatedAt:file.updated_at||file.created_at}));}
export async function removeSession(platform:SessionPlatform){const {error}=await db().storage.from(bucket).remove([path(platform)]);if(error)throw new Error('No se pudo eliminar la sesión.');}
