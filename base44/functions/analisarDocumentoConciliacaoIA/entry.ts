import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import {
  prepararIdentidadeMilitar,
  selecionarCitadosNoItem,
  descreverMilitar,
  descreverProva,
} from '../../shared/conciliacao/identidadeMilitar.ts';

// =====================================================================
// analisarDocumentoConciliacaoIA
// ---------------------------------------------------------------------
// Análise assistida por IA da conciliação documental (BG, BGR e DOEMS).
//
// Princípio: a IDENTIDADE é determinística e por item. Para cada nota, o
// sistema só considera citado o militar cujo NOME COMPLETO cadastrado
// aparece integralmente no texto daquela nota ou cuja MATRÍCULA aparece
// no texto. Nome de guerra, sobrenome isolado e nomes parecidos não
// identificam ninguém — é isso que eliminava os falsos positivos.
//
// A IA recebe apenas essa lista curta por item e serve para descrever o
// ato (tipo, resumo, trecho) e apontar quem é o responsável. Ela não pode
// ampliar a lista: qualquer id fora dela é descartado.
//
// A IA apenas SUGERE: não grava nada e não altera publicações. Toda
// importação depende de revisão e confirmação do usuário no frontend.
// =====================================================================

const TIPOS_ACEITOS = new Set(['BG', 'BGR', 'DOEMS']);
const LIMITE_ITENS = 80;
const LIMITE_CARACTERES_ITENS = 90000;
const LIMITE_CANDIDATOS = 3000;
const LIMITE_TRECHO = 4000;

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

function normalizarConfianca(valor: any) {
  const texto = String(valor ?? '').trim().toLowerCase();
  if (texto === 'alta' || texto === 'media' || texto === 'baixa') return texto;
  return 'baixa';
}

function montarPrompt(tipo: string, metadados: any, itens: any[], selecao: Map<string, any[]>) {
  const contextoDocumento = [
    tipo === 'DOEMS' ? 'DIÁRIO OFICIAL (DOEMS)' : `BOLETIM ${tipo === 'BGR' ? 'RESERVADO (BGR)' : 'GERAL (BG)'}`,
    metadados.numero ? `Edição/número: ${metadados.numero}` : '',
    metadados.data ? `Data: ${metadados.data}` : '',
  ].filter(Boolean).join(' | ');

  const blocos = itens.map((item, indice) => {
    const citados = selecao.get(item.id) || [];
    const lista = citados.map((militar: any) => [
      `- id: ${militar.id}`,
      militar.posto ? `posto: ${militar.posto}` : '',
      militar.nome_guerra ? `nome de guerra: ${militar.nome_guerra}` : '',
      militar.nome_completo ? `nome completo: ${militar.nome_completo}` : '',
      militar.matricula ? `matrícula: ${militar.matricula}` : '',
      `prova no texto: ${descreverProva(militar)}`,
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
        ? `MILITARES DO EFETIVO COM NOME COMPLETO OU MATRÍCULA NESTE ITEM (use apenas estes ids):\n${lista}`
        : 'MILITARES DO EFETIVO NESTE ITEM: nenhum nome completo nem matrícula do efetivo foi localizado no texto deste item. Devolva militar_id vazio.',
      'TEXTO DO ITEM:',
      item.contexto,
    ].join('\n');
  }).join('\n\n');

  return [
    'Você é um analista documental de uma corporação militar (Corpo de Bombeiros Militar).',
    'Para CADA item (nota) abaixo, identifique o militar do efetivo responsável pelo ato.',
    'A lista de cada item já foi verificada pelo sistema: contém somente militares cujo NOME COMPLETO cadastrado ou MATRÍCULA aparece no texto daquele item.',
    '',
    'REGRAS',
    '1. A identidade foi decidida pelo sistema com base no nome completo ou na matrícula. Não amplie nem substitua essa decisão: nunca escolha alguém por nome de guerra, sobrenome, posto ou semelhança de nome.',
    '2. Use somente ids da lista daquele item. Nunca invente ids e nunca use militar de outro item.',
    '3. Se a lista do item tiver mais de um militar, escolha apenas aquele a quem o texto atribui o ato. Se o texto não permitir decidir, devolva militar_id vazio e explique o empate no motivo.',
    '4. Se o texto do item não tratar de nenhum dos militares listados, devolva militar_id vazio e explique no motivo. Nunca afirme que o militar não existe no efetivo: você apenas comparou este texto com esta lista.',
    '5. Classifique o ato em tipo_sugerido: Geral, Elogio Individual, Transcrição de Documentos, Designação de Função, Dispensa de Função, Melhoria de Comportamento, Punição, Curso/Estágio, Dispensa Recompensa, Saída Férias, Retorno Férias, Interrupção de Férias, Licença Maternidade, Licença Paternidade, Núpcias, Luto, Trânsito, Instalação, Deslocamento Missão, Outro.',
    '6. Em trecho_evidencia copie o trecho exato (até 400 caracteres) em que o nome completo ou a matrícula aparece. Em resumo, descreva o ato em uma frase.',
    '7. Devolva exatamente uma sugestão por item recebido, sempre com o mesmo item_id.',
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
      .map(prepararIdentidadeMilitar);
    if (!militares.length) {
      return Response.json({ error: 'Nenhum militar do efetivo foi enviado para comparação.' }, { status: 400 });
    }

    // 1) Identidade determinística por item: nome completo contíguo ou
    //    matrícula, nada além disso.
    const selecao = new Map<string, any[]>();
    for (const item of itens) {
      selecao.set(item.id, selecionarCitadosNoItem(item.contexto, militares));
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
    //    daquele item. A identificação vem da prova determinística; sem
    //    nome completo nem matrícula, a nota fica sem correspondência
    //    (nunca "militar ausente do efetivo").
    const sugestoes: any[] = [];
    let identificados = 0;
    let ambiguos = 0;
    let semCorrespondencia = 0;

    for (const item of itens) {
      const citados = selecao.get(item.id) || [];
      const bruto = porItemId.get(item.id) || null;
      const idSugerido = limparTexto(bruto?.militar_id, 80);
      const escolhido = idSugerido
        ? citados.find((militar: any) => militar.id === idSugerido) || null
        : null;
      const porMatricula = citados.filter((militar: any) => militar.viaMatricula);

      let militar: any = null;
      let categoria = 'sem_correspondencia';
      let confianca = 'baixa';
      let motivo = '';

      if (porMatricula.length === 1) {
        militar = porMatricula[0];
        categoria = 'identificado';
        confianca = 'alta';
        motivo = `Matrícula ${militar.matricula} localizada no texto desta nota (${descreverMilitar(militar)}).`;
      } else if (citados.length === 1) {
        militar = citados[0];
        categoria = 'identificado';
        confianca = 'alta';
        motivo = `Nome completo ${descreverProva(militar)} localizado no texto desta nota (${descreverMilitar(militar)}).`;
      } else if (citados.length > 1) {
        categoria = 'ambiguo';
        militar = escolhido;
        const lista = citados.slice(0, 5).map(descreverMilitar).join('; ');
        motivo = militar
          ? `Mais de um militar do efetivo tem nome completo ou matrícula no texto desta nota (${lista}). Sugestão da IA: ${descreverMilitar(militar)}. Confirme no PDF antes de importar.`
          : `Mais de um militar do efetivo tem nome completo ou matrícula no texto desta nota (${lista}). Selecione manualmente.`;
      } else {
        categoria = 'sem_correspondencia';
        motivo = 'Não há, no texto desta nota, o nome completo cadastrado nem a matrícula de nenhum militar do efetivo. Isso não significa ausência do militar no efetivo: confira o PDF e vincule manualmente se necessário.';
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