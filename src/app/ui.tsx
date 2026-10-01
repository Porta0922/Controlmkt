'use client';
import {useEffect,useRef,type ReactNode} from 'react';
export function Icon({name,size=20}:{name:string;size?:number}){
 const paths:Record<string,ReactNode>={
  grid:<><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
  chart:<><path d="M4 4v16h16M8 15l4-5 4 3 5-8"/></>,
  accounts:<><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M6 16c0-3 6-3 6 0m3-7h3m-3 5h3"/></>,
  connect:<><path d="m9 15 6-6m-6 9-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2-4 2-2a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0"/></>,
  plus:<path d="M12 5v14M5 12h14"/>,arrow:<path d="M5 12h14m-5-5 5 5-5 5"/>,out:<path d="M8 5H5v14h3m2-7h11m-4-4 4 4-4 4"/>,download:<><path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4"/></>,
  refresh:<><path d="M20 7a9 9 0 0 0-15-2L3 8m0-5v5h5m-4 9a9 9 0 0 0 15 2l2-3m0 5v-5h-5"/></>,search:<><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/></>,heart:<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>,
  eye:<><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
  message:<path d="M21 11a8 8 0 0 1-8 8H6l-4 3V11a9 9 0 0 1 19 0Z"/>,play:<><rect x="3" y="3" width="18" height="18" rx="5"/><path d="m10 8 6 4-6 4Z"/></>,spark:<><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/></>,
  check:<path d="m5 12 4 4L19 6"/>,close:<path d="m6 6 12 12M6 18 18 6"/>,info:<><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/></>,trash:<><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15m-9 4v7m4-7v7"/></>,
 };
 return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]||paths.chart}</svg>;
}
export function Brand(){return <span className="brand"><span className="brand-mark"><svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="m8 22 6-12 4 8 6-12" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"/></svg></span>control<span className="brand-light">mkt</span><span className="brand-dot">.</span></span>;}
export function PlatformBadge({platform,small=false}:{platform:string;small?:boolean}){const labels:Record<string,string>={x:'𝕏',instagram:'◎',tiktok:'♪',facebook:'f',web:'↗'};return <span className={`network-icon network-${platform}${small?' small':''}`} aria-hidden="true">{labels[platform]||'↗'}</span>;}
export function Modal({children,title,onClose,drawer=false}:{children:ReactNode;title:string;onClose:()=>void;drawer?:boolean}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const dialog=ref.current;dialog?.showModal();return ()=>dialog?.close();},[]);
 return <dialog ref={ref} aria-label={title} className={`mkt-dialog ${drawer?'drawer':''}`} onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===ref.current)onClose();}}><div className="dialog-content">{children}</div></dialog>;
}
