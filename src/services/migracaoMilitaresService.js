import { base44 } from '@/api/base44Client';
import { isQuadroCompativel } from '@/utils/postoQuadroCompatibilidade';

export const STATUS_LINHA = {
  APTO: 'APTO',
  APTO_COM_ALERTA: 'APTO_COM_ALERTA',
  DUPLICADO: 'DUPLICADO',
  ERRO: 'ERRO',
};

const REGRA_VERSAO = 'v1.0.0';
const HISTORICO_ENTITY_NAME = 'ImportacaoMilitares';
const HISTORICO_ENTITY_ERROR_MESSAGE = 'Falha ao acessar o histórico de importação de militares. Verifique se a entidade ImportacaoMilitares está publicada no app.';

const POSTO_MAP = {
  CEL: 'Coronel',
  TC: 'Tenente Coronel',
  MAJ: 'Major',
  CAP: 'Capitão',
  '1º TEN': '1º Tenente',
  '2º TEN': '2º Tenente',
  ASP: 'Aspirante',
  'ASP OF': 'Aspirante',
  ST: 'Subtenente',
  '1º SGT': '1º Sargento',
  '2º SGT': '2º Sargento',
  '3º SGT': '3º Sargento',
  CB: 'Cabo',
  SD: 'Soldado',
};

const POSTOS_VALIDOS = new Set(Object.values(POSTO_MAP).map((item) => item.toUpperCase()));

const QUADRO_MAP = {
  QOBM: 'QOBM',
  QAOBM: 'QAOBM',
  QOEBM: 'QOEBM',
  QOSAU: 'QOSAU',
  'QBMP-1.A': 'QBMP-1.a',
  'QBMP-1.B': 'QBMP-1.b',
  'QBMP-2': 'QBMP-2',
  QBMT: 'QBMPT',
  QBMPT: 'QBMPT',
};

const ESCOLARIDADE_MAP = {
  'ENSINO MÉDIO': 'Ensino Médio Completo',
  'ENSINO MEDIO': 'Ensino Médio Completo',
  'CURSO SUPERIOR': 'Ensino Superior Completo',
  'PÓS-GRADUAÇÃO': 'Pós-Graduação',
  'POS-GRADUACAO': 'Pós-Graduação',
  MESTRADO: 'Mestrado',
  DOUTORADO: 'Doutorado',
};

const ETNIA_MAP = {
  'BRANCO(A)': 'Branca',
  'NEGRO(A)': 'Preta',
  'PARDO(A)': 'Parda',
  'INDÍGENA': 'Indígena',
  INDIGENA: 'Indígena',
};

const UF_VALIDAS = new Set(['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']);
const CNH_CATEGORIAS = new Set(['A', 'B', 'C', 'D', 'E']);

const HEADER_ALIAS = {
  nome_completo: ['nome_completo', 'nome', 'nome militar'],
  nome_guerra: ['nome_guerra', 'guerra', 'nome de guerra'],
  matricula: ['matricula', 'matrícula'],
  posto_graduacao: ['posto_graduacao', 'posto/graduação', 'posto graduacao', 'posto'],
  quadro: ['quadro'],
  data_inclusao: ['data_inclusao', 'data inclusão', 'data de inclusão'],
  cpf: ['cpf'],
  escolaridade: ['escolaridade'],
  etnia: ['etnia'],
  email_particular: ['email_particular', 'e-mail particular', 'email'],
  email_funcional: ['email_funcional', 'e-mail funcional'],
  telefone: ['telefone', 'celular'],
  data_nascimento: ['data_nascimento', 'data nascimento'],
  cnh_validade: ['cnh_validade', 'validade cnh'],
  cnh_categoria: ['cnh_categoria', 'categoria cnh'],
  cnh_numero: ['cnh_numero', 'numero cnh'],
  altura: ['altura'],
  peso: ['peso'],
  cep: ['cep'],
  logradouro: ['logradouro', 'endereco', 'endereço'],
  numero_endereco: ['numero_endereco', 'numero', 'número'],
  complemento: ['complemento'],
  bairro: ['bairro'],
  cidade: ['cidade'],
  uf: ['uf'],
  banco: ['banco'],
  agencia: ['agencia', 'agência'],
  conta: ['conta'],
  sexo: ['sexo'],
  estado_civil: ['estado_civil', 'estado civil'],
  tipo_sanguineo: ['tipo_sanguineo', 'tipo sanguineo'],
  religiao: ['religiao', 'religião'],
  curso_superior: ['curso_superior', 'curso superior'],
  mestrado: ['mestrado'],
  doutorado: ['doutorado'],
  naturalidade: ['naturalidade'],
  naturalidade_uf: ['naturalidade_uf', 'naturalidade uf'],
  nome_pai: ['nome_pai', 'pai'],
  nome_mae: ['nome_mae', 'mãe', 'mae'],
  rg: ['rg'],
  orgao_expedidor_rg: ['orgao_expedidor_rg', 'orgao expedidor rg'],
  uf_rg: ['uf_rg', 'uf rg'],
};

function normalizarChave(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function limparTexto(valor) {
  return String(valor ?? '').trim();
}

function somenteNumeros(valor) {
  return String(valor || '').replace(/\D/g, '');
}

function toUpperTrim(valor) {
  return limparTexto(valor).toUpperCase();
}

function detectarDelimitador(texto) {
  const primeiraLinha = String(texto || '').split(/\r\n|\n|\r/)[0] || '';
  const candidatos = [';', ',', '\t'];

  const contagens = candidatos.map((delimitador) => ({
    delimitador,
    total: primeiraLinha.split(delimitador).length - 1,
  }));

  return contagens.sort((a, b) => b.total - a.total)[0]?.delimitador || ';';
}

function parseCsv(texto) {
  const delimitador = detectarDelimitador(texto);
  const linhas = [];
  let atual = '';
  let linha = [];
  let emAspas = false;

  for (let i = 0; i < texto.length; i += 1) {
    const char = texto[i];
    const prox = texto[i + 1];

    if (char === '"') {
      if (emAspas && prox === '"') {
        atual += '"';
        i += 1;
        continue;
      }

      const inicioCampo = atual.length === 0;
      const fimCampo = !prox || prox === delimitador || prox === '\n' || prox === '\r';

      if (emAspas || inicioCampo || fimCampo) {
        emAspas = !emAspas;
        continue;
      }
    }

    if (!emAspas && char === delimitador) {
      linha.push(atual);
      atual = '';
      continue;
    }

    if (!emAspas && (char === '\n' || char === '\r')) {
      if (char === '\r' && prox === '\n') i += 1;
      linha.push(atual);
      if (linha.some((cell) => limparTexto(cell))) {
        linhas.push(linha);
      }
      linha = [];
      atual = '';
      continue;
    }

    atual += char;
  }

  if (atual.length > 0 || linha.length > 0) {
    linha.push(atual);
    if (linha.some((cell) => limparTexto(cell))) {
      linhas.push(linha);
    }
  }

  return linhas;
}

function mapHeaders(cabecalho) {
  const normalizados = cabecalho.map((h) => normalizarChave(h));
  return Object.entries(HEADER_ALIAS).reduce((acc, [campo, aliases]) => {
    const idx = aliases
      .map((alias) => normalizarChave(alias))
      .map((aliasNorm) => normalizados.indexOf(aliasNorm))
      .find((pos) => pos >= 0);
    if (idx >= 0) acc[campo] = idx;
    return acc;
  }, {});
}

function valorLinha(cells, headerMap, campo) {
  const idx = headerMap[campo];
  if (idx === undefined) return '';
  return limparTexto(cells[idx]);
}

function formatarMatricula(valor, alertas, erros) {
  const original = limparTexto(valor);
  const numeros = somenteNumeros(original);

  if (!numeros) {
    erros.push('Matrícula ausente. Linha bloqueada para importação.');
    return '';
  }

  if (numeros.length > 9) {
    erros.push('Matrícula inválida com mais de 9 dígitos. Linha bloqueada para importação.');
    return '';
  }

  const padded = numeros.padStart(9, '0');
  const formatada = `${padded.slice(0, 3)}.${padded.slice(3, 6)}-${padded.slice(6)}`;

  if (original !== formatada) {
    alertas.push('Matrícula ajustada automaticamente para o padrão 000.000-000.');
  }

  return formatada;
}

function mapPostoGraduacao(valor, erros) {
  const limpo = limparTexto(valor);
  if (!limpo) {
    erros.push('Posto/graduação ausente. Linha bloqueada para importação.');
    return '';
  }
  const upper = toUpperTrim(limpo);
  const mapped = POSTO_MAP[upper] || limpo;
  if (!POSTOS_VALIDOS.has(toUpperTrim(mapped))) {
    erros.push('Posto/graduação não reconhecido. Linha bloqueada para importação.');
    return '';
  }
  return mapped;
}

function mapQuadro(valor, postoGraduacao, alertas) {
  const limpo = limparTexto(valor);
  if (!limpo) return '';
  const mapped = QUADRO_MAP[toUpperTrim(limpo)] || limpo;
  if (!isQuadroCompativel(postoGraduacao, mapped)) {
    alertas.push('Quadro incompatível com o posto/graduação. Campo deixado em branco para revisão.');
    return '';
  }
  return mapped;
}

function isEmailValido(valor) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor);
}

function normalizarEmail(valor, alertas) {
  const limpo = limparTexto(valor).toLowerCase();
  if (!limpo) return '';
  if (!isEmailValido(limpo)) {
    alertas.push('E-mail inválido no sistema antigo. Campo deixado em branco para revisão.');
    return '';
  }
  return limpo;
}

function validarCPF(cpf) {
  const limpo = somenteNumeros(cpf);
  if (!limpo) return false;
  if (limpo.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(limpo)) return false;

  const calcularDigito = (base, fatorInicial) => {
    let soma = 0;
    for (let i = 0; i < base.length; i += 1) {
      soma += Number(base[i]) * (fatorInicial - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  const d1 = calcularDigito(limpo.slice(0, 9), 10);
  const d2 = calcularDigito(limpo.slice(0, 10), 11);
  return d1 === Number(limpo[9]) && d2 === Number(limpo[10]);
}

function normalizarCPF(valor, alertas) {
  const limpo = somenteNumeros(valor);
  if (!limpo) return '';
  if (!validarCPF(limpo)) {
    alertas.push('CPF inválido no sistema antigo. Campo deixado em branco para revisão.');
    return '';
  }
  return `${limpo.slice(0, 3)}.${limpo.slice(3, 6)}.${limpo.slice(6, 9)}-${limpo.slice(9)}`;
}

function formatarTelefone(valor, alertas) {
  const numeros = somenteNumeros(valor);
  if (!numeros) return '';

  let numerosNormalizados = numeros;
  if ((numeros.length === 12 || numeros.length === 13) && numeros.startsWith('55')) {
    numerosNormalizados = numeros.slice(2);
  }

  if (numerosNormalizados.length === 11) {
    return `(${numerosNormalizados.slice(0, 2)}) ${numerosNormalizados.slice(2, 7)}-${numerosNormalizados.slice(7)}`;
  }
  if (numerosNormalizados.length === 10) {
    return `(${numerosNormalizados.slice(0, 2)}) ${numerosNormalizados.slice(2, 6)}-${numerosNormalizados.slice(6)}`;
  }

  alertas.push('Telefone inválido no sistema antigo. Campo deixado em branco para revisão.');
  return '';
}

function excelDateToJSDate(serial) {
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  const dateInfo = new Date(utcValue * 1000);
  const fractionalDay = serial - Math.floor(serial) + 0.0000001;
  let totalSeconds = Math.floor(86400 * fractionalDay);
  const seconds = totalSeconds % 60;
  totalSeconds -= seconds;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(totalSeconds / 60) % 60;
  return new Date(dateInfo.getFullYear(), dateInfo.getMonth(), dateInfo.getDate(), hours, minutes, seconds);
}

function formatarData(valor, { obrigatoria = false, mensagemErro, mensagemAlerta, alertas, erros }) {
  const limpo = limparTexto(valor);
  if (!limpo) {
    if (obrigatoria) erros.push(mensagemErro);
    return '';
  }

  let data;
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(limpo)) {
    const [d, m, y] = limpo.split('/').map(Number);
    const ano = y < 100 ? 2000 + y : y;
    data = new Date(ano, m - 1, d);
  } else if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(limpo)) {
    const [y, m, d] = limpo.split('-').map(Number);
    data = new Date(y, m - 1, d);
  } else if (/^\d+(\.\d+)?$/.test(limpo)) {
    data = excelDateToJSDate(Number(limpo));
  } else {
    const tentativa = new Date(limpo);
    if (!Number.isNaN(tentativa.getTime())) data = tentativa;
  }

  if (!data || Number.isNaN(data.getTime())) {
    if (obrigatoria) {
      erros.push(mensagemErro);
    } else if (mensagemAlerta) {
      alertas.push(mensagemAlerta);
    }
    return '';
  }

  const dd = String(data.getDate()).padStart(2, '0');
  const mm = String(data.getMonth() + 1).padStart(2, '0');
  const yyyy = data.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function parseNumeroLivre(valor) {
  const limpo = limparTexto(valor);
  if (!limpo) return null;

  const normalizado = limpo.replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(normalizado)) return null;

  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : null;
}

function normalizarNumeroLivre(valor, mensagemAlerta, alertas) {
  const numero = parseNumeroLivre(valor);
  const campoVazio = !limparTexto(valor);

  if (numero === null && !campoVazio) {
    alertas.push(mensagemAlerta);
  }

  return numero;
}

function sanitizarCamposNumericosMilitar(payload) {
  const sanitizado = { ...payload };
  ['altura', 'peso'].forEach((campo) => {
    const valor = sanitizado[campo];

    if (valor === '' || valor === null || valor === undefined) {
      delete sanitizado[campo];
      return;
    }

    if (typeof valor === 'number') {
      if (!Number.isFinite(valor)) delete sanitizado[campo];
      return;
    }

    const convertido = parseNumeroLivre(valor);
    if (convertido === null) {
      delete sanitizado[campo];
      return;
    }

    sanitizado[campo] = convertido;
  });

  return sanitizado;
}

function mapEscolaridade(valor, alertas) {
  const limpo = limparTexto(valor);
  if (!limpo) return '';
  const mapped = ESCOLARIDADE_MAP[toUpperTrim(limpo)];
  if (!mapped) {
    alertas.push('Escolaridade não reconhecida no sistema antigo. Campo deixado em branco para revisão.');
    return '';
  }
  return mapped;
}

function mapEtnia(valor, alertas) {
  const limpo = limparTexto(valor);
  if (!limpo) return '';
  const mapped = ETNIA_MAP[toUpperTrim(limpo)];
  if (!mapped) {
    alertas.push('Etnia não reconhecida no sistema antigo. Campo deixado em branco para revisão.');
    return '';
  }
  return mapped;
}

function formatarCEP(valor, alertas) {
  const numeros = somenteNumeros(valor);
  if (!numeros) return '';
  if (numeros.length !== 8) {
    alertas.push('CEP inválido no sistema antigo. Campo deixado em branco para revisão.');
    return '';
  }
  return `${numeros.slice(0, 5)}-${numeros.slice(5)}`;
}

function formatarUF(valor, alertas, mensagem = 'UF inválida no sistema antigo. Campo deixado em branco para revisão.') {
  const uf = toUpperTrim(valor);
  if (!uf) return '';
  if (!UF_VALIDAS.has(uf)) {
    alertas.push(mensagem);
    return '';
  }
  return uf;
}

function normalizarCNHCategoria(valor, alertas) {
  const categoria = toUpperTrim(valor);
  if (!categoria) return '';
  if (!CNH_CATEGORIAS.has(categoria)) {
    alertas.push('Categoria CNH inválida no sistema antigo. Campo deixado em branco para revisão.');
    return '';
  }
  return categoria;
}

function definirStatusLinha(erros, alertas, duplicado) {
  if (erros.length > 0) return STATUS_LINHA.ERRO;
  if (duplicado) return STATUS_LINHA.DUPLICADO;
  if (alertas.length > 0) return STATUS_LINHA.APTO_COM_ALERTA;
  return STATUS_LINHA.APTO;
}

async function gerarHashArquivo(file) {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function obterResumo(linhas) {
  const resumo = {
    total_linhas: linhas.length,
    total_aptas: 0,
    total_aptas_com_alerta: 0,
    total_duplicadas: 0,
    total_erros: 0,
  };

  linhas.forEach((linha) => {
    if (linha.status === STATUS_LINHA.APTO) resumo.total_aptas += 1;
    if (linha.status === STATUS_LINHA.APTO_COM_ALERTA) resumo.total_aptas_com_alerta += 1;
    if (linha.status === STATUS_LINHA.DUPLICADO) resumo.total_duplicadas += 1;
    if (linha.status === STATUS_LINHA.ERRO) resumo.total_erros += 1;
  });

  return resumo;
}

export async function analisarArquivoMigracao(file) {
  const texto = await file.text();
  const dadosCsv = parseCsv(texto);
  if (dadosCsv.length < 2) {
    throw new Error('Arquivo sem conteúdo válido para análise.');
  }

  const cabecalho = dadosCsv[0];
  const headerMap = mapHeaders(cabecalho);
  const militaresExistentes = await base44.entities.Militar.list();
  const matriculasExistentes = new Set((militaresExistentes || []).map((m) => limparTexto(m?.matricula)));

  const linhas = dadosCsv.slice(1).map((cells, idx) => {
    const alertas = [];
    const erros = [];

    const matricula = formatarMatricula(valorLinha(cells, headerMap, 'matricula'), alertas, erros);
    const posto_graduacao = mapPostoGraduacao(valorLinha(cells, headerMap, 'posto_graduacao'), erros);
    const quadro = mapQuadro(valorLinha(cells, headerMap, 'quadro'), posto_graduacao, alertas);
    const data_inclusao = formatarData(valorLinha(cells, headerMap, 'data_inclusao'), {
      obrigatoria: true,
      mensagemErro: 'Data de inclusão inválida ou ausente. Linha bloqueada para importação.',
      alertas,
      erros,
    });

    const duplicado = matricula ? matriculasExistentes.has(matricula) : false;
    if (duplicado) {
      alertas.push('Já existe militar com esta matrícula no sistema novo. Importação automática bloqueada.');
    }

    const militarPayload = {
      nome_completo: valorLinha(cells, headerMap, 'nome_completo'),
      nome_guerra: valorLinha(cells, headerMap, 'nome_guerra'),
      status_cadastro: 'Ativo',
      situacao_militar: 'Ativa',
      funcao: '',
      lotacao: '',
      condicao: '',
      destino: '',
      matricula,
      subgrupamento_id: '',
      subgrupamento_nome: '',
      posto_graduacao,
      quadro,
      data_inclusao,
      comportamento: 'Bom',
      data_nascimento: formatarData(valorLinha(cells, headerMap, 'data_nascimento'), { alertas, erros, mensagemAlerta: 'Data de nascimento inválida no sistema antigo. Campo deixado em branco para revisão.' }),
      sexo: valorLinha(cells, headerMap, 'sexo'),
      estado_civil: valorLinha(cells, headerMap, 'estado_civil'),
      tipo_sanguineo: valorLinha(cells, headerMap, 'tipo_sanguineo'),
      religiao: valorLinha(cells, headerMap, 'religiao'),
      escolaridade: mapEscolaridade(valorLinha(cells, headerMap, 'escolaridade'), alertas),
      curso_superior: valorLinha(cells, headerMap, 'curso_superior'),
      pos_graduacao: [],
      mestrado: valorLinha(cells, headerMap, 'mestrado'),
      doutorado: valorLinha(cells, headerMap, 'doutorado'),
      naturalidade: valorLinha(cells, headerMap, 'naturalidade'),
      naturalidade_uf: formatarUF(valorLinha(cells, headerMap, 'naturalidade_uf'), alertas, 'UF inválida no sistema antigo. Campo deixado em branco para revisão.'),
      nome_pai: valorLinha(cells, headerMap, 'nome_pai'),
      nome_mae: valorLinha(cells, headerMap, 'nome_mae'),
      rg: valorLinha(cells, headerMap, 'rg'),
      orgao_expedidor_rg: valorLinha(cells, headerMap, 'orgao_expedidor_rg'),
      uf_rg: formatarUF(valorLinha(cells, headerMap, 'uf_rg'), alertas, 'UF inválida no sistema antigo. Campo deixado em branco para revisão.'),
      cnh_categoria: normalizarCNHCategoria(valorLinha(cells, headerMap, 'cnh_categoria'), alertas),
      cnh_validade: formatarData(valorLinha(cells, headerMap, 'cnh_validade'), { alertas, erros, mensagemAlerta: 'Validade da CNH inválida no sistema antigo. Campo deixado em branco para revisão.' }),
      cnh_numero: valorLinha(cells, headerMap, 'cnh_numero'),
      cpf: normalizarCPF(valorLinha(cells, headerMap, 'cpf'), alertas),
      banco: valorLinha(cells, headerMap, 'banco'),
      agencia: valorLinha(cells, headerMap, 'agencia'),
      conta: valorLinha(cells, headerMap, 'conta'),
      email_particular: normalizarEmail(valorLinha(cells, headerMap, 'email_particular'), alertas),
      telefone: formatarTelefone(valorLinha(cells, headerMap, 'telefone'), alertas),
      email_funcional: normalizarEmail(valorLinha(cells, headerMap, 'email_funcional'), alertas),
      altura: normalizarNumeroLivre(valorLinha(cells, headerMap, 'altura'), 'Altura inválida no sistema antigo. Campo deixado em branco para revisão.', alertas),
      peso: normalizarNumeroLivre(valorLinha(cells, headerMap, 'peso'), 'Peso inválido no sistema antigo. Campo deixado em branco para revisão.', alertas),
      etnia: mapEtnia(valorLinha(cells, headerMap, 'etnia'), alertas),
      logradouro: valorLinha(cells, headerMap, 'logradouro'),
      numero_endereco: valorLinha(cells, headerMap, 'numero_endereco'),
      cep: formatarCEP(valorLinha(cells, headerMap, 'cep'), alertas),
      bairro: valorLinha(cells, headerMap, 'bairro'),
      cidade: valorLinha(cells, headerMap, 'cidade'),
      uf: formatarUF(valorLinha(cells, headerMap, 'uf'), alertas),
      complemento: valorLinha(cells, headerMap, 'complemento'),
      habilidades: [],
      link_alteracoes_anteriores: '',
      foto: '',
    };

    const status = definirStatusLinha(erros, alertas, duplicado);

    return {
      linhaNumero: idx + 2,
      original: Object.fromEntries(cabecalho.map((h, hIdx) => [h, cells[hIdx] || ''])),
      transformado: militarPayload,
      status,
      alertas,
      erros,
    };
  });

  const resumo = obterResumo(linhas);

  return {
    arquivo: {
      nome: file.name,
      tipo: file.type || 'text/csv',
      hash: await gerarHashArquivo(file),
      data_importacao: new Date().toISOString(),
    },
    resumo,
    linhas,
    versao_regra_migracao: REGRA_VERSAO,
  };
}

function relatorioFromAnalise(analise, extras = {}) {
  return {
    arquivo: analise.arquivo,
    resumo: analise.resumo,
    linhas: analise.linhas,
    ...extras,
  };
}

function getHistoricoImportacaoEntity() {
  const entity = base44?.entities?.[HISTORICO_ENTITY_NAME];
  if (!entity?.create || !entity?.update) {
    return null;
  }
  return entity;
}

function assertHistoricoEntity() {
  const entity = getHistoricoImportacaoEntity();
  if (!entity) throw new Error(HISTORICO_ENTITY_ERROR_MESSAGE);
  return entity;
}

export async function salvarAnaliseHistorico(analise, usuario) {
  const historicoEntity = getHistoricoImportacaoEntity();
  const payload = {
    nome_arquivo: analise.arquivo.nome,
    tipo_arquivo: analise.arquivo.tipo,
    hash_arquivo: analise.arquivo.hash,
    data_importacao: new Date().toISOString(),
    importado_por: usuario?.email || '',
    importado_por_nome: usuario?.full_name || usuario?.name || '',
    ...analise.resumo,
    total_importadas: 0,
    total_nao_importadas: analise.resumo.total_linhas,
    status_importacao: 'Analisado',
    importar_linhas_com_alerta: false,
    versao_regra_migracao: analise.versao_regra_migracao,
    relatorio_json: JSON.stringify(relatorioFromAnalise(analise), null, 2),
    observacoes: '',
  };

  if (!historicoEntity) {
    // Fallback: entidade indisponível no runtime — retorna objeto simulado sem persistência
    console.warn('[ImportacaoMilitares] Entidade não disponível no runtime. Histórico NÃO foi salvo.');
    return { id: null, _historicoNaoSalvo: true, ...payload };
  }

  try {
    return await historicoEntity.create(payload);
  } catch (error) {
    if (String(error?.message || '').includes(`Entity schema ${HISTORICO_ENTITY_NAME} not found in app`)) {
      throw new Error(HISTORICO_ENTITY_ERROR_MESSAGE);
    }
    throw error;
  }
}

export async function importarAnalise({ analise, incluirAlertas, historicoId, usuario }) {
  const historicoEntity = getHistoricoImportacaoEntity();
  const historicoDisponivel = !!historicoEntity && !!historicoId;

  if (historicoDisponivel) {
    try {
      await historicoEntity.update(historicoId, {
        status_importacao: 'Importando',
        importar_linhas_com_alerta: incluirAlertas,
      });
    } catch (error) {
      if (String(error?.message || '').includes(`Entity schema ${HISTORICO_ENTITY_NAME} not found in app`)) {
        throw new Error(HISTORICO_ENTITY_ERROR_MESSAGE);
      }
      throw error;
    }
  }

  const podeImportar = (linha) => linha.status === STATUS_LINHA.APTO || (incluirAlertas && linha.status === STATUS_LINHA.APTO_COM_ALERTA);
  const elegiveis = analise.linhas.filter(podeImportar);
  const idsCriados = [];
  const naoImportadas = [];

  try {
    for (const linha of elegiveis) {
      const { matricula, posto_graduacao, data_inclusao } = linha.transformado;

      const duplicidade = await base44.entities.Militar.filter({ matricula });
      if (duplicidade.length > 0) {
        naoImportadas.push({ linhaNumero: linha.linhaNumero, motivo: 'Duplicidade detectada na revalidação.' });
        continue;
      }
      if (!data_inclusao) {
        naoImportadas.push({ linhaNumero: linha.linhaNumero, motivo: 'Data de inclusão inválida na revalidação.' });
        continue;
      }
      if (!posto_graduacao || !POSTOS_VALIDOS.has(toUpperTrim(posto_graduacao))) {
        naoImportadas.push({ linhaNumero: linha.linhaNumero, motivo: 'Posto/graduação inválido na revalidação.' });
        continue;
      }

      const payloadMilitar = sanitizarCamposNumericosMilitar(linha.transformado);
      const criado = await base44.entities.Militar.create(payloadMilitar);
      idsCriados.push(criado?.id);
    }

    const totalImportadas = idsCriados.length;
    const totalNaoImportadas = analise.resumo.total_linhas - totalImportadas;
    const statusImportacao = totalImportadas === 0
      ? 'Falhou'
      : totalNaoImportadas > 0 ? 'Importado Parcial' : 'Importado';

    const relatorio = relatorioFromAnalise(analise, {
      importacao: {
        incluirAlertas,
        total_importadas: totalImportadas,
        total_nao_importadas: totalNaoImportadas,
        nao_importadas: naoImportadas,
        ids_criados: idsCriados,
      },
    });

    if (historicoDisponivel) {
      await historicoEntity.update(historicoId, {
        importado_por: usuario?.email || '',
        importado_por_nome: usuario?.full_name || usuario?.name || '',
        total_importadas: totalImportadas,
        total_nao_importadas: totalNaoImportadas,
        status_importacao: statusImportacao,
        importar_linhas_com_alerta: incluirAlertas,
        relatorio_json: JSON.stringify(relatorio, null, 2),
      });
    }

    return {
      statusImportacao,
      totalImportadas,
      totalNaoImportadas,
      idsCriados,
      naoImportadas,
      relatorio,
    };
  } catch (error) {
    if (historicoDisponivel) {
      try {
        await historicoEntity.update(historicoId, {
          status_importacao: 'Falhou',
          observacoes: error?.message || 'Falha ao importar lote.',
        });
      } catch (updateError) {
        if (String(updateError?.message || '').includes(`Entity schema ${HISTORICO_ENTITY_NAME} not found in app`)) {
          console.warn('[ImportacaoMilitares] Não foi possível atualizar status de falha no histórico.');
        }
      }
    }
    if (String(error?.message || '').includes(`Entity schema ${HISTORICO_ENTITY_NAME} not found in app`)) {
      throw new Error(HISTORICO_ENTITY_ERROR_MESSAGE);
    }
    throw error;
  }
}

export function exportarRelatorio(relatorio, nomeArquivo = 'relatorio-migracao-militares.json') {
  const blob = new Blob([JSON.stringify(relatorio, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
