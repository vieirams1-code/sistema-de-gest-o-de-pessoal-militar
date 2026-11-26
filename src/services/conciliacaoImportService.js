import { criarEscopado } from '@/services/cudEscopadoClient';
import { normalizarBuscaBoletim, normalizarNotaBoletim } from '@/utils/boletim/normalizacaoBoletim';
import { criarEventoAuditoriaPublicacao, EVENTO_AUDITORIA_PUBLICACAO } from '@/components/publicacao/publicacaoStateMachine';

/**
 * Regras únicas de importação de notas conciliadas (BG/BGR e DOEMS).
 * Toda gravação passa por cudEscopado, que valida permissão e escopo.
 */

export const TIPOS_IMPORTACAO = [
  { value: 'Geral', label: 'Geral', entidade: 'PublicacaoExOfficio' },
  { value: 'Elogio Individual', label: 'Elogio Individual', entidade: 'PublicacaoExOfficio' },
  { value: 'Transcrição de Documentos', label: 'Transcrição de Documentos', entidade: 'PublicacaoExOfficio' },
  { value: 'Designação de Função', label: 'Designação de Função', entidade: 'PublicacaoExOfficio' },
  { value: 'Dispensa de Função', label: 'Dispensa de Função', entidade: 'PublicacaoExOfficio' },
  { value: 'Melhoria de Comportamento', label: 'Melhoria de Comportamento', entidade: 'PublicacaoExOfficio' },
  { value: 'Punição', label: 'Punição (revisar dados específicos)', entidade: 'PublicacaoExOfficio' },
  { value: 'Curso/Estágio', label: 'Curso/Estágio', entidade: 'RegistroLivro' },
  { value: 'Dispensa Recompensa', label: 'Dispensa como Recompensa', entidade: 'RegistroLivro' },
  { value: 'Saída Férias', label: 'Saída de Férias', entidade: 'RegistroLivro' },
  { value: 'Retorno Férias', label: 'Retorno de Férias', entidade: 'RegistroLivro' },
  { value: 'Interrupção de Férias', label: 'Interrupção de Férias', entidade: 'RegistroLivro' },
  { value: 'Licença Maternidade', label: 'Licença Maternidade', entidade: 'RegistroLivro' },
  { value: 'Licença Paternidade', label: 'Licença Paternidade', entidade: 'RegistroLivro' },
  { value: 'Núpcias', label: 'Núpcias', entidade: 'RegistroLivro' },
  { value: 'Luto', label: 'Luto', entidade: 'RegistroLivro' },
  { value: 'Trânsito', label: 'Trânsito', entidade: 'RegistroLivro' },
  { value: 'Instalação', label: 'Instalação', entidade: 'RegistroLivro' },
  { value: 'Deslocamento Missão', label: 'Deslocamento para Missão', entidade: 'RegistroLivro' },
  { value: 'Outro', label: 'Outro (Livro)', entidade: 'RegistroLivro' },
];

export function rotuloMilitar(militar) {
  if (!militar) return '';
  return [militar.posto_graduacao, militar.nome_completo || militar.nome_guerra,
    militar.matricula ? 'Mat. ' + militar.matricula : ''].filter(Boolean).join(' · ');
}

export function chaveRegistro(registro) {
  return registro.__entidade + ':' + registro.id;
}

export function filtrarMilitaresPorBusca(militares = [], termo = '', limite = 40) {
  const busca = normalizarBuscaBoletim(termo);
  if (!busca) return militares.slice(0, limite);
  return militares.filter(m => normalizarBuscaBoletim(rotuloMilitar(m)).includes(busca)).slice(0, limite + 20);
}

function assinaturaTexto(valor = '') {
  return normalizarBuscaBoletim(valor).slice(0, 400);
}

/** Já existe RP do mesmo militar para a mesma nota neste BG/BGR? */
export function encontrarDuplicidadeBoletim({ registros = [], militarId, nota, numeroBg, dataBoletim }) {
  const numeroNota = normalizarNotaBoletim(nota);
  if (!numeroNota) return false;
  return registros.some(registro => {
    const participantes = registro.coletiva ? registro.militares_ids || [] : [registro.militar_id];
    if (!participantes.map(String).includes(String(militarId))) return false;
    if (normalizarNotaBoletim(registro.nota_para_bg || registro.nota_conciliada_boletim) !== numeroNota) return false;
    const mesmoNumero = !registro.numero_bg
      || String(registro.numero_bg).replace(/^0+/, '') === String(numeroBg || '').replace(/^0+/, '');
    const mesmaData = !registro.data_bg
      || String(registro.data_bg).slice(0, 10) === String(dataBoletim || '');
    return mesmoNumero && mesmaData;
  });
}

/** Já existe RP do mesmo militar para este trecho deste DOEMS? */
export function encontrarDuplicidadeDoems({ registros = [], militarId, edicao, dataPublicacao, texto }) {
  const alvo = assinaturaTexto(texto);
  if (!alvo) return false;
  return registros.some(registro => {
    if (String(registro.militar_id) !== String(militarId)) return false;
    if (String(registro.doems_edicao_numero || '').trim() !== String(edicao || '').trim()) return false;
    if (String(registro.data_publicacao || '').slice(0, 10) !== String(dataPublicacao || '').slice(0, 10)) return false;
    return assinaturaTexto(registro.texto_publicacao || registro.texto || '') === alvo;
  });
}

export async function importarNotaConciliacao({
  militar,
  tipo,
  texto,
  nota = '',
  pagina = '',
  origem = 'conciliacao_manual',
  numeroBg = '',
  dataBoletim = '',
  doemsEdicao = '',
  doemsData = '',
  observacao = '',
  user,
}) {
  if (!militar?.id || !tipo?.value || !String(texto || '').trim()) {
    throw new Error('Confirme militar, tipo e texto para registrar a nota.');
  }

  const base = {
    militar_id: militar.id,
    militar_nome: militar.nome_completo || militar.nome_guerra || '',
    militar_posto: militar.posto_graduacao || '',
    militar_matricula: militar.matricula || '',
    status: 'Publicado',
    texto_publicacao: String(texto).trim(),
    criado_por_email: user?.email || '',
    observacoes: observacao,
  };
  if (nota) {
    base.nota_para_bg = nota;
    base.nota_conciliada_boletim = nota;
  }
  if (numeroBg) base.numero_bg = numeroBg;
  if (dataBoletim) base.data_bg = dataBoletim;
  if (doemsEdicao) base.doems_edicao_numero = doemsEdicao;

  const registro = tipo.entidade === 'RegistroLivro'
    ? {
      ...base,
      tipo_registro: tipo.value,
      data_registro: doemsData || dataBoletim,
      origem: doemsEdicao ? 'Conciliação DOEMS' : 'Auditoria BG',
    }
    : {
      ...base,
      tipo: tipo.value,
      data_publicacao: doemsData || dataBoletim,
    };

  registro.historico_publicacao = [criarEventoAuditoriaPublicacao({
    registro: { ...registro, origem_tipo: tipo.entidade === 'RegistroLivro' ? 'livro' : 'ex-officio' },
    evento: EVENTO_AUDITORIA_PUBLICACAO.CRIACAO,
    usuario: user,
    resumo: doemsEdicao
      ? 'Importação de trecho do Diário Oficial após revisão e confirmação manual.'
      : 'Importação de nota de boletim após revisão e confirmação manual.',
    estadoNovo: 'Publicado',
    metadata: {
      origem,
      nota,
      pagina,
      numero_bg: numeroBg,
      data_bg: dataBoletim,
      doems_edicao: doemsEdicao,
    },
  })];

  return criarEscopado(tipo.entidade, registro);
}