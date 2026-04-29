import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const PAGE_SIZE = 200;
const MAX_PAGES = 100;

function normalizarTexto(valor) {
  if (!valor || typeof valor !== 'string') return '';
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

async function listarTodos(entityClient, filtro) {
  const resultados = [];
  for (let pagina = 0; pagina < MAX_PAGES; pagina += 1) {
    const lote = await entityClient.filter(filtro, '-created_date', PAGE_SIZE, pagina * PAGE_SIZE);
    if (!Array.isArray(lote) || lote.length === 0) break;
    resultados.push(...lote);
    if (lote.length < PAGE_SIZE) break;
  }
  return resultados;
}

function indexarSubgrupamentos(subgrupamentos) {
  const porId = new Map();
  const porNomeNormalizado = new Map();
  for (const sub of subgrupamentos) {
    porId.set(sub.id, sub);
    const chave = normalizarTexto(sub.nome);
    if (!chave) continue;
    if (!porNomeNormalizado.has(chave)) porNomeNormalizado.set(chave, []);
    porNomeNormalizado.get(chave).push(sub);
  }
  return { porId, porNomeNormalizado };
}

function pontuarTipo(tipo) {
  if (tipo === 'Unidade') return 3;
  if (tipo === 'Subgrupamento') return 2;
  if (tipo === 'Grupamento') return 1;
  return 0;
}

function tentarDesambiguar(candidatos, militar, indices) {
  const grupamentoMilitar = normalizarTexto(militar.grupamento_nome);

  if (grupamentoMilitar) {
    const filtradosPorPai = candidatos.filter((c) => {
      const pai = c.parent_id ? indices.porId.get(c.parent_id) : null;
      const raiz = c.grupamento_raiz_id ? indices.porId.get(c.grupamento_raiz_id) : null;
      const grupamentoDireto = c.grupamento_id ? indices.porId.get(c.grupamento_id) : null;

      const nomesPai = [
        normalizarTexto(c.parent_nome),
        normalizarTexto(c.grupamento_nome),
        normalizarTexto(c.grupamento_raiz_nome),
        pai ? normalizarTexto(pai.nome) : '',
        raiz ? normalizarTexto(raiz.nome) : '',
        grupamentoDireto ? normalizarTexto(grupamentoDireto.nome) : '',
      ].filter(Boolean);

      return nomesPai.includes(grupamentoMilitar);
    });

    if (filtradosPorPai.length === 1) return { match: filtradosPorPai[0], motivo: 'desambiguado_por_grupamento' };
    if (filtradosPorPai.length > 1) candidatos = filtradosPorPai;
  }

  if (militar.grupamento_id) {
    const porIdGrupamento = candidatos.filter((c) => (
      c.grupamento_id === militar.grupamento_id || c.grupamento_raiz_id === militar.grupamento_id || c.parent_id === militar.grupamento_id
    ));
    if (porIdGrupamento.length === 1) return { match: porIdGrupamento[0], motivo: 'desambiguado_por_grupamento_id' };
    if (porIdGrupamento.length > 1) candidatos = porIdGrupamento;
  }

  const ordenados = [...candidatos].sort((a, b) => pontuarTipo(b.tipo) - pontuarTipo(a.tipo));
  const melhor = ordenados[0];
  const empate = ordenados.filter((c) => pontuarTipo(c.tipo) === pontuarTipo(melhor.tipo));
  if (empate.length === 1) return { match: melhor, motivo: 'desambiguado_por_tipo' };

  return { match: null, motivo: 'ambiguo', candidatos: empate };
}

function localizarEstrutura(militar, indices) {
  const subNome = normalizarTexto(militar.subgrupamento_nome);
  const grupNome = normalizarTexto(militar.grupamento_nome);

  let candidatosBase = [];
  let chaveUsada = '';

  if (subNome) {
    candidatosBase = indices.porNomeNormalizado.get(subNome) || [];
    chaveUsada = 'subgrupamento_nome';
  }

  if (candidatosBase.length === 0 && grupNome) {
    candidatosBase = indices.porNomeNormalizado.get(grupNome) || [];
    chaveUsada = 'grupamento_nome';
  }

  if (candidatosBase.length === 0) {
    return { status: 'nao_encontrado', motivo: 'nenhum_subgrupamento_com_nome_igual', chaveUsada };
  }

  const preferidos = candidatosBase.filter((c) => c.tipo === 'Unidade' || c.tipo === 'Subgrupamento');
  const candidatos = preferidos.length > 0 ? preferidos : candidatosBase;

  if (candidatos.length === 1) {
    return { status: 'migravel', match: candidatos[0], motivo: 'match_unico', chaveUsada };
  }

  const desambiguado = tentarDesambiguar(candidatos, militar, indices);
  if (desambiguado.match) {
    return { status: 'migravel', match: desambiguado.match, motivo: desambiguado.motivo, chaveUsada };
  }

  return {
    status: 'ambiguo',
    candidatos: desambiguado.candidatos || candidatos,
    motivo: 'multiplos_matches_sem_desambiguacao',
    chaveUsada,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const dryRun = body.dryRun !== false; // default true

    const [militaresAtivos, subgrupamentos] = await Promise.all([
      listarTodos(base44.asServiceRole.entities.Militar, { status_cadastro: 'Ativo' }),
      listarTodos(base44.asServiceRole.entities.Subgrupamento, {}),
    ]);

    const indices = indexarSubgrupamentos(subgrupamentos);

    const totalAnalisado = militaresAtivos.length;
    let totalComEstrutura = 0;
    let totalSemEstrutura = 0;
    let totalSemCamposTextuais = 0;

    const migraveis = [];
    const ambiguos = [];
    const naoEncontrados = [];

    for (const militar of militaresAtivos) {
      if (militar.estrutura_id) {
        totalComEstrutura += 1;
        continue;
      }
      totalSemEstrutura += 1;

      const temSub = militar.subgrupamento_nome && militar.subgrupamento_nome.trim();
      const temGrup = militar.grupamento_nome && militar.grupamento_nome.trim();
      if (!temSub && !temGrup) {
        totalSemCamposTextuais += 1;
        naoEncontrados.push({
          militar_id: militar.id,
          nome_completo: militar.nome_completo,
          nome_guerra: militar.nome_guerra,
          posto_graduacao: militar.posto_graduacao,
          subgrupamento_nome: militar.subgrupamento_nome || null,
          grupamento_nome: militar.grupamento_nome || null,
          motivo: 'sem_campos_textuais_de_lotacao',
        });
        continue;
      }

      const resultado = localizarEstrutura(militar, indices);

      if (resultado.status === 'migravel') {
        migraveis.push({
          militar_id: militar.id,
          nome_completo: militar.nome_completo,
          nome_guerra: militar.nome_guerra,
          posto_graduacao: militar.posto_graduacao,
          subgrupamento_nome: militar.subgrupamento_nome || null,
          grupamento_nome: militar.grupamento_nome || null,
          estrutura_id_proposto: resultado.match.id,
          estrutura_nome_proposto: resultado.match.nome,
          estrutura_tipo_proposto: resultado.match.tipo,
          lotacao_atual: militar.lotacao || '',
          lotacao_proposta: militar.lotacao && militar.lotacao.trim() ? militar.lotacao : resultado.match.nome,
          motivo: resultado.motivo,
          chave_usada: resultado.chaveUsada,
        });
      } else if (resultado.status === 'ambiguo') {
        ambiguos.push({
          militar_id: militar.id,
          nome_completo: militar.nome_completo,
          nome_guerra: militar.nome_guerra,
          posto_graduacao: militar.posto_graduacao,
          subgrupamento_nome: militar.subgrupamento_nome || null,
          grupamento_nome: militar.grupamento_nome || null,
          motivo: resultado.motivo,
          chave_usada: resultado.chaveUsada,
          candidatos: resultado.candidatos.map((c) => ({
            id: c.id,
            nome: c.nome,
            tipo: c.tipo,
            sigla: c.sigla,
            grupamento_nome: c.grupamento_nome || null,
            parent_id: c.parent_id || null,
          })),
        });
      } else {
        naoEncontrados.push({
          militar_id: militar.id,
          nome_completo: militar.nome_completo,
          nome_guerra: militar.nome_guerra,
          posto_graduacao: militar.posto_graduacao,
          subgrupamento_nome: militar.subgrupamento_nome || null,
          grupamento_nome: militar.grupamento_nome || null,
          motivo: resultado.motivo,
          chave_usada: resultado.chaveUsada,
        });
      }
    }

    const relatorio = {
      modo: dryRun ? 'dry-run' : 'execucao',
      executado_em: new Date().toISOString(),
      totais: {
        total_analisado: totalAnalisado,
        total_com_estrutura_id_preenchido: totalComEstrutura,
        total_sem_estrutura_id: totalSemEstrutura,
        total_sem_campos_textuais: totalSemCamposTextuais,
        total_migravel_automaticamente: migraveis.length,
        total_ambiguo: ambiguos.length,
        total_nao_encontrado: naoEncontrados.length,
      },
      migraveis,
      ambiguos,
      nao_encontrados: naoEncontrados,
    };

    if (dryRun) {
      return Response.json({
        ...relatorio,
        nenhum_dado_alterado: true,
        observacao: 'Dry-run executado. Nenhum registro de Militar foi atualizado. Para aplicar, invoque novamente com {"dryRun": false}.',
      });
    }

    let atualizados = 0;
    const erros = [];
    for (const item of migraveis) {
      try {
        await base44.asServiceRole.entities.Militar.update(item.militar_id, {
          estrutura_id: item.estrutura_id_proposto,
          estrutura_nome: item.estrutura_nome_proposto,
          estrutura_tipo: item.estrutura_tipo_proposto,
          lotacao: item.lotacao_proposta,
        });
        atualizados += 1;
      } catch (err) {
        erros.push({ militar_id: item.militar_id, error: err.message });
      }
    }

    return Response.json({
      ...relatorio,
      execucao: {
        atualizados,
        erros,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});