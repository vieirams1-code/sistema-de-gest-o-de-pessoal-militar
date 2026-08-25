import { appParams } from '@/lib/app-params';
import { base44 } from '@/api/base44Client';

const PORTAL_TOKEN_STORAGE_KEY = 'sgp_portal_token';
const REQUEST_TIMEOUT_MS = 15000; // 15 segundos

/**
 * Recupera o PortalToken armazenado no sessionStorage.
 */
export function getPortalToken() {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage.getItem(PORTAL_TOKEN_STORAGE_KEY);
}

/**
 * Persiste o PortalToken no sessionStorage.
 */
export function setPortalToken(token) {
  if (typeof window === 'undefined') return;
  if (token) {
    window.sessionStorage.setItem(PORTAL_TOKEN_STORAGE_KEY, token);
  } else {
    window.sessionStorage.removeItem(PORTAL_TOKEN_STORAGE_KEY);
  }
}

/**
 * Remove o PortalToken do sessionStorage.
 */
export function clearPortalToken() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(PORTAL_TOKEN_STORAGE_KEY);
}

/**
 * Cliente HTTP seguro para comunicação do Portal do Militar com as Deno Functions.
 *
 * REGRAS DE SEGURANÇA:
 * 1. O token é transportado exclusivamente via header HTTP (X-Portal-Token e Authorization).
 * 2. O token NUNCA é colocado na URL ou em query strings.
 * 3. O token NUNCA é colocado no body em requisições com headers disponíveis.
 * 4. O token NUNCA é exibido em logs de console.
 * 5. Proibido consultar entidades do SDK diretamente no frontend do Portal.
 */
export async function portalFetch(functionName, data = {}) {
  const token = getPortalToken();
  const serverUrl = appParams.serverUrl || '';
  const appId = appParams.appId || '';

  // 1. Caminho Principal: Fetch HTTP direto com Headers de Autorização
  if (serverUrl && appId && typeof window !== 'undefined' && window.fetch) {
    const endpointUrl = `${serverUrl}/api/apps/${appId}/functions/${functionName}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const headers = {
        'Content-Type': 'application/json',
        'X-App-Id': appId,
      };

      if (token) {
        headers['X-Portal-Token'] = token;
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Tratamento automático de expiração / 401
      if (response.status === 401) {
        clearPortalToken();
      }

      let json = null;
      try {
        json = await response.json();
      } catch (_jsonErr) {
        json = null;
      }

      if (!response.ok) {
        const error = new Error(json?.error || `HTTP_${response.status}`);
        error.status = response.status;
        error.data = json;
        throw error;
      }

      return json;
    } catch (fetchErr) {
      clearTimeout(timeoutId);
      if (fetchErr.name === 'AbortError') {
        const timeoutError = new Error('TIMEOUT_REQUISICAO: O servidor demorou muito para responder.');
        timeoutError.status = 408;
        throw timeoutError;
      }

      // Se for erro de autorização/cliente, propaga imediatamente
      if (fetchErr?.status === 401 || fetchErr?.status === 403 || fetchErr?.status === 400 || fetchErr?.status === 404 || fetchErr?.status === 405) {
        throw fetchErr;
      }
    }
  }

  // 2. Caminho de Fallback via SDK invoke (caso fetch direto não esteja disponível)
  try {
    const fallbackPayload = { ...data };
    if (token) {
      fallbackPayload.portal_token = token;
    }

    const response = await base44.functions.invoke(functionName, fallbackPayload);
    const body = response?.data ?? response;
    if (body?.error) {
      const err = new Error(body.error);
      err.status = response?.status || 400;
      err.data = body;
      throw err;
    }
    return body;
  } catch (sdkErr) {
    const status = sdkErr?.response?.status || sdkErr?.status || 500;
    if (status === 401) {
      clearPortalToken();
    }
    const body = sdkErr?.response?.data || sdkErr?.data || {};
    const err = new Error(body?.error || sdkErr.message || 'Falha na comunicação com o servidor.');
    err.status = status;
    err.data = body;
    throw err;
  }
}

/**
 * Inicia o desafio de autenticação identificando o militar por CPF.
 */
export async function iniciarAuth(cpf) {
  return portalFetch('portal_auth', {
    acao: 'INICIAR',
    cpf,
  });
}

/**
 * Solicita o envio do código OTP pelo canal escolhido.
 */
export async function enviarOtp(requestId, canal = 'EMAIL') {
  return portalFetch('portal_auth', {
    acao: 'ENVIAR',
    request_id: requestId,
    canal,
  });
}

/**
 * Valida o código OTP e obtém o PortalToken.
 */
export async function validarOtp(requestId, otp) {
  const result = await portalFetch('portal_auth', {
    acao: 'VALIDAR',
    request_id: requestId,
    otp,
  });
  if (result?.token) {
    setPortalToken(result.token);
  }
  return result;
}

/**
 * Consulta o perfil seguro do militar autenticado.
 */
export async function getMe() {
  return portalFetch('portal_getMe');
}

/**
 * Consulta os dados cadastrais completos e dependentes (Fase 1.3A).
 */
export async function getCadastro() {
  return portalFetch('portal_servicos', { acao: 'CADASTRO_GET' });
}

/**
 * Confirma a veracidade dos dados cadastrais com carimbo de tempo (Fase 1.3A).
 */
export async function confirmarCadastro() {
  return portalFetch('portal_servicos', { acao: 'CADASTRO_CONFIRMAR' });
}

/**
 * Envia uma solicitação de alteração cadastral para análise do RH (Fase 1.3A).
 */
export async function solicitarAlteracaoCadastral({ campo_chave, campo_label, valor_atual, valor_proposto, justificativa }) {
  return portalFetch('portal_servicos', {
    acao: 'CADASTRO_SOLICITAR_ALTERACAO',
    campo_chave,
    campo_label,
    valor_atual,
    valor_proposto,
    justificativa,
  });
}

/**
 * Consulta os períodos aquisitivos e histórico de férias (Fase 1.3B).
 */
export async function getFerias() {
  return portalFetch('portal_servicos', { acao: 'FERIAS_GET' });
}

/**
 * Submete as 3 opções de preferências de férias para o plano anual (Fase 1.3B).
 */
export async function submeterOpcaoFerias({
  periodo_aquisitivo_id,
  ano_referencia,
  modalidade,
  opcao_1,
  opcao_2,
  opcao_3,
  parcelas,
}) {
  return portalFetch('portal_servicos', {
    acao: 'FERIAS_SUBMETER_OPCAO',
    periodo_aquisitivo_id,
    ano_referencia,
    modalidade,
    opcao_1,
    opcao_2,
    opcao_3,
    parcelas,
  });
}


