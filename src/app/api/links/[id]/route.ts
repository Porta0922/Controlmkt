import { NextResponse } from 'next/server';
import { authenticated } from '@/lib/auth';
import { db,ADMIN_ID } from '@/lib/db';
export async function GET(_r: Request,ctx: {params:Promise<{id:string}>}) { if (!await authenticated()) return NextResponse.json({error:'Acceso requerido.'},{status:401}); const {id} = await ctx.params; const {data,error} = await db().from('link_logs').select('*').eq('link_id',id).order('checked_at',{ascending:false}).limit(100); return NextResponse.json(error ? {error:error.message}:data,{status:error?400:200}); }
export async function DELETE(_r: Request,ctx: {params:Promise<{id:string}>}) { if (!await authenticated()) return NextResponse.json({error:'Acceso requerido.'},{status:401}); const {id} = await ctx.params; const {error} = await db().from('monitored_links').delete().eq('id',id).eq('user_id',ADMIN_ID); return NextResponse.json(error?{error:error.message}:{ok:true},{status:error?400:200}); }
