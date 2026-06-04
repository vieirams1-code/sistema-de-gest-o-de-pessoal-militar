const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const mockData = Array.from({ length: 50 }, (_, i) => ({
  divergente: true,
  pendenciaExistente: false,
  inconsistenteCalculo: false,
  militar: { id: i, nome_completo: `Militar ${i}`, comportamento: 'Bom' },
  calculado: { comportamento: 'Excepcional', fundamento: 'Teste', detalhes: {} }
}));

const gerarPendencia = async (linha) => {
  // Simulate network/DB latency
  await sleep(10);
};

const runSequential = async () => {
  const start = performance.now();
  for (const linha of mockData) {
    await gerarPendencia(linha);
  }
  return performance.now() - start;
};

const runParallel = async () => {
  const start = performance.now();
  await Promise.all(mockData.map(linha => gerarPendencia(linha)));
  return performance.now() - start;
};

const run = async () => {
  console.log('Running benchmark (50 items, 10ms simulated latency per item)...');

  // Warmup
  await runSequential();
  await runParallel();

  const seqTime = await runSequential();
  const parTime = await runParallel();

  console.log(`Sequential time: ${seqTime.toFixed(2)}ms`);
  console.log(`Parallel time:   ${parTime.toFixed(2)}ms`);
  console.log(`Improvement:     ${(seqTime / parTime).toFixed(2)}x faster (${(seqTime - parTime).toFixed(2)}ms saved)`);
};

run();
