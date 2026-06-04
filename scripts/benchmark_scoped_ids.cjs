
async function originalLogic(userEmail, linkedMilitarEmail, linkedMilitarId, base44) {
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

async function optimizedLogic(userEmail, linkedMilitarEmail, linkedMilitarId, base44) {
  const ids = new Set();
  if (linkedMilitarId) ids.add(linkedMilitarId);
  const knownEmails = [...new Set([userEmail, linkedMilitarEmail].filter(Boolean))];

  const allConsultas = await Promise.all(
    knownEmails.flatMap(email => [
      base44.entities.Militar.filter({ email: email }),
      base44.entities.Militar.filter({ email_particular: email }),
      base44.entities.Militar.filter({ email_funcional: email }),
    ])
  );

  allConsultas.flat().forEach((m) => { if (m?.id) ids.add(m.id); });
  return Array.from(ids);
}

const mockBase44 = {
  entities: {
    Militar: {
      filter: async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return [{ id: 'm1' }];
      }
    }
  }
};

async function runBenchmark() {
  const userEmail = 'user@example.com';
  const linkedMilitarEmail = 'militar@example.com';
  const linkedMilitarId = 'id123';

  console.log('--- Benchmarking ---');

  console.time('Original Logic');
  await originalLogic(userEmail, linkedMilitarEmail, linkedMilitarId, mockBase44);
  console.timeEnd('Original Logic');

  console.time('Optimized Logic');
  await optimizedLogic(userEmail, linkedMilitarEmail, linkedMilitarId, mockBase44);
  console.timeEnd('Optimized Logic');
}

runBenchmark();
