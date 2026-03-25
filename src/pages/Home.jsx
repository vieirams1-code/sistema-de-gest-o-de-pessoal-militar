import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { getPunicaoEntity } from '@/services/justicaDisciplinaService';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Users, Award, Shield, AlertTriangle, Calendar, Star,
  FileText, BookOpen, ClipboardList, Gavel, Activity,
  ChevronRight, Clock, CheckCircle, Stethoscope
} from 'lucide-react';
import { differenceInDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function StatCard({ icon: Icon, value, label, color, onClick }) {
  return (
    <div
      className={`bg-white rounded-xl p-6 shadow-sm border border-slate-200 cursor-pointer hover:shadow-md transition-shadow`}
      onClick={onClick}
    >
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-lg ${color} flex items-center justify-center`}>
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <p className="text-3xl font-bold text-slate-800">{value ?? '—'}</p>
          <p className="text-sm text-slate-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

function AlertItem({ nivel, titulo, subtitulo, diasRestantes }) {
  const cores = {
    critico: 'bg-red-50 border-red-200 text-red-800',
    atencao: 'bg-orange-50 border-orange-200 text-orange-800',
    aviso:   'bg-amber-50 border-amber-200 text-amber-800',
  };
  const textDias = {
    critico: 'text-red-600',
    atencao: 'text-orange-600',
    aviso:   'text-amber-600',
  };
  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border ${cores[nivel]}`}>
      <div>
        <p className="text-sm font-medium">{titulo}</p>
        <p className="text-xs opacity-75">{subtitulo}</p>
      </div>
      {diasRestantes !== undefined && (
        <span className={`text-sm font-bold whitespace-nowrap ml-4 ${textDias[nivel]}`}>
          {diasRestantes}d
        </span>
      )}
    </div>
  );
}

function ShortcutButton({ icon: Icon, label, to, navigate }) {
  return (
    <Button
      variant="outline"
      className="h-20 flex-col gap-1 hover:bg-slate-50 hover:border-[#1e3a5f] transition-colors"
      onClick={() => navigate(createPageUrl(to))}
    >
      <Icon className="w-6 h-6 text-[#1e3a5f]" />
      <span className="text-xs text-slate-600">{label}</span>
    </Button>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const punicaoEntity = getPunicaoEntity();
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const dataFormatada = format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  const { data: militares = [] } = useQuery({
    queryKey: ['militares-ativos'],
    queryFn: () => base44.entities.Militar.filter({ status_cadastro: 'Ativo' }),
  });

  const { data: periodos = [] } = useQuery({
    queryKey: ['periodos-aquisitivos'],
    queryFn: () => base44.entities.PeriodoAquisitivo.list(),
  });

  const { data: atestados = [] } = useQuery({
    queryKey: ['atestados-ativos'],
    queryFn: () => base44.entities.Atestado.list(),
  });

  const { data: punicoes = [] } = useQuery({
    queryKey: ['punicoes-ativas'],
    queryFn: () => punicaoEntity.list(),
  });

  const { data: armamentos = [] } = useQuery({
    queryKey: ['armamentos'],
    queryFn: () => base44.entities.Armamento.list(),
  });

  const { data: registrosLivro = [] } = useQuery({
    queryKey: ['registros-livro-recentes'],
    queryFn: () => base44.entities.RegistroLivro.list('-created_date'),
  });

  const { data: publicacoesUrgentes = [] } = useQuery({
    queryKey: ['publicacoes-urgentes'],
    queryFn: async () => {
      const [exofficio, livro] = await Promise.all([
        base44.entities.PublicacaoExOfficio.list('-created_date'),
        base44.entities.RegistroLivro.list('-created_date'),
      ]);
      return [...exofficio, ...livro].filter(p => p.status !== 'Publicado' && (p.urgente || p.importante));
    },
  });
  const { data: pendenciasComportamento = [] } = useQuery({
    queryKey: ['dashboard-pendencias-comportamento'],
    queryFn: () => base44.entities.PendenciaComportamento.filter({ status_pendencia: 'Pendente' }),
  });

  // Alertas de férias por nível
  const periodosAlerta = periodos.filter(p => {
    if (!p.data_limite_gozo) return false;
    if (p.status === 'Gozado' || p.status === 'Inativo') return false;
    const limite = new Date(p.data_limite_gozo + 'T00:00:00');
    const dias = differenceInDays(limite, hoje);
    return dias >= 0 && dias <= 180;
  }).map(p => {
    const dias = differenceInDays(new Date(p.data_limite_gozo + 'T00:00:00'), hoje);
    return { ...p, diasRestantes: dias, nivel: dias <= 30 ? 'critico' : dias <= 60 ? 'atencao' : 'aviso' };
  }).sort((a, b) => a.diasRestantes - b.diasRestantes);

  const atestadosAtivos = atestados.filter(a => a.status === 'Ativo' || a.status === 'Em Curso');
  const punicoesAtivas = punicoes.filter(p => p.status_punicao === 'Ativa' || p.status_punicao === 'Em Curso');
  const totalAlertas = periodosAlerta.length + publicacoesUrgentes.length + pendenciasComportamento.length;
  const registrosRecentes = registrosLivro.slice(0, 5);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Cabeçalho */}
        <div className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h1 className="text-3xl font-bold text-[#1e3a5f]">{saudacao} 👋</h1>
              <p className="text-slate-500 capitalize">{dataFormatada}</p>
            </div>
            {totalAlertas > 0 && (
              <Badge className="bg-red-100 text-red-700 border border-red-200 text-sm px-3 py-1">
                <AlertTriangle className="w-4 h-4 mr-1 inline" />
                {totalAlertas} alerta{totalAlertas > 1 ? 's' : ''} pendente{totalAlertas > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={Users} value={militares.length} label="Militares Ativos"
            color="bg-[#1e3a5f]/10 text-[#1e3a5f]"
            onClick={() => navigate(createPageUrl('Militares'))}
          />
          <StatCard
            icon={Stethoscope} value={atestadosAtivos.length} label="Atestados Ativos"
            color="bg-blue-100 text-blue-600"
            onClick={() => navigate(createPageUrl('Atestados'))}
          />
          <StatCard
            icon={Gavel} value={punicoesAtivas.length} label="Punições Ativas"
            color="bg-red-100 text-red-600"
            onClick={() => navigate(createPageUrl('Punicoes'))}
          />
          <StatCard
            icon={Shield} value={armamentos.length} label="Armamentos"
            color="bg-slate-100 text-slate-600"
            onClick={() => navigate(createPageUrl('Armamentos'))}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

          {/* Alertas Consolidados */}
          <div className="lg:col-span-2 space-y-4">

            {/* Férias vencendo */}
            {periodosAlerta.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-amber-500" />
                    <h2 className="font-semibold text-slate-800">Férias Vencendo</h2>
                    <Badge className="bg-amber-100 text-amber-700">{periodosAlerta.length}</Badge>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => navigate(createPageUrl('PeriodosAquisitivos'))}>
                    Ver todos <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {periodosAlerta.map(p => (
                    <AlertItem
                      key={p.id}
                      nivel={p.nivel}
                      titulo={`${p.militar_posto ? p.militar_posto + ' ' : ''}${p.militar_nome}`}
                      subtitulo={`Ano ref: ${p.ano_referencia} — Prazo: ${p.data_limite_gozo?.split('-').reverse().join('/')}`}
                      diasRestantes={p.diasRestantes}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Publicações urgentes */}
            {publicacoesUrgentes.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                    <h2 className="font-semibold text-slate-800">Publicações Pendentes</h2>
                    <Badge className="bg-red-100 text-red-700">{publicacoesUrgentes.length}</Badge>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => navigate(createPageUrl('Publicacoes'))}>
                    Ver todas <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {publicacoesUrgentes.map(p => (
                    <AlertItem
                      key={p.id}
                      nivel={p.urgente ? 'critico' : 'aviso'}
                      titulo={`${p.militar_posto ? p.militar_posto + ' ' : ''}${p.militar_nome}`}
                      subtitulo={`${p.tipo || p.tipo_registro} — ${p.status}`}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Pendências de comportamento */}
            {pendenciasComportamento.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-indigo-500" />
                    <h2 className="font-semibold text-slate-800">Pendências de Comportamento</h2>
                    <Badge className="bg-indigo-100 text-indigo-700">{pendenciasComportamento.length}</Badge>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => navigate(createPageUrl('AvaliacaoComportamento'))}>
                    Validar <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {pendenciasComportamento.slice(0, 10).map((p) => (
                    <AlertItem
                      key={p.id}
                      nivel="atencao"
                      titulo={p.militar_nome}
                      subtitulo={`${p.comportamento_atual || 'Bom'} → ${p.comportamento_sugerido} (${p.data_detectada || 'sem data'})`}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Estado limpo */}
            {totalAlertas === 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 flex flex-col items-center justify-center text-center">
                <CheckCircle className="w-12 h-12 text-green-400 mb-3" />
                <h2 className="font-semibold text-slate-700 text-lg">Tudo em dia!</h2>
                <p className="text-slate-400 text-sm mt-1">Nenhum alerta pendente no momento.</p>
              </div>
            )}
          </div>

          {/* Atividade Recente */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-5 h-5 text-[#1e3a5f]" />
              <h2 className="font-semibold text-slate-800">Atividade Recente</h2>
            </div>
            {registrosRecentes.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">Nenhum registro recente.</p>
            ) : (
              <div className="space-y-3">
                {registrosRecentes.map(r => (
                  <div key={r.id} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#1e3a5f]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <BookOpen className="w-4 h-4 text-[#1e3a5f]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">
                        {r.militar_posto ? `${r.militar_posto} ` : ''}{r.militar_nome}
                      </p>
                      <p className="text-xs text-slate-400 truncate">{r.tipo_registro}</p>
                      {r.created_date && (
                        <p className="text-xs text-slate-300 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          {new Date(r.created_date).toLocaleDateString('pt-BR')}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Button variant="ghost" size="sm" className="w-full mt-4 text-[#1e3a5f]" onClick={() => navigate(createPageUrl('Livro'))}>
              Ver Livro completo <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>

        {/* Atalhos Rápidos */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-[#1e3a5f] mb-4">Atalhos Rápidos</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            <ShortcutButton icon={Users}         label="Efetivo"       to="Militares"              navigate={navigate} />
            <ShortcutButton icon={BookOpen}      label="Livro"         to="Livro"                  navigate={navigate} />
            <ShortcutButton icon={Calendar}      label="Férias"        to="Ferias"                 navigate={navigate} />
            <ShortcutButton icon={FileText}      label="Publicações"   to="Publicacoes"            navigate={navigate} />
            <ShortcutButton icon={Stethoscope}   label="Atestados"     to="Atestados"              navigate={navigate} />
            <ShortcutButton icon={Gavel}         label="Punições"      to="Punicoes"               navigate={navigate} />
            <ShortcutButton icon={Award}         label="Medalhas"      to="Medalhas"               navigate={navigate} />
            <ShortcutButton icon={ClipboardList} label="Qd. Operac."   to="QuadroOperacional"      navigate={navigate} />
          </div>
        </div>

      </div>
    </div>
  );
}
