const { performance } = require('perf_hooks');

const LATENCY_MS = 50;
const CONCURRENCY_LIMIT = 5;

class Limiter {
  constructor(limit) {
    this.limit = limit;
    this.running = 0;
    this.queue = [];
  }

  async run(fn) {
    if (this.running >= this.limit) {
      await new Promise(resolve => this.queue.push(resolve));
    }
    this.running++;
    try {
      return await fn();
    } finally {
      this.running--;
      if (this.queue.length > 0) {
        const next = this.queue.shift();
        next();
      }
    }
  }
}

const limiter = new Limiter(CONCURRENCY_LIMIT);

const mockEntity = {
  update: async (id, data) => {
    return limiter.run(() => new Promise((resolve) => setTimeout(resolve, LATENCY_MS)));
  },
  bulkUpdate: async (items) => {
    // bulkUpdate takes 1 "connection"
    return limiter.run(() => new Promise((resolve) => setTimeout(resolve, LATENCY_MS)));
  }
};

async function benchmark() {
  const itemCount = 21;
  const items = Array.from({ length: itemCount }, (_, i) => ({ id: `id-${i}`, ordem: i + 1 }));

  console.log(`Benchmarking with ${itemCount} items, simulated ${LATENCY_MS}ms latency, and ${CONCURRENCY_LIMIT} concurrency limit...`);

  // Baseline: Promise.all with individual updates
  const startIndividual = performance.now();
  await Promise.all(items.map(item => mockEntity.update(item.id, { ordem: item.ordem })));
  const endIndividual = performance.now();
  const timeIndividual = endIndividual - startIndividual;
  console.log(`Individual updates (Promise.all): ${timeIndividual.toFixed(2)}ms`);

  // Optimized: single bulkUpdate
  const startBulk = performance.now();
  await mockEntity.bulkUpdate(items.map(item => ({ id: item.id, ...item })));
  const endBulk = performance.now();
  const timeBulk = endBulk - startBulk;
  console.log(`Bulk update: ${timeBulk.toFixed(2)}ms`);

  const improvement = ((timeIndividual - timeBulk) / timeIndividual) * 100;
  console.log(`Improvement: ${improvement.toFixed(2)}%`);
}

benchmark();
