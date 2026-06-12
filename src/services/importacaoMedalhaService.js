import { base44 } from '@/api/base44Client';
import { strFromU8, unzipSync } from 'fflate';
import { ordenarMilitaresPorAntiguidadeInstitucional } from '@/utils/antiguidade/ordenacaoMilitarInstitucional';
import { normalizarStatusMedalha } from './medalhasTempoServicoService';

/**
 * Módulo de Migração de Medalhas (Genérico).
 */

export const STATUS_LINHA_MEDALHA = Object.freeze({
  PRONTO: 'Pronto',
  MILITAR_NAO_ENCONTRADO: 'Militar não encontrado',
  DOEMS_INVALIDO: 'DOEMS inválido',
  DATA_INVALIDA: 'Data inválida',
  JA_IMPORTADO: 'Já importado',
  DUPLICADO_PLANILHA: 'Duplicado na planilha',
  ERRO: 'Erro',
  ERRO_IMPORTACAO: 'Erro na importação',
});

export const CONFIG_MEDALHAS = {
  DOM_PEDRO_II: {
    codigo: 'DOM_PEDRO_II',
    nome: 'Medalha Dom Pedro II',
    getTextoAlteracao: (numero, data) => `Concedida a Medalha Dom Pedro II, conforme publicação no DOEMS nº ${numero}, de ${data}.`,
  },
  TEMPO_10: {
    codigo: 'TEMPO_10',
    nome: 'Medalha de Tempo de Serviço - 10 anos',
    getTextoAlteracao: (numero, data) => `Concedida a Medalha de 10 anos de serviço, conforme publicação no DOEMS nº ${numero}, de ${data}.`,
  },
  TEMPO_20: {
    codigo: 'TEMPO_20',
    nome: 'Medalha de Tempo de Serviço - 20 anos',
    getTextoAlteracao: (numero, data) => `Concedida a Medalha de 20 anos de serviço, conforme publicação no DOEMS nº ${numero}, de ${data}.`,
  },
  TEMPO_30: {
    codigo: 'TEMPO_30',
    nome: 'Medalha de Tempo de Serviço - 30 anos',
    getTextoAlteracao: (numero, data) => `Concedida a Medalha de 30 anos de serviço, conforme publicação no DOEMS nº ${numero}, de ${data}.`,
  },
  TEMPO_40: {
    codigo: 'TEMPO_40',
    nome: 'Medalha de Tempo de Serviço - 40 anos',
    getTextoAlteracao: (numero, data) => `Concedida a Medalha de 40 anos de serviço, conforme publicação no DOEMS nº ${numero}, de ${data}.`,
  },
};

const HEADER_ALIAS = {
  militar_nome: ['militares do cbmms', 'militar', 'nome', 'nome completo', 'militar_nome'],
  doems: ['doems', 'doems numero', 'numero doems', 'publicacao', 'publicação'],
  data: ['data', 'data doems', 'data da publicacao', 'data da publicação'],
};

function limparTexto(valor) {
  if (valor === null || valor === undefined) return '';
  return String(valor).trim();
}

export function normalizarNome(valor) {
  return limparTexto(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizarDoems(valor) {
  const txt = limparTexto(valor).toUpperCase();
  if (!txt) return '';
  // Remove prefixos como "BG ", "DOEMS ", "DO "
  const match = txt.match(/(?:BG|DOEMS|DO|Nº|N)\s*([0-9./-]+)/i);
  if (match) return match[1];
  // Se for apenas número
  const soNumeros = txt.replace(/[^0-9./-]/g, '');
  return soNumeros || txt;
}

/**
 * Identifica se o valor (de DOEMS ou Data) refere-se a uma informação oficial da DP
 * (quando a publicação original não foi localizada).
 */
export function ehInformacaoDP(valor) {
  const txt = normalizarNome(valor);
  return txt === 'nao localizado' || txt === 'informacao dp' || txt === '-';
}

export function parseDataExcel(valor) {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    const ano = valor.getUTCFullYear();
    const mes = String(valor.getUTCMonth() + 1).padStart(2, '0');
    const dia = String(valor.getUTCDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }
  const txt = limparTexto(valor);
  if (!txt) return null;

  // DD/MM/AAAA
  const br = txt.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) {
    const d = br[1].padStart(2, '0');
    const m = br[2].padStart(2, '0');
    return `${br[3]}-${m}-${d}`;
  }

  // AAAA-MM-DD
  const iso = txt.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // Excel Serial
  const numeric = Number(txt);
  if (Number.isFinite(numeric) && numeric > 59) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(excelEpoch.getTime() + numeric * 86400000);
    if (!Number.isNaN(date.getTime())) {
      const ano = date.getUTCFullYear();
      const mes = String(date.getUTCMonth() + 1).padStart(2, '0');
      const dia = String(date.getUTCDate()).padStart(2, '0');
      return `${ano}-${mes}-${dia}`;
    }
  }
  return null;
}

function formatarDataBr(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

function parseXml(s) {
  if (typeof DOMParser === 'undefined') {
    throw new Error('Leitura de .xlsx requer DOMParser disponível no navegador.');
  }
  return new DOMParser().parseFromString(s, 'application/xml');
}

function getZipText(arquivosZip, caminho) {
  const conteudo = arquivosZip[caminho];
  return conteudo ? strFromU8(conteudo) : null;
}

function extrairSharedStrings(arquivos) {
  const xml = getZipText(arquivos, 'xl/sharedStrings.xml');
  if (!xml) return [];
  const doc = parseXml(xml);
  return Array.from(doc.getElementsByTagName('si'))
    .map((si) => Array.from(si.getElementsByTagName('t')).map((t) => t.textContent || '').join(''));
}

function indiceColuna(ref) {
  const letras = (ref.match(/[A-Z]+/) || [''])[0];
  let i = 0;
  for (let k = 0; k < letras.length; k += 1) i = i * 26 + (letras.charCodeAt(k) - 64);
  return Math.max(i - 1, 0);
}

async function lerXlsx(file) {
  const buffer = await file.arrayBuffer();
  const arquivos = unzipSync(new Uint8Array(buffer));
  const shared = extrairSharedStrings(arquivos);
  const wbXml = getZipText(arquivos, 'xl/workbook.xml');
  const wbDoc = parseXml(wbXml);
  const primeira = wbDoc.getElementsByTagName('sheet')[0];
  const relsXml = getZipText(arquivos, 'xl/_rels/workbook.xml.rels');
  const relsDoc = parseXml(relsXml);
  const rel = Array.from(relsDoc.getElementsByTagName('Relationship'))
    .find((r) => r.getAttribute('Id') === primeira.getAttribute('r:id'));
  const sheetXml = getZipText(arquivos, `xl/${rel.getAttribute('Target')}`);
  const sheetDoc = parseXml(sheetXml);
  const linhasMap = new Map();
  Array.from(sheetDoc.getElementsByTagName('row')).forEach((row) => {
    const r = Number(row.getAttribute('r')) || linhasMap.size + 1;
    const linha = [];
    Array.from(row.getElementsByTagName('c')).forEach((c) => {
      const idx = indiceColuna(c.getAttribute('r') || '');
      const tipo = c.getAttribute('t');
      const vNode = c.getElementsByTagName('v')[0];
      const isNode = c.getElementsByTagName('is')[0];
      let valor = '';
      if (tipo === 'inlineStr' && isNode) {
        valor = Array.from(isNode.getElementsByTagName('t')).map((n) => n.textContent || '').join('');
      } else if (vNode) {
        const bruto = vNode.textContent || '';
        if (tipo === 's') {
          valor = shared[Number(bruto)] ?? '';
        } else {
          valor = bruto;
        }
      }
      linha[idx] = valor;
    });
    linhasMap.set(r, linha);
  });
  return Array.from(linhasMap.values());
}

/**
 * Função central de decisão para uma linha de importação.
 * Unifica a lógica da prévia e da importação efetiva.
 */
export function analisarLinhaImportacaoMedalha({
  nomeBruto,
  doemsBruto,
  dataBruta,
  medalhaCodigo,
  mapaMilitares,
  setMedalhasMilitarIdAtivas,
  contagemPlanilha,
}) {
  const nomeNorm = normalizarNome(nomeBruto);
  const isInformacaoDP = ehInformacaoDP(doemsBruto) || ehInformacaoDP(dataBruta);
  const doemsNorm = isInformacaoDP ? null : normalizarDoems(doemsBruto);
  const dataIso = parseDataExcel(dataBruta);

  let status = STATUS_LINHA_MEDALHA.PRONTO;
  const erros = [];
  const militaresEncontrados = mapaMilitares.get(nomeNorm) || [];

  if (!nomeNorm) {
    status = STATUS_LINHA_MEDALHA.ERRO;
    erros.push('Nome do militar ausente.');
  } else if (militaresEncontrados.length === 0) {
    status = STATUS_LINHA_MEDALHA.MILITAR_NAO_ENCONTRADO;
  } else if (militaresEncontrados.length > 1) {
    status = STATUS_LINHA_MEDALHA.ERRO;
    erros.push('Múltiplos militares encontrados com este nome.');
  }

  if (status === STATUS_LINHA_MEDALHA.PRONTO || status === STATUS_LINHA_MEDALHA.MILITAR_NAO_ENCONTRADO) {
    if (!isInformacaoDP) {
      if (!doemsNorm) {
        status = STATUS_LINHA_MEDALHA.DOEMS_INVALIDO;
      }
      if (!dataIso) {
        status = STATUS_LINHA_MEDALHA.DATA_INVALIDA;
      }
    }
  }

  const militar = militaresEncontrados[0] || null;

  // Duplicidade na planilha
  const chaveUnicaPlanilha = isInformacaoDP ? `${nomeNorm}|INFORMACAO_DP` : `${nomeNorm}|${doemsNorm}|${dataIso}`;
  if (contagemPlanilha.has(chaveUnicaPlanilha)) {
    status = STATUS_LINHA_MEDALHA.DUPLICADO_PLANILHA;
  } else {
    contagemPlanilha.set(chaveUnicaPlanilha, true);
  }

  // Já importado (na Base44)
  if (status === STATUS_LINHA_MEDALHA.PRONTO && militar && setMedalhasMilitarIdAtivas.has(String(militar.id))) {
    status = STATUS_LINHA_MEDALHA.JA_IMPORTADO;
  }

  return {
    militar_id: militar?.id || null,
    militar,
    militar_nome: militar?.nome_completo || nomeBruto,
    militar_matricula: militar?.matricula || '',
    militar_posto: militar?.posto_graduacao || '',
    doems_numero: doemsNorm,
    data_concessao: dataIso,
    status,
    erros,
    is_informacao_dp: isInformacaoDP,
    podeImportar: status === STATUS_LINHA_MEDALHA.PRONTO,
  };
}

export async function analisarPlanilhaMedalha(file, medalhaCodigo) {
  const tabela = await lerXlsx(file);
  if (!tabela.length) throw new Error('Planilha vazia.');

  const headers = tabela[0].map(h => normalizarNome(h));
  const colIndex = {
    militar_nome: headers.findIndex(h => HEADER_ALIAS.militar_nome.some(a => normalizarNome(a) === h)),
    doems: headers.findIndex(h => HEADER_ALIAS.doems.some(a => normalizarNome(a) === h)),
    data: headers.findIndex(h => HEADER_ALIAS.data.some(a => normalizarNome(a) === h)),
  };

  if (colIndex.militar_nome === -1 || colIndex.doems === -1 || colIndex.data === -1) {
    throw new Error('Colunas obrigatórias não encontradas. Certifique-se de que a planilha possui as colunas: MILITARES DO CBMMS, DOEMS, DATA.');
  }

  const rows = tabela.slice(1).filter(r => r.some(c => limparTexto(c)));

  // Cache de militares para busca por nome
  const todosMilitares = await base44.entities.Militar.list('-created_date');
  const mapaMilitares = new Map();
  todosMilitares.forEach(m => {
    const nomeNorm = normalizarNome(m.nome_completo);
    if (!mapaMilitares.has(nomeNorm)) mapaMilitares.set(nomeNorm, []);
    mapaMilitares.get(nomeNorm).push(m);
  });

  // Medalhas do tipo selecionado já existentes (Ativas)
  const configMedalha = CONFIG_MEDALHAS[medalhaCodigo];
  if (!configMedalha) throw new Error(`Configuração de medalha não encontrada: ${medalhaCodigo}`);

  const medalhasExistentes = await base44.entities.Medalha.filter({ tipo_medalha_codigo: medalhaCodigo });
  const setMedalhasMilitarIdAtivas = new Set(
    medalhasExistentes
      .filter(m => {
        const st = normalizarStatusMedalha(m.status);
        return st !== 'CANCELADA' && st !== 'REVOGADA';
      })
      .map(m => String(m.militar_id))
  );

  const contagemPlanilha = new Map();

  let analise = rows.map((row, index) => {
    const nomeBruto = limparTexto(row[colIndex.militar_nome]);
    const doemsBruto = limparTexto(row[colIndex.doems]);
    const dataBruta = row[colIndex.data];

    const resultado = analisarLinhaImportacaoMedalha({
      nomeBruto,
      doemsBruto,
      dataBruta,
      medalhaCodigo,
      mapaMilitares,
      setMedalhasMilitarIdAtivas,
      contagemPlanilha,
    });

    return {
      rowIndex: index + 2,
      militar_nome_bruto: nomeBruto,
      doems_bruto: doemsBruto,
      data_bruta: dataBruta,
      tipo_medalha_codigo: medalhaCodigo,
      ...resultado,
    };
  });

  // Ordenação por antiguidade institucional
  analise.sort((a, b) => {
    if (a.militar && b.militar) {
      const listaOrdenada = ordenarMilitaresPorAntiguidadeInstitucional([a.militar, b.militar]);
      return listaOrdenada[0].id === a.militar.id ? -1 : 1;
    }
    if (a.militar) return -1;
    if (b.militar) return 1;
    return a.rowIndex - b.rowIndex;
  });

  return analise;
}

export async function importarMedalhas(linhas, userEmail) {
  const elegiveis = linhas.filter(l => l.podeImportar);
  if (!elegiveis.length) return { importados: 0, erros: 0, resultados: [] };

  let importados = 0;
  let erros = 0;
  const resultados = [];

  // Cache de tipos de medalha
  const tiposMedalha = await base44.entities.TipoMedalha.list();

  // Cache de militares e medalhas para re-verificação de integridade no momento da importação
  const todosMilitares = await base44.entities.Militar.list('-created_date');
  const mapaMilitares = new Map();
  todosMilitares.forEach(m => {
    const nomeNorm = normalizarNome(m.nome_completo);
    if (!mapaMilitares.has(nomeNorm)) mapaMilitares.set(nomeNorm, []);
    mapaMilitares.get(nomeNorm).push(m);
  });

  // Assumimos que todas as linhas elegíveis são do mesmo tipo de medalha
  const medalhaCodigo = elegiveis[0].tipo_medalha_codigo;
  const medalhasExistentes = await base44.entities.Medalha.filter({ tipo_medalha_codigo: medalhaCodigo });
  const setMedalhasMilitarIdAtivas = new Set(
    medalhasExistentes
      .filter(m => {
        const st = normalizarStatusMedalha(m.status);
        return st !== 'CANCELADA' && st !== 'REVOGADA';
      })
      .map(m => String(m.militar_id))
  );

  const contagemPlanilha = new Map();

  for (const linha of elegiveis) {
    try {
      // Re-verificar integridade
      const analiseFinal = analisarLinhaImportacaoMedalha({
        nomeBruto: linha.militar_nome_bruto,
        doemsBruto: linha.doems_bruto,
        dataBruta: linha.data_bruta,
        medalhaCodigo: linha.tipo_medalha_codigo,
        mapaMilitares,
        setMedalhasMilitarIdAtivas,
        contagemPlanilha,
      });

      if (!analiseFinal.podeImportar) {
        resultados.push({ rowIndex: linha.rowIndex, status: analiseFinal.status, erro: analiseFinal.erros.join(', ') });
        erros++;
        continue;
      }

      const config = CONFIG_MEDALHAS[linha.tipo_medalha_codigo];
      if (!config) throw new Error(`Configuração não encontrada para ${linha.tipo_medalha_codigo}`);

      const tipoMedalha = tiposMedalha.find(t => t.codigo === config.codigo);

      const dataBr = formatarDataBr(linha.data_concessao);
      const textoAlteracao = linha.is_informacao_dp
        ? `Concedida a ${config.nome}. Informação oficial da Diretoria de Pessoal (publicação original não localizada).`
        : config.getTextoAlteracao(linha.doems_numero, dataBr);

      const observacoesDP = "Concessão informada oficialmente pela Diretoria de Pessoal. A publicação correspondente não foi localizada em razão da limitação de pesquisa textual dos DOEMS anteriores a 2007.";

      // 1. Criar Registro de Medalha
      await base44.entities.Medalha.create({
        militar_id: linha.militar_id,
        militar_nome: linha.militar_nome,
        militar_matricula: linha.militar_matricula,
        militar_posto: linha.militar_posto,
        tipo_medalha_id: tipoMedalha?.id,
        tipo_medalha_nome: config.nome,
        tipo_medalha_codigo: config.codigo,
        data_indicacao: linha.data_concessao || new Date().toISOString().split('T')[0],
        data_concessao: linha.data_concessao,
        status: 'CONCEDIDA',
        numero_publicacao: linha.doems_numero,
        boletim_ou_do: 'DOEMS',
        documento_referencia: linha.is_informacao_dp ? 'INFORMAÇÃO DP' : `DOEMS ${linha.doems_numero}`,
        origem_registro: linha.is_informacao_dp ? 'INFORMACAO_DP' : 'MIGRACAO_FIXA',
        observacoes: linha.is_informacao_dp ? observacoesDP : null,
        concedido_por: userEmail,
        updated_by: userEmail,
        updated_at: new Date().toISOString(),
      });

      // 2. Criar PublicacaoExOfficio (Alteração)
      await base44.entities.PublicacaoExOfficio.create({
        militar_id: linha.militar_id,
        militar_nome: linha.militar_nome,
        militar_matricula: linha.militar_matricula,
        tipo_registro: config.nome,
        tipo: config.nome,
        data_publicacao: linha.data_concessao,
        data_bg: linha.data_concessao,
        numero_bg: linha.doems_numero,
        tipo_bg_legado: 'DOEMS',
        texto_publicacao: textoAlteracao,
        status: 'Publicado',
        origem_registro: 'legado',
        importado_legado: true,
      });

      // Atualizar cache de medalhas ativas para evitar duplicidade na mesma importação se houver nomes repetidos (embora contagemPlanilha já cuide disso)
      setMedalhasMilitarIdAtivas.add(String(linha.militar_id));

      resultados.push({ rowIndex: linha.rowIndex, status: 'SUCESSO' });
      importados++;
    } catch (e) {
      console.error('Erro ao importar linha:', linha, e);
      resultados.push({ rowIndex: linha.rowIndex, status: STATUS_LINHA_MEDALHA.ERRO_IMPORTACAO, erro: e.message });
      erros++;
    }
  }

  return { importados, erros, resultados };
}
