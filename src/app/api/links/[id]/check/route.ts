import { NextResponse } from 'next/server';
import { authenticated } from '@/lib/auth';
import { db,ADMIN_ID } from '@/lib/db';
import { scan } from '@/lib/scan';
import { analyze } from '@/lib/analysis';
import { detectPlatform } from '@/lib/platform';
import { ScanError } from '@/lib/scan-error';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(_request:Request,ctx:{params:Promise<{id:string}>}) {
 try { if (!await authenticated()) return NextResponse.json({error:'Acceso requerido.'},{status:401});
 const {id} = await ctx.params; const client = db(); const {data:link,error} = await client.from('monitored_links').select('*').eq('id',id).eq('user_id',ADMIN_ID).single(); if(error || !link) return NextResponse.json({error:'URL no encontrada.'},{status:404});
 const {data:previous,error:previousError} = await client.from('link_logs').select('ai_analysis_result').eq('link_id',id).not('ai_analysis_result->>hash','is',null).order('checked_at',{ascending:false}).limit(1); if(previousError) throw previousError;
 const {data:token,error:claimError}=await client.rpc('claim_link_check',{p_link_id:id,p_user_id:ADMIN_ID});if(claimError)throw claimError;if(!token)return NextResponse.json({error:'El enlace ya tiene un control en curso o está pausado.'},{status:409});
 let result; try { result=analyze(await scan(link.url,link.check_method),previous?.[0]?.ai_analysis_result); } catch(e) { result = {http_status:e instanceof ScanError?e.httpStatus:0,extracted_content:'',ai_analysis_result:{engine:'local-rules',platform:detectPlatform(link.url),diagnostic:e instanceof ScanError?e.diagnostic:undefined,summary:e instanceof Error ? e.message : 'Error de conexión',recommendations:detectPlatform(link.url)==='x'?['Importa o renueva la sesión de X desde Conectar redes. Si el acceso sigue bloqueado, las métricas no pueden confirmarse con esta lectura.']:['Reintenta más tarde o controla una publicación pública directa. Si la red exige sesión, sus estadísticas no pueden confirmarse con este método.']},health:'error'}; }
 const {health,...log} = result; const {error:logError} = await client.rpc('finish_link_check',{p_link_id:id,p_token:token,p_http_status:log.http_status,p_content:log.extracted_content,p_analysis:log.ai_analysis_result,p_health:health}); if(logError) throw logError; return NextResponse.json(result);
 } catch(e) { return NextResponse.json({error:e instanceof Error ? e.message : 'No se pudo realizar el control.'},{status:500}); }
}
