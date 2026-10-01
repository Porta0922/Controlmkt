import { compareSocial, recommendations, type SocialSnapshot } from './social';
import type { ScanResult } from './scan';
export function analyze(current:ScanResult,previous?:Record<string,unknown>){
 const comparable=Boolean(previous?.hash&&previous?.platform===current.platform&&previous?.provider===current.provider);
 const changed=comparable&&previous?.hash!==current.hash;
 const old=comparable?previous?.snapshot as SocialSnapshot|undefined:undefined;
 const changes=current.snapshot?compareSocial(current.snapshot,old):undefined;
 const metricsChanged=Boolean(changes?.metrics.length);
 const failed=current.status>=400;
 const partial=current.snapshot?.coverage==='partial';
 const summary=failed?`Error HTTP ${current.status}`:current.snapshot
  ? !old?'Referencia social guardada.':`${changes!.newPosts} nuevas en muestra · ${changes!.editedPosts} textos modificados · ${changes!.metrics.length} variaciones de métricas · ${changes!.outsideSample} fuera de muestra.`
  :!comparable?'Primer control comparable: referencia guardada.':changed?'Contenido modificado.':'Sin cambios de contenido.';
 return {http_status:current.status,extracted_content:current.content,health:failed?'error':partial||changed||metricsChanged?'alert':'healthy',ai_analysis_result:{title:current.title,hash:failed?null:current.hash,changed,metricsChanged,provider:current.provider,platform:current.platform,engine:'local-rules',summary,snapshot:current.snapshot,changes,recommendations:failed?['Revisa la disponibilidad del sitio y repite el control.']:current.snapshot?recommendations(current.snapshot,changes!,Boolean(old)):changed?['Revisa los cambios de texto y enlaces respecto al control anterior.']:['Continúa monitoreando con intervalos similares.']}};
}
