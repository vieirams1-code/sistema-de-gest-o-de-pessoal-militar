// Encerramento automático de campanhas de férias.
// Regra operacional: a campanha aceita respostas até o fim do último dia do prazo
// (data_fim_militar). A partir do dia seguinte, no fuso de Cuiabá (UTC-4), ela é
// encerrada de forma idempotente e auditada.

const STATUS_ABERTOS = new Set(['aberta_coleta', 'aberta', 'ativa', 'em_andamento']);

export function dataHojeCuiaba(): string {
  return new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function campanhaComPrazoVencido(campanha: any, hoje = dataHojeCuiaba()): boolean {
  const status = String(campanha?.status || '').trim().toLowerCase();
  const prazo = String(campanha?.data_fim_militar || '').slice(0, 10);
  return Boolean(STATUS_ABERTOS.has(status) && /^\d{4}-\d{2}-\d{2}$/.test(prazo) && prazo < hoje);
}

export async function encerrarCampanhasFeriasVencidas(base44: any, campanhas: any[] = []): Promise<any[]> {
  const hoje = dataHojeCuiaba();
  const vencidas = (campanhas || []).filter((c: any) => c?.tipo === 'PLANO_FERIAS' && campanhaComPrazoVencido(c, hoje));
  for (const campanha of vencidas) {
    try {
      await base44.asServiceRole.entities.CampanhaPortal.update(campanha.id, { status: 'Encerrada' });
      const statusAnterior = campanha.status;
      campanha.status = 'Encerrada';
      await base44.asServiceRole.entities.AuditoriaFerias.create({
        acao: 'CAMPANHA_FERIAS_ENCERRADA_POR_PRAZO',
        resultado: 'SUCESSO',
        usuario_email: 'sistema',
        usuario_nome: 'Encerramento automático',
        plano_id: String(campanha.plano_ferias_institucional_id || ''),
        campanha_id: String(campanha.id || ''),
        detalhes: JSON.stringify({
          campanha_titulo: campanha.titulo || '',
          status_anterior: statusAnterior || '',
          status_novo: 'Encerrada',
          prazo_militar: String(campanha.data_fim_militar || '').slice(0, 10),
          data_referencia: hoje,
          respostas_preservadas: true,
        }),
        data_hora: new Date().toISOString(),
      });
    } catch (_erroEncerramento) {
      // O encerramento automático nunca pode impedir a leitura do painel.
    }
  }
  return vencidas;
}