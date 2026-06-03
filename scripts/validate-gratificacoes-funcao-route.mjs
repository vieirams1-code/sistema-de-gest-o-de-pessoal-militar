import { readFileSync } from 'node:fs';

const appSource = readFileSync('src/App.jsx', 'utf8');
const pageSource = readFileSync('src/pages/GratificacoesFuncao.jsx', 'utf8');
const requireModuleAccessSource = readFileSync('src/components/auth/RequireModuleAccess.jsx', 'utf8');

const adminOnlyMatch = appSource.match(/const adminOnlyPages = new Set\(\[([\s\S]*?)\]\);/);
if (!adminOnlyMatch) {
  throw new Error('adminOnlyPages não encontrado em src/App.jsx.');
}

if (adminOnlyMatch[1].includes("'GratificacoesFuncao'")) {
  throw new Error('GratificacoesFuncao ainda está protegida por adminOnlyPages/RequireAdmin.');
}

if (!appSource.includes("GratificacoesFuncao: { actionKey: 'visualizar_gratificacoes_funcao', moduleName: 'Gratificação de Função' }")) {
  throw new Error('GratificacoesFuncao não está registrada com a action visualizar_gratificacoes_funcao no guard de rota.');
}

if (!requireModuleAccessSource.includes('if (canAccessAll || permissions === \'ALL\')')
  || !requireModuleAccessSource.includes('canAccessAction(key)')
  || !requireModuleAccessSource.includes('return <AccessDenied modulo={moduleName} />')) {
  throw new Error('RequireModuleAccess não evidencia o fluxo esperado: acesso total/action/AccessDenied.');
}

if (!pageSource.includes("canAccessAction('visualizar_gratificacoes_funcao')")
  || !pageSource.includes('<AccessDenied modulo="Gratificação de Função" />')) {
  throw new Error('A página GratificacoesFuncao não mantém o gate funcional e AccessDenied interno esperados.');
}

console.log('Rota GratificacoesFuncao validada: sem RequireAdmin, com action visualizar_gratificacoes_funcao, acesso total/admin e AccessDenied alcançável.');
