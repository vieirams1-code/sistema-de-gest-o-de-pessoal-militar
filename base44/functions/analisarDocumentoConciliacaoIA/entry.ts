import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

// =====================================================================
// analisarDocumentoConciliacaoIA
// ---------------------------------------------------------------------
// Análise assistida por IA da conciliação documental (BG, BGR e DOEMS).
// A IA apenas SUGERE: não grava nada, não altera publicações e não cria
// registros. Toda importação depende de revisão e confirmação do usuário
// no frontend, que grava via cudEscopado (com escopo e permissões).
// =====================================================================

const TIPOS_ACEITOS = new Set(['BG', 'BGR', 'DOEMS']);
const LIMITE_ITENS = 80;
const LIMITE_CARACTERES_ITENS = 90000;
const LIMITE_CANDIDATOS = 600;
const LIMITE_TRECHO = 4000;
const LIMITE_NOME = 120;

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
          militar_nome: { type: 'string' },
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

function montarPrompt(tipo: string, metadados: any, itens: any[], candidatos: any[]) {
  const contextoDocumento = [
    tipo === 'DOEMS' ? 'DIÁRIO OFICIAL (DOEMS)' : `BOLETIM ${tipo === 'BGR' ? 'RESERVADO (BGR)' : 'GERAL (BG)'}`,
    metadados.numero ? `Edição/número: ${metadados.numero}` : '',
    metadados.data ? `Data: ${metadados.data}` : '',
  ].filter(Boolean).join(' | ');

  const listaItens = itens.map((item, indice) => {
    const cabecalho = [
      `### ITEM ${indice + 1}`,
      `item_id: ${item.id}`,
      item.numero ? `nota: ${item.numero}` : '',
      item.pagina ? `página: ${item.pagina}` : '',
    ].filter(Boolean).join(' | ');
    return `${cabecalho}\n${item.contexto}`;
  }).join('\n\n');

  const listaCandidatos = candidatos.map((militar) => [
    `id: ${militar.id}`,
    militar.posto ? `posto: ${militar.posto}` : '',
    militar.nome_guerra ? `nome de guerra: ${militar.nome_guerra}` : '',
    militar.nome_completo ? `nome completo: ${militar.nome_completo}` : '',
    militar.matricula ? `matrícula: ${militar.matricula}` : '',
  ].filter(Boolean).join(' | ')).join('\n');

  return [
    'Você é um analista documental de uma corporação militar (Corpo de Bombeiros Militar).',
    'Sua tarefa é vincular cada trecho/nota do documento aos militares do efetivo informado.',
    '',
    'REGRA CENTRAL: você apenas sugere vínculos para revisão humana. Nunca invente dados.',
    '',
    'Como decidir:',
    '1. O documento cita apenas posto/graduação e nome de guerra. O nome de guerra isolado NÃO é prova suficiente quando houver mais de um militar com o mesmo nome de guerra.',
    '2. Use como evidência forte: matrícula citada, nome completo citado no texto, nome de guerra único no efetivo combinado com o posto compatível, e o contexto do ato (quem é nomeado, elogiado, punido, dispensado, removido).',
    '3. Posto do documento INFERIOR ao do cadastro indica pessoas diferentes (o cadastro pode estar adiantado, nunca atrasado). Posto superior no documento pode indicar promoção ainda não lançada: sinalize para revisão.',
    '4. Se dois ou mais militares continuarem possíveis, escolha o mais provável e use confianca "baixa"; explique o empate no motivo.',
    '5. Se não houver evidência suficiente, omita militar_id e use confianca "baixa" com motivo explicando o que falta conferir.',
    '6. Use somente ids existentes na lista de efetivo. Nunca invente ids.',
    '7. Classifique o ato em tipo_sugerido, usando termos como: Geral, Elogio Individual, Transcrição de Documentos, Designação de Função, Dispensa de Função, Melhoria de Comportamento, Punição, Curso/Estágio, Dispensa Recompensa, Saída Férias, Retorno Férias, Interrupção de Férias, Licença Maternidade, Licença Paternidade, Núpcias, Luto, Trânsito, Instalação, Deslocamento Missão, Outro.',
    '8. Em trecho_evidencia copie o trecho exato (até 400 caracteres) que sustenta a conclusão. Em resumo, descreva o ato em uma frase.',
    '9. Devolva uma sugestão por item recebido, sempre com o mesmo item_id.',
    '',
    `DOCUMENTO: ${contextoDocumento}`,
    '',
    'EFETIVO DISPONÍVEL (use apenas estes militares):',
    listaCandidatos || '(nenhum militar disponível)',
    '',
    'ITENS PARA ANÁLISE:',
    listaItens,
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

    const candidatos = (Array.isArray(payload?.candidatos) ? payload.candidatos : [])
      .filter((m: any) => m?.id)
      .slice(0, LIMITE_CANDIDATOS)
      .map((m: any) => ({
        id: String(m.id),
        posto: limparTexto(m.posto, 40),
        nome_guerra: limparTexto(m.nome_guerra, LIMITE_NOME),
        nome_completo: limparTexto(m.nome_completo, LIMITE_NOME),
        matricula: limparTexto(m.matricula, 30),
      }));
    if (!candidatos.length) {
      return Response.json({ error: 'Nenhum militar do efetivo foi enviado para comparação.' }, { status: 400 });
    }

    const prompt = montarPrompt(tipo, {
      numero: limparTexto(payload?.numero, 30),
      data: limparTexto(payload?.data, 10),
    }, itens, candidatos);

    const resposta = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: ESQUEMA,
    });

    const saida: any = typeof resposta === 'string' ? JSON.parse(resposta) : (resposta || {});
    const idsItens = new Set(itens.map((item) => item.id));
    const porId = new Map(candidatos.map((m: any) => [m.id, m]));
    const vistos = new Set();
    const sugestoes: any[] = [];

    for (const bruto of Array.isArray(saida?.sugestoes) ? saida.sugestoes : []) {
      const itemId = limparTexto(bruto?.item_id, 80);
      if (!itemId || !idsItens.has(itemId) || vistos.has(itemId)) continue;
      vistos.add(itemId);
      const militarId = limparTexto(bruto?.militar_id, 80);
      const militar: any = militarId ? porId.get(militarId) : null;
      sugestoes.push({
        item_id: itemId,
        militar_id: militar ? militar.id : '',
        militar_nome: militar ? (militar.nome_completo || militar.nome_guerra || '') : '',
        militar_posto: militar ? (militar.posto || '') : '',
        confianca: normalizarConfianca(bruto?.confianca),
        motivo: limparTexto(bruto?.motivo, 600),
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
        candidatosConsiderados: candidatos.length,
        caracteresAnalisados: caracteres,
        creditosEstimados: 1,
      },
    });
  } catch (error: any) {
    return Response.json({ error: error?.message || 'Falha na análise assistida por IA.' }, { status: 500 });
  }
}