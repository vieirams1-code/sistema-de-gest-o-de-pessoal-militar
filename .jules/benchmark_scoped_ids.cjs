const { performance } = require('perf_hooks');

async function benchmark() {
  const userEmail = 'user@example.com';
  const linkedMilitarEmail = 'militar@example.com';
  const linkedMilitarId = 'id-123';

  const mockFilter = async (query) => {
    // Simulate network latency
    await new Promise(resolve => setTimeout(resolve, 50));
    return [{ id: 'id-' + query.email }];
  };

  const base44 = {
    entities: {
      Militar: {
        filter: mockFilter
      }
    }
  };

  async function originalImplementation() {
    const ids = new Set();
    if (linkedMilitarId) ids.add(linkedMilitarId);
    const knownEmails = [userEmail, linkedMilitarEmail].filter(Boolean);
    for (const email of knownEmails) {
      const consultas = await Promise.all([
        base44.entities.Militar.filter({ email: email }),
        base44.entities.Militar.filter({ email_particular: email }),
        base44.entities.Militar.filter({ email_funcional: email }),
      ]);
      consultas.flat().forEach((m) => { if (m?.id) ids.add(m.id); });
    }
    return Array.from(ids);
  }

  async function optimizedImplementation() {
    const ids = new Set();
    if (linkedMilitarId) ids.add(linkedMilitarId);
    const knownEmails = Array.from(new Set([userEmail, linkedMilitarEmail].filter(Boolean)));

    const results = await Promise.all(
      knownEmails.flatMap(email => [
        base44.entities.Militar.filter({ email: email }),
        base44.entities.Militar.filter({ email_particular: email }),
        base44.entities.Militar.filter({ email_funcional: email }),
      ])
    );

    results.flat().forEach((m) => { if (m?.id) ids.add(m.id); });
    return Array.from(ids);
  }

  console.log('Starting benchmark...');

  const startOrig = performance.now();
  await originalImplementation();
  const endOrig = performance.now();
  console.log(`Original implementation took: ${(endOrig - startOrig).toFixed(2)}ms`);

  const startOpt = performance.now();
  await optimizedImplementation();
  const endOpt = performance.now();
  console.log(`Optimized implementation took: ${(endOpt - startOpt).toFixed(2)}ms`);

  const improvement = ((endOrig - startOrig) - (endOpt - startOpt)).toFixed(2);
  const percentage = (((endOrig - startOrig) - (endOpt - startOpt)) / (endOrig - startOrig) * 100).toFixed(2);
  console.log(`Improvement: ${improvement}ms (${percentage}%)`);
}

benchmark();
