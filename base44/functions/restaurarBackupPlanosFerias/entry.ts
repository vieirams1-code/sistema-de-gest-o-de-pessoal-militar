import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { unzipSync, strFromU8 } from 'npm:fflate@0.8.3';

const ENTITIES = [
  'PlanoFeriasInstitucional',
  'CampanhaPortal',
  'OpcaoFeriasMilitar',
  'RespostaCampanhaPersonalizada',
  'PermissaoPlanoFerias',
  'MembroGrupoEfetivo',
  'GrupoEfetivo',
  'AuditoriaFerias',
  'Ferias',
  'PeriodoAquisitivo',
  'Militar',
];

const idOf = (value: any) => String(value ?? '').trim();

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function jsonResponse(body: any, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

Deno.serve(async (req: Request) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || String(user.role || '').toLowerCase() !== 'admin') {
      return jsonResponse({ error: 'Acesso restrito a administradores.' }, 403);
    }

    const payload = await req.json().catch(() => ({}));
    const modo = payload?.modo === 'CONFIRMAR' ? 'CONFIRMAR' : 'SIMULAR';
    const arquivoUrl = String(payload?.arquivo_url || '').trim();
    if (!arquivoUrl) return jsonResponse({ error: 'Arquivo de backup não informado.' }, 400);

    const resposta = await fetch(arquivoUrl);
    if (!resposta.ok) return jsonResponse({ error: 'Não foi possível ler o arquivo de backup enviado.' }, 400);
    const bytes = new Uint8Array(await resposta.arrayBuffer());
    const entries = unzipSync(bytes);
    const manifestoBytes = entries['manifesto.json'];
    if (!manifestoBytes) return jsonResponse({ error: 'ZIP inválido: manifesto.json não encontrado.' }, 400);

    const manifesto = JSON.parse(strFromU8(manifestoBytes));
    if (manifesto?.tipo_backup !== 'PLANOS_FERIAS') {
      return jsonResponse({ error: 'Este arquivo não é um backup válido de Planos de Férias.' }, 400);
    }

    const registrosPorEntidade: Record<string, any[]> = {};
    const checksumFalhas: string[] = [];
    for (const entityName of ENTITIES) {
      const path = `dados/${entityName}.json`;
      const raw = entries[path] ? strFromU8(entries[path]) : '[]';
      const expected = manifesto?.checksums_sha256?.[path];
      if (expected && await sha256(raw) !== expected) checksumFalhas.push(path);
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return jsonResponse({ error: `Formato inválido em ${path}.` }, 400);
      registrosPorEntidade[entityName] = parsed;
    }
    if (checksumFalhas.length) {
      return jsonResponse({ error: 'Checksum inválido. O backup não pode ser restaurado.', checksum_falhas: checksumFalhas }, 400);
    }

    const conflitos: any[] = [];
    const ausentes: Record<string, number> = {};
    for (const entityName of ENTITIES) {
      const entity = base44.asServiceRole.entities[entityName];
      if (!entity) continue;
      let missing = 0;
      for (const record of registrosPorEntidade[entityName]) {
        if (!idOf(record?.id)) continue;
        const existing = await entity.get(record.id).catch(() => null);
        if (existing) conflitos.push({ entidade: entityName, id: record.id, acao: 'preservar_existente' });
        else missing += 1;
      }
      ausentes[entityName] = missing;
    }

    const resumo = {
      modo,
      arquivo: manifesto.gerado_em || null,
      planos: manifesto.planos || [],
      total_backup: Number(manifesto.total_registros || 0),
      conflitos: conflitos.length,
      registros_a_inserir: Object.values(ausentes).reduce((total, value) => total + value, 0),
      ausentes,
      regra: 'Registros existentes são preservados; nenhum registro é sobrescrito ou excluído.',
    };

    if (modo === 'SIMULAR') return jsonResponse({ ok: true, simulacao: resumo, pronto_para_confirmar: true });

    const inseridos: Record<string, number> = {};
    const erros: any[] = [];
    for (const entityName of ENTITIES) {
      const entity = base44.asServiceRole.entities[entityName];
      if (!entity) continue;
      let count = 0;
      for (const record of registrosPorEntidade[entityName]) {
        if (!idOf(record?.id)) continue;
        const existing = await entity.get(record.id).catch(() => null);
        if (existing) continue;
        try {
          await entity.create(record);
          count += 1;
        } catch (error: any) {
          erros.push({ entidade: entityName, id: record.id, erro: error?.message || 'Falha ao inserir' });
        }
      }
      inseridos[entityName] = count;
    }

    return jsonResponse({
      ok: erros.length === 0,
      restauracao: {
        ...resumo,
        inseridos,
        erros,
        observacao: 'A restauração foi aditiva e preservou registros já existentes.',
      },
    }, erros.length ? 207 : 200);
  } catch (error: any) {
    console.error('[restaurarBackupPlanosFerias] Erro:', error);
    return jsonResponse({ error: error?.message || 'Não foi possível processar o backup.' }, 500);
  }
});
