
import { describe, it } from 'node:test';
import assert from 'node:assert';

// We'll mock the necessary parts to test the logic
const mockAdicionarAuditoriaMedalha = (payload, { userEmail, acao }) => ({
  ...payload,
  updated_by: userEmail,
  resetado_por: acao === 'reset' ? userEmail : undefined,
  updated_at: '2023-01-01T00:00:00Z'
});

const CODIGOS_TEMPO_AUTOMATICO = ['TEMPO_10', 'TEMPO_20', 'TEMPO_30', 'TEMPO_40'];
const mockFiltrarIndicacoesTempoResetaveis = (medalhas) => medalhas.filter(m => CODIGOS_TEMPO_AUTOMATICO.includes(m.codigo) && m.status === 'INDICADA');

// Simulator of the refactored mutationFn logic in ApuracaoMedalhasTempoServico
async function resetMutationFn({
    registrosTempo,
    isAdmin,
    militarIdsEscopo,
    userEmail,
    bulkUpdateMock,
    updateMock
}) {
    const pendentes = mockFiltrarIndicacoesTempoResetaveis(registrosTempo);
    const pendentesEscopo = pendentes.filter((m) => isAdmin || militarIdsEscopo.has(m.militar_id));

    if (pendentesEscopo.length > 0) {
        const payloads = pendentesEscopo.map((m) => ({
          id: m.id,
          ...mockAdicionarAuditoriaMedalha({
            status: 'CANCELADA',
            observacoes: `${m.observacoes ? `${m.observacoes}\n` : ''}[RESET] Indicação resetada administrativamente.`,
          }, { userEmail, acao: 'reset' }),
        }));

        if (typeof bulkUpdateMock === 'function') {
          await bulkUpdateMock(payloads);
        } else {
          await Promise.all(payloads.map((p) => updateMock(p.id, p)));
        }
    }
    return pendentesEscopo.length;
}

describe('ApuracaoMedalhasTempoServico Reset Logic', () => {
    it('should reset only INDICADA status for TEMPO_* medalhas within scope using bulkUpdate', async () => {
        let capturedPayloads = null;
        const bulkUpdateMock = async (payloads) => { capturedPayloads = payloads; };

        const registrosTempo = [
            { id: '1', militar_id: 'm1', codigo: 'TEMPO_10', status: 'INDICADA', observacoes: 'obs1' },
            { id: '2', militar_id: 'm2', codigo: 'TEMPO_20', status: 'CONCEDIDA' },
            { id: '3', militar_id: 'm1', codigo: 'OUTRA', status: 'INDICADA' },
            { id: '4', militar_id: 'out_of_scope', codigo: 'TEMPO_10', status: 'INDICADA' }
        ];

        const militarIdsEscopo = new Set(['m1', 'm2']);
        const count = await resetMutationFn({
            registrosTempo,
            isAdmin: false,
            militarIdsEscopo,
            userEmail: 'test@user.com',
            bulkUpdateMock
        });

        assert.strictEqual(count, 1);
        assert.strictEqual(capturedPayloads.length, 1);
        assert.strictEqual(capturedPayloads[0].id, '1');
        assert.strictEqual(capturedPayloads[0].status, 'CANCELADA');
    });

    it('should fallback to sequential updates if bulkUpdate is missing', async () => {
        const updatedIds = [];
        const updateMock = async (id) => { updatedIds.push(id); };

        const registrosTempo = [
            { id: '1', militar_id: 'm1', codigo: 'TEMPO_10', status: 'INDICADA' },
            { id: '2', militar_id: 'm2', codigo: 'TEMPO_20', status: 'INDICADA' }
        ];

        await resetMutationFn({
            registrosTempo,
            isAdmin: true,
            militarIdsEscopo: new Set(),
            userEmail: 'test@user.com',
            updateMock
            // bulkUpdateMock is undefined
        });

        assert.strictEqual(updatedIds.length, 2);
        assert.ok(updatedIds.includes('1'));
        assert.ok(updatedIds.includes('2'));
    });
});
