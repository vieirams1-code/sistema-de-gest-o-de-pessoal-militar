const FEATURE_FLAG_KEY = 'modulo_comunicacoes_internas';

const toBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'on' || normalized === 'yes';
  }
  return false;
};

export const isModuloComunicacoesInternasEnabled = (appPublicSettings = null) => {
  const envFlag = import.meta?.env?.VITE_MODULO_COMUNICACOES_INTERNAS;

  if (envFlag !== undefined) {
    return toBoolean(envFlag);
  }

  const publicSettings = appPublicSettings?.public_settings || {};
  const directFlag = publicSettings?.[FEATURE_FLAG_KEY];
  const nestedFlag = publicSettings?.feature_flags?.[FEATURE_FLAG_KEY];

  return toBoolean(nestedFlag ?? directFlag);
};

export const MODULO_COMUNICACOES_INTERNAS_FLAG = FEATURE_FLAG_KEY;
