import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { requirePortalSession, registrarAuditoriaPortal } from '../../shared/portal/requirePortalSession.ts';

export interface PortalMilitarDTO {
  id: string;
  nome_completo: string;
  nome_guerra: string;
  posto_graduacao: string;
  quadro: string;
  lotacao: string;
  estrutura_nome: string;
  situacao_militar: string;
  foto_url: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Portal-Token, X-App-Id',
};

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Endpoint de autoatendimento para o militar consultar seus dados básicos de identificação.
 * Protegido estritamente pelo Session Guard (X-Portal-Token).
 */
Deno.serve(async (req: Request) => {
  // Tratamento de CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS,
    });
  }

  // Validação de métodos permitidos
  if (req.method !== 'GET' && req.method !== 'POST') {
    return jsonResponse({ error: 'METODO_NAO_PERMITIDO' }, 405);
  }

  try {
    const base44 = createClientFromRequest(req);

    // Lê payload opcional
    let payload: any = null;
    try {
      if (req.method === 'POST') {
        const text = await req.text();
        if (text && text.trim()) {
          payload = JSON.parse(text);
        }
      }
    } catch (_e) {
      return jsonResponse({ error: 'PAYLOAD_INVALIDO: JSON malformado.' }, 400);
    }

    // 1. Validação de Sessão Server-Side (Session Guard)
    const sessionCheck = await requirePortalSession(req, base44, payload);
    if (!sessionCheck.ok || !sessionCheck.context) {
      return jsonResponse(
        { error: sessionCheck.error || 'UNAUTHORIZED' },
        sessionCheck.status || 401
      );
    }

    const { sessao_id, militar_id, correlation_id, ip_origem, user_agent } = sessionCheck.context;

    // 2. Busca o Militar vinculado à sessão via Service Role
    const MilitarEntity = base44.asServiceRole?.entities?.Militar || base44.entities?.Militar;
    if (!MilitarEntity) {
      return jsonResponse({ error: 'SERVICO_INDISPONIVEL' }, 500);
    }

    let militar: any = null;
    try {
      militar = await MilitarEntity.get(militar_id);
    } catch (_e) {}

    if (!militar) {
      return jsonResponse({ error: 'MILITAR_NAO_ENCONTRADO' }, 404);
    }

    // 3. Projeção DTO estrita (Whitelist de campos permitidos - sem vazamento de CPF/RG/dados sensíveis)
    const dto: PortalMilitarDTO = {
      id: String(militar.id || ''),
      nome_completo: String(militar.nome_completo || ''),
      nome_guerra: String(militar.nome_guerra || ''),
      posto_graduacao: String(militar.posto_graduacao || ''),
      quadro: String(militar.quadro || ''),
      lotacao: String(militar.lotacao || ''),
      estrutura_nome: String(militar.estrutura_nome || militar.lotacao || ''),
      situacao_militar: String(militar.situacao_militar || 'Ativa'),
      foto_url: String(militar.foto || militar.foto_url || ''),
    };

    // 4. Auditoria de acesso
    try {
      await registrarAuditoriaPortal(base44, {
        sessao_id,
        militar_id,
        acao: 'PORTAL_GET_ME',
        resultado: true,
        recurso_tipo: 'Militar',
        recurso_id: militar_id,
        ip_origem,
        user_agent,
        correlation_id,
      });
    } catch (_e) {}

    return jsonResponse({ ok: true, militar: dto }, 200);
  } catch (error: any) {
    console.error('[portal_getMe] Erro não tratado:', error?.message || error);
    return jsonResponse({ error: 'ERRO_INTERNO' }, 500);
  }
});
