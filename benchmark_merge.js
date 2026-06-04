import { executarMergeManualMilitares, __setMilitarIdentidadeClientForTests } from './src/services/militarIdentidadeService.js';

let entityUpdates = 0;
const mockEntityCalls = (delay) => {
    return (entityName) => {
        return {
            list: async () => {
                await new Promise(r => setTimeout(r, delay));
                if (entityName === 'MatriculaMilitar') {
                    return [
                        { id: 'mat1', militar_id: 'origem_1', matricula: '111', is_atual: true },
                        { id: 'mat2', militar_id: 'destino_1', matricula: '222', is_atual: true }
                    ]
                }
                // Mock ENTIDADES_VINCULOS_MILITAR_ID ('HistoricoComportamento', 'PendenciaComportamento', 'PunicaoDisciplinar')
                return Array(5).fill({}).map((_, i) => ({ id: `${entityName}_${i}`, militar_id: 'origem_1' }));
            },
            update: async () => {
                entityUpdates++;
                await new Promise(r => setTimeout(r, delay));
            },
            filter: async (args) => {
                await new Promise(r => setTimeout(r, delay));
                if (entityName === 'Militar') {
                    if (args.id === 'origem_1') return [{id: 'origem_1', matricula: '111'}];
                    if (args.id === 'destino_1') return [{id: 'destino_1', matricula: '222'}];
                }
                if (entityName === 'MatriculaMilitar') {
                    if (args.militar_id === 'origem_1') return [{ id: 'mat1', militar_id: 'origem_1', matricula: '111', is_atual: true }];
                    if (args.militar_id === 'destino_1') return [{ id: 'mat2', militar_id: 'destino_1', matricula: '222', is_atual: true }];
                }
                if (['HistoricoComportamento', 'PendenciaComportamento', 'PunicaoDisciplinar'].includes(entityName)) {
                    if (args.militar_id === 'origem_1') return Array(5).fill({}).map((_, i) => ({ id: `${entityName}_${i}`, militar_id: 'origem_1' }));
                }
                return [];
            },
            create: async () => {
                await new Promise(r => setTimeout(r, delay));
                return { id: 'log_1' };
            }
        };
    };
};

async function runBenchmark() {
    const delay = 50; // Simulate 50ms latency per DB call

    // In src/services/militarIdentidadeService.js ensureClient uses client.entities[nome]
    const mockClient = {
        entities: {
            Militar: mockEntityCalls(delay)('Militar'),
            MatriculaMilitar: mockEntityCalls(delay)('MatriculaMilitar'),
            MergeMilitarLog: mockEntityCalls(delay)('MergeMilitarLog'),
            HistoricoComportamento: mockEntityCalls(delay)('HistoricoComportamento'),
            PendenciaComportamento: mockEntityCalls(delay)('PendenciaComportamento'),
            PunicaoDisciplinar: mockEntityCalls(delay)('PunicaoDisciplinar'),
            PossivelDuplicidadeMilitar: mockEntityCalls(delay)('PossivelDuplicidadeMilitar'),
        }
    };

    __setMilitarIdentidadeClientForTests(mockClient);

    entityUpdates = 0;
    const start = performance.now();
    await executarMergeManualMilitares({
        militarOrigemId: 'origem_1',
        militarDestinoId: 'destino_1',
        motivo: 'Benchmark'
    });
    const end = performance.now();

    console.log(`Execution time: ${(end - start).toFixed(2)} ms`);
    console.log(`Entity updates: ${entityUpdates}`);
}

runBenchmark().catch(console.error);
