/**
 * Auditoria inversa de boletins. Funções puras: não persistem PDFs, textos
 * de BGR, nem alteram publicações. Todo resultado exige revisão humana.
 */
import corpoNotaAuditoria from './corpoNotaAuditoria.js';

export function normalizarBuscaBoletim(valor = '') {
  return String(valor || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
}

export function normalizarNotaBoletim(valor = '') {
  const texto = String(valor || '');
  const contextual = texto.match(/NOTA\s*N(?:\.|[º°])?\s*[:\-]?\s*(\d{4,9})/i);
  const numeros = contextual ? [contextual[1]] : (texto.match(/\b\d{4,9}\b/g) || []);
  for (const numero of numeros) {
    const limpo = numero.replace(/^0+/, '');
    if (/^[1-9]\d{3,7}$/.test(limpo)) return limpo;
  }
  return '';
}

function contemFrase(textoNormalizado, frase) {
  const alvo = normalizarBuscaBoletim(frase);
  return alvo.length >= 6 && (' ' + textoNormalizado + ' ').includes(' ' + alvo + ' ');
}

function contemMatricula(texto, matricula) {
  const digits = String(matricula || '').replace(/\D/g, '');
  if (digits.length < 5) return false;
  // Aceita separadores na matrícula, sem casar pedaços de outros números.
  const pattern = digits.split('').join('[.\\s-]*');
  return new RegExp('(^|\\D)' + pattern + '(?=\\D|$)').test(String(texto || ''));
}

export function identificarMilitaresEmNota(nota, militares = [], { permitirNomeGuerra = true } = {}) {
  const texto = String(nota?.contexto || '');
  const normalizado = normalizarBuscaBoletim(texto);
  const nomesGuerra = new Map();
  for (const militar of militares) {
    if (militar?.status_cadastro !== 'Ativo') continue;
    const nome = normalizarBuscaBoletim(militar.nome_guerra);
    if (nome.length >= 6) nomesGuerra.set(nome, (nomesGuerra.get(nome) || 0) + 1);
  }
  const matches = [];
  for (const militar of militares) {
    if (!militar?.id || militar.status_cadastro !== 'Ativo') continue;
    if (contemMatricula(texto, militar.matricula || militar.matricula_atual)) {
      matches.push({ militar, confianca: 'alta', criterio: 'Matrícula' });
    } else if (contemFrase(normalizado, militar.nome_completo)) {
      matches.push({ militar, confianca: 'alta', criterio: 'Nome completo' });
    } else {
      const guerra = normalizarBuscaBoletim(militar.nome_guerra);
      if (permitirNomeGuerra && guerra.length >= 6 && nomesGuerra.get(guerra) === 1 && contemFrase(normalizado, guerra)) {
        matches.push({ militar, confianca: 'revisar', criterio: 'Nome de guerra (verificar homônimos)' });
      }
    }
  }
  return matches;
}

function chavesNotasRegistro(registro) {
  return [
    registro.nota_para_bg,
    registro.nota_conciliada_boletim,
    registro.nota_boletim_vinculada,
    registro.nota_conciliada,
  ].map(normalizarNotaBoletim).filter(Boolean);
}

function semelhancaBasica(a, b) {
  const ta = new Set(normalizarBuscaBoletim(a).split(' ').filter(t => t.length > 3));
  const tb = new Set(normalizarBuscaBoletim(b).split(' ').filter(t => t.length > 3));
  if (!ta.size || !tb.size) return 0;
  let comum = 0;
  ta.forEach(t => { if (tb.has(t)) comum++; });
  return comum / Math.max(Math.min(ta.size, tb.size), 1);
}

const TIPOS_BOLETIM = [
  { regex: /DISPENSA.{0,95}RECOMPENSA|RECOMPENSA.{0,95}DISPENSA/, tipo: 'Dispensa Recompensa' },
  { regex: /\bELOGIO\b|ELOGIAR/, tipo: 'Elogio Individual' },
  { regex: /\bDESIGNACAO\b|\bDESIGNAR\b/, tipo: 'Designação de Função' },
  { regex: /\bDISPENSA DE FUNCAO\b|\bDISPENSAR DA FUNCAO\b/, tipo: 'Dispensa de Função' },
  { regex: /\bCURSO\b|\bESTAGIO\b|\bCAPACITACAO\b/, tipo: 'Curso/Estágio' },
  { regex: /\bTRANSCRICAO\b|\bTRANSCRIBO\b/, tipo: 'Transcrição de Documentos' },
  { regex: /\bPUNICAO\b|\bREPREENS(AO|AO)\b|\bDETENCAO\b/, tipo: 'Punição' },
  { regex: /\bFERIAS\b/, tipo: 'Férias (revisar modalidade)' },
  { regex: /\bJISO\b|\bINSPECAO DE SAUDE\b/, tipo: 'Saúde / JISO (revisar)' },
];

export function inferirTipoPublicacaoNota(texto) {
  const semCabecalho = String(texto || '').replace(/^\s*NOTA\s+N(?:\.|º|°)?\s*[:\-]?\s*\d+\s*/i, '');
  const cabecalho = normalizarBuscaBoletim(semCabecalho.slice(0, 380));
  return TIPOS_BOLETIM.find(regra => regra.regex.test(cabecalho))?.tipo || 'Geral (classificar)';
}

export function analisarBoletimContraRegistros(notas = [], militares = [], registros = [], boletim = {}) {
  const byMilitar = new Map();
  const ids = new Set();
  for (const registro of registros) {
    if (!registro?.id || !registro.militar_id) continue;
    const chave = String(registro.origem_tipo || 'registro') + ':' + String(registro.id);
    if (ids.has(chave)) continue;
    ids.add(chave);
    const key = String(registro.militar_id);
    if (!byMilitar.has(key)) byMilitar.set(key, []);
    byMilitar.get(key).push(registro);
  }

  const ocorrencias = [];
  const notasSemMilitar = [];
  for (const original of notas) {
    const nota = corpoNotaAuditoria(original);
    // Sobrenome/nome de guerra isolado não comprova quem é o destinatário.
    // Importação requer nome completo ou matrícula no mesmo corpo exibido.
    const identificados = identificarMilitaresEmNota(nota, militares, { permitirNomeGuerra: false });
    if (!identificados.length) {
      notasSemMilitar.push(nota);
      continue;
    }

    for (const hit of identificados) {
      const registroMilitar = byMilitar.get(String(hit.militar.id)) || [];
      const notaNumero = normalizarNotaBoletim(nota.nota_normalizada || nota.nota);
      const vinculoExato = notaNumero ? registroMilitar.find(r => {
        if (!chavesNotasRegistro(r).includes(notaNumero)) return false;
        const mesmoNumero = !r.numero_bg || !boletim.numeroBoletim || String(r.numero_bg).replace(/^0+/, '') === String(boletim.numeroBoletim).replace(/^0+/, '');
        const mesmaData = !r.data_bg || !boletim.dataBoletim || String(r.data_bg).slice(0, 10) === String(boletim.dataBoletim);
        return mesmoNumero && mesmaData;
      }) : null;
      const sugestao = vinculoExato || registroMilitar.find(r =>
        semelhancaBasica(nota.contexto, r.texto_publicacao || r.documento_texto || '') >= 0.55
      ) || null;

      let status = 'sem_registro';
      if (hit.confianca !== 'alta') status = 'revisar_identidade';
      else if (vinculoExato) status = 'registro_localizado';
      else if (sugestao) status = 'possivel_correspondencia';

      ocorrencias.push({
        id: String(nota.id) + ':' + String(hit.militar.id),
        nota, militar: hit.militar, criterio: hit.criterio,
        confianca: hit.confianca, status, registro: sugestao,
        registrosDoMilitar: registroMilitar.length,
      });
    }
  }
  return { ocorrencias, notasSemMilitar };
}