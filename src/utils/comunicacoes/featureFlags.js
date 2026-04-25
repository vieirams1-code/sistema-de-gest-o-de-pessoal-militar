const FEATURE_FLAG_KEY = 'modulo_comunicacoes_internas';

const toBoolean = (value) => value === true;

const readFeatureFlags = (appPublicSettings) => {
  const root = appPublicSettings?.public_settings || appPublicSettings || {};

  return {
    ...(root.feature_flags || {}),
    ...(root.featureFlags || {}),
    ...(root.modulos || {}),
  };
};

export const isModuloComunicacoesInternasEnabled = (appPublicSettings) => {
  const flags = readFeatureFlags(appPublicSettings);
  return toBoolean(flags[FEATURE_FLAG_KEY]);
};

export { FEATURE_FLAG_KEY };
