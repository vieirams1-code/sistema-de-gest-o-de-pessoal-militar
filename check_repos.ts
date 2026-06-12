import { createClient } from 'https://esm.sh/@base44/sdk@0.8.25';

const base44 = createClient({
  baseUrl: 'http://localhost:8080', // Injected at runtime or using service role if local
  apiKey: 'service-role'
});

try {
  const repositorios = await base44.entities.RepositorioDocumental.list();
  console.log(JSON.stringify(repositorios, null, 2));
} catch (e) {
  console.error(e);
}
