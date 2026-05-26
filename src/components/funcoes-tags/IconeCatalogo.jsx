import React from 'react';
import { Bike, Settings, Star } from 'lucide-react';

const ICONES_ESPECIAIS = {
  estrela_amarela_comandante: { label: '★ Comandante' },
  estrela_azul_subcomandante: { label: '★ Subcomandante' },
  engrenagem: { label: '⚙️ Engrenagem' },
  moto_socorro: { label: '🏍️ Moto/MOB' },
};

function EstrelaInstitucional({ color }) {
  return (
    <span
      className="inline-flex h-5 w-5 items-center justify-center rounded-full border shadow-sm"
      style={{ borderColor: `${color}99`, backgroundColor: `${color}22` }}
    >
      <Star className="h-3.5 w-3.5 fill-current" style={{ color }} />
    </span>
  );
}

export function renderIconeCatalogoValue(value) {
  if (!value) return '🏷️';
  if (value === 'estrela_amarela_comandante') return <EstrelaInstitucional color="#D4A017" />;
  if (value === 'estrela_azul_subcomandante') return <EstrelaInstitucional color="#2563EB" />;
  if (value === 'engrenagem') return <Settings className="h-4 w-4 text-slate-700" />;
  if (value === 'moto_socorro') return <Bike className="h-4 w-4 text-emerald-700" />;
  return value;
}

export default function IconeCatalogo({ value }) {
  return <>{renderIconeCatalogoValue(value)}</>;
}

export const OPCOES_ICONE_CATALOGO = [
  { value: '⭐', label: '⭐ Estrela institucional' },
  { value: '🛡️', label: '🛡️ Escudo' },
  { value: '🔰', label: '🔰 Graduação/chefia' },
  { value: '🚒', label: '🚒 Operacional' },
  { value: '🚑', label: '🚑 Socorro' },
  { value: '🚗', label: '🚗 Viatura' },
  { value: '🚌', label: '🚌 Ônibus' },
  { value: '🧗', label: '🧗 Altura' },
  { value: '⚠️', label: '⚠️ Alerta' },
  { value: '📻', label: '📻 Rádio' },
  { value: '💻', label: '💻 Tecnologia' },
  { value: '🛠️', label: '🛠️ Manutenção' },
  { value: '⚕️', label: '⚕️ Saúde' },
  { value: '📋', label: '📋 Administrativo' },
  { value: '📘', label: '📘 Curso' },
  { value: 'estrela_amarela_comandante', label: ICONES_ESPECIAIS.estrela_amarela_comandante.label },
  { value: 'estrela_azul_subcomandante', label: ICONES_ESPECIAIS.estrela_azul_subcomandante.label },
  { value: 'engrenagem', label: ICONES_ESPECIAIS.engrenagem.label },
  { value: 'moto_socorro', label: ICONES_ESPECIAIS.moto_socorro.label },

];

