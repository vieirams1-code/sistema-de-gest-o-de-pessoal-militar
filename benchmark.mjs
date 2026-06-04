import { performance } from 'perf_hooks';
import { __setMilitarIdentidadeClientForTests, executarMergeManualMilitares } from './src/services/militarIdentidadeService.js';

function createEntity(initial = []) {
  let seq = 1;
  const rows = [...initial];
  return {
    async list() {
      // Simulate network latency
      await new Promise(r => setTimeout(r, 10));
      return [...rows];
    },
    async filter(criteria = {}) {
      await new Promise(r => setTimeout(r, 10));
      return rows.filter((row) => Object.entries(criteria).every(([k, v]) => row[k] === v));
    },
    async create(payload) {
      await new Promise(r => setTimeout(r, 10));
      const created = { id: String(seq++), ...payload };
      rows.push(created);
      return created;
    },
    async update(id, payload) {
      await new Promise(r => setTimeout(r, 10));
      const idx = rows.findIndex((r) => r.id === id);
      rows[idx] = { ...rows[idx], ...payload };
      return rows[idx];
    },
    _rows: rows,
  };
}

function setupDefaultClient(overrides = {}) {
  const Militar = createEntity([{ id: 'm-origem', nome_completo: 'Origem', matricula: '111.111-111', status_cadastro: 'Ativo', merged_into_id: '' },
      { id: 'm-destino', nome_completo: 'Destino', matricula: '222.222-222', status_cadastro: 'Ativo', merged_into_id: '' }]);
  const MatriculaMilitar = createEntity([
      { id: 'mat-origem', militar_id: 'm-origem', matricula: '111.111-111', matricula_normalizada: '111111111', is_atual: true },
      { id: 'mat-destino', militar_id: 'm-destino', matricula: '222.222-222', matricula_normalizada: '222222222', is_atual: true },
    ]);
  const PossivelDuplicidadeMilitar = createEntity([{ id: 'dup1', status: 'PENDENTE' }]);
  const MergeMilitarLog = createEntity([]);

  // Create 10 items for each of the 3 entities
  const HistoricoComportamento = createEntity(Array.from({length: 10}, (_, i) => ({ id: `h${i}`, militar_id: 'm-origem' })));
  const PendenciaComportamento = createEntity(Array.from({length: 10}, (_, i) => ({ id: `p${i}`, militar_id: 'm-origem' })));
  const PunicaoDisciplinar = createEntity(Array.from({length: 10}, (_, i) => ({ id: `pd${i}`, militar_id: 'm-origem' })));

  const entities = {
    Militar,
    MatriculaMilitar,
    PossivelDuplicidadeMilitar,
    MergeMilitarLog,
    HistoricoComportamento,
    PendenciaComportamento,
    PunicaoDisciplinar,
    ...overrides,
  };

  __setMilitarIdentidadeClientForTests({ entities });
  return entities;
}

async function run() {
  setupDefaultClient();
  const start = performance.now();
  await executarMergeManualMilitares({
    militarOrigemId: 'm-origem',
    militarDestinoId: 'm-destino',
    motivo: 'Teste de merge',
    executadoPor: 'admin@sgp',
    pendenciaId: 'dup1',
  });
  const end = performance.now();
  console.log(`Execution time: ${(end - start).toFixed(2)} ms`);
}

run();
