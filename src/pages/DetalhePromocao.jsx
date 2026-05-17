import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Link2, RefreshCw, Unlink } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import {
  alertasCandidato,
  buscarCandidatosProvaveis,
  dataFormatada,
  diagnosticarPromocao,
  enriquecerHistoricos,
  filtrarCandidatosCompativeis,
  historicoCombinaComPromocao,
  montarDiagnosticoMilitaresPromocao,
  montarMilitarPorId,
  motivosBloqueioVinculoProvavel,
  nomeMilitar,
  podeVincularProvavelAdministrativamente,
  ordenarHistoricosVinculados,
  texto,
  tituloPromocao,
  valorOuTraco,
} from '@/services/promocaoService';

const CONFIRMACAO_VINCULAR = 'VINCULAR PROMOÇÃO';
const CONFIRMACAO_VINCULAR_PROVAVEIS = 'VINCULAR PROVÁVEIS';
const CONFIRMACAO_DESVINCULAR = 'DESVINCULAR PROMOÇÃO';

async function carregarPromocaoPorId(promocaoId) {
  if (!promocaoId) return null;

  if (typeof base44.entities.Promocao.get === 'function') {
    try {
      const promocao = await base44.entities.Promocao.get(promocaoId);
      if (promocao) return promocao;
    } catch (error) {
      console.warn('[DetalhePromocao] Promocao.get indisponível, usando filter/list como fallback.', error);
    }
  }

  if (typeof base44.entities.Promocao.filter === 'function') {
    const encontrados = await base44.entities.Promocao.filter({ id: promocaoId });
    if (encontrados?.[0]) return encontrados[0];
  }

  const promocoes = await base44.entities.Promocao.list();
  return promocoes.find((promocao) => String(promocao.id) === String(promocaoId)) || null;
}

function Campo({ label, children }) {
  return (
    <div className="rounded-lg border bg-white p-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-900 break-words">{children}</p>
    </div>
  );
}

function ResumoItem({ label, total, tone = 'default' }) {
  const toneClass = tone === 'warning' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-slate-200 bg-white text-slate-900';
  return (
    <div className={`rounded-lg border p-4 ${toneClass}`}>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold">{total}</p>
    </div>
  );
}

function MotivosBadges({ motivos = [] }) {
  if (!motivos.length) return <span className="text-slate-500">Sem motivo adicional</span>;
  return motivos.map((motivo) => (
    <Badge key={motivo} variant="outline" className="mr-1 border-amber-300 text-amber-700">{motivo}</Badge>
  ));
}

function DiagnosticoItem({ titulo, total, children, tone = 'default' }) {
  const toneClass = tone === 'warning' ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white';
  return (
    <div className={`rounded-lg border p-4 ${toneClass}`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-slate-900">{titulo}</h3>
        <Badge variant={total > 0 ? 'destructive' : 'outline'}>{total}</Badge>
      </div>
      <div className="mt-2 text-sm text-slate-600">{children}</div>
    </div>
  );
}

function statusPromocaoMilitarClass(status) {
  const classes = {
    elegivel: 'border-sky-300 bg-sky-50 text-sky-700',
    selecionado: 'border-indigo-300 bg-indigo-50 text-indigo-700',
    bloqueado: 'border-amber-300 bg-amber-50 text-amber-700',
    publicado: 'border-emerald-300 bg-emerald-50 text-emerald-700',
    retificado: 'border-purple-300 bg-purple-50 text-purple-700',
    cancelado: 'border-rose-300 bg-rose-50 text-rose-700',
  };
  return classes[String(status || '').toLowerCase()] || 'border-slate-300 bg-slate-50 text-slate-700';
}

function BooleanBadge({ ativo }) {
  return ativo
    ? <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700">Sim</Badge>
    : <Badge variant="outline" className="border-slate-300 bg-slate-50 text-slate-600">Não</Badge>;
}

export default function DetalhePromocao() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const promocaoId = searchParams.get('id');
  const [selecionados, setSelecionados] = useState([]);
  const [provaveisSelecionados, setProvaveisSelecionados] = useState([]);
  const [dialogoVincularProvaveisAberto, setDialogoVincularProvaveisAberto] = useState(false);
  const [confirmacaoVincularProvaveis, setConfirmacaoVincularProvaveis] = useState('');
  const [dialogoVincularAberto, setDialogoVincularAberto] = useState(false);
  const [confirmacaoVincular, setConfirmacaoVincular] = useState('');
  const [historicoParaDesvincular, setHistoricoParaDesvincular] = useState(null);
  const [confirmacaoDesvincular, setConfirmacaoDesvincular] = useState('');

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
        console.warn('[DetalhePromocao] PromocaoMilitar indisponível, mantendo fallback legado.', error);
        return [];
      }
    },
  });

  const militaresQuery = useQuery({
    queryKey: ['detalhe-promocao-militares'],
    queryFn: () => base44.entities.Militar.list(),
  });

  const militarPorId = useMemo(() => montarMilitarPorId(militaresQuery.data || []), [militaresQuery.data]);
  const promocao = promocaoQuery.data;

  const historicosCompativeis = useMemo(() => {
    if (!promocao) return [];
    return (historicosQuery.data || []).filter((historico) => historicoCombinaComPromocao(historico, promocao));
  }, [historicosQuery.data, promocao]);

  const vinculados = useMemo(() => {
    if (!promocao) return [];
    const itens = (historicosQuery.data || []).filter((historico) => String(historico?.promocao_id || '') === String(promocao.id));
    return ordenarHistoricosVinculados(enriquecerHistoricos(itens, militarPorId));
  }, [historicosQuery.data, militarPorId, promocao]);

  const turmaOperacional = useMemo(() => {
    if (!promocao) return [];
    return (promocaoMilitarQuery.data || [])
      .filter((registro) => String(registro?.promocao_id || '') === String(promocao.id))
      .map((registro) => ({
        ...registro,
        militar: militarPorId.get(String(registro?.militar_id || '')) || null,
      }))
      .sort((a, b) => (Number(a?.ordem || 0) - Number(b?.ordem || 0)) || nomeMilitar(a.militar).localeCompare(nomeMilitar(b.militar)));
  }, [militarPorId, promocao, promocaoMilitarQuery.data]);

  const turmaOperacionalExibida = useMemo(() => {
    if (turmaOperacional.length > 0) return turmaOperacional;
    return vinculados.map((historico) => ({
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
    }));
  }, [promocao, turmaOperacional, vinculados]);

  const turmaOperacionalFonte = turmaOperacional.length > 0 ? 'PromocaoMilitar' : 'HistoricoPromocaoMilitarV2.promocao_id';

  const candidatos = useMemo(() => {
    if (!promocao) return [];
    return ordenarHistoricosVinculados(enriquecerHistoricos(
      filtrarCandidatosCompativeis({ promocao, historicos: historicosQuery.data || [] }),
      militarPorId,
    ));
  }, [historicosQuery.data, militarPorId, promocao]);

  const candidatosProvaveis = useMemo(() => {
    if (!promocao) return [];
    return ordenarHistoricosVinculados(enriquecerHistoricos(
      buscarCandidatosProvaveis({ promocao, historicos: historicosQuery.data || [] }).map((historico) => {
        const bloqueiosVinculoProvavel = motivosBloqueioVinculoProvavel(historico, promocao);
        return {
          ...historico,
          bloqueiosVinculoProvavel,
          vinculoProvavelPermitido: podeVincularProvavelAdministrativamente(historico, promocao),
        };
      }),
      militarPorId,
    ));
  }, [historicosQuery.data, militarPorId, promocao]);

  const diagnosticoMilitares = useMemo(() => {
    if (!promocao) return [];
    return montarDiagnosticoMilitaresPromocao({
      promocao,
      historicos: historicosQuery.data || [],
      militares: militaresQuery.data || [],
    }).map((linha) => ({
      ...linha,
      militar: militarPorId.get(String(linha.militar_id || '')) || null,
    }));
  }, [historicosQuery.data, militarPorId, militaresQuery.data, promocao]);

  const resumoVinculo = useMemo(() => {
    const idsVinculados = new Set(vinculados.map((historico) => String(historico.id)));
    const idsCandidatos = new Set(candidatos.map((historico) => String(historico.id)));
    const idsProvaveis = new Set(candidatosProvaveis.map((historico) => String(historico.id)));
    return {
      vinculados: vinculados.length,
      compativeisEncontrados: candidatos.length,
      compativeisBloqueados: diagnosticoMilitares.filter((linha) => (
        linha.historico_id
        && !idsVinculados.has(String(linha.historico_id))
        && !idsCandidatos.has(String(linha.historico_id))
        && (idsProvaveis.has(String(linha.historico_id)) || ['Conflito', 'Revisar'].includes(linha.acaoSugerida))
      )).length,
      semHistorico: diagnosticoMilitares.filter((linha) => linha.motivo === 'Sem histórico V2').length,
    };
  }, [candidatos, candidatosProvaveis, diagnosticoMilitares, vinculados]);

  const diagnostico = useMemo(() => {
    if (!promocao) return null;
    return diagnosticarPromocao({ promocao, historicosCompativeis });
  }, [historicosCompativeis, promocao]);

  const vincularMutation = useMutation({
    mutationFn: async (historicoIds) => {
      await Promise.all(historicoIds.map((historicoId) => (
        base44.entities.HistoricoPromocaoMilitarV2.update(historicoId, { promocao_id: promocao.id })
      )));
    },
    onSuccess: () => {
      toast({ title: 'Históricos vinculados', description: 'Somente o campo promocao_id foi preenchido nos históricos selecionados.' });
      setSelecionados([]);
      setConfirmacaoVincular('');
      setDialogoVincularAberto(false);
      queryClient.invalidateQueries({ queryKey: ['detalhe-promocao-historicos-v2'] });
      queryClient.invalidateQueries({ queryKey: ['promocoes-operacionais-historicos-v2'] });
    },
    onError: (error) => toast({ title: 'Falha ao vincular', description: error.message, variant: 'destructive' }),
  });

  const vincularProvaveisMutation = useMutation({
    mutationFn: async (historicoIds) => {
      const historicosPorId = new Map((historicosQuery.data || []).map((historico) => [String(historico?.id), historico]));
      const bloqueados = historicoIds
        .map((historicoId) => historicosPorId.get(String(historicoId)))
        .filter((historico) => !historico || !podeVincularProvavelAdministrativamente(historico, promocao));

      if (bloqueados.length > 0) {
        throw new Error('Há candidatos prováveis bloqueados. Revise núcleo mínimo, status, vínculo existente e militar_id antes de vincular.');
      }

      await Promise.all(historicoIds.map((historicoId) => (
        base44.entities.HistoricoPromocaoMilitarV2.update(historicoId, { promocao_id: promocao.id })
      )));
    },
    onSuccess: () => {
      toast({ title: 'Prováveis vinculados', description: 'Vínculo administrativo concluído. Somente o campo promocao_id foi preenchido nos históricos selecionados.' });
      setProvaveisSelecionados([]);
      setConfirmacaoVincularProvaveis('');
      setDialogoVincularProvaveisAberto(false);
      queryClient.invalidateQueries({ queryKey: ['detalhe-promocao-historicos-v2'] });
      queryClient.invalidateQueries({ queryKey: ['promocoes-operacionais-historicos-v2'] });
    },
    onError: (error) => toast({ title: 'Falha ao vincular prováveis', description: error.message, variant: 'destructive' }),
  });

  const desvincularMutation = useMutation({
    mutationFn: async (historicoId) => {
      await base44.entities.HistoricoPromocaoMilitarV2.update(historicoId, { promocao_id: '' });
    },
    onSuccess: () => {
      toast({ title: 'Histórico desvinculado', description: 'Somente o campo promocao_id foi limpo. O histórico e o Militar foram preservados.' });
      setHistoricoParaDesvincular(null);
      setConfirmacaoDesvincular('');
      queryClient.invalidateQueries({ queryKey: ['detalhe-promocao-historicos-v2'] });
      queryClient.invalidateQueries({ queryKey: ['promocoes-operacionais-historicos-v2'] });
    },
    onError: (error) => toast({ title: 'Falha ao desvincular', description: error.message, variant: 'destructive' }),
  });

  const materializarTurmaMutation = useMutation({
    mutationFn: async () => {
      if (!promocao) throw new Error('Promoção não carregada.');
      if (turmaOperacional.length > 0) throw new Error('Esta promoção já possui registros PromocaoMilitar.');
      if (!base44.entities.PromocaoMilitar || typeof base44.entities.PromocaoMilitar.create !== 'function') {
        throw new Error('Entidade PromocaoMilitar indisponível no runtime.');
      }

      const historicosVinculados = (historicosQuery.data || [])
        .filter((historico) => String(historico?.promocao_id || '') === String(promocao.id));

      await Promise.all(historicosVinculados.map((historico) => base44.entities.PromocaoMilitar.create({
        promocao_id: promocao.id,
        militar_id: historico.militar_id || '',
        historico_promocao_v2_id: historico.id || '',
        ordem: Number(historico.antiguidade_referencia_ordem || 0),
        status: 'publicado',
        selecionado: true,
        publicado: true,
        origem: 'backfill_historico_v2',
      })));
    },
    onSuccess: () => {
      toast({ title: 'Turma materializada', description: 'Registros PromocaoMilitar criados sem alterar Histórico V2, Militar, Antiguidade, Prévia Geral ou snapshots.' });
      queryClient.invalidateQueries({ queryKey: ['detalhe-promocao-promocao-militar'] });
    },
    onError: (error) => toast({ title: 'Falha ao materializar turma', description: error.message, variant: 'destructive' }),
  });

  const isLoading = promocaoQuery.isLoading || historicosQuery.isLoading || promocaoMilitarQuery.isLoading || militaresQuery.isLoading;
  const error = promocaoQuery.error || historicosQuery.error || promocaoMilitarQuery.error || militaresQuery.error;

  const alternarSelecionado = (historicoId, checked) => {
    setSelecionados((atuais) => (checked
      ? [...new Set([...atuais, historicoId])]
      : atuais.filter((id) => id !== historicoId)));
  };

  const alternarProvavelSelecionado = (historicoId, checked) => {
    setProvaveisSelecionados((atuais) => (checked
      ? [...new Set([...atuais, historicoId])]
      : atuais.filter((id) => id !== historicoId)));
  };

  return (
    <div className="p-4 md:p-8 space-y-6 bg-slate-50 min-h-screen">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <Button variant="ghost" className="mb-2 -ml-3" onClick={() => navigate(createPageUrl('Promocoes'))}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar para Promoções
          </Button>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Gestão da promoção</p>
          <h1 className="text-3xl font-bold text-slate-900">{promocao ? tituloPromocao(promocao) : 'Detalhe da promoção'}</h1>
          <p className="text-slate-600 mt-1">Vincule ou desvincule históricos existentes sem alterar Militar, Prévia Geral ou regras de antiguidade.</p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            promocaoQuery.refetch();
            historicosQuery.refetch();
            promocaoMilitarQuery.refetch();
            militaresQuery.refetch();
          }}
          disabled={isLoading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {!promocaoId && (
        <Alert variant="destructive">
          <AlertTitle>Promoção não informada</AlertTitle>
          <AlertDescription>Acesse esta tela pelo botão Abrir na listagem de promoções.</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Falha ao carregar detalhe</AlertTitle>
          <AlertDescription>{error.message || 'Não foi possível carregar promoção, históricos ou militares.'}</AlertDescription>
        </Alert>
      )}

      {!isLoading && promocaoId && !promocao && (
        <Alert variant="destructive">
          <AlertTitle>Promoção não encontrada</AlertTitle>
          <AlertDescription>Nenhuma Promocao foi localizada para o id {promocaoId}.</AlertDescription>
        </Alert>
      )}

      {promocao && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>1. Dados da promoção</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <Campo label="Posto/graduação">{valorOuTraco(promocao.posto_graduacao)}</Campo>
              <Campo label="Quadro">{valorOuTraco(promocao.quadro)}</Campo>
              <Campo label="Data promoção">{dataFormatada(promocao.data_promocao)}</Campo>
              <Campo label="Data publicação">{dataFormatada(promocao.data_publicacao)}</Campo>
              <Campo label="Boletim referência">{valorOuTraco(promocao.boletim_referencia)}</Campo>
              <Campo label="Ato referência">{valorOuTraco(promocao.ato_referencia)}</Campo>
              <Campo label="Tipo">{valorOuTraco(promocao.tipo)}</Campo>
              <Campo label="Status">{valorOuTraco(promocao.status)}</Campo>
              <Campo label="Origem">{valorOuTraco(promocao.origem)}</Campo>
              <Campo label="Chave agrupamento">{valorOuTraco(promocao.chave_agrupamento)}</Campo>
              <Campo label="Hash agrupamento">{valorOuTraco(promocao.hash_agrupamento)}</Campo>
              <Campo label="Total real vinculado">{vinculados.length}</Campo>
              <div className="md:col-span-3">
                <Campo label="Observações">{valorOuTraco(promocao.observacoes)}</Campo>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>2. Resumo do vínculo</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-4">
              <ResumoItem label="Históricos vinculados" total={resumoVinculo.vinculados} />
              <ResumoItem label="Compatíveis encontrados" total={resumoVinculo.compativeisEncontrados} />
              <ResumoItem label="Compatíveis bloqueados" total={resumoVinculo.compativeisBloqueados} tone={resumoVinculo.compativeisBloqueados > 0 ? 'warning' : 'default'} />
              <ResumoItem label="Sem histórico" total={resumoVinculo.semHistorico} tone={resumoVinculo.semHistorico > 0 ? 'warning' : 'default'} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Turma operacional</CardTitle>
                <p className="text-sm text-slate-500 mt-1">
                  Leitura dual: usa PromocaoMilitar quando houver registros e mantém fallback legado por HistoricoPromocaoMilitarV2.promocao_id.
                  Fonte atual: {turmaOperacionalFonte}.
                </p>
              </div>
              <Button
                variant="outline"
                disabled={turmaOperacional.length > 0 || vinculados.length === 0 || materializarTurmaMutation.isPending}
                onClick={() => materializarTurmaMutation.mutate()}
              >
                <Link2 className="w-4 h-4 mr-2" />
                Materializar turma
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ordem</TableHead>
                      <TableHead>Militar</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Selecionado</TableHead>
                      <TableHead>Publicado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {turmaOperacionalExibida.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-slate-500">Nenhuma turma operacional ou vínculo legado localizado.</TableCell>
                      </TableRow>
                    )}
                    {turmaOperacionalExibida.map((registro) => (
                      <TableRow key={registro.id || `${registro.militar_id}-${registro.historico_promocao_v2_id}`}>
                        <TableCell>{registro.ordem || '—'}</TableCell>
                        <TableCell className="font-medium">{nomeMilitar(registro.militar)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusPromocaoMilitarClass(registro.status)}>{valorOuTraco(registro.status)}</Badge>
                        </TableCell>
                        <TableCell><BooleanBadge ativo={Boolean(registro.selecionado)} /></TableCell>
                        <TableCell><BooleanBadge ativo={Boolean(registro.publicado)} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {vinculados.length === 0 && (
            <Alert>
              <AlertTitle>Não existem históricos vinculados a esta promoção ainda.</AlertTitle>
              <AlertDescription>Verifique candidatos compatíveis ou realize saneamento.</AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle>3. Militares vinculados</CardTitle>
              <Badge variant="outline">{vinculados.length} histórico(s)</Badge>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ordem</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Matrícula</TableHead>
                      <TableHead>Posto atual</TableHead>
                      <TableHead>Quadro atual</TableHead>
                      <TableHead>Lotação</TableHead>
                      <TableHead>Status registro</TableHead>
                      <TableHead>Data promoção</TableHead>
                      <TableHead>Boletim</TableHead>
                      <TableHead>Ato</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vinculados.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={11} className="py-8 text-center text-slate-500">Nenhum histórico vinculado a esta promoção.</TableCell>
                      </TableRow>
                    )}
                    {vinculados.map((historico) => (
                      <TableRow key={historico.id}>
                        <TableCell>{historico.antiguidade_referencia_ordem ?? '—'}</TableCell>
                        <TableCell className="font-medium">{nomeMilitar(historico.militar)}</TableCell>
                        <TableCell>{valorOuTraco(historico.militar?.matricula)}</TableCell>
                        <TableCell>{valorOuTraco(historico.militar?.posto_graduacao)}</TableCell>
                        <TableCell>{valorOuTraco(historico.militar?.quadro)}</TableCell>
                        <TableCell>{valorOuTraco(historico.militar?.lotacao)}</TableCell>
                        <TableCell><Badge variant="secondary">{valorOuTraco(historico.status_registro)}</Badge></TableCell>
                        <TableCell>{dataFormatada(historico.data_promocao)}</TableCell>
                        <TableCell>{valorOuTraco(historico.boletim_referencia)}</TableCell>
                        <TableCell>{valorOuTraco(historico.ato_referencia)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <Button asChild size="sm" variant="ghost">
                            <Link to={`${createPageUrl('VerMilitar')}?id=${historico.militar_id}`}>
                              <ExternalLink className="w-4 h-4 mr-1" />
                              Abrir ficha
                            </Link>
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setHistoricoParaDesvincular(historico)}>
                            <Unlink className="w-4 h-4 mr-1" />
                            Desvincular
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>4. Candidatos compatíveis não vinculados</CardTitle>
                <p className="text-sm text-slate-500 mt-1">Históricos existentes que batem com posto, quadro, datas, boletim, ato e status operacional compatível.</p>
              </div>
              <Button disabled={selecionados.length === 0 || vincularMutation.isPending} onClick={() => setDialogoVincularAberto(true)}>
                <Link2 className="w-4 h-4 mr-2" />
                Vincular selecionados ({selecionados.length})
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Sel.</TableHead>
                      <TableHead>Militar</TableHead>
                      <TableHead>Matrícula</TableHead>
                      <TableHead>Ordem</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Alertas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {candidatos.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center text-slate-500">Nenhum candidato compatível sem promocao_id.</TableCell>
                      </TableRow>
                    )}
                    {candidatos.map((historico) => {
                      const alertas = alertasCandidato(historico, promocao);
                      return (
                        <TableRow key={historico.id}>
                          <TableCell>
                            <Checkbox
                              checked={selecionados.includes(historico.id)}
                              onCheckedChange={(checked) => alternarSelecionado(historico.id, Boolean(checked))}
                              aria-label={`Selecionar ${nomeMilitar(historico.militar)}`}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{nomeMilitar(historico.militar)}</TableCell>
                          <TableCell>{valorOuTraco(historico.militar?.matricula)}</TableCell>
                          <TableCell>{historico.antiguidade_referencia_ordem ?? '—'}</TableCell>
                          <TableCell><Badge variant="secondary">{valorOuTraco(historico.status_registro)}</Badge></TableCell>
                          <TableCell>
                            {alertas.length === 0 ? <span className="text-slate-500">Sem alertas</span> : alertas.map((alerta) => (
                              <Badge key={alerta} variant="outline" className="mr-1 border-amber-300 text-amber-700">{alerta}</Badge>
                            ))}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {candidatosProvaveis.length > 0 && (
            <Card className="border-amber-200">
              <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <CardTitle>Candidatos prováveis — revisão manual</CardTitle>
                  <p className="text-sm text-slate-500 mt-1">Busca relaxada mantendo o núcleo mínimo de posto, quadro e data de promoção. Prováveis continuam separados dos compatíveis fortes e nunca são vinculados automaticamente.</p>
                </div>
                <Button
                  variant="outline"
                  disabled={provaveisSelecionados.length === 0 || vincularProvaveisMutation.isPending}
                  onClick={() => setDialogoVincularProvaveisAberto(true)}
                >
                  <Link2 className="w-4 h-4 mr-2" />
                  Vincular prováveis selecionados ({provaveisSelecionados.length})
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertTitle>Vínculo administrativo com dados históricos preservados</AlertTitle>
                  <AlertDescription>
                    Estes registros possuem divergências ou dados incompletos. O vínculo será administrativo e não corrigirá os dados do histórico.
                  </AlertDescription>
                </Alert>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">Sel.</TableHead>
                        <TableHead>Militar</TableHead>
                        <TableHead>Matrícula</TableHead>
                        <TableHead>Ordem</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Motivos</TableHead>
                        <TableHead>Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {candidatosProvaveis.map((historico) => {
                        const bloqueios = historico.bloqueiosVinculoProvavel || [];
                        return (
                          <TableRow key={historico.id}>
                            <TableCell>
                              <Checkbox
                                checked={provaveisSelecionados.includes(historico.id)}
                                disabled={!historico.vinculoProvavelPermitido}
                                onCheckedChange={(checked) => alternarProvavelSelecionado(historico.id, Boolean(checked))}
                                aria-label={`Selecionar provável ${nomeMilitar(historico.militar)}`}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{nomeMilitar(historico.militar)}</TableCell>
                            <TableCell>{valorOuTraco(historico.militar?.matricula)}</TableCell>
                            <TableCell>{historico.antiguidade_referencia_ordem ?? '—'}</TableCell>
                            <TableCell><Badge variant="secondary">{valorOuTraco(historico.status_registro)}</Badge></TableCell>
                            <TableCell><MotivosBadges motivos={historico.diagnosticoCompatibilidade?.motivos || []} /></TableCell>
                            <TableCell>
                              {historico.vinculoProvavelPermitido
                                ? <Badge variant="outline" className="border-emerald-300 text-emerald-700">Vinculável com confirmação</Badge>
                                : <MotivosBadges motivos={bloqueios.length ? bloqueios : ['bloqueado']} />}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>5. Diagnóstico por militar</CardTitle>
              <p className="text-sm text-slate-500 mt-1">Indica por que um militar ou histórico apareceu como vinculado, compatível, provável, conflito ou sem histórico V2.</p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Militar</TableHead>
                      <TableHead>Situação</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Ação sugerida</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {diagnosticoMilitares.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="py-8 text-center text-slate-500">Nenhum militar ou histórico V2 relacionado por posto, quadro e data.</TableCell>
                      </TableRow>
                    )}
                    {diagnosticoMilitares.slice(0, 80).map((linha) => (
                      <TableRow key={linha.chave}>
                        <TableCell className="font-medium">{nomeMilitar(linha.militar)}</TableCell>
                        <TableCell><Badge variant="secondary">{linha.situacao}</Badge></TableCell>
                        <TableCell>{linha.motivo}</TableCell>
                        <TableCell>{linha.acaoSugerida}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {diagnosticoMilitares.length > 80 && <p className="mt-2 text-xs text-slate-500">Exibindo 80 de {diagnosticoMilitares.length} linhas de diagnóstico.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>6. Conflitos / faltantes</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <DiagnosticoItem titulo="Compatíveis já vinculados a outra Promoção" total={diagnostico?.compativeisOutraPromocao.length || 0}>
                {diagnostico?.compativeisOutraPromocao.length
                  ? diagnostico.compativeisOutraPromocao.slice(0, 5).map((historico) => (
                    <div key={historico.id}>Histórico {historico.id} → {historico.promocao_id}</div>
                  ))
                  : 'Nenhum conflito desse tipo.'}
              </DiagnosticoItem>
              <DiagnosticoItem titulo="Duplicidade de militar no agrupamento" total={diagnostico?.duplicidadesMilitar.length || 0}>
                {diagnostico?.duplicidadesMilitar.length
                  ? diagnostico.duplicidadesMilitar.slice(0, 5).map(([militarId, total]) => (
                    <div key={militarId}>Militar {militarId}: {total} registros</div>
                  ))
                  : 'Nenhuma duplicidade detectada.'}
              </DiagnosticoItem>
              <DiagnosticoItem titulo="Registros compatíveis sem ordem" total={diagnostico?.semOrdem.length || 0}>
                {diagnostico?.semOrdem.length
                  ? diagnostico.semOrdem.slice(0, 5).map((historico) => (
                    <div key={historico.id}>Histórico {historico.id} • Militar {historico.militar_id || '—'}</div>
                  ))
                  : 'Nenhum registro compatível sem ordem.'}
              </DiagnosticoItem>
              <DiagnosticoItem titulo="Cancelados/retificados ignorados" total={diagnostico?.canceladosRetificados.length || 0}>
                {diagnostico?.canceladosRetificados.length
                  ? diagnostico.canceladosRetificados.slice(0, 5).map((historico) => (
                    <div key={historico.id}>Histórico {historico.id} • {historico.status_registro}</div>
                  ))
                  : 'Nenhum cancelado/retificado no agrupamento.'}
              </DiagnosticoItem>
              <DiagnosticoItem titulo="Chave divergente" total={diagnostico?.chaveDivergente ? 1 : 0} tone={diagnostico?.chaveDivergente ? 'warning' : 'default'}>
                {diagnostico?.chaveDivergente
                  ? <span>Chave salva difere da chave calculada atual: {diagnostico.chaveCalculada}</span>
                  : 'Chave salva compatível ou ausente.'}
              </DiagnosticoItem>
            </CardContent>
          </Card>
        </>
      )}


      <Dialog open={dialogoVincularProvaveisAberto} onOpenChange={setDialogoVincularProvaveisAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar vínculo administrativo de candidatos prováveis</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Alert>
              <AlertTitle>Vínculo administrativo sem saneamento automático</AlertTitle>
              <AlertDescription>
                Estes registros possuem divergências ou dados incompletos. O vínculo será administrativo e não corrigirá os dados do histórico.
                Esta operação preencherá apenas HistoricoPromocaoMilitarV2.promocao_id em {provaveisSelecionados.length} histórico(s).
                Não altera data de promoção, data de publicação, boletim, ato, posto, quadro, ordem, Militar ou Prévia Geral.
              </AlertDescription>
            </Alert>
            <div>
              <Label>Digite {CONFIRMACAO_VINCULAR_PROVAVEIS} para confirmar</Label>
              <Input value={confirmacaoVincularProvaveis} onChange={(event) => setConfirmacaoVincularProvaveis(event.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogoVincularProvaveisAberto(false)}>Cancelar</Button>
            <Button
              disabled={confirmacaoVincularProvaveis !== CONFIRMACAO_VINCULAR_PROVAVEIS || provaveisSelecionados.length === 0 || vincularProvaveisMutation.isPending}
              onClick={() => vincularProvaveisMutation.mutate(provaveisSelecionados)}
            >
              Confirmar vínculo administrativo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogoVincularAberto} onOpenChange={setDialogoVincularAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar vínculo de históricos existentes</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Alert>
              <AlertTitle>Ação restrita ao campo promocao_id</AlertTitle>
              <AlertDescription>
                Esta operação preencherá apenas HistoricoPromocaoMilitarV2.promocao_id em {selecionados.length} histórico(s).
                Não altera data, posto, quadro, ordem, Militar ou Prévia Geral.
              </AlertDescription>
            </Alert>
            <div>
              <Label>Digite {CONFIRMACAO_VINCULAR} para confirmar</Label>
              <Input value={confirmacaoVincular} onChange={(event) => setConfirmacaoVincular(event.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogoVincularAberto(false)}>Cancelar</Button>
            <Button
              disabled={confirmacaoVincular !== CONFIRMACAO_VINCULAR || selecionados.length === 0 || vincularMutation.isPending}
              onClick={() => vincularMutation.mutate(selecionados)}
            >
              Confirmar vínculo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(historicoParaDesvincular)} onOpenChange={(open) => !open && setHistoricoParaDesvincular(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar desvinculação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Alert>
              <AlertTitle>Histórico preservado</AlertTitle>
              <AlertDescription>
                Esta operação limpará apenas HistoricoPromocaoMilitarV2.promocao_id do histórico {texto(historicoParaDesvincular?.id) || 'selecionado'}.
                Não cancela, exclui, retifica ou altera Militar.
              </AlertDescription>
            </Alert>
            <div>
              <Label>Digite {CONFIRMACAO_DESVINCULAR} para confirmar</Label>
              <Input value={confirmacaoDesvincular} onChange={(event) => setConfirmacaoDesvincular(event.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoricoParaDesvincular(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={confirmacaoDesvincular !== CONFIRMACAO_DESVINCULAR || desvincularMutation.isPending}
              onClick={() => desvincularMutation.mutate(historicoParaDesvincular.id)}
            >
              Confirmar desvinculação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
