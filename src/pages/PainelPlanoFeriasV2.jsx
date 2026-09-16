import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import CoberturaPlanoFerias from '@/components/ferias/CoberturaPlanoFerias';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  LayoutList,
  Search,
  Users,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import useCoberturaPlano from '@/components/ferias/useCoberturaPlano';
import GeracaoFeriasPlanoV2 from '@/components/ferias/GeracaoFeriasPlanoV2';
import RegistrarPendenciaNaoRespondente from '@/components/ferias/RegistrarPendenciaNaoRespondente';

const MESES = [
  { val: '01', nome: 'Janeiro', curto: 'Jan' },
  { val: '02', nome: 'Fevereiro', curto: 'Fev' },
  { val: '03', nome: 'Março', curto: 'Mar' },
  { val: '04', nome: 'Abril', curto: 'Abr' },
  { val: '05', nome: 'Maio', curto: 'Mai' },
  { val: '06', nome: 'Junho', curto: 'Jun' },
  { val: '07', nome: 'Julho', curto: 'Jul' },
  { val: '08', nome: 'Agosto', curto: 'Ago' },
  { val: '09', nome: 'Setembro', curto: 'Set' },
  { val: '10', nome: 'Outubro', curto: 'Out' },
  { val: '11', nome: 'Novembro', curto: 'Nov' },
  { val: '12', nome: 'Dezembro', curto: 'Dez' },
];

const nomeMes = (val) => MESES.find((m) => m.val === String(val || '').padStart(2, '0'))?.nome || val || '-';
const curtoMes = (val) => MESES.find((m) => m.val === String(val || '').padStart(2, '0'))?.curto || val || '-';

function nomeCurtoCampanha(titulo) {
  return String(titulo || 'Campanha')
    .replace(/^Op[cç][aã]o de F[eé]rias\s*-\s*/i, '')
    .trim() || 'Campanha';
}

function formatarDataBR(dataStr) {
  if (!dataStr) return '-';
  const match = String(dataStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : String(dataStr);
}

function adicionarUmDia(dataStr) {
  if (!dataStr) return '';
  const dt = new Date(`${dataStr}T00:00:00Z`);
  if (Number.isNaN(dt.getTime())) return '';
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10);
}

function regraMes(op, mes, ano) {
  const inicioMes = `${ano}-${mes}-01`;
  const fimMes = new Date(Date.UTC(Number(ano), Number(mes), 0)).toISOString().slice(0, 10);
  const primeiraDataLegal = adicionarUmDia(op?.periodo_fim || '');
  const dataInicio = primeiraDataLegal && primeiraDataLegal > inicioMes ? primeiraDataLegal : inicioMes;
  const permitido = !primeiraDataLegal || (dataInicio >= inicioMes && dataInicio <= fimMes);
  return { permitido, dataInicio: permitido ? dataInicio : '', primeiraDataLegal };
}

function parseDetalhes(valor) {
  if (!valor || valor === '[]') return [];
  try {
    const parsed = JSON.parse(valor);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_err) {
    return [];
  }
}

function mesesDaOpcao(op, numero) {
  const detalhes = parseDetalhes(op?.[`opcao_${numero}_detalhes`]);
  const meses = detalhes
    .map((p) => String(p?.mes || p?.data_inicio?.slice?.(5, 7) || '').padStart(2, '0'))
    .filter((m) => /^\d{2}$/.test(m));
  if (meses.length) return [...new Set(meses)];

  const texto = String(op?.[`opcao_${numero}_meses`] || '');
  const encontrados = texto.match(/\b(0[1-9]|1[0-2])\b/g) || [];
  return [...new Set(encontrados)];
}

function descricaoOpcao(op, numero) {
  const meses = mesesDaOpcao(op, numero);
  return meses.length ? meses.map(nomeMes).join(' + ') : '-';
}

function numeroFracoes(op) {
  if (op?.modalidade === '3_ETAPAS_10') return 3;
  if (op?.modalidade === '2_ETAPAS_15') return 2;
  return 1;
}

function diasPorFracao(op) {
  if (op?.modalidade === '3_ETAPAS_10') return [10, 10, 10];
  if (op?.modalidade === '2_ETAPAS_15') return [15, 15];
  if (op?.modalidade === 'CUSTOM') return [Math.max(1, Number(op?.dias_direito || 30))];
  return [30];
}

function nomeModalidade(op) {
  if (op?.modalidade === '3_ETAPAS_10') return 'Fracionada · 10 + 10 + 10 dias';
  if (op?.modalidade === '2_ETAPAS_15') return 'Fracionada · 15 + 15 dias';
  if (op?.modalidade === 'CUSTOM') return `Integral · ${Math.max(1, Number(op?.dias_direito || 30))} dias`;
  return 'Integral · 30 dias';
}

function decisaoAtual(op) {
  return parseDetalhes(op?.decisao_camada_1_detalhes)
    .map((p) => ({
      mes: String(p?.mes || p?.data_inicio?.slice?.(5, 7) || '').padStart(2, '0'),
      dias: Number(p?.dias || 0),
    }))
    .filter((p) => /^\d{2}$/.test(p.mes));
}

function statusOpcao(op) {
  if (op?.sem_resposta) return { label: 'Não respondeu', cls: 'bg-red-50 text-red-700 border-red-200' };
  if (op?.gerado_ferias_efetivas) return { label: 'Gerado', cls: 'bg-blue-50 text-blue-700 border-blue-200' };
  if (op?.nao_respondeu_no_prazo && !(op?.status_camada_1 && op.status_camada_1 !== 'Pendente')) {
    return { label: 'Não respondeu no prazo', cls: 'bg-red-50 text-red-700 border-red-200' };
  }
  if (op?.status_camada_1 === 'Nao_Contemplado' || op?.decisao_camada_1_opcao === 'NAO_CONTEMPLADO') {
    return { label: 'Não contemplado', cls: 'bg-slate-100 text-slate-600 border-slate-200' };
  }
  if (op?.status_camada_1 && op.status_camada_1 !== 'Pendente') {
    return { label: 'Definido', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  }
  return { label: 'Pendente', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
}

export default function PainelPlanoFeriasV2() {
  const { isAdmin = false, canAccessAction = () => false, userEmail } = useCurrentUser();
  const podeAprovar = isAdmin || canAccessAction('perm_aprovar_ferias');
  const podeVerCobertura = isAdmin || canAccessAction('perm_visualizar_respostas_ferias') || canAccessAction('perm_aprovar_ferias');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [planos, setPlanos] = useState([]);
  const [campanhas, setCampanhas] = useState([]);
  const [planoId, setPlanoId] = useState(searchParams.get('planoId') || '');
  const [campanhaAtual, setCampanhaAtual] = useState(null);
  const [opcoes, setOpcoes] = useState([]);
  const [publicoAlvo, setPublicoAlvo] = useState([]);
  const [militaresSelecionados, setMilitaresSelecionados] = useState([]);
  const [visao, setVisao] = useState('lista');
  const coberturaQuery = useCoberturaPlano(planoId, podeVerCobertura && visao === 'cobertura' && !loading, userEmail);
  const cobertura = coberturaQuery.data || [];
  const coberturaCarregada = coberturaQuery.isSuccess;
  const carregandoCobertura = coberturaQuery.isFetching;
  const podeCriarCampanha = (isAdmin || canAccessAction('visualizar_planos_ferias')) && planos.some((p) => p.id === planoId && p.status === 'ATIVO');
  const [busca, setBusca] = useState('');
  const [filtroCampanha, setFiltroCampanha] = useState('TODAS');
  const [filtroStatus, setFiltroStatus] = useState('TODOS');
  const [filtroMes, setFiltroMes] = useState('TODOS');

  const [selecionado, setSelecionado] = useState(null);
  const [mesesGestor, setMesesGestor] = useState([]);

  const carregar = async (idPlano = '') => {
    setLoading(true);
    setFeedback(null);
    try {
      const planosRes = await base44.functions.invoke('portal_servicos', { acao: 'PLANO_INSTITUCIONAL_LISTAR' });
      const listaPlanos = planosRes.data?.planos || [];
      setPlanos(listaPlanos);

      const planoAlvo = idPlano || searchParams.get('planoId') || listaPlanos.find((p) => p.status === 'ATIVO')?.id || listaPlanos[0]?.id || '';
      const escalaRes = await base44.functions.invoke('portal_servicos', {
        acao: 'PLANO_ESCALA_LISTAR',
        plano_id: planoAlvo || undefined,
      });

      const listaCampanhas = escalaRes.data?.campanhas || [];
      const opcoesRecebidas = escalaRes.data?.opcoes || [];
      const publicoAlvoRecebido = escalaRes.data?.publico_alvo || [];
      const campanhasPlano = planoAlvo
        ? listaCampanhas.filter((c) => c.plano_ferias_institucional_id === planoAlvo)
        : listaCampanhas;
      const ativa = campanhasPlano.find((c) => c.status === 'Aberta_Coleta' || c.status === 'Ativa') || campanhasPlano[0] || null;

      setPlanoId(planoAlvo);
      setCampanhas(listaCampanhas);
      setCampanhaAtual(ativa);
      setOpcoes(opcoesRecebidas);
      setPublicoAlvo(publicoAlvoRecebido);
      setMilitaresSelecionados([]);
      setVisao('lista');
      setSelecionado(null);
      setFiltroCampanha('TODAS');

      if (planoAlvo && searchParams.get('planoId') !== planoAlvo) {
        const next = new URLSearchParams(searchParams);
        next.set('planoId', planoAlvo);
        setSearchParams(next, { replace: true });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err?.message || 'Não foi possível carregar o painel.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar(searchParams.get('planoId') || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get('planoId')]);

  const planoAtual = useMemo(() => planos.find((p) => p.id === planoId) || null, [planos, planoId]);
  const campanhasDoPlano = useMemo(
    () => campanhas.filter((c) => c.plano_ferias_institucional_id === planoId),
    [campanhas, planoId],
  );

  const linhasPainel = useMemo(() => {
    const publicoPorMilitar = new Map(
      publicoAlvo
        .map((militar) => [String(militar.militar_id || ''), militar])
        .filter(([id]) => Boolean(id)),
    );
    const idsComResposta = new Set(opcoes.map((op) => String(op.militar_id || '')).filter(Boolean));

    const comResposta = opcoes.map((op) => {
      const publico = publicoPorMilitar.get(String(op.militar_id || ''));
      return {
        ...op,
        campanhas_alvo: publico?.campanhas_alvo || (
          op.campanha_id
            ? [{ campanha_id: op.campanha_id, titulo: op.campanha_titulo || '' }]
            : []
        ),
      };
    });

    const semResposta = publicoAlvo
      .filter((militar) => !idsComResposta.has(String(militar.militar_id || '')))
      .map((militar) => ({
        ...militar,
        id: `publico:${militar.militar_id}`,
        sem_resposta: true,
        periodo_inicio: '',
        periodo_fim: '',
        modalidade: '',
        status_camada_1: '',
      }));

    return [...comResposta, ...semResposta].sort((a, b) => (
      String(a.militar_nome || '').localeCompare(String(b.militar_nome || ''), 'pt-BR')
    ));
  }, [opcoes, publicoAlvo]);

  const totalPublico = useMemo(() => {
    const ids = new Set([
      ...publicoAlvo.map((m) => String(m.militar_id || '')).filter(Boolean),
      ...opcoes.map((o) => String(o.militar_id || '')).filter(Boolean),
    ]);
    return ids.size;
  }, [publicoAlvo, opcoes]);

  const totalRespondidos = useMemo(() => (
    new Set(opcoes.filter((o) => !o.nao_respondeu_no_prazo).map((o) => String(o.militar_id || '')).filter(Boolean)).size
  ), [opcoes]);
  const totalSemResposta = useMemo(() => {
    const comRegistro = new Set(opcoes.map((o) => String(o.militar_id || '')).filter(Boolean));
    const pendenciasRegistradas = opcoes.filter((o) => o.nao_respondeu_no_prazo).length;
    return publicoAlvo.filter((m) => !comRegistro.has(String(m.militar_id || ''))).length + pendenciasRegistradas;
  }, [publicoAlvo, opcoes]);
  const totalDefinidos = useMemo(() => new Set(
    opcoes
      .filter((o) => statusOpcao(o).label === 'Definido' || statusOpcao(o).label === 'Gerado')
      .map((o) => String(o.militar_id || ''))
      .filter(Boolean),
  ).size, [opcoes]);
  const totalPendentes = useMemo(() => new Set(
    opcoes
      .filter((o) => statusOpcao(o).label === 'Pendente')
      .map((o) => String(o.militar_id || ''))
      .filter(Boolean),
  ).size, [opcoes]);

  const campanhasFiltro = useMemo(() => campanhasDoPlano
    .map((campanha) => ({ id: campanha.id, nome: nomeCurtoCampanha(campanha.titulo) }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [campanhasDoPlano]);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return linhasPainel.filter((op) => {
      if (termo) {
        const texto = `${op.militar_nome || ''} ${op.militar_posto || ''} ${op.militar_matricula || ''} ${op.lotacao_nome || ''}`.toLowerCase();
        if (!texto.includes(termo)) return false;
      }
      if (filtroCampanha !== 'TODAS') {
        const pertenceCampanha = Array.isArray(op.campanhas_alvo)
          && op.campanhas_alvo.some((campanha) => String(campanha.campanha_id || '') === filtroCampanha);
        if (!pertenceCampanha) return false;
      }
      if (filtroStatus !== 'TODOS' && statusOpcao(op).label !== filtroStatus) return false;
      if (filtroMes !== 'TODOS') {
        const solicitado = [1, 2, 3].some((n) => mesesDaOpcao(op, n).includes(filtroMes));
        if (!solicitado) return false;
      }
      return true;
    });
  }, [linhasPainel, busca, filtroCampanha, filtroStatus, filtroMes]);

  const abrirMilitar = (op) => {
    setSelecionado(op);
    const atual = decisaoAtual(op).map((p) => p.mes);
    setMesesGestor(Array.from({ length: numeroFracoes(op) }, (_, idx) => atual[idx] || ''));
  };

  const fecharDrawer = () => {
    setSelecionado(null);
    setMesesGestor([]);
  };

  const selecionarMes = (indice, mes) => {
    setMesesGestor((prev) => {
      const next = [...prev];
      next[indice] = mes;
      return next;
    });
  };

  const salvarDefinicao = async () => {
    if (!selecionado || !podeAprovar || saving) return;
    const qtd = numeroFracoes(selecionado);
    const escolhidos = mesesGestor.slice(0, qtd);
    if (escolhidos.some((m) => !m)) {
      setFeedback({ type: 'error', message: 'Selecione o mês definitivo de todas as frações.' });
      return;
    }
    if (new Set(escolhidos).size !== escolhidos.length) {
      setFeedback({ type: 'error', message: 'As frações precisam ser definidas em meses diferentes.' });
      return;
    }

    const ano = Number(planoAtual?.ano_referencia || campanhaAtual?.ano_referencia || new Date().getFullYear() + 1);
    const dias = diasPorFracao(selecionado);
    const parcelas = escolhidos.map((mes, idx) => {
      const regra = regraMes(selecionado, mes, ano);
      return {
        etapa: idx + 1,
        dias: dias[idx] || dias[0],
        mes,
        data_inicio: regra.dataInicio,
        permitido: regra.permitido,
        primeiraDataLegal: regra.primeiraDataLegal,
      };
    });

    const invalida = parcelas.find((p) => !p.permitido || !p.data_inicio);
    if (invalida) {
      setFeedback({
        type: 'error',
        message: `O mês escolhido é anterior ao início legal do gozo. Primeira data possível: ${formatarDataBR(invalida.primeiraDataLegal)}.`,
      });
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      const parcelasPayload = parcelas.map(({ permitido, primeiraDataLegal, ...p }) => p);
      const resumo = parcelasPayload.map((p) => `${nomeMes(p.mes)} (${p.dias}d)`).join(' + ');
      await base44.functions.invoke('portal_servicos', {
        acao: 'PLANO_DECISAO_CAMADA_1',
        opcao_id: selecionado.id,
        decisao_camada_1: {
          opcao_escolhida: 'ESCALA_VALIDADA',
          parcelas: parcelasPayload,
          resumo_meses: resumo,
          justificativa: selecionado.justificativa_ajuste_gestor || '',
          gestor_nome: 'Gestor da Unidade',
        },
      });
      setFeedback({ type: 'success', message: `Férias de ${selecionado.militar_nome} definidas: ${resumo}.` });
      await carregar(planoId);
      setSelecionado((prev) => prev ? { ...prev, status_camada_1: 'Ajustado_Pelo_Gestor', decisao_camada_1_detalhes: JSON.stringify(parcelasPayload) } : prev);
    } catch (err) {
      setFeedback({ type: 'error', message: err?.message || 'Falha ao salvar a definição.' });
    } finally {
      setSaving(false);
    }
  };

  const registrarPendencia = async (justificativa) => {
    if (!selecionado?.sem_resposta || !podeAprovar || saving) return;
    const campanhaAlvo = (selecionado.campanhas_alvo || [])[0];
    if (!campanhaAlvo?.campanha_id) {
      setFeedback({ type: 'error', message: 'Não foi possível identificar a campanha deste militar.' });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      const res = await base44.functions.invoke('registrarNaoRespondenteFerias', {
        plano_id: planoId,
        campanha_id: campanhaAlvo.campanha_id,
        militar_alvo_id: selecionado.militar_id,
        justificativa,
      });
      setFeedback({ type: 'success', message: res.data?.message || 'Pendência registrada.' });
      setSelecionado(null);
      await carregar(planoId);
    } catch (err) {
      setFeedback({ type: 'error', message: err?.response?.data?.error || err?.message || 'Falha ao registrar a pendência.' });
    } finally {
      setSaving(false);
    }
  };

  const distribuicao = useMemo(() => {
    const mapa = Object.fromEntries(MESES.map((m) => [m.val, []]));
    opcoes.forEach((op) => {
      decisaoAtual(op).forEach((p) => {
        if (mapa[p.mes]) mapa[p.mes].push(op);
      });
    });
    return mapa;
  }, [opcoes]);

  const abrirCobertura = () => { setSelecionado(null); setVisao('cobertura'); };

  const alternarCobertura = (militarId) => setMilitaresSelecionados((atuais) => atuais.includes(militarId) ? atuais.filter((id) => id !== militarId) : [...atuais, militarId]);
  const alternarTodosCobertura = () => setMilitaresSelecionados((atuais) => atuais.length === cobertura.length ? [] : cobertura.map((m) => m.militar_id));
  const criarCampanhaSelecionados = () => navigate(`/PlanosFerias?planoId=${encodeURIComponent(planoId)}&novaCampanha=1&militares=${encodeURIComponent(militaresSelecionados.join(','))}`);

  if (loading) {
    return (
      <div className="min-h-[65vh] flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 rounded-full border-4 border-slate-200 border-t-blue-700 animate-spin" />
        <p className="text-sm text-slate-500 font-medium">Carregando Painel Plano de Férias...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className={`transition-all duration-200 ${selecionado ? 'xl:pr-[410px]' : ''}`}>
        <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1800px] mx-auto">
          <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="w-11 h-11 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center">
                  <CalendarDays className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-2xl font-black text-slate-900">{planoAtual?.titulo || 'Painel Plano de Férias'}</h1>
                    <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                      {planoAtual?.status === 'ATIVO' ? 'Em andamento' : (planoAtual?.status || 'Plano')}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    Definição simples dos meses definitivos de férias por militar.
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
                <span>Ano de referência: <strong className="text-slate-700">{planoAtual?.ano_referencia || '-'}</strong></span>
                <span>Campanhas vinculadas: <strong className="text-slate-700">{campanhasDoPlano.length}</strong></span>
                <span>Escopo estimado: <strong className="text-slate-700">{totalPublico}</strong> militares</span>
              </div>
            </div>

            {planos.length > 1 && (
              <div className="w-full xl:w-[340px]">
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Plano selecionado</label>
                <select
                  value={planoId}
                  onChange={(e) => {
                    const next = new URLSearchParams(searchParams);
                    next.set('planoId', e.target.value);
                    setSearchParams(next);
                  }}
                  className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                >
                  {planos.map((p) => <option key={p.id} value={p.id}>{p.titulo} · {p.ano_referencia}</option>)}
                </select>
              </div>
            )}
          </div>

          <GeracaoFeriasPlanoV2 key={planoId} plano={planoAtual}
            podeAdmin={isAdmin || canAccessAction('admin_campanhas_ferias')}
            podeGerar={isAdmin || canAccessAction('gerar_ferias_campanhas')}
            onGerado={async (message) => { await carregar(planoId); setFeedback({ type: 'success', message }); }}
          />

          {feedback && (
            <div className={`mt-5 rounded-xl border px-4 py-3 text-sm font-medium ${feedback.type === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
              {feedback.message}
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mt-6">
            <Kpi icon={Users} value={totalPublico} label="Militares no plano" tone="blue" />
            <Kpi icon={CheckCircle2} value={totalRespondidos} label="Responderam" tone="green" sub={totalPublico ? `${Math.round((totalRespondidos / totalPublico) * 100)}% do escopo` : ''} />
            <Kpi icon={Clock3} value={totalSemResposta} label="Não responderam" tone="slate" />
            <Kpi icon={CalendarDays} value={totalDefinidos} label="Férias definidas" tone="green" />
            <Kpi icon={AlertTriangle} value={totalPendentes} label="Pendentes de definição" tone="amber" />
            <Kpi icon={Users} value={coberturaCarregada ? cobertura.length : '—'} label="Elegíveis não cobertos" tone={coberturaCarregada && cobertura.length ? 'amber' : 'slate'} sub={!coberturaCarregada ? 'Consulte na aba Cobertura' : ''} />
          </div>

          <div className="mt-6 border-b border-slate-200 flex flex-wrap gap-x-6">
            <button onClick={() => setVisao('lista')} className={`h-11 flex items-center gap-2 text-sm font-bold border-b-2 ${visao === 'lista' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500'}`}>
              <LayoutList className="w-4 h-4" /> Lista de militares
            </button>
            <button onClick={() => setVisao('meses')} className={`h-11 flex items-center gap-2 text-sm font-bold border-b-2 ${visao === 'meses' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500'}`}>
              <BarChart3 className="w-4 h-4" /> Distribuição por mês
            </button>
            {podeVerCobertura && <button onClick={abrirCobertura} className={`h-11 flex items-center gap-2 text-sm font-bold border-b-2 ${visao === 'cobertura' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500'}`}>
              <Users className="w-4 h-4" /> Cobertura
            </button>}
          </div>

          {visao === 'lista' ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[minmax(260px,1.4fr)_minmax(150px,.7fr)_minmax(150px,.7fr)_minmax(150px,.7fr)] gap-3 mt-5">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar por nome, posto, matrícula ou lotação..."
                    className="w-full h-10 rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                  />
                </div>

                <select value={filtroCampanha} onChange={(e) => setFiltroCampanha(e.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700">
                  <option value="TODAS">Todos os grupos / campanhas</option>
                  {campanhasFiltro.map((campanha) => <option key={campanha.id} value={campanha.id}>{campanha.nome}</option>)}
                </select>

                <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700">
                  <option value="TODOS">Todas as situações</option>
                  <option value="Não respondeu">Não respondeu</option>
                  <option value="Não respondeu no prazo">Não respondeu no prazo</option>
                  <option value="Pendente">Pendente</option>
                  <option value="Definido">Definido</option>
                  <option value="Gerado">Gerado</option>
                  <option value="Não contemplado">Não contemplado</option>
                </select>

                <select value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700">
                  <option value="TODOS">Todos os meses solicitados</option>
                  {MESES.map((m) => <option key={m.val} value={m.val}>{m.nome}</option>)}
                </select>
              </div>

              <div className="mt-4 text-xs font-medium text-slate-500">{filtradas.length} registro(s) de militar encontrado(s)</div>

              <div className="mt-3 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1120px] text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                      <tr>
                        <th className="text-left px-4 py-3 font-bold">Militar</th>
                        <th className="text-left px-4 py-3 font-bold">Lotação</th>
                        <th className="text-left px-4 py-3 font-bold">Período aquisitivo</th>
                        <th className="text-left px-4 py-3 font-bold">1ª opção</th>
                        <th className="text-left px-4 py-3 font-bold">2ª opção</th>
                        <th className="text-left px-4 py-3 font-bold">3ª opção</th>
                        <th className="text-left px-4 py-3 font-bold">Modalidade</th>
                        <th className="text-left px-4 py-3 font-bold">Definição</th>
                        <th className="text-left px-4 py-3 font-bold">Situação</th>
                        <th className="w-10" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filtradas.map((op) => {
                        const st = statusOpcao(op);
                        const atual = decisaoAtual(op);
                        return (
                          <tr key={op.id} onClick={() => abrirMilitar(op)} className={`cursor-pointer hover:bg-blue-50/50 transition-colors ${selecionado?.id === op.id ? 'bg-blue-50' : ''}`}>
                            <td className="px-4 py-3">
                              <div className="font-bold text-slate-900">{op.militar_nome || 'Militar'}</div>
                              <div className="text-xs text-slate-500 mt-0.5">{op.militar_posto || '-'} · {op.militar_matricula || 'sem matrícula'}</div>
                            </td>
                            <td className="px-4 py-3 text-slate-600">{op.lotacao_nome || '-'}</td>
                            <td className="px-4 py-3 text-slate-600 text-xs">{op.sem_resposta ? '-' : `${formatarDataBR(op.periodo_inicio)} a ${formatarDataBR(op.periodo_fim)}`}</td>
                            <td className="px-4 py-3 font-medium text-slate-700">{op.sem_resposta ? '-' : descricaoOpcao(op, 1)}</td>
                            <td className="px-4 py-3 font-medium text-slate-700">{op.sem_resposta ? '-' : descricaoOpcao(op, 2)}</td>
                            <td className="px-4 py-3 font-medium text-slate-700">{op.sem_resposta ? '-' : descricaoOpcao(op, 3)}</td>
                            <td className="px-4 py-3 text-slate-600 text-xs">{op.sem_resposta ? '-' : nomeModalidade(op)}</td>
                            <td className="px-4 py-3 text-slate-700 font-semibold text-xs">{atual.length ? atual.map((p) => `${curtoMes(p.mes)} ${p.dias || ''}d`).join(' + ') : '-'}</td>
                            <td className="px-4 py-3"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${st.cls}`}>{st.label}</span></td>
                            <td className="px-2 py-3"><ChevronRight className="w-4 h-4 text-slate-400" /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {filtradas.length === 0 && (
                  <div className="py-12 text-center text-sm text-slate-500">Nenhum militar encontrado com os filtros selecionados.</div>
                )}
              </div>
            </>
          ) : visao === 'cobertura' ? (
            <CoberturaPlanoFerias
              loading={carregandoCobertura || (!coberturaCarregada && !coberturaQuery.isError)}
              error={coberturaQuery.error?.message}
              onRetry={coberturaQuery.refetch}
              podeCriar={podeCriarCampanha}
              militares={cobertura}
              selecionados={militaresSelecionados}
              onToggle={alternarCobertura}
              onToggleTodos={alternarTodosCobertura}
              onCriar={criarCampanhaSelecionados}
            />
          ) : (
            <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mt-5">
              {MESES.map((mes) => {
                const pessoas = distribuicao[mes.val] || [];
                const pct = totalPublico ? Math.min(100, Math.round((pessoas.length / totalPublico) * 100)) : 0;
                return (
                  <div key={mes.val} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-black text-slate-900">{mes.nome}</h3>
                        <p className="text-xs text-slate-500 mt-1">{pessoas.length} militar(es) programado(s)</p>
                      </div>
                      <span className="text-xs font-bold text-blue-700 bg-blue-50 rounded-full px-2 py-1">{pct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 mt-4 overflow-hidden">
                      <div className="h-full rounded-full bg-blue-600" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="mt-4 space-y-2">
                      {pessoas.slice(0, 6).map((p) => (
                        <button key={p.id} type="button" onClick={() => abrirMilitar(p)} className="w-full flex justify-between gap-3 text-left text-xs hover:text-blue-700">
                          <span className="truncate font-semibold">{p.militar_nome}</span>
                          <span className="text-slate-400 shrink-0">{p.militar_posto}</span>
                        </button>
                      ))}
                      {!pessoas.length && <p className="text-xs text-slate-400">Nenhuma definição neste mês.</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {selecionado && (
        <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[405px] bg-white border-l border-slate-200 shadow-2xl overflow-y-auto">
          <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-slate-200 px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-black text-lg text-slate-900">{selecionado.militar_nome}</h2>
                <p className="text-xs text-slate-500 mt-1">{selecionado.militar_posto || '-'} · Matrícula {selecionado.militar_matricula || '-'}</p>
                <p className="text-xs text-slate-500 mt-0.5">{selecionado.lotacao_nome || '-'}</p>
              </div>
              <button type="button" onClick={fecharDrawer} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500"><X className="w-5 h-5" /></button>
            </div>
          </div>

          <div className="px-5 py-5">
            {selecionado.sem_resposta ? (
              <div>
                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <div className="flex items-start gap-3">
                    <Clock3 className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                    <div>
                      <h3 className="font-black text-sm text-red-800">Este militar ainda não respondeu</h3>
                      <p className="text-xs text-red-700 mt-1 leading-relaxed">
                        O militar pertence ao público-alvo do Plano de Férias, mas ainda não enviou suas opções. Por isso não há meses ou período aquisitivo disponíveis para definição pelo gestor.
                      </p>
                    </div>
                  </div>
                </div>

                {Array.isArray(selecionado.campanhas_alvo) && selecionado.campanhas_alvo.length > 0 && (
                  <div className="mt-5">
                    <SectionLabel>Campanha(s) em que está incluído</SectionLabel>
                    <div className="space-y-2">
                      {selecionado.campanhas_alvo.map((campanha) => (
                        <div key={campanha.campanha_id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                          {campanha.titulo || 'Campanha de férias'}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <RegistrarPendenciaNaoRespondente
                  podeRegistrar={podeAprovar}
                  salvando={saving}
                  onRegistrar={registrarPendencia}
                />
              </div>
            ) : (
              <>
            {selecionado.nao_respondeu_no_prazo && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 mb-6">
                <h3 className="font-black text-sm text-red-800">Não respondeu no prazo</h3>
                <p className="text-xs text-red-700 mt-1 leading-relaxed">
                  Pendência registrada por {selecionado.registrado_por_email || 'gestor'}. A definição abaixo é administrativa.
                </p>
                {selecionado.justificativa_administrativa && (
                  <p className="text-xs text-red-700 mt-2 italic">“{selecionado.justificativa_administrativa}”</p>
                )}
              </div>
            )}

            <SectionLabel>Período aquisitivo</SectionLabel>
            <p className="text-sm font-semibold text-slate-700 mb-6">{formatarDataBR(selecionado.periodo_inicio)} a {formatarDataBR(selecionado.periodo_fim)}</p>

            <SectionLabel>Solicitação do militar</SectionLabel>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3 mb-4">
                <span className="text-xs font-bold text-slate-600">Modalidade escolhida</span>
                <span className="rounded-md bg-blue-100 text-blue-700 px-2 py-1 text-xs font-bold">{nomeModalidade(selecionado)}</span>
              </div>
              {[1, 2, 3].map((n) => (
                <div key={n} className="grid grid-cols-[72px_1fr] gap-2 py-2 border-t border-slate-200 first:border-t-0 first:pt-0 text-sm">
                  <span className="text-xs font-bold text-slate-500">{n}ª opção</span>
                  <span className="font-bold text-slate-800">{descricaoOpcao(selecionado, n)}</span>
                </div>
              ))}
            </div>

            <div className="mt-7 pt-6 border-t border-slate-200">
              <h3 className="font-black text-base text-slate-900">Definição do gestor</h3>
              <p className="text-xs text-slate-500 mt-1 mb-4">Escolha somente os meses definitivos. As datas serão calculadas pelo sistema conforme as regras do período aquisitivo.</p>

              {numeroFracoes(selecionado) === 1 ? (
                <IntegralPicker op={selecionado} value={mesesGestor[0] || ''} onChange={(mes) => selecionarMes(0, mes)} />
              ) : (
                <div className="space-y-3">
                  {Array.from({ length: numeroFracoes(selecionado) }).map((_, idx) => {
                    const sugerido = mesesDaOpcao(selecionado, 1)[idx] || '';
                    const dias = diasPorFracao(selecionado)[idx];
                    return (
                      <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <span className="font-black text-sm text-slate-800">{idx + 1}ª fração</span>
                          <span className="text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-md px-2 py-1">{dias} dias</span>
                        </div>
                        <p className="text-xs text-slate-500 mb-2">Mês da 1ª opção do militar: <strong className="text-slate-700">{sugerido ? nomeMes(sugerido) : '-'}</strong></p>
                        <select
                          value={mesesGestor[idx] || ''}
                          onChange={(e) => selecionarMes(idx, e.target.value)}
                          disabled={!podeAprovar || saving || selecionado.gerado_ferias_efetivas}
                          className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 disabled:bg-slate-100"
                        >
                          <option value="">Selecionar mês definitivo...</option>
                          {MESES.map((m) => <option key={m.val} value={m.val}>{m.nome}</option>)}
                        </select>
                      </div>
                    );
                  })}
                </div>
              )}

              {mesesGestor.filter(Boolean).length > 0 && (
                <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
                  <span className="font-bold">Definição:</span>{' '}
                  {mesesGestor.filter(Boolean).map((m, idx) => `${diasPorFracao(selecionado)[idx]} dias em ${nomeMes(m)}`).join(' · ')}
                </div>
              )}

              {!podeAprovar && (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs font-medium text-amber-800">Seu perfil pode consultar as respostas, mas não possui permissão para definir a escala.</div>
              )}

              <Button
                type="button"
                disabled={!podeAprovar || saving || selecionado.gerado_ferias_efetivas}
                onClick={salvarDefinicao}
                className="w-full mt-4 bg-blue-700 hover:bg-blue-800 h-11 font-bold"
              >
                {saving ? 'Salvando...' : (decisaoAtual(selecionado).length ? 'Salvar alteração' : 'Confirmar definição')}
              </Button>

              {selecionado.gerado_ferias_efetivas && (
                <p className="mt-3 text-xs text-center text-slate-500">As férias deste militar já foram geradas e a definição está bloqueada para edição.</p>
              )}
            </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, value, label, sub, tone = 'blue' }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    slate: 'bg-slate-100 text-slate-600',
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm min-h-[108px]">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center ${tones[tone] || tones.blue}`}><Icon className="w-4 h-4" /></div>
        <div>
          <div className="text-2xl leading-none font-black text-slate-900">{value}</div>
          <div className="text-xs font-semibold text-slate-600 mt-1">{label}</div>
        </div>
      </div>
      {sub && <div className="text-xs text-slate-400 mt-3">{sub}</div>}
    </div>
  );
}

function SectionLabel({ children }) {
  return <div className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2">{children}</div>;
}

function IntegralPicker({ op, value, onChange }) {
  const opcoes = [1, 2, 3]
    .map((n) => ({ numero: n, mes: mesesDaOpcao(op, n)[0] || '' }))
    .filter((item) => item.mes);

  return (
    <div>
      <SectionLabel>Escolha rapidamente</SectionLabel>
      <div className="grid grid-cols-3 gap-2">
        {opcoes.map((item) => (
          <button
            key={item.numero}
            type="button"
            onClick={() => onChange(item.mes)}
            className={`rounded-xl border p-3 text-left transition-colors ${value === item.mes ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100' : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/40'}`}
          >
            <span className="block text-[10px] font-bold uppercase text-slate-400">{item.numero}ª opção</span>
            <span className="block text-sm font-black text-slate-800 mt-1">{nomeMes(item.mes)}</span>
          </button>
        ))}
      </div>

      <label className="block text-xs font-bold text-slate-500 mt-4 mb-1.5">Ou escolha outro mês</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">
        <option value="">Selecionar mês...</option>
        {MESES.map((m) => <option key={m.val} value={m.val}>{m.nome}</option>)}
      </select>
    </div>
  );
}