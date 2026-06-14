import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const texto = (valor: unknown) => String(valor ?? '').trim();
const normalizar = (valor: unknown) => texto(valor).toLowerCase();

// Status considerados "publicados" no PromocaoMilitar.
const STATUS_PROMOCAO_PUBLICADA = new Set(['publicada', 'publicado', 'consolidada', 'consolidado']);
// Status para o qual o ParticipanteCursoFormacao deve voltar após a reversão,
// caso não seja possível inferir um status anterior seguro.
const STATUS_PARTICIPANTE_POS_REVERSAO_PADRAO = 'aprovado';
const STATUS_PARTICIPANTE_VALIDOS_POS_REVERSAO = new Set(['aprovado', 'aguardando_nova_etapa']);

function statusPromocaoPosReversao(itens: any[] = []) {
  const publicados = (itens || []).filter((item) => Boolean(item?.publicado) && normalizar(item?.status) === 'publicado').length;
  if (publicados === 0) return 'rascunho';
  if (publicados < (itens || []).length) return 'publicada_parcial';
  return 'publicada';
}

async function parsePayload(req: any) {
  const candidates: any[] = [req?.body, req?.body?.data, req?.data, req?.payload, (globalThis as any)?.input];
  try { if (typeof req?.json === 'function') candidates.push(await req.json()); } catch (_) {}
  for (const c of candidates) {
    if (c && typeof c === 'object') return c?.data && typeof c.data === 'object' ? c.data : c;
  }
  return {};
}

// Resposta de erro detalhada e padronizada com todos os identificadores relevantes.
function erro({ status, etapa, motivo, contexto = {} }: any) {
  return Response.json({
    success: false,
    etapa,
    motivo,
    campo_faltante: contexto.campo_faltante || null,
    validacao_bloqueada: contexto.validacao_bloqueada || null,
    promocao_id: contexto.promocao_id || null,
    militar_id: contexto.militar_id || null,
    promocao_militar_id: contexto.promocao_militar_id || null,
    participante_curso_id: contexto.participante_curso_id || null,
    historico_promocao_v2_id: contexto.historico_promocao_v2_id || null,
  }, { status });
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  try {
    const payload = await parsePayload(req);
    const promocao = payload?.promocao || {};
    const item = payload?.item || {};
    const itensPromocao = Array.isArray(payload?.itensPromocao) ? payload.itensPromocao : [];
    const motivo = texto(payload?.motivo);
    const observacoes = texto(payload?.observacoes);
    const usuario = payload?.usuario || null;

    const promocaoId = texto(promocao?.id);
    const itemId = texto(item?.id);

    if (!promocaoId) return erro({ status: 400, etapa: 'validacao', motivo: 'promocao_nao_carregada', contexto: { campo_faltante: 'promocao.id' } });
    if (!itemId) return erro({ status: 400, etapa: 'validacao', motivo: 'item_nao_carregado', contexto: { campo_faltante: 'item.id', promocao_id: promocaoId } });
    if (!motivo) return erro({ status: 400, etapa: 'validacao', motivo: 'motivo_obrigatorio', contexto: { campo_faltante: 'motivo', promocao_id: promocaoId, promocao_militar_id: itemId } });

    const Historico = base44.asServiceRole.entities.HistoricoPromocaoMilitarV2;
    const PromocaoMilitar = base44.asServiceRole.entities.PromocaoMilitar;
    const Promocao = base44.asServiceRole.entities.Promocao;
    const Militar = base44.asServiceRole.entities.Militar;
    const ParticipanteCurso = base44.asServiceRole.entities.ParticipanteCursoFormacao;

    // === Sempre confiar no estado ATUAL do banco, não no payload (que pode estar defasado). ===
    const itemAtual = await PromocaoMilitar.get(itemId).catch(() => null);
    if (!itemAtual?.id) {
      return erro({ status: 404, etapa: 'validacao', motivo: 'promocao_militar_nao_encontrado', contexto: { promocao_id: promocaoId, promocao_militar_id: itemId } });
    }

    const militarId = texto(itemAtual?.militar_id) || texto(item?.militar_id);

    // O histórico é resolvido pelo registro do banco; só caímos no payload se faltar.
    const historicoId = texto(itemAtual?.historico_promocao_v2_id) || texto(item?.historico_promocao_v2_id);

    // Valida que o item está de fato publicado antes de reverter.
    const itemPublicado = Boolean(itemAtual?.publicado) || STATUS_PROMOCAO_PUBLICADA.has(normalizar(itemAtual?.status));
    if (!itemPublicado) {
      return erro({ status: 400, etapa: 'validacao', motivo: 'item_nao_publicado', contexto: { validacao_bloqueada: 'item_nao_publicado', promocao_id: promocaoId, promocao_militar_id: itemId, militar_id: militarId } });
    }

    if (!historicoId) {
      return erro({ status: 400, etapa: 'validacao', motivo: 'historico_ausente', contexto: { campo_faltante: 'historico_promocao_v2_id', promocao_id: promocaoId, promocao_militar_id: itemId, militar_id: militarId } });
    }

    const historicoAtual = await Historico.get(historicoId).catch(() => null);
    if (!historicoAtual?.id) {
      return erro({ status: 404, etapa: 'validacao', motivo: 'historico_nao_encontrado', contexto: { promocao_id: promocaoId, promocao_militar_id: itemId, militar_id: militarId, historico_promocao_v2_id: historicoId } });
    }

    let militarAnterior: any = null;
    const precisaRollbackCadastro = Boolean(itemAtual?.atualizar_cadastro_militar) || normalizar(itemAtual?.resultado_aplicacao_cadastro) === 'imediatamente_superior';
    if (precisaRollbackCadastro) {
      militarAnterior = await Militar.get(militarId).catch(() => null);
      if (!militarAnterior?.id) {
        return erro({ status: 404, etapa: 'validacao', motivo: 'militar_nao_encontrado', contexto: { promocao_id: promocaoId, promocao_militar_id: itemId, militar_id: militarId } });
      }
      if (texto(militarAnterior?.posto_graduacao) !== texto(historicoAtual?.posto_graduacao_novo) || texto(militarAnterior?.quadro) !== texto(historicoAtual?.quadro_novo)) {
        return erro({ status: 409, etapa: 'validacao', motivo: 'rollback_cadastro_bloqueado_divergencia', contexto: { validacao_bloqueada: 'cadastro_divergente_do_publicado', promocao_id: promocaoId, promocao_militar_id: itemId, militar_id: militarId, historico_promocao_v2_id: historicoId } });
      }
    }

    // === Vínculo opcional com Curso de Formação (ParticipanteCursoFormacao). ===
    // A reversão também deve devolver o participante de 'promovido' para o status pré-publicação.
    let participante: any = null;
    if (militarId && typeof ParticipanteCurso?.filter === 'function') {
      const vinculos = await ParticipanteCurso.filter({ promocao_id: promocaoId, militar_id: militarId }).catch(() => []);
      participante = (vinculos || []).find((p: any) => normalizar(p?.status) === 'promovido') || (vinculos || [])[0] || null;
    }
    const statusParticipanteAnterior = participante ? normalizar(participante?.status) : '';
    const statusParticipantePosReversao = STATUS_PARTICIPANTE_VALIDOS_POS_REVERSAO.has(statusParticipanteAnterior)
      ? participante?.status
      : STATUS_PARTICIPANTE_POS_REVERSAO_PADRAO;

    const trilhaAdmin = ['[REVERSAO_ADMINISTRATIVA]', `motivo=${motivo}`, observacoes ? `observacoes=${observacoes}` : '', texto(usuario?.email) ? `usuario=${texto(usuario.email)}` : '', `data=${new Date().toISOString()}`].filter(Boolean).join(' | ');
    const historicoSnapshot = { status_registro: historicoAtual?.status_registro, motivo_retificacao: historicoAtual?.motivo_retificacao, observacoes: historicoAtual?.observacoes };
    const itemSnapshot = { status: itemAtual?.status, publicado: itemAtual?.publicado };
    const promocaoAtual = await Promocao.get(promocaoId).catch(() => null);
    const promocaoSnapshot = { status: promocaoAtual?.status };
    const participanteSnapshot = participante ? { status: participante?.status, data_status_atual: participante?.data_status_atual } : null;
    const statusPromocao = statusPromocaoPosReversao((itensPromocao || []).map((registro: any) => (String(registro?.id) === String(itemId) ? { ...registro, status: 'cancelado', publicado: false } : registro)));

    try {
      await Historico.update(historicoId, { status_registro: 'cancelado', motivo_retificacao: motivo, observacoes: [texto(historicoAtual?.observacoes), trilhaAdmin].filter(Boolean).join('\n') });

      if (precisaRollbackCadastro) {
        await Militar.update(militarAnterior.id, {
          posto_graduacao: texto(historicoAtual?.posto_graduacao_anterior),
          quadro: texto(historicoAtual?.quadro_anterior),
        });
      }

      await PromocaoMilitar.update(itemId, { status: 'cancelado', publicado: false });

      // Reverte o participante do curso de formação (promovido -> status pré-publicação).
      if (participante?.id) {
        await ParticipanteCurso.update(participante.id, {
          status: statusParticipantePosReversao,
          data_status_atual: new Date().toISOString(),
        });
      }

      await Promocao.update(promocaoId, { status: statusPromocao });
    } catch (error: any) {
      try { await Historico.update(historicoId, historicoSnapshot); } catch (_) {}
      try { await PromocaoMilitar.update(itemId, itemSnapshot); } catch (_) {}
      try { await Promocao.update(promocaoId, promocaoSnapshot); } catch (_) {}
      if (participante?.id && participanteSnapshot) {
        try { await ParticipanteCurso.update(participante.id, participanteSnapshot); } catch (_) {}
      }
      if (precisaRollbackCadastro && militarAnterior?.id) {
        try {
            await Militar.update(militarAnterior.id, {
                posto_graduacao: militarAnterior?.posto_graduacao,
                quadro: militarAnterior?.quadro,
            });
        } catch (_) {}
      }
      return erro({ status: 500, etapa: 'transacao', motivo: error?.message || 'falha_reversao', contexto: { promocao_id: promocaoId, promocao_militar_id: itemId, militar_id: militarId, historico_promocao_v2_id: historicoId, participante_curso_id: participante?.id || null } });
    }

    return Response.json({
      success: true,
      historicoCancelado: true,
      cadastroRestaurado: Boolean(precisaRollbackCadastro),
      promocaoRecalculada: true,
      statusPromocao,
      promocao_id: promocaoId,
      militar_id: militarId,
      promocao_militar_id: itemId,
      historico_promocao_v2_id: historicoId,
      participante_curso_id: participante?.id || null,
      participanteRevertido: Boolean(participante?.id),
      participante_status_anterior: participanteSnapshot?.status || null,
      participante_status_novo: participante?.id ? statusParticipantePosReversao : null,
    });
  } catch (error: any) {
    return erro({ status: 500, etapa: 'erro_interno', motivo: error?.message || 'erro_interno_reversao' });
  }
});