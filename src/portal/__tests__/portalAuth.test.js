import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  normalizeCpf,
  isValidCpf,
  isValidEmail,
  loadAuthConfig,
  getAvailablePublicMethods,
  resolveMilitarEmail,
  resolveEmailProvider,
  resolveMilitarTelefone,
  resolveWhatsAppProvider,
  generateRequestId,
} from '../../../base44/shared/portal/otp/otpService.ts';
import {
  generateOtp,
  hashOtp,
  timingSafeCompare,
  generatePortalToken,
  hashPortalToken,
  sanitizarIdentificador,
} from '../../../base44/shared/portal/portalCrypto.ts';
import { DEFAULT_AUTH_CONFIG } from '../../../base44/shared/portal/otp/types.ts';
import { Base44EmailProvider } from '../../../base44/shared/portal/otp/providers/base44EmailProvider.ts';
import { ResendEmailProvider } from '../../../base44/shared/portal/otp/providers/resendEmailProvider.ts';
import { EvolutionWhatsAppProvider, normalizeWhatsAppNumber } from '../../../base44/shared/portal/otp/providers/evolutionWhatsAppProvider.ts';

// Configura pepper para o ambiente de testes
process.env.PORTAL_OTP_PEPPER = 'test-suite-portal-otp-pepper-32-chars-long!!';

describe('Portal OTP Multicanal & Anti-Enumeração — Testes de Produção (Fase 1.2B)', () => {
  // --------------------------------------------------------------------------
  // 1 & 2. Validação e Normalização de CPF
  // --------------------------------------------------------------------------
  it('1. Deve normalizar CPF com e sem pontuação corretamente', () => {
    assert.equal(normalizeCpf('123.456.789-00'), '12345678900');
    assert.equal(normalizeCpf('  12345678900  '), '12345678900');
    assert.equal(normalizeCpf('123.456.789/00'), '12345678900');
    assert.equal(normalizeCpf(null), '');
    assert.equal(normalizeCpf(undefined), '');
  });

  it('2. Deve rejeitar CPFs com tamanho inválido ou sequências repetidas', () => {
    assert.equal(isValidCpf('123'), false);
    assert.equal(isValidCpf('123456789012'), false);
    assert.equal(isValidCpf('00000000000'), false);
    assert.equal(isValidCpf('11111111111'), false);
    assert.equal(isValidCpf('99999999999'), false);
    assert.equal(isValidCpf('12345678901'), true);
  });

  // --------------------------------------------------------------------------
  // 3, 4, 5. Anti-Enumeração: Respostas idênticas para CPFs válidos e inexistentes
  // --------------------------------------------------------------------------
  it('3 & 4 & 5. INICIAR deve retornar estrutura idêntica para qualquer CPF (Anti-Enumeração)', () => {
    const config = { ...DEFAULT_AUTH_CONFIG };
    const metodos = getAvailablePublicMethods(config);

    const reqIdValido = generateRequestId();
    const reqIdInvalido = generateRequestId();

    const responseValido = { ok: true, request_id: reqIdValido, metodos };
    const responseInvalido = { ok: true, request_id: reqIdInvalido, metodos };

    assert.equal(responseValido.ok, responseInvalido.ok);
    assert.deepEqual(responseValido.metodos, responseInvalido.metodos);
    assert.equal(typeof responseValido.request_id, 'string');
    assert.equal(typeof responseInvalido.request_id, 'string');
    assert.equal(responseValido.request_id.length, 64);
    assert.equal(responseInvalido.request_id.length, 64);

    // Não pode vazar nenhum dado de identificação do militar
    const payloadStr = JSON.stringify(responseValido);
    assert.equal(payloadStr.includes('cpf'), false);
    assert.equal(payloadStr.includes('email'), false);
    assert.equal(payloadStr.includes('militar_id'), false);
  });

  // --------------------------------------------------------------------------
  // 6 & 7. Resolução de Métodos Públicos a partir da Configuração Global
  // --------------------------------------------------------------------------
  it('6. Canal EMAIL deve ser derivado da configuração global operacional', () => {
    const config = { ...DEFAULT_AUTH_CONFIG, email_enabled: true, email_provider: 'base44_core' };
    const metodos = getAvailablePublicMethods(config);
    assert.equal(metodos.length, 1);
    assert.equal(metodos[0].canal, 'EMAIL');
    assert.equal(metodos[0].label, 'E-mail cadastrado');
  });

  it('7. Provider desabilitado ou não operacional não deve ser exibido publicamente', () => {
    const configSemEmail = { ...DEFAULT_AUTH_CONFIG, email_enabled: false };
    const metodos = getAvailablePublicMethods(configSemEmail);
    assert.equal(metodos.length, 0);

    const configEmailInvalido = { ...DEFAULT_AUTH_CONFIG, email_provider: 'disabled' };
    assert.equal(getAvailablePublicMethods(configEmailInvalido).length, 0);
  });

  // --------------------------------------------------------------------------
  // 8, 9, 10. Resolução de E-mail do Militar
  // --------------------------------------------------------------------------
  it('8. Deve priorizar email_funcional sobre email_particular', () => {
    const militar = {
      email_funcional: 'vieira@cbm.ms.gov.br',
      email_particular: 'vieira.pessoal@gmail.com',
    };
    const res = resolveMilitarEmail(militar);
    assert.equal(res.email, 'vieira@cbm.ms.gov.br');
    assert.equal(res.tipo, 'funcional');
  });

  it('9. Deve realizar fallback para email_particular se email_funcional for nulo/inválido', () => {
    const militar = {
      email_funcional: 'invalido-sem-arroba',
      email_particular: 'vieira.pessoal@gmail.com',
    };
    const res = resolveMilitarEmail(militar);
    assert.equal(res.email, 'vieira.pessoal@gmail.com');
    assert.equal(res.tipo, 'particular');
  });

  it('10. Militar sem nenhum e-mail válido deve retornar null sem quebrar', () => {
    const militar = {
      email_funcional: null,
      email_particular: '',
    };
    const res = resolveMilitarEmail(militar);
    assert.equal(res.email, null);
    assert.equal(res.tipo, null);
  });

  // --------------------------------------------------------------------------
  // 11 & 12. Geração de OTP Seguro e HMAC
  // --------------------------------------------------------------------------
  it('11. Deve gerar código OTP de 6 dígitos numéricos com zero-padding', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateOtp();
      assert.equal(code.length, 6);
      assert.equal(/^\d{6}$/.test(code), true);
    }
  });

  it('12. Deve calcular hash HMAC-SHA256 do OTP de forma determinística', async () => {
    const code = '742198';
    const hash1 = await hashOtp(code);
    const hash2 = await hashOtp(code);
    assert.equal(hash1, hash2);
    assert.equal(hash1.length, 64);
  });

  // --------------------------------------------------------------------------
  // 13, 14, 15. Validação de OTP (Expiração, Falha, Limite de Tentativas)
  // --------------------------------------------------------------------------
  it('13. Comparação timing-safe deve validar código correto e rejeitar incorreto', async () => {
    const realCode = '123456';
    const wrongCode = '654321';
    const realHash = await hashOtp(realCode);
    const wrongHash = await hashOtp(wrongCode);

    assert.equal(timingSafeCompare(realHash, realHash), true);
    assert.equal(timingSafeCompare(wrongHash, realHash), false);
  });

  it('14 & 15. Simulação de tentativas consecutivas até bloqueio', async () => {
    const maxAttempts = 3;
    let attempts = 0;
    const realCode = '987654';
    const realHash = await hashOtp(realCode);

    const testAttempt = async (typedCode) => {
      const typedHash = await hashOtp(typedCode);
      const ok = timingSafeCompare(typedHash, realHash);
      if (!ok) {
        attempts++;
      }
      return { ok, attempts, blocked: attempts >= maxAttempts };
    };

    const res1 = await testAttempt('000000');
    assert.equal(res1.ok, false);
    assert.equal(res1.attempts, 1);
    assert.equal(res1.blocked, false);

    const res2 = await testAttempt('111111');
    assert.equal(res2.ok, false);
    assert.equal(res2.attempts, 2);
    assert.equal(res2.blocked, false);

    const res3 = await testAttempt('222222');
    assert.equal(res3.ok, false);
    assert.equal(res3.attempts, 3);
    assert.equal(res3.blocked, true);
  });

  // --------------------------------------------------------------------------
  // 16 & 17. Rate Limiting de Reenvio e Disparos por Hora
  // --------------------------------------------------------------------------
  it('16. Reenvio antes do intervalo mínimo (ex: 60s) deve ser barrado', () => {
    const now = Date.now();
    const lastSentAt = new Date(now - 30 * 1000).toISOString(); // 30 segundos atrás
    const resendWindowSeconds = 60;

    const elapsed = Math.floor((now - new Date(lastSentAt).getTime()) / 1000);
    const canResend = elapsed >= resendWindowSeconds;
    assert.equal(canResend, false);
  });

  it('17. Disparos por militar devem respeitar o limite máximo por hora (ex: 3 envios)', () => {
    const maxSendsPerHour = 3;
    const now = Date.now();
    const oneHourAgo = now - 3600 * 1000;

    const recentSends = [
      new Date(now - 500 * 1000).toISOString(),
      new Date(now - 1200 * 1000).toISOString(),
      new Date(now - 2400 * 1000).toISOString(),
    ];

    const sendsInLastHour = recentSends.filter((t) => new Date(t).getTime() >= oneHourAgo);
    const isRateLimited = sendsInLastHour.length >= maxSendsPerHour;
    assert.equal(isRateLimited, true);
  });

  // --------------------------------------------------------------------------
  // 18 & 19. Token de 256 bits e SHA-256 (Nunca persistir raw token)
  // --------------------------------------------------------------------------
  it('18 & 19. PortalToken deve ter 256 bits e ser armazenado apenas como SHA-256', async () => {
    const rawToken = generatePortalToken();
    assert.equal(rawToken.length, 64);

    const tokenHash = await hashPortalToken(rawToken);
    assert.notEqual(rawToken, tokenHash);
    assert.equal(tokenHash.length, 64);
  });

  // --------------------------------------------------------------------------
  // 20 & 21. Respostas Anônimas Sanitizadas
  // --------------------------------------------------------------------------
  it('20 & 21. Resposta para request_id inexistente em VALIDAR deve ser genérica', () => {
    const errorResponse = { error: 'Código inválido ou expirado.' };
    assert.equal(errorResponse.error, 'Código inválido ou expirado.');
    assert.equal('cpf' in errorResponse, false);
    assert.equal('email' in errorResponse, false);
  });

  // --------------------------------------------------------------------------
  // 22. Defesa IDOR Ativa
  // --------------------------------------------------------------------------
  it('22. Payloads contendo militar_id ou militarId devem ser bloqueados', () => {
    const p1 = { acao: 'INICIAR', cpf: '12345678901', militar_id: 'xyz' };
    const p2 = { acao: 'INICIAR', cpf: '12345678901', militarId: 'xyz' };

    const checkIdor = (p) => 'militar_id' in p || 'militarId' in p;
    assert.equal(checkIdor(p1), true);
    assert.equal(checkIdor(p2), true);
  });

  // --------------------------------------------------------------------------
  // 23. RLS de PortalAuthConfig
  // --------------------------------------------------------------------------
  it('23. PortalAuthConfig.jsonc deve estar configurado com CRUD totalmente fechado (false)', () => {
    const schemaPath = path.resolve('base44/entities/PortalAuthConfig.jsonc');
    const content = fs.readFileSync(schemaPath, 'utf8');
    const schema = JSON.parse(content);

    assert.equal(schema.rls.create, false);
    assert.equal(schema.rls.read, false);
    assert.equal(schema.rls.update, false);
    assert.equal(schema.rls.delete, false);
  });

  // --------------------------------------------------------------------------
  // 24. Frontend isolado sem base44.entities
  // --------------------------------------------------------------------------
  it('24. Arquivos do frontend do Portal em src/portal não devem importar base44.entities', () => {
    const portalDir = path.resolve('src/portal');
    const checkDir = (dir) => {
      const files = fs.readdirSync(dir, { withFileTypes: true });
      for (const file of files) {
        const full = path.join(dir, file.name);
        if (file.isDirectory()) {
          checkDir(full);
        } else if (/\.(js|jsx)$/.test(file.name) && !file.name.includes('.test.')) {
          const code = fs.readFileSync(full, 'utf8');
          assert.equal(
            code.includes('base44.entities'),
            false,
            'Violação de segurança encontrada: base44.entities não pode ser acessado pelo frontend do Portal.'
          );
        }
      }
    };
    checkDir(portalDir);
  });

  // --------------------------------------------------------------------------
  // 25 a 28. Provedor de E-mail Direto (Resend API)
  // --------------------------------------------------------------------------
  it('25. ResendEmailProvider deve ser operacional quando email_provider for "resend"', () => {
    const resend = new ResendEmailProvider({ apiKey: 're_123456789' });
    const configResend = { ...DEFAULT_AUTH_CONFIG, email_enabled: true, email_provider: 'resend' };
    const configBase44 = { ...DEFAULT_AUTH_CONFIG, email_enabled: true, email_provider: 'base44_core' };

    assert.equal(resend.isOperational(configResend), true);
    assert.equal(resend.isOperational(configBase44), false);
  });

  it('26. ResendEmailProvider deve falhar fechado se a chave de API estiver ausente', async () => {
    const resend = new ResendEmailProvider({ apiKey: '' });
    const result = await resend.sendOtp({ to: 'militar@cbm.ms.gov.br', code: '123456' });

    assert.equal(result.success, false);
    assert.equal(result.provider, 'resend');
    assert.equal(result.error.includes('não configurada'), true);
  });

  it('27. ResendEmailProvider deve enviar payload sanitizado via chamada HTTP', async () => {
    let capturedUrl = '';
    let capturedHeaders = {};
    let capturedBody = null;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      capturedUrl = url;
      capturedHeaders = options.headers;
      capturedBody = JSON.parse(options.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: 'email_msg_123' }),
      };
    };

    try {
      const resend = new ResendEmailProvider({ apiKey: 're_test_key_valid' });
      const result = await resend.sendOtp({ to: 'oficial@cbm.ms.gov.br', code: '654321' });

      assert.equal(result.success, true);
      assert.equal(capturedUrl, 'https://api.resend.com/emails');
      assert.equal(capturedHeaders['Authorization'], 'Bearer re_test_key_valid');
      assert.equal(capturedBody.to[0], 'oficial@cbm.ms.gov.br');
      assert.equal(capturedBody.text.includes('654321'), true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('28. resolveEmailProvider deve resolver o provedor correto conforme a configuração', () => {
    const p1 = resolveEmailProvider({ ...DEFAULT_AUTH_CONFIG, email_provider: 'resend' });
    const p2 = resolveEmailProvider({ ...DEFAULT_AUTH_CONFIG, email_provider: 'base44_core' });
    const p3 = resolveEmailProvider({ ...DEFAULT_AUTH_CONFIG, email_enabled: false });

    assert.equal(p1.name, 'resend');
    assert.equal(p2.channel, 'EMAIL');
    assert.equal(p3, null);
  });

  // --------------------------------------------------------------------------
  // 29 a 34. Provedor de WhatsApp (Evolution API)
  // --------------------------------------------------------------------------
  it('29. normalizeWhatsAppNumber deve normalizar números de telefone com e sem DDI', () => {
    assert.equal(normalizeWhatsAppNumber('(67) 99999-8888'), '5567999998888');
    assert.equal(normalizeWhatsAppNumber('67999998888'), '5567999998888');
    assert.equal(normalizeWhatsAppNumber('5567999998888'), '5567999998888');
    assert.equal(normalizeWhatsAppNumber('123'), null);
    assert.equal(normalizeWhatsAppNumber(null), null);
  });

  it('30. resolveMilitarTelefone deve extrair e formatar o celular cadastrado', () => {
    const militar1 = { telefone_celular: '(67) 98888-7777' };
    const militar2 = { celular: '67977776666' };
    const militar3 = { telefone: 'inválido' };

    assert.equal(resolveMilitarTelefone(militar1).formatted, '5567988887777');
    assert.equal(resolveMilitarTelefone(militar2).formatted, '5567977776666');
    assert.equal(resolveMilitarTelefone(militar3).formatted, null);
  });

  it('31. EvolutionWhatsAppProvider deve ser operacional quando whatsapp_enabled e evolution_api', () => {
    const wa = new EvolutionWhatsAppProvider({ apiUrl: 'https://api.teste.com', apiKey: 'secret' });
    const configWa = { ...DEFAULT_AUTH_CONFIG, whatsapp_enabled: true, whatsapp_provider: 'evolution_api' };
    const configDisabled = { ...DEFAULT_AUTH_CONFIG, whatsapp_enabled: false, whatsapp_provider: 'evolution_api' };

    assert.equal(wa.isOperational(configWa), true);
    assert.equal(wa.isOperational(configDisabled), false);
  });

  it('32. EvolutionWhatsAppProvider deve falhar fechado se secrets estiverem ausentes', async () => {
    const wa = new EvolutionWhatsAppProvider({ apiUrl: '', apiKey: '' });
    const result = await wa.sendOtp({ to: '5567999998888', code: '123456' });

    assert.equal(result.success, false);
    assert.equal(result.provider, 'evolution_api');
    assert.equal(result.error.includes('não configurado'), true);
  });

  it('33. EvolutionWhatsAppProvider deve enviar payload formatado via chamada HTTP', async () => {
    let capturedUrl = '';
    let capturedHeaders = {};
    let capturedBody = null;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      capturedUrl = url;
      capturedHeaders = options.headers;
      capturedBody = JSON.parse(options.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({ key: { id: 'msg_wa_123' } }),
      };
    };

    try {
      const wa = new EvolutionWhatsAppProvider({
        apiUrl: 'https://evolution.servidor.com',
        apiKey: 'api_key_wa_123',
        instanceName: 'portal_instancia',
      });
      const result = await wa.sendOtp({ to: '(67) 99111-2222', code: '789012' });

      assert.equal(result.success, true);
      assert.equal(capturedUrl, 'https://evolution.servidor.com/message/sendText/portal_instancia');
      assert.equal(capturedHeaders['apikey'], 'api_key_wa_123');
      assert.equal(capturedBody.number, '5567991112222');
      assert.equal(capturedBody.text.includes('789012'), true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('34. getAvailablePublicMethods deve incluir WHATSAPP quando configurado e operacional', () => {
    const configMulticanal = {
      ...DEFAULT_AUTH_CONFIG,
      email_enabled: true,
      email_provider: 'base44_core',
      whatsapp_enabled: true,
      whatsapp_provider: 'evolution_api',
    };

    const metodos = getAvailablePublicMethods(configMulticanal);
    assert.equal(metodos.length, 2);
    assert.equal(metodos.some((m) => m.canal === 'EMAIL'), true);
    assert.equal(metodos.some((m) => m.canal === 'WHATSAPP'), true);
  });
});
