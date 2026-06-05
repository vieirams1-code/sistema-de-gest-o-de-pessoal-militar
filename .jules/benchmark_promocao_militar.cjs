const { performance } = require('perf_hooks');

async function benchmark() {
  const payloads = Array.from({ length: 21 }, (_, i) => ({
    promocao_id: 'prom-123',
    militar_id: `militar-${i}`,
    ordem: i + 1,
    status: 'publicado'
  }));

  const mockEntity = {
    create: async (payload) => {
      // Simulate network round-trip + DB processing (sequential impact)
      await new Promise(resolve => setTimeout(resolve, 50));
      return { id: Math.random().toString(36).substr(2, 9), ...payload };
    },
    bulkCreate: async (payloads) => {
      // Simulate single network round-trip + efficient DB batch processing
      await new Promise(resolve => setTimeout(resolve, 70));
      return payloads.map(p => ({ id: Math.random().toString(36).substr(2, 9), ...p }));
    }
  };

  console.log(`Benchmarking ${payloads.length} records...`);

  // Baseline: Promise.all(map(create))
  const startPromiseAll = performance.now();
  await Promise.all(payloads.map(p => mockEntity.create(p)));
  const endPromiseAll = performance.now();
  const timePromiseAll = endPromiseAll - startPromiseAll;
  console.log(`Promise.all(map(create)) took ${timePromiseAll.toFixed(2)}ms`);

  // Optimized: bulkCreate
  const startBulk = performance.now();
  await mockEntity.bulkCreate(payloads);
  const endBulk = performance.now();
  const timeBulk = endBulk - startBulk;
  console.log(`bulkCreate took ${timeBulk.toFixed(2)}ms`);

  const improvement = ((timePromiseAll - timeBulk) / timePromiseAll) * 100;
  console.log(`Improvement: ${improvement.toFixed(2)}%`);
}

benchmark();
