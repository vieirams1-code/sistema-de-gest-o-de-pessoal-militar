import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ENTITY = 'ImportacaoMilitares';
const STATUS_TERMINAIS_IMPORTACAO = new Set([
  'Importado', 'Importado Parcial', 'Falhou', 'Concluído', 'Concluido', 'Cancelado', 'Cancelada',
]);

const WRITE_FIELDS = new Set([
  'nome_arquivo', 'tipo_arquivo', 'hash_arquivo', 'data_importacao',
  'importado_por', 'importado_por_nome', 'total_linhas', 'total_aptas',
  'total_aptas_com_alerta', 'total_revisar', 'total_ignoradas', 'total_duplicadas',
  'total_erros', 'total_importadas', 'total_nao_importadas', 'status_importacao',
  'importar_linhas_com_alerta', 'versao_regra_migracao', 'relatorio_json',
  'observacoes', 'oculto_no_historico',
]);

function erro(status: number, message: string) {
  return Response.json({ error: message }, { status });
}

async function getAuthz(base44: any) {
  const response = await base44.functions.invoke('getUserPermissions', {});
  const body = response?.data ?? response ?? {};
  if (body?.error) throw Object.assign(new Error(body.error), { status: 403 });
  return body;
}

function temModulo(authz: any) {
  return authz?.isAdmin === true || authz?.modules?.migracao_militares === true;
}

function temAcao(authz: any, action: string) {
  return authz?.isAdmin === true || authz?.actions?.[action] === true;
}

function exigir(authz: any, action: string) {
  if (!temModulo(authz) || !temAcao(authz, action)) {
    throw Object.assign(new Error(`Permissão necessária: migracao_militares + ${action}.`), { status: 403 });
  }
}

function exigirExclusao(authz: any) {
  if (authz?.isAdmin === true) return;
  if (!temModulo(authz) || !temAcao(authz, 'ver_historico_importacoes') || !temAcao(authz, 'importar_militares')) {
    throw Object.assign(new Error('Permissões necessárias para excluir histórico: ver_historico_importacoes + importar_militares.'), { status: 403 });
  }
}

function limparTexto(value: unknown) {
  return String(value ?? '').trim();
}

function isStatusTerminalImportacao(status: unknown) {
  return STATUS_TERMINAIS_IMPORTACAO.has(limparTexto(status));
}

function listaSegura(value: unknown) {
  if (Array.isArray(value)) return value.map(limparTexto).filter(Boolean);
  const text = limparTexto(value);
  return text ? [text] : [];
}

function sanitizarMensagem(value: unknown) {
  return limparTexto(value)
    .replace(/\bCPF\s*[:#-]?\s*[\d.\/-]+/gi, 'CPF [suprimido]')
    .replace(/\bRG\s*[:#-]?\s*[\w.\/-]+/gi, 'RG [suprimido]')
    .replace(/\b(?:telefone|celular)\s*[:#-]?\s*[+()\d\s.-]+/gi, 'telefone [suprimido]')
    .replace(/\b(banco|ag[eê]ncia|conta)\s*[:#-]?\s*[\w.\/-]+/gi, '$1 [suprimido]');
}

function listaAuditoria(value: unknown) {
  return listaSegura(value).map(sanitizarMensagem);
}

function linhaHistoricoSegura(raw: any = {}, index = 0, options: any = {}) {
  const original = raw?.original || raw?.dados_originais || {};
  const transformado = raw?.transformado || raw?.dados_transformados || raw?.militar_transformado || {};
  const linhaNumero = Number(raw?.linhaNumero || raw?.linha_numero || index + 1);
  const motivoNaoImportada = limparTexto(options?.naoImportadasPorLinha?.get?.(linhaNumero) || raw?.motivo_nao_importacao || raw?.motivo_nao_importada);
  const incluirAlertas = options?.incluirAlertas === true;
  const elegivel = raw?.status === 'APTO' || (incluirAlertas && raw?.status === 'APTO_COM_ALERTA');
  const correcao = raw?.correcoes_manuais || raw?.correcao_pre_importacao;
  return {
    linhaNumero,
    status: limparTexto(raw?.status),
    nome: limparTexto(raw?.nome || transformado?.nome_completo || original?.nome_completo || original?.nome),
    matricula_historica: limparTexto(raw?.matricula_historica || original?.matricula || original?.['matrícula'] || raw?.matricula),
    matricula_atual: limparTexto(raw?.matricula_atual || transformado?.matricula_atual || transformado?.matricula),
    posto_graduacao: limparTexto(raw?.posto_graduacao || raw?.posto || transformado?.posto_graduacao || original?.posto_graduacao || original?.posto || original?.['posto/graduação']),
    importada: motivoNaoImportada
      ? false
      : (elegivel || Boolean(raw?.importada || raw?.foi_importada || raw?.importado || raw?.militar_id || raw?.id_criado)),
    militar_id: limparTexto(raw?.militar_id || raw?.id_criado),
    alertas: listaAuditoria(raw?.alertas || raw?.avisos),
    erros: listaAuditoria(raw?.erros || raw?.falhas),
    pendencias_revisao: listaAuditoria(raw?.pendencias_revisao || raw?.revisar || raw?.pendencias),
    ajustes_automaticos: listaAuditoria(raw?.ajustes_automaticos || raw?.ajustesAutomaticos),
    correcoes_manuais: correcao ? {
      campos_alterados: Array.isArray(correcao?.campos_alterados)
        ? correcao.campos_alterados.map(limparTexto).filter(Boolean)
        : [],
      data: limparTexto(correcao?.data || correcao?.corrigido_em),
    } : null,
    motivo_nao_importacao: sanitizarMensagem(motivoNaoImportada),
  };
}

function parseRelatorio(rawJson: unknown) {
  try {
    return typeof rawJson === 'string' && rawJson.trim() ? JSON.parse(rawJson) : {};
  } catch {
    return {};
  }
}

function linhasRelatorio(report: any) {
  return Array.isArray(report?.linhas)
    ? report.linhas
    : Array.isArray(report?.analise?.linhas) ? report.analise.linhas
      : Array.isArray(report?.importacao?.linhas) ? report.importacao.linhas
        : [];
}

function relatorioAuditoriaMinimaPersistente(row: any) {
  const report = parseRelatorio(row?.relatorio_json);
  if (
    report?.tipo_snapshot === 'HISTORICO_MINIMO'
    || report?.tipo_relatorio === 'AUDITORIA_MINIMA_V1'
    || report?.permite_retomada === false
  ) return null;

  const naoImportadas = Array.isArray(report?.importacao?.nao_importadas) ? report.importacao.nao_importadas : [];
  const naoImportadasPorLinha = new Map(
    naoImportadas.map((item: any) => [Number(item?.linhaNumero || 0), sanitizarMensagem(item?.motivo)]),
  );
  const incluirAlertas = report?.incluirAlertas === true
    || report?.importacao?.incluirAlertas === true
    || row?.importar_linhas_com_alerta === true;
  const rawLines = linhasRelatorio(report);
  const idsCriados = (
    Array.isArray(report?.ids_militares_criados) ? report.ids_militares_criados
      : Array.isArray(report?.importacao?.ids_criados) ? report.importacao.ids_criados
        : []
  ).map(limparTexto).filter(Boolean);

  return JSON.stringify({
    tipo_snapshot: 'HISTORICO_MINIMO',
    versao_snapshot: 1,
    tipo_relatorio: 'AUDITORIA_MINIMA_V1',
    permite_retomada: false,
    arquivo: {
      nome: limparTexto(report?.arquivo?.nome || row?.nome_arquivo),
      tipo: limparTexto(report?.arquivo?.tipo || row?.tipo_arquivo),
      hash: limparTexto(report?.arquivo?.hash || row?.hash_arquivo),
    },
    data_importacao: limparTexto(report?.data_importacao || report?.arquivo?.data_importacao || row?.data_importacao),
    versao_regra_migracao: limparTexto(report?.versao_regra_migracao || row?.versao_regra_migracao),
    resumo: {
      total_linhas: Number(report?.resumo?.total_linhas ?? row?.total_linhas ?? rawLines.length ?? 0),
      total_aptas: Number(report?.resumo?.total_aptas ?? row?.total_aptas ?? 0),
      total_aptas_com_alerta: Number(report?.resumo?.total_aptas_com_alerta ?? row?.total_aptas_com_alerta ?? 0),
      total_revisar: Number(report?.resumo?.total_revisar ?? row?.total_revisar ?? 0),
      total_ignoradas: Number(report?.resumo?.total_ignoradas ?? report?.resumo?.total_duplicadas ?? row?.total_ignoradas ?? row?.total_duplicadas ?? 0),
      total_erros: Number(report?.resumo?.total_erros ?? row?.total_erros ?? 0),
    },
    status_final: limparTexto(row?.status_importacao),
    total_linhas: Number(row?.total_linhas ?? report?.resumo?.total_linhas ?? rawLines.length ?? 0),
    total_importadas: Number(row?.total_importadas ?? report?.importacao?.total_importadas ?? 0),
    total_nao_importadas: Number(row?.total_nao_importadas ?? report?.importacao?.total_nao_importadas ?? 0),
    incluirAlertas,
    ids_militares_criados: idsCriados,
    data_finalizacao: limparTexto(row?.updated_date || row?.data_importacao),
    usuario_executor: limparTexto(row?.importado_por || row?.importado_por_nome),
    avisos_operacionais: listaAuditoria(report?.avisos_operacionais),
    erros_operacionais: listaAuditoria(report?.erros_operacionais || report?.falha_importacao),
    linhas: rawLines.map((line: any, index: number) => linhaHistoricoSegura(line, index, {
      incluirAlertas,
      naoImportadasPorLinha,
    })),
  });
}

function relatorioHistoricoSeguro(rawJson: unknown) {
  const report: any = parseRelatorio(rawJson);
  const rawLines = linhasRelatorio(report);
  return JSON.stringify({
    tipo_snapshot: limparTexto(report?.tipo_snapshot),
    versao_snapshot: Number(report?.versao_snapshot || 0) || undefined,
    tipo_relatorio: limparTexto(report?.tipo_relatorio),
    versao_relatorio: limparTexto(report?.versao_relatorio),
    permite_retomada: report?.permite_retomada !== false,
    arquivo: {
      nome: limparTexto(report?.arquivo?.nome),
      tipo: limparTexto(report?.arquivo?.tipo),
      hash: limparTexto(report?.arquivo?.hash),
      data_importacao: limparTexto(report?.arquivo?.data_importacao),
      lote: limparTexto(report?.arquivo?.lote),
    },
    resumo: report?.resumo && typeof report.resumo === 'object' ? report.resumo : {},
    linhas: rawLines.map(linhaHistoricoSegura),
    importacao: report?.importacao ? {
      incluirAlertas: report.importacao?.incluirAlertas === true,
      total_importadas: Number(report.importacao?.total_importadas || 0),
      total_nao_importadas: Number(report.importacao?.total_nao_importadas || 0),
      nao_importadas: (Array.isArray(report.importacao?.nao_importadas) ? report.importacao.nao_importadas : []).map((item: any) => ({
        linhaNumero: Number(item?.linhaNumero || 0),
        motivo: sanitizarMensagem(item?.motivo),
      })),
    } : undefined,
  });
}

function projetarHistorico(row: any) {
  if (!row) return null;
  return {
    ...row,
    relatorio_json: relatorioHistoricoSeguro(row?.relatorio_json),
  };
}

function sanitizeWrite(data: any = {}) {
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(data || {})) {
    if (WRITE_FIELDS.has(key)) out[key] = value;
  }
  return out;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    if (!await base44.auth.me()) return erro(401, 'Não autenticado.');
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || '').trim().toUpperCase();
    const payload = body?.payload || {};
    const authz = await getAuthz(base44);

    if (action === 'LIST_HISTORY') {
      exigir(authz, 'ver_historico_importacoes');
      const rows = await base44.asServiceRole.entities[ENTITY].list('-created_date', 1000);
      return Response.json({ result: (rows || []).map(projetarHistorico) });
    }

    if (action === 'GET_ANALYSIS') {
      exigir(authz, 'importar_militares');
      const id = limparTexto(payload?.id);
      if (!id) return erro(400, 'ID do histórico é obrigatório.');
      const row = await base44.asServiceRole.entities[ENTITY].get(id);
      return Response.json({ result: row || null });
    }

    if (action === 'CREATE') {
      exigir(authz, 'importar_militares');
      const created = await base44.asServiceRole.entities[ENTITY].create(sanitizeWrite(payload?.data));
      return Response.json({ result: created });
    }

    if (action === 'UPDATE') {
      exigir(authz, 'importar_militares');
      const id = limparTexto(payload?.id);
      if (!id) return erro(400, 'ID do histórico é obrigatório.');
      const current = await base44.asServiceRole.entities[ENTITY].get(id);
      if (isStatusTerminalImportacao(current?.status_importacao)) {
        return erro(409, 'Este lote já foi finalizado e não aceita alteração do snapshot de trabalho.');
      }
      const updated = await base44.asServiceRole.entities[ENTITY].update(id, sanitizeWrite(payload?.data));
      return Response.json({ result: updated });
    }

    if (action === 'DELETE') {
      exigirExclusao(authz);
      const id = limparTexto(payload?.id);
      if (!id) return erro(400, 'ID do histórico é obrigatório.');
      const result = await base44.asServiceRole.entities[ENTITY].delete(id);
      return Response.json({ result: result ?? { id } });
    }

    if (action === 'MIGRATE_FINALIZED_SNAPSHOTS') {
      if (authz?.isAdmin !== true) {
        throw Object.assign(new Error('A migração de snapshots históricos é restrita a administrador.'), { status: 403 });
      }
      const executar = payload?.executar === true;
      const rows = await base44.asServiceRole.entities[ENTITY].list('-created_date', 1000);
      const terminalRows = (rows || []).filter((row: any) => isStatusTerminalImportacao(row?.status_importacao));
      const candidates = terminalRows
        .map((row: any) => ({ row, minimal: relatorioAuditoriaMinimaPersistente(row) }))
        .filter((item: any) => Boolean(item.minimal));
      let migrated = 0;
      let failed = 0;

      if (executar) {
        for (const { row, minimal } of candidates) {
          try {
            await base44.asServiceRole.entities[ENTITY].update(row.id, { relatorio_json: minimal });
            migrated += 1;
          } catch (migrationError) {
            failed += 1;
            console.error('[importacaoMilitaresHistoricoGateway] falha ao minimizar lote', row?.id, migrationError?.message || migrationError);
          }
        }
      }

      return Response.json({
        result: {
          dryRun: !executar,
          examined: terminalRows.length,
          candidates: candidates.length,
          migrated,
          alreadyMinimal: terminalRows.length - candidates.length,
          failed,
        },
      });
    }

    return erro(400, 'Ação inválida para o histórico de importação.');
  } catch (error) {
    const status = Number(error?.status || error?.response?.status || 500);
    console.error('[importacaoMilitaresHistoricoGateway]', error?.message || error);
    return Response.json({ error: error?.message || 'Erro no histórico de importação de militares.' }, { status });
  }
});
