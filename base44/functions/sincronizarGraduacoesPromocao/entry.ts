import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { atualizarCadastroMilitar } from '../utils.ts';

const POSTOS_HIERARQUIA = [
  'Soldado',
  'Cabo',
  '3º Sargento',
  '2º Sargento',
  '1º Sargento',
  'Subtenente',
  'Aspirante a Oficial',
  '2º Tenente',
  '1º Tenente',
  'Capitão',
  'Major',
  'Tenente-Coronel',
  'Coronel',
];

const INDICE_POR_POSTO = new Map(POSTOS_HIERARQUIA.map((posto, indice) => [posto, indice]));

const texto = (valor: unknown) => String(valor ?? '').trim();

const normalizar = (valor: unknown) => {
  return texto(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[°º]/g, 'o')
    .replace(/[•|/]/g, ' ')
    .replace(/[-–—]/g, ' ')
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
};

const ALIASES_POSTO = [
  'posto_graduacao',
  'postoGraduacao',
  'posto_grad',
  'posto_graduacao_atual',
  'posto',
  'graduacao',
  'rank'
];

const ALIASES_QUADRO = [
  'quadro',
  'quadro_atual',
  'quadroAtual',
  'quadro_militar',
  'militar_quadro',
  'qbmp'
];

function getPostoGraduacaoMilitar(militar: any) {
  if (!militar) return { valor: '', campo: 'N/A' };
  for (const campo of ALIASES_POSTO) {
    const valor = militar[campo];
    if (valor && String(valor).trim()) {
      if (campo !== 'posto_graduacao') {
         console.warn(`[MilitarPostoGraduacao] Alias utilizado: militarId=${militar.id || 'N/A'} matricula=${militar.matricula || 'N/A'} campo=${campo}`);
      }
      return { valor: String(valor).trim(), campo };
    }
  }
  return { valor: '', campo: 'N/A' };
}

function getQuadroMilitar(militar: any) {
  if (!militar) return { valor: '', campo: 'N/A' };
  for (const campo of ALIASES_QUADRO) {
    const valor = militar[campo];
    if (valor && String(valor).trim()) {
      if (campo !== 'quadro') {
         console.warn(`[MilitarPostoGraduacao] Alias utilizado: militarId=${militar.id || 'N/A'} matricula=${militar.matricula || 'N/A'} campo=${campo}`);
      }
      return { valor: String(valor).trim(), campo };
    }
  }
  return { valor: '', campo: 'N/A' };
}

const toTime = (value: unknown) => {
  if (!value) return Number.NEGATIVE_INFINITY;
  const ts = new Date(value as string).getTime();
  return Number.isNaN(ts) ? Number.NEGATIVE_INFINITY : ts;
};

function compararHistoricosDesc(a: any, b: any) {
  const camposData = ['data_promocao', 'data_publicacao', 'created_at'];
  for (const campo of camposData) {
    const delta = toTime(b?.[campo]) - toTime(a?.[campo]);
    if (delta !== 0) return delta;
  }
  return String(b?.id).localeCompare(String(a?.id));
}

function obterPostoCanonico(v: string) {
  const t = normalizar(v);
  // Mapeamento simples para garantir que "Soldado" vs "SD" ou variações batam se necessário.
  // No Historico V2, geralmente já está o nome por extenso, mas o normalizar garante case/acentos.
  for (const p of POSTOS_HIERARQUIA) {
    if (normalizar(p) === t) return p;
  }
  return v;
}

/**
 * Simula a lógica getPostoGraduacaoOficial usada pelo Efetivo no frontend.
 */
function calcularPostoEfetivo(militar: any) {
  return String(
    militar?.posto_graduacao ||
    militar?.['posto_graduação'] ||
    militar?.posto_grad ||
    militar?.posto ||
    militar?.graduacao ||
    ''
  ).trim();
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  try {
    const authUser = await base44.auth.me();
    if (!authUser) return Response.json({ success: false, error: 'Não autenticado' }, { status: 401 });

    let payload: any = {};
    try { payload = await req.json(); } catch (_) { }

    const dryRun = payload.dryRun !== false;
    const confirmacao = texto(payload.confirmacao);

    if (!dryRun && confirmacao !== 'SINCRONIZAR') {
      return Response.json({ success: false, error: 'Confirmação textual "SINCRONIZAR" obrigatória para execução.' }, { status: 400 });
    }

    const Militar = base44.asServiceRole.entities.Militar;
    const Historico = base44.asServiceRole.entities.HistoricoPromocaoMilitarV2;

    const [militares, historicosTodos] = await Promise.all([
      Militar.list(),
      Historico.list()
    ]);

    // Linking logic: use ID and Matricula
    const historicosPorMilitarId = new Map<string, any[]>();
    const historicosPorMatricula = new Map<string, any[]>();

    for (const h of historicosTodos) {
      // Multiple fields for linking as requested
      const mid = texto(h.militar_id || h.militarId || (typeof h.militar === 'string' ? h.militar : h.militar?.id));
      const mat = texto(h.matricula || (typeof h.militar === 'object' ? h.militar?.matricula : ''));

      if (mid) {
        if (!historicosPorMilitarId.has(mid)) historicosPorMilitarId.set(mid, []);
        historicosPorMilitarId.get(mid)!.push(h);
      }
      if (mat) {
        if (!historicosPorMatricula.has(mat)) historicosPorMatricula.set(mat, []);
        historicosPorMatricula.get(mat)!.push(h);
      }
    }

    const debug = {
      totalMilitares: militares.length,
      totalHistoricos: historicosTodos.length,
      militaresAtivos: 0,
      militaresComHistorico: 0,
      historicosPublicados: 0,
      descartados: {
        inativo: 0,
        semHistorico: 0,
        rebaixamento: 0
      }
    };

    const resumo = {
      analisados: 0,
      atualizados: 0, // atualizações automáticas (histórico superior ao cadastro)
      compativeis: 0, // histórico igual ao cadastro
      cadastros_preservados: 0, // histórico inferior ao cadastro (cadastro atual mantido)
      divergencias_criticas: 0, // casos indefinidos que exigem análise humana
      ignorados: 0,
      falhas: [] as any[], // falhas de atualização
      divergencias: [] as any[],
      cadastros_preservados_detalhe: [] as any[],
      divergencias_criticas_detalhe: [] as any[],
      stort_debug: null as any
    };

    const pendingUpdates = [];

    for (const militar of militares) {
      const statusMilitar = normalizar(militar.status_cadastro);
      if (statusMilitar !== 'ativo') {
        debug.descartados.inativo++;
        continue;
      }
      debug.militaresAtivos++;

      const mid = texto(militar.id);
      const mat = texto(militar.matricula);

      // Agrupar históricos por ID ou Matrícula, removendo duplicados pelo ID do registro
      const historicosMap = new Map<string, any>();
      (historicosPorMilitarId.get(mid) || []).forEach(h => historicosMap.set(String(h.id), h));
      (historicosPorMatricula.get(mat) || []).forEach(h => historicosMap.set(String(h.id), h));

      const mHistoricosRaw = Array.from(historicosMap.values());

      // Filtro de "publicados"
      const mHistoricos = mHistoricosRaw.filter(h => {
        const statusReg = normalizar(h.status_registro);
        if (['cancelado', 'cancelada', 'retificado', 'retificada'].includes(statusReg)) return false;

        const isPublicado = h.publicado === true || h.publicado === 'true';
        const isConsolidado = h.consolidado === true || h.consolidado === 'true';
        const stPub = normalizar(h.status_publicacao || h.situacao || h.status || h.status_promocao);

        const temDataPublicacao = !!h.data_publicacao || !!h.data_promocao;
        const temReferencia = !!h.boletim_referencia || !!h.ato_referencia || !!h.numero_publicacao;

        // Critério amplo de publicação conforme solicitado
        const publicadoPorStatus = ['publicado', 'publicada', 'consolidado', 'consolidada', 'ativo'].includes(stPub);

        const res = (statusReg === 'ativo') || isPublicado || isConsolidado || publicadoPorStatus || (temDataPublicacao && temReferencia);
        if (res) debug.historicosPublicados++;
        return res;
      });

      if (mHistoricos.length === 0) {
        debug.descartados.semHistorico++;
        resumo.ignorados++;
        continue;
      }

      debug.militaresComHistorico++;
      resumo.analisados++;

      const ultimoHistorico = [...mHistoricos].sort(compararHistoricosDesc)[0];

      const postoAtualResult = getPostoGraduacaoMilitar(militar);
      const quadroAtualResult = getQuadroMilitar(militar);
      const postoAtualRaw = postoAtualResult.valor;
      const quadroAtualRaw = quadroAtualResult.valor;
      const postoAtual = normalizar(postoAtualRaw);
      const quadroAtual = normalizar(quadroAtualRaw);
      const postoNovo = normalizar(ultimoHistorico.posto_graduacao_novo);
      const quadroNovo = normalizar(ultimoHistorico.quadro_novo);

      const divergePosto = postoAtual !== postoNovo;
      const divergeQuadro = quadroAtual !== quadroNovo;

      if (!divergePosto && !divergeQuadro) {
        resumo.compativeis++;
        continue;
      }

      const idxAtual = INDICE_POR_POSTO.get(obterPostoCanonico(postoAtualRaw)) ?? -1;
      const idxNovo = INDICE_POR_POSTO.get(obterPostoCanonico(ultimoHistorico.posto_graduacao_novo)) ?? -1;

      // === Regra do Cadastro Presumidamente Correto ===
      // Divergência crítica: algum dos postos não foi reconhecido na hierarquia.
      if (idxAtual === -1 || idxNovo === -1) {
        resumo.divergencias_criticas++;
        resumo.divergencias_criticas_detalhe.push({
          militar_id: mid,
          nome: militar.nome_completo || militar.nome_guerra || 'Militar ' + mid,
          matricula: militar.matricula,
          posto_cadastro: postoAtualRaw,
          posto_historico: ultimoHistorico.posto_graduacao_novo,
          motivo: 'Posto do cadastro ou do histórico não reconhecido na hierarquia.'
        });
        continue;
      }

      // Cadastro preservado: histórico INFERIOR ao cadastro atual (nunca rebaixar).
      if (idxNovo < idxAtual) {
        debug.descartados.rebaixamento++;
        resumo.cadastros_preservados++;
        resumo.cadastros_preservados_detalhe.push({
          militar_id: mid,
          nome: militar.nome_completo || militar.nome_guerra || 'Militar ' + mid,
          matricula: militar.matricula,
          posto_cadastro: postoAtualRaw,
          posto_historico: ultimoHistorico.posto_graduacao_novo,
          mensagem: 'Cadastro atual superior ao histórico. Nenhuma ação automática realizada.'
        });
        continue;
      }

      const infoMilitar = {
        militar_id: mid,
        nome: militar.nome_completo || militar.nome_guerra || 'Militar ' + mid,
        matricula: militar.matricula,
        posto_anterior: militar.posto_graduacao,
        quadro_anterior: militar.quadro,
        posto_novo: ultimoHistorico.posto_graduacao_novo,
        quadro_novo: ultimoHistorico.quadro_novo,
        historico_id: ultimoHistorico.id,
        data_promocao: ultimoHistorico.data_promocao,
        tipo: 'atualização automática'
      };

      resumo.divergencias.push(infoMilitar);

      if (!dryRun) {
        pendingUpdates.push({
          militarId: mid,
          matricula: mat,
          nome: infoMilitar.nome,
          dados: {
            posto_graduacao: ultimoHistorico.posto_graduacao_novo,
            quadro: ultimoHistorico.quadro_novo
          },
          contexto: {
            executado_por: authUser.email,
            origem: 'sincronizacao_automatica_promocoes',
            historico_id: ultimoHistorico.id,
            posto_anterior: postoAtualRaw,
            quadro_anterior: quadroAtualRaw
          }
        });
      }
    }

    if (!dryRun && pendingUpdates.length > 0) {
      for (const update of pendingUpdates) {
        const isStort = update.matricula === "415.443-021" || update.matricula === "415443021";
        const stortDebug: any = isStort ? {
          militarId: update.militarId,
          matricula: update.matricula,
          payload_enviado: update.dados,
        } : null;

        try {
          // 1. Antes de atualizar, captura o valor atual "como o Efetivo vê" para o debug do Stort
          if (isStort) {
            const respAntes = await base44.functions.invoke('getScopedMilitares', { militarIds: [update.militarId] });
            const militarAntesEfetivo = respAntes?.data?.militares?.[0] || respAntes?.militares?.[0];
            stortDebug.valor_efetivo_antes = calcularPostoEfetivo(militarAntesEfetivo);
          }

          // 2. Executa a atualização robusta (sincroniza todos os aliases)
          const result = await atualizarCadastroMilitar(base44, update.militarId, update.dados, update.contexto);

          if (isStort) {
            stortDebug.retorno_bruto_update = result;
          }

          if (result.success) {
            // 3. RE-LEITURA ALINHADA AO EFETIVO (Task 4)
            // Não basta o result.success (que usa Militar.get), precisamos provar que getScopedMilitares reflete a mudança.
            const respDepois = await base44.functions.invoke('getScopedMilitares', { militarIds: [update.militarId] });
            const militarDepoisEfetivo = respDepois?.data?.militares?.[0] || respDepois?.militares?.[0];
            const valorPosVerificacao = calcularPostoEfetivo(militarDepoisEfetivo);

            if (isStort) {
              stortDebug.militar_relido_efetivo = militarDepoisEfetivo;
              stortDebug.valor_calculado_efetivo_depois = valorPosVerificacao;
            }

            if (valorPosVerificacao === update.dados.posto_graduacao) {
              resumo.atualizados++;
            } else {
              // Task 5: Se a atualização não refletir no Efetivo, falha.
              resumo.falhas.push({
                militar: update.nome,
                matricula: update.matricula,
                militar_id: update.militarId,
                erro: `A atualização foi persistida mas o Efetivo continua exibindo "${valorPosVerificacao}" (esperado: "${update.dados.posto_graduacao}"). Verifique aliases ou projeção da view.`,
                detalhe_releitura: militarDepoisEfetivo
              });
            }
          } else {
            // Falha reportada pela utility (ex: erro de API ou releitura inconsistente no Get)
            for (const u of result.updates) {
                if (!u.confirmado || result.erro_api) {
                    resumo.falhas.push({
                        militar: update.nome,
                        matricula: result.matricula,
                        militar_id: update.militarId,
                        campo_tentado: u.campo,
                        valor_anterior: u.anterior,
                        valor_esperado: u.esperado,
                        valor_apos_releitura: u.apos_releitura,
                        erro_api: result.erro_api
                    });
                }
            }
          }
        } catch (err: any) {
          resumo.falhas.push({
            militar: update.nome,
            militar_id: update.militarId,
            erro: err.message || String(err)
          });
          if (isStort) stortDebug.erro_fatal = err.message || String(err);
        }

        if (isStort) {
          resumo.stort_debug = stortDebug;
        }
      }
    }

    return Response.json({ success: true, dryRun, resumo, debug });

  } catch (error: any) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});