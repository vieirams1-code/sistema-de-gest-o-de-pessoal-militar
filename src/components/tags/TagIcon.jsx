import React from 'react';
import { Tag as TagLucide } from 'lucide-react';

const ICON_KEYS = new Set(['comandante_maior','subcomandante_maior','comandante_menor','subcomandante_menor','chefia']);
function Star({ cx = 50, cy = 46, rOuter = 22, rInner = 10, ...props }) { const points=[]; for(let i=0;i<10;i+=1){ const a=(-90+i*36)*(Math.PI/180); const r=i%2===0?rOuter:rInner; points.push(`${cx+Math.cos(a)*r},${cy+Math.sin(a)*r}`);} return <polygon points={points.join(' ')} {...props} />; }
function Laurel({ color }) { return <g fill="none" stroke={color} strokeWidth="4" strokeLinecap="round"><path d="M18 70 C20 55, 28 43, 38 36" /><path d="M82 70 C80 55, 72 43, 62 36" /><path d="M24 63 L29 58" /><path d="M29 56 L34 51" /><path d="M34 49 L38 45" /><path d="M76 63 L71 58" /><path d="M71 56 L66 51" /><path d="M66 49 L62 45" /></g>; }
export function isTagIconKey(icon) { return ICON_KEYS.has(String(icon || '')); }
export default function TagIcon({ icon, size = 20, className = '' }) {
  const key = String(icon || '');
  if (!isTagIconKey(key)) return <TagLucide className={className} size={size} aria-hidden="true" />;
  const gold = '#D4AF37'; const silver = '#B8C0CC';
  return <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden="true">
    {key === 'comandante_maior' && <><Laurel color={gold} /><Star fill={gold} stroke={gold} /></>}
    {key === 'subcomandante_maior' && <><Laurel color={silver} /><Star fill={silver} stroke={silver} /></>}
    {(key === 'comandante_menor' || key === 'subcomandante_menor') && <><path d="M50 18 L74 28 L70 60 C67 73 57 81 50 84 C43 81 33 73 30 60 L26 28 Z" fill={key === 'comandante_menor' ? gold : silver} /><Star cx={50} cy={50} rOuter={14} rInner={6} fill={key === 'comandante_menor' ? '#8A6B1D' : '#5D6673'} /></>}
    {key === 'chefia' && <Star fill="none" stroke={gold} strokeWidth="6" />}
  </svg>;
}
