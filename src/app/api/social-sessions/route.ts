import {NextResponse} from 'next/server';
import {authenticated} from '@/lib/auth';
import {isSessionPlatform,validateSessionState} from '@/lib/session-state';
import {listSessions,saveSession,removeSession} from '@/lib/stored-sessions';
export const runtime='nodejs';
const failure=(e:unknown)=>NextResponse.json({error:e instanceof Error?e.message:'No se pudo gestionar la sesión.'},{status:400});
export async function GET(){try{if(!await authenticated())return NextResponse.json({error:'Acceso requerido.'},{status:401});return NextResponse.json(await listSessions(),{headers:{'Cache-Control':'no-store'}});}catch(e){return failure(e);}}
export async function POST(request:Request){try{
 if(!await authenticated())return NextResponse.json({error:'Acceso requerido.'},{status:401});
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw new Error('Importa un archivo JSON.');
 const reader=request.body?.getReader();if(!reader)throw new Error('El archivo está vacío.');
 let size=0;const chunks:Uint8Array[]=[];
 while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>600000){await reader.cancel();throw new Error('La sesión supera el límite de 600 KB.');}chunks.push(value);}
 let input;try{input=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new Error('El archivo no contiene JSON válido.');}
 if(!isSessionPlatform(input.platform))throw new Error('Selecciona una red válida.');
 const state=validateSessionState(input.state,input.platform);await saveSession(input.platform,state);
 return NextResponse.json({saved:true},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return failure(e);}}
export async function DELETE(request:Request){try{if(!await authenticated())return NextResponse.json({error:'Acceso requerido.'},{status:401});const platform=new URL(request.url).searchParams.get('platform');if(!isSessionPlatform(platform))throw new Error('Selecciona una red válida.');await removeSession(platform);return NextResponse.json({removed:true});}catch(e){return failure(e);}}
