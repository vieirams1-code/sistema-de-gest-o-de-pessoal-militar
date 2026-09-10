import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ENTITY = 'ImportacaoMilitares';

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
  const motivoNaoImportada = limparTexto(options?.naoImportadasPorLinha?.get?.(linhaNumero) || raw?.motivo_nao_importada);
  const incluirAlertas = options?.incluirAlertas === true;
  const elegivel = raw?.status === 'APTO' || (incluirAlertas && raw?.status === 'APTO_COM_ALERTA');
  const correcao = raw?.correcao_pre_importacao;
  return {
    formato_linha: 'AUDITORIA_MINIMA_V1',
    minimizado: true,
    linhaNumero,
    status: limparTexto(raw?.status),
    nome: limparTexto(raw?.nome || transformado?.nome_completo || original?.nome_completo || original?.nome),
    matricula_atual: limparTexto(raw?.matricula_atual || transformado?.matricula_atual || transformado?.matricula),
    matricula_historica: limparTexto(raw?.matricula_historica || original?.matricula || original?.['matrícula'] || raw?.matricula),
    posto: limparTexto(raw?.posto || transformado?.posto_graduacao || original?.posto_graduacao || original?.posto || original?.['posto/graduação']),
    alertas: listaAuditoria(raw?.alertas || raw?.avisos),
    erros: listaAuditoria(raw?.erros || raw?.falhas),
    observacoes: listaAuditoria(raw?.observacoes || raw?.observacao || raw?.observacoes_importacao),
    pendencias_revisao: listaAuditoria(raw?.pendencias_revisao || raw?.revisar || raw?.pendencias),
    correcao_pre_importacao: correcao ? {
      campos_alterados: Array.isArray(correcao?.campos_alterados)
        ? correcao.campos_alterados.map(limparTexto).filter(Boolean)
        : [],
      corrigido_por: limparTexto(correcao?.corrigido_por),
      corrigido_em: limparTexto(correcao?.corrigido_em),
    } : null,
    importada: motivoNaoImportada
      ? false
      : (elegivel || Boolean(raw?.importada || raw?.foi_importada || raw?.importado || raw?.militar_id || raw?.id_criado)),
    motivo_nao_importada: sanitizarMensagem(motivoNaoImportada),
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
  if (report?.tipo_relatorio === 'AUDITORIA_MINIMA_V1' || report?.permite_retomada === false) return null;

  const naoImportadas = Array.isArray(report?.importacao?.nao_importadas) ? report.importacao.nao_importadas : [];
  const naoImportadasPorLinha = new Map(
    naoImportadas.map((item: any) => [Number(item?.linhaNumero || 0), sanitizarMensagem(item?.motivo)]),
  );
  const incluirAlertas = report?.importacao?.incluirAlertas === true || row?.importar_linhas_com_alerta === true;
  const rawLines = linhasRelatorio(report);

  return JSON.stringify({
    tipo_relatorio: 'AUDITORIA_MINIMA_V1',
    versao_relatorio: '2026.09.09-v1',
    permite_retomada: false,
    minimizado_em: new Date().toISOString(),
    arquivo: {
      nome: limparTexto(report?.arquivo?.nome || row?.nome_arquivo),
      tipo: limparTexto(report?.arquivo?.tipo || row?.tipo_arquivo),
      hash: limparTexto(report?.arquivo?.hash || row?.hash_arquivo),
      data_importacao: limparTexto(report?.arquivo?.data_importacao || row?.data_importacao),
    },
    resumo: report?.resumo && typeof report.resumo === 'object' ? report.resumo : {
      total_linhas: Number(row?.total_linhas || rawLines.length || 0),
      total_aptas: Number(row?.total_aptas || 0),
      total_aptas_com_alerta: Number(row?.total_aptas_com_alerta || 0),
      total_duplicadas: Number(row?.total_duplicadas || 0),
      total_erros: Number(row?.total_erros || 0),
    },
    linhas: rawLines.map((line: any, index: number) => linhaHistoricoSegura(line, index, {
      incluirAlertas,
      naoImportadasPorLinha,
    })),
    importacao: {
      incluirAlertas,
      total_importadas: Number(report?.importacao?.total_importadas ?? row?.total_importadas ?? 0),
      total_nao_importadas: Number(report?.importacao?.total_nao_importadas ?? row?.total_nao_importadas ?? 0),
      nao_importadas: naoImportadas.map((item: any) => ({
        linhaNumero: Number(item?.linhaNumero || 0),
        motivo: sanitizarMensagem(item?.motivo),
      })),
      ids_criados: (Array.isArray(report?.importacao?.ids_criados) ? report.importacao.ids_criados : [])
        .map(limparTexto)
        .filter(Boolean),
    },
  });
}

function relatorioHistoricoSeguro(rawJson: unknown) {
  const report: any = parseRelatorio(rawJson);
  const rawLines = linhasRelatorio(report);
  return JSON.stringify({
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
      const finalStatuses = new Set(['Importado', 'Importado Parcial', 'Falhou']);
      const rowsSeguros = [];
      let snapshotsMigrados = 0;

      for (const row of rows || []) {
        let rowEfetivo = row;
        if (authz?.isAdmin === true && finalStatuses.has(limparTexto(row?.status_importacao))) {
          const minimal = relatorioAuditoriaMinimaPersistente(row);
          if (minimal) {
            await base44.asServiceRole.entities[ENTITY].update(row.id, { relatorio_json: minimal });
            rowEfetivo = { ...row, relatorio_json: minimal };
            snapshotsMigrados += 1;
          }
        }
        rowsSeguros.push(projetarHistorico(rowEfetivo));
      }

      return Response.json({
        result: rowsSeguros,
        meta: { snapshotsMigrados },
      });
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
      const finalStatuses = new Set(['Importado', 'Importado Parcial', 'Falhou']);
      const rows = await base44.asServiceRole.entities[ENTITY].list('-created_date', 1000);
      const candidates = (rows || []).filter((row: any) => finalStatuses.has(limparTexto(row?.status_importacao)));
      let migrated = 0;
      let alreadyMinimal = 0;
      let failed = 0;

      for (const row of candidates) {
        try {
          const minimal = relatorioAuditoriaMinimaPersistente(row);
          if (!minimal) {
            alreadyMinimal += 1;
            continue;
          }
          await base44.asServiceRole.entities[ENTITY].update(row.id, { relatorio_json: minimal });
          migrated += 1;
        } catch (migrationError) {
          failed += 1;
          console.error('[importacaoMilitaresHistoricoGateway] falha ao minimizar lote', row?.id, migrationError?.message || migrationError);
        }
      }

      return Response.json({
        result: {
          examined: candidates.length,
          migrated,
          alreadyMinimal,
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
