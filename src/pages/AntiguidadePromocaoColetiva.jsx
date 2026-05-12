import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, FilePlus2, Info, ListOrdered, ShieldAlert } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { queryClientInstance } from '@/lib/query-client';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import PromocaoColetivaForm from '@/components/antiguidade/PromocaoColetivaForm';
import PromocaoColetivaItensTable from '@/components/antiguidade/PromocaoColetivaItensTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  buildPromocaoColetivaConferenciaIssues,
  buildPromocaoColetivaHashConferencia,
  OBSERVACAO_RECLASSIFICACAO_PROMOCAO_COLETIVA,
  PROMOCAO_COLETIVA_RULES_VERSION,
  RECLASSIFICADORAS_INICIAIS_PROMOCAO_COLETIVA,
  STATUS_ITEM_PROMOCAO_COLETIVA,
  STATUS_PROMOCAO_COLETIVA,
} from '@/utils/antiguidade/promocaoColetivaRules';

const DEFAULT_ATO = {
  numero_controle: '',
  titulo: '',
  data_promocao: '',
  data_publicacao: '',
  boletim_referencia: '',
  ato_referencia: '',
  posto_graduacao_destino: '',
  quadro_destino: '',
  tipo_promocao: 'antiguidade',
  modo_reclassificacao: 'preserva_antiguidade_anterior',
  status: STATUS_PROMOCAO_COLETIVA.RASCUNHO,
  observacoes: '',
  total_itens: 0,
  total_aplicados: 0,
  total_falhas: 0,
  versao_regra_calculo: PROMOCAO_COLETIVA_RULES_VERSION,
};

const invalidatePromocaoColetiva = () => Promise.all([
  queryClientInstance.invalidateQueries({ queryKey: ['antiguidade-promocoes-coletivas'] }),
  queryClientInstance.invalidateQueries({ queryKey: ['antiguidade-promocao-coletiva-itens'] }),
]);

function normalizeNumber(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildItemPayload(item) {
  return {
    criterio_individual: item.criterio_individual || 'antiguidade',
    ordem_boletim: normalizeNumber(item.ordem_boletim),
    ordem_informada_curso: normalizeNumber(item.ordem_informada_curso),
    nota_curso: normalizeNumber(item.nota_curso),
    posicao_final: normalizeNumber(item.posicao_final),
    ajuste_manual: item.ajuste_manual === true,
    motivo_ajuste: item.motivo_ajuste || '',
    observacoes: item.observacoes || '',
    status_item: item.status_item || STATUS_ITEM_PROMOCAO_COLETIVA.RASCUNHO,
  };
}

function buildAtoPayload(ato, userEmail, totalItens) {
  return {
    numero_controle: ato.numero_controle || '',
    titulo: ato.titulo || '',
    data_promocao: ato.data_promocao || '',
    data_publicacao: ato.data_publicacao || '',
    boletim_referencia: ato.boletim_referencia || '',
    ato_referencia: ato.ato_referencia || '',
    posto_graduacao_destino: ato.posto_graduacao_destino || '',
    quadro_destino: ato.quadro_destino || '',
    tipo_promocao: ato.tipo_promocao || 'antiguidade',
    modo_reclassificacao: ato.modo_reclassificacao || 'preserva_antiguidade_anterior',
    status: ato.status || STATUS_PROMOCAO_COLETIVA.RASCUNHO,
    observacoes: ato.observacoes || '',
    criado_por: ato.criado_por || userEmail || '',
    total_itens: totalItens,
    total_aplicados: 0,
    total_falhas: 0,
    versao_regra_calculo: PROMOCAO_COLETIVA_RULES_VERSION,
  };
}

export default function AntiguidadePromocaoColetiva() {
  const { userEmail } = useCurrentUser();
  const [atoSelecionadoId, setAtoSelecionadoId] = React.useState('');
  const [atoDraft, setAtoDraft] = React.useState(DEFAULT_ATO);
  const [itensDraft, setItensDraft] = React.useState([]);
  const [buscaMilitar, setBuscaMilitar] = React.useState('');
  const [feedback, setFeedback] = React.useState('');
  const [erro, setErro] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const promocoesQuery = useQuery({
    queryKey: ['antiguidade-promocoes-coletivas'],
    queryFn: () => base44.entities.PromocaoColetiva.list('-created_date', 200),
  });

  const itensQuery = useQuery({
    queryKey: ['antiguidade-promocao-coletiva-itens', atoSelecionadoId],
    enabled: Boolean(atoSelecionadoId),
    queryFn: () => base44.entities.PromocaoColetivaItem.filter({ promocao_id: atoSelecionadoId }),
  });

  const militaresQuery = useQuery({
    queryKey: ['antiguidade-promocao-coletiva-militares'],
    queryFn: () => base44.entities.Militar.filter({ status_cadastro: 'Ativo' }),
  });

  const promocoes = promocoesQuery.data || [];
  const atoSelecionado = promocoes.find((ato) => ato.id === atoSelecionadoId) || null;
  const readOnly = atoDraft.status !== STATUS_PROMOCAO_COLETIVA.RASCUNHO;

  React.useEffect(() => {
    if (!atoSelecionado) return;
    setAtoDraft({ ...DEFAULT_ATO, ...atoSelecionado });
    setFeedback('');
    setErro('');
  }, [atoSelecionado]);

  React.useEffect(() => {
    setItensDraft(itensQuery.data || []);
  }, [itensQuery.data]);

  const militaresFiltrados = React.useMemo(() => {
    const termo = buscaMilitar.trim().toLowerCase();
    if (!termo) return (militaresQuery.data || []).slice(0, 25);
    return (militaresQuery.data || []).filter((militar) => [
      militar.matricula,
      militar.nome_guerra,
      militar.nome_completo,
      militar.posto_graduacao,
      militar.quadro,
      militar.lotacao,
    ].some((value) => String(value || '').toLowerCase().includes(termo))).slice(0, 25);
  }, [buscaMilitar, militaresQuery.data]);

  async function criarNovaPromocao() {
    setSaving(true);
    setErro('');
    setFeedback('');
    try {
      const nova = await base44.entities.PromocaoColetiva.create({
        ...DEFAULT_ATO,
        titulo: 'Novo ato de promoção coletiva',
        criado_por: userEmail || '',
      });
      await invalidatePromocaoColetiva();
      setAtoSelecionadoId(nova.id);
      setFeedback('Promoção coletiva criada em rascunho.');
    } catch (e) {
      setErro(e?.message || 'Falha ao criar promoção coletiva.');
    } finally {
      setSaving(false);
    }
  }

  async function persistirRascunhoAtual() {
    await base44.entities.PromocaoColetiva.update(
      atoSelecionadoId,
      buildAtoPayload(atoDraft, userEmail, itensDraft.length)
    );
    await Promise.all(itensDraft.map((item) => base44.entities.PromocaoColetivaItem.update(item.id, buildItemPayload(item))));
    await invalidatePromocaoColetiva();
  }

  async function salvarRascunho() {
    if (!atoSelecionadoId) return;
    setSaving(true);
    setErro('');
    setFeedback('');
    try {
      await persistirRascunhoAtual();
      setFeedback('Rascunho salvo. Nenhuma promoção foi aplicada.');
    } catch (e) {
      setErro(e?.message || 'Falha ao salvar rascunho.');
    } finally {
      setSaving(false);
    }
  }

  async function adicionarMilitar(militar) {
    if (!atoSelecionadoId || readOnly) return;
    setSaving(true);
    setErro('');
    setFeedback('');
    try {
      if (itensDraft.some((item) => item.militar_id === militar.id)) {
        throw new Error('Militar já vinculado a este ato.');
      }
      if (!atoDraft.posto_graduacao_destino || !atoDraft.quadro_destino) {
        throw new Error('Informe posto/graduação e quadro de destino no cabeçalho antes de adicionar militares.');
      }
      await base44.entities.PromocaoColetivaItem.create({
        promocao_id: atoSelecionadoId,
        militar_id: militar.id,
        matricula_snapshot: militar.matricula || '',
        nome_guerra_snapshot: militar.nome_guerra || '',
        nome_completo_snapshot: militar.nome_completo || '',
        posto_graduacao_anterior: militar.posto_graduacao || '',
        quadro_anterior: militar.quadro || '',
        grupo_quadro_anterior: militar.grupo_quadro || '',
        posto_graduacao_novo: atoDraft.posto_graduacao_destino || '',
        quadro_novo: atoDraft.quadro_destino || '',
        grupo_quadro_novo: '',
        criterio_individual: atoDraft.tipo_promocao === 'misto' ? 'antiguidade' : atoDraft.tipo_promocao || 'antiguidade',
        status_item: STATUS_ITEM_PROMOCAO_COLETIVA.RASCUNHO,
        ajuste_manual: false,
        historico_promocao_gerado_id: '',
      });
      await base44.entities.PromocaoColetiva.update(atoSelecionadoId, { total_itens: itensDraft.length + 1 });
      await invalidatePromocaoColetiva();
      setFeedback('Militar adicionado ao rascunho com snapshot básico.');
    } catch (e) {
      setErro(e?.message || 'Falha ao adicionar militar.');
    } finally {
      setSaving(false);
    }
  }

  async function removerItem(item) {
    if (readOnly) return;
    setSaving(true);
    setErro('');
    setFeedback('');
    try {
      await base44.entities.PromocaoColetivaItem.delete(item.id);
      await base44.entities.PromocaoColetiva.update(atoSelecionadoId, { total_itens: Math.max(0, itensDraft.length - 1) });
      await invalidatePromocaoColetiva();
      setFeedback('Item removido do rascunho.');
    } catch (e) {
      setErro(e?.message || 'Falha ao remover item.');
    } finally {
      setSaving(false);
    }
  }

  async function marcarComoConferida() {
    if (!atoSelecionadoId || readOnly) return;
    setSaving(true);
    setErro('');
    setFeedback('');
    try {
      await persistirRascunhoAtual();
      const issues = buildPromocaoColetivaConferenciaIssues(atoDraft, itensDraft);
      if (issues.length) {
        setErro(`Conferência bloqueada: ${issues.join(' ')}`);
        return;
      }
      const agora = new Date().toISOString();
      await base44.entities.PromocaoColetiva.update(atoSelecionadoId, {
        status: STATUS_PROMOCAO_COLETIVA.CONFERIDA,
        conferido_em: agora,
        conferido_por: userEmail || '',
        total_itens: itensDraft.length,
        total_aplicados: 0,
        total_falhas: 0,
        hash_conferencia: buildPromocaoColetivaHashConferencia(atoDraft, itensDraft),
      });
      await Promise.all(itensDraft.map((item) => base44.entities.PromocaoColetivaItem.update(item.id, { status_item: STATUS_ITEM_PROMOCAO_COLETIVA.CONFERIDO })));
      await invalidatePromocaoColetiva();
      setFeedback('Ato marcado como conferido. A promoção ainda não foi aplicada.');
    } catch (e) {
      setErro(e?.message || 'Falha ao marcar como conferida.');
    } finally {
      setSaving(false);
    }
  }

  async function cancelarAto() {
    if (!atoSelecionadoId) return;
    const motivo = window.prompt('Informe o motivo do cancelamento do ato:');
    if (!motivo?.trim()) return;
    setSaving(true);
    setErro('');
    setFeedback('');
    try {
      await base44.entities.PromocaoColetiva.update(atoSelecionadoId, {
        status: STATUS_PROMOCAO_COLETIVA.CANCELADA,
        cancelado_em: new Date().toISOString(),
        cancelado_por: userEmail || '',
        motivo_cancelamento: motivo.trim(),
      });
      await invalidatePromocaoColetiva();
      setFeedback('Ato cancelado. Nenhuma promoção foi aplicada.');
    } catch (e) {
      setErro(e?.message || 'Falha ao cancelar ato.');
    } finally {
      setSaving(false);
    }
  }

  const issuesConferencia = buildPromocaoColetivaConferenciaIssues(atoDraft, itensDraft);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1e3a5f] flex items-center gap-2"><ListOrdered className="w-6 h-6" /> Promoções Coletivas</h1>
          <p className="text-sm text-slate-600">Fluxo admin-only de rascunho e conferência de ato de promoção no módulo Antiguidade.</p>
        </div>
        <Button onClick={criarNovaPromocao} disabled={saving}><FilePlus2 className="w-4 h-4 mr-2" /> Nova promoção coletiva</Button>
      </div>

      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="pt-6 space-y-2 text-sm text-amber-900">
          <p className="font-semibold flex items-center gap-2"><ShieldAlert className="w-4 h-4" /> Rascunhos não aplicam promoção.</p>
          <p>A aplicação em HistoricoPromocaoMilitarV2 será feita em lote futuro.</p>
          <p>Este fluxo não é promoção futura/agendada; é rascunho/conferência de ato de promoção.</p>
        </CardContent>
      </Card>

      {feedback && <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800 flex gap-2"><CheckCircle2 className="w-4 h-4" /> {feedback}</div>}
      {erro && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 flex gap-2"><AlertTriangle className="w-4 h-4" /> {erro}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        <Card className="xl:col-span-1">
          <CardHeader><CardTitle>Atos cadastrados</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-[620px] overflow-auto">
            {promocoesQuery.isLoading && <p className="text-sm">Carregando...</p>}
            {promocoes.map((ato) => (
              <div key={ato.id} className={`w-full rounded-md border p-3 text-left text-sm ${atoSelecionadoId === ato.id ? 'border-blue-500 bg-blue-50' : 'hover:bg-slate-50'}`}>
                <button type="button" onClick={() => setAtoSelecionadoId(ato.id)} className="w-full text-left">
                  <div className="flex items-center justify-between gap-2">
                    <strong>{ato.titulo || ato.numero_controle || 'Ato sem título'}</strong>
                    <Badge variant={ato.status === 'rascunho' ? 'secondary' : 'outline'}>{ato.status || 'rascunho'}</Badge>
                  </div>
                  <div className="text-slate-600">{ato.data_promocao || 'Sem data'} — {ato.boletim_referencia || ato.ato_referencia || 'Sem referência'}</div>
                </button>
                {ato.status === STATUS_PROMOCAO_COLETIVA.RASCUNHO && (
                  <Button size="sm" variant="outline" className="mt-2" onClick={() => setAtoSelecionadoId(ato.id)}>Editar rascunho</Button>
                )}
              </div>
            ))}
            {!promocoesQuery.isLoading && promocoes.length === 0 && <p className="text-sm text-slate-600">Nenhuma promoção coletiva cadastrada.</p>}
          </CardContent>
        </Card>

        <div className="xl:col-span-3 space-y-4">
          {!atoSelecionadoId && <Card><CardContent className="pt-6 text-sm text-slate-600">Crie ou selecione uma promoção coletiva para editar o rascunho.</CardContent></Card>}

          {atoSelecionadoId && (
            <>
              <PromocaoColetivaForm
                ato={atoDraft}
                onChange={setAtoDraft}
                onSave={salvarRascunho}
                onConferir={marcarComoConferida}
                onCancelar={cancelarAto}
                readOnly={readOnly}
                saving={saving}
              />

              <Card>
                <CardHeader><CardTitle>Adicionar militar ao ato</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Buscar militar ativo</Label>
                      <Input value={buscaMilitar} onChange={(e) => setBuscaMilitar(e.target.value)} placeholder="Nome, nome de guerra, matrícula, posto, quadro..." disabled={readOnly} />
                    </div>
                    <div className="rounded-md border bg-slate-50 p-3 text-xs text-slate-700 flex gap-2">
                      <Info className="w-4 h-4 shrink-0" />
                      Ao adicionar, o sistema salva apenas snapshot básico do militar e o destino informado no cabeçalho do ato. Não atualiza Militar.
                    </div>
                  </div>
                  <div className="max-h-56 overflow-auto border rounded-md p-2 space-y-1">
                    {militaresFiltrados.map((militar) => (
                      <button key={militar.id} type="button" className="w-full text-left p-2 rounded hover:bg-slate-100 disabled:opacity-50" disabled={readOnly || saving} onClick={() => adicionarMilitar(militar)}>
                        <div className="text-sm font-medium">{militar.posto_graduacao || 'S/POSTO'} {militar.quadro || 'S/QUADRO'} {militar.nome_guerra || militar.nome_completo || 'Sem nome'}</div>
                        <div className="text-xs text-slate-600">{militar.nome_completo || '—'} — {militar.matricula || 'S/MAT'} — {militar.lotacao || 'S/LOTAÇÃO'}</div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Itens vinculados ao ato</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <PromocaoColetivaItensTable itens={itensDraft} readOnly={readOnly} onItemChange={(oldItem, newItem) => setItensDraft((items) => items.map((item) => item.id === oldItem.id ? newItem : item))} onRemove={removerItem} />
                  {issuesConferencia.length > 0 && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                      <strong>Pendências de conferência:</strong>
                      <ul className="list-disc pl-5 mt-1">
                        {issuesConferencia.map((issue) => <li key={issue}>{issue}</li>)}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Regras informativas D7.1</CardTitle></CardHeader>
                <CardContent className="text-sm text-slate-700 space-y-2">
                  <p>Reclassificadoras iniciais: {RECLASSIFICADORAS_INICIAIS_PROMOCAO_COLETIVA.join('; ')}.</p>
                  <p>{OBSERVACAO_RECLASSIFICACAO_PROMOCAO_COLETIVA}</p>
                  <p>Este lote apenas prepara campos e conferência; não usa antiguidade_referencia_ordem isolado como verdade definitiva entre turmas diferentes.</p>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
