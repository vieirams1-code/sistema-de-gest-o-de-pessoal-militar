import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const CHUNK_SIZE = 200;
const SENSITIVE_REDACTED = 'Restrito';

function text(value) {
  const raw = value === null || value === undefined ? '' : String(value);
  return raw.trim();
}

function firstText(...values) {
  for (const value of values) {
    const normalized = text(value);
    if (normalized) return normalized;
  }
  return '';
}

function escapePdfText(value) {
  return text(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function wrapText(value, maxChars = 92) {
  const normalized = text(value).replace(/\s+/g, ' ') || '-';
  const words = normalized.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word.length > maxChars ? word.slice(0, maxChars) : word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : ['-'];
}

function formatDateBr(value) {
  const raw = text(value);
  if (!raw) return '-';
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  return raw;
}

function pdfDate() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(now.getUTCDate())}/${pad(now.getUTCMonth() + 1)}/${now.getUTCFullYear()} ${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())} UTC`;
}

function uint8ToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.slice(i, i + chunk));
  }
  return btoa(binary);
}

function buildPdf(lines) {
  const encoder = new TextEncoder();
  const objects = [];
  const pages = [];
  const pageHeight = 842;
  const startY = 800;
  const minY = 46;
  const lineHeight = 13;
  let current = [];
  let y = startY;

  const flushPage = () => {
    if (!current.length) return;
    const contentStream = [
      'BT',
      '/F1 10 Tf',
      '50 800 Td',
      '14 TL',
      ...current.map((line, index) => `${index === 0 ? '' : 'T* '}(${escapePdfText(line)}) Tj`),
      'ET',
    ].join('\n');
    const contentId = objects.length + 4;
    objects.push(`<< /Length ${encoder.encode(contentStream).length} >>\nstream\n${contentStream}\nendstream`);
    const pageId = objects.length + 4;
    pages.push(pageId);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 ${pageHeight}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`);
    current = [];
    y = startY;
  };

  for (const line of lines) {
    if (y < minY) flushPage();
    current.push(line);
    y -= lineHeight;
  }
  flushPage();

  const catalog = '<< /Type /Catalog /Pages 2 0 R >>';
  const pagesObject = `<< /Type /Pages /Kids [${pages.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`;
  const fontObject = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  const allObjects = [catalog, pagesObject, fontObject, ...objects];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  allObjects.forEach((obj, index) => {
    offsets.push(encoder.encode(pdf).length);
    pdf += `${index + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xrefOffset = encoder.encode(pdf).length;
  pdf += `xref\n0 ${allObjects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${allObjects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return encoder.encode(pdf);
}

async function loadMilitaresMap(base44, atestados) {
  const ids = Array.from(new Set(atestados.map((a) => text(a?.militar_id)).filter(Boolean)));
  const map = new Map();
  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    const chunk = ids.slice(i, i + CHUNK_SIZE);
    const rows = await base44.asServiceRole.entities.Militar.filter({ id: { $in: chunk } }, undefined, CHUNK_SIZE, 0);
    (rows || []).forEach((militar) => {
      const id = text(militar?.id);
      if (id) map.set(id, militar);
    });
  }
  return map;
}

function buildReportLines(atestados, militaresMap, podeVerSensivel) {
  const lines = [
    'RELATORIO DP/DINTEL - ATESTADOS MEDICOS',
    `Gerado em: ${pdfDate()}`,
    'Modo: sem historico',
    `Registros: ${atestados.length}`,
    '',
  ];

  atestados.forEach((atestado, index) => {
    const militar = militaresMap.get(text(atestado?.militar_id)) || {};
    const postoGraduacao = firstText(atestado?.posto_graduacao, atestado?.militar_posto_graduacao, atestado?.militar_posto, militar?.posto_graduacao, militar?.posto_grad);
    const nomeCompleto = firstText(atestado?.militar_nome_completo, atestado?.nome_completo, atestado?.militar_nome, militar?.nome_completo, militar?.nome);
    const nomeGuerra = firstText(atestado?.nome_guerra, atestado?.militar_nome_guerra, militar?.nome_guerra);
    const matricula = firstText(atestado?.matricula, atestado?.militar_matricula, militar?.matricula);
    const medico = podeVerSensivel ? firstText(atestado?.medico, atestado?.nome_medico, atestado?.profissional_saude) : SENSITIVE_REDACTED;
    const crm = podeVerSensivel ? firstText(atestado?.crm_medico, atestado?.crm, atestado?.medico_crm) : SENSITIVE_REDACTED;
    const cid = podeVerSensivel ? firstText(atestado?.cid_10, atestado?.cid, atestado?.cid_descricao) : SENSITIVE_REDACTED;
    const dias = firstText(atestado?.dias, atestado?.dias_afastamento, atestado?.quantidade_dias);
    const tipoAfastamento = firstText(atestado?.tipo_afastamento, atestado?.tipo, atestado?.natureza_afastamento);

    lines.push(`${index + 1}. ${postoGraduacao || '-'} ${nomeCompleto || '-'}`.trim());
    wrapText(`Nome de guerra: ${nomeGuerra || '-'} | Matricula: ${matricula || '-'} | Inicio: ${formatDateBr(atestado?.data_inicio)}`, 96).forEach((line) => lines.push(line));
    wrapText(`Medico/CRM: ${medico || '-'} / ${crm || '-'} | Dias: ${dias || '-'} | CID: ${cid || '-'}`, 96).forEach((line) => lines.push(line));
    wrapText(`Tipo de afastamento: ${tipoAfastamento || '-'}`, 96).forEach((line) => lines.push(line));
    lines.push('');
  });

  return lines;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const authUser = await base44.auth.me();
    if (!authUser) return Response.json({ error: 'Não autenticado.' }, { status: 401 });

    let payload = {};
    try { payload = await req.json(); } catch (_e) { payload = {}; }

    const incluirHistorico = Boolean(payload?.incluirHistorico);
    if (incluirHistorico) {
      return Response.json({ error: 'Relatório com histórico ainda não está disponível neste lote.', code: 'HISTORICO_INDISPONIVEL' }, { status: 400 });
    }

    const permissionsResponse = await base44.functions.invoke('getUserPermissions', payload);
    const permissions = permissionsResponse?.data ?? permissionsResponse ?? {};
    const actions = (permissions?.actions && typeof permissions.actions === 'object') ? permissions.actions : {};
    const isAdmin = Boolean(permissions?.isAdmin);
    const podeGerarRelatorio = Boolean(isAdmin || actions?.gerar_relatorio_dp_dintel_atestados);
    if (!podeGerarRelatorio) {
      return Response.json({ error: 'Permissão perm_gerar_relatorio_dp_dintel_atestados é obrigatória.', code: 'FORBIDDEN_REPORT_PERMISSION' }, { status: 403 });
    }

    const podeVerSensivel = Boolean(isAdmin || actions?.ver_dados_sensiveis_atestado);
    const idsSelecionados = Array.isArray(payload?.idsSelecionados) ? payload.idsSelecionados.map((id) => String(id)).filter(Boolean) : [];

    const scopedResponse = await base44.functions.invoke('getScopedAtestadosBundle', payload);
    const scopedData = scopedResponse?.data ?? scopedResponse ?? {};
    const scopedAtestados = Array.isArray(scopedData?.atestados) ? scopedData.atestados : [];
    const scopedIdSet = new Set(scopedAtestados.map((a) => text(a?.id)).filter(Boolean));
    const selectedIdSet = new Set(idsSelecionados.filter((id) => scopedIdSet.has(id)));
    const shouldUseAllScoped = idsSelecionados.length === 0;
    const atestados = scopedAtestados.filter((atestado) => shouldUseAllScoped || selectedIdSet.has(text(atestado?.id)));

    const militaresMap = await loadMilitaresMap(base44, atestados);
    const pdfBytes = buildPdf(buildReportLines(atestados, militaresMap, podeVerSensivel));
    const fileName = `relatorio-dp-dintel-atestados-sem-historico-${new Date().toISOString().slice(0, 10)}.pdf`;

    return Response.json({
      formato: 'pdf',
      fileName,
      mimeType: 'application/pdf',
      base64: uint8ToBase64(pdfBytes),
      meta: {
        totalNoEscopo: scopedAtestados.length,
        totalSelecionado: atestados.length,
        incluirHistorico: false,
        sensiveis_incluidos: podeVerSensivel,
        sensiveis_bloqueados: !podeVerSensivel,
        extrato_parcial: shouldUseAllScoped ? false : atestados.length < scopedAtestados.length,
      },
    });
  } catch (error) {
    const status = error?.response?.status || error?.status || 500;
    const detail = error?.response?.data?.detail || error?.response?.data?.message || error?.response?.data?.error;
    const baseMessage = error?.message || 'Erro ao gerar relatório DP/DINTEL de atestados.';
    const message = status === 429
      ? 'Limite de requisições excedido ao gerar o relatório. Tente novamente em instantes.'
      : (detail ? `${baseMessage} (${detail})` : baseMessage);
    return Response.json({ error: message, code: status === 429 ? 'RATE_LIMITED' : 'REPORT_FAILED', meta: { status, detail: detail || null } }, { status });
  }
});