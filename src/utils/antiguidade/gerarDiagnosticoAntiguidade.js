import validarDadosAntiguidade, { MOTIVOS } from './validarDadosAntiguidade';
import calcularAntiguidadeMilitar from './calcularAntiguidadeMilitar';

const chaveGrupo = (m) => [m?.posto_graduacao || '', m?.quadro || '', m?.data_promocao_atual || ''].join('::');

export default function gerarDiagnosticoAntiguidade(militares = [], historicos = [], config = {}) {
  const ativos = (militares || []).filter((m) => (m?.status_cadastro || 'Ativo') === 'Ativo');
  const grupos = new Map();
  for (const m of ativos) {
    const key = chaveGrupo(m);
    if (!grupos.has(key)) grupos.set(key, []);
    grupos.get(key).push(m);
  }

  const pendentesPorMotivo = {};
  const porPosto = {};
  const porQuadro = {};
  const porLotacao = {};
  const pendentesDetalhes = [];

  let comPostoGraduacao = 0;
  let comQuadro = 0;
  let comDataPromocao = 0;
  let comAntiguidadeAnterior = 0;
  let aptos = 0;

  for (const grupo of grupos.values()) {
    const ordenados = [...grupo].sort((a, b) => calcularAntiguidadeMilitar(a, b, config));
    const empateNoGrupo = ordenados.length > 1 && ordenados.every((item, idx) => idx === 0 || calcularAntiguidadeMilitar(ordenados[0], item, config) === 0);

    for (const militar of grupo) {
      if (militar?.posto_graduacao) comPostoGraduacao += 1;
      if (militar?.quadro) comQuadro += 1;

      const exigeAntiguidadeAnterior = grupo.length > 1 && Boolean(militar?.data_promocao_atual);
      const validacao = validarDadosAntiguidade(militar, historicos, {
        exigeAntiguidadeAnterior,
        empateNaoResolvido: empateNoGrupo,
      });

      if (validacao.dataPromocaoAtual) comDataPromocao += 1;
      if (validacao.antiguidadeReferenciaOrdem != null) comAntiguidadeAnterior += 1;

      if (validacao.status === 'ok') {
        aptos += 1;
      } else {
        pendentesDetalhes.push({ militar, motivos: validacao.motivos });
        validacao.motivos.forEach((motivo) => {
          pendentesPorMotivo[motivo] = (pendentesPorMotivo[motivo] || 0) + 1;
        });

        const posto = militar?.posto_graduacao || 'SEM_POSTO';
        const quadro = militar?.quadro || 'SEM_QUADRO';
        const lotacao = militar?.lotacao || 'SEM_LOTACAO';
        porPosto[posto] = (porPosto[posto] || 0) + 1;
        porQuadro[quadro] = (porQuadro[quadro] || 0) + 1;
        porLotacao[lotacao] = (porLotacao[lotacao] || 0) + 1;
      }
    }
  }

  return {
    totalAtivos: ativos.length,
    comPostoGraduacao,
    comQuadro,
    comDataPromocao,
    comAntiguidadeAnterior,
    aptos,
    pendentes: ativos.length - aptos,
    pendentesPorMotivo,
    porPosto,
    porQuadro,
    porLotacao,
    pendentesDetalhes,
    motivosSuportados: Object.values(MOTIVOS),
  };
}
