import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { carregarProcedimentosProcessos } from '@/services/procedimentos/procedimentosService';

const QUERY_KEY = ['procedimentos-processos'];

async function syncChildren(entity, procedimentoId, items = [], deletedIds = []) {
  const normalizedItems = (items || [])
    .filter((item) => Object.values(item || {}).some((value) => String(value || '').trim() !== ''));

  const toUpdate = normalizedItems.filter((item) => item.id);
  const toCreate = normalizedItems.filter((item) => !item.id);

  await Promise.all(
    toUpdate.map((item) => {
      const payload = { ...item, procedimento_id: procedimentoId };
      delete payload.id;
      return entity.update(item.id, payload);
    })
  );

  await Promise.all(
    toCreate.map((item) => entity.create({ ...item, procedimento_id: procedimentoId }))
  );

  const idsToDelete = [...new Set((deletedIds || []).filter(Boolean))];
  if (idsToDelete.length === 0) return;

  const current = await entity.filter({ procedimento_id: procedimentoId });
  const currentIds = new Set((current || []).map((item) => item.id));

  await Promise.all(
    idsToDelete
      .filter((id) => currentIds.has(id))
      .map((id) => entity.delete(id))
  );
}

export function useProcedimentosProcessos() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: carregarProcedimentosProcessos,
  });

  const saveMutation = useMutation({
    mutationFn: async ({ procedimento, envolvidos, pendencias, viaturas, prazos, removedIds = {} }) => {
      const payload = {
        ...procedimento,
        prorrogacoes_count: (prazos || []).filter((p) => p.tipo_prazo === 'prorrogacao').length,
      };

      let procedimentoId = procedimento.id;
      if (procedimentoId) {
        await base44.entities.ProcedimentoProcesso.update(procedimentoId, payload);
      } else {
        const created = await base44.entities.ProcedimentoProcesso.create(payload);
        procedimentoId = created.id;
      }

      await Promise.all([
        syncChildren(base44.entities.ProcedimentoEnvolvido, procedimentoId, envolvidos, removedIds.envolvidos),
        syncChildren(base44.entities.ProcedimentoPendencia, procedimentoId, pendencias, removedIds.pendencias),
        syncChildren(base44.entities.ProcedimentoViatura, procedimentoId, viaturas, removedIds.viaturas),
        syncChildren(base44.entities.ProcedimentoPrazoHistorico, procedimentoId, prazos, removedIds.prazos),
      ]);

      return procedimentoId;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  return {
    ...query,
    saveProcedimento: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
  };
}
