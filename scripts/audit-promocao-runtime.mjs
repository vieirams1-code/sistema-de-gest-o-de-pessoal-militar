import { createClient } from '@base44/sdk';

const appId = process.env.VITE_BASE44_APP_ID || process.env.BASE44_APP_ID;
const serverUrl = process.env.VITE_BASE44_BACKEND_URL || process.env.BASE44_SERVER_URL;
const token = process.env.BASE44_ACCESS_TOKEN || process.env.VITE_BASE44_ACCESS_TOKEN || null;
const functionsVersion = process.env.VITE_BASE44_FUNCTIONS_VERSION || process.env.BASE44_FUNCTIONS_VERSION;

if (!appId || !serverUrl) {
  console.error('Faltam variáveis BASE44_APP_ID/VITE_BASE44_APP_ID e BASE44_SERVER_URL/VITE_BASE44_BACKEND_URL.');
  process.exit(2);
}

const base44 = createClient({ appId, serverUrl, token, functionsVersion, requiresAuth: false });

const nome = process.argv[2] || 'Edson Vieira de Souza';
const militar = (await base44.entities.Militar.filter({ nome_completo: nome }))[0];
if (!militar) {
  console.error(`Militar não encontrado: ${nome}`);
  process.exit(3);
}

const historicos = await base44.entities.HistoricoPromocaoMilitar.filter({ militar_id: militar.id }, '-created_date');
const alvo = historicos[0] || null;

console.log(JSON.stringify({
  militar: { id: militar.id, nome_completo: militar.nome_completo, posto_graduacao: militar.posto_graduacao, quadro: militar.quadro },
  total_historicos: historicos.length,
  registro_mais_recente: alvo,
  chaves_registro: alvo ? Object.keys(alvo).sort() : [],
  campos_vazios: alvo
    ? Object.entries(alvo).filter(([, v]) => v === null || v === undefined || String(v).trim() === '').map(([k]) => k)
    : [],
}, null, 2));
