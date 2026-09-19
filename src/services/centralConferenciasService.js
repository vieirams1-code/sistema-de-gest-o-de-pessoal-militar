import { base44 } from '@/api/base44Client';

async function invoke(action, payload = {}) {
  const response = await base44.functions.invoke('centralConferenciasGateway', { action, payload });
  const data = response?.data ?? response ?? {};
  if (data?.error) throw new Error(data.error);
  return data;
}

export const centralConferenciasService = {
  bootstrap: () => invoke('BOOTSTRAP'),
  listar: () => invoke('LIST'),
  detalhar: (conferenciaId) => invoke('GET_DETAIL', { conferenciaId }),
  salvar: (conferencia, itens) => invoke('SAVE', { conferencia, itens }),
  atualizar: (conferenciaId, conferencia, itens) => invoke('UPDATE', { conferenciaId, conferencia, itens }),
  excluir: (conferenciaId) => invoke('DELETE', { conferenciaId }),
  atualizarItem: (itemId, data) => invoke('UPDATE_ITEM', { itemId, data }),
  concluir: (conferenciaId) => invoke('CONCLUDE', { conferenciaId }),
};
