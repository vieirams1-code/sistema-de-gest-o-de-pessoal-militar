import {
  Award,
  Briefcase,
  CalendarDays,
  FileText,
  GraduationCap,
  HeartPulse,
  ShieldAlert,
  Siren,
  TriangleAlert,
  Truck,
} from 'lucide-react';

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

const tipoVisualConfig = [
  {
    key: 'ferias',
    matchers: ['ferias', 'saida ferias', 'inicio', 'continuação', 'continuacao', 'interrupcao', 'retorno'],
    icon: CalendarDays,
    className: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    label: 'Férias',
  },
  {
    key: 'saude',
    matchers: ['atestado', 'jiso', 'homologacao', 'homologação', 'inspecao', 'inspeção', 'cid'],
    icon: HeartPulse,
    className: 'text-rose-700 bg-rose-50 border-rose-200',
    label: 'Saúde',
  },
  {
    key: 'disciplina',
    matchers: ['punicao', 'punição', 'melhoria', 'comportamento', 'disciplin'],
    icon: Siren,
    className: 'text-red-700 bg-red-50 border-red-200',
    label: 'Disciplina',
  },
  {
    key: 'elogio',
    matchers: ['elogio', 'reconhecimento'],
    icon: Award,
    className: 'text-amber-700 bg-amber-50 border-amber-200',
    label: 'Elogio',
  },
  {
    key: 'funcao',
    matchers: ['designacao', 'designação', 'dispensa', 'funcao', 'função', 'nomeacao', 'nomeação'],
    icon: Briefcase,
    className: 'text-indigo-700 bg-indigo-50 border-indigo-200',
    label: 'Função',
  },
  {
    key: 'movimentacao',
    matchers: ['transferencia', 'transferência', 'instalacao', 'instalação', 'cedencia', 'cedência', 'transito', 'trânsito'],
    icon: Truck,
    className: 'text-cyan-700 bg-cyan-50 border-cyan-200',
    label: 'Movimentação',
  },
  {
    key: 'curso',
    matchers: ['curso', 'estagio', 'estágio', 'capacitacao', 'capacitação'],
    icon: GraduationCap,
    className: 'text-violet-700 bg-violet-50 border-violet-200',
    label: 'Curso/Capacitação',
  },
  {
    key: 'missao',
    matchers: ['missao', 'missão', 'deslocamento', 'operacao', 'operação'],
    icon: ShieldAlert,
    className: 'text-sky-700 bg-sky-50 border-sky-200',
    label: 'Missão/Deslocamento',
  },
  {
    key: 'administrativo',
    matchers: ['apostila', 'geral', 'transcricao', 'transcrição', 'documento', 'tornar sem efeito', 'administrativo'],
    icon: FileText,
    className: 'text-slate-700 bg-slate-50 border-slate-200',
    label: 'Administrativo',
  },
  {
    key: 'legado',
    matchers: ['legado_nao_classificado', 'nao classificado', 'não classificado'],
    icon: TriangleAlert,
    className: 'text-orange-700 bg-orange-50 border-orange-200',
    label: 'Legado pendente',
  },
];

export function getRegistroTipoVisual(tipoPublicacao, { isLegadoNaoClassificado = false } = {}) {
  const tipoNormalizado = normalizeText(tipoPublicacao);

  if (isLegadoNaoClassificado) {
    const legado = tipoVisualConfig.find((item) => item.key === 'legado');
    return legado;
  }

  const match = tipoVisualConfig.find((item) => item.matchers.some((matcher) => tipoNormalizado.includes(normalizeText(matcher))));

  if (match) return match;

  return {
    key: 'generico',
    icon: FileText,
    className: 'text-slate-700 bg-slate-50 border-slate-200',
    label: 'Registro administrativo',
  };
}
