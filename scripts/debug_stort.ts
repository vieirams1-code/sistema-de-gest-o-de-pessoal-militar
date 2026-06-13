import { createClient } from 'npm:@base44/sdk@0.8.25';

const base44 = createClient({
  instanceUrl: Deno.env.get("BASE44_INSTANCE_URL") || "",
  apiKey: Deno.env.get("BASE44_API_KEY") || "",
});

const matricula = '415.443-021';
const Militares = await base44.asServiceRole.entities.Militar.filter({ matricula });

if (Militares.length === 0) {
  console.log("Militar não encontrado pela matrícula " + matricula);
} else {
  console.log("Militar encontrado:");
  console.log(JSON.stringify(Militares[0], null, 2));
}
