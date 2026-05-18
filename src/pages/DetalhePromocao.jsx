import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Trash2, UserPlus } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import {
  buscarCandidatosProvaveis,
  dataFormatada,
  diagnosticarPromocao,
  enriquecerHistoricos,
  filtrarCandidatosCompativeis,
  historicoCombinaComPromocao,
  montarDiagnosticoMilitaresPromocao,
  montarMilitarPorId,
  montarPatchPromocaoMilitar,
  montarPayloadAdicaoManualTurma,
  nomeMilitar,
  normalizar,
  normalizarItemTurmaOperacional,
  podeVincularProvavelAdministrativamente,
  texto,
  validarSalvarTurmaOperacional,
  valorOuTraco,
} from '@/services/promocaoService';

const CAMPOS_PROMOCAO = [
  'posto_graduacao',
  'quadro',
  'status',
  'data_promocao',
  'data_publicacao',
  'boletim_referencia',
  'ato_referencia',
  'observacoes',
];

async function carregarPromocaoPorId(promocaoId) {
  if (!promocaoId) return null;

  if (typeof base44.entities.Promocao.get === 'function') {
    try {
      const promocao = await base44.entities.Promocao.get(promocaoId);
      if (promocao) return promocao;
    } catch (error) {
      console.warn('[DetalhePromocao] Promocao.get indisponível; usando busca alternativa.', error);
    }
  }

  if (typeof base44.entities.Promocao.filter === 'function') {
    const encontrados = await base44.entities.Promocao.filter({ id: promocaoId });
    if (encontrados?.[0]) return encontrados[0];
  }

  const promocoes = await base44.entities.Promocao.list();
  return promocoes.find((promocao) => String(promocao.id) === String(promocaoId)) || null;
}

function campoData(valor) {
  return String(valor || '').split('T')[0];
}

function montarRascunhoPromocao(promocao = {}) {
  return {
    posto_graduacao: texto(promocao.posto_graduacao),
    quadro: texto(promocao.quadro),
    status: texto(promocao.status),
    data_promocao: campoData(promocao.data_promocao),
    data_publicacao: campoData(promocao.data_publicacao),
    boletim_referencia: texto(promocao.boletim_referencia),
    ato_referencia: texto(promocao.ato_referencia),
    observacoes: texto(promocao.observacoes),
  };
}

function montarPatchPromocao(rascunho = {}) {
  return CAMPOS_PROMOCAO.reduce((patch, campo) => ({ ...patch, [campo]: rascunho[campo] || '' }), {});
}

function rotuloSituacao(status, publicado) {
  if (publicado || status === 'publicado') return 'Publicado';
  if (status === 'bloqueado') return 'Bloqueado';
  if (status === 'cancelado') return 'Cancelado';
  return 'Na promoção';
}

function situacaoClass(status, publicado) {
  if (publicado || status === 'publicado') return 'border-emerald-300 bg-emerald-50 text-emerald-700';
  if (status === 'bloqueado') return 'border-amber-300 bg-amber-50 text-amber-700';
  if (status === 'cancelado') return 'border-rose-300 bg-rose-50 text-rose-700';
  return 'border-indigo-300 bg-indigo-50 text-indigo-700';
}

function mensagemSimples(alerta) {
  const mensagens = {
    'ordem duplicada entre selecionados': 'Existe ordem repetida.',
    'ordem duplicada': 'Existe ordem repetida.',
    'militar duplicado na turma': 'Este militar já está na promoção.',
    'bloqueado/cancelado sem justificativa': 'Informe uma justificativa.',
  };
  return mensagens[alerta] || alerta;
}

function mensagensValidacaoSimples(validacao) {
  return [...new Set((validacao?.bloqueios || []).map(mensagemSimples))];
}

function Field({ label, children, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`}>
      <Label className="text-sm font-medium text-slate-700">{label}</Label>
      {children}
    </div>
  );
}

function InfoItem({ label, value }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export default function DetalhePromocao() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isAdmin } = useCurrentUser();
  const promocaoId = searchParams.get('id');
  const listasPreparadasAutomaticamente = useRef(new Set());

  const [rascunhoPromocao, setRascunhoPromocao] = useState(montarRascunhoPromocao());
  const [rascunhoTurma, setRascunhoTurma] = useState([]);
  const [registroParaRemover, setRegistroParaRemover] = useState(null);
  const [modalAdicionarAberto, setModalAdicionarAberto] = useState(false);
  const [buscaAdicionar, setBuscaAdicionar] = useState('');

  const promocaoQuery = useQuery({
    queryKey: ['detalhe-promocao', promocaoId],
    queryFn: () => carregarPromocaoPorId(promocaoId),
    enabled: Boolean(promocaoId),
  });

  const historicosQuery = useQuery({
    queryKey: ['detalhe-promocao-historicos-v2'],
    queryFn: () => base44.entities.HistoricoPromocaoMilitarV2.list(),
  });

  const promocaoMilitarQuery = useQuery({
    queryKey: ['detalhe-promocao-promocao-militar'],
    queryFn: async () => {
      const entity = base44.entities.PromocaoMilitar;
      if (!entity || typeof entity.list !== 'function') return [];
      try {
        return await entity.list();
      } catch (error) {
        console.warn('[DetalhePromocao] PromocaoMilitar indisponível; lista principal usará registros já vinculados.', error);
        return [];
      }
    },
  });

  const militaresQuery = useQuery({
    queryKey: ['detalhe-promocao-militares'],
    queryFn: () => base44.entities.Militar.list(),
  });

  const promocao = promocaoQuery.data;
  const militarPorId = useMemo(() => montarMilitarPorId(militaresQuery.data || []), [militaresQuery.data]);

  const historicosCompativeis = useMemo(() => {
    if (!promocao) return [];
    return (historicosQuery.data || []).filter((historico) => historicoCombinaComPromocao(historico, promocao));
  }, [historicosQuery.data, promocao]);

  const historicosVinculados = useMemo(() => {
    if (!promocao) return [];
    return enriquecerHistoricos(
      (historicosQuery.data || []).filter((historico) => String(historico?.promocao_id || '') === String(promocao.id)),
      militarPorId,
    );
  }, [historicosQuery.data, militarPorId, promocao]);

  const turma = useMemo(() => {
    if (!promocao) return [];
    return (promocaoMilitarQuery.data || [])
      .filter((registro) => String(registro?.promocao_id || '') === String(promocao.id))
      .map((registro) => ({
        ...registro,
        militar: militarPorId.get(String(registro?.militar_id || '')) || null,
      }))
      .sort((a, b) => (Number(a?.ordem || 0) - Number(b?.ordem || 0)) || nomeMilitar(a.militar).localeCompare(nomeMilitar(b.militar)));
  }, [militarPorId, promocao, promocaoMilitarQuery.data]);

  const listaExibida = useMemo(() => {
    if (turma.length > 0) return turma;
    return historicosVinculados
      .map((historico) => ({
        id: `historico-${historico.id}`,
        promocao_id: promocao?.id || '',
        militar_id: historico.militar_id || '',
        historico_promocao_v2_id: historico.id || '',
        ordem: historico.antiguidade_referencia_ordem || 0,
        status: 'publicado',
        selecionado: true,
        publicado: true,
        origem: 'legado_historico_v2',
        militar: historico.militar || null,
      }))
      .sort((a, b) => (Number(a?.ordem || 0) - Number(b?.ordem || 0)) || nomeMilitar(a.militar).localeCompare(nomeMilitar(b.militar)));
  }, [historicosVinculados, promocao, turma]);

  const candidatosHistorico = useMemo(() => {
    if (!promocao) return [];
    const fortes = filtrarCandidatosCompativeis({ promocao, historicos: historicosQuery.data || [] });
    const provaveis = buscarCandidatosProvaveis({ promocao, historicos: historicosQuery.data || [] })
      .filter((historico) => podeVincularProvavelAdministrativamente(historico, promocao));
    const porMilitar = new Map();
    enriquecerHistoricos([...fortes, ...provaveis], militarPorId).forEach((historico) => {
      const militarId = String(historico?.militar_id || '');
      if (militarId && !porMilitar.has(militarId)) porMilitar.set(militarId, historico);
    });
    return [...porMilitar.values()];
  }, [historicosQuery.data, militarPorId, promocao]);

  const candidatosAdicionar = useMemo(() => {
    const idsNaPromocao = new Set(listaExibida.map((registro) => String(registro?.militar_id || '')).filter(Boolean));
    const porMilitar = new Map();

    candidatosHistorico.forEach((historico) => {
      const militarId = String(historico?.militar_id || '');
      if (!militarId || idsNaPromocao.has(militarId)) return;
      porMilitar.set(militarId, {
        id: `historico-${historico.id}`,
        militarId,
        militar: historico.militar || militarPorId.get(militarId) || null,
        historico,
      });
    });

    (militaresQuery.data || []).forEach((militar) => {
      const militarId = String(militar?.id || '');
      if (!militarId || idsNaPromocao.has(militarId) || porMilitar.has(militarId)) return;
      const postoCombina = !texto(promocao?.posto_graduacao) || normalizar(militar?.posto_graduacao || militar?.posto_graduacao_atual) === normalizar(promocao?.posto_graduacao);
      const quadroCombina = !texto(promocao?.quadro) || normalizar(militar?.quadro || militar?.quadro_atual) === normalizar(promocao?.quadro);
      if (postoCombina && quadroCombina) {
        porMilitar.set(militarId, { id: `militar-${militarId}`, militarId, militar, historico: null });
      }
    });

    const termo = normalizar(buscaAdicionar);
    return [...porMilitar.values()]
      .filter((item) => {
        if (!termo) return true;
        return normalizar(`${nomeMilitar(item.militar)} ${item.militar?.nome_completo || ''} ${item.militar?.matricula || ''}`).includes(termo);
      })
      .slice(0, 30);
  }, [buscaAdicionar, candidatosHistorico, listaExibida, militarPorId, militaresQuery.data, promocao]);

  const diagnostico = useMemo(() => {
    if (!promocao) return null;
    return diagnosticarPromocao({ promocao, historicosCompativeis });
  }, [historicosCompativeis, promocao]);

  const diagnosticoMilitares = useMemo(() => {
    if (!promocao) return [];
    return montarDiagnosticoMilitaresPromocao({
      promocao,
      historicos: historicosQuery.data || [],
      militares: militaresQuery.data || [],
    });
  }, [historicosQuery.data, militaresQuery.data, promocao]);

  useEffect(() => {
    if (promocao) setRascunhoPromocao(montarRascunhoPromocao(promocao));
  }, [promocao]);

  useEffect(() => {
    setRascunhoTurma(turma.map((registro) => normalizarItemTurmaOperacional(registro)));
  }, [turma]);

  const validacaoSalvarTurma = useMemo(() => validarSalvarTurmaOperacional(rascunhoTurma), [rascunhoTurma]);
  const mensagensValidacao = useMemo(() => mensagensValidacaoSimples(validacaoSalvarTurma), [validacaoSalvarTurma]);

  const existemAlteracoesPromocao = useMemo(() => {
    if (!promocao) return false;
    return JSON.stringify(montarPatchPromocao(rascunhoPromocao)) !== JSON.stringify(montarPatchPromocao(montarRascunhoPromocao(promocao)));
  }, [promocao, rascunhoPromocao]);

  const existemAlteracoesTurma = useMemo(() => {
    const origem = new Map(turma.map((registro) => [String(registro.id), montarPatchPromocaoMilitar(registro)]));
    return rascunhoTurma.some((registro) => JSON.stringify(montarPatchPromocaoMilitar(registro)) !== JSON.stringify(origem.get(String(registro.id)) || {}));
  }, [rascunhoTurma, turma]);

  const atualizarCampoPromocao = (campo, valor) => {
    setRascunhoPromocao((atual) => ({ ...atual, [campo]: valor }));
  };

  const atualizarRascunhoTurma = (registroId, campo, valor) => {
    setRascunhoTurma((atuais) => atuais.map((registro) => (
      String(registro.id) === String(registroId) ? { ...registro, [campo]: valor } : registro
    )));
  };

  const invalidarDados = () => {
    queryClient.invalidateQueries({ queryKey: ['detalhe-promocao', promocaoId] });
    queryClient.invalidateQueries({ queryKey: ['detalhe-promocao-promocao-militar'] });
  };

  const salvarPromocaoMutation = useMutation({
    mutationFn: async () => {
      if (!promocao) throw new Error('Promoção não carregada.');
      await base44.entities.Promocao.update(promocao.id, montarPatchPromocao(rascunhoPromocao));
    },
    onSuccess: () => {
      toast({ title: 'Dados salvos', description: 'Os dados da promoção foram atualizados.' });
      queryClient.invalidateQueries({ queryKey: ['detalhe-promocao', promocaoId] });
    },
    onError: (error) => toast({ title: 'Falha ao salvar dados', description: error.message, variant: 'destructive' }),
  });

  const prepararListaMutation = useMutation({
    mutationFn: async () => {
      if (!promocao) throw new Error('Promoção não carregada.');
      if (turma.length > 0) return { listaPreparada: false };

      const entity = base44.entities.PromocaoMilitar;
      if (!entity || typeof entity.create !== 'function') {
        throw new Error('Não foi possível organizar a lista de militares.');
      }

      const registrosAtuais = typeof entity.list === 'function'
        ? await entity.list()
        : (promocaoMilitarQuery.data || []);
      const registrosDaPromocao = (registrosAtuais || [])
        .filter((registro) => String(registro?.promocao_id || '') === String(promocao.id));
      if (registrosDaPromocao.length > 0) return { listaPreparada: false };

      await Promise.all(historicosVinculados.map((historico) => entity.create({
        promocao_id: promocao.id,
        militar_id: historico.militar_id || '',
        historico_promocao_v2_id: historico.id || '',
        ordem: Number(historico.antiguidade_referencia_ordem || 0),
        status: 'publicado',
        selecionado: true,
        publicado: true,
        origem: 'backfill_historico_v2',
      })));
      return { listaPreparada: true };
    },
    onSuccess: (resultado) => {
      if (resultado?.listaPreparada) toast({ title: 'Lista de militares preparada.' });
      queryClient.invalidateQueries({ queryKey: ['detalhe-promocao-promocao-militar'] });
    },
    onError: (error) => {
      listasPreparadasAutomaticamente.current.delete(String(promocao?.id || promocaoId || ''));
      toast({ title: 'Falha ao organizar lista', description: error.message, variant: 'destructive' });
    },
  });

  const salvarTurmaMutation = useMutation({
    mutationFn: async () => {
      if (!base44.entities.PromocaoMilitar || typeof base44.entities.PromocaoMilitar.update !== 'function') {
        throw new Error('Não foi possível salvar a lista.');
      }
      const validacao = validarSalvarTurmaOperacional(rascunhoTurma);
      if (!validacao.valido) throw new Error(mensagensValidacaoSimples(validacao).join(' '));
      const originais = new Map(turma.map((registro) => [String(registro.id), montarPatchPromocaoMilitar(registro)]));
      const alterados = rascunhoTurma.filter((registro) => (
        JSON.stringify(montarPatchPromocaoMilitar(registro)) !== JSON.stringify(originais.get(String(registro.id)) || {})
      ));
      await Promise.all(alterados.map((registro) => base44.entities.PromocaoMilitar.update(registro.id, montarPatchPromocaoMilitar(registro))));
    },
    onSuccess: () => {
      toast({ title: 'Rascunho salvo', description: 'A lista de militares foi atualizada.' });
      queryClient.invalidateQueries({ queryKey: ['detalhe-promocao-promocao-militar'] });
    },
    onError: (error) => toast({ title: 'Falha ao salvar rascunho', description: error.message, variant: 'destructive' }),
  });

  const salvarRascunho = async () => {
    if (existemAlteracoesPromocao) await salvarPromocaoMutation.mutateAsync();
    if (existemAlteracoesTurma) await salvarTurmaMutation.mutateAsync();
    if (!existemAlteracoesPromocao && !existemAlteracoesTurma) {
      toast({ title: 'Nada para salvar', description: 'Não há alterações pendentes.' });
    }
  };

  const removerMutation = useMutation({
    mutationFn: async (registro) => {
      if (!registro) throw new Error('Selecione um militar.');
      if (registro.publicado) throw new Error('Não é possível remover militar publicado.');
      await base44.entities.PromocaoMilitar.delete(registro.id);
    },
    onSuccess: () => {
      toast({ title: 'Militar removido', description: 'O militar saiu da lista desta promoção.' });
      setRegistroParaRemover(null);
      queryClient.invalidateQueries({ queryKey: ['detalhe-promocao-promocao-militar'] });
    },
    onError: (error) => toast({ title: 'Falha ao remover militar', description: error.message, variant: 'destructive' }),
  });

  const adicionarMutation = useMutation({
    mutationFn: async (item) => {
      if (!promocao) throw new Error('Promoção não carregada.');
      if (!item?.militarId) throw new Error('Militar não selecionado.');
      const jaExiste = listaExibida.some((registro) => String(registro?.militar_id || '') === String(item.militarId));
      if (jaExiste) throw new Error('Este militar já está na promoção.');
      const usuario = typeof base44.auth?.me === 'function' ? await base44.auth.me() : null;
      await base44.entities.PromocaoMilitar.create(montarPayloadAdicaoManualTurma({
        promocao,
        historico: item.historico || {},
        militarId: item.militarId,
        usuario,
      }));
    },
    onSuccess: () => {
      toast({ title: 'Militar adicionado', description: 'O militar foi incluído na lista desta promoção.' });
      setModalAdicionarAberto(false);
      setBuscaAdicionar('');
      queryClient.invalidateQueries({ queryKey: ['detalhe-promocao-promocao-militar'] });
    },
    onError: (error) => toast({ title: 'Falha ao adicionar militar', description: error.message, variant: 'destructive' }),
  });

  const isLoading = promocaoQuery.isLoading || historicosQuery.isLoading || promocaoMilitarQuery.isLoading || militaresQuery.isLoading;
  const error = promocaoQuery.error || historicosQuery.error || promocaoMilitarQuery.error || militaresQuery.error;
  const salvando = salvarPromocaoMutation.isPending || salvarTurmaMutation.isPending;
  const precisaPrepararLista = turma.length === 0 && historicosVinculados.length > 0;

  useEffect(() => {
    if (historicosQuery.isLoading || promocaoMilitarQuery.isLoading) return;
    if (!promocao || !precisaPrepararLista || prepararListaMutation.isPending) return;
    const chavePromocao = String(promocao.id || '');
    if (!chavePromocao || listasPreparadasAutomaticamente.current.has(chavePromocao)) return;
    listasPreparadasAutomaticamente.current.add(chavePromocao);
    prepararListaMutation.mutate();
  }, [
    historicosQuery.isLoading,
    precisaPrepararLista,
    prepararListaMutation,
    promocao,
    promocaoMilitarQuery.isLoading,
  ]);

  return (
    <div className="min-h-screen space-y-6 bg-slate-50 p-4 md:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Promoção</p>
          <h1 className="text-3xl font-bold text-slate-900">
            Promoção — {valorOuTraco(promocao?.posto_graduacao)}
          </h1>
          <p className="mt-2 text-slate-600">
            {dataFormatada(promocao?.data_promocao)} • {valorOuTraco(promocao?.quadro)} • {listaExibida.length} militares
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => navigate(createPageUrl('Promocoes'))}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <Button variant="outline" onClick={invalidarDados} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button onClick={salvarRascunho} disabled={salvando || (!existemAlteracoesPromocao && !existemAlteracoesTurma)}>
            Salvar rascunho
          </Button>
        </div>
      </div>

      {!promocaoId && (
        <Alert variant="destructive">
          <AlertTitle>Promoção não informada</AlertTitle>
          <AlertDescription>Acesse esta tela pela listagem de promoções.</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Falha ao carregar</AlertTitle>
          <AlertDescription>{error.message || 'Não foi possível carregar os dados da promoção.'}</AlertDescription>
        </Alert>
      )}

      {!isLoading && promocaoId && !promocao && (
        <Alert variant="destructive">
          <AlertTitle>Promoção não encontrada</AlertTitle>
          <AlertDescription>Nenhuma promoção foi localizada para o id informado.</AlertDescription>
        </Alert>
      )}

      {promocao && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>1. Dados da promoção</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Posto/graduação">
                  <Input value={rascunhoPromocao.posto_graduacao} onChange={(event) => atualizarCampoPromocao('posto_graduacao', event.target.value)} />
                </Field>
                <Field label="Quadro">
                  <Input value={rascunhoPromocao.quadro} onChange={(event) => atualizarCampoPromocao('quadro', event.target.value)} />
                </Field>
                <Field label="Status">
                  <Input value={rascunhoPromocao.status} onChange={(event) => atualizarCampoPromocao('status', event.target.value)} />
                </Field>
                <Field label="Data da promoção">
                  <Input type="date" value={rascunhoPromocao.data_promocao} onChange={(event) => atualizarCampoPromocao('data_promocao', event.target.value)} />
                </Field>
                <Field label="Data da publicação">
                  <Input type="date" value={rascunhoPromocao.data_publicacao} onChange={(event) => atualizarCampoPromocao('data_publicacao', event.target.value)} />
                </Field>
                <Field label="Boletim">
                  <Input value={rascunhoPromocao.boletim_referencia} onChange={(event) => atualizarCampoPromocao('boletim_referencia', event.target.value)} />
                </Field>
                <Field label="Ato">
                  <Input value={rascunhoPromocao.ato_referencia} onChange={(event) => atualizarCampoPromocao('ato_referencia', event.target.value)} />
                </Field>
                <Field label="Observações" className="md:col-span-2">
                  <Textarea value={rascunhoPromocao.observacoes} onChange={(event) => atualizarCampoPromocao('observacoes', event.target.value)} />
                </Field>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>2. Militares da promoção</CardTitle>
                <p className="mt-1 text-sm text-slate-500">Edite a ordem, adicione ou remova militares antes da publicação.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setModalAdicionarAberto(true)} disabled={prepararListaMutation.isPending}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Adicionar militar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {mensagensValidacao.length > 0 && (
                <Alert className="border-amber-200 bg-amber-50">
                  <AlertTitle>Revise a lista</AlertTitle>
                  <AlertDescription>
                    <ul className="mt-2 list-disc pl-5">
                      {mensagensValidacao.map((mensagem) => <li key={mensagem}>{mensagem}</li>)}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              <div className="overflow-x-auto rounded-lg border bg-white">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ordem</TableHead>
                      <TableHead>Militar</TableHead>
                      <TableHead>Matrícula</TableHead>
                      <TableHead>Posto atual</TableHead>
                      <TableHead>Quadro atual</TableHead>
                      <TableHead>Situação</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {listaExibida.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="py-8 text-center text-slate-500">Nenhum militar incluído nesta promoção.</TableCell>
                      </TableRow>
                    )}
                    {turma.length === 0 && listaExibida.map((registro) => (
                      <TableRow key={registro.id}>
                        <TableCell>{registro.ordem || '—'}</TableCell>
                        <TableCell className="font-medium">{nomeMilitar(registro.militar)}</TableCell>
                        <TableCell>{valorOuTraco(registro.militar?.matricula)}</TableCell>
                        <TableCell>{valorOuTraco(registro.militar?.posto_graduacao || registro.militar?.posto_graduacao_atual)}</TableCell>
                        <TableCell>{valorOuTraco(registro.militar?.quadro || registro.militar?.quadro_atual)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={situacaoClass(registro.status, registro.publicado)}>
                            {rotuloSituacao(registro.status, registro.publicado)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm text-slate-500">Aguarde</TableCell>
                      </TableRow>
                    ))}
                    {turma.length > 0 && rascunhoTurma.map((registro) => {
                      const original = turma.find((item) => String(item.id) === String(registro.id));
                      return (
                        <TableRow key={registro.id}>
                          <TableCell className="min-w-28">
                            <Input
                              type="number"
                              value={registro.ordem}
                              onChange={(event) => atualizarRascunhoTurma(registro.id, 'ordem', event.target.value === '' ? '' : Number(event.target.value))}
                              aria-label={`Ordem de ${nomeMilitar(original?.militar)}`}
                            />
                          </TableCell>
                          <TableCell className="min-w-48 font-medium">{nomeMilitar(original?.militar)}</TableCell>
                          <TableCell>{valorOuTraco(original?.militar?.matricula)}</TableCell>
                          <TableCell>{valorOuTraco(original?.militar?.posto_graduacao || original?.militar?.posto_graduacao_atual)}</TableCell>
                          <TableCell>{valorOuTraco(original?.militar?.quadro || original?.militar?.quadro_atual)}</TableCell>
                          <TableCell>
                            <select
                              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                              value={registro.status}
                              onChange={(event) => atualizarRascunhoTurma(registro.id, 'status', event.target.value)}
                              aria-label={`Situação de ${nomeMilitar(original?.militar)}`}
                            >
                              {['elegivel', 'bloqueado', 'publicado', 'cancelado'].map((status) => (
                                <option key={status} value={status}>{rotuloSituacao(status, false)}</option>
                              ))}
                              {!['elegivel', 'bloqueado', 'publicado', 'cancelado'].includes(registro.status) && (
                                <option value={registro.status}>{rotuloSituacao(registro.status, registro.publicado)}</option>
                              )}
                            </select>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="outline" onClick={() => setRegistroParaRemover({ ...registro, militar: original?.militar })} disabled={Boolean(registro.publicado)}>
                              <Trash2 className="mr-1 h-4 w-4" />
                              Remover
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>3. Finalização</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <InfoItem label="Militares" value={listaExibida.length} />
                <InfoItem label="Status da promoção" value={valorOuTraco(rascunhoPromocao.status)} />
                <InfoItem label="Impacta antiguidade" value="Não, enquanto não publicada" />
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button disabled title="Publicação será implementada na próxima etapa.">
                  Publicar promoção
                </Button>
              </div>
              <Alert>
                <AlertTitle>Publicação ainda não disponível</AlertTitle>
                <AlertDescription>Publicação será implementada na próxima etapa.</AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {isAdmin && (
            <details className="rounded-lg border bg-white p-4">
              <summary className="cursor-pointer font-semibold text-slate-900">Detalhes técnicos</summary>
              <div className="mt-4 space-y-4 text-sm text-slate-700">
                <div className="grid gap-3 md:grid-cols-2">
                  <div><strong>chave agrupamento:</strong> {valorOuTraco(promocao.chave_agrupamento)}</div>
                  <div><strong>hash agrupamento:</strong> {valorOuTraco(promocao.hash_agrupamento)}</div>
                  <div><strong>origem:</strong> {valorOuTraco(promocao.origem)}</div>
                  <div><strong>fonte interna:</strong> {turma.length > 0 ? 'PromocaoMilitar' : 'HistoricoPromocaoMilitarV2.promocao_id'}</div>
                </div>
                <div>
                  <p className="font-semibold">diagnósticos</p>
                  <ul className="mt-2 list-disc pl-5">
                    <li>históricos compatíveis: {historicosCompativeis.length}</li>
                    <li>históricos vinculados: {historicosVinculados.length}</li>
                    <li>registros de lista: {turma.length}</li>
                    <li>conflitos por militar: {diagnosticoMilitares.filter((linha) => ['Conflito', 'Revisar'].includes(linha.acaoSugerida)).length}</li>
                  </ul>
                </div>
                {diagnostico && (
                  <pre className="max-h-80 overflow-auto rounded-md bg-slate-950 p-3 text-xs text-slate-100">
                    {JSON.stringify(diagnostico, null, 2)}
                  </pre>
                )}
                <div>
                  <p className="font-semibold">conflitos</p>
                  <ul className="mt-2 list-disc pl-5">
                    {diagnosticoMilitares.filter((linha) => ['Conflito', 'Revisar'].includes(linha.acaoSugerida)).slice(0, 30).map((linha) => (
                      <li key={linha.chave}>{linha.militar_id || 'sem militar'} — {linha.motivo}</li>
                    ))}
                    {diagnosticoMilitares.filter((linha) => ['Conflito', 'Revisar'].includes(linha.acaoSugerida)).length === 0 && <li>Sem conflitos técnicos identificados.</li>}
                  </ul>
                </div>
              </div>
            </details>
          )}
        </>
      )}

      <Dialog open={modalAdicionarAberto} onOpenChange={setModalAdicionarAberto}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Adicionar militar</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Buscar por nome ou matrícula">
              <Input value={buscaAdicionar} onChange={(event) => setBuscaAdicionar(event.target.value)} placeholder="Digite nome ou matrícula" />
            </Field>
            <div className="max-h-96 overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Militar</TableHead>
                    <TableHead>Matrícula</TableHead>
                    <TableHead>Posto atual</TableHead>
                    <TableHead>Quadro atual</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {candidatosAdicionar.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-slate-500">Nenhum militar disponível para adicionar.</TableCell>
                    </TableRow>
                  )}
                  {candidatosAdicionar.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{nomeMilitar(item.militar)}</TableCell>
                      <TableCell>{valorOuTraco(item.militar?.matricula)}</TableCell>
                      <TableCell>{valorOuTraco(item.militar?.posto_graduacao || item.militar?.posto_graduacao_atual)}</TableCell>
                      <TableCell>{valorOuTraco(item.militar?.quadro || item.militar?.quadro_atual)}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" onClick={() => adicionarMutation.mutate(item)} disabled={adicionarMutation.isPending}>
                          Adicionar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAdicionarAberto(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(registroParaRemover)} onOpenChange={(open) => !open && setRegistroParaRemover(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover militar</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            Remover {nomeMilitar(registroParaRemover?.militar)} desta promoção? Militares já publicados não podem ser removidos.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegistroParaRemover(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => removerMutation.mutate(registroParaRemover)} disabled={!registroParaRemover || registroParaRemover.publicado || removerMutation.isPending}>
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
