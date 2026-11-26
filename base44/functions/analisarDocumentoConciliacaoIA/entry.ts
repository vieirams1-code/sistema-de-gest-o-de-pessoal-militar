import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

// =====================================================================
// analisarDocumentoConciliacaoIA
// ---------------------------------------------------------------------
// Análise assistida por IA da conciliação documental (BG, BGR e DOEMS).
//
// Princípio: o casamento de nomes é DETERMINÍSTICO e por item. Para cada
// nota, o sistema seleciona apenas os militares cujo nome aparece no
// próprio texto daquela nota e envia essa lista curta para a IA. A IA só
// pode escolher dentro dela; qualquer resposta fora da lista é descartada.
// Isso elimina a troca de militares de mesmo posto e impede que uma nota
// seja vinculada a alguém que não é citado nela.
//
// A IA apenas SUGERE: não grava nada e não altera publicações. Toda
// importação depende de revisão e confirmação do usuário no frontend.
// =====================================================================

const TIPOS_ACEITOS = new Set(['BG', 'BGR', 'DOEMS']);
const LIMITE_ITENS = 80;
const LIMITE_CARACTERES_ITENS = 90000;
const LIMITE_CANDIDATOS = 3000;
const LIMITE_TRECHO = 4000;
const LIMITE_NOME = 120;
const MAX_FRACOS = 6;

const ESQUEMA = {
  type: 'object',
  properties: {
    sugestoes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          item_id: { type: 'string' },
          militar_id: { type: 'string' },
          confianca: { type: 'string', enum: ['alta', 'media', 'baixa'] },
          motivo: { type: 'string' },
          trecho_evidencia: { type: 'string' },
          tipo_sugerido: { type: 'string' },
          resumo: { type: 'string' },
        },
        required: ['item_id', 'confianca', 'motivo'],
      },
    },
    observacoes: { type: 'string' },
  },
  required: ['sugestoes'],
};

function limparTexto(valor: any, max: number) {
  return String(valor ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function normalizar(valor: any) {
  return String(valor ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function tokensDe(valor: any, minimo = 2) {
  return normalizar(valor).split(' ').filter((token) => token.length >= minimo);
}

function normalizarConfianca(valor: any) {
  const texto = String(valor ?? '').trim().toLowerCase();
  if (texto === 'alta' || texto === 'media' || texto === 'baixa') return texto;
  return 'baixa';
}

function prepararMilitar(bruto: any) {
  return {
    id: String(bruto.id),
    posto: limparTexto(bruto.posto, 40),
    nome_guerra: limparTexto(bruto.nome_guerra, LIMITE_NOME),
    nome_completo: limparTexto(bruto.nome_completo, LIMITE_NOME),
    matricula: limparTexto(bruto.matricula, 30),
    guerra: tokensDe(bruto.nome_guerra, 2),
    completo: tokensDe(bruto.nome_completo, 4),
    matriculaChave: normalizar(bruto.matricula).replace(/ /g, ''),
  };
}

// Quantos militares compartilham cada token: usado para medir o poder de
// discriminação de um nome completo (tokens raros são indício, comuns não).
function construirIndice(militares: any[]) {
  const frequencia = new Map<string, number>();
  for (const militar of militares) {
    for (const token of new Set([...militar.guerra, ...militar.completo])) {
      frequencia.set(token, (frequencia.get(token) || 0) + 1);
    }
  }
  return frequencia;
}

// Seleciona, para UM item, os militares citados no texto desse item.
// Fortes: todos os nomes de guerra presentes, ou dois nomes do nome
// completo, ou a matrícula. Fracos: apenas um indício parcial (usado só
// para conferência manual, nunca para vínculo automático).
function selecionarCandidatosDoItem(texto: string, militares: any[], frequencia: Map<string, number>) {
  const normalizado = ' ' + normalizar(texto) + ' ';
  const palavras = new Set(normalizado.split(' ').filter(Boolean));
  const fortes: any[] = [];
  const fracos: any[] = [];

  for (const militar of militares) {
    const guerraOk = militar.guerra.length > 0 && militar.guerra.every((token: string) => palavras.has(token));
    const completoOk = militar.completo.filter((token: string) => palavras.has(token)).length >= 2;
    const matriculaOk = militar.matriculaChave.length >= 5 && normalizado.includes(' ' + militar.matriculaChave + ' ');

    if (guerraOk || completoOk || matriculaOk) {
      fortes.push(militar);
      continue;
    }

    const parcialGuerra = militar.guerra.some((token: string) => palavras.has(token) && token.length >= 4);
    const parcialCompleto = militar.completo.some((token: string) => (
      palavras.has(token) && token.length >= 6 && (frequencia.get(token) || 0) <= 3
    ));
    if (parcialGuerra || parcialCompleto) fracos.push(militar);
  }

  return { fortes, fracos: fracos.slice(0, MAX_FRACOS) };
}

function descreverMilitar(militar: any) {
  return [militar.posto, militar.nome_guerra || militar.nome_completo].filter(Boolean).join(' ');
}

function montarPrompt(tipo: string, metadados: any, itens: any[], selecao: Map<string, any>) {
  const contextoDocumento = [
    tipo === 'DOEMS' ? 'DIÁRIO OFICIAL (DOEMS)' : `BOLETIM ${tipo === 'BGR' ? 'RESERVADO (BGR)' : 'GERAL (BG)'}`,
    metadados.numero ? `Edição/número: ${metadados.numero}` : '',
    metadados.data ? `Data: ${metadados.data}` : '',
  ].filter(Boolean).join(' | ');

  const blocos = itens.map((item, indice) => {
    const { fortes, fracos } = selecao.get(item.id) || { fortes: [], fracos: [] };
    const lista = [...fortes, ...fracos].map((militar: any) => [
      `- id: ${militar.id}`,
      militar.posto ? `posto: ${militar.posto}` : '',
      militar.nome_guerra ? `nome de guerra: ${militar.nome_guerra}` : '',
      militar.nome_completo ? `nome completo: ${militar.nome_completo}` : '',
      militar.matricula ? `matrícula: ${militar.matricula}` : '',
    ].filter(Boolean).join(' | ')).join('\n');

    const cabecalho = [
      `### ITEM ${indice + 1}`,
      `item_id: ${item.id}`,
      item.numero ? `nota: ${item.numero}` : '',
      item.pagina ? `página: ${item.pagina}` : '',
    ].filter(Boolean).join(' | ');

    return [
      cabecalho,
      lista
        ? `MILITARES DO EFETIVO CITADOS NESTE ITEM (use apenas estes ids):\n${lista}`
        : 'MILITARES DO EFETIVO CITADOS NESTE ITEM: nenhum nome do efetivo foi localizado no texto deste item. Devolva militar_id vazio.',
      'TEXTO DO ITEM:',
      item.contexto,
    ].join('\n');
  }).join('\n\n');

  return [
    'Você é um analista documental de uma corporação militar (Corpo de Bombeiros Militar).',
    'Para CADA item (nota) abaixo, diga qual militar do efetivo é o responsável pelo ato, usando SOMENTE os militares listados dentro daquele item.',
    '',
    'REGRAS',
    '1. O nome citado no texto é a evidência principal. Compare letra a letra: nomes diferentes são pessoas diferentes, mesmo com o mesmo posto. Nunca troque um nome por outro parecido e nunca escolha alguém que não esteja citado no texto do item.',
    '2. Use somente ids da lista de militares daquele item. Nunca invente ids e nunca use militar de outro item.',
    '3. Posto/graduação serve apenas como confirmação. Abreviações: SD=Soldado, CB=Cabo, SGT=1º/2º/3º Sargento, SUB=Subtenente, ASP=Aspirante, TEN=1º/2º Tenente, CAP=Capitão, MAJ=Major, TEN CEL=Tenente Coronel, CEL=Coronel. Posto no texto inferior ao do cadastro indica outra pessoa; posto superior pode ser promoção ainda não lançada.',
    '4. Se dois ou mais militares listados no item continuarem possíveis, deixe militar_id vazio e explique o empate no motivo. Não escolha no chute.',
    '5. Se nenhum militar listado no item for realmente citado no texto, deixe militar_id vazio e explique no motivo. Nunca afirme que o militar não existe no efetivo: você apenas comparou este texto com esta lista.',
    '6. Classifique o ato em tipo_sugerido: Geral, Elogio Individual, Transcrição de Documentos, Designação de Função, Dispensa de Função, Melhoria de Comportamento, Punição, Curso/Estágio, Dispensa Recompensa, Saída Férias, Retorno Férias, Interrupção de Férias, Licença Maternidade, Licença Paternidade, Núpcias, Luto, Trânsito, Instalação, Deslocamento Missão, Outro.',
    '7. Em trecho_evidencia copie o trecho exato (até 400 caracteres) em que o nome aparece. Em resumo, descreva o ato em uma frase.',
    '8. Devolva exatamente uma sugestão por item recebido, sempre com o mesmo item_id.',
    '',
    `DOCUMENTO: ${contextoDocumento}`,
    '',
    blocos,
    '',
    'Responda somente no JSON do esquema solicitado.',
  ].join('\n');
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e: any) => (e?.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const permissoesResposta = await base44.functions.invoke('getUserPermissions', {});
    const permissoes: any = (permissoesResposta as any)?.data ?? permissoesResposta ?? {};
    const isAdmin = Boolean(permissoes?.isAdmin);
    const podeModulo = Boolean(permissoes?.modules?.conciliacao_boletim);
    const podeAcao = Boolean(permissoes?.actions?.visualizar_conciliacao_boletim);
    if (!isAdmin && !(podeModulo && podeAcao)) {
      return Response.json({ error: 'Sem permissão para a conciliação de documentos.' }, { status: 403 });
    }

    const payload: any = await req.json().catch(() => ({}));
    const tipo = String(payload?.tipo || '').trim().toUpperCase();
    if (!TIPOS_ACEITOS.has(tipo)) {
      return Response.json({ error: 'Tipo de documento inválido. Use BG, BGR ou DOEMS.' }, { status: 400 });
    }

    const itensRecebidos = Array.isArray(payload?.itens) ? payload.itens : [];
    if (!itensRecebidos.length) {
      return Response.json({ error: 'Nenhum trecho foi enviado para análise.' }, { status: 400 });
    }

    const itens: any[] = [];
    let caracteres = 0;
    for (const bruto of itensRecebidos) {
      if (itens.length >= LIMITE_ITENS) break;
      const contexto = limparTexto(bruto?.contexto, LIMITE_TRECHO);
      if (!contexto) continue;
      if (caracteres + contexto.length > LIMITE_CARACTERES_ITENS) break;
      caracteres += contexto.length;
      itens.push({
        id: limparTexto(bruto?.id, 80),
        numero: limparTexto(bruto?.numero, 20),
        pagina: limparTexto(bruto?.pagina, 10),
        contexto,
      });
    }
    if (!itens.length) {
      return Response.json({ error: 'Nenhum trecho com texto utilizável foi enviado.' }, { status: 400 });
    }

    const militares = (Array.isArray(payload?.candidatos) ? payload.candidatos : [])
      .filter((m: any) => m?.id)
      .slice(0, LIMITE_CANDIDATOS)
      .map(prepararMilitar);
    if (!militares.length) {
      return Response.json({ error: 'Nenhum militar do efetivo foi enviado para comparação.' }, { status: 400 });
    }

    // 1) Casamento determinístico por item — a lista enviada à IA é curta e
    //    específica da nota, então ela não tem como trocar por outro militar.
    const frequencia = construirIndice(militares);
    const selecao = new Map<string, any>();
    for (const item of itens) {
      selecao.set(item.id, selecionarCandidatosDoItem(item.contexto, militares, frequencia));
    }

    const prompt = montarPrompt(tipo, {
      numero: limparTexto(payload?.numero, 30),
      data: limparTexto(payload?.data, 10),
    }, itens, selecao);

    const resposta = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: ESQUEMA,
    });

    const saida: any = typeof resposta === 'string' ? JSON.parse(resposta) : (resposta || {});
    const porItemId = new Map<string, any>();
    for (const bruto of Array.isArray(saida?.sugestoes) ? saida.sugestoes : []) {
      const itemId = limparTexto(bruto?.item_id, 80);
      if (!itemId || !selecao.has(itemId) || porItemId.has(itemId)) continue;
      porItemId.set(itemId, bruto);
    }

    // 2) Montagem final: a escolha da IA só é aceita se estiver na lista
    //    daquele item. Sem escolha válida, o resultado é honesto: único
    //    candidato → identificado; vários → ambíguo; nenhum → sem
    //    correspondência (nunca "militar ausente do efetivo").
    const sugestoes: any[] = [];
    let identificados = 0;
    let ambiguos = 0;
    let semCorrespondencia = 0;

    for (const item of itens) {
      const { fortes, fracos } = selecao.get(item.id) || { fortes: [], fracos: [] };
      const candidatos = [...fortes, ...fracos];
      const idsValidos = new Set(candidatos.map((militar: any) => militar.id));
      const bruto = porItemId.get(item.id) || null;
      const idSugerido = limparTexto(bruto?.militar_id, 80);
      const militarSugerido = idSugerido && idsValidos.has(idSugerido)
        ? candidatos.find((militar: any) => militar.id === idSugerido)
        : null;
      const escolhidoEhForte = Boolean(militarSugerido)
        && fortes.some((militar: any) => militar.id === militarSugerido.id);

      let militar: any = null;
      let categoria = 'sem_correspondencia';
      let confianca = 'baixa';
      let motivo = '';

      if (militarSugerido && escolhidoEhForte) {
        militar = militarSugerido;
        categoria = 'identificado';
        confianca = normalizarConfianca(bruto?.confianca);
        motivo = limparTexto(bruto?.motivo, 600) || 'Militar citado no texto desta nota.';
      } else if (militarSugerido) {
        militar = militarSugerido;
        categoria = 'ambiguo';
        confianca = 'baixa';
        motivo = limparTexto(bruto?.motivo, 600)
          || 'O nome completo do militar não aparece integralmente nesta nota; confira no PDF antes de importar.';
      } else if (fortes.length === 1) {
        militar = fortes[0];
        categoria = 'identificado';
        confianca = 'media';
        motivo = `Único militar do efetivo com esse nome citado nesta nota (${descreverMilitar(militar)}). Confira o posto e o ato antes de importar.`;
      } else if (fortes.length > 1) {
        categoria = 'ambiguo';
        motivo = `Mais de um militar do efetivo corresponde ao nome citado nesta nota: ${fortes.slice(0, 5).map(descreverMilitar).join('; ')}. Selecione manualmente.`;
      } else if (candidatos.length > 0) {
        categoria = 'ambiguo';
        motivo = `Indício parcial de nome nesta nota (${candidatos.slice(0, 4).map(descreverMilitar).join('; ')}). Confirme no PDF antes de importar.`;
      } else {
        categoria = 'sem_correspondencia';
        motivo = 'Nenhum nome do efetivo foi localizado no texto desta nota. Isto não significa ausência do militar no efetivo: confira o PDF e vincule manualmente se necessário.';
      }

      if (categoria === 'identificado') identificados += 1;
      else if (categoria === 'ambiguo') ambiguos += 1;
      else semCorrespondencia += 1;

      sugestoes.push({
        item_id: item.id,
        categoria,
        militar_id: militar ? militar.id : '',
        militar_nome: militar ? (militar.nome_completo || militar.nome_guerra || '') : '',
        militar_posto: militar ? (militar.posto || '') : '',
        confianca,
        motivo,
        trecho_evidencia: limparTexto(bruto?.trecho_evidencia, 400),
        tipo_sugerido: limparTexto(bruto?.tipo_sugerido, 80),
        resumo: limparTexto(bruto?.resumo, 400),
      });
    }

    return Response.json({
      sugestoes,
      observacoes: limparTexto(saida?.observacoes, 1200),
      meta: {
        tipo,
        itensAnalisados: itens.length,
        itensRecebidos: itensRecebidos.length,
        itensIgnorados: Math.max(0, itensRecebidos.length - itens.length),
        itensIdentificados: identificados,
        itensAmbiguos: ambiguos,
        itensSemCorrespondencia: semCorrespondencia,
        candidatosConsiderados: militares.length,
        caracteresAnalisados: caracteres,
        creditosEstimados: 1,
      },
    });
  } catch (error: any) {
    return Response.json({ error: error?.message || 'Falha na análise assistida por IA.' }, { status: 500 });
  }
}