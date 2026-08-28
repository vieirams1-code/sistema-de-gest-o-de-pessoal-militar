/**
 * Provedor de envio de OTP via Evolution API (WhatsApp Open-Source).
 * Permite envio de mensagens para qualquer WhatsApp sem taxas por mensagem.
 * Endpoint padrão: POST {EVOLUTION_API_URL}/message/sendText/{EVOLUTION_INSTANCE_NAME}
 */

import type { OtpDeliveryProvider, OtpDeliveryParams, OtpDeliveryResult, PortalAuthConfigData } from '../types.ts';

export interface EvolutionProviderOptions {
  apiUrl?: string;
  apiKey?: string;
  instanceName?: string;
}

/**
 * Normaliza número de telefone para o formato internacional exigido pelo WhatsApp (DDI 55 + DDD + Número).
 */
export function normalizeWhatsAppNumber(rawPhone: unknown): string | null {
  if (typeof rawPhone !== 'string' && typeof rawPhone !== 'number') return null;
  const digits = String(rawPhone).replace(/\D/g, '');

  if (!digits) return null;

  // Formato: 11 dígitos com DDD (ex: 67999998888) -> 5567999998888
  if (digits.length === 11) {
    return `55${digits}`;
  }

  // Formato: 10 dígitos com DDD sem 9 (ex: 6799998888) -> 556799998888
  if (digits.length === 10) {
    return `55${digits}`;
  }

  // Formato: 13 dígitos já com DDI 55 (ex: 5567999998888)
  if (digits.length === 13 && digits.startsWith('55')) {
    return digits;
  }

  // Formato: 12 dígitos já com DDI 55 (ex: 556799998888)
  if (digits.length === 12 && digits.startsWith('55')) {
    return digits;
  }

  // Formato: 8 ou 9 dígitos sem DDD (ex: 999998888 ou 99998888) -> assume DDD 67 padrão da corporação
  if (digits.length === 9 || digits.length === 8) {
    return `5567${digits}`;
  }

  // Se tiver pelo menos 10 dígitos, tenta adicionar 55 se não tiver
  if (digits.length >= 10 && !digits.startsWith('55')) {
    return `55${digits}`;
  }

  return digits.length >= 10 ? digits : null;
}

export class EvolutionWhatsAppProvider implements OtpDeliveryProvider {
  readonly channel = 'WHATSAPP' as const;
  readonly name = 'evolution_api';
  private apiUrl?: string;
  private apiKey?: string;
  private instanceName?: string;

  constructor(options?: EvolutionProviderOptions) {
    this.apiUrl = options?.apiUrl || (typeof Deno !== 'undefined' ? Deno.env.get('EVOLUTION_API_URL') || Deno.env.get('WHATSAPP_API_URL') : undefined);
    this.apiKey = options?.apiKey || (typeof Deno !== 'undefined' ? Deno.env.get('EVOLUTION_API_KEY') || Deno.env.get('WHATSAPP_API_KEY') : undefined);
    this.instanceName = options?.instanceName || (typeof Deno !== 'undefined' ? Deno.env.get('EVOLUTION_INSTANCE_NAME') || Deno.env.get('WHATSAPP_INSTANCE_NAME') : undefined) || 'cbmms_portal';
  }

  isOperational(config: PortalAuthConfigData): boolean {
    return config.whatsapp_enabled === true && config.whatsapp_provider === 'evolution_api';
  }

  async sendOtp(params: OtpDeliveryParams, _base44Client?: any): Promise<OtpDeliveryResult> {
    const url = this.apiUrl || (typeof Deno !== 'undefined' ? Deno.env.get('EVOLUTION_API_URL') || Deno.env.get('WHATSAPP_API_URL') : undefined);
    const key = this.apiKey || (typeof Deno !== 'undefined' ? Deno.env.get('EVOLUTION_API_KEY') || Deno.env.get('WHATSAPP_API_KEY') : undefined);
    const instance = this.instanceName || (typeof Deno !== 'undefined' ? Deno.env.get('EVOLUTION_INSTANCE_NAME') || Deno.env.get('WHATSAPP_INSTANCE_NAME') : undefined) || 'cbmms_portal';

    if (!url || !key) {
      console.error('[EvolutionWhatsAppProvider] EVOLUTION_API_URL ou EVOLUTION_API_KEY não configuradas nos secrets.');
      return {
        success: false,
        provider: 'evolution_api',
        error: 'Provedor de WhatsApp não configurado nos secrets da aplicação.',
      };
    }

    const normalizedNumber = normalizeWhatsAppNumber(params.to);
    if (!normalizedNumber) {
      console.error('[EvolutionWhatsAppProvider] Número de telefone inválido para envio.');
      return {
        success: false,
        provider: 'evolution_api',
        error: 'Número de telefone do militar inválido.',
      };
    }

    try {
      const sanitizedBaseUrl = url.replace(/\/+$/, '');
      const endpoint = `${sanitizedBaseUrl}/message/sendText/${instance}`;

      const text = `*Portal do Militar — CBMMS*\n\nSeu código de acesso é: *${params.code}*\n\n_Este código expira em 5 minutos._\n_Não compartilhe este código com ninguém._`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'apikey': key,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          number: normalizedNumber,
          text: text,
          options: {
            delay: 1200,
            presence: 'composing',
            linkPreview: false,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        console.error(`[EvolutionWhatsAppProvider] Falha HTTP ${response.status} na Evolution API:`, errorBody.slice(0, 200));
        return {
          success: false,
          provider: 'evolution_api',
          error: `Falha no envio via Evolution API (HTTP ${response.status}).`,
        };
      }

      return {
        success: true,
        provider: 'evolution_api',
      };
    } catch (err: any) {
      console.error('[EvolutionWhatsAppProvider] Erro ao conectar com Evolution API:', err?.message || err);
      return {
        success: false,
        provider: 'evolution_api',
        error: err.name === 'AbortError' ? 'Timeout na conexão com o WhatsApp.' : 'Erro de conexão com o servidor do WhatsApp.',
      };
    }
  }

  async sendTextMessage(
    params: { to: string; text: string },
    base44: any
  ): Promise<{ success: boolean; provider: string; error?: string }> {
    const config = await this.getConfig(base44);
    if (!config) {
      return {
        success: false,
        provider: 'evolution_api',
        error: 'Configuração da API não encontrada.',
      };
    }

    const { url, key, instance } = config;

    const normalizedNumber = this.normalizeWhatsAppNumber(params.to);
    if (!normalizedNumber) {
      return {
        success: false,
        provider: 'evolution_api',
        error: 'Número de telefone inválido.',
      };
    }

    try {
      const sanitizedBaseUrl = url.replace(/\/+$/, '');
      const endpoint = `${sanitizedBaseUrl}/message/sendText/${instance}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'apikey': key,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          number: normalizedNumber,
          text: params.text,
          options: {
            delay: 1200,
            presence: 'composing',
            linkPreview: false,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        console.error(`[EvolutionWhatsAppProvider] Falha HTTP ${response.status} no sendTextMessage:`, errorBody.slice(0, 200));
        return {
          success: false,
          provider: 'evolution_api',
          error: `Falha no envio (HTTP ${response.status}).`,
        };
      }

      return {
        success: true,
        provider: 'evolution_api',
      };
    } catch (err: any) {
      console.error('[EvolutionWhatsAppProvider] Erro no sendTextMessage:', err?.message || err);
      return {
        success: false,
        provider: 'evolution_api',
        error: err.name === 'AbortError' ? 'Timeout na conexão.' : 'Erro de conexão.',
      };
    }
  }
}

export const evolutionWhatsAppProvider = new EvolutionWhatsAppProvider();
