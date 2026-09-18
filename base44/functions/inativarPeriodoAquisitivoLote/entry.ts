import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { CORS_HEADERS, json } from '../../shared/utils/httpJson.ts';
import { normalizar, texto } from '../../shared/utils/texto.ts';

async function listarTodos(entity: any, query: any = {}): Promise<any[]> {
  const registros: any[] = [];
  for (let skip = 0; ; skip += 500) {
    const pagina = await entity.filter(query, 'id', 500, skip);
    registros.push(...pagina);
    if (pagina.length < 500) return registros;
  }
}

// Escopo fixo desta operação: militares ativos das duas unidades.
const LOTACOES_ALVO = ['nova alvorada do sul', 'sidrolandia'];
const ACAO_INATIVACAO = 'PERIODO_INATIVADO_LOTE_2425';
const ACAO_REATIVACAO = 'PERIODO_REATIVADO_LOTE_2425';

// Períodos aquisitivos que esta ferramenta pode tratar.
const PERIODOS_DISPONIVEIS = ['2024/2025', '2023/2024'];

function normalizarPeriodoRef(valor: any): string {
  const ref = texto(valor);
  return PERIODOS_DISPONIVEIS.includes(ref) ? ref : PERIODOS_DISPONIVEIS[0];
}

function militarEstaAtivo(militar: any): boolean {
  return normalizar(militar?.status_cadastro || militar?.status) === 'ativo';
}

function pertenceAoEscopo(militar: any): boolean {
  return LOTACOES_ALVO.includes(normalizar(militar?.lotacao || militar?.estrutura_nome));
}

function ehPeriodo(periodo: any, ref: string): boolean {
  if (texto(periodo?.ano_referencia || periodo?.periodo_aquisitivo_ref) === ref) return true;
  const [anoInicio, anoFim] = ref.split('/');
  const inicio = texto(periodo?.inicio_aquisitivo).slice(0, 4);
  const fim = texto(periodo?.fim_aquisitivo).slice(0, 4);
  return inicio === anoInicio && fim === anoFim;
}

function montarAlvo(militar: any, periodo: any, ref: string) {
  return {
    militar_id: militar.id,
    militar_nome: militar.nome_completo || militar.nome_guerra || '',
    militar_matricula: militar.matricula || '',
    militar_lotacao: militar.lotacao || militar.estrutura_nome || '',
    periodo_id: periodo.id,
    periodo_ref: periodo.ano_referencia || periodo.periodo_aquisitivo_ref || ref,
    periodo_inicio: periodo.inicio_aquisitivo || '',
    periodo_fim: periodo.fim_aquisitivo || '',
  };
}

// Calcula o público-alvo: militares ativos das unidades do escopo com o
// período 2024/2025 ainda em aberto. É idempotente — quem já está inativo
// simplesmente não entra na lista.
async function calcularAlvos(base44: any, ref: string) {
  const [militares, periodos] = await Promise.all([
    listarTodos(base44.asServiceRole.entities.Militar),
    listarTodos(base44.asServiceRole.entities.PeriodoAquisitivo),
  ]);

  const militaresAlvo = (militares || []).filter((m: any) => militarEstaAtivo(m) && pertenceAoEscopo(m));
  const idsAlvo = new Set(militaresAlvo.map((m: any) => texto(m.id)));

  const periodosPorMilitar = new Map<string, any[]>();
  for (const periodo of periodos || []) {
    const militarId = texto(periodo?.militar_id);
    if (!idsAlvo.has(militarId)) continue;
    if (periodo?.inativo === true || periodo?.status === 'Inativo') continue;
    if (!ehPeriodo(periodo, ref)) continue;
    if (!periodosPorMilitar.has(militarId)) periodosPorMilitar.set(militarId, []);
    periodosPorMilitar.get(militarId)!.push(periodo);
  }

  const alvos: any[] = [];
  for (const militar of militaresAlvo) {
    for (const periodo of periodosPorMilitar.get(texto(militar.id)) || []) {
      alvos.push(montarAlvo(militar, periodo, ref));
    }
  }

  return { totalMilitaresEscopo: militaresAlvo.length, alvos };
}

function lerDetalhes(registro: any): any {
  try {
    return typeof registro?.detalhes === 'string' ? JSON.parse(registro.detalhes) : (registro?.detalhes || {});
  } catch (_erro) {
    return {};
  }
}

async function registrarAuditoria(base44: any, user: any, acao: string, alvo: any) {
  await base44.asServiceRole.entities.AuditoriaFerias.create({
    acao,
    resultado: 'SUCESSO',
    usuario_id: String(user?.id || ''),
    usuario_email: user?.email || '',
    usuario_nome: user?.full_name || user?.name || user?.email || 'Administrador',
    militar_id: alvo.militar_id,
    militar_nome: alvo.militar_nome,
    militar_matricula: alvo.militar_matricula,
    detalhes: JSON.stringify({
      periodo_id: alvo.periodo_id,
      periodo_ref: alvo.periodo_ref,
      periodo_inicio: alvo.periodo_inicio,
      periodo_fim: alvo.periodo_fim,
      origem: 'LOTE_2425_NOVA_ALVORADA_SIDROLANDIA',
    }),
    data_hora: new Date().toISOString(),
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Método não permitido.' }, 405);
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return json({ error: 'Usuário não autenticado.' }, 401);
    if (String(user.role || '').trim().toLowerCase() !== 'admin') {
      return json({ error: 'Apenas administradores podem executar esta operação.' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const acao = texto(body?.acao).toUpperCase();
    const periodoRef = normalizarPeriodoRef(body?.periodo_ref);

    if (acao === 'PREVIA') {
      const { totalMilitaresEscopo, alvos } = await calcularAlvos(base44, periodoRef);
      return json({
        ok: true,
        periodo_ref: periodoRef,
        total_militares_escopo: totalMilitaresEscopo,
        total_alvos: alvos.length,
        alvos,
        message: alvos.length
          ? `${alvos.length} período(s) ${periodoRef} elegível(is) para inativação.`
          : `Nenhum militar ativo das unidades do escopo possui o período ${periodoRef} em aberto.`,
      });
    }

    if (acao === 'EXECUTAR') {
      const { totalMilitaresEscopo, alvos } = await calcularAlvos(base44, periodoRef);
      const inativados: any[] = [];
      const falhas: any[] = [];

      for (const alvo of alvos) {
        try {
          // A auditoria é gravada antes da alteração: garante que todo período
          // inativado por esta operação tenha registro para reversão.
          await registrarAuditoria(base44, user, ACAO_INATIVACAO, alvo);
          await base44.asServiceRole.entities.PeriodoAquisitivo.update(alvo.periodo_id, {
            inativo: true,
            status: 'Inativo',
          });
          inativados.push(alvo);
        } catch (erroAlvo: any) {
          falhas.push({ ...alvo, motivo: erroAlvo?.message || 'Falha ao inativar.' });
        }
      }

      return json({
        ok: true,
        total_militares_escopo: totalMilitaresEscopo,
        periodo_ref: periodoRef,
        total_alvos: alvos.length,
        total_inativados: inativados.length,
        total_ignorados: falhas.length,
        falhas,
        alvos: inativados,
        message: `${inativados.length} período(s) inativado(s) com sucesso.`,
      });
    }

    if (acao === 'REVERTER') {
      const [inativacoes, reativacoes] = await Promise.all([
        listarTodos(base44.asServiceRole.entities.AuditoriaFerias, { acao: ACAO_INATIVACAO }),
        listarTodos(base44.asServiceRole.entities.AuditoriaFerias, { acao: ACAO_REATIVACAO }),
      ]);

      // Considera o ÚLTIMO evento de cada período: se o mais recente é uma
      // inativação, ele está pendente de reversão. Assim, períodos que já
      // passaram por um ciclo inativa → reativa → inativa continuam
      // elegíveis para nova reversão.
      const eventos = new Map<string, { acao: string; registro: any; quando: string }>();
      for (const registro of [...(inativacoes || []), ...(reativacoes || [])]) {
        const detalhes = lerDetalhes(registro);
        const periodoId = texto(detalhes?.periodo_id);
        if (!periodoId) continue;
        const quando = texto(registro?.data_hora || registro?.created_date);
        const atual = eventos.get(periodoId);
        if (!atual || quando >= atual.quando) {
          eventos.set(periodoId, { acao: texto(registro?.acao), registro, quando });
        }
      }

      const pendentes = new Map<string, any>();
      for (const [periodoId, evento] of eventos) {
        if (evento.acao !== ACAO_INATIVACAO) continue;
        const registro = evento.registro;
        const detalhes = lerDetalhes(registro);
        pendentes.set(periodoId, {
          periodo_id: periodoId,
          periodo_ref: detalhes?.periodo_ref || '',
          periodo_inicio: detalhes?.periodo_inicio || '',
          periodo_fim: detalhes?.periodo_fim || '',
          militar_id: registro?.militar_id || '',
          militar_nome: registro?.militar_nome || '',
          militar_matricula: registro?.militar_matricula || '',
        });
      }

      const reativados: any[] = [];
      const naoEncontrados: any[] = [];
      for (const alvo of pendentes.values()) {
        const periodo = await base44.asServiceRole.entities.PeriodoAquisitivo
          .get(alvo.periodo_id)
          .catch(() => null);
        if (!periodo) {
          naoEncontrados.push(alvo);
          continue;
        }
        await registrarAuditoria(base44, user, ACAO_REATIVACAO, alvo);
        await base44.asServiceRole.entities.PeriodoAquisitivo.update(alvo.periodo_id, {
          inativo: false,
          status: 'Disponível',
        });
        reativados.push(alvo);
      }

      return json({
        ok: true,
        total_reativados: reativados.length,
        total_nao_encontrados: naoEncontrados.length,
        periodos_nao_encontrados: naoEncontrados,
        alvos: reativados,
        message: reativados.length
          ? `${reativados.length} período(s) reativado(s) com sucesso.`
          : 'Nenhum período inativado por esta operação estava pendente de reversão.',
      });
    }

    return json({ error: 'Ação não reconhecida. Use PREVIA, EXECUTAR ou REVERTER.' }, 400);
  } catch (error: any) {
    console.error('[inativarPeriodoAquisitivoLote]', error);
    return json({ error: error?.message || 'Falha interna na operação em lote.' }, 500);
  }
});