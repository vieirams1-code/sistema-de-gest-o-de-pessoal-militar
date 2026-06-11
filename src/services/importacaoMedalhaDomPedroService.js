import { base44 } from '@/api/base44Client';
import { strFromU8, unzipSync } from 'fflate';

/**
 * Módulo de Migração Fixa da Medalha Dom Pedro II.
 *
 * Regras:
 * - Medalha: "Medalha Dom Pedro II"
 * - Origem: "DOEMS"
 * - Localização do militar por nome completo normalizado.
 * - Validações: militar não encontrado, DOEMS inválido, data inválida, já importado, duplicado na planilha.
 */

export const STATUS_LINHA_MEDALHA = Object.freeze({
  PRONTO: 'Pronto',
  MILITAR_NAO_ENCONTRADO: 'Militar não encontrado',
  DOEMS_INVALIDO: 'DOEMS inválido',
  DATA_INVALIDA: 'Data inválida',
  JA_IMPORTADO: 'Já importado',
  DUPLICADO_PLANILHA: 'Duplicado na planilha',
  ERRO: 'Erro',
});

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

// Reuso de lógica de parsing XLSX do MigracaoAlteracoesLegadoSimplificadoService.js
// (Abreviado para o necessário)

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

export async function analisarPlanilhaDomPedro(file) {
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

  // Medalhas Dom Pedro II já existentes
  const medalhasExistentes = await base44.entities.Medalha.filter({ tipo_medalha_nome: 'Medalha Dom Pedro II' });
  const setMedalhasMilitarId = new Set(medalhasExistentes.map(m => String(m.militar_id)));

  const contagemPlanilha = new Map();

  const analise = rows.map((row, index) => {
    const nomeBruto = limparTexto(row[colIndex.militar_nome]);
    const doemsBruto = limparTexto(row[colIndex.doems]);
    const dataBruta = row[colIndex.data];

    const nomeNorm = normalizarNome(nomeBruto);
    const doemsNorm = normalizarDoems(doemsBruto);
    const dataIso = parseDataExcel(dataBruta);

    let status = STATUS_LINHA_MEDALHA.PRONTO;
    const erros = [];
    const militarEncontrado = mapaMilitares.get(nomeNorm);

    if (!nomeNorm) {
      status = STATUS_LINHA_MEDALHA.ERRO;
      erros.push('Nome do militar ausente.');
    } else if (!militarEncontrado || militarEncontrado.length === 0) {
      status = STATUS_LINHA_MEDALHA.MILITAR_NAO_ENCONTRADO;
    } else if (militarEncontrado.length > 1) {
      status = STATUS_LINHA_MEDALHA.ERRO;
      erros.push('Múltiplos militares encontrados com este nome.');
    }

    if (!doemsNorm) {
      status = STATUS_LINHA_MEDALHA.DOEMS_INVALIDO;
    }

    if (!dataIso) {
      status = STATUS_LINHA_MEDALHA.DATA_INVALIDA;
    }

    const chaveUnica = `${nomeNorm}|${doemsNorm}|${dataIso}`;
    if (contagemPlanilha.has(chaveUnica)) {
      status = STATUS_LINHA_MEDALHA.DUPLICADO_PLANILHA;
    } else {
      contagemPlanilha.set(chaveUnica, true);
    }

    const militar = militarEncontrado?.[0];
    if (status === STATUS_LINHA_MEDALHA.PRONTO && militar && setMedalhasMilitarId.has(String(militar.id))) {
      status = STATUS_LINHA_MEDALHA.JA_IMPORTADO;
    }

    return {
      rowIndex: index + 2,
      militar_nome_bruto: nomeBruto,
      doems_bruto: doemsBruto,
      data_bruta: dataBruta,
      militar_id: militar?.id || null,
      militar_nome: militar?.nome_completo || nomeBruto,
      militar_matricula: militar?.matricula || '',
      militar_posto: militar?.posto_graduacao || '',
      doems_numero: doemsNorm,
      data_concessao: dataIso,
      status,
      erros,
    };
  });

  return analise;
}

export async function importarMedalhasDomPedro(linhas, userEmail) {
  const prontas = linhas.filter(l => l.status === STATUS_LINHA_MEDALHA.PRONTO);
  if (!prontas.length) return { importados: 0, erros: 0 };

  const tipoMedalhaDomPedro = (await base44.entities.TipoMedalha.filter({ codigo: 'DOM_PEDRO_II' }))[0];

  let importados = 0;
  let erros = 0;

  for (const linha of prontas) {
    try {
      const dataBr = formatarDataBr(linha.data_concessao);
      const textoAlteracao = `Concedida a Medalha Dom Pedro II, conforme publicação no DOEMS nº ${linha.doems_numero}, de ${dataBr}.`;

      // 1. Criar Registro de Medalha
      await base44.entities.Medalha.create({
        militar_id: linha.militar_id,
        militar_nome: linha.militar_nome,
        militar_matricula: linha.militar_matricula,
        militar_posto: linha.militar_posto,
        tipo_medalha_id: tipoMedalhaDomPedro?.id,
        tipo_medalha_nome: 'Medalha Dom Pedro II',
        tipo_medalha_codigo: 'DOM_PEDRO_II',
        data_indicacao: linha.data_concessao, // Usando data do DOEMS como indicação/concessão para simplificar migração
        data_concessao: linha.data_concessao,
        status: 'CONCEDIDA',
        numero_publicacao: linha.doems_numero,
        boletim_ou_do: 'DOEMS',
        documento_referencia: `DOEMS ${linha.doems_numero}`,
        origem_registro: 'MIGRACAO_FIXA',
        concedido_por: userEmail,
        updated_by: userEmail,
        updated_at: new Date().toISOString(),
      });

      // 2. Criar PublicacaoExOfficio (Alteração)
      await base44.entities.PublicacaoExOfficio.create({
        militar_id: linha.militar_id,
        militar_nome: linha.militar_nome,
        militar_matricula: linha.militar_matricula,
        tipo_registro: 'Medalha Dom Pedro II',
        tipo: 'Medalha Dom Pedro II',
        data_publicacao: linha.data_concessao,
        data_bg: linha.data_concessao,
        numero_bg: linha.doems_numero, // Usando doems_numero no campo de BG para manter visibilidade
        tipo_bg_legado: 'DOEMS',
        texto_publicacao: textoAlteracao,
        status: 'Publicado',
        origem_registro: 'legado',
        importado_legado: true,
      });

      importados++;
    } catch (e) {
      console.error('Erro ao importar linha:', linha, e);
      erros++;
    }
  }

  // Invalidar cache
  if (importados > 0) {
    // Como estamos no service, não temos acesso ao queryClient do React Query diretamente.
    // A invalidação deve ser feita na UI após chamar este service.
  }

  return { importados, erros };
}
