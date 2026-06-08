import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ClipboardCopy, Eye, MoreVertical, PlusCircle, RefreshCw, Search } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { montarMilitarPorId, montarPayloadsPromocaoMilitarAgrupamento } from '@/services/promocaoService';

const STATUS_OPERACIONAIS = new Set(['ativo', 'previsto']);
const STATUS_CANCELADOS_RETIFICADOS = new Set(['cancelado', 'retificado', 'retificada', 'cancelada']);
const TEXTO_CONFIRMACAO_CRIAR_PROMOCAO = 'CRIAR PROMOÇÃO';

const PROMOCAO_ENTIDADE_AUSENTE_MENSAGEM = 'Entidade Promocao ainda não está sincronizada no Base44. Publique/sincronize as entidades antes de criar promoções.';

function obterEntidadePromocaoRuntime() {
  const entidade = base44?.entities?.Promocao;
  const disponivel = Boolean(entidade && typeof entidade.filter === 'function' && typeof entidade.create === 'function' && typeof entidade.list === 'function');

  return {
    disponivel,
    entidade: disponivel ? entidade : null,
    motivo: disponivel
      ? 'base44.entities.Promocao disponível no runtime.'
      : 'base44.entities.Promocao ausente ou sem métodos list/filter/create no runtime.',
  };
}

function isErroSchemaPromocaoAusente(error) {
  const mensagem = String(error?.message || error || '');
  return /Entity schema Promocao not found in app|schema\s+Promocao\s+not found/i.test(mensagem);
}

function criarErroPromocaoEntidadeAusente(error) {
  const erro = new Error(PROMOCAO_ENTIDADE_AUSENTE_MENSAGEM);
  erro.promocaoEntidadeAusente = true;
  erro.cause = error;
  return erro;
}

function texto(valor) {
  return String(valor ?? '').trim();
}

function normalizar(valor) {
  return texto(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function normalizarStatus(valor) {
  return normalizar(valor) || 'ativo';
}

function isOperacional(registro) {
  return STATUS_OPERACIONAIS.has(normalizarStatus(registro?.status_registro));
}

function isCanceladoRetificado(registro) {
  return STATUS_CANCELADOS_RETIFICADOS.has(normalizarStatus(registro?.status_registro));
}

function isAtivo(registro) {
  return normalizarStatus(registro?.status_registro) === 'ativo';
}

function isPrevisto(registro) {
  return normalizarStatus(registro?.status_registro) === 'previsto';
}

function ordemPreenchida(valor) {
  if (valor === null || valor === undefined || valor === '') return false;
  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0;
}

function dataFormatada(data) {
  if (!data) return '—';
  const [ano, mes, dia] = String(data).split('T')[0].split('-');
  if (!ano || !mes || !dia) return texto(data) || '—';
  return `${dia}/${mes}/${ano}`;
}

function valorOuTraco(valor) {
  return texto(valor) || '—';
}

function nomeMilitar(militar) {
  return texto(militar?.nome_guerra) || texto(militar?.nome_completo) || 'Militar sem nome';
}

function militarBuscaTexto(militar) {
  return normalizar([
    militar?.nome_guerra,
    militar?.nome_completo,
    militar?.matricula,
    militar?.posto_graduacao,
    militar?.quadro,
    militar?.lotacao,
  ].join(' '));
}

function historicoCompativelComMilitar(registro, militar) {
  return isAtivo(registro)
    && normalizar(registro?.posto_graduacao_novo) === normalizar(militar?.posto_graduacao)
    && normalizar(registro?.quadro_novo) === normalizar(militar?.quadro);
}

function chaveAgrupamento(registro) {
  return [
    registro?.posto_graduacao_novo,
    registro?.quadro_novo,
    registro?.data_promocao,
    registro?.data_publicacao,
    registro?.boletim_referencia,
    registro?.ato_referencia,
  ].map((valor) => normalizar(valor) || '∅').join('|');
}

function hashAgrupamento(chave) {
  let hash = 2166136261;
  for (let index = 0; index < chave.length; index += 1) {
    hash ^= chave.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `agr-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function valorPromocao(valor) {
  const limpo = texto(valor);
  return limpo === '—' ? '' : limpo;
}

function diagnosticarCriacaoPromocao(grupo) {
  if (!grupo) return { bloqueado: true, motivo: 'Agrupamento não selecionado.' };

  const totalRegistros = grupo.registros?.length || 0;
  const apenasAtivos = grupo.ativos === totalRegistros && totalRegistros > 0;
  const apenasPrevistos = grupo.previstos === totalRegistros && totalRegistros > 0;

  if (!apenasAtivos && !apenasPrevistos) {
    return {
      bloqueado: true,
      motivo: 'Agrupamento misto ou com registros cancelados/retificados. Este lote permite criar Promoção somente quando todos os registros do agrupamento são ativos ou todos são previstos.',
    };
  }

  const tipo = apenasPrevistos ? 'prevista' : 'historica';
  const status = apenasPrevistos ? 'prevista' : 'ativa';
  const chave = grupo.key;
  const hash = hashAgrupamento(chave);

  return {
    bloqueado: false,
    payload: {
      tipo,
      natureza: 'coletiva',
      posto_graduacao: valorPromocao(grupo.posto),
      quadro: valorPromocao(grupo.quadro),
      data_promocao: valorPromocao(grupo.data_promocao),
      data_publicacao: valorPromocao(grupo.data_publicacao),
      boletim_referencia: valorPromocao(grupo.boletim_referencia),
      ato_referencia: valorPromocao(grupo.ato_referencia),
      status,
      origem: 'agrupamento',
      observacoes: [
        'Criada a partir de agrupamento detectado no Rastreamento de Promoções.',
        'A turma da Promoção será criada automaticamente em PromocaoMilitar.',
        `Registros detectados: ${totalRegistros}. Militares únicos no agrupamento: ${grupo.totalMilitares}.`,
      ].join(' '),
      chave_agrupamento: chave,
      hash_agrupamento: hash,
      total_militares_vinculados: 0,
    },
  };
}

function classificarConfianca({ totalMilitares, duplicidades, totalComReferencia, ativos, previstos }) {
  if (duplicidades > 0 || totalMilitares <= 1) return 'baixa';
  if (totalComReferencia >= 2 && ativos > 0 && previstos === 0) return 'alta';
  return 'média';
}

function montarRastreamento(militares, historicos) {
  const militaresAtivos = (militares || []).filter((militar) => normalizar(militar?.status_cadastro || 'Ativo') === 'ativo');
  const militarPorId = new Map(militaresAtivos.map((militar) => [String(militar.id), militar]));

  const historicosPorMilitar = new Map();
  (historicos || []).forEach((registro) => {
    const militarId = String(registro?.militar_id || '');
    if (!militarId) return;
    if (!historicosPorMilitar.has(militarId)) historicosPorMilitar.set(militarId, []);
    historicosPorMilitar.get(militarId).push(registro);
  });

  const semPromocao = militaresAtivos.filter((militar) => {
    const registros = historicosPorMilitar.get(String(militar.id)) || [];
    return !registros.some(isOperacional);
  });

  const semAtualCompativel = militaresAtivos.filter((militar) => {
    const registros = historicosPorMilitar.get(String(militar.id)) || [];
    return registros.length > 0 && !registros.some((registro) => historicoCompativelComMilitar(registro, militar));
  });

  const gruposMap = new Map();
  (historicos || []).forEach((registro) => {
    const chave = chaveAgrupamento(registro);
    if (!gruposMap.has(chave)) {
      gruposMap.set(chave, {
        key: chave,
        posto: valorOuTraco(registro?.posto_graduacao_novo),
        quadro: valorOuTraco(registro?.quadro_novo),
        data_promocao: registro?.data_promocao || '',
        data_publicacao: registro?.data_publicacao || '',
        boletim_referencia: valorOuTraco(registro?.boletim_referencia),
        ato_referencia: valorOuTraco(registro?.ato_referencia),
        registros: [],
      });
    }
    gruposMap.get(chave).registros.push(registro);
  });

  const agrupamentos = Array.from(gruposMap.values()).map((grupo) => {
    const idsMilitares = grupo.registros.map((registro) => String(registro?.militar_id || '')).filter(Boolean);
    const militaresUnicos = new Set(idsMilitares);
    const totalComReferencia = grupo.registros.filter((registro) => texto(registro?.boletim_referencia) || texto(registro?.ato_referencia) || texto(registro?.data_publicacao)).length;
    const resumo = {
      ...grupo,
      totalMilitares: militaresUnicos.size,
      comOrdem: grupo.registros.filter((registro) => ordemPreenchida(registro?.antiguidade_referencia_ordem)).length,
      semOrdem: grupo.registros.filter((registro) => !ordemPreenchida(registro?.antiguidade_referencia_ordem)).length,
      ativos: grupo.registros.filter(isAtivo).length,
      previstos: grupo.registros.filter(isPrevisto).length,
      canceladosRetificados: grupo.registros.filter(isCanceladoRetificado).length,
      duplicidades: idsMilitares.length - militaresUnicos.size,
      militares: Array.from(militaresUnicos).map((id) => militarPorId.get(id)).filter(Boolean),
    };
    return {
      ...resumo,
      confianca: classificarConfianca({
        totalMilitares: resumo.totalMilitares,
        duplicidades: resumo.duplicidades,
        totalComReferencia,
        ativos: resumo.ativos,
        previstos: resumo.previstos,
      }),
    };
  }).sort((a, b) => b.totalMilitares - a.totalMilitares || a.posto.localeCompare(b.posto, 'pt-BR'));

  const atuaisComOrdenacao = militaresAtivos.map((militar) => {
    const registros = (historicosPorMilitar.get(String(militar.id)) || [])
      .filter((registro) => historicoCompativelComMilitar(registro, militar) && texto(registro?.data_promocao) && ordemPreenchida(registro?.antiguidade_referencia_ordem))
      .sort((a, b) => Number(a.antiguidade_referencia_ordem) - Number(b.antiguidade_referencia_ordem));
    return registros[0] ? { militar, registro: registros[0] } : null;
  }).filter(Boolean).sort((a, b) => {
    const dataCompare = texto(b.registro.data_promocao).localeCompare(texto(a.registro.data_promocao));
    if (dataCompare) return dataCompare;
    return Number(a.registro.antiguidade_referencia_ordem) - Number(b.registro.antiguidade_referencia_ordem);
  });

  return { militaresAtivos, semPromocao, semAtualCompativel, agrupamentos, atuaisComOrdenacao };
}

function filtrarMilitares(lista, busca) {
  const termo = normalizar(busca);
  if (!termo) return lista;
  return lista.filter((militar) => militarBuscaTexto(militar).includes(termo));
}

function copiarTexto(conteudo) {
  if (!conteudo) return;
  if (navigator?.clipboard?.writeText) {
    navigator.clipboard.writeText(conteudo);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = conteudo;
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

function linhasMilitares(militares) {
  return (militares || []).map((militar) => [
    valorOuTraco(militar?.posto_graduacao),
    valorOuTraco(militar?.quadro),
    valorOuTraco(militar?.matricula),
    nomeMilitar(militar),
    valorOuTraco(militar?.lotacao),
  ].join('\t')).join('\n');
}

function linhasPromocao(promocao) {
  if (!promocao) return '';
  return [
    ['ID', promocao.id],
    ['Tipo', promocao.tipo],
    ['Status', promocao.status],
    ['Posto/graduação', promocao.posto_graduacao],
    ['Quadro', promocao.quadro],
    ['Data promoção', promocao.data_promocao],
    ['Boletim referência', promocao.boletim_referencia],
    ['Ato referência', promocao.ato_referencia],
    ['Origem', promocao.origem],
    ['Total militares vinculados', promocao.total_militares_vinculados],
    ['Hash agrupamento', promocao.hash_agrupamento],
    ['Chave agrupamento', promocao.chave_agrupamento],
    ['Criado em', promocao.criado_em],
  ].map(([label, value]) => `${label}: ${valorOuTraco(value)}`).join('\n');
}

function linhasPromocoes(promocoes) {
  return (promocoes || []).map((promocao) => [
    promocao.id,
    promocao.tipo,
    promocao.status,
    promocao.posto_graduacao,
    promocao.quadro,
    promocao.data_promocao,
    promocao.boletim_referencia,
    promocao.ato_referencia,
    promocao.origem,
    promocao.total_militares_vinculados,
    promocao.hash_agrupamento,
    promocao.criado_em,
  ].map(valorOuTraco).join('\t')).join('\n');
}

function criarIndicePromocoesPorAgrupamento(promocoes) {
  const indice = new Map();
  (promocoes || []).forEach((promocao) => {
    [promocao?.chave_agrupamento, promocao?.hash_agrupamento].forEach((chave) => {
      const chaveNormalizada = texto(chave);
      if (chaveNormalizada && !indice.has(chaveNormalizada)) indice.set(chaveNormalizada, promocao);
    });
  });
  return indice;
}

function PainelMilitares({ titulo, descricao, militares, busca, onBuscaChange }) {
  const filtrados = useMemo(() => filtrarMilitares(militares, busca), [militares, busca]);
  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="text-lg text-slate-900">{titulo}</CardTitle>
            <p className="mt-1 text-sm text-slate-500">{descricao}</p>
          </div>
          <Badge variant="outline" className="w-fit whitespace-nowrap px-2 py-0.5 text-xs">{filtrados.length} / {militares.length}</Badge>
        </div>
        <div className="flex flex-col gap-2 md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input className="pl-9" placeholder="Buscar por nome, matrícula, posto, quadro ou lotação" value={busca} onChange={(e) => onBuscaChange(e.target.value)} />
          </div>
          <Button type="button" variant="outline" onClick={() => copiarTexto(linhasMilitares(filtrados))}>
            <ClipboardCopy className="mr-2 h-4 w-4" /> Copiar lista
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-max w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr><th className="p-3">Nome</th><th className="p-3">Matrícula</th><th className="p-3">Posto</th><th className="p-3">Quadro</th><th className="p-3">Lotação</th><th className="p-3">Ficha</th></tr>
            </thead>
            <tbody>
              {filtrados.map((militar) => (
                <tr key={militar.id} className="border-t">
                  <td className="p-3 font-medium text-slate-800">{nomeMilitar(militar)}</td>
                  <td className="p-3">{valorOuTraco(militar.matricula)}</td>
                  <td className="p-3">{valorOuTraco(militar.posto_graduacao)}</td>
                  <td className="p-3">{valorOuTraco(militar.quadro)}</td>
                  <td className="p-3">{valorOuTraco(militar.lotacao)}</td>
                  <td className="p-3"><Link className="text-blue-700 hover:underline" to={`${createPageUrl('VerMilitar')}?id=${militar.id}`}>Abrir ficha</Link></td>
                </tr>
              ))}
              {filtrados.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-slate-500">Nenhum militar encontrado.</td></tr>}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function confiancaVariant(confianca) {
  if (confianca === 'alta') return 'default';
  if (confianca === 'média') return 'secondary';
  return 'destructive';
}

export default function RastreamentoPromocoes() {
  const [buscaSemPromocao, setBuscaSemPromocao] = useState('');
  const [buscaSemAtual, setBuscaSemAtual] = useState('');
  const [filtroGrupo, setFiltroGrupo] = useState('');
  const [filtroConfianca, setFiltroConfianca] = useState('todas');
  const [grupoDetalhe, setGrupoDetalhe] = useState(null);
  const [grupoCriacao, setGrupoCriacao] = useState(null);
  const [confirmacaoCriacao, setConfirmacaoCriacao] = useState('');
  const [promocaoExistente, setPromocaoExistente] = useState(null);
  const [promocaoDetalhe, setPromocaoDetalhe] = useState(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const promocaoRuntimeInicial = useMemo(() => obterEntidadePromocaoRuntime(), []);
  const [promocaoRuntime, setPromocaoRuntime] = useState(promocaoRuntimeInicial);
  const promocaoEntidadeDisponivel = promocaoRuntime.disponivel;

  useEffect(() => {
    if (promocaoRuntime.disponivel) {
      console.info('[RastreamentoPromocoes] base44.entities.Promocao disponível no runtime Base44.');
      return;
    }

    console.warn('[RastreamentoPromocoes] Entidade Promocao indisponível no runtime Base44.', {
      motivo: promocaoRuntime.motivo,
      entidadesDisponiveis: Object.keys(base44?.entities || {}).sort(),
    });
  }, [promocaoRuntime]);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['rastreamento-promocoes'],
    queryFn: async () => {
      const [militares, historicos] = await Promise.all([
        base44.entities.Militar.filter({ status_cadastro: 'Ativo' }),
        base44.entities.HistoricoPromocaoMilitarV2.list(),
      ]);
      return montarRastreamento(militares || [], historicos || []);
    },
  });

  const {
    data: promocoesCriadas = [],
    isLoading: isLoadingPromocoes,
    error: promocoesError,
    refetch: refetchPromocoes,
    isFetching: isFetchingPromocoes,
  } = useQuery({
    queryKey: ['rastreamento-promocoes-criadas'],
    enabled: promocaoEntidadeDisponivel,
    queryFn: async () => {
      const runtimeAtual = obterEntidadePromocaoRuntime();
      if (!runtimeAtual.disponivel || typeof runtimeAtual.entidade?.list !== 'function') {
        throw criarErroPromocaoEntidadeAusente();
      }
      return runtimeAtual.entidade.list();
    },
  });

  const promocoesPorAgrupamento = useMemo(() => criarIndicePromocoesPorAgrupamento(promocoesCriadas), [promocoesCriadas]);

  const diagnosticoCriacao = useMemo(() => diagnosticarCriacaoPromocao(grupoCriacao), [grupoCriacao]);
  const promocaoRevisao = diagnosticoCriacao.payload || null;
  const podeConfirmarCriacao = Boolean(
    promocaoEntidadeDisponivel
    && promocaoRevisao
    && !diagnosticoCriacao.bloqueado
    && !promocaoExistente
    && confirmacaoCriacao === TEXTO_CONFIRMACAO_CRIAR_PROMOCAO,
  );

  const abrirCriacaoPromocao = (grupo) => {
    if (!promocaoEntidadeDisponivel) {
      console.warn('[RastreamentoPromocoes] Abertura/criação de Promoção bloqueada: entidade Promocao não existe no runtime Base44.', {
        motivo: promocaoRuntime.motivo,
      });
      toast({
        title: 'Promoção indisponível',
        description: PROMOCAO_ENTIDADE_AUSENTE_MENSAGEM,
        variant: 'destructive',
      });
      return;
    }

    const promocaoDoAgrupamento = promocoesPorAgrupamento.get(grupo.key) || promocoesPorAgrupamento.get(hashAgrupamento(grupo.key)) || null;
    setGrupoCriacao(grupo);
    setConfirmacaoCriacao('');
    setPromocaoExistente(promocaoDoAgrupamento);
  };

  const fecharCriacaoPromocao = () => {
    setGrupoCriacao(null);
    setConfirmacaoCriacao('');
    setPromocaoExistente(null);
  };

  const criarPromocaoMutation = useMutation({
    mutationFn: async (payload) => {
      const runtimeAtual = obterEntidadePromocaoRuntime();
      if (!runtimeAtual.disponivel) {
        const erro = criarErroPromocaoEntidadeAusente();
        console.warn('[RastreamentoPromocoes] create/filter não executados: entidade Promocao não existe no runtime Base44.', {
          motivo: runtimeAtual.motivo,
          entidadesDisponiveis: Object.keys(base44?.entities || {}).sort(),
        });
        throw erro;
      }

      const Promocao = runtimeAtual.entidade;
      const payloadPromocao = payload?.payload || payload;
      const registrosAgrupamento = payload?.registros || [];
      let porChave = [];
      let porHash = [];

      try {
        [porChave, porHash] = await Promise.all([
          Promocao.filter({ chave_agrupamento: payloadPromocao.chave_agrupamento }),
          Promocao.filter({ hash_agrupamento: payloadPromocao.hash_agrupamento }),
        ]);
      } catch (filterError) {
        if (isErroSchemaPromocaoAusente(filterError)) {
          console.warn('[RastreamentoPromocoes] Promocao existe no objeto do SDK, mas o schema não está sincronizado no app Base44. create não será executado.', {
            mensagem: filterError?.message,
          });
          throw criarErroPromocaoEntidadeAusente(filterError);
        }
        throw filterError;
      }

      const existente = [...(porChave || []), ...(porHash || [])].find(Boolean);

      if (existente) {
        const erro = new Error('Já existe Promoção para esta chave/hash de agrupamento.');
        erro.promocaoExistente = existente;
        throw erro;
      }

      const agora = new Date().toISOString();
      const usuario = await base44.auth.me();

      try {
        const promocaoCriada = await Promocao.create({
          ...payloadPromocao,
          criado_por: usuario?.email || usuario?.full_name || '',
          criado_em: agora,
          atualizado_por: usuario?.email || usuario?.full_name || '',
          atualizado_em: agora,
        });

        const PromocaoMilitar = base44?.entities?.PromocaoMilitar;
        if (!PromocaoMilitar || typeof PromocaoMilitar.create !== 'function') {
          throw new Error('Promoção criada, mas a entidade PromocaoMilitar está indisponível para criar a turma automaticamente.');
        }

        const militarPorId = montarMilitarPorId(data?.militaresAtivos || []);
        const historicosComMilitar = registrosAgrupamento.map((historico) => ({
          ...historico,
          militar: militarPorId.get(String(historico?.militar_id || '')) || null,
        }));
        const payloadsTurma = montarPayloadsPromocaoMilitarAgrupamento({
          promocao: promocaoCriada,
          historicos: historicosComMilitar,
          registrosExistentes: [], // Promoção nova, sem registros existentes
          militarPorId,
        });

        if (payloadsTurma.length > 0) {
          if (PromocaoMilitar.bulkCreate) {
            await PromocaoMilitar.bulkCreate(payloadsTurma);
          } else {
            await Promise.all(payloadsTurma.map((payloadTurma) => PromocaoMilitar.create(payloadTurma)));
          }
        }
        return { ...promocaoCriada, total_promocao_militar_criados: payloadsTurma.length };
      } catch (createError) {
        if (isErroSchemaPromocaoAusente(createError)) {
          console.warn('[RastreamentoPromocoes] Promocao existe no objeto do SDK, mas create falhou porque o schema não está sincronizado no app Base44.', {
            mensagem: createError?.message,
          });
          throw criarErroPromocaoEntidadeAusente(createError);
        }
        throw createError;
      }
    },
    onSuccess: (promocao) => {
      toast({ title: 'Promoção criada', description: `Promoção ${promocao?.id ? `ID ${promocao.id}` : ''} criada com ${promocao?.total_promocao_militar_criados || 0} militar(es) na turma.` });
      fecharCriacaoPromocao();
      queryClient.invalidateQueries({ queryKey: ['rastreamento-promocoes'] });
      queryClient.invalidateQueries({ queryKey: ['rastreamento-promocoes-criadas'] });
    },
    onError: (mutationError) => {
      if (mutationError?.promocaoEntidadeAusente) {
        setPromocaoRuntime({
          disponivel: false,
          entidade: null,
          motivo: 'Promocao indisponível: schema não encontrado/sincronizado no app Base44.',
        });
        toast({
          title: 'Promoção indisponível',
          description: PROMOCAO_ENTIDADE_AUSENTE_MENSAGEM,
          variant: 'destructive',
        });
        return;
      }

      if (mutationError?.promocaoExistente) {
        setPromocaoExistente(mutationError.promocaoExistente);
        toast({
          title: 'Duplicidade bloqueada',
          description: 'Já existe Promoção com a mesma chave ou hash de agrupamento. Abra/verifique a promoção existente antes de prosseguir.',
          variant: 'destructive',
        });
        return;
      }
      toast({ title: 'Falha ao criar Promoção', description: mutationError?.message || 'Não foi possível criar a Promoção.', variant: 'destructive' });
    },
  });

  const confirmarCriacaoPromocao = () => {
    if (!promocaoEntidadeDisponivel) {
      toast({
        title: 'Promoção indisponível',
        description: PROMOCAO_ENTIDADE_AUSENTE_MENSAGEM,
        variant: 'destructive',
      });
      return;
    }

    if (!podeConfirmarCriacao || !promocaoRevisao) return;
    setPromocaoExistente(null);
    criarPromocaoMutation.mutate({ payload: promocaoRevisao, registros: grupoCriacao?.registros || [] });
  };

  const avisoPromocaoIndisponivel = !promocaoEntidadeDisponivel
    ? PROMOCAO_ENTIDADE_AUSENTE_MENSAGEM
    : '';

  const gruposFiltrados = useMemo(() => {
    const termo = normalizar(filtroGrupo);
    return (data?.agrupamentos || []).filter((grupo) => {
      if (filtroConfianca !== 'todas' && grupo.confianca !== filtroConfianca) return false;
      if (!termo) return true;
      return normalizar([
        grupo.posto,
        grupo.quadro,
        grupo.data_promocao,
        grupo.data_publicacao,
        grupo.boletim_referencia,
        grupo.ato_referencia,
      ].join(' ')).includes(termo);
    });
  }, [data?.agrupamentos, filtroConfianca, filtroGrupo]);

  const atuaisPorGrupo = useMemo(() => {
    const grupos = new Map();
    (data?.atuaisComOrdenacao || []).forEach(({ militar, registro }) => {
      const chave = [registro.data_promocao, registro.antiguidade_referencia_ordem].join('|');
      if (!grupos.has(chave)) grupos.set(chave, { data_promocao: registro.data_promocao, ordem: registro.antiguidade_referencia_ordem, itens: [] });
      grupos.get(chave).itens.push({ militar, registro });
    });
    return Array.from(grupos.values()).sort((a, b) => texto(b.data_promocao).localeCompare(texto(a.data_promocao)) || Number(a.ordem) - Number(b.ordem));
  }, [data?.atuaisComOrdenacao]);

  if (isLoading) return <div className="p-[clamp(1rem,1.4vw,1.5rem)]">Carregando rastreamento de promoções...</div>;
  if (error) return <div className="p-[clamp(1rem,1.4vw,1.5rem)] text-red-600">{error?.message || 'Falha ao carregar rastreamento de promoções.'}</div>;

  return (
    <div className="space-y-6 p-[clamp(1rem,1.4vw,1.5rem)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Antiguidade</p>
          <h1 className="text-2xl font-bold text-[#1e3a5f]">Rastreamento de Promoções</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">Painel para identificar lacunas, agrupamentos e militares ativos sem vínculo adequado em HistoricoPromocaoMilitarV2, com criação controlada da Promoção e da turma em PromocaoMilitar.</p>
        </div>
        <Button type="button" variant="outline" onClick={() => { refetch(); if (promocaoEntidadeDisponivel) refetchPromocoes(); }} disabled={isFetching || isFetchingPromocoes}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isFetching || isFetchingPromocoes ? 'animate-spin' : ''}`} /> Atualizar
        </Button>
      </div>

      <Alert>
        <AlertTitle>Criação limitada à entidade Promoção</AlertTitle>
        <AlertDescription>Esta tela cria a entidade Promoção e a turma operacional em PromocaoMilitar a partir de agrupamento homogêneo. Não adiciona promocao_id, não vincula HistoricoPromocaoMilitarV2 e não altera Militar, histórico, prévia geral, ordenação ou snapshots.</AlertDescription>
      </Alert>

      {!promocaoEntidadeDisponivel && (
        <Alert variant="destructive">
          <AlertTitle>Criação de Promoção indisponível</AlertTitle>
          <AlertDescription>{avisoPromocaoIndisponivel}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card><CardHeader><CardTitle className="text-sm">Militares ativos</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{data.militaresAtivos.length}</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Sem promoção operacional</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-amber-700">{data.semPromocao.length}</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Sem atual compatível</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-red-700">{data.semAtualCompativel.length}</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Agrupamentos detectados</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-blue-700">{data.agrupamentos.length}</p></CardContent></Card>
      </div>

      <PainelMilitares
        titulo="1. Militares sem nenhuma promoção operacional"
        descricao="Militares ativos sem qualquer histórico com status ativo ou previsto. Registros cancelados/retificados isolados não contam como vínculo operacional."
        militares={data.semPromocao}
        busca={buscaSemPromocao}
        onBuscaChange={setBuscaSemPromocao}
      />

      <PainelMilitares
        titulo="2. Militares sem promoção atual compatível"
        descricao="Militares ativos que possuem histórico, mas nenhum registro ativo em que posto_graduacao_novo e quadro_novo sejam compatíveis com o posto/quadro atual do cadastro."
        militares={data.semAtualCompativel}
        busca={buscaSemAtual}
        onBuscaChange={setBuscaSemAtual}
      />

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle>3. Agrupamentos detectados</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Agrupamento por posto_graduacao_novo, quadro_novo, data_promocao, data_publicacao, boletim_referencia e ato_referencia.</p>
            </div>
            <Badge variant="outline" className="w-fit whitespace-nowrap px-2 py-0.5 text-xs">{gruposFiltrados.length} / {data.agrupamentos.length}</Badge>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px]">
            <div>
              <Label>Buscar agrupamento</Label>
              <Input value={filtroGrupo} onChange={(e) => setFiltroGrupo(e.target.value)} placeholder="Posto, quadro, datas, boletim ou ato" />
            </div>
            <div>
              <Label>Confiança</Label>
              <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={filtroConfianca} onChange={(e) => setFiltroConfianca(e.target.value)}>
                <option value="todas">Todas</option>
                <option value="alta">Alta</option>
                <option value="média">Média</option>
                <option value="baixa">Baixa</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <table className="min-w-max w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr><th className="p-3">Grupo</th><th className="p-3">Promoção</th><th className="p-3">Publicação</th><th className="p-3">Refs.</th><th className="p-3">Total</th><th className="p-3">Com ordem</th><th className="p-3">Sem ordem</th><th className="p-3">Ativos</th><th className="p-3">Previstos</th><th className="p-3">Cancel./Retif.</th><th className="p-3">Duplic.</th><th className="p-3">Confiança</th><th className="p-3">Promoção criada</th><th className="p-3">Ações</th></tr>
              </thead>
              <tbody>
                {gruposFiltrados.map((grupo) => {
                  const promocaoDoAgrupamento = promocoesPorAgrupamento.get(grupo.key) || promocoesPorAgrupamento.get(hashAgrupamento(grupo.key));
                  return (
                    <tr key={grupo.key} className="border-t">
                      <td className="p-3 font-medium">{grupo.posto} / {grupo.quadro}</td>
                      <td className="p-3">{dataFormatada(grupo.data_promocao)}</td>
                      <td className="p-3">{dataFormatada(grupo.data_publicacao)}</td>
                      <td className="p-3">{grupo.boletim_referencia}<br /><span className="text-xs text-slate-500">{grupo.ato_referencia}</span></td>
                      <td className="p-3">{grupo.totalMilitares}</td>
                      <td className="p-3">{grupo.comOrdem}</td>
                      <td className="p-3">{grupo.semOrdem}</td>
                      <td className="p-3">{grupo.ativos}</td>
                      <td className="p-3">{grupo.previstos}</td>
                      <td className="p-3">{grupo.canceladosRetificados}</td>
                      <td className="p-3">{grupo.duplicidades}</td>
                      <td className="p-3"><Badge variant={confiancaVariant(grupo.confianca)} className="whitespace-nowrap px-2 py-0.5 text-xs">{grupo.confianca}</Badge></td>
                      <td className="p-3">
                        {promocaoDoAgrupamento ? (
                          <Button type="button" size="sm" variant="outline" onClick={() => setPromocaoDetalhe(promocaoDoAgrupamento)}>
                            Promoção já criada
                          </Button>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="p-2 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button type="button" size="icon" variant="ghost" className="h-8 w-8" aria-label="Abrir ações do agrupamento">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" sideOffset={6} collisionPadding={12} className="w-48 max-w-[calc(100vw-1.5rem)]">
                            <DropdownMenuItem onClick={() => setGrupoDetalhe(grupo)}>
                              <Eye className="mr-2 h-4 w-4" />
                              Ver
                            </DropdownMenuItem>
                            {promocaoDoAgrupamento && (
                              <DropdownMenuItem onClick={() => setPromocaoDetalhe(promocaoDoAgrupamento)}>
                                <Eye className="mr-2 h-4 w-4" />
                                Ver Promoção
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem disabled={!promocaoEntidadeDisponivel || Boolean(promocaoDoAgrupamento)} onClick={() => abrirCriacaoPromocao(grupo)}>
                              <PlusCircle className="mr-2 h-4 w-4" />
                              {promocaoDoAgrupamento ? 'Promoção já criada' : 'Criar Promoção'}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
                {gruposFiltrados.length === 0 && <tr><td colSpan={14} className="p-6 text-center text-slate-500">Nenhum agrupamento encontrado.</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>4. Promoções atuais com ordenação</CardTitle>
          <p className="mt-1 text-sm text-slate-500">Militares com promoção atual ativa compatível, data_promocao e antiguidade_referencia_ordem preenchidas, agrupados por data e ordem.</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {atuaisPorGrupo.map((grupo) => (
              <div key={`${grupo.data_promocao}-${grupo.ordem}`} className="rounded-lg border p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="whitespace-nowrap px-2 py-0.5 text-xs">Data: {dataFormatada(grupo.data_promocao)}</Badge>
                  <Badge variant="outline" className="whitespace-nowrap px-2 py-0.5 text-xs">Ordem: {grupo.ordem}</Badge>
                  <Badge className="whitespace-nowrap px-2 py-0.5 text-xs">{grupo.itens.length} militar(es)</Badge>
                  <Button type="button" size="sm" variant="ghost" onClick={() => copiarTexto(linhasMilitares(grupo.itens.map((item) => item.militar)))}><ClipboardCopy className="mr-2 h-4 w-4" />Copiar lista</Button>
                </div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {grupo.itens.map(({ militar }) => (
                    <Link key={militar.id} to={`${createPageUrl('VerMilitar')}?id=${militar.id}`} className="rounded-md bg-slate-50 p-3 text-sm hover:bg-blue-50">
                      <strong>{nomeMilitar(militar)}</strong><br />{valorOuTraco(militar.posto_graduacao)} / {valorOuTraco(militar.quadro)} · Mat. {valorOuTraco(militar.matricula)}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
            {atuaisPorGrupo.length === 0 && <p className="rounded-lg border p-6 text-center text-slate-500">Nenhuma promoção atual com ordenação encontrada.</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle>5. Promoções criadas</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Registros carregados diretamente de base44.entities.Promocao.list().</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="w-fit whitespace-nowrap px-2 py-0.5 text-xs">{promocoesCriadas.length} registro(s)</Badge>
              <Button type="button" variant="outline" size="sm" onClick={() => refetchPromocoes()} disabled={!promocaoEntidadeDisponivel || isFetchingPromocoes}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isFetchingPromocoes ? 'animate-spin' : ''}`} /> Atualizar
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => copiarTexto(linhasPromocoes(promocoesCriadas))} disabled={promocoesCriadas.length === 0}>
                <ClipboardCopy className="mr-2 h-4 w-4" /> Copiar dados
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {promocoesError && (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Falha ao carregar Promoções</AlertTitle>
              <AlertDescription>{promocoesError?.message || 'Não foi possível carregar base44.entities.Promocao.list().'}</AlertDescription>
            </Alert>
          )}
          <div className="overflow-x-auto rounded-lg border">
            <table className="min-w-max w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr><th className="p-3">Tipo</th><th className="p-3">Status</th><th className="p-3">Posto/graduação</th><th className="p-3">Quadro</th><th className="p-3">Data promoção</th><th className="p-3">Boletim referência</th><th className="p-3">Ato referência</th><th className="p-3">Origem</th><th className="p-3">Total vinculados</th><th className="p-3">Hash agrupamento</th><th className="p-3">Criado em</th><th className="p-3">Ações</th></tr>
              </thead>
              <tbody>
                {promocoesCriadas.map((promocao) => (
                  <tr key={promocao.id || promocao.hash_agrupamento || promocao.chave_agrupamento} className="border-t">
                    <td className="p-3">{valorOuTraco(promocao.tipo)}</td>
                    <td className="p-3">{valorOuTraco(promocao.status)}</td>
                    <td className="p-3">{valorOuTraco(promocao.posto_graduacao)}</td>
                    <td className="p-3">{valorOuTraco(promocao.quadro)}</td>
                    <td className="p-3">{dataFormatada(promocao.data_promocao)}</td>
                    <td className="p-3">{valorOuTraco(promocao.boletim_referencia)}</td>
                    <td className="p-3">{valorOuTraco(promocao.ato_referencia)}</td>
                    <td className="p-3">{valorOuTraco(promocao.origem)}</td>
                    <td className="p-3">{valorOuTraco(promocao.total_militares_vinculados)}</td>
                    <td className="p-3 font-mono text-xs">{valorOuTraco(promocao.hash_agrupamento)}</td>
                    <td className="p-3">{dataFormatada(promocao.criado_em)}</td>
                    <td className="p-2 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button type="button" size="icon" variant="ghost" className="h-8 w-8" aria-label="Abrir ações da promoção">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" sideOffset={6} collisionPadding={12} className="w-48 max-w-[calc(100vw-1.5rem)]">
                          <DropdownMenuItem onClick={() => setPromocaoDetalhe(promocao)}>
                            <Eye className="mr-2 h-4 w-4" />
                            Ver detalhes
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => copiarTexto(linhasPromocao(promocao))}>
                            <ClipboardCopy className="mr-2 h-4 w-4" />
                            Copiar dados
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => refetchPromocoes()}>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Atualizar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
                {!isLoadingPromocoes && promocoesCriadas.length === 0 && <tr><td colSpan={12} className="p-6 text-center text-slate-500">Nenhuma Promoção criada encontrada.</td></tr>}
                {isLoadingPromocoes && <tr><td colSpan={12} className="p-6 text-center text-slate-500">Carregando Promoções criadas...</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(grupoCriacao)} onOpenChange={(open) => !open && fecharCriacaoPromocao()}>
        <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b px-5 py-4 pr-12"><DialogTitle>Criar Promoção a partir do agrupamento</DialogTitle></DialogHeader>
          {grupoCriacao && (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
                {!promocaoEntidadeDisponivel && (
                  <Alert variant="destructive">
                    <AlertTitle>Criação indisponível</AlertTitle>
                    <AlertDescription>{avisoPromocaoIndisponivel}</AlertDescription>
                  </Alert>
                )}

              <Alert variant={diagnosticoCriacao.bloqueado ? 'destructive' : 'default'}>
                <AlertTitle>{diagnosticoCriacao.bloqueado ? 'Criação bloqueada' : 'Revisão obrigatória'}</AlertTitle>
                <AlertDescription>
                  {diagnosticoCriacao.bloqueado
                    ? diagnosticoCriacao.motivo
                    : 'Revise os dados abaixo. A confirmação criará somente Promoção, sem vincular históricos e sem alterar Militar, Prévia Geral, ordenação ou snapshots.'}
                </AlertDescription>
              </Alert>

              {promocaoExistente && (
                <Alert variant="destructive">
                  <AlertTitle>Duplicidade encontrada</AlertTitle>
                  <AlertDescription>
                    <div className="space-y-2">
                      <p>
                        Promoção já criada com a mesma chave/hash de agrupamento
                        {promocaoExistente.id ? ` (ID ${promocaoExistente.id})` : ''}.
                      </p>
                      <Button type="button" size="sm" variant="outline" onClick={() => setPromocaoDetalhe(promocaoExistente)}>
                        Ver Promoção
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {promocaoRevisao && (
                <>
                  <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2 xl:grid-cols-3">
                    {[
                      ['Tipo', promocaoRevisao.tipo],
                      ['Natureza', promocaoRevisao.natureza],
                      ['Posto/graduação', promocaoRevisao.posto_graduacao],
                      ['Quadro', promocaoRevisao.quadro],
                      ['Data promoção', dataFormatada(promocaoRevisao.data_promocao)],
                      ['Data publicação', dataFormatada(promocaoRevisao.data_publicacao)],
                      ['Boletim referência', promocaoRevisao.boletim_referencia],
                      ['Ato referência', promocaoRevisao.ato_referencia],
                      ['Status', promocaoRevisao.status],
                      ['Origem', promocaoRevisao.origem],
                      ['Chave agrupamento', promocaoRevisao.chave_agrupamento],
                      ['Hash agrupamento', promocaoRevisao.hash_agrupamento],
                      ['Total militares vinculados', promocaoRevisao.total_militares_vinculados],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-md border bg-slate-50 px-3 py-2">
                        <span className="text-[0.68rem] font-semibold uppercase leading-none text-slate-500">{label}</span>
                        <p className="mt-0.5 break-words text-sm font-medium leading-snug text-slate-900">{valorOuTraco(value)}</p>
                      </div>
                    ))}
                  </div>

                  <div>
                    <Label className="text-xs">Observações</Label>
                    <Textarea value={promocaoRevisao.observacoes} readOnly rows={2} className="mt-1 min-h-[64px] bg-slate-50 text-sm" />
                  </div>

                  <div>
                    <Label className="text-xs">Digite {TEXTO_CONFIRMACAO_CRIAR_PROMOCAO} para confirmar</Label>
                    <Input
                      value={confirmacaoCriacao}
                      onChange={(event) => setConfirmacaoCriacao(event.target.value)}
                      placeholder={TEXTO_CONFIRMACAO_CRIAR_PROMOCAO}
                      disabled={!promocaoEntidadeDisponivel || diagnosticoCriacao.bloqueado || criarPromocaoMutation.isPending}
                    />
                    <p className="mt-1 text-xs text-slate-500">Sem esse texto exato, nenhuma Promoção será criada.</p>
                  </div>
                </>
              )}
              </div>
              <DialogFooter className="sticky bottom-0 z-10 shrink-0 border-t bg-background px-5 py-3">
                <Button type="button" variant="outline" onClick={fecharCriacaoPromocao} disabled={criarPromocaoMutation.isPending}>Cancelar</Button>
                <Button type="button" onClick={confirmarCriacaoPromocao} disabled={!podeConfirmarCriacao || criarPromocaoMutation.isPending}>
                  {criarPromocaoMutation.isPending ? 'Criando...' : 'Criar Promoção'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(promocaoDetalhe)} onOpenChange={(open) => !open && setPromocaoDetalhe(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>Detalhes da Promoção</DialogTitle></DialogHeader>
          {promocaoDetalhe && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2 xl:grid-cols-3">
                {[
                  ['ID', promocaoDetalhe.id],
                  ['Tipo', promocaoDetalhe.tipo],
                  ['Status', promocaoDetalhe.status],
                  ['Posto/graduação', promocaoDetalhe.posto_graduacao],
                  ['Quadro', promocaoDetalhe.quadro],
                  ['Data promoção', dataFormatada(promocaoDetalhe.data_promocao)],
                  ['Boletim referência', promocaoDetalhe.boletim_referencia],
                  ['Ato referência', promocaoDetalhe.ato_referencia],
                  ['Origem', promocaoDetalhe.origem],
                  ['Total militares vinculados', promocaoDetalhe.total_militares_vinculados],
                  ['Hash agrupamento', promocaoDetalhe.hash_agrupamento],
                  ['Criado em', dataFormatada(promocaoDetalhe.criado_em)],
                  ['Criado por', promocaoDetalhe.criado_por],
                  ['Atualizado em', dataFormatada(promocaoDetalhe.atualizado_em)],
                  ['Atualizado por', promocaoDetalhe.atualizado_por],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-md border bg-slate-50 px-3 py-2">
                    <span className="text-[0.68rem] font-semibold uppercase leading-none text-slate-500">{label}</span>
                    <p className="mt-0.5 break-words text-sm font-medium leading-snug text-slate-900">{valorOuTraco(value)}</p>
                  </div>
                ))}
              </div>

              <div>
                <Label className="text-xs">Chave agrupamento</Label>
                <Textarea value={valorOuTraco(promocaoDetalhe.chave_agrupamento)} readOnly rows={2} className="mt-1 min-h-[64px] bg-slate-50 font-mono text-xs" />
              </div>

              <div>
                <Label className="text-xs">Observações</Label>
                <Textarea value={valorOuTraco(promocaoDetalhe.observacoes)} readOnly rows={3} className="mt-1 min-h-[84px] bg-slate-50 text-sm" />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => copiarTexto(linhasPromocao(promocaoDetalhe))}>
                  <ClipboardCopy className="mr-2 h-4 w-4" /> Copiar dados
                </Button>
                <Button type="button" onClick={() => setPromocaoDetalhe(null)}>Fechar</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(grupoDetalhe)} onOpenChange={(open) => !open && setGrupoDetalhe(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader><DialogTitle>Detalhes do agrupamento</DialogTitle></DialogHeader>
          {grupoDetalhe && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                <div><span className="text-slate-500">Posto/quadro</span><p className="font-medium">{grupoDetalhe.posto} / {grupoDetalhe.quadro}</p></div>
                <div><span className="text-slate-500">Promoção</span><p className="font-medium">{dataFormatada(grupoDetalhe.data_promocao)}</p></div>
                <div><span className="text-slate-500">Publicação</span><p className="font-medium">{dataFormatada(grupoDetalhe.data_publicacao)}</p></div>
                <div><span className="text-slate-500">Confiança</span><p><Badge variant={confiancaVariant(grupoDetalhe.confianca)}>{grupoDetalhe.confianca}</Badge></p></div>
              </div>
              <Button type="button" variant="outline" onClick={() => copiarTexto(linhasMilitares(grupoDetalhe.militares))}><ClipboardCopy className="mr-2 h-4 w-4" />Copiar militares do agrupamento</Button>
              <div className="max-h-[55vh] overflow-x-auto rounded-lg border">
                <table className="min-w-max w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="p-3">Militar</th><th className="p-3">Matrícula</th><th className="p-3">Status</th><th className="p-3">Ordem</th><th className="p-3">Boletim</th><th className="p-3">Ato</th><th className="p-3">Ficha</th></tr></thead>
                  <tbody>
                    {grupoDetalhe.registros.map((registro, index) => {
                      const militar = data.militaresAtivos.find((item) => String(item.id) === String(registro.militar_id));
                      return (
                        <tr key={`${registro.id || registro.militar_id}-${index}`} className="border-t">
                          <td className="p-3 font-medium">{militar ? nomeMilitar(militar) : `ID ${valorOuTraco(registro.militar_id)}`}</td>
                          <td className="p-3">{valorOuTraco(militar?.matricula)}</td>
                          <td className="p-3">{valorOuTraco(registro.status_registro || 'ativo')}</td>
                          <td className="p-3">{valorOuTraco(registro.antiguidade_referencia_ordem)}</td>
                          <td className="p-3">{valorOuTraco(registro.boletim_referencia)}</td>
                          <td className="p-3">{valorOuTraco(registro.ato_referencia)}</td>
                          <td className="p-3">{militar ? <Link className="text-blue-700 hover:underline" to={`${createPageUrl('VerMilitar')}?id=${militar.id}`}>Abrir ficha</Link> : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
