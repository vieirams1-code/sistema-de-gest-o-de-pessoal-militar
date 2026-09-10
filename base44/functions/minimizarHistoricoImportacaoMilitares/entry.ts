import { createClientFromRequest } from 'npm:@base44/sdk@0.8.39';

const FINAL_STATUSES = new Set(['Importado', 'Importado Parcial', 'Falhou']);
const MINIMAL_TYPE = 'AUDITORIA_MINIMA_V1';
const REPORT_VERSION = '2026.09.10-v1';

const text = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim();
const numberValue = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

function sanitizeAuditText(value: unknown) {
  return text(value)
    .replace(/\bCPF\s*[:#-]?\s*[\d.\/-]+/gi, 'CPF [suprimido]')
    .replace(/\bRG\s*[:#-]?\s*[\w.\/-]+/gi, 'RG [suprimido]')
    .replace(/\b(?:telefone|celular)\s*[:#-]?\s*[+()\d\s.-]+/gi, 'telefone [suprimido]')
    .replace(/\b(banco|ag[eê]ncia|conta)\s*[:#-]?\s*[\w.\/-]+/gi, '$1 [suprimido]');
}

function listText(value: unknown) {
  const values = Array.isArray(value) ? value : (text(value) ? [value] : []);
  return values.map((item) => sanitizeAuditText(item)).filter(Boolean);
}

const BLOCKED_KEYS = new Set([
  'cpf', 'rg', 'orgao_expedidor_rg', 'uf_rg', 'telefone', 'celular', 'email_particular',
  'email_funcional', 'banco', 'agencia', 'conta', 'logradouro', 'numero_endereco', 'cep',
  'bairro', 'cidade', 'uf', 'complemento', 'nome_pai', 'nome_mae', 'data_nascimento',
  'sexo', 'estado_civil', 'tipo_sanguineo', 'religiao', 'etnia', 'cnh_categoria',
  'cnh_validade', 'cnh_numero', 'altura', 'peso', 'naturalidade', 'naturalidade_uf',
  'original', 'dados_originais', 'dadosoriginais', 'transformado', 'dados_transformados',
  'dadostransformados', 'militar_transformado', 'militartransformado',
]);

function normalizedKey(key: unknown) {
  return text(key).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9_]/g, '');
}

function containsBlockedKey(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(containsBlockedKey);
  return Object.entries(value as Record<string, unknown>).some(([key, child]) =>
    BLOCKED_KEYS.has(normalizedKey(key)) || containsBlockedKey(child)
  );
}

function sanitizeObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeObject);
  if (!value || typeof value !== 'object') return typeof value === 'string' ? sanitizeAuditText(value) : value;
  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (BLOCKED_KEYS.has(normalizedKey(key))) continue;
    output[key] = sanitizeObject(child);
  }
  return output;
}

function findLines(report: any) {
  const candidates = [report?.linhas, report?.analise?.linhas, report?.importacao?.linhas, report?.itens, report?.rows];
  return candidates.find((item) => Array.isArray(item)) || [];
}

function findSummary(report: any, row: any, lines: any[]) {
  const source = report?.resumo || report?.analise?.resumo || {};
  return {
    total_linhas: numberValue(source?.total_linhas ?? row?.total_linhas, lines.length),
    total_aptas: numberValue(source?.total_aptas ?? row?.total_aptas, 0),
    total_aptas_com_alerta: numberValue(source?.total_aptas_com_alerta ?? row?.total_aptas_com_alerta, 0),
    total_duplicadas: numberValue(source?.total_duplicadas ?? row?.total_duplicadas, 0),
    total_erros: numberValue(source?.total_erros ?? row?.total_erros, 0),
  };
}

function minimalLine(line: any, index: number) {
  const original = line?.original || line?.dados_originais || {};
  const transformed = line?.transformado || line?.dados_transformados || line?.militar_transformado || {};
  return {
    linhaNumero: numberValue(line?.linhaNumero ?? line?.linha_numero, index + 1),
    status: text(line?.status),
    nome: text(transformed?.nome_completo || original?.nome_completo || original?.nome || line?.nome),
    matricula_atual: text(transformed?.matricula_atual || transformed?.matricula || line?.matricula_atual || line?.matricula),
    matricula_historica: text(original?.matricula || original?.['matrícula'] || line?.matricula_historica),
    posto: text(transformed?.posto_graduacao || original?.posto_graduacao || original?.posto || original?.['posto/graduação'] || line?.posto),
    alertas: listText(line?.alertas || line?.avisos),
    erros: listText(line?.erros || line?.falhas),
    observacoes: listText(line?.observacoes || line?.observacao || line?.observacoes_importacao),
    pendencias_revisao: listText(line?.pendencias_revisao || line?.revisar || line?.pendencias),
    correcao_pre_importacao: line?.correcao_pre_importacao ? sanitizeObject({
      campos_alterados: Array.isArray(line.correcao_pre_importacao.campos_alterados) ? line.correcao_pre_importacao.campos_alterados : [],
      corrigido_por: text(line.correcao_pre_importacao.corrigido_por),
      corrigido_em: text(line.correcao_pre_importacao.corrigido_em),
    }) : null,
    importada: Boolean(line?.importada || line?.foi_importada || line?.importado || line?.militar_id || line?.id_criado),
    militar_id: text(line?.militar_id || transformed?.militar_id),
    id_criado: text(line?.id_criado),
    motivo_nao_importada: sanitizeAuditText(line?.motivo_nao_importada || line?.motivo),
  };
}

function buildMinimalReport(row: any, report: any) {
  const lines = findLines(report);
  const file = report?.arquivo || report?.analise?.arquivo || {};
  const importData = report?.importacao || {};
  const minimal = {
    tipo_relatorio: MINIMAL_TYPE,
    versao_relatorio: REPORT_VERSION,
    permite_retomada: false,
    minimizado_em: new Date().toISOString(),
    arquivo: {
      nome: text(file?.nome || row?.nome_arquivo),
      tipo: text(file?.tipo || row?.tipo_arquivo),
      hash: text(file?.hash || row?.hash_arquivo),
      data_importacao: text(file?.data_importacao || row?.data_importacao || row?.created_date),
    },
    resumo: findSummary(report, row, lines),
    linhas: lines.map(minimalLine),
    importacao: {
      incluirAlertas: Boolean(importData?.incluirAlertas ?? row?.importar_linhas_com_alerta),
      total_importadas: numberValue(importData?.total_importadas ?? row?.total_importadas, 0),
      total_nao_importadas: numberValue(importData?.total_nao_importadas ?? row?.total_nao_importadas, 0),
      nao_importadas: Array.isArray(importData?.nao_importadas)
        ? importData.nao_importadas.map((item: any) => ({
            linhaNumero: numberValue(item?.linhaNumero, 0),
            motivo: sanitizeAuditText(item?.motivo),
          }))
        : [],
      ids_criados: Array.isArray(importData?.ids_criados) ? importData.ids_criados.map(text).filter(Boolean) : [],
    },
  };
  return sanitizeObject(minimal) as Record<string, unknown>;
}

Deno.serve(async (req: Request) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Usuário não autenticado.' }, { status: 401 });
    if (String(user?.role || '').trim().toLowerCase() !== 'admin') {
      return Response.json({ error: 'Acesso restrito a administrador da plataforma.' }, { status: 403 });
    }

    const payload = await req.json().catch(() => ({}));
    const dryRun = payload?.dryRun !== false;
    const rows = await base44.asServiceRole.entities.ImportacaoMilitares.list('-created_date', 500, 0);
    const counters = {
      dryRun,
      scanned: Array.isArray(rows) ? rows.length : 0,
      final: 0,
      activeSkipped: 0,
      alreadyMinimal: 0,
      legacyCandidates: 0,
      minimized: 0,
      invalidJson: 0,
      blockedKeyAfterMinimize: 0,
      failures: 0,
    };

    for (const row of (rows || [])) {
      const status = text(row?.status_importacao);
      if (!FINAL_STATUSES.has(status)) {
        counters.activeSkipped += 1;
        continue;
      }
      counters.final += 1;

      let report: any = {};
      try {
        report = row?.relatorio_json ? JSON.parse(row.relatorio_json) : {};
      } catch {
        counters.invalidJson += 1;
        continue;
      }

      if (report?.tipo_relatorio === MINIMAL_TYPE && report?.permite_retomada === false && !containsBlockedKey(report)) {
        counters.alreadyMinimal += 1;
        continue;
      }

      counters.legacyCandidates += 1;
      const minimal = buildMinimalReport(row, report);
      if (containsBlockedKey(minimal)) {
        counters.blockedKeyAfterMinimize += 1;
        continue;
      }

      if (!dryRun) {
        try {
          const marker = 'Snapshot de importação minimizado para auditoria sem duplicação de dados pessoais.';
          const oldNotes = text(row?.observacoes);
          await base44.asServiceRole.entities.ImportacaoMilitares.update(row.id, {
            relatorio_json: JSON.stringify(minimal),
            observacoes: oldNotes.includes(marker) ? oldNotes : [oldNotes, marker].filter(Boolean).join('\n'),
          });
          counters.minimized += 1;
        } catch {
          counters.failures += 1;
        }
      }
    }

    return Response.json({ ok: true, ...counters });
  } catch (error) {
    return Response.json({ error: error?.message || 'Falha ao minimizar históricos de importação.' }, { status: 500 });
  }
});
