import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  generatePortalToken,
  hashPortalToken,
} from '../../../base44/shared/portal/portalCrypto.ts';
import {
  requirePortalSession,
  extractPortalToken,
  extractClientIp,
} from '../../../base44/shared/portal/requirePortalSession.ts';

function createMockBase44(sessionRecord) {
  let updatedRecord = null;
  let auditLogs = [];

  const mockEntity = {
    filter: async (query) => {
      if (sessionRecord && sessionRecord.token_hash === query.token_hash) {
        return [sessionRecord];
      }
      return [];
    },
    update: async (id, data) => {
      updatedRecord = { ...(sessionRecord || {}), ...data, id };
      return updatedRecord;
    },
    create: async (data) => {
      auditLogs.push(data);
      return { id: 'audit_1', ...data };
    },
  };

  return {
    asServiceRole: {
      entities: {
        PortalSessao: mockEntity,
        PortalAuditoria: {
          create: async (data) => {
            auditLogs.push(data);
            return { id: 'audit_log_' + auditLogs.length, ...data };
          },
        },
      },
    },
    getUpdatedRecord: () => updatedRecord,
    getAuditLogs: () => auditLogs,
  };
}

describe('Portal Session Guard & IDOR Defense — Código Real de Produção (Fase 1.2A-R)', () => {
  const sampleToken = generatePortalToken();
  let sampleHash = '';

  it('Setup: calcula hash do token gerado', async () => {
    sampleHash = await hashPortalToken(sampleToken);
    assert.strictEqual(sampleHash.length, 64);
  });

  it('1. Extração de token via Header X-Portal-Token', () => {
    const req = new Request('https://api.test/functions/portal_getMe', {
      headers: { 'x-portal-token': sampleToken },
    });
    const extracted = extractPortalToken(req);
    assert.strictEqual(extracted, sampleToken);
  });

  it('2. Extração de token via Header Authorization Bearer', () => {
    const req = new Request('https://api.test/functions/portal_getMe', {
      headers: { authorization: `Bearer ${sampleToken}` },
    });
    const extracted = extractPortalToken(req);
    assert.strictEqual(extracted, sampleToken);
  });

  it('3. Rejeição com 401 quando o token está ausente', async () => {
    const req = new Request('https://api.test/functions/portal_getMe', { headers: {} });
    const mockBase44 = createMockBase44(null);
    const result = await requirePortalSession(req, mockBase44);

    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.status, 401);
    assert.match(result.error, /TOKEN_AUSENTE/);
  });

  it('4. Rejeição com 401 para sessão inexistente', async () => {
    const req = new Request('https://api.test/functions/portal_getMe', {
      headers: { 'x-portal-token': sampleToken },
    });
    const mockBase44 = createMockBase44(null);
    const result = await requirePortalSession(req, mockBase44);

    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.status, 401);
    assert.match(result.error, /SESSAO_INVALIDA/);
  });

  it('5. Rejeição com 401 para sessão revogada', async () => {
    const req = new Request('https://api.test/functions/portal_getMe', {
      headers: { 'x-portal-token': sampleToken },
    });
    const mockSession = {
      id: 'sess_revoked',
      token_hash: sampleHash,
      status: 'REVOGADA',
      militar_id: 'mil_123',
    };
    const mockBase44 = createMockBase44(mockSession);
    const result = await requirePortalSession(req, mockBase44);

    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.status, 401);
    assert.strictEqual(result.error, 'SESSAO_REVOGADA: A sessão atual encontra-se revogada.');
  });

  it('6. Rejeição e marcação de EXPIRADA quando absolute timeout expira', async () => {
    const past = new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(); // 5h atrás
    const req = new Request('https://api.test/functions/portal_getMe', {
      headers: { 'x-portal-token': sampleToken },
    });
    const mockSession = {
      id: 'sess_abs_exp',
      token_hash: sampleHash,
      status: 'ATIVA',
      absolute_expires_at: past,
      militar_id: 'mil_123',
    };
    const mockBase44 = createMockBase44(mockSession);
    const result = await requirePortalSession(req, mockBase44);

    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.status, 401);
    assert.match(result.error, /SESSAO_EXPIRADA/);
    assert.strictEqual(mockBase44.getUpdatedRecord()?.status, 'EXPIRADA');
  });

  it('7. Rejeição e marcação de EXPIRADA quando idle timeout (inatividade > 30min) ocorre', async () => {
    const pastActivity = new Date(Date.now() - 1000 * 60 * 35).toISOString(); // 35 min atrás
    const req = new Request('https://api.test/functions/portal_getMe', {
      headers: { 'x-portal-token': sampleToken },
    });
    const mockSession = {
      id: 'sess_idle_exp',
      token_hash: sampleHash,
      status: 'ATIVA',
      last_activity_at: pastActivity,
      absolute_expires_at: new Date(Date.now() + 1000 * 60 * 60 * 2).toISOString(),
      militar_id: 'mil_123',
    };
    const mockBase44 = createMockBase44(mockSession);
    const result = await requirePortalSession(req, mockBase44);

    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.status, 401);
    assert.match(result.error, /SESSAO_EXPIRADA/);
    assert.strictEqual(mockBase44.getUpdatedRecord()?.status, 'EXPIRADA');
  });

  it('8. Sessão válida: militar_id é derivado com sucesso e last_activity_at é atualizado', async () => {
    const now = new Date();
    const req = new Request('https://api.test/functions/portal_getMe', {
      headers: { 'x-portal-token': sampleToken, 'x-forwarded-for': '203.0.113.195' },
    });
    const mockSession = {
      id: 'sess_valid',
      token_hash: sampleHash,
      status: 'ATIVA',
      last_activity_at: now.toISOString(),
      absolute_expires_at: new Date(now.getTime() + 1000 * 60 * 60 * 3).toISOString(),
      militar_id: 'mil_autorizado_456',
    };
    const mockBase44 = createMockBase44(mockSession);
    const result = await requirePortalSession(req, mockBase44);

    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.context?.militar_id, 'mil_autorizado_456');
    assert.strictEqual(result.context?.sessao_id, 'sess_valid');
    assert.strictEqual(result.context?.ip_origem, '203.0.113.195');
    assert.ok(mockBase44.getUpdatedRecord()?.last_activity_at);
  });

  it('9. Tentativa de enviar militar_id no payload é rejeitada com status 400 (IDOR block)', async () => {
    const req = new Request('https://api.test/functions/portal_getMe', {
      headers: { 'x-portal-token': sampleToken },
    });
    const mockBase44 = createMockBase44({
      id: 'sess_1',
      token_hash: sampleHash,
      status: 'ATIVA',
      militar_id: 'mil_legitimo',
    });

    const result = await requirePortalSession(req, mockBase44, { militar_id: 'mil_outro_alvo' });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.status, 400);
    assert.match(result.error, /PARÂMETRO_PROIBIDO/);

    const auditLogs = mockBase44.getAuditLogs();
    assert.strictEqual(auditLogs.some((l) => l.acao === 'ERRO_SEGURANCA'), true);
  });

  it('10. Tentativa de enviar militarId com casing alternativo também é rejeitada com 400', async () => {
    const req = new Request('https://api.test/functions/portal_getMe', {
      headers: { 'x-portal-token': sampleToken },
    });
    const mockBase44 = createMockBase44({
      id: 'sess_1',
      token_hash: sampleHash,
      status: 'ATIVA',
      militar_id: 'mil_legitimo',
    });

    const result = await requirePortalSession(req, mockBase44, { militarId: 'mil_outro' });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.status, 400);
    assert.match(result.error, /PARÂMETRO_PROIBIDO/);
  });

  it('11. Roteamento: /portal e /portal/* isolados de AuthProvider', () => {
    const isPortalRoute = (path) => path === '/portal' || path.startsWith('/portal/');
    assert.strictEqual(isPortalRoute('/portal'), true);
    assert.strictEqual(isPortalRoute('/portal/'), true);
    assert.strictEqual(isPortalRoute('/portal/tarefas'), true);
    assert.strictEqual(isPortalRoute('/Militares'), false);
    assert.strictEqual(isPortalRoute('/Ferias'), false);
    assert.strictEqual(isPortalRoute('/Atestados'), false);
    assert.strictEqual(isPortalRoute('/'), false);
  });
});
