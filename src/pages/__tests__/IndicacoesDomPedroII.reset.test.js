
import { describe, it } from 'node:test';
import assert from 'node:assert';

// We'll mock the necessary parts to test the logic
const mockAdicionarAuditoriaMedalha = (payload, { userEmail, acao }) => ({
  ...payload,
  updated_by: userEmail,
  resetado_por: acao === 'reset' ? userEmail : undefined,
  updated_at: '2023-01-01T00:00:00Z'
});

const mockFiltrarIndicacoesDomPedroResetaveis = (medalhas) => medalhas.filter(m => m.tipo === 'DOM_PEDRO_II' && m.status === 'INDICADA');

// Simulator of the refactored mutationFn logic
async function resetMutationFn({
    domPedroRegistros,
    isAdmin,
    militarIdsEscopo,
    userEmail,
    bulkUpdateMock
}) {
    const pendentes = mockFiltrarIndicacoesDomPedroResetaveis(domPedroRegistros);
    const pendentesEscopo = pendentes.filter((m) => isAdmin || militarIdsEscopo.has(m.militar_id));

    if (pendentesEscopo.length > 0) {
        const updates = pendentesEscopo.map((registro) => ({
            id: registro.id,
            ...mockAdicionarAuditoriaMedalha({
                status: 'CANCELADA',
                observacoes: `${registro.observacoes ? `${registro.observacoes}\n` : ''}[RESET] Indicação Dom Pedro II resetada.`,
            }, { userEmail, acao: 'reset' }),
        }));
        await bulkUpdateMock(updates);
    }
    return pendentesEscopo.length;
}

describe('IndicacoesDomPedroII Reset Logic', () => {
    it('should reset only INDICADA status for DOM_PEDRO_II medalha within scope', async () => {
        let capturedUpdates = null;
        const bulkUpdateMock = async (updates) => { capturedUpdates = updates; };

        const domPedroRegistros = [
            { id: '1', militar_id: 'm1', tipo: 'DOM_PEDRO_II', status: 'INDICADA', observacoes: 'obs1' },
            { id: '2', militar_id: 'm2', tipo: 'DOM_PEDRO_II', status: 'CONCEDIDA' },
            { id: '3', militar_id: 'm1', tipo: 'OUTRA', status: 'INDICADA' }, // filtered by mockFiltrar
            { id: '4', militar_id: 'out_of_scope', tipo: 'DOM_PEDRO_II', status: 'INDICADA' }
        ];

        const militarIdsEscopo = new Set(['m1', 'm2']);
        const count = await resetMutationFn({
            domPedroRegistros,
            isAdmin: false,
            militarIdsEscopo,
            userEmail: 'test@user.com',
            bulkUpdateMock
        });

        assert.strictEqual(count, 1, 'Only 1 record should be in scope and resetable');
        assert.strictEqual(capturedUpdates.length, 1);
        assert.strictEqual(capturedUpdates[0].id, '1');
        assert.strictEqual(capturedUpdates[0].status, 'CANCELADA');
        assert.strictEqual(capturedUpdates[0].updated_by, 'test@user.com');
        assert.ok(capturedUpdates[0].observacoes.includes('[RESET]'));
    });

    it('should handle empty list gracefully', async () => {
        let bulkCalled = false;
        const bulkUpdateMock = async () => { bulkCalled = true; };

        const count = await resetMutationFn({
            domPedroRegistros: [],
            isAdmin: true,
            militarIdsEscopo: new Set(),
            userEmail: 'test@user.com',
            bulkUpdateMock
        });

        assert.strictEqual(count, 0);
        assert.strictEqual(bulkCalled, false);
    });

    it('should reset multiple records when in scope', async () => {
        let capturedUpdates = null;
        const bulkUpdateMock = async (updates) => { capturedUpdates = updates; };

        const domPedroRegistros = [
            { id: '1', militar_id: 'm1', tipo: 'DOM_PEDRO_II', status: 'INDICADA' },
            { id: '2', militar_id: 'm2', tipo: 'DOM_PEDRO_II', status: 'INDICADA' }
        ];

        const count = await resetMutationFn({
            domPedroRegistros,
            isAdmin: true,
            militarIdsEscopo: new Set(),
            userEmail: 'test@user.com',
            bulkUpdateMock
        });

        assert.strictEqual(count, 2);
        assert.strictEqual(capturedUpdates.length, 2);
    });
});
