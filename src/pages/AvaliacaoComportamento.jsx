import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, FileText, Scale, Wand2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import AccessDenied from '@/components/auth/AccessDenied';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import { PRACAS, calcularComportamento, calcularProximaMelhoria } from '@/utils/calcularComportamento';
import {
  criarPendenciaComportamentoSemDuplicidade,
  garantirImplantacaoHistoricoComportamento,
  getPunicaoEntity,
  obterHistoricoComportamentoMilitar,
  registrarMarcoHistoricoComportamento,
} from '@/services/justicaDisciplinaService';
import { gerarPublicacaoRPAutomaticaPorHistoricoComportamento } from '@/services/comportamentoRPService';
import { carregarMilitaresComMatriculas, filtrarMilitaresOperacionais, militarCorrespondeBusca } from '@/services/matriculaMilitarViewService';

export default function AvaliacaoComportamento() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isLoading: loadingUser, isAccessResolved, canAccessAction } = useCurrentUser();
  const canGerarPendencias = canAccessAction('gerar_pendencias_comportamento');
  const canAprovarMudanca = canAccessAction('aprovar_mudanca_comportamento');
  const [filtro, setFiltro] = useState('');
  const [aprovacaoModal, setAprovacaoModal] = useState({
    open: false,
    linha: null,
  });
  const punicaoEntity = getPunicaoEntity();

  const { data: militares = [], isLoading } = useQuery({
    queryKey: ['avaliacao-comportamento-militares'],
    queryFn: async () => {
      const lista = await base44.entities.Militar.list();
      const enriquecidos = await carregarMilitaresComMatriculas(lista);
      return filtrarMilitaresOperacionais(enriquecidos, { incluirInativos: false });
    },
  });
  const { data: punicoes = [], isLoading: loadingPunicoes } = useQuery({
    queryKey: ['avaliacao-comportamento-punicoes'],
    queryFn: () => punicaoEntity.list(),
  });
  const { data: pendencias = [] } = useQuery({
    queryKey: ['pendencias-comportamento'],
    queryFn: () => base44.entities.PendenciaComportamento?.list?.('-created_date') || [],
  });

  const avaliacao = useMemo(() => {
    return militares
      .filter((m) => PRACAS.has(m.posto_graduacao))
      .filter((m) => militarCorrespondeBusca(m, filtro))
      .map((militar) => {
        const punicoesMilitar = punicoes.filter((p) => p.militar_id === militar.id);
        const calculado = calcularComportamento(punicoesMilitar, militar.posto_graduacao, new Date(), {
          dataInclusaoMilitar: militar.data_inclusao,
        });
        const proxima = calcularProximaMelhoria(punicoesMilitar, militar.posto_graduacao, new Date(), {
          dataInclusaoMilitar: militar.data_inclusao,
        });
        const pendenciaExistente = pendencias.find(
          (p) => p.militar_id === militar.id && p.status_pendencia === 'Pendente',
        );
        return {
          militar,
          calculado,
          proxima,
          pendenciaExistente,
          inconsistenteCalculo: Boolean(calculado?.inconsistente_para_calculo),
          divergente: (militar.comportamento || 'Bom') !== calculado?.comportamento,
        };
      });
  }, [militares, punicoes, filtro, pendencias]);

  const aplicarSugestao = async (linha, { gerarPublicacao = false } = {}) => {
    if (!canAprovarMudanca) return;
    if (!linha.calculado?.comportamento) return;

    try {
      await base44.entities.Militar.update(linha.militar.id, {
        comportamento: linha.calculado.comportamento,
      });

      await garantirImplantacaoHistoricoComportamento({
        militarId: linha.militar.id,
        comportamentoAtual: linha.militar.comportamento || 'Bom',
        origemTipo: 'Militar',
        origemId: linha.militar.id,
      });

      const marcoCriado = await registrarMarcoHistoricoComportamento({
        militarId: linha.militar.id,
        dataVigencia: new Date().toISOString().slice(0, 10),
        comportamentoAnterior: linha.militar.comportamento || 'Bom',
        comportamento: linha.calculado.comportamento,
        motivoMudanca: 'Mudança efetiva de comportamento aprovada na Avaliação de Comportamento.',
        fundamentoLegal: linha.calculado.fundamento,
        origemTipo: 'PendenciaComportamento',
        origemId: linha.pendenciaExistente?.id || '',
        observacoes: 'Mudança aprovada manualmente na Avaliação de Comportamento.',
      });

      let resultadoRPAutomatico = null;
      if (gerarPublicacao) {
        let marcoParaPublicacao = marcoCriado;

        if (!marcoParaPublicacao?.id) {
          const historicoMilitar = await obterHistoricoComportamentoMilitar(linha.militar.id, { ordem: 'desc' });
          marcoParaPublicacao = historicoMilitar.find((marco) => marco?.comportamento_novo === linha.calculado.comportamento) || null;
        }

        if (!marcoParaPublicacao?.id) {
          throw new Error('Não foi possível localizar o marco histórico para vincular a publicação.');
        }

        resultadoRPAutomatico = await gerarPublicacaoRPAutomaticaPorHistoricoComportamento({
          militar: linha.militar,
          marco: {
            ...marcoParaPublicacao,
            motivo_mudanca: 'Mudança efetiva de comportamento aprovada na Avaliação de Comportamento.',
            fundamento_legal: linha.calculado.fundamento,
          },
          geradoPor: '',
        });

        console.info('[RP_AUTO][aplicarSugestao] resultado da geração automática', {
          militarId: linha.militar.id,
          historicoId: marcoParaPublicacao.id,
          ok: resultadoRPAutomatico?.ok,
          etapa: resultadoRPAutomatico?.etapa || '',
          motivo: resultadoRPAutomatico?.motivo || '',
          publicado: resultadoRPAutomatico?.publicado,
        });

        const houveFalhaPublicacao = !resultadoRPAutomatico?.ok
          && resultadoRPAutomatico?.motivo !== 'publicacao_ja_existente';
        if (houveFalhaPublicacao) {
          throw new Error(resultadoRPAutomatico?.motivo || 'Falha ao gerar publicação automática.');
        }
      }

      if (linha.pendenciaExistente?.id) {
        await base44.entities.PendenciaComportamento.update(linha.pendenciaExistente.id, {
          status_pendencia: 'Aplicada',
          data_confirmacao: new Date().toISOString().slice(0, 10),
        });
      }

      await queryClient.invalidateQueries({ queryKey: ['avaliacao-comportamento-militares'] });
      await queryClient.invalidateQueries({ queryKey: ['militares'] });
      await queryClient.invalidateQueries({ queryKey: ['pendencias-comportamento'] });
      await queryClient.invalidateQueries({ queryKey: ['publicacoes-ex-officio'] });

      const descricaoPublicacao = !gerarPublicacao
        ? 'Comportamento aplicado com sucesso.'
        : resultadoRPAutomatico?.motivo === 'publicacao_ja_existente'
          ? 'Comportamento aplicado e publicação já existente foi reaproveitada (sem duplicidade).'
          : 'Comportamento aplicado e publicação gerada com sucesso.';

      toast({
        title: 'Operação concluída',
        description: descricaoPublicacao,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Falha ao aplicar alteração',
        description: error?.message || 'Não foi possível concluir a operação.',
      });
      throw error;
    }
  };

  const gerarPendencia = async (linha) => {
    if (!linha.divergente || linha.pendenciaExistente || !linha.calculado?.comportamento || linha.inconsistenteCalculo) return;
    await criarPendenciaComportamentoSemDuplicidade({
      militar_id: linha.militar.id,
      militar_nome: linha.militar.nome_completo,
      comportamento_atual: linha.militar.comportamento || 'Bom',
      comportamento_sugerido: linha.calculado.comportamento,
      fundamento_legal: linha.calculado.fundamento,
      detalhes_calculo: JSON.stringify(linha.calculado.detalhes || {}),
      data_detectada: new Date().toISOString().slice(0, 10),
      status_pendencia: 'Pendente',
      confirmado_por: null,
      data_confirmacao: null,
    });
  };

  const gerarPendencias = async () => {
    if (!canGerarPendencias) return;
    for (const linha of avaliacao.filter((a) => a.divergente && !a.pendenciaExistente && !a.inconsistenteCalculo)) {
      // eslint-disable-next-line no-await-in-loop
      await gerarPendencia(linha);
    }
    await queryClient.invalidateQueries({ queryKey: ['pendencias-comportamento'] });
  };

  const abrirModalAprovacao = (linha) => {
    if (!canAprovarMudanca) return;
    setAprovacaoModal({
      open: true,
      linha,
    });
  };

  const fecharModalAprovacao = () => {
    setAprovacaoModal({
      open: false,
      linha: null,
    });
  };

  const confirmarAprovacao = async ({ gerarPublicacao = false } = {}) => {
    if (!canAprovarMudanca) return;
    if (!aprovacaoModal.linha) return;
    await aplicarSugestao(aprovacaoModal.linha, { gerarPublicacao });
    fecharModalAprovacao();
  };

  if (loadingUser || !isAccessResolved) return null;
  if (!canGerarPendencias && !canAprovarMudanca) {
    return <AccessDenied modulo="Avaliação de Comportamento" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Scale className="w-8 h-8 text-[#1e3a5f]" />
            <div>
              <h1 className="text-3xl font-bold text-[#1e3a5f]">Avaliação de Comportamento</h1>
              <p className="text-sm text-slate-500">Verificação automática conforme Decreto nº 1.260/1981</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={gerarPendencias} disabled={!canGerarPendencias}>
              <Wand2 className="w-4 h-4 mr-2" />
              Gerar pendências
            </Button>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 mb-4">
          <Input placeholder="Buscar por nome ou matrícula..." value={filtro} onChange={(e) => setFiltro(e.target.value)} />
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="p-3 text-left">Nome</th>
                <th className="p-3 text-left">Posto</th>
                <th className="p-3 text-left">Atual</th>
                <th className="p-3 text-left">Calculado</th>
                <th className="p-3 text-left">Mudança sugerida</th>
                <th className="p-3 text-left">Fundamento</th>
                <th className="p-3 text-left">Próxima melhoria</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading || loadingPunicoes ? (
                <tr><td className="p-4" colSpan={8}>Carregando...</td></tr>
              ) : avaliacao.map((linha) => (
                <tr key={linha.militar.id} className={linha.divergente ? 'bg-amber-50' : 'bg-white'}>
                  <td className="p-3">{linha.militar.nome_completo}</td>
                  <td className="p-3">{linha.militar.posto_graduacao}</td>
                  <td className="p-3">{linha.militar.comportamento || 'Bom'}</td>
                  <td className="p-3">{linha.calculado?.comportamento || '—'}</td>
                  <td className="p-3">
                    {linha.inconsistenteCalculo
                      ? 'Bloqueado por inconsistência cadastral'
                      : linha.divergente
                      ? `${linha.militar.comportamento || 'Bom'} → ${linha.calculado?.comportamento || '—'}`
                      : 'Sem mudança'}
                  </td>
                  <td className="p-3">
                    {linha.inconsistenteCalculo
                      ? (linha.calculado?.inconsistencias || []).map((item) => item.labelCampo).join(', ')
                      : (linha.calculado?.fundamento || '—')}
                  </td>
                  <td className="p-3">{linha.proxima?.data ? `${linha.proxima.data} (${linha.proxima.comportamento_futuro})` : '—'}</td>
                  <td className="p-3">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => navigate(createPageUrl('DetalheComportamento') + `?id=${linha.militar.id}`)}>
                        Detalhar
                      </Button>
                      {linha.divergente && !linha.inconsistenteCalculo ? (
                        <>
                          <Button size="sm" onClick={() => abrirModalAprovacao(linha)} disabled={!canAprovarMudanca}>
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            Aprovar mudança
                          </Button>
                        </>
                      ) : (
                        <span className="text-slate-400 inline-flex items-center"><AlertTriangle className="w-4 h-4 mr-1" />Sem divergência</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={aprovacaoModal.open} onOpenChange={(open) => (!open ? fecharModalAprovacao() : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aprovar mudança de comportamento</DialogTitle>
            <DialogDescription>
              Escolha como deseja concluir a aprovação para {aprovacaoModal.linha?.militar?.nome_completo || 'o militar selecionado'}.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border bg-slate-50 p-3 text-sm text-slate-700">
            <strong>Mudança:</strong>{' '}
            {aprovacaoModal.linha
              ? `${aprovacaoModal.linha.militar.comportamento || 'Bom'} → ${aprovacaoModal.linha.calculado?.comportamento || '—'}`
              : '—'}
          </div>

          <DialogFooter className="gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => confirmarAprovacao({ gerarPublicacao: false })} disabled={!canAprovarMudanca}>
              <CheckCircle2 className="w-4 h-4 mr-1" />
              Aprovar sem publicação
            </Button>
            <Button onClick={() => confirmarAprovacao({ gerarPublicacao: true })} disabled={!canAprovarMudanca}>
              <FileText className="w-4 h-4 mr-1" />
              Aprovar e gerar publicação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
