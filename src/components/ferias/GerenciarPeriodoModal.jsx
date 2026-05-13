import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const STATUS_OPTIONS = [
  'Pendente',
  'Disponível',
  'Previsto',
  'Parcialmente Gozado',
  'Gozado',
  'Vencido',
  'Inativo',
];

const TIPOS_CADEIA_FERIAS = new Set([
  'Saída Férias',
  'Retorno Férias',
  'Interrupção de Férias',
  'Nova Saída / Retomada',
]);

const ESTADO_SEGURANCA = {
  SEGURO: 'SEGURO_PARA_EXCLUIR',
  REVERSAO: 'EXIGE_REVERSAO',
  BLOQUEIO_TOTAL: 'BLOQUEIO_ADMINISTRATIVO_TOTAL',
};

function normalizarTexto(valor) {
  return String(valor ?? '').trim();
}

function contemReferenciaTextual(registro = {}, periodoRef = '') {
  if (!periodoRef) return false;
  return [
    registro?.periodo_aquisitivo,
    registro?.periodo_aquisitivo_ref,
    registro?.ano_referencia,
    registro?.documento_referencia,
    registro?.documento_texto,
    registro?.texto_publicacao,
    registro?.nota_para_bg,
    registro?.observacoes,
    registro?.texto_base,
    registro?.texto_complemento,
  ]
    .map((valor) => normalizarTexto(valor))
    .some((valor) => valor === periodoRef || valor.includes(periodoRef));
}

function getFeriasIds(periodo = {}) {
  return new Set((periodo?.fracoes || []).map((fracao) => normalizarTexto(fracao?.id)).filter(Boolean));
}

function registroLivroDoPeriodo(registro = {}, { periodoId, periodoRef, militarId, feriasIds }) {
  const registroMilitarId = normalizarTexto(registro?.militar_id);
  if (registroMilitarId && militarId && registroMilitarId !== militarId) return false;

  const matchFerias = normalizarTexto(registro?.ferias_id) && feriasIds.has(normalizarTexto(registro?.ferias_id));
  const matchId = periodoId && (
    normalizarTexto(registro?.periodo_aquisitivo_id) === periodoId ||
    normalizarTexto(registro?.periodo_id) === periodoId ||
    normalizarTexto(registro?.referencia_id) === periodoId
  );
  const matchRef = contemReferenciaTextual(registro, periodoRef);

  return Boolean(matchFerias || matchId || matchRef);
}

function publicacaoDoPeriodo(publicacao = {}, { periodoId, periodoRef, militarId, feriasIds, registroLivroIds }) {
  const publicacaoMilitarId = normalizarTexto(publicacao?.militar_id);
  if (publicacaoMilitarId && militarId && publicacaoMilitarId !== militarId) return false;

  const feriasRefs = [
    publicacao?.ferias_id,
    publicacao?.ferias_interrompida_id,
    publicacao?.gozo_ferias_id,
    publicacao?.gozo_id,
  ].map(normalizarTexto).filter(Boolean);

  const registroRefs = [
    publicacao?.registro_livro_id,
    publicacao?.livro_id,
    publicacao?.referencia_id,
  ].map(normalizarTexto).filter(Boolean);

  const matchPeriodo = periodoId && (
    normalizarTexto(publicacao?.periodo_aquisitivo_id) === periodoId ||
    normalizarTexto(publicacao?.periodo_id) === periodoId
  );
  const matchFerias = feriasRefs.some((id) => feriasIds.has(id));
  const matchRegistro = registroRefs.some((id) => registroLivroIds.has(id));
  const matchRef = contemReferenciaTextual(publicacao, periodoRef);

  return Boolean(matchPeriodo || matchFerias || matchRegistro || matchRef);
}

function getVinculosResumo(periodo, registrosLivro = [], publicacoes = []) {
  const periodoId = normalizarTexto(periodo?.id);
  const periodoRef = normalizarTexto(periodo?.referencia);
  const militarId = normalizarTexto(periodo?.militar_id || periodo?.raw?.militar_id);
  const feriasIds = getFeriasIds(periodo);

  const feriasVinculadas = Number(periodo?.fracoes?.length || 0) > 0;
  const usoOperacional = Number(periodo?.dias_gozados || 0) > 0 || Number(periodo?.dias_previstos || 0) > 0;

  const registrosDoPeriodo = (registrosLivro || []).filter((registro) =>
    registroLivroDoPeriodo(registro, { periodoId, periodoRef, militarId, feriasIds })
  );
  const registroLivroIds = new Set(registrosDoPeriodo.map((registro) => normalizarTexto(registro?.id)).filter(Boolean));
  const livroVinculado = registrosDoPeriodo.length > 0;
  const cadeiaAdministrativa = registrosDoPeriodo.some((registro) => TIPOS_CADEIA_FERIAS.has(normalizarTexto(registro?.tipo_registro)));

  const publicacoesDoPeriodo = (publicacoes || []).filter((publicacao) =>
    publicacaoDoPeriodo(publicacao, { periodoId, periodoRef, militarId, feriasIds, registroLivroIds })
  );
  const publicacaoVinculada = publicacoesDoPeriodo.length > 0;
  const vinculoAdministrativo = Boolean(
    periodo?.raw?.transicao_designacao_lote_id ||
    periodo?.raw?.transicao_designacao_contrato_id ||
    periodo?.raw?.legado_ativa_contrato_designacao_id ||
    periodo?.raw?.cancelado_transicao_contrato_id ||
    periodo?.raw?.excluido_da_cadeia_designacao
  );

  const bloqueioAdministrativo = livroVinculado || publicacaoVinculada || cadeiaAdministrativa || vinculoAdministrativo;
  const estado = bloqueioAdministrativo
    ? ESTADO_SEGURANCA.BLOQUEIO_TOTAL
    : feriasVinculadas || usoOperacional
      ? ESTADO_SEGURANCA.REVERSAO
      : ESTADO_SEGURANCA.SEGURO;

  return {
    estado,
    feriasVinculadas,
    usoOperacional,
    livroVinculado,
    publicacaoVinculada,
    cadeiaAdministrativa,
    vinculoAdministrativo,
    registrosLivroCount: registrosDoPeriodo.length,
    publicacoesCount: publicacoesDoPeriodo.length,
  };
}
export default function GerenciarPeriodoModal({
  open,
  periodo,
  registrosLivro,
  publicacoes,
  saving,
  deleting,
  onOpenChange,
  onSubmitEdicao,
  onChangeStatus,
  onConfirmDelete,
  onOpenFerias,
}) {
  const [form, setForm] = useState({
    inicio_aquisitivo: '',
    fim_aquisitivo: '',
    data_limite_gozo: '',
    status: 'Pendente',
  });
  const [feedback, setFeedback] = useState(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [confirmacaoExclusao, setConfirmacaoExclusao] = useState('');

  useEffect(() => {
    if (!periodo) return;
    setForm({
      inicio_aquisitivo: periodo.data_inicio_aquisitivo || '',
      fim_aquisitivo: periodo.data_fim_aquisitivo || '',
      data_limite_gozo: periodo.data_limite_gozo_iso || '',
      status: periodo.status_operacional || 'Pendente',
    });
    setFeedback(null);
    setShowConfirmDelete(false);
    setConfirmacaoExclusao('');
  }, [periodo]);

  const vinculos = useMemo(
    () => getVinculosResumo(periodo, registrosLivro, publicacoes),
    [periodo, registrosLivro, publicacoes]
  );

  const exclusaoPermitida = vinculos.estado === ESTADO_SEGURANCA.SEGURO;
  const confirmacaoEsperada = `EXCLUIR ${periodo?.referencia || ''}`.trim();
  const confirmacaoValida = normalizarTexto(confirmacaoExclusao).toUpperCase() === confirmacaoEsperada.toUpperCase();

  const motivoExclusao = useMemo(() => {
    const motivos = [];
    if (vinculos.feriasVinculadas) motivos.push('férias vinculadas');
    if (vinculos.livroVinculado) motivos.push(`Livro (${vinculos.registrosLivroCount})`);
    if (vinculos.publicacaoVinculada) motivos.push(`Publicação Ex Officio (${vinculos.publicacoesCount})`);
    if (vinculos.cadeiaAdministrativa) motivos.push('cadeia administrativa de férias');
    if (vinculos.vinculoAdministrativo) motivos.push('vínculo administrativo');
    if (vinculos.usoOperacional) motivos.push('uso operacional do período');
    return motivos;
  }, [vinculos]);

  const estadoSegurancaUi = useMemo(() => {
    if (vinculos.estado === ESTADO_SEGURANCA.SEGURO) {
      return {
        className: 'border-emerald-200 bg-emerald-50',
        textClassName: 'text-emerald-800',
        titulo: 'Seguro para excluir',
        descricao: 'Nenhuma férias, Livro, publicação ou uso operacional foi identificado. A exclusão física pode ser feita com confirmação textual.',
      };
    }
    if (vinculos.estado === ESTADO_SEGURANCA.REVERSAO) {
      return {
        className: 'border-amber-200 bg-amber-50',
        textClassName: 'text-amber-800',
        titulo: 'Exige reversão',
        descricao: `Exclusão bloqueada: ${motivoExclusao.join(', ')}. Reverta ou remova as férias vinculadas antes de tentar excluir o período.`,
      };
    }
    return {
      className: 'border-red-200 bg-red-50',
      textClassName: 'text-red-800',
      titulo: 'Bloqueio administrativo total',
      descricao: `Exclusão e inativação bloqueadas: ${motivoExclusao.join(', ')}. Acione o administrador para análise administrativa sem alterar Livro ou publicações.`,
    };
  }, [motivoExclusao, vinculos.estado]);

  const handleSalvarEdicao = async () => {
    setFeedback(null);

    if (!form.inicio_aquisitivo || !form.fim_aquisitivo || !form.data_limite_gozo) {
      setFeedback({ type: 'error', message: 'Preencha início, fim e limite de gozo para salvar a edição.' });
      return;
    }

    try {
      await onSubmitEdicao?.({
        inicio_aquisitivo: form.inicio_aquisitivo,
        fim_aquisitivo: form.fim_aquisitivo,
        data_limite_gozo: form.data_limite_gozo,
      });
      setFeedback({ type: 'success', message: 'Período atualizado com sucesso.' });
    } catch (error) {
      setFeedback({ type: 'error', message: error?.message || 'Falha ao atualizar período.' });
    }
  };

  const handleAlterarStatus = async () => {
    setFeedback(null);
    try {
      await onChangeStatus?.(form.status);
      setFeedback({ type: 'success', message: `Status alterado para ${form.status}.` });
    } catch (error) {
      setFeedback({ type: 'error', message: error?.message || 'Falha ao alterar status.' });
    }
  };

  const handleExcluir = async () => {
    setFeedback(null);
    setShowConfirmDelete(false);

    try {
      if (!exclusaoPermitida) throw new Error('Exclusão bloqueada por vínculo operacional/administrativo.');
      if (!confirmacaoValida) throw new Error(`Digite ${confirmacaoEsperada} para confirmar a exclusão física.`);
      await onConfirmDelete?.();
      setFeedback({
        type: 'success',
        message: 'Período excluído com sucesso.',
      });
    } catch (error) {
      setFeedback({ type: 'error', message: error?.message || 'Falha ao excluir período.' });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Gerenciar período aquisitivo</DialogTitle>
            <DialogDescription>
              Referência {periodo?.referencia || '-'} • Gerencie edição, status e remoção com segurança.
            </DialogDescription>
          </DialogHeader>

          {!!feedback && (
            <Alert className={feedback.type === 'success' ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}>
              <AlertDescription className={feedback.type === 'success' ? 'text-emerald-700' : 'text-red-700'}>
                {feedback.message}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-4 py-1">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-slate-500 mb-1">Início aquisitivo</p>
                <Input type="date" value={form.inicio_aquisitivo} onChange={(e) => setForm((prev) => ({ ...prev, inicio_aquisitivo: e.target.value }))} />
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Fim aquisitivo</p>
                <Input type="date" value={form.fim_aquisitivo} onChange={(e) => setForm((prev) => ({ ...prev, fim_aquisitivo: e.target.value }))} />
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Limite gozo</p>
                <Input type="date" value={form.data_limite_gozo} onChange={(e) => setForm((prev) => ({ ...prev, data_limite_gozo: e.target.value }))} />
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSalvarEdicao} disabled={saving || deleting} className="bg-[#1e3a5f] hover:bg-[#1e3a5f]/90">
                {saving ? 'Salvando...' : 'Salvar edição'}
              </Button>
            </div>

            <div className="border-t pt-4">
              <p className="text-xs text-slate-500 mb-1">Status operacional</p>
              <div className="flex gap-2">
                <Select value={form.status} onValueChange={(value) => setForm((prev) => ({ ...prev, status: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((item) => (
                      <SelectItem key={item} value={item}>{item}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={handleAlterarStatus} disabled={saving || deleting}>
                  Aplicar status
                </Button>
              </div>
            </div>

            <div className="border-t pt-4 space-y-2">
              <p className="text-sm font-medium text-slate-700">Exclusão segura</p>
              <Alert className={estadoSegurancaUi.className}>
                <AlertDescription className={estadoSegurancaUi.textClassName}>
                  <strong>{estadoSegurancaUi.titulo}.</strong> {estadoSegurancaUi.descricao}
                </AlertDescription>
              </Alert>

              <div className="flex justify-between gap-2 flex-wrap">
                <Button variant="outline" onClick={() => onOpenFerias?.(periodo)}>
                  Abrir férias vinculadas
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setConfirmacaoExclusao('');
                    setShowConfirmDelete(true);
                  }}
                  disabled={saving || deleting || !exclusaoPermitida}
                >
                  Excluir período
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showConfirmDelete} onOpenChange={setShowConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão física</AlertDialogTitle>
            <AlertDialogDescription>
              Este período será excluído definitivamente. Esta ação não exclui férias, Livro ou publicações e não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <p className="text-sm text-slate-700">
              Para confirmar, digite <strong>{confirmacaoEsperada}</strong>.
            </p>
            <Input
              value={confirmacaoExclusao}
              onChange={(e) => setConfirmacaoExclusao(e.target.value)}
              placeholder={confirmacaoEsperada}
              disabled={deleting}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleExcluir} className="bg-red-600 hover:bg-red-700" disabled={deleting || !exclusaoPermitida || !confirmacaoValida}>
              {deleting ? 'Processando...' : 'Excluir definitivamente'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
