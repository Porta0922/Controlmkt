'use client';
import {useEffect,useState} from 'react';
import {readApiResponse} from '@/lib/api-response';
import {sessionPlatforms,type SessionPlatform} from '@/lib/session-state';
import {platformNames} from '@/lib/platform';
type Saved={platform:string;updatedAt:string};
export default function SessionManager({onClose}:{onClose:()=>void}){
 const [saved,setSaved]=useState<Saved[]>([]),[busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');
 async function refresh(){setSaved(await readApiResponse(await fetch('/api/social-sessions',{cache:'no-store'})));}
 useEffect(()=>{void refresh().catch(e=>setError(e.message));},[]);
 async function upload(platform:SessionPlatform,file:File){setBusy(platform);setError('');setNotice('');try{
  if(file.size>550000)throw new Error('El archivo supera 550 KB. Vuelve a exportar solo la sesión de esta red.');
  let state;try{state=JSON.parse(await file.text());}catch{throw new Error('Selecciona el archivo JSON exportado de esta red.');}
  await readApiResponse(await fetch('/api/social-sessions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({platform,state})}));
  await refresh();setNotice(`Sesión de ${platformNames[platform]} guardada. Actualiza las métricas para comprobar el acceso.`);
 }catch(e){setError((e as Error).message);}finally{setBusy('');}}
 async function remove(platform:SessionPlatform){setBusy(platform);setError('');setNotice('');try{await readApiResponse(await fetch(`/api/social-sessions?platform=${platform}`,{method:'DELETE'}));await refresh();setNotice('Sesión importada eliminada.');}catch(e){setError((e as Error).message);}finally{setBusy('');}}
 return <section className="bg-white rounded-xl border border-gray-200 p-6 mb-8" aria-label="Conectar redes"><div className="flex items-start justify-between gap-4"><div><h2 className="font-semibold text-lg">Conectar redes</h2><p className="text-sm text-gray-500 mt-2">Inicia sesión en tu navegador, exporta la sesión con la extensión de ControlMKT e importa el archivo de cada red.</p></div><button onClick={onClose}>Cerrar</button></div>
  {error&&<p role="alert" className="bg-red-50 text-red-800 rounded-lg p-3 mt-4">{error}</p>}{notice&&<p role="status" className="bg-emerald-50 text-emerald-800 rounded-lg p-3 mt-4">{notice}</p>}
  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-5">{sessionPlatforms.map(platform=>{const session=saved.find(item=>item.platform===platform);return <div key={platform} className="border border-gray-200 rounded-xl p-4 space-y-3"><h3 className="font-semibold">{platformNames[platform]}</h3><p className={`text-xs ${session?'text-emerald-700':'text-gray-500'}`}>{session?'Sesión guardada':'Sin sesión importada'}</p>{session&&<p className="text-xs text-gray-500">Importada: {new Date(session.updatedAt).toLocaleString('es-PY')}</p>}<label className="text-xs">{busy===platform?'Guardando…':session?'Reemplazar sesión':'Importar sesión JSON'}<input aria-label={`Importar sesión de ${platformNames[platform]}`} className="mt-2 text-xs" type="file" accept=".json,application/json" disabled={!!busy} onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void upload(platform,file);}}/></label>{session&&<button className="text-xs" disabled={!!busy} onClick={()=>void remove(platform)}>Eliminar sesión importada</button>}</div>;})}</div>
  <p className="text-xs text-gray-500 mt-5">La sesión se guarda cifrada en un almacén privado de Supabase. No guardamos tu contraseña. La red puede pedir una nueva verificación aunque el archivo sea válido.</p>
 </section>;
}
