import { performance } from 'perf_hooks';
import { __setResetOperacionalClientForTests } from '../../src/services/resetOperacionalService.js';
import { previewLimpezaPrePublicacao, executarLimpezaPrePublicacao } from '../../src/services/resetOperacionalService.js';

// Mock client implementation for benchmarking
const mockClient = {
  entities: {
    ResetOperacionalLog: {
      create: async () => ({ id: 1 })
    }
  }
};

const mockEntities = [
  'PendenciaComportamento', 'PunicaoDisciplinar',
  'CreditoExtraFerias', 'Ferias', 'PeriodoAquisitivo', 'PlanoFerias',
  'PublicacaoExOfficio', 'RegistroLivro',
  'JISO', 'Atestado',
  'ImpedimentoMedalha', 'Medalha',
  'CardComentario', 'CardChecklistItem', 'CardVinculo', 'CardOperacional', 'Armamento', 'SolicitacaoAtualizacao', 'ContratoConvocacao',
  'MergeMilitarLog', 'PossivelDuplicidadeMilitar', 'ImportacaoAlteracoesLegado', 'ImportacaoMilitares',
  'MatriculaMilitar',
  'Militar'
];

for (const entityName of mockEntities) {
  mockClient.entities[entityName] = {
    list: async () => {
      // simulate latency
      await new Promise(r => setTimeout(r, 10));
      return Array(10).fill({ id: Math.random().toString(36).substring(7) }); // 10 items per entity
    },
    delete: async () => {
      await new Promise(r => setTimeout(r, 5));
      return true;
    }
  };
}

__setResetOperacionalClientForTests(mockClient);

async function runBenchmark() {
  console.log('Starting benchmark...');
  const startPreview = performance.now();
  await previewLimpezaPrePublicacao({ executadoPor: 'bench' });
  const endPreview = performance.now();

  console.log(`previewLimpezaPrePublicacao took ${endPreview - startPreview}ms`);

  const startExec = performance.now();
  await executarLimpezaPrePublicacao({ confirmacao: 'CONFIRMO LIMPEZA OPERACIONAL', executadoPor: 'bench' });
  const endExec = performance.now();

  console.log(`executarLimpezaPrePublicacao took ${endExec - startExec}ms`);
}

runBenchmark().catch(console.error);
