import { base44EmailProvider } from './providers/base44EmailProvider.ts';
import { resendEmailProvider } from './providers/resendEmailProvider.ts';
import { evolutionWhatsAppProvider, normalizeWhatsAppNumber } from './providers/evolutionWhatsAppProvider.ts';
import { generatePortalToken } from '../portalCrypto.ts';

/**
 * Normaliza uma string de CPF removendo todos os caracteres não-numéricos.
 */
export function normalizeCpf(cpfRaw: unknown): string {
  if (typeof cpfRaw !== 'string' && typeof cpfRaw !== 'number') return '';
  return String(cpfRaw).replace(/\D/g, '');
}

/**
 * Validação estrutural de CPF (11 dígitos e rejeição de sequências óbvias repetidas).
 */
export function isValidCpf(cpf: string): boolean {
  if (!cpf || cpf.length !== 11 || !/^\d{11}$/.test(cpf)) return false;
  // Rejeita sequências de dígitos repetidos (ex: 00000000000, 11111111111)
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  return true;
}

/**
 * Validação simples de formato de e-mail.
 */
export function isValidEmail(email: unknown): boolean {
  if (typeof email !== 'string') return false;
  const trimmed = email.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

/**
 * Retorna o provedor de e-mail ativo conforme a configuração global.
 */
export function resolveEmailProvider(config: PortalAuthConfigData) {
  if (!config.email_enabled) return null;
  if (config.email_provider === 'resend') {
    return resendEmailProvider;
  }
  if (config.email_provider === 'base44_core') {
    return base44EmailProvider;
  }
  return base44EmailProvider; // fallback padrão
}

/**
 * Retorna o provedor de WhatsApp ativo conforme a configuração global.
 */
export function resolveWhatsAppProvider(config: PortalAuthConfigData) {
  if (!config.whatsapp_enabled) return null;
  if (config.whatsapp_provider === 'evolution_api') {
    return evolutionWhatsAppProvider;
  }
  return null;
}

/**
 * Carrega a configuração global de autenticação com fail-safe server-side.
 */
export async function loadAuthConfig(base44Client: any): Promise<PortalAuthConfigData> {
  try {
    const PortalAuthConfig = base44Client?.asServiceRole?.entities?.PortalAuthConfig;
    if (!PortalAuthConfig) {
      return DEFAULT_AUTH_CONFIG;
    }

    let configs = await PortalAuthConfig.filter({ ativo: true }, '-updated_at', 5, 0);
    if (!Array.isArray(configs) || configs.length === 0) {
      configs = await PortalAuthConfig.list();
    }
    if (!Array.isArray(configs) || configs.length === 0) {
      return DEFAULT_AUTH_CONFIG;
    }

    if (configs.length > 1) {
      console.warn('[loadAuthConfig] Múltiplos registros de PortalAuthConfig encontrados. Utilizando o mais recente.');
    }

    const c = configs[0];
    return {
      id: c.id,
      email_enabled: typeof c.email_enabled === 'boolean' ? c.email_enabled : false,
      sms_enabled: typeof c.sms_enabled === 'boolean' ? c.sms_enabled : false,
      whatsapp_enabled: typeof c.whatsapp_enabled === 'boolean' ? c.whatsapp_enabled : true,
      email_provider: c.email_provider || (c.email_enabled ? 'base44_core' : 'disabled'),
      sms_provider: c.sms_provider || 'disabled',
      whatsapp_provider: c.whatsapp_provider || 'evolution_api',
      allow_channel_choice: typeof c.allow_channel_choice === 'boolean' ? c.allow_channel_choice : (Boolean(c.email_enabled) && Boolean(c.whatsapp_enabled)),
      default_channel: c.default_channel || (c.whatsapp_enabled !== false ? 'WHATSAPP' : 'EMAIL'),
      otp_ttl_seconds: typeof c.otp_ttl_seconds === 'number' && c.otp_ttl_seconds > 0 ? c.otp_ttl_seconds : 300,
      otp_resend_seconds: typeof c.otp_resend_seconds === 'number' && c.otp_resend_seconds > 0 ? c.otp_resend_seconds : 60,
      otp_max_attempts: typeof c.otp_max_attempts === 'number' && c.otp_max_attempts > 0 ? c.otp_max_attempts : 3,
      otp_max_sends_per_hour: typeof c.otp_max_sends_per_hour === 'number' && c.otp_max_sends_per_hour > 0 ? c.otp_max_sends_per_hour : 3,
      ativo: c.ativo !== false,
    };
  } catch (err) {
    console.error('[loadAuthConfig] Erro ao consultar PortalAuthConfig, aplicando defaults:', err);
    return DEFAULT_AUTH_CONFIG;
  }
}

/**
 * Retorna a lista pública de métodos disponíveis baseada estritamente na configuração global operacional.
 * (Anti-enumeração: não deriva dos contatos do militar específico).
 */
export function getAvailablePublicMethods(config: PortalAuthConfigData): PublicMethodOption[] {
  const metodos: PublicMethodOption[] = [];

  const emailProv = resolveEmailProvider(config);
  if (emailProv && emailProv.isOperational(config)) {
    metodos.push({ canal: 'EMAIL', label: 'E-mail cadastrado' });
  }

  const waProv = resolveWhatsAppProvider(config);
  if (waProv && waProv.isOperational(config)) {
    metodos.push({ canal: 'WHATSAPP', label: 'WhatsApp cadastrado' });
  }

  if (config.sms_enabled && config.sms_provider !== 'disabled') {
    metodos.push({ canal: 'SMS', label: 'SMS cadastrado' });
  }

  return metodos;
}

/**
 * Seleciona o melhor endereço de e-mail do militar seguindo a prioridade:
 * 1. email_funcional válido
 * 2. email_particular válido
 */
export function resolveMilitarEmail(militar: any): { email: string | null; tipo: 'funcional' | 'particular' | null } {
  if (!militar) return { email: null, tipo: null };

  const funcional = militar.email_funcional?.trim();
  if (funcional && isValidEmail(funcional)) {
    return { email: funcional, tipo: 'funcional' };
  }

  const particular = militar.email_particular?.trim();
  if (particular && isValidEmail(particular)) {
    return { email: particular, tipo: 'particular' };
  }

  return { email: null, tipo: null };
}

/**
 * Seleciona e normaliza o número de WhatsApp/celular do militar.
 */
export function resolveMilitarTelefone(militar: any): { telefone: string | null; formatted: string | null } {
  if (!militar) return { telefone: null, formatted: null };

  const rawPhone = militar.telefone_celular || militar.celular || militar.telefone || militar.telefone_recado;
  if (!rawPhone) return { telefone: null, formatted: null };

  const formatted = normalizeWhatsAppNumber(rawPhone);
  if (!formatted) return { telefone: null, formatted: null };

  return {
    telefone: String(rawPhone).trim(),
    formatted,
  };
}

/**
 * Gera um request_id criptograficamente seguro e opaco.
 */
export function generateRequestId(): string {
  return generatePortalToken(); // 256-bit CSPRNG hex string
}
