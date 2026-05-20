import { nomeMilitar, postoGraduacaoBaseAnterior } from '../../services/promocaoService.js';
import {
  normalizarPostoGraduacao as normalizarPostoPreviaAntiguidade,
  normalizarQuadroPreviaAntiguidade,
} from '../antiguidade/calcularPreviaAntiguidadeGeral.js';

function compararDataAsc(a, b) {
  const da = new Date(String(a || '')).getTime();
  const db = new Date(String(b || '')).getTime();
  if (Number.isFinite(da) && Number.isFinite(db)) return da - db;
  if (Number.isFinite(da)) return -1;
  if (Number.isFinite(db)) return 1;
  return 0;
}

function compararNascimentoMaisVelhoPrimeiro(a, b) {
  return compararDataAsc(a?.militar?.data_nascimento, b?.militar?.data_nascimento);
}

export function ordenarPorAntiguidadeAnterior({ promocao, itensPromocao = [], historicoV2 = [], militares = [] }) {
  const postoBaseAnterior = postoGraduacaoBaseAnterior(promocao?.posto_graduacao);
  const postoBaseNormalizado = normalizarPostoPreviaAntiguidade(postoBaseAnterior);
  const quadroPromocaoNormalizado = normalizarQuadroPreviaAntiguidade(promocao?.quadro).valor;
  const dataPromocao = String(promocao?.data_promocao || '').split('T')[0];

  const militarPorId = new Map((militares || []).map((militar) => [String(militar?.id || ''), militar]));
  const historicoElegivel = (historicoV2 || []).filter((registro) => {
    if (String(registro?.status_registro || '').toLowerCase() !== 'ativo') return false;
    if (String(registro?.data_promocao || '').split('T')[0] > dataPromocao) return false;
    const postoNormalizado = normalizarPostoPreviaAntiguidade(registro?.posto_graduacao_novo);
    const quadroNormalizado = normalizarQuadroPreviaAntiguidade(registro?.quadro_novo).valor;
    return postoNormalizado === postoBaseNormalizado && quadroNormalizado === quadroPromocaoNormalizado;
  });

  const melhorBasePorMilitar = new Map();
  historicoElegivel.forEach((registro) => {
    const chave = String(registro?.militar_id || '');
    if (!chave) return;
    const atual = melhorBasePorMilitar.get(chave);
    if (!atual) return void melhorBasePorMilitar.set(chave, registro);
    const cmpData = compararDataAsc(atual?.data_promocao, registro?.data_promocao);
    if (cmpData < 0) return void melhorBasePorMilitar.set(chave, registro);
    if (cmpData > 0) return;
    const ordemAtual = Number(atual?.antiguidade_referencia_ordem ?? Number.POSITIVE_INFINITY);
    const ordemNovo = Number(registro?.antiguidade_referencia_ordem ?? Number.POSITIVE_INFINITY);
    if (ordemNovo < ordemAtual) melhorBasePorMilitar.set(chave, registro);
  });

  const semHistorico = [];
  const ordenados = [...itensPromocao].map((item) => {
    const militarId = String(item?.militar_id || item?.militar?.id || '');
    const militar = item?.militar || militarPorId.get(militarId) || null;
    const historicoBase = melhorBasePorMilitar.get(militarId) || null;
    if (!historicoBase) semHistorico.push(nomeMilitar(militar || {}));
    return { ...item, militar, _historicoBase: historicoBase };
  }).sort((a, b) => {
    const histA = a._historicoBase;
    const histB = b._historicoBase;
    if (histA && histB) {
      const byData = compararDataAsc(histA?.data_promocao, histB?.data_promocao);
      if (byData !== 0) return byData;
      const ordemA = Number(histA?.antiguidade_referencia_ordem ?? Number.POSITIVE_INFINITY);
      const ordemB = Number(histB?.antiguidade_referencia_ordem ?? Number.POSITIVE_INFINITY);
      if (ordemA !== ordemB) return ordemA - ordemB;
      const byNascimento = compararNascimentoMaisVelhoPrimeiro(a, b);
      if (byNascimento !== 0) return byNascimento;
      return String(a?.militar?.matricula || a?.militar_id || a?.id || '').localeCompare(String(b?.militar?.matricula || b?.militar_id || b?.id || ''));
    }
    if (histA) return -1;
    if (histB) return 1;
    return String(a?.militar?.matricula || a?.militar_id || a?.id || '').localeCompare(String(b?.militar?.matricula || b?.militar_id || b?.id || ''));
  }).map((item, index) => ({ ...item, ordem: index + 1 }));

  return {
    base: { posto: postoBaseAnterior, quadro: promocao?.quadro || '' },
    totalEncontrados: ordenados.length - semHistorico.length,
    totalSemHistorico: semHistorico.length,
    semHistorico,
    ordenados,
  };
}

export function isPromocaoHistorica(promocao) {
  const data = String(promocao?.data_promocao || '').split('T')[0];
  const hoje = new Date().toISOString().split('T')[0];
  return Boolean(data) && data < hoje;
}
