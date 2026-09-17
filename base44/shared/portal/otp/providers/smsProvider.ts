import type { OtpDeliveryProvider, OtpDeliveryParams, OtpDeliveryResult, PortalAuthConfigData } from '../types.ts';

function env(name: string): string {
  return typeof Deno !== 'undefined' ? (Deno.env.get(name) || '').trim() : '';
}

export function normalizeSmsNumber(rawPhone: unknown): string | null {
  if (typeof rawPhone !== 'string' && typeof rawPhone !== 'number') return null;
  let digits = String(rawPhone).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 8 || digits.length === 9) digits = `5567${digits}`;
  else if ((digits.length === 10 || digits.length === 11) && !digits.startsWith('55')) digits = `55${digits}`;
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

function providerName(config: PortalAuthConfigData): string {
  return String(config.sms_provider || '').trim().toLowerCase();
}

export function isSmsConfigured(config: PortalAuthConfigData): boolean {
  const provider = providerName(config);
  if (!config.sms_enabled || provider === 'disabled' || !provider) return false;
  if (provider === 'twilio') return Boolean(env('TWILIO_ACCOUNT_SID') && env('TWILIO_AUTH_TOKEN') && (env('TWILIO_FROM') || env('TWILIO_MESSAGING_SERVICE_SID')));
  if (provider === 'zenvia') return Boolean((env('ZENVIA_API_TOKEN') || env('ZENVIA_API_KEY')) && (env('ZENVIA_FROM') || env('ZENVIA_SENDER')));
  if (provider === 'infobip') return Boolean((env('INFOBIP_API_KEY') || env('SMS_API_KEY')) && (env('INFOBIP_BASE_URL') || env('SMS_BASE_URL')));
  if (provider === 'http' || provider === 'generic') return Boolean(env('SMS_API_URL') && env('SMS_API_KEY'));
  return false;
}

async function sendTwilio(to: string, text: string): Promise<OtpDeliveryResult> {
  const sid = env('TWILIO_ACCOUNT_SID');
  const token = env('TWILIO_AUTH_TOKEN');
  const from = env('TWILIO_FROM');
  const messagingServiceSid = env('TWILIO_MESSAGING_SERVICE_SID');
  const body = new URLSearchParams({ To: to, Body: text });
  if (messagingServiceSid) body.set('MessagingServiceSid', messagingServiceSid);
  else body.set('From', from);
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${btoa(`${sid}:${token}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) return { success: false, provider: 'twilio', error: `Falha no envio via Twilio (HTTP ${response.status}).` };
  return { success: true, provider: 'twilio' };
}

async function sendZenvia(to: string, text: string): Promise<OtpDeliveryResult> {
  const token = env('ZENVIA_API_TOKEN') || env('ZENVIA_API_KEY');
  const sender = env('ZENVIA_FROM') || env('ZENVIA_SENDER');
  const response = await fetch(env('ZENVIA_API_URL') || 'https://api.zenvia.com/v2/channels/sms/messages', {
    method: 'POST',
    headers: { Authorization: token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: sender, to, contents: [{ type: 'text', text }] }),
  });
  if (!response.ok) return { success: false, provider: 'zenvia', error: `Falha no envio via Zenvia (HTTP ${response.status}).` };
  return { success: true, provider: 'zenvia' };
}

async function sendInfobip(to: string, text: string): Promise<OtpDeliveryResult> {
  const key = env('INFOBIP_API_KEY') || env('SMS_API_KEY');
  const baseUrl = (env('INFOBIP_BASE_URL') || env('SMS_BASE_URL')).replace(/\/+$/, '');
  const sender = env('INFOBIP_SENDER') || env('SMS_SENDER') || 'VIVICAS';
  const response = await fetch(`${baseUrl}/sms/2/text/advanced`, {
    method: 'POST',
    headers: { Authorization: `App ${key}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ messages: [{ destinations: [{ to }], from: sender, text }] }),
  });
  if (!response.ok) return { success: false, provider: 'infobip', error: `Falha no envio via Infobip (HTTP ${response.status}).` };
  return { success: true, provider: 'infobip' };
}

async function sendGeneric(to: string, text: string): Promise<OtpDeliveryResult> {
  const response = await fetch(env('SMS_API_URL'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('SMS_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, message: text, sender: env('SMS_SENDER') || 'VIVICAS' }),
  });
  if (!response.ok) return { success: false, provider: 'http', error: `Falha no envio via API SMS (HTTP ${response.status}).` };
  return { success: true, provider: 'http' };
}

export class SmsProvider implements OtpDeliveryProvider {
  readonly channel = 'SMS' as const;

  isOperational(config: PortalAuthConfigData): boolean {
    return isSmsConfigured(config);
  }

  async sendOtp(params: OtpDeliveryParams, _base44Client?: any): Promise<OtpDeliveryResult> {
    const to = normalizeSmsNumber(params.to);
    const provider = String(params.provider || env('SMS_PROVIDER') || '').trim().toLowerCase();
    if (!to) return { success: false, provider: provider || 'sms', error: 'Número de telefone do militar inválido.' };
    const text = `VIVICAS - SGP Militar: seu código de acesso é ${params.code}. Válido por 5 minutos. Não compartilhe este código.`;
    try {
      if (provider === 'twilio') return await sendTwilio(to, text);
      if (provider === 'zenvia') return await sendZenvia(to, text);
      if (provider === 'infobip') return await sendInfobip(to, text);
      return await sendGeneric(to, text);
    } catch (error: any) {
      console.error('[SmsProvider] Falha no envio:', error?.message || error);
      return { success: false, provider, error: 'Erro de conexão com o provedor de SMS.' };
    }
  }
}

export const smsProvider = new SmsProvider();
