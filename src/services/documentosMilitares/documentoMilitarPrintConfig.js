export const DOCUMENTO_MILITAR_PRINT_CONFIG_STORAGE_KEY = 'sgp.documentosMilitares.configImpressao';

export const DOCUMENTO_MILITAR_PRINT_CONFIG_DEFAULTS = Object.freeze({
  mostrarCabecalho: true,
  mostrarBrasao: true,
  mostrarAssinatura: true,
  orgaoLinha1: 'CORPO DE BOMBEIROS MILITAR DO ESTADO DE MATO GROSSO DO SUL',
  orgaoLinha2: '1º GRUPAMENTO DE BOMBEIROS MILITAR',
  orgaoLinha3: 'SEÇÃO DE GESTÃO DE PESSOAS',
  tituloDocumentoPadrao: 'DOCUMENTO MILITAR',
  cidadePadrao: '',
  nomeSignatario: '',
  cargoSignatario: '',
  matriculaSignatario: '',
});

const CAMPOS_BOOLEANOS = new Set(['mostrarCabecalho', 'mostrarBrasao', 'mostrarAssinatura']);
const CAMPOS_TEXTO = new Set([
  'orgaoLinha1',
  'orgaoLinha2',
  'orgaoLinha3',
  'tituloDocumentoPadrao',
  'cidadePadrao',
  'nomeSignatario',
  'cargoSignatario',
  'matriculaSignatario',
]);

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

export function montarDadosDocumentoMilitarPreview(config, { brasaoSrc = '' } = {}) {
  const configNormalizada = normalizarConfig(config);

  return {
    ...configNormalizada,
    brasaoSrc: configNormalizada.mostrarBrasao && typeof brasaoSrc === 'string' ? brasaoSrc : '',
    localAssinatura: configNormalizada.cidadePadrao ? `${configNormalizada.cidadePadrao}.` : '',
  };
}
