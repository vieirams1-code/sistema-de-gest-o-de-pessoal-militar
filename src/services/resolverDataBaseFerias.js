import {
  compareDateOnly,
  normalizeDateOnly,
} from './dateOnlyService.js';
import {
  normalizarStatusContratoDesignacao,
  STATUS_CONTRATO_DESIGNACAO,
} from './contratosDesignacaoMilitarService.js';

export const CODIGOS_BLOQUEIO_DATA_BASE_FERIAS = Object.freeze({
  MILITAR_SEM_DATA_INCLUSAO: 'MILITAR_SEM_DATA_INCLUSAO',
  CONTRATO_ATIVO_SEM_DATA_BASE: 'CONTRATO_ATIVO_SEM_DATA_BASE',
  CONTRATO_ATIVO_DUPLICADO: 'CONTRATO_ATIVO_DUPLICADO',
  DATA_BASE_FERIAS_INVALIDA: 'DATA_BASE_FERIAS_INVALIDA',
  DATA_BASE_CONTRATO_ANTERIOR_INICIO_CONTRATO: 'DATA_BASE_CONTRATO_ANTERIOR_INICIO_CONTRATO',
  CONTRATO_ATIVO_NAO_GERA_FERIAS: 'CONTRATO_ATIVO_NAO_GERA_FERIAS',
  CONTRATO_ATIVO_GERACAO_BLOQUEADA: 'CONTRATO_ATIVO_GERACAO_BLOQUEADA',
});

export const ORIGENS_DATA_BASE_FERIAS = Object.freeze({
  MILITAR_DATA_INCLUSAO: 'militar_data_inclusao',
  CONTRATO_DESIGNACAO: 'contrato_designacao',
});

const DEFAULT_OPTIONS = Object.freeze({
  bloquearDataContratoAnteriorAoInicio: true,
  validarDatas: true,
});

function criarRetorno({
  dataBase = null,
  origem = null,
  contratoId = null,
  bloqueado = false,
  codigoBloqueio = null,
  mensagem = '',
  warnings = [],
} = {}) {
  return {
    dataBase,
    origem,
    contratoId,
    bloqueado,
    codigoBloqueio,
    mensagem,
    warnings,
  };
}

function getRegistroId(registro) {
  return registro?.id ?? registro?._id ?? null;
}

function getMilitarId(militar) {
  return militar?.id ?? militar?._id ?? militar?.militar_id ?? null;
}

function isContratoDeOutroMilitar(contrato, militarId) {
  if (!militarId || !contrato?.militar_id) return false;
  return String(contrato.militar_id) !== String(militarId);
}

function validarElegibilidadeContrato(contratoAtivo, warnings) {
  if (contratoAtivo?.gera_direito_ferias === false) {
    return {
      bloqueado: true,
      payload: criarRetorno({
        bloqueado: true,
        codigoBloqueio: CODIGOS_BLOQUEIO_DATA_BASE_FERIAS.CONTRATO_ATIVO_NAO_GERA_FERIAS,
        mensagem: 'Contrato de designação ativo configurado para não gerar direito a férias.',
        warnings,
      }),
    };
  }

  if (String(contratoAtivo?.regra_geracao_periodos || '').trim().toLowerCase() === 'bloqueada') {
    return {
      bloqueado: true,
      payload: criarRetorno({
        bloqueado: true,
        codigoBloqueio: CODIGOS_BLOQUEIO_DATA_BASE_FERIAS.CONTRATO_ATIVO_GERACAO_BLOQUEADA,
        mensagem: 'Contrato de designação ativo está com regra de geração de períodos bloqueada.',
        warnings,
      }),
    };
  }

  return { bloqueado: false };
}

function validarConsistenciaDataBaseContrato(
  dataBase,
  contratoAtivo,
  { validarDatas, bloquearDataContratoAnteriorAoInicio, warnings },
) {
  if (!validarDatas || !contratoAtivo?.data_inicio_contrato) {
    return { bloqueado: false };
  }

  const dataInicioContrato = normalizeDateOnly(contratoAtivo.data_inicio_contrato);
  if (!dataInicioContrato) {
    return {
      bloqueado: true,
      payload: criarRetorno({
        bloqueado: true,
        codigoBloqueio: CODIGOS_BLOQUEIO_DATA_BASE_FERIAS.DATA_BASE_FERIAS_INVALIDA,
        mensagem: 'Data de início do contrato de designação inválida para validar a data-base de férias.',
        warnings,
      }),
    };
  }

  if (compareDateOnly(dataBase, dataInicioContrato) === -1) {
    if (bloquearDataContratoAnteriorAoInicio) {
      return {
        bloqueado: true,
        payload: criarRetorno({
          bloqueado: true,
          codigoBloqueio: CODIGOS_BLOQUEIO_DATA_BASE_FERIAS.DATA_BASE_CONTRATO_ANTERIOR_INICIO_CONTRATO,
          mensagem: 'Data-base de férias do contrato é anterior à data de início do contrato.',
          warnings,
        }),
      };
    }

    warnings.push('DATA_BASE_CONTRATO_ANTERIOR_INICIO_CONTRATO');
  }

  return { bloqueado: false };
}

function filtrarContratosAtivosDoMilitar(contratosDesignacao, militarId, warnings) {
  const contratos = Array.isArray(contratosDesignacao) ? contratosDesignacao : [];
  return contratos.filter((contrato) => {
    if (isContratoDeOutroMilitar(contrato, militarId)) {
      warnings.push(`CONTRATO_DE_OUTRO_MILITAR_IGNORADO:${getRegistroId(contrato) || 'sem_id'}`);
      return false;
    }

    return normalizarStatusContratoDesignacao(contrato?.status_contrato) === STATUS_CONTRATO_DESIGNACAO.ATIVO;
  });
}

function verificarDuplicidadeContratosAtivos(contratosAtivos, warnings) {
  if (contratosAtivos.length > 1) {
    return {
      bloqueado: true,
      payload: criarRetorno({
        bloqueado: true,
        codigoBloqueio: CODIGOS_BLOQUEIO_DATA_BASE_FERIAS.CONTRATO_ATIVO_DUPLICADO,
        mensagem: 'Há mais de um contrato de designação ativo para o militar.',
        warnings,
      }),
    };
  }

  return { bloqueado: false };
}

function resolverPeloContrato(contratoAtivo, { validarDatas, bloquearDataContratoAnteriorAoInicio, warnings }) {
  const contratoId = getRegistroId(contratoAtivo);

  const elegibilidade = validarElegibilidadeContrato(contratoAtivo, warnings);
  if (elegibilidade.bloqueado) return elegibilidade.payload;

  if (!contratoAtivo?.data_inclusao_para_ferias) {
    return criarRetorno({
      bloqueado: true,
      codigoBloqueio: CODIGOS_BLOQUEIO_DATA_BASE_FERIAS.CONTRATO_ATIVO_SEM_DATA_BASE,
      mensagem: 'Contrato de designação ativo sem data de inclusão para férias.',
      warnings,
    });
  }

  const resultadoContrato = normalizarDataBaseOuBloquear({
    dataBase: contratoAtivo.data_inclusao_para_ferias,
    origem: ORIGENS_DATA_BASE_FERIAS.CONTRATO_DESIGNACAO,
    contratoId,
    campoLabel: 'Data de inclusão para férias do contrato de designação',
    warnings,
    validarDatas,
  });

  if (resultadoContrato.bloqueado) return resultadoContrato;

  const consistencia = validarConsistenciaDataBaseContrato(resultadoContrato.dataBase, contratoAtivo, {
    validarDatas,
    bloquearDataContratoAnteriorAoInicio,
    warnings,
  });

  if (consistencia.bloqueado) return consistencia.payload;

  return resultadoContrato;
}

function resolverPeloMilitar(militar, { validarDatas, warnings }) {
  if (!militar?.data_inclusao) {
    return criarRetorno({
      bloqueado: true,
      codigoBloqueio: CODIGOS_BLOQUEIO_DATA_BASE_FERIAS.MILITAR_SEM_DATA_INCLUSAO,
      mensagem: 'Militar sem data de inclusão para resolver a data-base de férias.',
      warnings,
    });
  }

  return normalizarDataBaseOuBloquear({
    dataBase: militar.data_inclusao,
    origem: ORIGENS_DATA_BASE_FERIAS.MILITAR_DATA_INCLUSAO,
    contratoId: null,
    campoLabel: 'Data de inclusão do militar',
    warnings,
    validarDatas,
  });
}

function normalizarDataBaseOuBloquear({ dataBase, origem, contratoId, campoLabel, warnings, validarDatas }) {
  if (!validarDatas) {
    return criarRetorno({
      dataBase: dataBase || null,
      origem,
      contratoId,
      mensagem: 'Data-base de férias resolvida sem validação estrita de data civil.',
      warnings,
    });
  }

  const dataBaseNormalizada = normalizeDateOnly(dataBase);
  if (!dataBaseNormalizada) {
    return criarRetorno({
      bloqueado: true,
      codigoBloqueio: CODIGOS_BLOQUEIO_DATA_BASE_FERIAS.DATA_BASE_FERIAS_INVALIDA,
      mensagem: `${campoLabel} inválida para cálculo da data-base de férias.`,
      warnings,
    });
  }

  return criarRetorno({
    dataBase: dataBaseNormalizada,
    origem,
    contratoId,
    mensagem: 'Data-base de férias resolvida com sucesso.',
    warnings,
  });
}

export function resolverDataBaseFerias({ militar, contratosDesignacao = [], options = {} } = {}) {
  const resolvedOptions = { ...DEFAULT_OPTIONS, ...(options || {}) };
  const warnings = [];
  const militarId = getMilitarId(militar);

  const contratosAtivos = filtrarContratosAtivosDoMilitar(contratosDesignacao, militarId, warnings);

  const duplicidade = verificarDuplicidadeContratosAtivos(contratosAtivos, warnings);
  if (duplicidade.bloqueado) return duplicidade.payload;

  if (contratosAtivos.length === 1) {
    return resolverPeloContrato(contratosAtivos[0], {
      validarDatas: resolvedOptions.validarDatas,
      bloquearDataContratoAnteriorAoInicio: resolvedOptions.bloquearDataContratoAnteriorAoInicio,
      warnings,
    });
  }

  return resolverPeloMilitar(militar, {
    validarDatas: resolvedOptions.validarDatas,
    warnings,
  });
}
