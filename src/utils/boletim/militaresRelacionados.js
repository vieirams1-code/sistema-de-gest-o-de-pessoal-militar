/**
 * Leitura da seção "MILITARES RELACIONADOS COM A NOTA" dos boletins do CBMMS.
 * Cada nota lista os militares a que se refere com posto/graduação abreviado e
 * nome de guerra — essa é a fonte principal de identificação do destinatário.
 * Funções puras: não gravam nada.
 */
import { normalizarBuscaBoletim } from './normalizacaoBoletim.js';

// O PDF entrega o título com quebra de kerning: "MILITARES REL ACIONADOS".
const MARCA_SECAO = /MILITARES\s+REL\s?ACIONADOS\s+COM\s+A\s+NOTA/i;

const SIGLAS_POSTO = [
  ['SUB TEN', 'Subtenente'],
  ['SUBTEN', 'Subtenente'],
  ['TEN CEL', 'Tenente Coronel'],
  ['1 SGT', '1º Sargento'],
  ['2 SGT', '2º Sargento'],
  ['3 SGT', '3º Sargento'],
  ['1 TEN', '1º Tenente'],
  ['2 TEN', '2º Tenente'],
  ['CEL', 'Coronel'],
  ['TC', 'Tenente Coronel'],
  ['MAJ', 'Major'],
  ['CAP', 'Capitão'],
  ['ASP', 'Aspirante'],
  ['CB', 'Cabo'],
  ['SD', 'Soldado'],
];

const REGEX_ENTRADA = new RegExp(
  '^(' + SIGLAS_POSTO.map(([sigla]) => sigla).sort((a, b) => b.length - a.length).join('|') + ')\\s+(.+)$'
);

const QUADROS = ['QPBM', 'QOBM', 'QAOBM', 'QOEBM', 'QOSAU', 'QBMP 1 A', 'QBMP 1 B', 'QBMP 2', 'QPTBM', 'QBMPT'];

function postoDaSigla(sigla = '') {
  return SIGLAS_POSTO.find(([s]) => s === sigla)?.[1] || '';
}

function limparNomeGuerra(valor = '') {
  let nome = String(valor || '');
  nome = nome.replace(/RESPONSAVEL\s+PELO\s+ATO\s*$/i, '');
  nome = nome.replace(/\s*·?\s*ORIGINAL\s*$/i, '');
  const quadro = QUADROS.find(q => nome.startsWith(q + ' '));
  if (quadro) nome = nome.slice(quadro.length).trim();
  return nome.replace(/\s+/g, ' ').trim();
}

/** Linhas de cabeçalho/rodapé repetidas em todas as páginas. */
function ehMovelDePagina(linha = '') {
  const limpa = linha.trim();
  if (!limpa) return true;
  if (/^PAGINA\s+\d+\s+DE\s+\d+$/i.test(limpa)) return true;
  if (/^BG\s*N[º°O]?\s*\d+/i.test(limpa)) return true;
  if (/CAMPO GRANDE/i.test(limpa) && /\d{4}/.test(limpa)) return true;
  const tokens = limpa.split(/\s+/);
  if (tokens.length >= 2 && tokens.every(t => t.length <= 3)) return true;
  const metade = Math.ceil(limpa.length / 2);
  const inicio = limpa.slice(0, metade).trim();
  if (inicio.length > 8 && limpa.slice(metade).trim() === inicio) return true;
  return false;
}

/**
 * Extrai a lista de militares relacionados de uma nota.
 * Retorna { encontrada, militares: [{ posto, posto_normalizado, nome_guerra,
 * responsavel_pelo_ato, bruto }] }.
 */
export function extrairSecaoMilitaresRelacionados(contexto = '') {
  const texto = String(contexto || '');
  const posicao = texto.search(MARCA_SECAO);
  if (posicao < 0) return { encontrada: false, militares: [] };

  const restante = texto.slice(posicao).replace(MARCA_SECAO, '');
  const militares = [];

  for (const linhaBruta of restante.split('\n')) {
    const linha = linhaBruta.trim();
    if (!linha) continue;
    const normalizada = normalizarBuscaBoletim(linha);
    const entrada = normalizada.match(REGEX_ENTRADA);

    if (entrada) {
      const nome = limparNomeGuerra(entrada[2]);
      if (nome.length >= 2) {
        militares.push({
          posto: entrada[1],
          posto_normalizado: postoDaSigla(entrada[1]),
          nome_guerra: nome,
          responsavel_pelo_ato: /RESPONSAVEL\s+PELO\s+ATO/i.test(normalizada),
          bruto: linha,
        });
        if (militares.length >= 60) break;
        continue;
      }
    }

    if (ehMovelDePagina(normalizada)) continue;
    // Primeira linha que não é militar nem cabeçalho encerra a seção.
    break;
  }

  return { encontrada: true, militares };
}

function tokensNome(valor = '') {
  return new Set(normalizarBuscaBoletim(valor).split(' ').filter(token => token.length >= 2));
}

/** O nome do boletim (nome de guerra) precisa estar contido no nome do militar. */
function nomeDoBoletimCorresponde(entrada, militar) {
  const alvo = tokensNome(entrada?.nome_guerra);
  if (!alvo.size || !militar) return false;
  const nomeCompleto = tokensNome(militar.nome_completo);
  const guerra = tokensNome(militar.nome_guerra);
  return [...alvo].every(token => nomeCompleto.has(token) || guerra.has(token));
}

export function nomeCorrespondeAoRelacionado(entrada, militar) {
  if (!nomeDoBoletimCorresponde(entrada, militar)) return false;
  return !entrada?.posto_normalizado || !militar?.posto_graduacao
    || entrada.posto_normalizado === militar.posto_graduacao;
}

/**
 * Relaciona cada entrada da seção ao efetivo. O nome de guerra do boletim é
 * comparado com o nome completo do militar, e o posto reduz os homônimos.
 * Casos com mais de um candidato ou com posto divergente ficam para revisão.
 */
export function resolverMilitaresRelacionados(entradas = [], militares = []) {
  const ativos = (militares || []).filter(m => m?.id && m.status_cadastro === 'Ativo');

  return (entradas || []).map(entrada => {
    const comPosto = entrada.posto_normalizado
      ? ativos.filter(m => m.posto_graduacao === entrada.posto_normalizado && nomeDoBoletimCorresponde(entrada, m))
      : [];
    const semPosto = ativos.filter(m => nomeDoBoletimCorresponde(entrada, m));

    let militar = null;
    let confianca = 'nao_identificada';
    let criterio = '';

    if (comPosto.length === 1) {
      militar = comPosto[0];
      confianca = 'alta';
      criterio = 'Seção de militares relacionados (posto e nome)';
    } else if (comPosto.length > 1) {
      confianca = 'revisar';
      criterio = 'Homônimos na seção de militares relacionados';
    } else if (semPosto.length === 1) {
      militar = semPosto[0];
      confianca = 'revisar';
      criterio = 'Militar localizado pelo nome, com posto divergente do boletim';
    } else if (semPosto.length > 1) {
      confianca = 'revisar';
      criterio = 'Homônimos na seção de militares relacionados';
    }

    return { ...entrada, militar, confianca, criterio, candidatos: semPosto.length };
  });
}