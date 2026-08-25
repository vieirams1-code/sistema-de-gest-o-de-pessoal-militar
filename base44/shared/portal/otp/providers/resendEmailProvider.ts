/**
 * Provedor de envio de OTP via API REST do Resend (https://resend.com).
 * Permite envio de e-mails para qualquer domínio institucional ou pessoal
 * sem depender de configuração de domínio customizado no Base44.
 */

import type { OtpDeliveryProvider, OtpDeliveryParams, OtpDeliveryResult, PortalAuthConfigData } from '../types.ts';

export interface ResendProviderOptions {
  apiKey?: string;
  fromAddress?: string;
}

export class ResendEmailProvider implements OtpDeliveryProvider {
  readonly channel = 'EMAIL' as const;
  readonly name = 'resend';
  private apiKey?: string;
  private fromAddress: string;

  constructor(options?: ResendProviderOptions) {
    this.apiKey = options?.apiKey || (typeof Deno !== 'undefined' ? Deno.env.get('RESEND_API_KEY') || Deno.env.get('PORTAL_EMAIL_API_KEY') : undefined);
    this.fromAddress = options?.fromAddress || (typeof Deno !== 'undefined' ? Deno.env.get('RESEND_FROM_EMAIL') : undefined) || 'Portal do Militar <onboarding@resend.dev>';
  }

  isOperational(config: PortalAuthConfigData): boolean {
    return config.email_enabled === true && config.email_provider === 'resend';
  }

  async sendOtp(params: OtpDeliveryParams, _base44Client?: any): Promise<OtpDeliveryResult> {
    const key = this.apiKey || (typeof Deno !== 'undefined' ? Deno.env.get('RESEND_API_KEY') || Deno.env.get('PORTAL_EMAIL_API_KEY') : undefined);

    if (!key) {
      console.error('[ResendEmailProvider] Chave de API RESEND_API_KEY não configurada no ambiente.');
      return {
        success: false,
        provider: 'resend',
        error: 'Chave do provedor Resend não configurada nos secrets da aplicação.',
      };
    }

    try {
      const subject = 'Código de acesso — Portal do Militar';
      const text = `Seu código de acesso ao Portal do Militar é: ${params.code}\n\nEste código expira em 5 minutos.\n\nSe você não solicitou este acesso, ignore esta mensagem.\n\nNão compartilhe este código.`;

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.fromAddress,
          to: [params.to],
          subject,
          text,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        console.error(`[ResendEmailProvider] Falha HTTP ${response.status} na API Resend:`, errorBody.slice(0, 200));
        return {
          success: false,
          provider: 'resend',
          error: `Falha no envio via Resend (HTTP ${response.status}).`,
        };
      }

      return {
        success: true,
        provider: 'resend',
      };
    } catch (err: any) {
      console.error('[ResendEmailProvider] Erro ao conectar à API Resend:', err?.message || err);
      return {
        success: false,
        provider: 'resend',
        error: 'Erro de conexão com o serviço de e-mail Resend.',
      };
    }
  }
}

export const resendEmailProvider = new ResendEmailProvider();
