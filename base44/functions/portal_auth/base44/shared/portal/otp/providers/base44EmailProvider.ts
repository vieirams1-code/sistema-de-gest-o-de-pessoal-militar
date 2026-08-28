import type { OtpDeliveryProvider, OtpDeliveryParams, OtpDeliveryResult, PortalAuthConfigData } from '../types.ts';

export class Base44EmailProvider implements OtpDeliveryProvider {
  readonly channel = 'EMAIL' as const;

  isOperational(config: PortalAuthConfigData): boolean {
    return config.email_enabled === true && config.email_provider === 'base44_core';
  }

  async sendOtp(params: OtpDeliveryParams, base44Client: any): Promise<OtpDeliveryResult> {
    try {
      const coreIntegrations = base44Client?.asServiceRole?.integrations?.Core || base44Client?.integrations?.Core;

      if (!coreIntegrations?.SendEmail) {
        console.error('[Base44EmailProvider] base44.integrations.Core.SendEmail não disponível no cliente.');
        return {
          success: false,
          provider: 'base44_core',
          error: 'Integração de e-mail Core indisponível no ambiente.',
        };
      }

      const subject = 'Código de acesso — Portal do Militar';
      const body = `Seu código de acesso ao Portal do Militar é: ${params.code}\n\nEste código expira em 5 minutos.\n\nSe você não solicitou este acesso, ignore esta mensagem.\n\nNão compartilhe este código.`;

      // Timeout wrapper to prevent edge function hang
      const sendPromise = coreIntegrations.SendEmail({
        to: params.to,
        subject,
        body,
        from_name: 'Portal do Militar',
      });

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('TIMEOUT_EMAIL')), 3500)
      );

      await Promise.race([sendPromise, timeoutPromise]);

      return {
        success: true,
        provider: 'base44_core',
      };
    } catch (err: any) {
      console.error('[Base44EmailProvider] Falha ao enviar e-mail:', err?.message || err);
      return {
        success: false,
        provider: 'base44_core',
        error: err?.message === 'TIMEOUT_EMAIL' ? 'Timeout na conexão com o servidor de e-mail.' : (err?.message || 'Falha no disparo do e-mail de autenticação.'),
      };
    }
  }
}

export const base44EmailProvider = new Base44EmailProvider();
