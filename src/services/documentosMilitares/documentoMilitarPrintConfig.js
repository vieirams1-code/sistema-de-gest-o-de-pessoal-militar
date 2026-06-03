export const DOCUMENTO_MILITAR_PRINT_CONFIG_STORAGE_KEY = 'sgp.documentosMilitares.configImpressao';

export const DOCUMENTO_MILITAR_PRINT_CONFIG_DEFAULTS = Object.freeze({
  mostrarCabecalho: true,
  mostrarBrasao: true,
  mostrarAssinatura: true,
  mostrarRodape: true,
  orgaoLinha1: 'ESTADO DE MATO GROSSO DO SUL',
  orgaoLinha2: 'SECRETARIA DE ESTADO DE JUSTIÇA E SEGURANÇA PÚBLICA',
  orgaoLinha3: 'CORPO DE BOMBEIROS MILITAR',
  orgaoLinha4: 'COMANDO METROPOLITANO DE BOMBEIROS',
  orgaoLinha5: '1º GRUPAMENTO DE BOMBEIROS MILITAR',
  tituloDocumentoPadrao: 'DOCUMENTO MILITAR',
  imagemCabecalhoSrc: '',
  cidadePadrao: '',
  nomeSignatario: '',
  cargoSignatario: '',
  matriculaSignatario: '',
  rodapeLinha1: '1º GRUPAMENTO DE BOMBEIROS MILITAR',
  rodapeLinha2: 'Av. Costa e Silva, 901 - Vila Progresso, Campo Grande - MS, 79080-000',
});

const CAMPOS_BOOLEANOS = new Set(['mostrarCabecalho', 'mostrarBrasao', 'mostrarAssinatura', 'mostrarRodape']);
const CAMPOS_TEXTO = new Set([
  'orgaoLinha1',
  'orgaoLinha2',
  'orgaoLinha3',
  'orgaoLinha4',
  'orgaoLinha5',
  'tituloDocumentoPadrao',
  'imagemCabecalhoSrc',
  'cidadePadrao',
  'nomeSignatario',
  'cargoSignatario',
  'matriculaSignatario',
  'rodapeLinha1',
  'rodapeLinha2',
]);

const CAMPOS_LINHAS_ORGAO = ['orgaoLinha1', 'orgaoLinha2', 'orgaoLinha3', 'orgaoLinha4', 'orgaoLinha5'];

function normalizarConfig(config = {}) {
  const configNormalizada = { ...DOCUMENTO_MILITAR_PRINT_CONFIG_DEFAULTS };

  Object.entries(config && typeof config === 'object' ? config : {}).forEach(([campo, valor]) => {
    if (CAMPOS_BOOLEANOS.has(campo) && typeof valor === 'boolean') {
      configNormalizada[campo] = valor;
    }

    if (CAMPOS_TEXTO.has(campo) && typeof valor === 'string') {
      configNormalizada[campo] = valor.trim();
    }
  });

  return configNormalizada;
}

function obterStorage(storage) {
  if (storage) return storage;
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

export function carregarDocumentoMilitarPrintConfig(storage) {
  const localStorage = obterStorage(storage);
  if (!localStorage) return normalizarConfig();

  try {
    const configSalva = localStorage.getItem(DOCUMENTO_MILITAR_PRINT_CONFIG_STORAGE_KEY);
    return normalizarConfig(configSalva ? JSON.parse(configSalva) : {});
  } catch {
    return normalizarConfig();
  }
}

export function salvarDocumentoMilitarPrintConfig(config, storage) {
  const configNormalizada = normalizarConfig(config);
  const localStorage = obterStorage(storage);

  if (localStorage) {
    try {
      localStorage.setItem(DOCUMENTO_MILITAR_PRINT_CONFIG_STORAGE_KEY, JSON.stringify(configNormalizada));
    } catch {
      // A prévia continua funcional mesmo se o navegador bloquear o armazenamento local.
    }
  }

  return configNormalizada;
}

export function montarDadosDocumentoMilitarPreview(config, { brasaoSrc = '', tituloDocumento = '' } = {}) {
  const configNormalizada = normalizarConfig(config);
  const tituloInformado = typeof tituloDocumento === 'string' ? tituloDocumento.trim() : '';
  const imagemConfigurada = configNormalizada.imagemCabecalhoSrc;
  const imagemLegada = configNormalizada.mostrarBrasao && typeof brasaoSrc === 'string' ? brasaoSrc.trim() : '';

  return {
    ...configNormalizada,
    brasaoSrc: imagemLegada,
    imagemCabecalhoSrc: imagemConfigurada || imagemLegada,
    linhasInstitucionais: CAMPOS_LINHAS_ORGAO.map((campo) => configNormalizada[campo]).filter(Boolean),
    tituloDocumento: tituloInformado || configNormalizada.tituloDocumentoPadrao,
    rodapeLinhas: configNormalizada.mostrarRodape
      ? [configNormalizada.rodapeLinha1, configNormalizada.rodapeLinha2].filter(Boolean)
      : [],
    localAssinatura: configNormalizada.cidadePadrao ? `${configNormalizada.cidadePadrao}.` : '',
  };
}
