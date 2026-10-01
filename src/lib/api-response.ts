export async function readApiResponse(response:Response) {
 const body=await response.text();
 let data;
 try {data=JSON.parse(body);} catch {
  const timeout=response.status===504||response.headers.get('x-vercel-error')?.includes('TIMEOUT');
  throw new Error(timeout?'La lectura tardó demasiado. Reintenta o analiza una publicación directa.':`No pudimos completar la lectura (${response.status}). El servidor devolvió una respuesta vacía o inválida. Reintenta en unos momentos.`);
 }
 if(!response.ok)throw new Error(data?.error||`No se pudo completar la solicitud (${response.status}).`);
 return data;
}
