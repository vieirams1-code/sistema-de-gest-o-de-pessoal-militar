
import {
  listarMedalhasEscopo,
  listarImpedimentosEscopo,
  resetarMedalhasEmLote
} from '../src/services/medalhasAcessoService.js';
import { garantirCatalogoFixoMedalhaTempo } from '../src/services/medalhasTempoServicoService.js';

async function benchmark() {
  console.log('--- Performance Benchmark ---');

  const militarIds = Array.from({ length: 20 }, (_, i) => `militar-${i}`);

  // 1. Benchmark listarMedalhasEscopo
  {
    let callCount = 0;
    const mockClient = {
      entities: {
        Medalha: {
          filter: async (query) => {
            callCount++;
            if (query.militar_id && query.militar_id.in) {
                return [];
            }
            return [];
          }
        }
      }
    };

    console.log('\nTesting listarMedalhasEscopo with 20 military IDs:');
    await listarMedalhasEscopo({ base44Client: mockClient, isAdmin: false, militarIds });
    console.log(`Requests made: ${callCount} (Expected: 1)`);
  }

  // 2. Benchmark resetarMedalhasEmLote
  {
    let bulkUpdateCount = 0;
    const medalhas = Array.from({ length: 20 }, (_, i) => ({ id: `medalha-${i}`, observacoes: '' }));
    const mockClient = {
      entities: {
        Medalha: {
          bulkUpdate: async (payloads) => {
            bulkUpdateCount++;
            return payloads;
          }
        }
      }
    };

    console.log('\nTesting resetarMedalhasEmLote with 20 records:');
    await resetarMedalhasEmLote(mockClient, { medalhas, userEmail: 'test@sgp.mil' });
    console.log(`bulkUpdate calls: ${bulkUpdateCount} (Expected: 1)`);
  }

  // 3. Benchmark garantirCatalogoFixoMedalhaTempo
  {
    let bulkCreateCount = 0;
    const mockClient = {
      entities: {
        TipoMedalha: {
          list: async () => [],
          create: async () => ({ id: 'new' }),
          bulkCreate: async (payloads) => { bulkCreateCount++; return payloads.map(p => ({ ...p, id: 'bulk' })); }
        }
      }
    };

    console.log('\nTesting garantirCatalogoFixoMedalhaTempo (initial setup):');
    await garantirCatalogoFixoMedalhaTempo(mockClient);
    console.log(`bulkCreate calls: ${bulkCreateCount} (Expected: 1)`);
  }

  console.log('\n--- Benchmark Complete ---');
}

benchmark().catch(err => {
    console.error(err);
    process.exit(1);
});
