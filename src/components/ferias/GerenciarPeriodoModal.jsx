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

function getVinculosResumo(periodo, registrosLivro = []) {
  const periodoId = String(periodo?.id || '').trim();
  const periodoRef = String(periodo?.referencia || '').trim();
  const militarId = String(periodo?.militar_id || '').trim();

  const feriasVinculadas = Number(periodo?.fracoes?.length || 0) > 0;
  const usoOperacional = Number(periodo?.dias_gozados || 0) > 0 || Number(periodo?.dias_previstos || 0) > 0;

  const livroVinculado = registrosLivro.some((registro) => {
    const registroMilitarId = String(registro?.militar_id || '').trim();
    if (registroMilitarId && militarId && registroMilitarId !== militarId) return false;

    const matchId = periodoId && (
      String(registro?.periodo_aquisitivo_id || '').trim() === periodoId ||
      String(registro?.periodo_id || '').trim() === periodoId ||
      String(registro?.referencia_id || '').trim() === periodoId
    );

    const matchRef = periodoRef && (
      !String(registro?.periodo_aquisitivo_id || '').trim() &&
      !String(registro?.periodo_id || '').trim() &&
      !String(registro?.referencia_id || '').trim() &&
      (
        String(registro?.periodo_aquisitivo || '').trim() === periodoRef ||
        String(registro?.periodo_aquisitivo_ref || '').trim() === periodoRef ||
        String(registro?.ano_referencia || '').trim() === periodoRef
      )
    );

    return Boolean(matchId || matchRef);
  });

  return { feriasVinculadas, usoOperacional, livroVinculado };
}

export default function GerenciarPeriodoModal({
  open,
  periodo,
  registrosLivro,
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

  useEffect(() => {
    if (!periodo) return;
    setForm({
      inicio_aquisitivo: periodo.data_inicio_aquisitivo || '',
      fim_aquisitivo: periodo.data_fim_aquisitivo || '',
      data_limite_gozo: periodo.data_limite_gozo_iso || '',
      status: periodo.status_operacional || 'Pendente',
    });
    setFeedback(null);
  }, [periodo]);

  const vinculos = useMemo(
    () => getVinculosResumo(periodo, registrosLivro),
    [periodo, registrosLivro]
  );

  const exclusaoBloqueada = vinculos.feriasVinculadas || vinculos.livroVinculado || vinculos.usoOperacional;
  const periodoAutomatico = Boolean(
    periodo?.criado_automaticamente ||
    `${periodo?.origem_periodo || ''}`.toLowerCase().includes('auto')
  );

  const motivoExclusao = useMemo(() => {
    const motivos = [];
    if (vinculos.feriasVinculadas) motivos.push('férias vinculadas');
    if (vinculos.livroVinculado) motivos.push('registros no Livro');
    if (vinculos.usoOperacional) motivos.push('uso operacional do período');
    return motivos;
  }, [vinculos]);

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
      await onConfirmDelete?.({ forceInactivate: periodoAutomatico || exclusaoBloqueada });
      setFeedback({
        type: 'success',
        message: periodoAutomatico || exclusaoBloqueada
          ? 'Período inativado com sucesso.'
          : 'Período excluído com sucesso.',
      });
    } catch (error) {
      setFeedback({ type: 'error', message: error?.message || 'Falha ao excluir/inativar período.' });
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
              {exclusaoBloqueada && (
                <Alert className="border-amber-200 bg-amber-50">
                  <AlertDescription className="text-amber-800">
                    Exclusão bloqueada: este período possui {motivoExclusao.join(', ')}. A ação permitida é apenas inativar.
                  </AlertDescription>
                </Alert>
              )}
              {!exclusaoBloqueada && periodoAutomatico && (
                <Alert className="border-blue-200 bg-blue-50">
                  <AlertDescription className="text-blue-800">
                    Período identificado como automático. Para manter integridade, será aplicada inativação em vez de exclusão física.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex justify-between gap-2 flex-wrap">
                <Button variant="outline" onClick={() => onOpenFerias?.(periodo)}>
                  Abrir férias vinculadas
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setShowConfirmDelete(true)}
                  disabled={saving || deleting}
                >
                  {periodoAutomatico || exclusaoBloqueada ? 'Inativar período' : 'Excluir período'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showConfirmDelete} onOpenChange={setShowConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar ação destrutiva</AlertDialogTitle>
            <AlertDialogDescription>
              {periodoAutomatico || exclusaoBloqueada
                ? 'Este período será inativado e deixará de ser considerado em operações ativas. Deseja continuar?'
                : 'Este período será excluído definitivamente. Esta ação não pode ser desfeita. Deseja continuar?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleExcluir} className="bg-red-600 hover:bg-red-700" disabled={deleting}>
              {deleting ? 'Processando...' : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
