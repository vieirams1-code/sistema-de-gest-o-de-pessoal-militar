import { createClient } from '@base44/sdk';
import process from 'node:process';

const appId = process.env.BASE44_APP_ID || process.env.VITE_BASE44_APP_ID;
const serverUrl = process.env.BASE44_BACKEND_URL || process.env.VITE_BASE44_BACKEND_URL;
const token = process.env.BASE44_ACCESS_TOKEN || process.env.VITE_BASE44_ACCESS_TOKEN || process.env.BASE44_TOKEN;

if (!appId || !serverUrl) {
  console.error('✖ Não foi possível consultar o runtime: informe BASE44_APP_ID/VITE_BASE44_APP_ID e BASE44_BACKEND_URL/VITE_BASE44_BACKEND_URL.');
  console.error('✖ Verificação remota de Promocao não executada; confira Dados/Entities no painel Base44 após o push.');
  process.exit(1);
}

const base44 = createClient({
  appId,
  serverUrl,
  token,
  requiresAuth: false,
});

console.log('▶ Consultando base44.entities.Promocao.list(undefined, 1) no runtime...');
await base44.entities.Promocao.list(undefined, 1);
console.log('✔ entidade Promocao criada e consultável no runtime Base44');
