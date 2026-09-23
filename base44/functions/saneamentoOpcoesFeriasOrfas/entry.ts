import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { CORS_HEADERS, json } from '../../shared/utils/httpJson.ts';
import { texto } from '../../shared/utils/texto.ts';
import {
  periodoMaisAntigoElegivel,
  calcularResumoPeriodoPlano,
} from '../../shared/ferias/resumoPeriodoPlano.ts';

async function listarTodos(entity: any, query: any = {}): Promise<any[]> {
  const registros: any[] = [];
  for (let skip = 0; ; skip += 500) {
    const pagina = await entity.filter(query, 'id', 500, skip);
    registros.push(...pagina);
    if (pagina.length < 500) return registros;
  }
}

const MESES_PT = [
  'janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

function semAcento(valor: any): string {
  return texto(valor).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function periodoEstaInativo(periodo: any): boolean {
  return Boolean(periodo) && (periodo?.inativo === true || texto(periodo?.status) === 'Inativo');
}

function referenciaPeriodo(periodo: any): string {
  return texto(periodo?.ano_referencia || periodo?.periodo_aquisitivo_ref);
}

// Extrai os meses escolhidos pelo militar, aceitando número ("01", "1") ou
// nome do mês ("janeiro"). Formatos desconhecidos são simplesmente ignorados.
function extrairMeses(opcao: any): string[] {
  const campos = [
    opcao?.decisao_camada_1_meses,
    opcao?.opcao_1_meses,
    opcao?.opcao_2_meses,
    opcao?.opcao_3_meses,
  ];
  const meses = new Set<string>();

  for (const campo of campos) {
    const conteudo = semAcento(campo);
    if (!conteudo) continue;

    MESES_PT.forEach((nome, indice) => {
      if (conteudo.includes(nome)) meses.add(String(indice + 1).padStart(2, '0'));
    });

    for (const numero of conteudo.match(/\d{1,2}/g) || []) {
      const valor = Number(numero);
      if (valor >= 1 && valor <= 12) meses.add(String(valor).padStart(2, '0'));
    }
  }

  return [...meses].sort();
}

async function carregarContextoMilitar(base44: any, militarId: string) {
  const [periodos, ferias, ajustes] = await Promise.all([
    listarTodos(base44.asServiceRole.entities.PeriodoAquisitivo, { militar_id: militarId }),
    listarTodos(base44.asServiceRole.entities.Ferias, { militar_id: militarId }),
    listarTodos(base44.asServiceRole.entities.AjusteSaldoFerias, { militar_id: militarId }),
  ]);
  return { periodos, ferias, ajustes };
}

function montarResumoPeriodo(periodo: any) {
  if (!periodo) return null;
  return {
    id: texto(periodo.id),
    ref: referenciaPeriodo(periodo),
    inicio: texto(periodo.inicio_aquisitivo),
    fim: texto(periodo.fim_aquisitivo),
    dias_direito: Number(periodo.dias_direito || 30),
  };
}

function mesesInelegiveis(meses: string[], resumo: any): string[] {
  const elegiveis = new Set(
    (resumo?.meses_elegiveis || []).filter((m: any) => m?.permitido).map((m: any) => texto(m.mes))
  );
  return meses.filter((mes) => !elegiveis.has(mes));
}

async function calcularCasos(base44: any) {
  const [opcoes, periodos] = await Promise.all([
    listarTodos(base44.asServiceRole.entities.OpcaoFeriasMilitar),
    listarTodos(base44.asServiceRole.entities.PeriodoAquisitivo),
  ]);

  const periodoPorId = new Map<string, any>((periodos || []).map((p: any) => [texto(p.id), p]));

  const orfas = (opcoes || []).filter((opcao: any) => {
    const periodo = periodoPorId.get(texto(opcao?.periodo_aquisitivo_id));
    return periodoEstaInativo(periodo);
  });

  const casos: any[] = [];
  const contextoPorMilitar = new Map<string, any>();

  for (const opcao of orfas) {
    const militarId = texto(opcao?.militar_id);
    const periodoAtual = periodoPorId.get(texto(opcao?.periodo_aquisitivo_id)) || null;
    const anoCampanha = Number(opcao?.ano_referencia || new Date().getFullYear() + 1);

    let contexto = contextoPorMilitar.get(militarId);
    if (!contexto && militarId) {
      contexto = await carregarContextoMilitar(base44, militarId);
      contextoPorMilitar.set(militarId, contexto);
    }
    contexto = contexto || { periodos: [], ferias: [], ajustes: [] };

    const sugestao = periodoMaisAntigoElegivel(contexto.periodos, contexto.ferias, contexto.ajustes, anoCampanha);
    const mesesEscolhidos = extrairMeses(opcao);
    const bloqueado = opcao?.gerado_ferias_efetivas === true;

    const motivoBloqueio = bloqueado
      ? 'As férias desta resposta já foram geradas.'
      : (!sugestao ? 'Não há período aquisitivo ativo com saldo disponível para este militar.' : '');

    casos.push({
      opcao_id: texto(opcao.id),
      militar_id: militarId,
      militar_nome: opcao.militar_nome || '',
      militar_posto: opcao.militar_posto || '',
      militar_matricula: opcao.militar_matricula || '',
      militar_quadro: opcao.militar_quadro || '',
      campanha_id: texto(opcao.campanha_id),
      ano_referencia: anoCampanha,
      periodo_atual: montarResumoPeriodo(periodoAtual),
      periodo_sugerido: sugestao ? {
        ...montarResumoPeriodo(sugestao.periodo),
        dias_sem_previsao: sugestao.resumo?.dias_sem_previsao ?? 0,
      } : null,
      meses_escolhidos: mesesEscolhidos,
      meses_inelegiveis: sugestao ? mesesInelegiveis(mesesEscolhidos, sugestao.resumo) : [],
      pode_corrigir: !motivoBloqueio,
      motivo_bloqueio: motivoBloqueio,
    });
  }

  return { totalOpcoes: (opcoes || []).length, casos };
}

async function registrarAuditoria(base44: any, user: any, opcao: any, caso: any, alvo: any, mesesInelegiveisAplicados: string[]) {
  await base44.asServiceRole.entities.AuditoriaFerias.create({
    acao: 'OPCAO_FERIAS_ORFA_REAPONTADA',
    resultado: 'SUCESSO',
    usuario_id: String(user?.id || ''),
    usuario_email: user?.email || '',
    usuario_nome: user?.full_name || user?.name || user?.email || 'Administrador',
    militar_id: caso.militar_id,
    militar_nome: opcao?.militar_nome || '',
    militar_matricula: opcao?.militar_matricula || '',
    plano_id: texto(opcao?.plano_ferias_institucional_id),
    campanha_id: texto(opcao?.campanha_id),
    opcao_id: texto(opcao?.id),
    detalhes: JSON.stringify({
      periodo_anterior_id: texto(opcao?.periodo_aquisitivo_id),
      periodo_anterior_ref: caso.periodo_atual?.ref || '',
      periodo_novo_id: texto(alvo?.id),
      periodo_novo_ref: referenciaPeriodo(alvo),
      dias_direito_novo: Number(alvo?.dias_direito || 0),
      meses_preservados: caso.meses_escolhidos,
      meses_inelegiveis: mesesInelegiveisAplicados,
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
      const { totalOpcoes, casos } = await calcularCasos(base44);
      return json({
        ok: true,
        total_opcoes: totalOpcoes,
        total_casos: casos.length,
        total_corrigiveis: casos.filter((c: any) => c.pode_corrigir).length,
        casos,
        message: casos.length
          ? `${casos.length} opção(ões) de férias vinculada(s) a período inativado.`
          : 'Nenhuma opção de férias vinculada a período inativado.',
      });
    }

    if (acao === 'EXECUTAR') {
      const solicitadas = Array.isArray(body?.opcoes) ? body.opcoes : [];
      if (!solicitadas.length) {
        return json({ error: 'Nenhuma opção informada para saneamento.' }, 400);
      }

      const corrigidos: any[] = [];
      const falhas: any[] = [];

      for (const item of solicitadas) {
        const opcaoId = texto(item?.opcao_id);
        if (!opcaoId) {
          falhas.push({ opcao_id: '', motivo: 'Identificador da opção não informado.' });
          continue;
        }

        try {
          const opcao = await base44.asServiceRole.entities.OpcaoFeriasMilitar.get(opcaoId);
          if (!opcao) {
            falhas.push({ opcao_id: opcaoId, motivo: 'Opção não encontrada.' });
            continue;
          }

          const militarId = texto(opcao.militar_id);
          const periodoAtual = await base44.asServiceRole.entities.PeriodoAquisitivo
            .get(texto(opcao.periodo_aquisitivo_id))
            .catch(() => null);

          if (!periodoEstaInativo(periodoAtual)) {
            falhas.push({ opcao_id: opcaoId, motivo: 'A opção não está vinculada a um período inativado (já saneada).' });
            continue;
          }
          if (opcao?.gerado_ferias_efetivas === true) {
            falhas.push({ opcao_id: opcaoId, motivo: 'As férias desta resposta já foram geradas.' });
            continue;
          }
          if (!militarId) {
            falhas.push({ opcao_id: opcaoId, motivo: 'Resposta sem militar vinculado.' });
            continue;
          }

          const contexto = await carregarContextoMilitar(base44, militarId);
          const anoCampanha = Number(opcao?.ano_referencia || new Date().getFullYear() + 1);
          const ordenados = [...(contexto.periodos || [])].sort((a: any, b: any) =>
            String(a?.inicio_aquisitivo || '').localeCompare(String(b?.inicio_aquisitivo || ''))
          );

          const periodoInformado = texto(item?.periodo_aquisitivo_id);
          const sugestao = periodoMaisAntigoElegivel(contexto.periodos, contexto.ferias, contexto.ajustes, anoCampanha);

          const alvo = periodoInformado
            ? ordenados.find((p: any) => texto(p.id) === periodoInformado) || null
            : (sugestao?.periodo || null);

          if (!alvo || periodoEstaInativo(alvo)) {
            falhas.push({ opcao_id: opcaoId, motivo: 'O período de destino não é um período ativo deste militar.' });
            continue;
          }

          const resumo = calcularResumoPeriodoPlano(alvo, contexto.ferias, contexto.ajustes, anoCampanha);
          if (resumo.dias_sem_previsao <= 0) {
            falhas.push({ opcao_id: opcaoId, motivo: `O período ${referenciaPeriodo(alvo)} não possui saldo disponível.` });
            continue;
          }

          const mesesEscolhidos = extrairMeses(opcao);
          const inelegiveis = mesesInelegiveis(mesesEscolhidos, resumo);
          const diasDireito = Math.max(0, resumo.dias_sem_previsao);
          const periodoAtualResumo = montarResumoPeriodo(periodoAtual);

          await base44.asServiceRole.entities.OpcaoFeriasMilitar.update(opcaoId, {
            periodo_aquisitivo_id: alvo.id,
            periodo_inicio: alvo.inicio_aquisitivo || '',
            periodo_fim: alvo.fim_aquisitivo || '',
            dias_direito: diasDireito,
            status_camada_1: inelegiveis.length ? 'Pendente_Reanalise' : 'Pendente',
            justificativa_ajuste_gestor: `Saneamento: período inativado ${periodoAtualResumo?.ref || ''} reapontado para ${referenciaPeriodo(alvo)}${inelegiveis.length ? `. Meses fora da elegibilidade do novo período: ${inelegiveis.join(', ')}.` : '.'}`,
          });

          await registrarAuditoria(base44, user, opcao, {
            militar_id: militarId,
            militar_nome: opcao?.militar_nome || '',
            periodo_atual: periodoAtualResumo,
            meses_escolhidos: mesesEscolhidos,
          }, alvo, inelegiveis);

          corrigidos.push({
            opcao_id: opcaoId,
            militar_id: militarId,
            militar_nome: opcao?.militar_nome || '',
            periodo_anterior_ref: periodoAtualResumo?.ref || '',
            periodo_novo_ref: referenciaPeriodo(alvo),
            dias_direito: diasDireito,
            meses_inelegiveis: inelegiveis,
            revisao_necessaria: inelegiveis.length > 0,
          });
        } catch (erroAlvo: any) {
          falhas.push({ opcao_id: opcaoId, motivo: erroAlvo?.message || 'Falha ao sanear a opção.' });
        }
      }

      return json({
        ok: true,
        total_corrigidos: corrigidos.length,
        total_falhas: falhas.length,
        total_revisao: corrigidos.filter((c: any) => c.revisao_necessaria).length,
        falhas,
        corrigidos,
        message: `${corrigidos.length} opção(ões) reapontada(s) para o período ativo.`,
      });
    }

    return json({ error: 'Ação não reconhecida. Use PREVIA ou EXECUTAR.' }, 400);
  } catch (error: any) {
    console.error('[saneamentoOpcoesFeriasOrfas]', error);
    return json({ error: error?.message || 'Falha interna no saneamento das opções de férias.' }, 500);
  }
});