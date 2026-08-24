import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { generatePortalToken, hashPortalToken, generateCorrelationId } from '../../shared/portal/portalCrypto.ts';
import { registrarAuditoriaPortal, extractClientIp, extractUserAgent } from '../../shared/portal/requirePortalSession.ts';

/**
 * ============================================================================
 * SESSÃO DE TESTE DE DESENVOLVIMENTO (DEV ONLY - REVISADO)
 * ----------------------------------------------------------------------------
 * ATENÇÃO: Esta function existe EXCLUSIVAMENTE para viabilizar testes da Fase 1.2
 * sem a necessidade de um provedor real de SMS/WhatsApp.
 *
 * BARREIRAS DE SEGURANÇA OBRIGATÓRIAS:
 * 1. PORTAL_DEV_MODE === 'true' estrito (sem fallbacks).
 * 2. Usuário autenticado válido via Base44 Auth (base44.auth.me()).
 * 3. Usuário com role 'admin'.
 * 4. militar_id configurado estritamente via PORTAL_DEV_TEST_MILITAR_ID (Fail Closed).
 *    Nenhum militar_id vindo do payload do request é aceito.
 * ============================================================================
 */
Deno.serve(async (req: Request) => {
  try {
    const ip_origem = extractClientIp(req);
    const user_agent = extractUserAgent(req);
    const correlation_id = generateCorrelationId();

    // 1. Barreira: PORTAL_DEV_MODE estrito
    const portalDevMode = Deno.env.get('PORTAL_DEV_MODE');
    if (portalDevMode !== 'true') {
      return Response.json(
        { error: 'ACESSO_NEGADO: Endpoint disponível exclusivamente quando PORTAL_DEV_MODE=true.' },
        { status: 403 }
      );
    }

    // 2. Barreira: Autenticação Base44 válida
    const base44 = createClientFromRequest(req);
    let authUser: any = null;
    try {
      authUser = await base44.auth.me();
    } catch (_authErr) {
      authUser = null;
    }

    if (!authUser || !authUser.email) {
      return Response.json(
        { error: 'ACESSO_NEGADO: Autenticação administrativa Base44 obrigatória.' },
        { status: 401 }
      );
    }

    // 3. Barreira: Role Admin obrigatória
    const isAdmin = String(authUser.role || '').toLowerCase() === 'admin';
    if (!isAdmin) {
      await registrarAuditoriaPortal(base44, {
        acao: 'ERRO_SEGURANCA',
        resultado: false,
        motivo_falha_sanitizado: `Tentativa de gerar sessão dev por usuário não-admin: ${authUser.email}`,
        ip_origem,
        user_agent,
        correlation_id,
      });
      return Response.json(
        { error: 'ACESSO_NEGADO: Apenas administradores podem gerar sessão de teste.' },
        { status: 403 }
      );
    }

    // 4. Barreira: militar_id vem estritamente do Secret de Ambiente (Fail Closed)
    const testMilitarId = Deno.env.get('PORTAL_DEV_TEST_MILITAR_ID')?.trim();
    if (!testMilitarId) {
      return Response.json(
        { error: 'CONFIGURACAO_AUSENTE: PORTAL_DEV_TEST_MILITAR_ID não configurado no ambiente. Falha fechada.' },
        { status: 500 }
      );
    }

    // 5. Gera token de 256 bits e calcula hash SHA-256
    const rawToken = generatePortalToken();
    const tokenHash = await hashPortalToken(rawToken);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString(); // 4 horas

    // 6. Persiste sessão ATIVA no banco
    const PortalSessao = base44.asServiceRole?.entities?.PortalSessao;
    if (!PortalSessao) {
      return Response.json({ error: 'Entidade PortalSessao indisponível.' }, { status: 500 });
    }

    const sessao = await PortalSessao.create({
      militar_id: testMilitarId,
      status: 'ATIVA',
      token_hash: tokenHash,
      token_expires_at: expiresAt,
      last_activity_at: now.toISOString(),
      absolute_expires_at: expiresAt,
      ip_criacao: ip_origem,
      user_agent_criacao: user_agent,
      created_at: now.toISOString(),
    });

    // 7. Auditoria da sessão gerada
    await registrarAuditoriaPortal(base44, {
      sessao_id: sessao.id,
      militar_id: testMilitarId,
      acao: 'LOGIN_SUCESSO',
      resultado: true,
      motivo_falha_sanitizado: `Sessão de teste gerada pelo admin ${authUser.email}`,
      ip_origem,
      user_agent,
      correlation_id,
    });

    // 8. Retorna rawToken uma única vez
    return Response.json({
      ok: true,
      token: rawToken,
      sessao_id: sessao.id,
      militar_id: testMilitarId,
      expires_at: expiresAt,
    });
  } catch (error: any) {
    console.error('[portal_dev_createSession] Erro:', error);
    return Response.json({ error: 'Falha interna ao criar sessão de desenvolvimento.' }, { status: 500 });
  }
});
