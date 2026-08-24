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
    return Response.json(
      { error: 'METODO_NAO_PERMITIDO' },
      { status: 405, headers: CORS_HEADERS }
    );
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
      return Response.json(
        { error: 'PAYLOAD_INVALIDO: JSON malformado.' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Valida que portal_getMe não recebe campos de entrada funcionais inesperados
    if (payload && typeof payload === 'object') {
      const allowedKeys = new Set(['portal_token']);
      const invalidKeys = Object.keys(payload).filter((k) => !allowedKeys.has(k));
      if (invalidKeys.length > 0) {
        return Response.json(
          { error: `CAMPOS_NAO_PERMITIDOS: ${invalidKeys.join(', ')}` },
          { status: 400, headers: CORS_HEADERS }
        );
      }
    }

    // 1. Validação de Sessão Server-Side (Session Guard)
    const sessionCheck = await requirePortalSession(req, base44, payload);
    if (!sessionCheck.ok || !sessionCheck.context) {
      return Response.json(
        { error: sessionCheck.error || 'UNAUTHORIZED' },
        { status: sessionCheck.status || 401, headers: CORS_HEADERS }
      );
    }

    const { sessao_id, militar_id, correlation_id, ip_origem, user_agent } = sessionCheck.context;

    // 2. Busca o Militar vinculado à sessão via Service Role
    const MilitarEntity = base44.asServiceRole?.entities?.Militar;
    if (!MilitarEntity) {
      return Response.json(
        { error: 'SERVICO_INDISPONIVEL' },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const militar = await MilitarEntity.get(militar_id);
    if (!militar) {
      return Response.json(
        { error: 'MILITAR_NAO_ENCONTRADO' },
        { status: 404, headers: CORS_HEADERS }
      );
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

    return Response.json(
      { ok: true, militar: dto },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (error: any) {
    console.error('[portal_getMe] Erro não tratado:', error?.message || error);
    return Response.json(
      { error: 'ERRO_INTERNO' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
});
