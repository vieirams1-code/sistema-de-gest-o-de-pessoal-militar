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

export default Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Método HTTP não permitido.' }, { status: 405 });
  }

  const ip_origem = extractClientIp(req);
  const user_agent = extractUserAgent(req);
  const correlation_id = generateCorrelationId();

  let payload: any = {};
  try {
    payload = await req.json();
  } catch (_e) {
    return Response.json({ error: 'Payload JSON inválido.' }, { status: 400 });
  }

  // Defesa IDOR ativa: Rejeição se militar_id for informado externamente
  if ('militar_id' in payload || 'militarId' in payload) {
    return Response.json(
      { error: 'Parâmetro de militar_id proibido neste endpoint.' },
      { status: 400 }
    );
  }

  const base44 = createClientFromRequest(req);
  const config = await loadAuthConfig(base44);
  const acao = String(payload?.acao || '').toUpperCase();

  try {
    switch (acao) {
      // ----------------------------------------------------------------------
      // ETAPA 1: INICIAR (Identificação por CPF)
      // ----------------------------------------------------------------------
      case 'INICIAR': {
        const cpfRaw = payload?.cpf;
        const cpfNorm = normalizeCpf(cpfRaw);

        if (!isValidCpf(cpfNorm)) {
          return Response.json(
            { error: 'CPF inválido. Verifique o número informado.' },
            { status: 400 }
          );
        }

        const metodosPublicos = getAvailablePublicMethods(config);
        const requestId = generateRequestId();

        // Busca militar silenciosamente
        let militarEncontrado: any = null;
        try {
          const Militares = base44.asServiceRole?.entities?.Militar;
          if (Militares) {
            let lista = await Militares.filter({ cpf: cpfNorm }, undefined, 2, 0);
            if (!lista || lista.length === 0) {
              const cpfFormatado = cpfNorm.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
              lista = await Militares.filter({ cpf: cpfFormatado }, undefined, 2, 0);
            }
            if (!lista || lista.length === 0) {
              const all = await Militares.list();
              lista = (all || []).filter((m: any) => normalizeCpf(m.cpf) === cpfNorm);
            }
            if (Array.isArray(lista) && lista.length > 0) {
              militarEncontrado = lista[0];
            }
          }
        } catch (errSearch) {
          console.error('[portal_auth:INICIAR] Erro na busca silenciosa de militar:', errSearch);
        }

        // Se militar válido e ativo, cria desafio em PortalSessao
        if (militarEncontrado && militarEncontrado.id) {
          const PortalSessao = base44.asServiceRole?.entities?.PortalSessao;
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
        }

        // Resposta pública idêntica (Anti-enumeração)
        return Response.json({
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
          return Response.json(
            { error: 'Identificador de requisição inválido.' },
            { status: 400 }
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

        const PortalSessao = base44.asServiceRole?.entities?.PortalSessao;
        if (!PortalSessao) {
          return Response.json(respostaGenerica);
        }

        const sessoes = await PortalSessao.filter({ request_id: requestId }, undefined, 2, 0);
        const sessao = Array.isArray(sessoes) && sessoes.length > 0 ? sessoes[0] : null;

        if (!sessao || sessao.status !== 'CRIADA_AGUARDANDO_OTP') {
          return Response.json(respostaGenerica);
        }

        // Rate limiting de reenvio por sessão (resend_cooldown)
        if (sessao.otp_sent_at) {
          const ultimoEnvio = new Date(sessao.otp_sent_at).getTime();
          const cooldownMs = config.otp_resend_seconds * 1000;
          if (now.getTime() - ultimoEnvio < cooldownMs) {
            return Response.json(
              {
                error: `Aguarde ${config.otp_resend_seconds} segundos antes de solicitar novo envio.`,
                reenvio_em: Math.ceil((cooldownMs - (now.getTime() - ultimoEnvio)) / 1000),
              },
              { status: 429 }
            );
          }
        }

        // Busca militar associado
        const Militar = base44.asServiceRole?.entities?.Militar;
        const militar = Militar ? await Militar.get(sessao.militar_id) : null;

        if (!militar || militar.status === 'Inativo' || militar.status === 'Falecido') {
          return Response.json(respostaGenerica);
        }

        // Geração do código OTP de 6 dígitos
        const otpCode = generateOtp();
        const otpHash = await hashOtp(otpCode);
        const expiresAt = new Date(now.getTime() + config.otp_ttl_seconds * 1000).toISOString();

        // Persiste hash do OTP na sessão
        await PortalSessao.update(sessao.id, {
          otp_hash: otpHash,
          otp_expires_at: expiresAt,
          otp_sent_at: nowIso,
          otp_channel: canalSolicitado,
        });

        // Disparo: EMAIL
        if (canalSolicitado === 'EMAIL') {
          const emailDestino = resolveMilitarEmail(militar);
          if (!emailDestino) {
            return Response.json(respostaGenerica);
          }

          const emailProvider = resolveEmailProvider(config);
          const dispatchRes = await emailProvider.send(
            {
              to: emailDestino,
              code: otpCode,
              militarNome: militar.nome_guerra || militar.nome_completo,
              correlationId: correlation_id,
            },
            base44
          );

          await registrarAuditoriaPortal(base44, {
            sessao_id: sessao.id,
            militar_id: sessao.militar_id,
            acao: 'LOGIN_SOLICITADO',
            resultado: dispatchRes.success,
            motivo_falha_sanitizado: dispatchRes.success ? null : dispatchRes.error,
            ip_origem,
            user_agent,
            correlation_id,
          });

          return Response.json(respostaGenerica);
        }

        // Disparo: WHATSAPP
        if (canalSolicitado === 'WHATSAPP') {
          const telefoneDestino = resolveMilitarTelefone(militar);
          if (!telefoneDestino || !telefoneDestino.formatted) {
            return Response.json(respostaGenerica);
          }

          const whatsappProvider = resolveWhatsAppProvider(config);
          const dispatchRes = await whatsappProvider.send(
            {
              to: telefoneDestino.formatted,
              code: otpCode,
              militarNome: militar.nome_guerra || militar.nome_completo,
              correlationId: correlation_id,
            },
            base44
          );

          await registrarAuditoriaPortal(base44, {
            sessao_id: sessao.id,
            militar_id: sessao.militar_id,
            acao: 'LOGIN_SOLICITADO',
            resultado: dispatchRes.success,
            motivo_falha_sanitizado: dispatchRes.success ? null : dispatchRes.error,
            ip_origem,
            user_agent,
            correlation_id,
          });

          return Response.json(respostaGenerica);
        }

        return Response.json(respostaGenerica);
      }

      // ----------------------------------------------------------------------
      // ETAPA 3: VALIDAR (Conferência de OTP e emissão de sessão ativa)
      // ----------------------------------------------------------------------
      case 'VALIDAR': {
        const requestId = String(payload?.request_id || '').trim();
        const otpInput = String(payload?.otp || '').trim();

        if (!requestId || !otpInput || !/^\d{6}$/.test(otpInput)) {
          return Response.json(
            { error: 'Código inválido ou expirado.' },
            { status: 401 }
          );
        }

        const now = new Date();
        const nowIso = now.toISOString();

        const PortalSessao = base44.asServiceRole?.entities?.PortalSessao;
        if (!PortalSessao) {
          return Response.json({ error: 'Código inválido ou expirado.' }, { status: 401 });
        }

        const sessoes = await PortalSessao.filter({ request_id: requestId }, undefined, 2, 0);
        const sessao = Array.isArray(sessoes) && sessoes.length > 0 ? sessoes[0] : null;

        if (!sessao || sessao.status !== 'CRIADA_AGUARDANDO_OTP' || !sessao.otp_hash) {
          return Response.json({ error: 'Código inválido ou expirado.' }, { status: 401 });
        }

        if (
          (sessao.otp_attempts && sessao.otp_attempts >= config.otp_max_attempts) ||
          (sessao.otp_blocked_until && new Date(sessao.otp_blocked_until).getTime() > now.getTime())
        ) {
          await PortalSessao.update(sessao.id, { status: 'EXPIRADA' });
          return Response.json({ error: 'Código inválido ou expirado.' }, { status: 401 });
        }

        if (!sessao.otp_expires_at || new Date(sessao.otp_expires_at).getTime() < now.getTime()) {
          await PortalSessao.update(sessao.id, { status: 'EXPIRADA' });
          return Response.json({ error: 'Código inválido ou expirado.' }, { status: 401 });
        }

        const expectedHash = await hashOtp(otpInput);
        const isMatch = timingSafeCompare(expectedHash, sessao.otp_hash);

        if (!isMatch) {
          const novasTentativas = (sessao.otp_attempts || 0) + 1;
          const atingiuLimite = novasTentativas >= config.otp_max_attempts;

          await PortalSessao.update(sessao.id, {
            otp_attempts: novasTentativas,
            status: atingiuLimite ? 'EXPIRADA' : 'CRIADA_AGUARDANDO_OTP',
            otp_blocked_until: atingiuLimite
              ? new Date(now.getTime() + 15 * 60 * 1000).toISOString()
              : undefined,
          });

          return Response.json({ error: 'Código inválido ou expirado.' }, { status: 401 });
        }

        // OTP VÁLIDO
        const rawToken = generatePortalToken();
        const tokenHash = await hashPortalToken(rawToken);
        const absoluteExpiresAt = new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString();

        await PortalSessao.update(sessao.id, {
          status: 'ATIVA',
          token_hash: tokenHash,
          validated_at: nowIso,
          last_activity_at: nowIso,
          expires_at: absoluteExpiresAt,
        });

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

        return Response.json({
          ok: true,
          token: rawToken,
          expires_in: 14400,
        });
      }

      default:
        return Response.json(
          { error: 'Ação não reconhecida no endpoint de autenticação.' },
          { status: 400 }
        );
    }
  } catch (err: any) {
    console.error(`[portal_auth][${correlation_id}] Erro inesperado:`, err?.message || err);

    return Response.json(
      {
        error: 'Erro interno ao processar autenticação. Tente novamente mais tarde.',
        correlation_id,
      },
      { status: 500 }
    );
  }
});
