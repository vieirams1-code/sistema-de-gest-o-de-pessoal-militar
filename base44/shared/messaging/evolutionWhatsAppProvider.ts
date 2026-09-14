/**
 * Camada genérica de mensagens WhatsApp do SGP Militar.
 *
 * Mantém a infraestrutura de comunicação desacoplada do Portal do Militar.
 * Reutiliza os mesmos secrets/instância Evolution já adotados pelo projeto,
 * sem depender de módulos, entidades ou funções do Portal.
 */

export interface WhatsAppSendResult {
  success: boolean;
  provider: 'evolution_api';
  messageId?: string;
  error?: string;
}

export function normalizeWhatsAppNumber(rawPhone: unknown): string | null {
  if (typeof rawPhone !== 'string' && typeof rawPhone !== 'number') return null;
  let digits = String(rawPhone).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('00')) digits = digits.slice(2);

  // Telefones nacionais com DDD.
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;

  // Telefones brasileiros já com DDI.
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) return digits;

  // Cadastros antigos sem DDD: mantém a convenção já usada pelo SGP/CBMMS (DDD 67).
  if (digits.length === 8 || digits.length === 9) return `5567${digits}`;

  // Outros formatos internacionais plausíveis são preservados.
  if (digits.length >= 10 && digits.length <= 15) return digits;
  return null;
}

function readConfig() {
  const apiUrl = Deno.env.get('EVOLUTION_API_URL') || Deno.env.get('WHATSAPP_API_URL') || '';
  const apiKey = Deno.env.get('EVOLUTION_API_KEY') || Deno.env.get('WHATSAPP_API_KEY') || '';
  const instanceName = Deno.env.get('EVOLUTION_INSTANCE_NAME')
    || Deno.env.get('WHATSAPP_INSTANCE_NAME')
    || 'vivicas_portal';
  return { apiUrl, apiKey, instanceName };
}

export function isEvolutionWhatsAppConfigured(): boolean {
  const { apiUrl, apiKey } = readConfig();
  return Boolean(apiUrl && apiKey);
}

export async function sendEvolutionWhatsAppText(params: {
  to: string;
  text: string;
}): Promise<WhatsAppSendResult> {
  const { apiUrl, apiKey, instanceName } = readConfig();
  if (!apiUrl || !apiKey) {
    return {
      success: false,
      provider: 'evolution_api',
      error: 'Provedor de WhatsApp não configurado nos secrets da aplicação.',
    };
  }

  const number = normalizeWhatsAppNumber(params.to);
  if (!number) {
    return {
      success: false,
      provider: 'evolution_api',
      error: 'Número de telefone inválido.',
    };
  }

  const text = String(params.text || '').trim();
  if (!text) {
    return {
      success: false,
      provider: 'evolution_api',
      error: 'Mensagem vazia.',
    };
  }

  const endpoint = `${apiUrl.replace(/\/+$/, '')}/message/sendText/${encodeURIComponent(instanceName)}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        apikey: apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        number,
        text,
        options: {
          delay: 800,
          presence: 'composing',
          linkPreview: false,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.error('[Messaging/Evolution] Falha HTTP', response.status, body.slice(0, 200));
      return {
        success: false,
        provider: 'evolution_api',
        error: `Falha no envio via WhatsApp (HTTP ${response.status}).`,
      };
    }

    let payload: any = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    const messageId = String(
      payload?.key?.id
      || payload?.message?.key?.id
      || payload?.id
      || ''
    ).trim() || undefined;

    return {
      success: true,
      provider: 'evolution_api',
      messageId,
    };
  } catch (error: any) {
    console.error('[Messaging/Evolution] Erro de conexão:', error?.message || error);
    return {
      success: false,
      provider: 'evolution_api',
      error: error?.name === 'AbortError'
        ? 'Timeout na conexão com o WhatsApp.'
        : 'Erro de conexão com o servidor do WhatsApp.',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
