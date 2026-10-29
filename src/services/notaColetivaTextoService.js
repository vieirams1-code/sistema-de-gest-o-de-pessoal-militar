import { calcularPreviaAntiguidadeGeral } from '../utils/antiguidade/calcularPreviaAntiguidadeGeral.js';
import { abreviarPostoGraduacao } from '../components/folha-alteracoes/postoGraduacao.js';

export function comporTextoNotaColetiva(cabecalho, militares = [], historicoPromocoes = [], config = {}) {
  const resultado = calcularPreviaAntiguidadeGeral({ militares, historicoPromocoes, config: { ...config, incluirSomenteMilitaresAtivos: false } });
  const porId = new Map(militares.map(m => [String(m.id), m]));
  const ordenados = resultado.itens.map(item => porId.get(String(item.militar_id)));
  const lista = ordenados.map((m, i) => `(${i + 1}) ${[abreviarPostoGraduacao(m.posto_graduacao), m.quadro, m.nome_completo].filter(Boolean).join(' ')}, matrícula ${m.matricula || 'não informada'}`).join('; ');
  return { texto: [String(cabecalho || '').trim(), lista ? lista + '.' : ''].filter(Boolean).join('\n\n'), ids: ordenados.map(m => String(m.id)), pendencias: resultado.resumo.totalComPendencias };
}