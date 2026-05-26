import React from 'react';
import { Bike, Settings, Star } from 'lucide-react';

const ICONES_ESPECIAIS = {
  estrela_amarela_comandante: { label: '★ Comandante' },
  estrela_azul_subcomandante: { label: '★ Subcomandante' },
  engrenagem: { label: '⚙️ Engrenagem' },
  moto_socorro: { label: '🏍️ Moto/MOB' },
};

export const CATEGORIAS_ICONE = [
  { nome: 'Símbolos', itens: ['⭐','🌟','✨','💫','⚠️','❗','❓','✅','🛡️','🔰','🏷️','📌','📍','🔔','🎖️'] },
  { nome: 'Pessoas', itens: ['👮','🧑‍🚒','👨‍🚒','👩‍🚒','🧑‍✈️','🧑‍💼','🧑‍⚕️','🧑‍🏫','👥','🫡','🙋','🤝'] },
  { nome: 'Objetos', itens: ['📋','📘','📁','🗂️','🛠️','🔧','🧰','🔦','📻','🧯','🧱','🪓'] },
  { nome: 'Natureza', itens: ['🌱','🌿','🍀','🌳','🌲','🔥','💧','🌊','⛈️','🌤️'] },
  { nome: 'Animais', itens: ['🐶','🐱','🐴','🐺','🦅','🐝','🐢','🐬','🦺'] },
  { nome: 'Alimentos', itens: ['🍎','🍞','☕','🥤','🧃','🍽️'] },
  { nome: 'Atividades', itens: ['🏃','🧗','🚴','🏋️','🧘','🧑‍💻','🧑‍🔧'] },
  { nome: 'Viagens', itens: ['🚗','🚑','🚒','🚌','🚓','🚲','🏍️','🚁','🛶'] },
  { nome: 'Lugares', itens: ['🏢','🏛️','🏫','🏥','🏟️','🏠','🗺️'] },
  { nome: 'Tecnologia', itens: ['💻','🖥️','⌨️','🖨️','📡','🛰️','🔋','🔌'] },
  { nome: 'Negócios', itens: ['📈','📊','💼','🧾','🧮','🏦'] },
  { nome: 'Saúde', itens: ['⚕️','🩺','💊','🧬','🩹','🧪'] },
  { nome: 'Segurança', itens: ['🚨','🧯','🔒','🔐','🪖','🦺','👮'] },
  { nome: 'Esportes', itens: ['⚽','🏀','🏐','🎯','🥇','🏆'] },
  { nome: 'Artes', itens: ['🎨','🎭','🎬','🎵','📷'] },
  { nome: 'Sinais', itens: ['⬆️','⬇️','⬅️','➡️','↔️','🔄','🆗','🅿️'] },
  { nome: 'Bandeiras', itens: ['🇧🇷','🏳️','🏴','🚩','🏁'] },
];

const TERMOS_EMOJI = {
  '⭐': 'estrela simbolo destaque', '⚠️': 'alerta atencao cuidado', '🛡️': 'escudo seguranca', '🔰': 'graduacao chefia',
  '🚒': 'operacional bombeiro', '🚑': 'socorro ambulancia', '🚗': 'viatura carro', '🚌': 'onibus', '🧗': 'altura',
  '📻': 'radio comunicacao', '💻': 'tecnologia computador', '🛠️': 'manutencao ferramenta', '⚕️': 'saude medicina', '📋': 'administrativo checklist', '📘': 'curso livro',
};

function EstrelaInstitucional({ color }) {
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border shadow-sm" style={{ borderColor: `${color}99`, backgroundColor: `${color}22` }}>
      <Star className="h-3.5 w-3.5 fill-current" style={{ color }} />
    </span>
  );
}

export function renderIconeCatalogoValue(value) {
  if (!value) return '🏷️';
  if (value === 'sem_icone') return '🏷️';
  if (value === 'estrela_amarela_comandante') return <EstrelaInstitucional color="#D4A017" />;
  if (value === 'estrela_azul_subcomandante') return <EstrelaInstitucional color="#2563EB" />;
  if (value === 'engrenagem') return <Settings className="h-4 w-4 text-slate-700" />;
  if (value === 'moto_socorro') return <Bike className="h-4 w-4 text-emerald-700" />;
  return value;
}

export default function IconeCatalogo({ value }) {
  return <>{renderIconeCatalogoValue(value)}</>;
}

const opcoesCategorias = CATEGORIAS_ICONE.flatMap((categoria) => categoria.itens.map((emoji) => ({
  value: emoji,
  label: `${emoji} ${categoria.nome}`,
  termos: `${categoria.nome.toLowerCase()} ${(TERMOS_EMOJI[emoji] || '')}`.trim(),
})));

export const OPCOES_ICONE_CATALOGO = [
  { value: '', label: 'Sem ícone', termos: 'sem icone nenhum' },
  ...opcoesCategorias,
  { value: 'estrela_amarela_comandante', label: ICONES_ESPECIAIS.estrela_amarela_comandante.label, termos: 'comandante institucional' },
  { value: 'estrela_azul_subcomandante', label: ICONES_ESPECIAIS.estrela_azul_subcomandante.label, termos: 'subcomandante institucional' },
  { value: 'engrenagem', label: ICONES_ESPECIAIS.engrenagem.label, termos: 'engrenagem configuracao' },
  { value: 'moto_socorro', label: ICONES_ESPECIAIS.moto_socorro.label, termos: 'moto mob socorro' },
];
