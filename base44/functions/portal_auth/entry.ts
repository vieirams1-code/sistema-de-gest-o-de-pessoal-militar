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

/**
 * ============================================================================
 * ENDPOINT UNIFICADO DE AUTENTICAÇÃO DO PORTAL DO MILITAR
 * ----------------------------------------------------------------------------
 * Operações:
 *   - INICIAR:  Recebe CPF, valida formato e devolve request_id com métodos globais.
 *   - ENVIAR:   Recebe request_id e canal, gera e despacha OTP via provider.
 *   - VALIDAR:  Recebe request_id e OTP, valida HMAC e devolve PortalToken.
 *
 * REGRAS DE SEGURANÇA E PRIVACIDADE:
 * 1. Anti-enumeração estrita: Respostas públicas idênticas para CPFs válidos/inválidos.
 * 2. Zero PII na saída: Nunca expõe e-mail, telefone, CPF ou nomes na etapa anônima.
 * 3. Criptografia: OTP com HMAC-SHA256 fail-closed + timing-safe compare.
 * 4. Token com 256 bits gerado pós-validação.
 * ============================================================================
 */
Deno.serve(async (req: Request) => {
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
            // Busca por CPF numérico
            let lista = await Militares.filter({ cpf: cpfNorm }, undefined, 2, 0);
            // Fallback para CPF formatado se base legada contiver pontuação
            if (!lista || lista.length === 0) {
              const cpfFormatado = cpfNorm.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
              lista = await Militares.filter({ cpf: cpfFormatado }, undefined, 2, 0);
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

        // Resposta genérica padrão (mesmo shape para sucesso e falha silenciosa)
        const respostaGenerica = {
          ok: true,
          message: 'Se os dados informados estiverem cadastrados e aptos para acesso, você receberá um código.',
          expira_em: config.otp_ttl_seconds,
          reenvio_em: config.otp_resend_seconds,
        };

        const PortalSessao = base44.asServiceRole?.entities?.PortalSessao;
        const Militares = base44.asServiceRole?.entities?.Militar;

        if (!PortalSessao || !Militares) {
          return Response.json(respostaGenerica);
        }

        // Localiza sessão pelo request_id
        const sessoes = await PortalSessao.filter({ request_id: requestId }, undefined, 2, 0);
        const sessao = Array.isArray(sessoes) && sessoes.length > 0 ? sessoes[0] : null;

        if (!sessao || sessao.status !== 'CRIADA_AGUARDANDO_OTP' || !sessao.militar_id) {
          // Desafio inexistente ou já finalizado: retorna resposta genérica (Anti-enumeração)
          return Response.json(respostaGenerica);
        }

        // Validação de Rate-Limit: Reenvio antes do intervalo mínimo
        if (sessao.otp_sent_at) {
          const ultimoEnvio = new Date(sessao.otp_sent_at).getTime();
          const diferencaSegundos = Math.floor((now.getTime() - ultimoEnvio) / 1000);
          if (diferencaSegundos < config.otp_resend_seconds) {
            // Reenvio precoce bloqueado
            return Response.json(respostaGenerica);
          }
        }

        // Validação de Rate-Limit: Máximo de disparos por hora por militar
        const umaHoraAtras = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
        const sessoesRecentes = await PortalSessao.filter(
          { militar_id: sessao.militar_id },
          '-created_at',
          10,
          0
        );
        const disparosRecentes = (sessoesRecentes || []).filter(
          (s: any) => s.otp_sent_at && s.otp_sent_at >= umaHoraAtras
        );

        if (disparosRecentes.length >= config.otp_max_sends_per_hour) {
          await registrarAuditoriaPortal(base44, {
            sessao_id: sessao.id,
            militar_id: sessao.militar_id,
            acao: 'LOGIN_FALHA_BLOQUEIO',
            resultado: false,
            motivo_falha_sanitizado: 'Limite de disparos de OTP por hora excedido.',
            ip_origem,
            user_agent,
            correlation_id,
          });
          return Response.json(respostaGenerica);
        }

        // Carrega dados do militar
        const militar = await Militares.get(sessao.militar_id);
        if (!militar) {
          return Response.json(respostaGenerica);
        }

        // Resolução de canal
        if (canalSolicitado === 'EMAIL') {
          const emailProvider = resolveEmailProvider(config);
          if (!emailProvider || !emailProvider.isOperational(config)) {
            return Response.json(respostaGenerica);
          }

          const { email } = resolveMilitarEmail(militar);
          if (!email) {
            await registrarAuditoriaPortal(base44, {
              sessao_id: sessao.id,
              militar_id: sessao.militar_id,
              acao: 'LOGIN_SOLICITADO',
              resultado: false,
              motivo_falha_sanitizado: 'Militar não possui e-mail válido cadastrado.',
              ip_origem,
              user_agent,
              correlation_id,
            });
            return Response.json(respostaGenerica);
          }

          // Gera código OTP e calcula HMAC-SHA256
          const otpCode = generateOtp();
          const otpHashed = await hashOtp(otpCode);
          const expiresAt = new Date(now.getTime() + config.otp_ttl_seconds * 1000).toISOString();

          // Atualiza sessão com OTP
          await PortalSessao.update(sessao.id, {
            otp_hash: otpHashed,
            otp_expires_at: expiresAt,
            otp_channel: 'EMAIL',
            otp_provider: emailProvider.name || config.email_provider,
            otp_sent_at: nowIso,
            otp_attempts: 0,
          });

          // Dispara e-mail
          const dispatchRes = await emailProvider.sendOtp(
            {
              to: email,
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

        // Resolução de canal WHATSAPP
        if (canalSolicitado === 'WHATSAPP') {
          const waProvider = resolveWhatsAppProvider(config);
          if (!waProvider || !waProvider.isOperational(config)) {
            return Response.json(respostaGenerica);
          }

          const { formatted } = resolveMilitarTelefone(militar);
          if (!formatted) {
            await registrarAuditoriaPortal(base44, {
              sessao_id: sessao.id,
              militar_id: sessao.militar_id,
              acao: 'LOGIN_SOLICITADO',
              resultado: false,
              motivo_falha_sanitizado: 'Militar não possui telefone celular válido cadastrado.',
              ip_origem,
              user_agent,
              correlation_id,
            });
            return Response.json(respostaGenerica);
          }

          // Gera código OTP e calcula HMAC-SHA256
          const otpCode = generateOtp();
          const otpHashed = await hashOtp(otpCode);
          const expiresAt = new Date(now.getTime() + config.otp_ttl_seconds * 1000).toISOString();

          // Atualiza sessão com OTP
          await PortalSessao.update(sessao.id, {
            otp_hash: otpHashed,
            otp_expires_at: expiresAt,
            otp_channel: 'WHATSAPP',
            otp_provider: waProvider.name || 'evolution_api',
            otp_sent_at: nowIso,
            otp_attempts: 0,
          });

          // Dispara WhatsApp
          const dispatchRes = await waProvider.sendOtp(
            {
              to: formatted,
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

        // Outros canais (ex: SMS) não operacionais nesta fase
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

        // Se sessão não existe ou não tem hash de OTP
        if (!sessao || sessao.status !== 'CRIADA_AGUARDANDO_OTP' || !sessao.otp_hash) {
          return Response.json({ error: 'Código inválido ou expirado.' }, { status: 401 });
        }

        // Verifica se sessão foi bloqueada por excesso de tentativas
        if (
          (sessao.otp_attempts && sessao.otp_attempts >= config.otp_max_attempts) ||
          (sessao.otp_blocked_until && new Date(sessao.otp_blocked_until).getTime() > now.getTime())
        ) {
          await PortalSessao.update(sessao.id, { status: 'EXPIRADA' });
          await registrarAuditoriaPortal(base44, {
            sessao_id: sessao.id,
            militar_id: sessao.militar_id,
            acao: 'LOGIN_FALHA_BLOQUEIO',
            resultado: false,
            motivo_falha_sanitizado: 'Desafio bloqueado por excesso de tentativas.',
            ip_origem,
            user_agent,
            correlation_id,
          });
          return Response.json({ error: 'Código inválido ou expirado.' }, { status: 401 });
        }

        // Verifica validade temporal do OTP (TTL)
        if (!sessao.otp_expires_at || new Date(sessao.otp_expires_at).getTime() < now.getTime()) {
          await PortalSessao.update(sessao.id, { status: 'EXPIRADA' });
          await registrarAuditoriaPortal(base44, {
            sessao_id: sessao.id,
            militar_id: sessao.militar_id,
            acao: 'LOGIN_FALHA_OTP',
            resultado: false,
            motivo_falha_sanitizado: 'Código OTP expirado.',
            ip_origem,
            user_agent,
            correlation_id,
          });
          return Response.json({ error: 'Código inválido ou expirado.' }, { status: 401 });
        }

        // Validação criptográfica com timing-safe compare
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

          await registrarAuditoriaPortal(base44, {
            sessao_id: sessao.id,
            militar_id: sessao.militar_id,
            acao: 'LOGIN_FALHA_OTP',
            resultado: false,
            motivo_falha_sanitizado: `Tentativa ${novasTentativas} incorreta.`,
            ip_origem,
            user_agent,
            correlation_id,
          });

          return Response.json({ error: 'Código inválido ou expirado.' }, { status: 401 });
        }

        // --------------------------------------------------------------------
        // OTP VÁLIDO: Ativação da sessão e geração do PortalToken
        // --------------------------------------------------------------------
        const rawToken = generatePortalToken(); // 256 bits
        const tokenHash = await hashPortalToken(rawToken);
        const absoluteExpiresAt = new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString(); // 4 horas

        await PortalSessao.update(sessao.id, {
          status: 'ATIVA',
          token_hash: tokenHash,
          token_expires_at: absoluteExpiresAt,
          absolute_expires_at: absoluteExpiresAt,
          last_activity_at: nowIso,
          otp_verified_at: nowIso,
          ip_ultima_atividade: ip_origem,
          user_agent_ultima_atividade: user_agent,
        });

        await registrarAuditoriaPortal(base44, {
          sessao_id: sessao.id,
          militar_id: sessao.militar_id,
          acao: 'LOGIN_SUCESSO',
          resultado: true,
          motivo_falha_sanitizado: 'Autenticação OTP bem-sucedida via canal ' + (sessao.otp_channel || 'EMAIL'),
          ip_origem,
          user_agent,
          correlation_id,
        });

        // Retorna rawToken uma única vez
        return Response.json({
          ok: true,
          token: rawToken,
          expires_at: absoluteExpiresAt,
        });
      }

      default: {
        return Response.json(
          { error: 'Ação não reconhecida no endpoint de autenticação.' },
          { status: 400 }
        );
      }
    }
  } catch (error: any) {
    console.error('[portal_auth] Erro interno:', error);
    return Response.json(
      { error: 'Falha interna durante o processo de autenticação.' },
      { status: 500 }
    );
  }
});
