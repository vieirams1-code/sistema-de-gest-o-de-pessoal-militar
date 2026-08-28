import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import {
  generatePortalToken,
  hashPortalToken,
  generateOtp,
  hashOtp,
  timingSafeCompare,
  generateCorrelationId,
} from '../../shared/portal/portalCrypto.ts';
import {
  registrarAuditoriaPortal,
  extractClientIp,
  extractUserAgent,
} from '../../shared/portal/requirePortalSession.ts';
import {
  normalizeCpf,
  isValidCpf,
  loadAuthConfig,
  getAvailablePublicMethods,
  resolveMilitarEmail,
  resolveEmailProvider,
  resolveMilitarTelefone,
  resolveWhatsAppProvider,
  generateRequestId,
} from '../../shared/portal/otp/otpService.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Portal-Token, X-App-Id, Base44-Functions-Version',
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Método HTTP não permitido.' }, 405);
  }

  const correlation_id = generateCorrelationId();

  try {
    const ip_origem = extractClientIp(req);
    const user_agent = extractUserAgent(req);

    let payload: any = {};
    try {
      payload = await req.json();
    } catch (_e) {
      return jsonResponse({ error: 'Payload JSON inválido.' }, 400);
    }

    // Defesa IDOR ativa: Rejeição se militar_id for informado externamente
    if ('militar_id' in payload || 'militarId' in payload) {
      return jsonResponse({ error: 'Parâmetro de militar_id proibido neste endpoint.' }, 400);
    }

    const base44 = createClientFromRequest(req);
    const config = await loadAuthConfig(base44);
    const acao = String(payload?.acao || '').toUpperCase();

    switch (acao) {
      // ----------------------------------------------------------------------
      // ETAPA 1: INICIAR (Identificação por CPF)
      // ----------------------------------------------------------------------
      case 'INICIAR': {
        const cpfRaw = payload?.cpf;
        const cpfNorm = normalizeCpf(cpfRaw);

        if (!isValidCpf(cpfNorm)) {
          return jsonResponse(
            { error: 'CPF inválido. Verifique o número informado.' },
            400
          );
        }

        const metodosPublicos = getAvailablePublicMethods(config);
        const requestId = generateRequestId();

        // Busca militar silenciosamente (em paralelo para evitar soma de timeouts de sequential scan)
        let militarEncontrado: any = null;
        try {
          const Militares = base44.asServiceRole?.entities?.Militar || base44.entities?.Militar;
          if (Militares) {
            const cpfFormatado = cpfNorm.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
            const cpfSemZero = Number(cpfNorm).toString();
            
            const p1 = Militares.filter({ cpf: cpfNorm }, undefined, 2, 0).catch(() => []);
            const p2 = Militares.filter({ cpf: cpfFormatado }, undefined, 2, 0).catch(() => []);
            const p3 = cpfSemZero !== cpfNorm ? Militares.filter({ cpf: cpfSemZero }, undefined, 2, 0).catch(() => []) : Promise.resolve([]);

            const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

            if (r1 && r1.length > 0) {
              militarEncontrado = r1[0];
            } else if (r2 && r2.length > 0) {
              militarEncontrado = r2[0];
            } else if (r3 && r3.length > 0) {
              militarEncontrado = r3[0];
            }
          }
        } catch (errSearch) {
          console.error('[portal_auth:INICIAR] Erro na busca silenciosa de militar:', errSearch);
        }

        // Se militar válido e ativo, cria desafio em PortalSessao
        if (militarEncontrado && militarEncontrado.id) {
          try {
            const PortalSessao = base44.asServiceRole?.entities?.PortalSessao || base44.entities?.PortalSessao;
            if (PortalSessao) {
              const nowIso = new Date().toISOString();
              await PortalSessao.create({
                militar_id: militarEncontrado.id,
                request_id: requestId,
                status: 'CRIADA_AGUARDANDO_OTP',
                otp_attempts: 0,
                ip_criacao: ip_origem,
                user_agent_criacao: user_agent,
                created_at: nowIso,
              });
            }
          } catch (errSessao) {
            console.error('[portal_auth:INICIAR] Erro ao criar PortalSessao:', errSessao);
          }
        }

        // Resposta pública idêntica (Anti-enumeração)
        return jsonResponse({
          ok: true,
          request_id: requestId,
          metodos: metodosPublicos,
        });
      }

      // ----------------------------------------------------------------------
      // ETAPA 2: ENVIAR / REENVIAR (Disparo do OTP pelo canal)
      // ----------------------------------------------------------------------
      case 'ENVIAR':
      case 'REENVIAR': {
        const requestId = String(payload?.request_id || '').trim();
        const canalSolicitado = String(payload?.canal || config.default_channel).toUpperCase();

        if (!requestId || requestId.length < 16) {
          return jsonResponse(
            { error: 'Identificador de requisição inválido.' },
            400
          );
        }

        const now = new Date();
        const nowIso = now.toISOString();

        const respostaGenerica = {
          ok: true,
          message: 'Se os dados informados estiverem cadastrados e aptos para acesso, você receberá um código.',
          expira_em: config.otp_ttl_seconds,
          reenvio_em: config.otp_resend_seconds,
        };

        const PortalSessao = base44.asServiceRole?.entities?.PortalSessao || base44.entities?.PortalSessao;
        if (!PortalSessao) {
          return jsonResponse(respostaGenerica);
        }

        let sessoes: any[] = [];
        try {
          sessoes = await PortalSessao.filter({ request_id: requestId }, undefined, 2, 0);
        } catch (_eF) {}

        const sessao = Array.isArray(sessoes) && sessoes.length > 0 ? sessoes[0] : null;

        if (!sessao || sessao.status !== 'CRIADA_AGUARDANDO_OTP') {
          return jsonResponse(respostaGenerica);
        }

        // Rate limiting de reenvio por sessão (resend_cooldown)
        if (sessao.otp_sent_at) {
          const ultimoEnvio = new Date(sessao.otp_sent_at).getTime();
          const cooldownMs = config.otp_resend_seconds * 1000;
          if (now.getTime() - ultimoEnvio < cooldownMs) {
            return jsonResponse(
              {
                ok: true,
                message: `Código já enviado recentemente. Aguarde ${Math.ceil((cooldownMs - (now.getTime() - ultimoEnvio)) / 1000)}s para novo envio.`,
                reenvio_em: Math.ceil((cooldownMs - (now.getTime() - ultimoEnvio)) / 1000),
                expira_em: config.otp_ttl_seconds,
              },
              200
            );
          }
        }

        // Busca militar associado
        let militar: any = null;
        try {
          const Militar = base44.asServiceRole?.entities?.Militar || base44.entities?.Militar;
          militar = Militar ? await Militar.get(sessao.militar_id) : null;
        } catch (_eM) {}

        if (!militar || militar.status === 'Inativo' || militar.status_cadastro === 'Inativo' || militar.status === 'Falecido') {
          return jsonResponse(respostaGenerica);
        }

        // Geração do código OTP de 6 dígitos
        const otpCode = generateOtp();
        const otpHash = await hashOtp(otpCode);
        const expiresAt = new Date(now.getTime() + config.otp_ttl_seconds * 1000).toISOString();

        // Persiste hash do OTP na sessão
        try {
          await PortalSessao.update(sessao.id, {
            otp_hash: otpHash,
            otp_expires_at: expiresAt,
            otp_sent_at: nowIso,
            otp_channel: canalSolicitado,
          });
        } catch (_eUp) {}

        // Disparo: EMAIL
        if (canalSolicitado === 'EMAIL') {
          const emailInfo = resolveMilitarEmail(militar);
          const emailDestino = emailInfo?.email;
          const emailProvider = resolveEmailProvider(config);
          let dispatchRes: any = { success: false, error: 'Provedor de e-mail indisponível.' };

          if (emailDestino && emailProvider) {
            try {
              dispatchRes = await emailProvider.sendOtp(
                {
                  to: emailDestino,
                  code: otpCode,
                  militarNome: militar.nome_guerra || militar.nome_completo,
                  correlationId: correlation_id,
                },
                base44
              );
            } catch (errDispatch) {
              console.error('[portal_auth] Erro no envio de e-mail:', errDispatch);
            }
          }

          try {
            await registrarAuditoriaPortal(base44, {
              sessao_id: sessao.id,
              militar_id: sessao.militar_id,
              acao: 'LOGIN_SOLICITADO',
              resultado: Boolean(dispatchRes?.success),
              motivo_falha_sanitizado: dispatchRes?.success ? null : dispatchRes?.error,
              ip_origem,
              user_agent,
              correlation_id,
            });
          } catch (_eAud) {}

          return jsonResponse(respostaGenerica);
        }

        // Disparo: WHATSAPP
        if (canalSolicitado === 'WHATSAPP') {
          const telefoneDestino = resolveMilitarTelefone(militar);
          const whatsappProvider = resolveWhatsAppProvider(config);
          let dispatchRes: any = { success: false, error: 'Provedor de WhatsApp indisponível.' };

          if (telefoneDestino?.formatted && whatsappProvider) {
            try {
              dispatchRes = await whatsappProvider.sendOtp(
                {
                  to: telefoneDestino.formatted,
                  code: otpCode,
                  militarNome: militar.nome_guerra || militar.nome_completo,
                  correlationId: correlation_id,
                },
                base44
              );
            } catch (errDispatch) {
              console.error('[portal_auth] Erro no envio de WhatsApp:', errDispatch);
            }
          }

          // Fallback inteligente: se WhatsApp falhou mas militar tem email, tenta e-mail
          if (!dispatchRes.success) {
            const emailInfo = resolveMilitarEmail(militar);
            const emailProvider = resolveEmailProvider(config);
            if (emailInfo?.email && emailProvider) {
              try {
                const emailRes = await emailProvider.sendOtp(
                  {
                    to: emailInfo.email,
                    code: otpCode,
                    militarNome: militar.nome_guerra || militar.nome_completo,
                    correlationId: correlation_id,
                  },
                  base44
                );
                if (emailRes.success) {
                  dispatchRes = emailRes;
                }
              } catch (_e) {}
            }
          }

          try {
            await registrarAuditoriaPortal(base44, {
              sessao_id: sessao.id,
              militar_id: sessao.militar_id,
              acao: 'LOGIN_SOLICITADO',
              resultado: Boolean(dispatchRes?.success),
              motivo_falha_sanitizado: dispatchRes?.success ? null : dispatchRes?.error,
              ip_origem,
              user_agent,
              correlation_id,
            });
          } catch (_eAud) {}

          return jsonResponse(respostaGenerica);
        }

        return jsonResponse(respostaGenerica);
      }

      // ----------------------------------------------------------------------
      // ETAPA 3: VALIDAR (Conferência de OTP e emissão de sessão ativa)
      // ----------------------------------------------------------------------
      case 'VALIDAR': {
        const requestId = String(payload?.request_id || '').trim();
        const otpInput = String(payload?.otp || '').trim();

        if (!requestId || !otpInput || !/^\d{6}$/.test(otpInput)) {
          return jsonResponse(
            { error: 'Código inválido ou expirado.' },
            401
          );
        }

        const now = new Date();
        const nowIso = now.toISOString();

        const PortalSessao = base44.asServiceRole?.entities?.PortalSessao || base44.entities?.PortalSessao;
        if (!PortalSessao) {
          return jsonResponse({ error: 'Código inválido ou expirado.' }, 401);
        }

        let sessoes: any[] = [];
        try {
          sessoes = await PortalSessao.filter({ request_id: requestId }, undefined, 2, 0);
        } catch (_eF) {}

        const sessao = Array.isArray(sessoes) && sessoes.length > 0 ? sessoes[0] : null;

        if (!sessao || sessao.status !== 'CRIADA_AGUARDANDO_OTP' || !sessao.otp_hash) {
          return jsonResponse({ error: 'Código inválido ou expirado.' }, 401);
        }

        if (
          (sessao.otp_attempts && sessao.otp_attempts >= config.otp_max_attempts) ||
          (sessao.otp_blocked_until && new Date(sessao.otp_blocked_until).getTime() > now.getTime())
        ) {
          try { await PortalSessao.update(sessao.id, { status: 'EXPIRADA' }); } catch (_e) {}
          return jsonResponse({ error: 'Código inválido ou expirado.' }, 401);
        }

        if (!sessao.otp_expires_at || new Date(sessao.otp_expires_at).getTime() < now.getTime()) {
          try { await PortalSessao.update(sessao.id, { status: 'EXPIRADA' }); } catch (_e) {}
          return jsonResponse({ error: 'Código inválido ou expirado.' }, 401);
        }

        const expectedHash = await hashOtp(otpInput);
        const isMatch = timingSafeCompare(expectedHash, sessao.otp_hash);

        if (!isMatch) {
          const novasTentativas = (sessao.otp_attempts || 0) + 1;
          const atingiuLimite = novasTentativas >= config.otp_max_attempts;

          try {
            await PortalSessao.update(sessao.id, {
              otp_attempts: novasTentativas,
              status: atingiuLimite ? 'EXPIRADA' : 'CRIADA_AGUARDANDO_OTP',
              otp_blocked_until: atingiuLimite
                ? new Date(now.getTime() + 15 * 60 * 1000).toISOString()
                : undefined,
            });
          } catch (_e) {}

          return jsonResponse({ error: 'Código inválido ou expirado.' }, 401);
        }

        // OTP VÁLIDO
        const rawToken = generatePortalToken();
        const tokenHash = await hashPortalToken(rawToken);
        const absoluteExpiresAt = new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString();

        try {
          await PortalSessao.update(sessao.id, {
            status: 'ATIVA',
            token_hash: tokenHash,
            validated_at: nowIso,
            last_activity_at: nowIso,
            expires_at: absoluteExpiresAt,
          });
        } catch (_e) {}

        try {
          await registrarAuditoriaPortal(base44, {
            sessao_id: sessao.id,
            militar_id: sessao.militar_id,
            acao: 'LOGIN_SUCESSO',
            resultado: true,
            motivo_falha_sanitizado: null,
            ip_origem,
            user_agent,
            correlation_id,
          });
        } catch (_e) {}

        return jsonResponse({
          ok: true,
          token: rawToken,
          expires_in: 14400,
        });
      }

      default:
        return jsonResponse(
          { error: 'Ação não reconhecida no endpoint de autenticação.' },
          400
        );
    }
  } catch (err: any) {
    console.error(`[portal_auth][${correlation_id}] Erro inesperado:`, err?.message || err);

    return jsonResponse(
      {
        error: 'Erro interno ao processar autenticação. Tente novamente mais tarde.',
        correlation_id,
      },
      500
    );
  }
});

