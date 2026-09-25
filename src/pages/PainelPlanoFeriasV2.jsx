import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import CoberturaPlanoFerias from '@/components/ferias/CoberturaPlanoFerias';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import {
  AlertTriangle,
  AlertCircle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  LayoutList,
  Printer,
  RefreshCw,
  Search,
  Users,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import useCoberturaPlano from '@/components/ferias/useCoberturaPlano';
import GeracaoFeriasPlanoV2 from '@/components/ferias/GeracaoFeriasPlanoV2';
import RegistrarPendenciaNaoRespondente from '@/components/ferias/RegistrarPendenciaNaoRespondente';
import useLotacaoFiltro from '@/components/ferias/useLotacaoFiltro';
import useMilitaresComCov from '@/components/ferias/useMilitaresComCov';
import DistribuicaoMensalFerias from '@/components/ferias/DistribuicaoMensalFerias';
import DistribuicaoMensalFeriasImpressao from '@/components/ferias/DistribuicaoMensalFeriasImpressao';
import MultiSelectFiltro from '@/components/militar/MultiSelectFiltro';
import { ordenarMilitaresPorAntiguidadeInstitucional } from '@/utils/antiguidade/ordenacaoMilitarInstitucional';

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

// Meses e datas oficiais calculados pelo serviço para o período aquisitivo da
// resposta. Quando o serviço informa a elegibilidade, o painel usa exatamente
// essa relação, evitando oferecer meses que a validação do backend recusa.
function mesesDisponiveis(op) {
  const meses = op?.resumo_periodo?.meses_disponiveis;
  return Array.isArray(meses) ? meses : null;
}

function motivoIndisponibilidade(op) {
  const resumo = op?.resumo_periodo;
  if (!resumo) return '';
  const esperados = Math.max(1, Number(op?.dias_direito || 30));
  const disponiveis = Number(resumo.dias_sem_previsao || 0);
  if (disponiveis <= 0) {
    return 'Este período aquisitivo não possui dias disponíveis para escalar neste plano.';
  }
  if (disponiveis < esperados) {
    return `Este período possui apenas ${disponiveis} dia(s) disponível(is) e a escala exige ${esperados} dia(s).`;
  }
  if (!resumo.elegivel_plano) {
    if (resumo.limite_fruicao && resumo.primeira_data_legal_gozo && resumo.primeira_data_legal_gozo > resumo.limite_fruicao) {
      return `O prazo limite de fruição deste período (${formatarDataBR(resumo.limite_fruicao)}) já foi ultrapassado.`;
    }
    if (resumo.primeira_data_legal_gozo) {
      return `O direito deste período só pode ser gozado a partir de ${formatarDataBR(resumo.primeira_data_legal_gozo)}, fora do ano deste plano.`;
    }
    return 'Este período aquisitivo não está elegível para este plano.';
  }
  if (mesesDisponiveis(op)?.length === 0) {
    if (resumo.limite_fruicao) {
      return `O prazo limite de fruição deste período (${formatarDataBR(resumo.limite_fruicao)}) já foi ultrapassado e não há mês disponível no plano.`;
    }
    return 'Nenhum mês deste período está disponível para escalar neste plano.';
  }
  return '';
}

function opcoesDeMes(op) {
  const disponiveis = mesesDisponiveis(op);
  if (!disponiveis) return MESES.map((m) => ({ val: m.val, nome: m.nome }));
  const valores = disponiveis
    .map((m) => String(m?.mes || '').padStart(2, '0'))
    .filter((m) => /^\d{2}$/.test(m));
  // Mantém visível uma definição já salva mesmo que o mês deixe de ser oferecido.
  decisaoAtual(op).forEach((p) => { if (!valores.includes(p.mes)) valores.push(p.mes); });
  return [...new Set(valores)].map((val) => ({ val, nome: nomeMes(val) }));
}

function regraMes(op, mes, ano, disponiveis) {
  if (disponiveis) {
    const regra = disponiveis.find((m) => String(m?.mes || '').padStart(2, '0') === String(mes || '').padStart(2, '0'));
    return { permitido: Boolean(regra?.data_inicio), dataInicio: regra?.data_inicio || '', primeiraDataLegal: '' };
  }
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
  if (op?.nao_gozo_no_plano) return { label: 'Optou por não gozar', cls: 'bg-violet-50 text-violet-700 border-violet-200' };
  if (op?.status_camada_1 === 'Pendente_Reanalise') {
    return { label: 'Reanálise', cls: 'bg-orange-50 text-orange-700 border-orange-300' };
  }
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
  const [filtroLotacao, setFiltroLotacao] = useState([]);
  const lotacaoFiltro = useLotacaoFiltro(filtroLotacao, userEmail);
  const militaresCov = useMilitaresComCov();

  const [selecionado, setSelecionado] = useState(null);
  const [emitidoEm, setEmitidoEm] = useState(new Date());
  const [mesesGestor, setMesesGestor] = useState([]);
  const [modoIntegral, setModoIntegral] = useState(false);
  const [saneando, setSaneando] = useState(false);
  const [reatribuindo, setReatribuindo] = useState(false);
  const [previaPendencia, setPreviaPendencia] = useState({ loading: false, data: null, error: '' });
  const [feedbackPendencia, setFeedbackPendencia] = useState(null);

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
      // A lotação do cadastro do militar é a fonte oficial: o registro de resposta
      // guarda apenas o snapshot do envio e fica desatualizado após movimentações.
      const lotacaoAtual = publico?.lotacao_id
        ? { lotacao_id: publico.lotacao_id, lotacao_nome: publico.lotacao_nome }
        : { lotacao_id: op.lotacao_id || '', lotacao_nome: op.lotacao_nome || '' };
      return {
        ...op,
        ...lotacaoAtual,
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
  const totalNaoGozo = useMemo(() => new Set(
    opcoes
      .filter((o) => o.nao_gozo_no_plano === true)
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
      if (lotacaoFiltro.idsSelecionados && !lotacaoFiltro.idsSelecionados.has(String(op.lotacao_id || ''))) return false;
      if (filtroStatus !== 'TODOS' && statusOpcao(op).label !== filtroStatus) return false;
      if (filtroMes !== 'TODOS') {
        const solicitado = [1, 2, 3].some((n) => mesesDaOpcao(op, n).includes(filtroMes));
        if (!solicitado) return false;
      }
      return true;
    });
  }, [linhasPainel, busca, filtroCampanha, filtroStatus, filtroMes, lotacaoFiltro.idsSelecionados]);

  // Consulta a mesma regra canônica usada no registro: informa ao gestor, antes de
  // qualquer ação, se existe período elegível e quantos dias serão liberados.
  const carregarPreviaPendencia = async (op) => {
    const campanhaAlvo = (op?.campanhas_alvo || [])[0];
    if (!planoId || !campanhaAlvo?.campanha_id) {
      setPreviaPendencia({ loading: false, data: null, error: 'Não foi possível identificar a campanha deste militar.' });
      return;
    }
    setPreviaPendencia({ loading: true, data: null, error: '' });
    try {
      const res = await base44.functions.invoke('registrarNaoRespondenteFerias', {
        preview: true,
        plano_id: planoId,
        campanha_id: campanhaAlvo.campanha_id,
        militar_alvo_id: op.militar_id,
      });
      setPreviaPendencia({ loading: false, data: res.data || null, error: '' });
    } catch (err) {
      setPreviaPendencia({
        loading: false,
        data: null,
        error: err?.response?.data?.error || err?.message || 'Não foi possível verificar o período aquisitivo deste militar.',
      });
    }
  };

  const abrirMilitar = (op) => {
    setFeedback(null);
    setFeedbackPendencia(null);
    setPreviaPendencia({ loading: false, data: null, error: '' });
    setSelecionado(op);
    const atual = decisaoAtual(op).map((p) => p.mes);
    // Se a escala já foi salva como integral, reabre nesse modo mesmo que a
    // modalidade original informada pelo militar seja fracionada.
    setModoIntegral(numeroFracoes(op) > 1 && atual.length === 1);
    setMesesGestor(Array.from({ length: numeroFracoes(op) }, (_, idx) => atual[idx] || ''));
    if (op.sem_resposta) carregarPreviaPendencia(op);
  };

  const fecharDrawer = () => {
    setSelecionado(null);
    setMesesGestor([]);
    setModoIntegral(false);
    setPreviaPendencia({ loading: false, data: null, error: '' });
    setFeedbackPendencia(null);
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
    // O gestor pode transformar uma escala fracionada em integral: nesse caso a
    // definição é enviada como uma única parcela com todos os dias de direito.
    const qtd = modoIntegral ? 1 : numeroFracoes(selecionado);
    const escolhidos = mesesGestor.slice(0, qtd);
    if (escolhidos.some((m) => !m)) {
      setFeedback({ type: 'error', message: 'Selecione o mês definitivo de todas as frações.' });
      return;
    }
    if (new Set(escolhidos).size !== escolhidos.length) {
      setFeedback({ type: 'error', message: 'As frações precisam ser definidas em meses diferentes.' });
      return;
    }

    const bloqueio = motivoIndisponibilidade(selecionado);
    if (bloqueio) {
      setFeedback({ type: 'error', message: bloqueio });
      return;
    }

    const ano = Number(planoAtual?.ano_referencia || campanhaAtual?.ano_referencia || new Date().getFullYear() + 1);
    const disponiveis = mesesDisponiveis(selecionado);
    const dias = modoIntegral
      ? [Math.max(1, Number(selecionado.dias_direito || 30))]
      : diasPorFracao(selecionado);
    const parcelas = escolhidos.map((mes, idx) => {
      const regra = regraMes(selecionado, mes, ano, disponiveis);
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
        message: disponiveis
          ? 'O mês escolhido não está disponível para este período aquisitivo. Escolha um dos meses oferecidos.'
          : `O mês escolhido é anterior ao início legal do gozo. Primeira data possível: ${formatarDataBR(invalida.primeiraDataLegal)}.`,
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

  const executarSaneamento = async () => {
    if (!podeAprovar || saneando) return;
    setSaneando(true);
    setFeedback(null);
    try {
      const res = await base44.functions.invoke('saneamentoRespostasFerias', {
        plano_id: planoId || undefined,
      });
      const data = res.data || {};
      setFeedback({
        type: 'success',
        message: data.message || `${data.total_marcadas || 0} resposta(s) marcada(s) para reanálise.`,
      });
      await carregar(planoId);
    } catch (err) {
      setFeedback({ type: 'error', message: err?.response?.data?.error || err?.message || 'Falha ao executar o saneamento.' });
    } finally {
      setSaneando(false);
    }
  };

  const reatribuirPeriodo = async () => {
    if (!selecionado?.id || !podeAprovar || reatribuindo) return;
    setReatribuindo(true);
    setFeedback(null);
    try {
      const res = await base44.functions.invoke('reatribuirPeriodoFerias', {
        opcao_id: selecionado.id,
      });
      const data = res.data || {};
      setFeedback({ type: 'success', message: data.message || 'Período reatribuído com sucesso.' });
      setSelecionado(null);
      await carregar(planoId);
    } catch (err) {
      setFeedback({ type: 'error', message: err?.response?.data?.error || err?.message || 'Falha ao reatribuir o período.' });
    } finally {
      setReatribuindo(false);
    }
  };

  const registrarPendencia = async (justificativa) => {
    if (!selecionado?.sem_resposta || !podeAprovar || saving) return;
    const campanhaAlvo = (selecionado.campanhas_alvo || [])[0];
    if (!campanhaAlvo?.campanha_id) {
      setFeedbackPendencia({ type: 'error', message: 'Não foi possível identificar a campanha deste militar.' });
      return;
    }
    setSaving(true);
    setFeedbackPendencia(null);
    try {
      const res = await base44.functions.invoke('registrarNaoRespondenteFerias', {
        plano_id: planoId,
        campanha_id: campanhaAlvo.campanha_id,
        militar_alvo_id: selecionado.militar_id,
        justificativa,
      });
      const dados = res.data || {};
      const mensagem = dados.message || 'Pendência registrada.';
      const militarAtual = selecionado;
      await carregar(planoId);
      // Mantém o painel aberto já na Definição do gestor, com os meses liberados
      // pelo mesmo cálculo que o servidor aplicou no registro.
      if (dados.opcao) {
        setSelecionado({
          ...militarAtual,
          ...dados.opcao,
          id: dados.opcao.id || militarAtual.id,
          sem_resposta: false,
          resumo_periodo: dados.resumo_periodo || null,
        });
        setMesesGestor([]);
        setModoIntegral(false);
      }
      setFeedbackPendencia({ type: 'success', message: mensagem });
    } catch (err) {
      setFeedbackPendencia({ type: 'error', message: err?.response?.data?.error || err?.message || 'Falha ao registrar a pendência.' });
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
    // Ordenação institucional: posto/graduação do mais antigo ao mais moderno.
    // Em cada mês, as férias integrais (30 dias em um único mês) ficam acima das fracionadas.
    const ordenar = (pessoas) => ordenarMilitaresPorAntiguidadeInstitucional(pessoas.map((op) => ({
      ...op,
      posto_graduacao: op.militar_posto,
      quadro: op.militar_quadro,
      nome_completo: op.militar_nome,
    })));
    return Object.fromEntries(Object.entries(mapa).map(([mes, pessoas]) => [
      mes,
      {
        integrais: ordenar(pessoas.filter((op) => decisaoAtual(op).length <= 1)),
        fracionados: ordenar(pessoas.filter((op) => decisaoAtual(op).length > 1)),
      },
    ]));
  }, [opcoes]);

  const abrirDistribuicao = () => { setEmitidoEm(new Date()); setVisao('meses'); };

  const imprimirDistribuicao = () => {
    const tituloAnterior = document.title;
    document.title = `Distribuição por mês - ${planoAtual?.titulo || 'Plano de Férias'}`;
    const restaurarTitulo = () => {
      document.title = tituloAnterior;
      window.removeEventListener('afterprint', restaurarTitulo);
    };
    window.addEventListener('afterprint', restaurarTitulo);
    window.print();
  };

  const abrirCobertura = () => { setSelecionado(null); setVisao('cobertura'); };

  const alternarCobertura = (militarId) => setMilitaresSelecionados((atuais) => atuais.includes(militarId) ? atuais.filter((id) => id !== militarId) : [...atuais, militarId]);
  const alternarTodosCobertura = () => setMilitaresSelecionados((atuais) => atuais.length === cobertura.length ? [] : cobertura.map((m) => m.militar_id));
  const criarCampanhaSelecionados = () => navigate(`/PlanosFerias?planoId=${encodeURIComponent(planoId)}&novaCampanha=1&militares=${encodeURIComponent(militaresSelecionados.join(','))}`);

  const bloqueioDefinicao = selecionado && !selecionado.sem_resposta ? motivoIndisponibilidade(selecionado) : '';

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

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <GeracaoFeriasPlanoV2 key={planoId} plano={planoAtual}
              podeAdmin={isAdmin || canAccessAction('admin_campanhas_ferias')}
              podeGerar={isAdmin || canAccessAction('gerar_ferias_campanhas')}
              onGerado={async (message) => { await carregar(planoId); setFeedback({ type: 'success', message }); }}
            />
            {podeAprovar && (
              <Button
                type="button"
                variant="outline"
                onClick={executarSaneamento}
                disabled={saneando}
                className="h-10 border-orange-300 text-orange-700 hover:bg-orange-50 hover:text-orange-800 font-semibold"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${saneando ? 'animate-spin' : ''}`} />
                {saneando ? 'Saneando...' : 'Saneamento de respostas'}
              </Button>
            )}
          </div>

          {feedback && (
            <div className={`mt-5 rounded-xl border px-4 py-3 text-sm font-medium ${feedback.type === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
              {feedback.message}
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 mt-6">
            <Kpi icon={Users} value={totalPublico} label="Militares no plano" tone="blue" />
            <Kpi icon={CheckCircle2} value={totalRespondidos} label="Responderam" tone="green" sub={totalPublico ? `${Math.round((totalRespondidos / totalPublico) * 100)}% do escopo` : ''} />
            <Kpi icon={Clock3} value={totalSemResposta} label="Não responderam" tone="slate" />
            <Kpi icon={CalendarDays} value={totalDefinidos} label="Férias definidas" tone="green" />
            <Kpi icon={AlertTriangle} value={totalPendentes} label="Pendentes de definição" tone="amber" />
            <Kpi icon={Clock3} value={totalNaoGozo} label="Optaram por não gozar" tone="violet" />
            <Kpi icon={Users} value={coberturaCarregada ? cobertura.length : '—'} label="Elegíveis não cobertos" tone={coberturaCarregada && cobertura.length ? 'amber' : 'slate'} sub={!coberturaCarregada ? 'Consulte na aba Cobertura' : ''} />
          </div>

          <div className="mt-6 border-b border-slate-200 flex flex-wrap gap-x-6">
            <button onClick={() => setVisao('lista')} className={`h-11 flex items-center gap-2 text-sm font-bold border-b-2 ${visao === 'lista' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500'}`}>
              <LayoutList className="w-4 h-4" /> Lista de militares
            </button>
            <button onClick={abrirDistribuicao} className={`h-11 flex items-center gap-2 text-sm font-bold border-b-2 ${visao === 'meses' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500'}`}>
              <BarChart3 className="w-4 h-4" /> Distribuição por mês
            </button>
            {podeVerCobertura && <button onClick={abrirCobertura} className={`h-11 flex items-center gap-2 text-sm font-bold border-b-2 ${visao === 'cobertura' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500'}`}>
              <Users className="w-4 h-4" /> Cobertura
            </button>}
          </div>

          {visao === 'lista' ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[minmax(240px,1.4fr)_minmax(190px,1.1fr)_minmax(150px,.8fr)_minmax(150px,.8fr)_minmax(140px,.8fr)] gap-3 mt-5">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar por nome, posto, matrícula ou lotação..."
                    className="w-full h-10 rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                  />
                </div>

                <MultiSelectFiltro
                  placeholder="Todas as lotações"
                  options={lotacaoFiltro.options}
                  groupedOptions={lotacaoFiltro.groupedOptions}
                  value={filtroLotacao}
                  onChange={setFiltroLotacao}
                  groupSearchPlaceholder="Buscar lotação..."
                  triggerClassName="h-10 w-full bg-white border-slate-200"
                />

                <select value={filtroCampanha} onChange={(e) => setFiltroCampanha(e.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700">
                  <option value="TODAS">Todos os grupos / campanhas</option>
                  {campanhasFiltro.map((campanha) => <option key={campanha.id} value={campanha.id}>{campanha.nome}</option>)}
                </select>

                <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700">
                  <option value="TODOS">Todas as situações</option>
                  <option value="Reanálise">Reanálise necessária</option>
                  <option value="Não respondeu">Não respondeu</option>
                  <option value="Não respondeu no prazo">Não respondeu no prazo</option>
                  <option value="Optou por não gozar">Optou por não gozar</option>
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
            <>
              <DistribuicaoMensalFerias
                meses={MESES}
                distribuicao={distribuicao}
                totalPublico={totalPublico}
                militaresCov={militaresCov}
                onAbrirMilitar={abrirMilitar}
                onImprimir={imprimirDistribuicao}
              />

              <DistribuicaoMensalFeriasImpressao
                planoTitulo={planoAtual?.titulo}
                anoReferencia={planoAtual?.ano_referencia}
                meses={MESES}
                distribuicao={distribuicao}
                totalPublico={totalPublico}
                militaresCov={militaresCov}
                emitidoEm={emitidoEm}
              />
            </>
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
                <div className={`rounded-xl border p-4 ${previaPendencia.error ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-slate-50'}`}>
                  <div className="flex items-start gap-3">
                    <Clock3 className={`w-5 h-5 mt-0.5 shrink-0 ${previaPendencia.error ? 'text-red-600' : 'text-slate-500'}`} />
                    <div>
                      <h3 className={`font-black text-sm ${previaPendencia.error ? 'text-red-800' : 'text-slate-800'}`}>
                        {previaPendencia.error ? 'Definição indisponível para este militar' : 'Este militar ainda não respondeu'}
                      </h3>
                      {previaPendencia.loading ? (
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">Verificando o período aquisitivo elegível deste militar...</p>
                      ) : previaPendencia.error ? (
                        <p className="text-xs text-red-700 mt-1 leading-relaxed">{previaPendencia.error}</p>
                      ) : previaPendencia.data ? (
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                          O militar pertence ao público-alvo do Plano de Férias, mas ainda não enviou suas opções. Ao registrar a pendência serão liberados{' '}
                          <strong>{previaPendencia.data.dias_liberados} dia(s)</strong> do período{' '}
                          {formatarDataBR(previaPendencia.data.periodo?.inicio)} a {formatarDataBR(previaPendencia.data.periodo?.fim)} para definição pelo gestor.
                        </p>
                      ) : (
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                          O militar pertence ao público-alvo do Plano de Férias, mas ainda não enviou suas opções.
                        </p>
                      )}
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
                  previa={previaPendencia}
                  feedback={feedbackPendencia}
                />
              </div>
            ) : (
              <>
            {selecionado.nao_gozo_no_plano && (
              <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 mb-6">
                <h3 className="font-black text-sm text-violet-800">Optou por não gozar férias neste plano</h3>
                <p className="text-xs text-violet-700 mt-1 leading-relaxed">
                  Registrado pelo próprio militar no portal. O período aquisitivo permanece pendente para definição administrativa da unidade.
                </p>
                {selecionado.justificativa_nao_gozo && (
                  <p className="text-xs text-violet-700 mt-2 italic">“{selecionado.justificativa_nao_gozo}”</p>
                )}
              </div>
            )}

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

            {selecionado.status_camada_1 === 'Pendente_Reanalise' && (
              <div className="rounded-xl border border-orange-300 bg-orange-50 p-4 mb-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-black text-sm text-orange-800">Reanálise necessária</h3>
                    <p className="text-xs text-orange-700 mt-1 leading-relaxed">
                      O período aquisitivo informado pelo militar já está integralmente comprometido por férias existentes. O sistema pode reatribuir automaticamente esta resposta para o próximo período elegível.
                    </p>
                    {selecionado.justificativa_ajuste_gestor && (
                      <p className="text-xs text-orange-700 mt-2 italic">“{selecionado.justificativa_ajuste_gestor}”</p>
                    )}
                    <Button
                      type="button"
                      onClick={reatribuirPeriodo}
                      disabled={!podeAprovar || reatribuindo}
                      className="mt-3 h-9 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${reatribuindo ? 'animate-spin' : ''}`} />
                      {reatribuindo ? 'Reatribuindo...' : 'Reatribuir ao período correto'}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <SectionLabel>Período aquisitivo</SectionLabel>
            <p className="text-sm font-semibold text-slate-700 mb-6">{formatarDataBR(selecionado.periodo_inicio)} a {formatarDataBR(selecionado.periodo_fim)}</p>

            {!selecionado.nao_gozo_no_plano && (
            <>
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
            </>
            )}

            <div className="mt-7 pt-6 border-t border-slate-200">
              <h3 className="font-black text-base text-slate-900">Definição do gestor</h3>
              <p className="text-xs text-slate-500 mt-1 mb-4">Escolha somente os meses definitivos. As datas serão calculadas pelo sistema conforme as regras do período aquisitivo.</p>

              {numeroFracoes(selecionado) > 1 && (
                <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1">
                  <button
                    type="button"
                    disabled={!podeAprovar || saving || selecionado.gerado_ferias_efetivas}
                    onClick={() => setModoIntegral(false)}
                    className={`rounded-lg px-3 py-2 text-xs font-bold transition-colors disabled:opacity-50 ${!modoIntegral ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}
                  >
                    Fracionado · {diasPorFracao(selecionado).join(' + ')} dias
                  </button>
                  <button
                    type="button"
                    disabled={!podeAprovar || saving || selecionado.gerado_ferias_efetivas}
                    onClick={() => setModoIntegral(true)}
                    className={`rounded-lg px-3 py-2 text-xs font-bold transition-colors disabled:opacity-50 ${modoIntegral ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}
                  >
                    Integral · {Math.max(1, Number(selecionado.dias_direito || 30))} dias
                  </button>
                </div>
              )}

              {(numeroFracoes(selecionado) === 1 || modoIntegral) ? (
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
                          {opcoesDeMes(selecionado).map((m) => <option key={m.val} value={m.val}>{m.nome}</option>)}
                        </select>
                      </div>
                    );
                  })}
                </div>
              )}

              {(modoIntegral ? [mesesGestor[0]] : mesesGestor).filter(Boolean).length > 0 && (
                <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
                  <span className="font-bold">Definição:</span>{' '}
                  {(modoIntegral ? [mesesGestor[0]] : mesesGestor.filter(Boolean))
                    .filter(Boolean)
                    .map((m, idx) => `${(modoIntegral ? [Math.max(1, Number(selecionado.dias_direito || 30))] : diasPorFracao(selecionado))[idx]} dias em ${nomeMes(m)}`)
                    .join(' · ')}
                </div>
              )}

              {!podeAprovar && (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs font-medium text-amber-800">Seu perfil pode consultar as respostas, mas não possui permissão para definir a escala.</div>
              )}

              {bloqueioDefinicao && (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs font-medium leading-relaxed text-amber-800">
                  {bloqueioDefinicao}
                </div>
              )}

              {feedback && (
                <div className={`mt-4 rounded-lg border px-3 py-3 text-xs font-medium leading-relaxed ${feedback.type === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                  {feedback.message}
                </div>
              )}

              {feedbackPendencia && (
                <div className={`mt-4 rounded-lg border px-3 py-3 text-xs font-medium leading-relaxed ${feedbackPendencia.type === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                  {feedbackPendencia.message}
                </div>
              )}

              <Button
                type="button"
                disabled={!podeAprovar || saving || selecionado.gerado_ferias_efetivas || Boolean(bloqueioDefinicao)}
                onClick={salvarDefinicao}
                className="w-full mt-4 bg-blue-700 hover:bg-blue-800 text-white font-bold h-11"
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
    violet: 'bg-violet-50 text-violet-700',
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
  const disponiveis = mesesDisponiveis(op);
  const opcoes = [1, 2, 3]
    .map((n) => ({ numero: n, mes: mesesDaOpcao(op, n)[0] || '' }))
    .filter((item) => item.mes && (!disponiveis || disponiveis.some((m) => String(m?.mes || '').padStart(2, '0') === item.mes)));

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
        {opcoesDeMes(op).map((m) => <option key={m.val} value={m.val}>{m.nome}</option>)}
      </select>
    </div>
  );
}