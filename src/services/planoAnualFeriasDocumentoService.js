import { ordenarMilitaresPorAntiguidadeInstitucional } from '@/utils/antiguidade/ordenacaoMilitarInstitucional';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const COLUNAS = [
  'ORD.', 'POSTO/GRAD.', 'NOME', 'MATRÍCULA', 'ADMISSÃO',
  'PERÍODO AQUISITIVO', 'PERÍODO CONCESSIVO', 'FRACIONAMENTO',
  'SAÍDA E RETORNO EM LIVRO', 'OBSERVAÇÕES',
];

const LARGURAS_PDF = [9, 24, 39, 23, 17, 36, 36, 23, 33, 32];

function texto(valor) {
  return String(valor ?? '').trim();
}

function dataValidaISO(valor) {
  return /^\d{4}-\d{2}-\d{2}$/.test(texto(valor));
}

function formatarData(valor) {
  if (!dataValidaISO(valor)) return '';
  const [ano, mes, dia] = valor.slice(0, 10).split('-');
  return dia + '/' + mes + '/' + ano;
}

function incrementarUmDia(valor) {
  if (!dataValidaISO(valor)) return '';
  const data = new Date(valor + 'T12:00:00Z');
  data.setUTCDate(data.getUTCDate() + 1);
  return data.toISOString().slice(0, 10);
}

function formatarIntervalo(inicio, fim) {
  const a = formatarData(inicio);
  const b = formatarData(fim);
  return a && b ? a + ' a ' + b : (a || b || '');
}

export function lotacaoDoMilitar(militar = {}) {
  return texto(militar.estrutura_nome)
    || texto(militar.subgrupamento_nome)
    || texto(militar.grupamento_nome)
    || 'Lotação não informada';
}

function isFeriasRegulares(ferias) {
  const tipo = texto(ferias.tipo);
  return !tipo || tipo === 'Férias Regulares';
}

function normalizarStatus(ferias) {
  return texto(ferias.status) || 'Prevista';
}

function rotuloFracao(ferias, grupo) {
  if (texto(ferias.fracionamento)) return texto(ferias.fracionamento);
  if (!grupo || grupo.length <= 1) return '';
  const indice = grupo.findIndex((item) => item.id === ferias.id);
  return (indice + 1) + 'ª de ' + grupo.length + ' etapas (' + (ferias.dias || '?') + ' dias)';
}

function textoLivro(ferias) {
  const saida = formatarData(texto(ferias.data_saida_registrada).slice(0, 10));
  const retorno = formatarData(texto(ferias.data_retorno_registrada).slice(0, 10));
  return [saida && 'Saída: ' + saida, retorno && 'Retorno: ' + retorno].filter(Boolean).join(' | ');
}

function observacoes(ferias) {
  const notas = [];
  const status = normalizarStatus(ferias);
  if (status === 'Interrompida') notas.push('FÉRIAS INTERROMPIDAS');
  if (status !== 'Prevista' && status !== 'Autorizada' && status !== 'Interrompida' && status !== 'Gozada' && status !== 'Em Curso') {
    notas.push('STATUS: ' + status);
  }
  if (texto(ferias.observacoes)) notas.push(texto(ferias.observacoes));
  return notas.join(' | ');
}

export function listarLotacoesDisponiveis({ ferias = [], militares = [], ano }) {
  const militaresPorId = new Map(militares.map((m) => [String(m.id), m]));
  const conjunto = new Set();
  ferias.forEach((feria) => {
    if (!dataValidaISO(feria.data_inicio) || Number(feria.data_inicio.slice(0, 4)) !== Number(ano)) return;
    if (normalizarStatus(feria) === 'Cancelada' || !isFeriasRegulares(feria)) return;
    const militar = militaresPorId.get(String(feria.militar_id));
    conjunto.add(lotacaoDoMilitar(militar));
  });
  return [...conjunto].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

/**
 * Relatório de leitura: usa exclusivamente registros já devolvidos pelo gateway
 * com escopo de acesso. Nunca modifica férias ou períodos aquisitivos.
 */
export function montarPlanoAnualFerias({
  ano, ferias = [], militares = [], periodosAquisitivos = [], lotacao = 'TODAS',
}) {
  const militaresPorId = new Map(militares.map((m) => [String(m.id), m]));
  const periodosPorId = new Map(periodosAquisitivos.map((p) => [String(p.id), p]));
  const ordenadosPorAntiguidade = ordenarMilitaresPorAntiguidadeInstitucional(militares);
  const ordemMilitar = new Map(ordenadosPorAntiguidade.map((m, index) => [String(m.id), index]));
  const todasRegulares = ferias
    .filter((f) => f && isFeriasRegulares(f) && normalizarStatus(f) !== 'Cancelada' && dataValidaISO(f.data_inicio))
    .slice()
    .sort((a, b) => a.data_inicio.localeCompare(b.data_inicio) || String(a.id).localeCompare(String(b.id)));
  const fracionamentos = new Map();

  todasRegulares.forEach((feria) => {
    const chave = String(feria.militar_id) + '/' + String(feria.periodo_aquisitivo_id || feria.periodo_aquisitivo_ref || feria.id);
    const grupo = fracionamentos.get(chave) || [];
    grupo.push(feria);
    fracionamentos.set(chave, grupo);
  });

  const registros = todasRegulares
    .filter((feria) => Number(feria.data_inicio.slice(0, 4)) === Number(ano))
    .filter((feria) => lotacao === 'TODAS' || lotacaoDoMilitar(militaresPorId.get(String(feria.militar_id))) === lotacao)
    .map((feria) => {
      const militar = militaresPorId.get(String(feria.militar_id)) || {};
      const periodo = periodosPorId.get(String(feria.periodo_aquisitivo_id)) || {};
      const chave = String(feria.militar_id) + '/' + String(feria.periodo_aquisitivo_id || feria.periodo_aquisitivo_ref || feria.id);
      return {
        id: feria.id,
        militar_id: String(feria.militar_id),
        mes: Number(feria.data_inicio.slice(5, 7)),
        data_inicio: feria.data_inicio,
        posto: texto(militar.posto_graduacao) || texto(feria.militar_posto),
        nome: texto(militar.nome_completo) || texto(feria.militar_nome),
        matricula: texto(militar.matricula_atual) || texto(militar.matricula) || texto(feria.militar_matricula),
        admissao: formatarData(militar.data_inclusao),
        periodoAquisitivo: formatarIntervalo(periodo.inicio_aquisitivo, periodo.fim_aquisitivo) || texto(feria.periodo_aquisitivo_ref),
        periodoConcessivo: formatarIntervalo(incrementarUmDia(periodo.fim_aquisitivo), periodo.data_limite_gozo),
        fracionamento: rotuloFracao(feria, fracionamentos.get(chave)),
        livro: textoLivro(feria),
        observacoes: observacoes(feria),
        status: normalizarStatus(feria),
        lotacao: lotacaoDoMilitar(militar),
      };
    });

  const meses = MESES.map((nome, indice) => {
    const linhas = registros.filter((r) => r.mes === indice + 1)
      .sort((a, b) =>
        (ordemMilitar.get(a.militar_id) ?? Infinity) - (ordemMilitar.get(b.militar_id) ?? Infinity)
        || a.data_inicio.localeCompare(b.data_inicio)
        || a.nome.localeCompare(b.nome, 'pt-BR'),
      )
      .map((r, index) => ({ ...r, ordem: index + 1 }));
    return { nome, numero: indice + 1, linhas };
  });

  return {
    ano: Number(ano),
    lotacao,
    meses,
    totalRegistros: registros.length,
    totalMilitares: new Set(registros.map((r) => r.militar_id)).size,
  };
}

function valoresLinha(item) {
  return [
    item.ordem, item.posto, item.nome, item.matricula, item.admissao,
    item.periodoAquisitivo, item.periodoConcessivo, item.fracionamento,
    item.livro, item.observacoes,
  ];
}

function nomeArquivo(plano, extensao) {
  const unidade = plano.lotacao === 'TODAS' ? 'Lotacoes_Autorizadas' : plano.lotacao;
  const seguro = unidade.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 45);
  return 'Plano_Ferias_' + plano.ano + '_' + seguro + '.' + extensao;
}

export async function exportarPlanoExcel(plano) {
  const XLSX = await import('xlsx');
  const linhas = [
    ['PLANO DE FÉRIAS REGULAMENTARES DOS OFICIAIS E PRAÇAS'],
    ['ANO ' + plano.ano + ' - ' + (plano.lotacao === 'TODAS' ? 'LOTAÇÕES AUTORIZADAS' : plano.lotacao)],
    ['Emitido em ' + new Date().toLocaleDateString('pt-BR')],
  ];
  const mesclagens = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 9 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } }, { s: { r: 2, c: 0 }, e: { r: 2, c: 9 } }];
  const linhasAlturas = [{ hpt: 26 }, { hpt: 22 }, { hpt: 18 }];
  plano.meses.forEach((mes) => {
    mesclagens.push({ s: { r: linhas.length, c: 0 }, e: { r: linhas.length, c: 9 } });
    linhas.push([mes.nome.toUpperCase() + ' / ' + plano.ano]);
    linhasAlturas.push({ hpt: 23 });
    linhas.push([...COLUNAS]);
    linhasAlturas.push({ hpt: 40 });
    if (!mes.linhas.length) {
      mesclagens.push({ s: { r: linhas.length, c: 0 }, e: { r: linhas.length, c: 9 } });
      linhas.push(['SEM LANÇAMENTOS']);
      linhasAlturas.push({ hpt: 20 });
    } else {
      mes.linhas.forEach((item) => {
        linhas.push(valoresLinha(item));
        linhasAlturas.push({ hpt: 37 });
      });
    }
    linhas.push([]);
    linhasAlturas.push({ hpt: 8 });
  });
  linhas.push(['OBSERVAÇÕES GERAIS']);
  mesclagens.push({ s: { r: linhas.length - 1, c: 0 }, e: { r: linhas.length - 1, c: 9 } });
  linhas.push(['Campo destinado a anotações e situações não automatizadas.']);
  mesclagens.push({ s: { r: linhas.length - 1, c: 0 }, e: { r: linhas.length - 1, c: 9 } });
  linhas.push([]);
  linhas.push(['________________________________________']);
  linhas.push(['Autoridade responsável - conferir e assinar']);
  const ws = XLSX.utils.aoa_to_sheet(linhas);
  ws['!merges'] = mesclagens;
  ws['!cols'] = [7, 22, 42, 19, 15, 31, 31, 22, 35, 35].map((wch) => ({ wch }));
  ws['!rows'] = linhasAlturas;
  ws['!pageSetup'] = { orientation: 'landscape', paperSize: 9, fitToWidth: 1, fitToHeight: 0 };
  ws['!margins'] = { left: 0.25, right: 0.25, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 };
  const livro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(livro, ws, 'Plano de Férias ' + plano.ano);
  XLSX.writeFile(livro, nomeArquivo(plano, 'xlsx'));
}

export async function exportarPlanoPDF(plano) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const largura = pdf.internal.pageSize.getWidth();
  const altura = pdf.internal.pageSize.getHeight();
  const margem = 7;
  const inicioTabela = margem;
  const totalLargura = LARGURAS_PDF.reduce((total, n) => total + n, 0);
  const escala = (largura - margem * 2) / totalLargura;
  const larguras = LARGURAS_PDF.map((n) => n * escala);
  let y = 12;

  const novaPagina = () => {
    pdf.addPage();
    y = 12;
  };

  const rodape = () => {
    const total = pdf.getNumberOfPages();
    for (let pagina = 1; pagina <= total; pagina += 1) {
      pdf.setPage(pagina);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7);
      pdf.setTextColor(90, 90, 90);
      pdf.text('SGP Militar | Plano de férias ' + plano.ano + ' | Emissão: ' + new Date().toLocaleDateString('pt-BR'), margem, altura - 5);
      pdf.text('Página ' + pagina + '/' + total, largura - margem, altura - 5, { align: 'right' });
    }
  };

  const titulo = () => {
    pdf.setTextColor(20, 48, 83);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.text('PLANO DE FÉRIAS REGULAMENTARES DOS OFICIAIS E PRAÇAS', margem, y);
    y += 6;
    pdf.setFontSize(9);
    pdf.text('Ano: ' + plano.ano + ' | Lotação: ' + (plano.lotacao === 'TODAS' ? 'Todas as lotações autorizadas' : plano.lotacao), margem, y);
    y += 8;
  };

  const faixaMes = (mes) => {
    if (y > altura - 31) novaPagina();
    pdf.setFillColor(26, 57, 93);
    pdf.rect(margem, y, largura - margem * 2, 8, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.text(mes.nome.toUpperCase() + ' / ' + plano.ano, margem + 3, y + 5.5);
    y += 8;
    pdf.setFillColor(224, 231, 240);
    pdf.rect(margem, y, largura - margem * 2, 10, 'F');
    pdf.setTextColor(24, 42, 64);
    pdf.setFontSize(6.2);
    let x = inicioTabela;
    COLUNAS.forEach((coluna, i) => {
      const partes = pdf.splitTextToSize(coluna, larguras[i] - 2);
      pdf.text(partes, x + 1, y + 3.2);
      x += larguras[i];
    });
    y += 10;
  };

  const linha = (valores, alternada) => {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(6.4);
    const quebrados = valores.map((valor, i) => pdf.splitTextToSize(String(valor ?? ''), larguras[i] - 2));
    const linhasMax = Math.max(1, ...quebrados.map((partes) => partes.length));
    const alturaLinha = Math.max(8, 2.8 + linhasMax * 3.3);
    if (y + alturaLinha > altura - 15) return false;
    if (alternada) {
      pdf.setFillColor(244, 247, 250);
      pdf.rect(margem, y, largura - margem * 2, alturaLinha, 'F');
    }
    pdf.setDrawColor(207, 214, 224);
    pdf.setLineWidth(0.15);
    pdf.rect(margem, y, largura - margem * 2, alturaLinha);
    pdf.setTextColor(32, 45, 60);
    let x = inicioTabela;
    quebrados.forEach((partes, i) => {
      if (i) pdf.line(x, y, x, y + alturaLinha);
      pdf.text(partes, x + 1, y + 3.5);
      x += larguras[i];
    });
    y += alturaLinha;
    return true;
  };

  titulo();
  plano.meses.forEach((mes) => {
    faixaMes(mes);
    if (!mes.linhas.length) {
      if (!linha(['SEM LANÇAMENTOS'], false)) {
        novaPagina();
        faixaMes(mes);
        linha(['SEM LANÇAMENTOS'], false);
      }
    } else {
      mes.linhas.forEach((item, index) => {
        if (!linha(valoresLinha(item), index % 2 === 0)) {
          novaPagina();
          faixaMes(mes);
          linha(valoresLinha(item), index % 2 === 0);
        }
      });
    }
    y += 5;
  });

  if (y > altura - 40) novaPagina();
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(20, 48, 83);
  pdf.text('OBSERVAÇÕES GERAIS', margem, y);
  y += 13;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text('____________________________________________', margem, y);
  y += 5;
  pdf.text('Autoridade responsável - conferir e assinar', margem, y);
  rodape();
  pdf.save(nomeArquivo(plano, 'pdf'));
}
