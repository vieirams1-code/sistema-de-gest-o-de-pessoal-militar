/**
 * Módulo Criptográfico do Portal do Militar
 * Utiliza a Web Crypto API (padrão em Deno e Node.js modernos).
 */

const encoder = new TextEncoder();

/**
 * Converte Uint8Array para string hexadecimal.
 */
function bufferToHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Obtém variável de ambiente de forma compatível com Deno e Node.js.
 */
function getEnvVar(key: string): string | undefined {
  if (typeof Deno !== 'undefined' && typeof Deno.env?.get === 'function') {
    return Deno.env.get(key);
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key];
  }
  return undefined;
}

/**
 * Gera um PortalToken com 256 bits (32 bytes) de entropia criptográfica.
 * Retorna string hexadecimal de 64 caracteres.
 */
export function generatePortalToken(): string {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  return bufferToHex(randomBytes);
}

/**
 * Calcula o hash SHA-256 do PortalToken.
 * O valor em claro NUNCA deve ser persistido no banco de dados.
 */
export async function hashPortalToken(token: string): Promise<string> {
  if (!token || typeof token !== 'string') {
    throw new Error('Token inválido para hashing.');
  }
  const trimmed = token.trim();
  if (trimmed.length < 32 || trimmed.length > 256) {
    throw new Error('Tamanho de token inválido para hashing.');
  }
  const data = encoder.encode(trimmed);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return bufferToHex(hashBuffer);
}

/**
 * Gera um código numérico OTP de 6 dígitos com rejection sampling (sem modulo bias)
 * e zero-padding garantido.
 */
export function generateOtp(length: number = 6): string {
  if (length !== 6) {
    throw new Error('Portal do Militar suporta estritamente OTP de 6 dígitos.');
  }
  const modulus = 1_000_000;
  // 2^32 = 4294967296. Maior múltiplo de 1_000_000 <= 2^32 é 4294000000.
  const maxUnbiased = 4_294_000_000;
  const randomBuffer = new Uint32Array(1);

  let randomValue: number;
  do {
    crypto.getRandomValues(randomBuffer);
    randomValue = randomBuffer[0];
  } while (randomValue >= maxUnbiased);

  const otpNumber = randomValue % modulus;
  return String(otpNumber).padStart(6, '0');
}

/**
 * Calcula o hash criptográfico do OTP utilizando HMAC-SHA256 e Pepper server-side.
 * Falha fechado caso o pepper não esteja configurado.
 *
 * @param otp Código OTP de 6 dígitos
 * @param contextId Identificador canônico da sessão/militar (salt de contexto)
 * @param explicitPepper Pepper explícito (usado para testes ou fallback de injeção)
 */
export async function hashOtp(
  otp: string,
  contextId: string = '',
  explicitPepper?: string
): Promise<string> {
  if (!otp || typeof otp !== 'string' || otp.trim().length !== 6) {
    throw new Error('OTP inválido para hashing: deve conter 6 dígitos.');
  }

  const pepper = explicitPepper || getEnvVar('PORTAL_OTP_PEPPER');
  if (!pepper || typeof pepper !== 'string' || pepper.trim().length === 0) {
    throw new Error('PORTAL_OTP_PEPPER_AUSENTE: Segredo server-side de OTP não configurado. Falha fechada por segurança.');
  }

  const keyData = encoder.encode(pepper.trim());
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const message = encoder.encode(`PORTAL_CANONICAL_OTP_V1:${contextId.trim()}:${otp.trim()}`);
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, message);
  return bufferToHex(signature);
}

/**
 * Comparação em tempo constante para evitar timing attacks.
 */
export function timingSafeCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);
  if (bufA.byteLength !== bufB.byteLength) {
    return false;
  }
  if (crypto.subtle && typeof crypto.subtle.timingSafeEqual === 'function') {
    return crypto.subtle.timingSafeEqual(bufA, bufB);
  }
  let result = 0;
  for (let i = 0; i < bufA.byteLength; i++) {
    result |= bufA[i] ^ bufB[i];
  }
  return result === 0;
}

/**
 * Gera um identificador de correlação único para a requisição.
 */
export function generateCorrelationId(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const randomBytes = new Uint8Array(16);
  crypto.getRandomValues(randomBytes);
  return bufferToHex(randomBytes);
}

/**
 * Sanitiza identificador (CPF ou matrícula) para logs de auditoria pré-autenticação.
 * Nunca retorna CPF completo.
 */
export function sanitizarIdentificador(raw: string = ''): string {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return 'ANONIMO';
  if (digits.length === 11) {
    return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
  }
  if (digits.length > 4) {
    return `${digits.slice(0, 2)}***${digits.slice(-2)}`;
  }
  return '***';
}
