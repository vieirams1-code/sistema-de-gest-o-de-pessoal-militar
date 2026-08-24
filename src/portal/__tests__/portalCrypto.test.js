import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  generatePortalToken,
  hashPortalToken,
  generateOtp,
  hashOtp,
  timingSafeCompare,
  generateCorrelationId,
  sanitizarIdentificador,
} from '../../../base44/shared/portal/portalCrypto.ts';

describe('Portal Crypto & Segurança — Código Real de Produção (Fase 1.2A-R)', () => {
  const TEST_PEPPER = 'secret_test_pepper_1234567890_portal_sgp';

  it('1. Deve gerar hashes idênticos para o mesmo token usando hashPortalToken() real', async () => {
    const token = generatePortalToken();
    const hash1 = await hashPortalToken(token);
    const hash2 = await hashPortalToken(token);
    assert.strictEqual(hash1, hash2);
    assert.strictEqual(hash1.length, 64); // SHA-256 hex
  });

  it('2. Deve gerar hashes diferentes para tokens distintos usando generatePortalToken()', async () => {
    const token1 = generatePortalToken();
    const token2 = generatePortalToken();
    assert.notStrictEqual(token1, token2);

    const hash1 = await hashPortalToken(token1);
    const hash2 = await hashPortalToken(token2);
    assert.notStrictEqual(hash1, hash2);
  });

  it('3. Deve assegurar que o token original possui 256 bits (64 hex chars) de entropia', () => {
    const token = generatePortalToken();
    assert.strictEqual(token.length, 64);
    assert.match(token, /^[0-9a-f]{64}$/);
  });

  it('4. Deve gerar OTP de 6 dígitos numéricos com rejection sampling e zero-padding', () => {
    for (let i = 0; i < 50; i++) {
      const otp = generateOtp(6);
      assert.strictEqual(otp.length, 6);
      assert.match(otp, /^\d{6}$/);
    }
  });

  it('5. Deve falhar fechado em hashOtp() se PORTAL_OTP_PEPPER estiver ausente', async () => {
    await assert.rejects(
      async () => {
        // Sem pepper e sem variável de ambiente
        delete process.env.PORTAL_OTP_PEPPER;
        await hashOtp('123456', 'context_1');
      },
      /PORTAL_OTP_PEPPER_AUSENTE/
    );
  });

  it('6. Deve calcular hash HMAC-SHA256 do OTP quando pepper estiver presente', async () => {
    const otp = '123456';
    const hash1 = await hashOtp(otp, 'militar_1', TEST_PEPPER);
    const hash2 = await hashOtp(otp, 'militar_1', TEST_PEPPER);
    const hashDifferentContext = await hashOtp(otp, 'militar_2', TEST_PEPPER);

    assert.strictEqual(hash1, hash2);
    assert.strictEqual(hash1.length, 64);
    assert.notStrictEqual(hash1, hashDifferentContext);
  });

  it('7. Deve realizar comparação segura em tempo constante (timingSafeCompare)', () => {
    const str1 = 'a'.repeat(64);
    const str2 = 'a'.repeat(64);
    const str3 = 'a'.repeat(63) + 'b';
    assert.strictEqual(timingSafeCompare(str1, str2), true);
    assert.strictEqual(timingSafeCompare(str1, str3), false);
    assert.strictEqual(timingSafeCompare(str1, 'curto'), false);
    assert.strictEqual(timingSafeCompare(null, str2), false);
  });

  it('8. Deve sanitizar identificadores sem expor CPF completo em logs', () => {
    assert.strictEqual(sanitizarIdentificador('12345678900'), '***.456.789-**');
    assert.strictEqual(sanitizarIdentificador('987654'), '98***54');
    assert.strictEqual(sanitizarIdentificador(''), 'ANONIMO');
  });

  it('9. Deve gerar correlationId válido', () => {
    const cid1 = generateCorrelationId();
    const cid2 = generateCorrelationId();
    assert.ok(cid1 && cid1.length > 10);
    assert.notStrictEqual(cid1, cid2);
  });
});
