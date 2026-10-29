import { identificarMilitaresEmNota, normalizarBuscaBoletim, normalizarNotaBoletim } from './auditoriaPdf.js';

const COMUNS = new Set([
  'PARA','COMO','ESTA','ESTE','SOBRE','FICA','PODE','SENDO','PELO','PELA',
  'NOSSA','CORPO','BOMBEIROS','MILITAR','MILITARES','COMANDANTE','CONFORME',
  'DECRETO','ATRIBUICOES','PUBLICO','PUBLICACAO','BOLETIM','GERAL','NOTA',
  'SECRETARIA','ESTADO','GRUPAMENTO','DIA','DIAS','ARTIGO','ASSIM','USO',
  'DETERMINO','DETERMINA','DETERMINOU','EFETIVO','QUE','QUAL','COM','UMA',
  'DOS','DAS','SER','DESDE','AOS','NAS','NOS','POR','SEU','SUA','ESTAO',
  'SERA','ASSINADO','ANO','NOS','MEDIANTE','TERMO',
]);
function tokens(v) {
  const normalized = normalizarBuscaBoletim(v);
  return new Set(normalized.split(' ').filter(x => x.length >= 4 && !COMUNS.has(x) && !/^\d+$/.test(x)));
}
function contemMatricula(texto, matricula) {
  const digits = String(matricula || '').replace(/\D/g, '');
  if (digits.length < 5) return false;
  const rx = new RegExp('(^|\\D)' + digits.split('').join('[.\\s-]*') + '(?=\\D|$)');
  return rx.test(String(texto || ''));
}
function contemNome(texto, nome) {
  const n = normalizarBuscaBoletim(nome);
  return n.length >= 9 && (' ' + normalizarBuscaBoletim(texto) + ' ').includes(' ' + n + ' ');
}
function tipoTexto(pub) { return pub.texto_publicacao || pub.texto || pub.documento_texto || ''; }

function atoExplicitoNoTexto(texto) {
  const t = normalizarBuscaBoletim(texto);
  if (/DISPENSA.{0,95}RECOMPENSA|RECOMPENSA.{0,95}DISPENSA/.test(t)) return 'DISPENSA RECOMPENSA';
  if (/LICENCA.{0,35}PATERNIDADE/.test(t)) return 'LICENCA PATERNIDADE';
  if (/LICENCA.{0,35}MATERNIDADE/.test(t)) return 'LICENCA MATERNIDADE';
  if (/ELOGIO INDIVIDUAL/.test(t)) return 'ELOGIO INDIVIDUAL';
  return '';
}

/**
 * Análise conservadora: não confirma nada automaticamente. Nota numérica divergente
 * é bloqueada. Identidade/texto inconclusivos exigem verificação explícita.
 */
export function avaliarVinculoPublicacao(pub, nota, militares = [], { paginasLayoutIncertos = [] } = {}) {
  const numeroEsperado = normalizarNotaBoletim(pub?.nota_para_bg);
  const numeroExtraido = normalizarNotaBoletim(nota?.nota);
  const numeroOK = !!numeroEsperado && numeroEsperado === numeroExtraido;
  const textoBG = nota?.contexto || '';
  const identificados = identificarMilitaresEmNota(nota, militares);
  const participantes = pub?.coletiva ? (pub.militares_ids || []).map(id => ({ ...(pub.militares_vinculados || []).find(m => String(m.militar_id) === String(id)), militar_id: id })) : [pub];
  const identidades = participantes.map(p => {
    const militar = militares.find(m => String(m.id) === String(p?.militar_id));
    const identificado = identificados.find(m => String(m.militar.id) === String(p?.militar_id));
    const matriculaOK = contemMatricula(textoBG, p?.militar_matricula || militar?.matricula || militar?.matricula_atual);
    const nomeOK = contemNome(textoBG, militar?.nome_completo || p?.militar_nome || p?.nome_completo);
    return identificado?.confianca === 'alta' || matriculaOK || nomeOK ? 'confirmada' : identificado?.confianca === 'revisar' ? 'revisar' : 'nao_identificada';
  });
  const identidade = identidades.length && identidades.every(i => i === 'confirmada') ? 'confirmada' : identidades.includes('nao_identificada') || !identidades.length ? 'nao_identificada' : 'revisar';

  const rpTokens = tokens(tipoTexto(pub));
  const bgTokens = tokens(textoBG);
  let comuns = 0;
  for (const t of rpTokens) if (bgTokens.has(t)) comuns++;
  const similaridade = rpTokens.size && bgTokens.size
    ? Math.round(100 * 2 * comuns / (rpTokens.size + bgTokens.size))
    : 0;
  const textoOK = comuns >= 4 && similaridade >= 38;

  const layoutIncerto = !!nota?.textoTruncado ||
    (nota?.paginas || [nota?.pagina]).some(p => paginasLayoutIncertos.includes(p));
  const problemas = [];
  if (!numeroOK) problemas.push('Número da nota diferente do RP');
  if (identidade === 'revisar') problemas.push('Militar reconhecido apenas por nome de guerra');
  if (identidade === 'nao_identificada') problemas.push('Militar do RP não identificado com segurança na nota');
  if (!textoOK) problemas.push('Conteúdo não suficientemente semelhante');
  const tipoCadastrado = normalizarBuscaBoletim(pub?.tipo_registro || pub?.tipo);
  const assuntoCadastro = atoExplicitoNoTexto(tipoTexto(pub));
  const assuntoBG = atoExplicitoNoTexto(textoBG);
  if (assuntoCadastro && tipoCadastrado && assuntoCadastro !== tipoCadastrado) {
    problemas.push('O tipo cadastrado diverge do assunto explícito no texto do próprio RP');
  }
  if (assuntoBG && tipoCadastrado && assuntoBG !== tipoCadastrado) {
    problemas.push('O tipo do RP diverge do assunto explícito da nota do BG');
  }
  if (layoutIncerto) problemas.push('Texto PDF incompleto ou com layout incerto');

  return {
    numeroOK, identidade, similaridade, textoOK, layoutIncerto,
    problemas, exigeRevisao: problemas.length > 0,
    bloqueado: !numeroOK || !nota,
    compativel: numeroOK && identidade === 'confirmada' && textoOK && !layoutIncerto && problemas.length === 0,
  };
}