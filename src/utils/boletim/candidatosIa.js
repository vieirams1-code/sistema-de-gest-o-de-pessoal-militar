import { normalizarBuscaBoletim } from './normalizacaoBoletim.js';

/**
 * Pré-seleção determinística de militares para a análise assistida por IA.
 * O efetivo completo é grande demais para caber em uma chamada; enviamos
 * apenas os militares cujo nome (de guerra ou completo) aparece no texto
 * analisado, mais os candidatos já apontados pela leitura local.
 * Função pura: não grava nada.
 */

const TAMANHO_MINIMO_TOKEN = 4;
const MAX_CANDIDATOS = 600;

function tokensDoMilitar(militar = {}) {
  const tokens = new Set();
  for (const valor of [militar.nome_guerra, militar.nome_completo]) {
    for (const token of normalizarBuscaBoletim(valor).split(' ')) {
      if (token.length >= TAMANHO_MINIMO_TOKEN) tokens.add(token);
    }
  }
  return tokens;
}

export function montarCandidatosIA({ textos = [], militares = [], idsExtras = [] } = {}) {
  const textoNormalizado = ' ' + textos.map(texto => normalizarBuscaBoletim(texto)).join(' ') + ' ';
  const extras = new Set((idsExtras || []).filter(Boolean).map(String));
  const selecionados = [];
  const vistos = new Set();

  const incluir = (militar) => {
    if (!militar?.id || vistos.has(String(militar.id))) return;
    if (selecionados.length >= MAX_CANDIDATOS) return;
    vistos.add(String(militar.id));
    selecionados.push(militar);
  };

  for (const militar of militares || []) {
    if (militar?.status_cadastro && militar.status_cadastro !== 'Ativo') continue;
    if (extras.has(String(militar?.id))) {
      incluir(militar);
      continue;
    }
    const tokens = tokensDoMilitar(militar);
    const citado = [...tokens].some(token => textoNormalizado.includes(' ' + token + ' '));
    if (citado) incluir(militar);
  }

  for (const militar of militares || []) {
    if (extras.has(String(militar?.id))) incluir(militar);
  }

  return selecionados;
}

export function empacotarCandidatos(militares = []) {
  return (militares || []).filter(m => m?.id).map(militar => ({
    id: String(militar.id),
    posto: militar.posto_graduacao || '',
    nome_guerra: militar.nome_guerra || '',
    nome_completo: militar.nome_completo || '',
    matricula: militar.matricula || '',
  }));
}