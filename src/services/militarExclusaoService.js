let clientOverride = null;
let runtimeClientPromise = null;

async function getClient() {
  if (clientOverride) return clientOverride;
  if (!runtimeClientPromise) {
    runtimeClientPromise = import('../api/base44Client.js').then((mod) => mod.base44);
  }
  return runtimeClientPromise;
}

async function getEntitySafe(nome) {
  const client = await getClient();
  return client?.entities?.[nome] || null;
}

function hasMethod(entity, nome) {
  return Boolean(entity && typeof entity[nome] === 'function');
}

function dataISOHoje() {
  return new Date().toISOString().slice(0, 10);
}

export function __setMilitarExclusaoClientForTests(client) {
  clientOverride = client;
}

export async function tratarPendenciasComportamentoNaExclusaoMilitar(militarId, { executadoPor = '' } = {}) {
  const id = String(militarId || '').trim();
  if (!id) return { totalEncontradas: 0, totalTratadas: 0 };

  const pendenciaEntity = await getEntitySafe('PendenciaComportamento');
  if (!hasMethod(pendenciaEntity, 'filter') || !hasMethod(pendenciaEntity, 'update')) {
    return { totalEncontradas: 0, totalTratadas: 0 };
  }

  const pendencias = await pendenciaEntity.filter({ militar_id: id });
  const abertas = (pendencias || []).filter((item) => String(item?.status_pendencia || '').trim() === 'Pendente');

  await Promise.all(abertas.map((item) => {
    const detalhesAtuais = String(item?.detalhes_calculo || '').trim();
    const marcador = `Encerrada automaticamente por exclusão do militar em ${dataISOHoje()}`;
    const detalhes = detalhesAtuais ? `${detalhesAtuais} | ${marcador}` : marcador;

    return pendenciaEntity.update(item.id, {
      status_pendencia: 'Descartada',
      data_confirmacao: dataISOHoje(),
      confirmado_por: executadoPor || 'sistema',
      detalhes_calculo: detalhes,
    });
  }));

  return { totalEncontradas: pendencias.length, totalTratadas: abertas.length };
}

export async function excluirMilitarComDependencias(militarId, { executadoPor = '' } = {}) {
  const id = String(militarId || '').trim();
  if (!id) throw new Error('Militar inválido para exclusão.');

  const militarEntity = await getEntitySafe('Militar');
  if (!hasMethod(militarEntity, 'delete')) {
    throw new Error('Entidade Militar indisponível para exclusão.');
  }

  const resultadoPendencias = await tratarPendenciasComportamentoNaExclusaoMilitar(id, { executadoPor });
  await militarEntity.delete(id);

  return {
    militarId: id,
    pendencias: resultadoPendencias,
  };
}
