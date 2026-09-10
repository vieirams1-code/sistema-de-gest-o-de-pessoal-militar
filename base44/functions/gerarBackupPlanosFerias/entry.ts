import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { zipSync, strToU8 } from 'npm:fflate@0.8.3';

const HEADERS = {
  'Content-Type': 'application/zip',
  'Content-Disposition': 'attachment',
};

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

const isHolidayCampaign = (item: any) => item?.tipo === 'PLANO_FERIAS';
const idOf = (value: any) => String(value ?? '').trim();

async function listAll(base44: any, entityName: string): Promise<any[]> {
  const entity = base44.asServiceRole.entities[entityName];
  if (!entity) return [];
  const pageSize = 500;
  const result: any[] = [];
  let skip = 0;
  while (true) {
    const page = await entity.list('-created_date', pageSize, skip);
    if (!page?.length) break;
    result.push(...page);
    if (page.length < pageSize) break;
    skip += pageSize;
  }
  return result;
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req: Request) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || String(user.role || '').toLowerCase() !== 'admin') {
      return Response.json({ error: 'Acesso restrito a administradores.' }, { status: 403 });
    }

    const rawPayload = await req.json().catch(() => ({}));
    const requestedPlanId = idOf(rawPayload?.plano_id);

    const allPlans = await listAll(base44, 'PlanoFeriasInstitucional');
    const plans = requestedPlanId
      ? allPlans.filter((plan) => idOf(plan.id) === requestedPlanId)
      : allPlans;
    if (requestedPlanId && plans.length === 0) {
      return Response.json({ error: 'Plano de Férias não encontrado.' }, { status: 404 });
    }

    const allCampaigns = (await listAll(base44, 'CampanhaPortal')).filter(isHolidayCampaign);
    const planIds = new Set(plans.map((plan) => idOf(plan.id)));
    const campaigns = allCampaigns.filter((campaign) => planIds.has(idOf(campaign.plano_ferias_institucional_id)));
    const campaignIds = new Set(campaigns.map((campaign) => idOf(campaign.id)));

    const allOptions = await listAll(base44, 'OpcaoFeriasMilitar');
    const options = allOptions.filter((option) =>
      campaignIds.has(idOf(option.campanha_id)) ||
      planIds.has(idOf(option.plano_ferias_institucional_id))
    );

    const allCustomResponses = await listAll(base44, 'RespostaCampanhaPersonalizada');
    const responses = allCustomResponses.filter((response) => campaignIds.has(idOf(response.campanha_id)));

    const allPermissions = await listAll(base44, 'PermissaoPlanoFerias');
    const permissions = allPermissions.filter((permission) =>
      planIds.has(idOf(permission.plano_ferias_institucional_id)) ||
      campaignIds.has(idOf(permission.campanha_id))
    );

    const allAudits = await listAll(base44, 'AuditoriaFerias');
    const audits = allAudits.filter((audit) =>
      planIds.has(idOf(audit.plano_id)) ||
      campaignIds.has(idOf(audit.campanha_id))
    );

    const allVacations = await listAll(base44, 'Ferias');
    const vacations = allVacations.filter((vacation) => planIds.has(idOf(vacation.plano_ferias_id)));

    const allMembers = await listAll(base44, 'MembroGrupoEfetivo');
    const groupIds = new Set<string>();
    for (const campaign of campaigns) {
      for (const id of [...(campaign.escopo_grupos_ids || []), ...(campaign.escopo_grupos_excluidos_ids || [])]) groupIds.add(idOf(id));
    }
    const members = allMembers.filter((member) => groupIds.has(idOf(member.grupo_id)));

    const allGroups = await listAll(base44, 'GrupoEfetivo');
    const groups = allGroups.filter((group) => groupIds.has(idOf(group.id)));

    const allMilitares = await listAll(base44, 'Militar');
    const militarIds = new Set<string>([
      ...options.map((item) => idOf(item.militar_id)),
      ...vacations.map((item) => idOf(item.militar_id)),
      ...members.map((item) => idOf(item.militar_id)),
    ]);
    const militares = allMilitares.filter((militar) => militarIds.has(idOf(militar.id)));

    const allPeriods = await listAll(base44, 'PeriodoAquisitivo');
    const periodIds = new Set<string>([
      ...options.map((item) => idOf(item.periodo_aquisitivo_id)),
      ...vacations.map((item) => idOf(item.periodo_aquisitivo_id)),
    ]);
    const periods = allPeriods.filter((period) => periodIds.has(idOf(period.id)));

    const selected = {
      PlanoFeriasInstitucional: plans,
      CampanhaPortal: campaigns,
      OpcaoFeriasMilitar: options,
      RespostaCampanhaPersonalizada: responses,
      PermissaoPlanoFerias: permissions,
      MembroGrupoEfetivo: members,
      GrupoEfetivo: groups,
      AuditoriaFerias: audits,
      Ferias: vacations,
      PeriodoAquisitivo: periods,
      Militar: militares,
    };

    const zipEntries: Record<string, Uint8Array> = {};
    const checksums: Record<string, string> = {};
    const entidades: Record<string, number> = {};
    let totalRegistros = 0;

    for (const [entityName, records] of Object.entries(selected)) {
      const json = JSON.stringify(records, null, 2);
      const path = `dados/${entityName}.json`;
      zipEntries[path] = strToU8(json);
      checksums[path] = await sha256(json);
      entidades[entityName] = records.length;
      totalRegistros += records.length;
    }

    const manifesto = {
      tipo_backup: 'PLANOS_FERIAS',
      versao_backup: '1.0',
      gerado_em: new Date().toISOString(),
      gerado_por: user.email || '',
      plano_id_filtro: requestedPlanId || null,
      planos: plans.map((plan) => ({
        id: plan.id,
        titulo: plan.titulo,
        ano_referencia: plan.ano_referencia,
        status: plan.status,
      })),
      entidades,
      total_registros: totalRegistros,
      checksums_sha256: checksums,
      observacao_restauracao: 'Backup de preservação. A restauração deve começar por uma simulação e manter os IDs e vínculos entre registros.',
    };

    zipEntries['manifesto.json'] = strToU8(JSON.stringify(manifesto, null, 2));
    const zipped = zipSync(zipEntries, { level: 6 });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `sgp-planos-ferias-backup-${stamp}.zip`;

    return new Response(zipped, {
      status: 200,
      headers: {
        ...HEADERS,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('[gerarBackupPlanosFerias] Erro:', error);
    return Response.json({ error: error?.message || 'Não foi possível gerar o backup dos Planos de Férias.' }, { status: 500 });
  }
});
