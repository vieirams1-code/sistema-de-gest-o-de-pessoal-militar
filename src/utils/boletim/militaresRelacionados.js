/**
 * Leitura da seção "MILITARES RELACIONADOS COM A NOTA" dos boletins do CBMMS.
 * Cada nota lista os militares a que se refere com posto/graduação abreviado e
 * nome de guerra — essa é a fonte principal de identificação do destinatário.
 * Funções puras: não gravam nada.
 */
import { normalizarBuscaBoletim } from './normalizacaoBoletim.js';
import { isPostoInferior } from '../postoGraduacaoHierarquia.js';

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

function tokensNomeGuerra(valor = '') {
  return normalizarBuscaBoletim(valor).split(' ').filter(Boolean);
}

/**
 * Nomes de guerra iguais. A normalização já ignora pontos, hífens e acentos
 * ("R.Lima" = "R Lima"); além disso, uma inicial de um dos lados vale como
 * abreviação do primeiro nome do outro ("R LIMA" = "RICARDO LIMA").
 */
function nomeGuerraIgual(a, b) {
  const ta = tokensNomeGuerra(a);
  const tb = tokensNomeGuerra(b);
  if (!ta.length || ta.length !== tb.length) return false;
  return ta.every((token, i) => token === tb[i]
    || (token.length === 1 && tb[i].startsWith(token))
    || (tb[i].length === 1 && token.startsWith(tb[i])));
}

/**
 * Sem as iniciais soltas dos dois lados, o restante do nome de guerra precisa
 * ser idêntico: "C BATISTA" ≈ "BATISTA". Casos assim exigem revisão humana.
 */
function nomeGuerraCompativel(a, b) {
  const semIniciais = valor => tokensNomeGuerra(valor).filter(token => token.length > 1);
  const ta = semIniciais(a);
  return ta.length > 0 && ta.join(' ') === semIniciais(b).join(' ');
}

/** Compatibilidade com o nome completo, quando o cadastro não traz nome de guerra. */
function nomeDoRelacionadoNoNomeCompleto(entrada, referencia = {}) {
  const alvo = tokensNomeGuerra(entrada?.nome_guerra);
  if (!alvo.length) return false;
  const nomeCompleto = new Set(tokensNomeGuerra(referencia.nome_completo));
  return alvo.every(token => nomeCompleto.has(token));
}

/**
 * Nome completo citado no corpo da nota. Exige a frase inteira, em sequência:
 * um sobrenome ou o nome de guerra isolado não confirma o nome completo.
 */
function nomeCompletoNoTexto(nomeCompleto, textoNormalizado) {
  const nome = normalizarBuscaBoletim(nomeCompleto);
  if (nome.length < 10 || nome.split(' ').length < 2) return false;
  return (' ' + textoNormalizado + ' ').includes(' ' + nome + ' ');
}

/** Posto do boletim abaixo do cadastro: sinal de que são militares diferentes. */
function postoAbaixoDoCadastro(entrada, militar) {
  return Boolean(entrada?.posto_normalizado && militar?.posto_graduacao)
    && isPostoInferior(entrada.posto_normalizado, militar.posto_graduacao);
}

export function nomeCorrespondeAoRelacionado(entrada, militar) {
  if (!militar) return false;
  const postoConfere = !entrada?.posto_normalizado || !militar.posto_graduacao
    || entrada.posto_normalizado === militar.posto_graduacao;
  if (!postoConfere) return false;
  if (!militar.nome_guerra) return nomeDoRelacionadoNoNomeCompleto(entrada, militar);
  return nomeGuerraIgual(entrada?.nome_guerra, militar.nome_guerra)
    || nomeGuerraCompativel(entrada?.nome_guerra, militar.nome_guerra);
}

/**
 * Relaciona cada entrada da seção ao efetivo comparando apenas o nome de guerra,
 * que é o que o boletim informa. Quando há homônimos (mesmo nome de guerra, com ou
 * sem a mesma graduação), o nome completo citado no corpo da nota decide; sem essa
 * confirmação o caso fica para revisão. Posto divergente também fica para revisão.
 */
export function resolverMilitaresRelacionados(entradas = [], militares = [], { textoNota = '' } = {}) {
  const ativos = (militares || []).filter(m => m?.id && m.status_cadastro === 'Ativo');
  const textoNormalizado = normalizarBuscaBoletim(textoNota);

  return (entradas || []).map(entrada => {
    const iguais = ativos.filter(m => nomeGuerraIgual(entrada?.nome_guerra, m.nome_guerra));
    const exato = iguais.length > 0;
    const candidatos = exato
      ? iguais
      : ativos.filter(m => nomeGuerraCompativel(entrada?.nome_guerra, m.nome_guerra));
    const comPosto = entrada.posto_normalizado
      ? candidatos.filter(m => m.posto_graduacao === entrada.posto_normalizado)
      : [];
    const confirmadosNoTexto = textoNormalizado
      ? candidatos.filter(m => nomeCompletoNoTexto(m.nome_completo, textoNormalizado))
      : [];

    let militar = null;
    let confianca = 'nao_identificada';
    let criterio = '';

    if (confirmadosNoTexto.length === 1) {
      militar = confirmadosNoTexto[0];
      confianca = 'alta';
      criterio = 'Nome completo confirmado no texto da nota';
    } else if (confirmadosNoTexto.length > 1) {
      confianca = 'revisar';
      criterio = 'Mais de um homônimo confirmado pelo nome completo na nota';
    } else if (candidatos.length > 1) {
      // Homônimos: a graduação sozinha não decide, mesmo quando coincide com a nota.
      militar = comPosto.length === 1 ? comPosto[0] : null;
      confianca = 'revisar';
      criterio = comPosto.length === 1
        ? 'Homônimo com o mesmo nome de guerra; a graduação coincide, mas o nome completo não consta na nota'
        : 'Homônimos com o mesmo nome de guerra e sem confirmação do nome completo';
    } else if (comPosto.length === 1) {
      militar = comPosto[0];
      confianca = exato ? 'alta' : 'revisar';
      criterio = exato
        ? 'Nome de guerra igual ao da nota'
        : 'Nome de guerra compatível, com inicial abreviada';
    } else if (candidatos.length === 1 && !postoAbaixoDoCadastro(entrada, candidatos[0])) {
      // O boletim pode estar adiantado em relação ao cadastro (promoção ainda não
      // lançada); o contrário indica que são pessoas diferentes, com o mesmo nome.
      militar = candidatos[0];
      confianca = 'revisar';
      criterio = 'Nome de guerra localizado, com posto divergente do boletim e sem o nome completo na nota';
    }

    return { ...entrada, militar, confianca, criterio, candidatos: candidatos.length };
  });
}