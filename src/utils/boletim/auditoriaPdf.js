/**
 * Auditoria inversa de boletins. Funções puras: não persistem PDFs, textos
 * de BGR, nem alteram publicações. Todo resultado exige revisão humana.
 */
export function normalizarBuscaBoletim(valor = '') {
  return String(valor || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
}

export function normalizarNotaBoletim(valor = '') {
  const texto = String(valor || '');
  const contextual = texto.match(/NOTA\s*N(?:\.|[º°])?\s*[:\-]?\s*([1-9]\d{3,7})/i);
  const numeros = contextual ? [contextual[1]] : (texto.match(/\b[1-9]\d{3,7}\b/g) || []);
  return numeros[0] || '';
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

export function identificarMilitaresEmNota(nota, militares = []) {
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
      if (guerra.length >= 6 && nomesGuerra.get(guerra) === 1 && contemFrase(normalizado, guerra)) {
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

export function analisarBoletimContraRegistros(notas = [], militares = [], registros = []) {
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
  for (const nota of notas) {
    const identificados = identificarMilitaresEmNota(nota, militares);
    if (!identificados.length) {
      notasSemMilitar.push(nota);
      continue;
    }

    for (const hit of identificados) {
      const registroMilitar = byMilitar.get(String(hit.militar.id)) || [];
      const notaNumero = normalizarNotaBoletim(nota.nota_normalizada || nota.nota);
      const vinculoExato = notaNumero ? registroMilitar.find(r => chavesNotasRegistro(r).includes(notaNumero)) : null;
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
