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

function linhaHistoricoSegura(raw: any = {}, index = 0) {
  const original = raw?.original || raw?.dados_originais || {};
  const transformado = raw?.transformado || raw?.dados_transformados || raw?.militar_transformado || {};
  return {
    linhaNumero: Number(raw?.linhaNumero || raw?.linha_numero || index + 1),
    status: limparTexto(raw?.status),
    nome: limparTexto(raw?.nome || transformado?.nome_completo || original?.nome_completo || original?.nome),
    matricula_atual: limparTexto(raw?.matricula_atual || transformado?.matricula_atual || transformado?.matricula),
    matricula_historica: limparTexto(raw?.matricula_historica || original?.matricula || original?.['matrícula'] || raw?.matricula),
    posto: limparTexto(raw?.posto || transformado?.posto_graduacao || original?.posto_graduacao || original?.posto || original?.['posto/graduação']),
    alertas: listaAuditoria(raw?.alertas || raw?.avisos),
    erros: listaAuditoria(raw?.erros || raw?.falhas),
    observacoes: listaAuditoria(raw?.observacoes || raw?.observacao || raw?.observacoes_importacao),
    pendencias_revisao: listaAuditoria(raw?.pendencias_revisao || raw?.revisar || raw?.pendencias),
    importada: Boolean(raw?.importada || raw?.foi_importada || raw?.importado || raw?.militar_id || raw?.id_criado),
    motivo_nao_importada: sanitizarMensagem(raw?.motivo_nao_importada),
  };
}

function relatorioHistoricoSeguro(rawJson: unknown) {
  let report: any = {};
  try {
    report = typeof rawJson === 'string' && rawJson.trim() ? JSON.parse(rawJson) : {};
  } catch {
    report = {};
  }
  const rawLines = Array.isArray(report?.linhas)
    ? report.linhas
    : Array.isArray(report?.analise?.linhas) ? report.analise.linhas
      : Array.isArray(report?.importacao?.linhas) ? report.importacao.linhas
        : [];
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

    return erro(400, 'Ação inválida para o histórico de importação.');
  } catch (error) {
    const status = Number(error?.status || error?.response?.status || 500);
    console.error('[importacaoMilitaresHistoricoGateway]', error?.message || error);
    return Response.json({ error: error?.message || 'Erro no histórico de importação de militares.' }, { status });
  }
});
