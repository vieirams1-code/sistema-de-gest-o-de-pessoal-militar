import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { CORS_HEADERS, json } from '../../shared/utils/httpJson.ts';
import { texto } from '../../shared/utils/texto.ts';

async function listarTodos(entity: any, query: any = {}): Promise<any[]> {
  const registros: any[] = [];
  for (let skip = 0; ; skip += 500) {
    const pagina = await entity.filter(query, 'id', 500, skip);
    registros.push(...pagina);
    if (pagina.length < 500) return registros;
  }
}

// Mesma normalização usada pelo portal do militar: alfanumérica, sem máscara.
function normalizarMatricula(valor: any): string {
  return texto(valor).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function formatarMatricula(valor: any): string {
  const digitos = texto(valor).replace(/\D/g, '').slice(0, 9);
  if (!digitos) return texto(valor);
  if (digitos.length <= 3) return digitos;
  if (digitos.length <= 6) return `${digitos.slice(0, 3)}.${digitos.slice(3)}`;
  return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}-${digitos.slice(6)}`;
}

function matriculaAtualDoHistorico(historico: any[]): any {
  const lista = historico || [];
  return lista.find((m: any) => m?.is_atual === true)
    || lista.find((m: any) => texto(m?.situacao).toLowerCase() === 'ativa')
    || lista[0]
    || null;
}

function militarMesclado(militar: any): boolean {
  const status = texto(militar?.status_cadastro || militar?.situacao_militar).toLowerCase();
  return status === 'mesclado' || Boolean(militar?.merged_into_id);
}

// Varredura idempotente: compara a matrícula do cadastro do militar com a
// matrícula atual do histórico. Após o saneamento, o caso deixa de aparecer.
async function calcularDivergencias(base44: any) {
  const [militares, matriculas] = await Promise.all([
    listarTodos(base44.asServiceRole.entities.Militar),
    listarTodos(base44.asServiceRole.entities.MatriculaMilitar),
  ]);

  const porMilitar = new Map<string, any[]>();
  for (const registro of matriculas || []) {
    const militarId = texto(registro?.militar_id);
    if (!militarId) continue;
    if (!porMilitar.has(militarId)) porMilitar.set(militarId, []);
    porMilitar.get(militarId)!.push(registro);
  }

  const divergencias: any[] = [];
  for (const militar of militares || []) {
    if (militarMesclado(militar)) continue;

    const historico = porMilitar.get(texto(militar.id)) || [];
    if (!historico.length) continue;

    const atual = matriculaAtualDoHistorico(historico);
    const normalizadaCadastro = normalizarMatricula(militar?.matricula);
    const normalizadaHistorico = normalizarMatricula(atual?.matricula || atual?.matricula_normalizada);
    if (!normalizadaCadastro || !normalizadaHistorico) continue;
    if (normalizadaCadastro === normalizadaHistorico) continue;

    divergencias.push({
      militar_id: texto(militar.id),
      militar_nome: militar.nome_completo || militar.nome_guerra || '',
      militar_posto: militar.posto_graduacao || '',
      militar_quadro: militar.quadro || '',
      militar_lotacao: militar.lotacao || militar.estrutura_nome || '',
      matricula_cadastro: formatarMatricula(militar?.matricula),
      matricula_cadastro_normalizada: normalizadaCadastro,
      matricula_historico: formatarMatricula(atual?.matricula || atual?.matricula_normalizada),
      matricula_historico_normalizada: normalizadaHistorico,
      matricula_historico_id: texto(atual?.id),
    });
  }

  return { totalMilitares: (militares || []).length, divergencias };
}

async function registrarAuditoria(base44: any, user: any, divergencia: any, lado: string, valorAnterior: string, valorNovo: string) {
  await base44.asServiceRole.entities.AuditoriaFerias.create({
    acao: 'MATRICULA_SANEADA_DIVERGENCIA',
    resultado: 'SUCESSO',
    usuario_id: String(user?.id || ''),
    usuario_email: user?.email || '',
    usuario_nome: user?.full_name || user?.name || user?.email || 'Administrador',
    militar_id: divergencia.militar_id,
    militar_nome: divergencia.militar_nome,
    militar_matricula: valorNovo,
    detalhes: JSON.stringify({
      lado_alterado: lado,
      valor_anterior: valorAnterior,
      valor_novo: valorNovo,
      matricula_cadastro_antes: divergencia.matricula_cadastro,
      matricula_historico_antes: divergencia.matricula_historico,
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

    const authzResponse = await base44.functions.invoke('getUserPermissions', {});
    const authz = authzResponse?.data ?? authzResponse ?? {};
    const isAdmin = String(user.role || '').trim().toLowerCase() === 'admin' || authz?.isAdmin === true;
    if (!isAdmin) {
      return json({ error: 'Apenas administradores podem executar este saneamento.' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const acao = texto(body?.acao).toUpperCase();

    if (acao === 'PREVIA') {
      const { totalMilitares, divergencias } = await calcularDivergencias(base44);
      return json({
        ok: true,
        total_militares: totalMilitares,
        total_divergencias: divergencias.length,
        divergencias,
        message: divergencias.length
          ? `${divergencias.length} militar(es) com divergência entre cadastro e histórico de matrículas.`
          : 'Nenhuma divergência de matrícula encontrada.',
      });
    }

    if (acao === 'EXECUTAR') {
      const correcoes = Array.isArray(body?.correcoes) ? body.correcoes : [];
      if (!correcoes.length) {
        return json({ error: 'Nenhuma correção informada.' }, 400);
      }

      const { divergencias } = await calcularDivergencias(base44);
      const porMilitar = new Map(divergencias.map((d: any) => [d.militar_id, d]));

      const corrigidos: any[] = [];
      const falhas: any[] = [];

      for (const item of correcoes) {
        const militarId = texto(item?.militar_id);
        const oficial = normalizarMatricula(item?.matricula_oficial);
        const divergencia: any = porMilitar.get(militarId);

        if (!divergencia) {
          falhas.push({ militar_id: militarId, motivo: 'Divergência não encontrada (já corrigida).' });
          continue;
        }
        if (oficial !== divergencia.matricula_cadastro_normalizada && oficial !== divergencia.matricula_historico_normalizada) {
          falhas.push({ militar_id: militarId, motivo: 'A matrícula escolhida não corresponde a nenhuma das versões registradas.' });
          continue;
        }

        try {
          if (oficial === divergencia.matricula_cadastro_normalizada) {
            // O cadastro é a versão oficial: alinha o histórico de matrículas.
            await base44.asServiceRole.entities.MatriculaMilitar.update(divergencia.matricula_historico_id, {
              matricula: divergencia.matricula_cadastro,
              matricula_normalizada: divergencia.matricula_cadastro_normalizada,
            });
            await registrarAuditoria(base44, user, divergencia, 'historico', divergencia.matricula_historico, divergencia.matricula_cadastro);
            corrigidos.push({ ...divergencia, matricula_oficial: divergencia.matricula_cadastro, lado_alterado: 'historico' });
          } else {
            // O histórico é a versão oficial: alinha o cadastro do militar.
            await base44.asServiceRole.entities.Militar.update(militarId, {
              matricula: divergencia.matricula_historico,
            });
            await registrarAuditoria(base44, user, divergencia, 'cadastro', divergencia.matricula_cadastro, divergencia.matricula_historico);
            corrigidos.push({ ...divergencia, matricula_oficial: divergencia.matricula_historico, lado_alterado: 'cadastro' });
          }
        } catch (erroAlvo: any) {
          falhas.push({ militar_id: militarId, motivo: erroAlvo?.message || 'Falha ao corrigir.' });
        }
      }

      return json({
        ok: true,
        total_corrigidos: corrigidos.length,
        total_falhas: falhas.length,
        falhas,
        corrigidos,
        message: `${corrigidos.length} matrícula(s) alinhada(s) com sucesso.`,
      });
    }

    return json({ error: 'Ação não reconhecida. Use PREVIA ou EXECUTAR.' }, 400);
  } catch (error: any) {
    console.error('[saneamentoMatriculaDivergente]', error);
    return json({ error: error?.message || 'Falha interna no saneamento de matrículas.' }, 500);
  }
});