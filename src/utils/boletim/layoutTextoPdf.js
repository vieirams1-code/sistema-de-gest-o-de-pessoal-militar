/**
 * Reconstitui a ordem de leitura de uma página PDF sem misturar linhas
 * de duas colunas. Recebe textContent.items do PDF.js e viewport.width.
 * O algoritmo é conservador: páginas sem evidência de colunas permanecem
 * na ordem vertical. Retorna sinalização para revisão de layout complexo.
 */
const texto = v => String(v || '').replace(/\s+/g, ' ').trim();

function linhas(items) {
  const sorted = [...items].sort((a, b) => (b.y - a.y) || (a.x - b.x));
  const grupos = [];
  for (const item of sorted) {
    let linha = grupos.find(g => Math.abs(g.y - item.y) <= 2.6);
    if (!linha) { linha = { y: item.y, itens: [] }; grupos.push(linha); }
    linha.itens.push(item);
  }
  return grupos.sort((a, b) => b.y - a.y).map(g =>
    g.itens.sort((a, b) => a.x - b.x).map(v => v.str).join(' ').replace(/\s+/g, ' ').trim()
  ).filter(Boolean).join('\n');
}

export function reconstituirTextoPagina(itens = [], larguraPagina = 595, alturaPagina = 842) {
  const lista = (itens || []).filter(i => texto(i.str)).map(item => ({
    x: Number(item.transform?.[4] || 0),
    y: Number(item.transform?.[5] || 0),
    w: Math.max(0, Number(item.width || 0)),
    str: texto(item.str),
  })).filter(i => Number.isFinite(i.x) && Number.isFinite(i.y));
  if (!lista.length) return { texto: '', colunas: 0, revisaoLayout: false };

  const largura = Number(larguraPagina) || 595;
  const meio = largura / 2;
  const folga = Math.max(6, largura * .012);

  const esquerdo = []; const direito = []; const centrais = [];
  for (const item of lista) {
    if (item.x + item.w < meio - folga) esquerdo.push(item);
    else if (item.x > meio + folga) direito.push(item);
    else centrais.push(item);
  }

  // Duas sequências na mesma altura, com um espaço livre na linha central,
  // indicam colunas independentes. Não separa páginas com texto corrido.
  const faixas = new Map();
  for (const [lado, dados] of [['L', esquerdo], ['R', direito]]) {
    for (const item of dados) {
      const faixa = Math.round(item.y / 4);
      if (!faixas.has(faixa)) faixas.set(faixa, { L: [], R: [] });
      faixas.get(faixa)[lado].push(item);
    }
  }
  let pares = 0;
  for (const faixa of faixas.values()) {
    if (!faixa.L.length || !faixa.R.length) continue;
    const fimL = Math.max(...faixa.L.map(i => i.x + i.w));
    const inicioR = Math.min(...faixa.R.map(i => i.x));
    if (fimL < meio - folga && inicioR > meio + folga && inicioR - fimL > largura * .035) pares++;
  }
  const caracteres = a => a.reduce((n, i) => n + i.str.length, 0);
  const lenL = caracteres(esquerdo); const lenR = caracteres(direito);
  const lenCentro = caracteres(centrais);
  const duasColunas = pares >= 5 && lenL >= 70 && lenR >= 70 &&
    lenCentro / Math.max(1, lenL + lenR + lenCentro) < .22;

  if (!duasColunas) {
    // O caso de uma coluna não pode ser lido percorrendo itens por x antes de y.
    return { texto: linhas(lista), colunas: 1, revisaoLayout: pares >= 3 };
  }

  const cabecalhos = [];
  let ambiguos = 0;
  for (const item of centrais) {
    // Cabeçalhos no topo que ocupam toda a largura, fora das duas colunas.
    if (item.y > alturaPagina * .86 && item.w > largura * .30) cabecalhos.push(item);
    else {
      ambiguos++;
      (item.x < meio ? esquerdo : direito).push(item);
    }
  }
  return {
    texto: [linhas(cabecalhos), linhas(esquerdo), linhas(direito)].filter(Boolean).join('\n\n'),
    colunas: 2,
    revisaoLayout: ambiguos > Math.max(3, lista.length * .05),
  };
}
