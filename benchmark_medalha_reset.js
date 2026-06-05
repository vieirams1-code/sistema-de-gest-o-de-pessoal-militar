import { base44 } from './src/api/base44Client.js';
import { adicionarAuditoriaMedalha } from './src/services/medalhasAcessoService.js';

const userEmail = 'test@example.com';

async function benchmark() {
  const count = 21;
  const pendentesEscopo = Array.from({ length: count }, (_, i) => ({
    id: `medalha-${i}`,
    militar_id: `militar-${i}`,
    observacoes: 'Obs ' + i
  }));

  console.log('--- Iniciando benchmark ---');

  // Simular Promise.all com updates individuais
  const startIndividual = Date.now();
  await Promise.all(pendentesEscopo.map(async (m) => {
    // console.log('Updating', m.id);
    // Mocking the behavior since we don't have a real backend connected that supports this
    return new Promise(resolve => setTimeout(resolve, 50)); // Simular latência de rede
  }));
  const endIndividual = Date.now();
  console.log(`Individual updates (simulado): ${endIndividual - startIndividual}ms`);

  console.log('--- Fim benchmark ---');
}

benchmark().catch(console.error);
