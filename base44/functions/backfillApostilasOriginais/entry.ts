import { createClientFromRequest } from 'npm:@base44/sdk@0.1.0';

const CONFIRMACAO_EXECUCAO = 'CORRIGIR APOSTILAS';

const parseBool = (value: unknown, fallback = true) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const n = value.trim().toLowerCase();
    if (['true', '1', 'sim', 'yes'].includes(n)) return true;
    if (['false', '0', 'nao', 'não', 'no'].includes(n)) return false;
  }
  return fallback;
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const authUser = await base44.auth.me();

    if (!authUser) {
      return Response.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    if (String(authUser.role || '').toLowerCase() !== 'admin') {
      return Response.json({ error: 'Ação permitida apenas para administradores.' }, { status: 403 });
    }

    let payload: Record<string, unknown> = {};
    try {
      payload = await req.json();
    } catch (_e) {
      payload = {};
    }

    const dryRun = parseBool(payload?.dryRun, true);
    const confirmacao = String(payload?.confirmacao || '').trim();

    if (!dryRun && confirmacao !== CONFIRMACAO_EXECUCAO) {
      return Response.json(
        {
          error: `Confirmação obrigatória para execução real. Informe exatamente: ${CONFIRMACAO_EXECUCAO}`,
          dryRun,
        },
        { status: 400 },
      );
    }

    const apostilas = await base44.asServiceRole.entities.PublicacaoExOfficio.filter(
      { tipo: 'Apostila', ativo: true },
      '-created_date',
      1000,
      0,
    );

    const relatorio = {
      apostilasEncontradas: 0,
      originaisJaCorretas: 0,
      originaisAtualizadas: 0,
      ignoradas: 0,
      falhas: 0,
      itens: [] as Array<Record<string, unknown>>,
    };

    for (const apostila of apostilas || []) {
      relatorio.apostilasEncontradas += 1;

      const apostilaId = String(apostila?.id || '').trim();
      const refId = String(apostila?.publicacao_referencia_id || '').trim();

      if (!apostilaId || !refId) {
        relatorio.ignoradas += 1;
        relatorio.itens.push({ apostilaId, refId, status: 'ignorada', motivo: 'sem_id_ou_referencia' });
        continue;
      }

      if (apostila?.tornada_sem_efeito_por_id) {
        relatorio.ignoradas += 1;
        relatorio.itens.push({ apostilaId, refId, status: 'ignorada', motivo: 'apostila_tornada_sem_efeito' });
        continue;
      }

      const [original] = await base44.asServiceRole.entities.PublicacaoExOfficio.filter({ id: refId }, undefined, 1, 0);
      if (!original) {
        relatorio.falhas += 1;
        relatorio.itens.push({ apostilaId, refId, status: 'falha', motivo: 'original_nao_encontrada' });
        continue;
      }

      const jaMarcada = Boolean(original?.foi_apostilada) && String(original?.apostilada_por_id || '').trim() === apostilaId;
      if (jaMarcada) {
        relatorio.originaisJaCorretas += 1;
        relatorio.itens.push({ apostilaId, refId, status: 'ja_correta' });
        continue;
      }

      if (dryRun) {
        relatorio.originaisAtualizadas += 1;
        relatorio.itens.push({ apostilaId, refId, status: 'atualizaria' });
        continue;
      }

      try {
        await base44.asServiceRole.entities.PublicacaoExOfficio.updateById(refId, {
          foi_apostilada: true,
          apostilada_por_id: apostilaId,
        });
        relatorio.originaisAtualizadas += 1;
        relatorio.itens.push({ apostilaId, refId, status: 'atualizada' });
      } catch (error) {
        relatorio.falhas += 1;
        relatorio.itens.push({ apostilaId, refId, status: 'falha', motivo: error?.message || 'erro_desconhecido' });
      }
    }

    return Response.json({
      ok: true,
      mode: dryRun ? 'dry-run' : 'apply',
      confirmacaoExigida: CONFIRMACAO_EXECUCAO,
      relatorio,
    });
  } catch (error) {
    return Response.json({ error: error?.message || 'Falha no backfill de apostilas.' }, { status: 500 });
  }
});
