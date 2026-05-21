import { TEMPLATE_SOURCE_OF_TRUTH } from '../constants/templateGovernance.js';

function buildRenderedBy(user = {}) {
  return user?.full_name || user?.name || user?.email || user?.id || 'sistema';
}

function normalizeTemplateContent(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .trim();
}

// SHA-256 síncrono em JS puro para manter compatibilidade browser/Node sem alterar fluxo assíncrono.
// Baseado no algoritmo SHA-256 (FIPS PUB 180-4).
function sha256(input) {
  const rightRotate = (value, amount) => (value >>> amount) | (value << (32 - amount));
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let result = '';

  const words = [];
  let inputBytes = unescape(encodeURIComponent(input));
  const inputLength = inputBytes.length;

  const hash = [];
  const k = [];
  let primeCounter = 0;
  const isPrime = {};
  for (let candidate = 2; primeCounter < 64; candidate += 1) {
    if (!isPrime[candidate]) {
      for (let i = 0; i < 313; i += candidate) {
        isPrime[i] = candidate;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      primeCounter += 1;
    }
  }

  inputBytes += '\x80';
  while ((inputBytes.length % 64) - 56) inputBytes += '\x00';
  for (let i = 0; i < inputBytes.length; i += 1) {
    const j = inputBytes.charCodeAt(i);
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words.length] = ((inputLength / maxWord) | 0);
  words[words.length] = (inputLength * 8);

  for (let j = 0; j < words.length;) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0);
    for (let i = 0; i < 64; i += 1) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];
      const a = hash[0];
      const e = hash[4];
      const temp1 = hash[7]
        + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25))
        + ((e & hash[5]) ^ ((~e) & hash[6]))
        + k[i]
        + (w[i] = (i < 16)
          ? w[i]
          : (w[i - 16]
            + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3))
            + w[i - 7]
            + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) | 0);
      const temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22))
        + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

      hash.unshift((temp1 + temp2) | 0);
      hash[4] = (hash[4] + temp1) | 0;
      hash.pop();
    }

    for (let i = 0; i < 8; i += 1) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (let i = 0; i < 8; i += 1) {
    for (let j = 3; j + 1; j -= 1) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += ((b < 16) ? 0 : '') + b.toString(16);
    }
  }
  return result;
}

export function buildTemplateHash(templateContent) {
  const normalized = normalizeTemplateContent(templateContent);
  if (!normalized) return null;
  return sha256(normalized);
}

export function buildTemplateRenderMetadata({ template = {}, modulo = '', user = {}, sourceOfTruth = TEMPLATE_SOURCE_OF_TRUTH.RENDER_ON_SUBMIT } = {}) {
  if (!template?.id && !template?.nome && !template?.tipo_registro) return null;

  const metadata = {
    template_id: template?.id || null,
    template_nome: template?.nome || template?.tipo_registro || 'Template sem nome',
    template_tipo: template?.tipo_registro || '',
    template_modulo: template?.modulo || modulo || '',
    template_hash: buildTemplateHash(template?.template),
    rendered_at: new Date().toISOString(),
    rendered_by: buildRenderedBy(user),
    source_of_truth: sourceOfTruth,
  };

  try {
    return JSON.parse(JSON.stringify(metadata));
  } catch {
    return null;
  }
}

export function parseTemplateRenderMetadata(metadata, metadataJson) {
  if (metadata && typeof metadata === 'object') return metadata;
  if (!metadataJson || typeof metadataJson !== 'string') return null;
  try {
    const parsed = JSON.parse(metadataJson);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function warnIfMissingRenderMetadata({ metadata, metadataJson, entity = 'Registro' } = {}) {
  const isDev = typeof import.meta !== 'undefined' && import.meta?.env?.DEV;
  if (!isDev) return;

  const parsed = parseTemplateRenderMetadata(metadata, metadataJson);
  if (parsed) return;

  // Aviso discreto para detectar quando o provider ignora objeto JSON sem erro explícito.
  // Sem bloquear fluxo de produção e sem alterar backend.
  // eslint-disable-next-line no-console
  console.warn(`[render_metadata] ausente após persistência em ${entity}. Verificar schema/provider.`);
}
