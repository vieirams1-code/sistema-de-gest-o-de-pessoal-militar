import React, { useState } from 'react';
import {
  FileText,
  AlertCircle,
  CheckCircle2,
  Calendar,
  FileSignature,
  ChevronDown,
  ChevronUp,
  MoreVertical,
  Shield,
  Link2,
  ArrowRightCircle,
  ArrowLeftCircle,
  PauseCircle,
  Heart,
  Moon,
  ArrowRightLeft,
  GraduationCap,
  Award,
  AlertTriangle,
  Sun,
  Share2,
  Navigation,
  Home,
  Target,
  ThumbsUp,
  TrendingUp,
  Layers,
  UserCheck,
  UserMinus,
  Activity,
  Copy,
  Archive,
  Paperclip,
  Ban,
  BookOpen,
  BadgeCheck,
  GitBranch,
  Triangle,
  ExternalLink,
  ClipboardList
} from 'lucide-react';

// ==========================================
// DADOS DE EXEMPLO (MOCK)
// ==========================================
const mockRecords = [
  {
    id: 1,
    name: 'Córdoba',
    rank: 'Asp',
    quadro: 'QOBM',
    mat: '101010',
    actType: 'interrupcao_ferias',
    date: '12/03/2026',
    status: 'Aguardando Nota BG',
    source: 'Livro',
    periodRef: '2023/2024',
    originMode: 'Automática',
    publicationType: 'Ex Officio',
    noteBg: null,
    bgNumber: null,
    hasAttachment: false,
    chainStatus: 'inconsistente',
    chainMessage: 'Evento posterior depende de validação da cadeia de férias.',
    linkedItems: [
      'Férias vinculada #FER-2026-014',
      'Publicação automática',
      'Evento de interrupção na cadeia'
    ],
    generatedAt: '13/03/2026 às 02:42',
    bodyText:
      'O Comandante torna público o Livro de Interrupção de Férias e Outras Concessões de Oficiais e Praças, onde consta a interrupção de férias do militar Asp QOBM Córdoba, matrícula 101010, em 12/03/2026, referente ao período aquisitivo 2023/2024.',
    feriasSnapshot: {
      total: 30,
      gozados: 12,
      saldo: 18
    }
  },
  {
    id: 2,
    name: 'Mendes',
    rank: '1º Sgt',
    quadro: 'QPBM',
    mat: '123123',
    actType: 'inicio_ferias',
    date: '15/03/2026',
    status: 'Gerado',
    source: 'Férias',
    periodRef: '2024/2025',
    originMode: 'Automática',
    publicationType: 'Ex Officio',
    noteBg: 'Nota 021/2026',
    bgNumber: 'BG 045',
    hasAttachment: true,
    chainStatus: 'ok',
    chainMessage: 'Cadeia de férias válida.',
    linkedItems: ['Férias vinculada #FER-2026-021', 'Início da cadeia'],
    generatedAt: '15/03/2026 às 08:10',
    bodyText:
      'O Comandante torna público o início de férias do militar 1º Sgt QPBM Mendes, matrícula 123123, em 15/03/2026, referente ao período aquisitivo 2024/2025.',
    feriasSnapshot: {
      total: 30,
      gozados: 0,
      saldo: 30
    }
  },
  {
    id: 3,
    name: 'Silva',
    rank: 'Cb',
    quadro: 'QPBM',
    mat: '987654',
    actType: 'termino_ferias',
    date: '10/03/2026',
    status: 'Gerado',
    source: 'Livro',
    periodRef: '2023/2024',
    originMode: 'Manual',
    publicationType: 'Ex Officio',
    noteBg: 'Nota 017/2026',
    bgNumber: 'BG 039',
    hasAttachment: false,
    chainStatus: 'ok',
    chainMessage: 'Término coerente com a cadeia.',
    linkedItems: ['Férias vinculada #FER-2026-008', 'Término da cadeia'],
    generatedAt: '10/03/2026 às 11:20',
    bodyText:
      'O Comandante torna público o término de férias do militar Cb QPBM Silva, matrícula 987654, em 10/03/2026.',
    feriasSnapshot: {
      total: 30,
      gozados: 30,
      saldo: 0
    }
  },
  {
    id: 4,
    name: 'Souza',
    rank: 'Ten',
    quadro: 'QOBM',
    mat: '456789',
    actType: 'recompensa',
    date: '20/03/2026',
    status: 'Aguardando Nota BG',
    source: 'Livro',
    periodRef: '-',
    originMode: 'Manual',
    publicationType: 'Ex Officio',
    noteBg: null,
    bgNumber: null,
    hasAttachment: false,
    chainStatus: 'nao_aplicavel',
    chainMessage: 'Sem cadeia de férias associada.',
    linkedItems: ['Registro de livro', 'Dispensa como recompensa'],
    generatedAt: '20/03/2026 às 13:05',
    bodyText:
      'O Comandante torna público o registro de dispensa como recompensa do militar Ten QOBM Souza, matrícula 456789, em 20/03/2026.',
    feriasSnapshot: null
  },
  {
    id: 5,
    name: 'Lima',
    rank: 'Sd',
    quadro: 'QPBM',
    mat: '321321',
    actType: 'curso',
    date: '01/04/2026',
    status: 'Em Análise',
    source: 'Template',
    periodRef: '-',
    originMode: 'Manual',
    publicationType: 'Minuta',
    noteBg: null,
    bgNumber: null,
    hasAttachment: true,
    chainStatus: 'nao_aplicavel',
    chainMessage: 'Sem integração com férias.',
    linkedItems: ['Curso/Estágio', 'Minuta em revisão'],
    generatedAt: '01/04/2026 às 16:40',
    bodyText:
      'Minuta de publicação referente à participação do militar Sd QPBM Lima, matrícula 321321, em curso/estágio a partir de 01/04/2026.',
    feriasSnapshot: null
  }
];

// ==========================================
// MAPA DE TIPOS DE ATO
// ==========================================
const getActDetails = (type) => {
  switch (type) {
    case 'inicio_ferias':
      return { icon: ArrowRightCircle, color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', label: 'Início de Férias', category: 'ferias' };
    case 'termino_ferias':
      return { icon: ArrowLeftCircle, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', label: 'Término de Férias', category: 'ferias' };
    case 'interrupcao_ferias':
      return { icon: PauseCircle, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', label: 'Interrupção de Férias', category: 'ferias' };
    case 'ferias':
      return { icon: Sun, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', label: 'Férias (Geral)', category: 'ferias' };
    case 'nupcias':
      return { icon: Heart, color: 'text-pink-600', bg: 'bg-pink-50', border: 'border-pink-200', label: 'Núpcias', category: 'afastamento' };
    case 'luto':
      return { icon: Moon, color: 'text-slate-700', bg: 'bg-slate-200', border: 'border-slate-300', label: 'Luto', category: 'afastamento' };
    case 'cedencia':
      return { icon: Share2, color: 'text-cyan-700', bg: 'bg-cyan-50', border: 'border-cyan-200', label: 'Cedência', category: 'movimentacao' };
    case 'transferencia':
      return { icon: ArrowRightLeft, color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', label: 'Transferência', category: 'movimentacao' };
    case 'transito':
      return { icon: Navigation, color: 'text-sky-700', bg: 'bg-sky-50', border: 'border-sky-200', label: 'Trânsito', category: 'movimentacao' };
    case 'instalacao':
      return { icon: Home, color: 'text-teal-700', bg: 'bg-teal-50', border: 'border-teal-200', label: 'Instalação', category: 'movimentacao' };
    case 'recompensa':
      return { icon: Award, color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200', label: 'Dispensa (Recompensa)', category: 'administrativo' };
    case 'missoes':
      return { icon: Target, color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200', label: 'Desloc. para Missões', category: 'administrativo' };
    case 'curso':
      return { icon: GraduationCap, color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200', label: 'Cursos / Estágios', category: 'administrativo' };
    case 'elogio':
      return { icon: ThumbsUp, color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200', label: 'Elogio Individual', category: 'assentamento' };
    case 'comportamento':
      return { icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', label: 'Melhoria de Comport.', category: 'assentamento' };
    case 'punicao':
      return { icon: AlertTriangle, color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', label: 'Punição', category: 'assentamento' };
    case 'geral':
      return { icon: Layers, color: 'text-slate-600', bg: 'bg-slate-100', border: 'border-slate-300', label: 'Geral', category: 'administrativo' };
    case 'designacao':
      return { icon: UserCheck, color: 'text-blue-800', bg: 'bg-blue-100', border: 'border-blue-300', label: 'Designação de Função', category: 'assentamento' };
    case 'dispensa_funcao':
      return { icon: UserMinus, color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', label: 'Dispensa de Função', category: 'assentamento' };
    case 'jiso':
      return { icon: Activity, color: 'text-rose-500', bg: 'bg-rose-50', border: 'border-rose-200', label: 'Ata JISO', category: 'saude' };
    case 'transcricao':
      return { icon: Copy, color: 'text-slate-500', bg: 'bg-slate-50', border: 'border-slate-200', label: 'Transcrição de Doc.', category: 'administrativo' };
    case 'rr':
      return { icon: Archive, color: 'text-zinc-700', bg: 'bg-zinc-200', border: 'border-zinc-300', label: 'Transferência para RR', category: 'assentamento' };
    case 'apostila':
      return { icon: Paperclip, color: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-200', label: 'Apostila', category: 'publicacao' };
    case 'tornar_sem_efeito':
      return { icon: Ban, color: 'text-red-800', bg: 'bg-red-100', border: 'border-red-300', label: 'Tornar sem Efeito', category: 'publicacao' };
    default:
      return { icon: FileText, color: 'text-slate-700', bg: 'bg-slate-100', border: 'border-slate-200', label: 'Ato Administrativo', category: 'administrativo' };
  }
};

const getStatusBadge = (status) => {
  const normalized = (status || '').toLowerCase();

  if (normalized.includes('aguardando')) {
    return 'bg-amber-100 text-amber-800 border-amber-200';
  }
  if (normalized.includes('análise')) {
    return 'bg-blue-100 text-blue-800 border-blue-200';
  }
  if (normalized.includes('inválid') || normalized.includes('inconsist')) {
    return 'bg-red-100 text-red-800 border-red-200';
  }
  return 'bg-slate-100 text-slate-700 border-slate-200';
};

const getChainBadge = (chainStatus) => {
  switch (chainStatus) {
    case 'ok':
      return {
        icon: BadgeCheck,
        className: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        label: 'Integridade OK'
      };
    case 'inconsistente':
      return {
        icon: Triangle,
        className: 'bg-red-100 text-red-800 border-red-200',
        label: 'Inconsistente'
      };
    default:
      return {
        icon: GitBranch,
        className: 'bg-slate-100 text-slate-700 border-slate-200',
        label: 'Sem Cadeia'
      };
  }
};

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================
export default function App() {
  const [expandedIds, setExpandedIds] = useState(new Set([1]));

  const toggleExpand = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-[#f3f4f6] p-4 md:p-8 font-sans text-slate-800">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-end mb-2">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
              Controle de Publicações
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Análise, validação, rastreabilidade e integridade de atos administrativos.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button className="px-4 py-2 bg-white border border-slate-300 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
              Filtros
            </button>
            <button className="px-4 py-2 bg-slate-900 text-white rounded-md text-sm font-medium hover:bg-slate-800 transition-colors">
              Nova Publicação
            </button>
          </div>
        </div>

        {mockRecords.map((record) => (
          <ProRecordCard
            key={record.id}
            data={record}
            isExpanded={expandedIds.has(record.id)}
            onToggle={() => toggleExpand(record.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ==========================================
// CARD DE REGISTRO
// ==========================================
function ProRecordCard({ data, isExpanded, onToggle }) {
  const actDetails = getActDetails(data.actType);
  const ActIcon = actDetails.icon;
  const isPending = (data.status || '').toLowerCase().includes('aguardando');
  const chainBadge = getChainBadge(data.chainStatus);
  const ChainIcon = chainBadge.icon;
  const militaryDisplayName = `${data.rank} ${data.quadro} ${data.name}`;

  return (
    <div
      className={`bg-white rounded-xl shadow-sm border transition-all duration-200 ${
        isExpanded
          ? 'border-slate-300 shadow-md ring-1 ring-slate-100'
          : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      <div
        className="px-6 py-4 flex flex-col md:flex-row md:items-start justify-between cursor-pointer select-none border-b border-transparent data-[expanded=true]:border-slate-100 group"
        data-expanded={isExpanded}
        onClick={onToggle}
      >
        <div className="flex items-start gap-5 min-w-0">
          <div className="hidden sm:flex h-12 w-12 rounded-full bg-slate-50 border border-slate-200 items-center justify-center text-slate-400 group-hover:bg-slate-100 transition-colors shrink-0">
            <Shield size={22} strokeWidth={1.5} />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-1.5">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight leading-none">
                {militaryDisplayName}
              </h2>

              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border ${getStatusBadge(
                  data.status
                )}`}
              >
                {data.status}
              </span>

              <span
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide border ${chainBadge.className}`}
              >
                <ChainIcon size={12} />
                {chainBadge.label}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 text-sm text-slate-600">
              <span className="font-medium text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                Mat: {data.mat}
              </span>

              <span className="hidden sm:block w-1 h-1 rounded-full bg-slate-300"></span>

              <span
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded uppercase text-[10px] font-bold tracking-wide border ${actDetails.bg} ${actDetails.color} ${actDetails.border}`}
              >
                <ActIcon size={14} strokeWidth={2.5} />
                {actDetails.label}
              </span>

              <span className="hidden sm:block w-1 h-1 rounded-full bg-slate-300"></span>

              <span className="flex items-center gap-1.5 font-medium">
                <Calendar size={14} className="text-slate-400" />
                {data.date}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-4 md:mt-0 shrink-0">
          <button
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
            onClick={(e) => e.stopPropagation()}
            title="Mais ações"
          >
            <MoreVertical size={20} />
          </button>
          <div className="w-px h-6 bg-slate-200"></div>
          <button className="p-2 text-slate-400 group-hover:text-slate-800 group-hover:bg-slate-100 rounded-md transition-colors">
            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="flex flex-col xl:flex-row">
          <div className="flex-1 p-6 xl:border-r border-slate-100 space-y-8">
            {data.chainStatus === 'inconsistente' && (
              <section className="bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-red-100 rounded-lg text-red-700 mt-0.5">
                    <AlertTriangle size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-red-900 mb-1">
                      Inconsistência detectada
                    </h3>
                    <p className="text-sm text-red-800">{data.chainMessage}</p>
                  </div>
                </div>
              </section>
            )}

            <section>
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <ClipboardList size={14} />
                Identificação do Ato
              </h3>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <DataBlock label="Militar" value={militaryDisplayName} />
                <DataBlock label="Matrícula" value={data.mat} />
                <DataBlock label="Ato Registrado" value={actDetails.label} />
                <DataBlock label="Período Ref." value={data.periodRef} />
                <DataBlock label="Data Efetiva" value={data.date} />
                <DataBlock label="Tipo de Publicação" value={data.publicationType} />
                <DataBlock label="Posto/Graduação" value={data.rank} />
                <DataBlock label="Quadro" value={data.quadro} />
              </div>
            </section>

            <section>
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <BookOpen size={14} />
                Origem e Vínculos
              </h3>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <DataBlock label="Origem do Ato" value={data.source} />
                <DataBlock label="Modo de Geração" value={data.originMode} />
                <DataBlock label="Nota BG" value={data.noteBg || 'Pendente'} />
                <DataBlock label="Número do BG" value={data.bgNumber || 'Pendente'} />
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <span className="block text-[10px] uppercase font-semibold text-slate-400 mb-2">
                  Vínculos Relacionados
                </span>
                <div className="flex flex-wrap gap-2">
                  {data.linkedItems.map((item, index) => (
                    <span
                      key={index}
                      className="text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md px-2.5 py-1"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </section>

            {actDetails.category === 'ferias' && data.feriasSnapshot && (
              <section>
                <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Sun size={14} />
                  Estado da Cadeia de Férias
                </h3>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <MetricBox label="Dias no Momento" value={`${data.feriasSnapshot.total} dias`} />
                    <MetricBox label="Gozados" value={`${data.feriasSnapshot.gozados} dias`} />
                    <MetricBox label="Saldo" value={`${data.feriasSnapshot.saldo} dias`} />
                  </div>

                  <div>
                    <div className="flex justify-between items-end mb-2">
                      <span className="text-sm font-medium text-slate-700">
                        Consumo da Fração
                      </span>
                      <span className="text-sm font-bold text-slate-900">
                        {data.feriasSnapshot.gozados} / {data.feriasSnapshot.total} dias
                      </span>
                    </div>

                    <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden flex">
                      <div
                        className="bg-slate-800 h-full"
                        style={{
                          width: `${Math.min(
                            100,
                            (data.feriasSnapshot.gozados / data.feriasSnapshot.total) * 100
                          )}%`
                        }}
                      ></div>
                    </div>

                    <div className="flex justify-between mt-2 text-xs text-slate-500">
                      <span>
                        Gozados:{' '}
                        <strong className="text-slate-700">
                          {data.feriasSnapshot.gozados} dias
                        </strong>
                      </span>
                      <span className="flex items-center gap-1 text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        Saldo Remanescente: {data.feriasSnapshot.saldo} dias
                      </span>
                    </div>
                  </div>
                </div>
              </section>
            )}

            <section>
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <FileSignature size={14} />
                Texto da Publicação
              </h3>

              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                  <span className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                    <FileText size={14} />
                    Minuta Gerada
                  </span>

                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>Criado em: {data.generatedAt}</span>
                    {data.hasAttachment && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600">
                        <Paperclip size={12} />
                        Anexo
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-5">
                  <div className="max-h-48 overflow-y-auto text-slate-800 text-sm leading-relaxed pr-1">
                    {data.bodyText}
                  </div>

                  <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-100">
                    <ActionGhostButton icon={Copy} label="Copiar Texto" />
                    <ActionGhostButton icon={ExternalLink} label="Abrir Completo" />
                    <ActionGhostButton icon={BookOpen} label="Abrir Origem" />
                  </div>
                </div>
              </div>
            </section>

            {isPending && (
              <section className="bg-slate-800 rounded-xl p-5 shadow-inner">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-slate-700/50 rounded-lg text-amber-400 mt-1">
                    <AlertCircle size={20} />
                  </div>

                  <div className="flex-1">
                    <h3 className="text-white font-medium mb-1">
                      Ação Requerida: Validar Publicação
                    </h3>
                    <p className="text-slate-400 text-sm mb-4">
                      Insira os dados do Boletim Geral para oficializar este ato.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="flex-1">
                        <label className="sr-only">Nota para BG</label>
                        <input
                          type="text"
                          placeholder="Nota para BG (Ex: 123/2026)"
                          className="w-full bg-slate-900 border border-slate-600 text-white placeholder-slate-500 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                      </div>

                      <div className="flex-1">
                        <label className="sr-only">Número do BG</label>
                        <input
                          type="text"
                          placeholder="Número do BG"
                          className="w-full bg-slate-900 border border-slate-600 text-white placeholder-slate-500 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                      </div>

                      <button className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 whitespace-nowrap">
                        Salvar Registro
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            )}
          </div>

          <div className="w-full xl:w-80 bg-slate-50/60 p-6 space-y-6">
            <section>
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Link2 size={14} />
                Rastreabilidade
              </h3>

              <div className="space-y-3">
                <SideInfoCard
                  icon={BookOpen}
                  title="Origem Principal"
                  value={data.source}
                  subtle={data.originMode}
                />
                <SideInfoCard
                  icon={BadgeCheck}
                  title="Status do Ato"
                  value={data.status}
                  subtle={data.publicationType}
                />
                <SideInfoCard
                  icon={GitBranch}
                  title="Integridade"
                  value={chainBadge.label}
                  subtle={data.chainMessage}
                  alert={data.chainStatus === 'inconsistente'}
                />
              </div>
            </section>

            <section>
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-6 flex items-center gap-2">
                <Calendar size={14} />
                Histórico de Eventos
              </h3>

              <div className="space-y-6 relative before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-slate-300 before:via-slate-200 before:to-transparent">
                <TimelineItem
                  type="start"
                  title="Criação do Registro"
                  date={data.generatedAt}
                  user="Sistema"
                  status="Concluído"
                />

                <TimelineItem
                  type="current"
                  title={actDetails.label}
                  date={data.date}
                  user={militaryDisplayName}
                  status={data.status}
                />

                {data.noteBg && data.bgNumber && (
                  <TimelineItem
                    type="start"
                    title="Vinculação ao BG"
                    date={data.bgNumber}
                    user={data.noteBg}
                    status="Oficializado"
                  />
                )}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// SUBCOMPONENTES
// ==========================================
function DataBlock({ label, value }) {
  return (
    <div>
      <span className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">
        {label}
      </span>
      <span className="block text-sm font-medium text-slate-800">{value}</span>
    </div>
  );
}

function MetricBox({ label, value }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3">
      <span className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">
        {label}
      </span>
      <span className="block text-sm font-bold text-slate-900">{value}</span>
    </div>
  );
}

function SideInfoCard({ icon: Icon, title, value, subtle, alert = false }) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        alert ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`p-2 rounded-lg ${
            alert ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
          }`}
        >
          <Icon size={16} />
        </div>

        <div className="min-w-0">
          <span className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">
            {title}
          </span>
          <div
            className={`text-sm font-semibold ${
              alert ? 'text-red-900' : 'text-slate-900'
            }`}
          >
            {value}
          </div>
          {subtle && (
            <div
              className={`text-xs mt-1 ${
                alert ? 'text-red-700' : 'text-slate-500'
              }`}
            >
              {subtle}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ActionGhostButton({ icon: Icon, label }) {
  return (
    <button className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
      <Icon size={14} />
      {label}
    </button>
  );
}

function TimelineItem({ type, title, date, user, status }) {
  const isCurrent = type === 'current';

  return (
    <div className="relative flex items-center justify-between md:justify-normal group">
      <div
        className={`flex items-center justify-center w-6 h-6 rounded-full border-2 shadow shrink-0 z-10 ${
          isCurrent ? 'bg-blue-50 border-blue-500' : 'bg-slate-100 border-slate-300'
        }`}
      >
        {isCurrent ? (
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
        ) : (
          <CheckCircle2 size={12} className="text-slate-400" />
        )}
      </div>

      <div
        className={`ml-4 w-[calc(100%-2.5rem)] p-3 rounded-lg border ${
          isCurrent
            ? 'bg-white border-blue-200 shadow-sm ring-1 ring-blue-50'
            : 'bg-transparent border-slate-200'
        }`}
      >
        <div className="flex justify-between items-start mb-1">
          <h4 className={`text-sm font-bold ${isCurrent ? 'text-blue-900' : 'text-slate-700'}`}>
            {title}
          </h4>
        </div>
        <p className="text-xs text-slate-500 mb-2">{date}</p>
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 gap-3">
          <span className="text-[10px] text-slate-400 font-medium uppercase truncate">
            {user}
          </span>
          <span
            className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase whitespace-nowrap ${
              isCurrent ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {status}
          </span>
        </div>
      </div>
    </div>
  );
}
