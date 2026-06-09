let runtimeClient = null;

export function __setMilitarIdentidadeClientForTests(client) {
  runtimeClient = client || null;
}

async function ensureClient() {
  if (runtimeClient) return runtimeClient;
  const mod = await import('../api/base44Client.js');
  runtimeClient = mod.base44;
  return runtimeClient;
}

const ERROS = {
  MATRICULA_OBRIGATORIA: 'Matrícula obrigatória para cadastro.',
  MATRICULA_DUPLICADA: 'Matrícula já cadastrada.',
  POSSIVEL_DUPLICIDADE: 'Possível duplicidade identificada. Revise antes de criar novo cadastro.',
  TROCA_MATRICULA_BLOQUEADA: 'Troca de matrícula não permitida por edição direta. Use o fluxo de adicionar nova matrícula.',
  CONCORRENCIA: 'Conflito por concorrência. Atualize a tela e tente novamente.',
  AUTO_MERGE_BLOQUEADO: 'Não é permitido mesclar o mesmo militar nele próprio.',
};

export const STATUS_POSSIVEL_DUPLICIDADE = {
  PENDENTE: 'PENDENTE',
  CONFIRMADO_DUPLICADO: 'CONFIRMADO_DUPLICADO',
  DESCARTADO: 'DESCARTADO',
  MESCLADO: 'MESCLADO',
};

const ENTIDADES_VINCULOS_MILITAR_ID = [
  'HistoricoComportamento',
  'PendenciaComportamento',
  'PunicaoDisciplinar',
];

const onlyDigits = (value = '') => String(value || '').replace(/\D/g, '');

export function normalizarMatricula(value = '') {
  const digits = onlyDigits(value).slice(0, 9);
  return digits;
}

export function formatarMatriculaPadrao(value = '') {
  const digits = normalizarMatricula(value);
  if (!digits) return '';
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function normalizarCPF(value = '') {
  const digits = onlyDigits(value);
  return digits.length === 11 ? digits : '';
}

export function normalizarNomeCanonico(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

async function getEntity(nome) {
  const client = await ensureClient();
  return client?.entities?.[nome] || null;
}

async function listarMilitares(criterios = null) {
  const entity = await getEntity('Militar');
  if (!entity) return [];
  if (criterios && entity.filter) return entity.filter(criterios);
  if (!entity?.list) return [];
  return entity.list();
}

async function listarMatriculas(criterios = null) {
  const entity = await getEntity('MatriculaMilitar');
  if (!entity) return [];
  if (criterios && entity.filter) return entity.filter(criterios);
  if (!entity?.list) return [];
  return entity.list();
}

function mapErroPersistencia(error) {
  const msg = String(error?.message || '').toLowerCase();
  if (msg.includes('unique') || msg.includes('duplicate')) {
    if (msg.includes('matricula')) return new Error(ERROS.MATRICULA_DUPLICADA);
    return new Error(ERROS.CONCORRENCIA);
  }
  return error;
}

function buildSnapshotMilitar(militar = null) {
  if (!militar) return null;
  return {
    id: militar.id,
    nome_completo: militar.nome_completo || '',
    nome_canonico: militar.nome_canonico || '',
    matricula: militar.matricula || '',
    cpf: militar.cpf || '',
    data_nascimento: militar.data_nascimento || '',
    status_cadastro: militar.status_cadastro || '',
    merged_into_id: militar.merged_into_id || '',
  };
}

async function localizarMilitarPorMatricula(matricula, excludeMilitarId = '') {
  const matriculaNorm = normalizarMatricula(matricula);
  if (!matriculaNorm) return null;

  const [matriculaEntity, militarEntity] = await Promise.all([
    getEntity('MatriculaMilitar'),
    getEntity('Militar'),
  ]);

  const excludeId = String(excludeMilitarId || '');

  // Fast path: use server-side filter if available to avoid O(N) full list fetch
  if (matriculaEntity?.filter) {
    const [mat] = await matriculaEntity.filter({ matricula_normalizada: matriculaNorm });
    if (mat && String(mat.militar_id) !== excludeId) {
      const [militar] = await (militarEntity?.filter?.({ id: mat.militar_id }) || Promise.resolve([]));
      if (militar) return militar;
    }
  }

  if (militarEntity?.filter) {
    const [militar] = await militarEntity.filter({ matricula: formatarMatriculaPadrao(matriculaNorm) });
    if (militar && String(militar.id) !== excludeId) return militar;
  }

  // Fallback to in-memory search over full lists (O(N)) if filter is unavailable or data is legacy
  const [matriculas, militares] = await Promise.all([
    listarMatriculas({ matricula_normalizada: matriculaNorm }),
    listarMilitares({ matricula: formatarMatriculaPadrao(matriculaNorm) }),
  ]);

  const mat = (matriculas || []).find((m) => (
    normalizarMatricula(m?.matricula_normalizada || m?.matricula) === matriculaNorm
    && String(m?.militar_id || '') !== excludeId
  ));

  if (mat?.militar_id) {
    const [militar] = await (militarEntity?.filter?.({ id: mat.militar_id }) || Promise.resolve([]));
    if (militar) return militar;
  }

  return (militares || []).find((m) => (
    normalizarMatricula(m?.matricula) === matriculaNorm
    && String(m?.id || '') !== excludeId
  )) || null;
}

export async function registrarPossivelDuplicidade({
  militarExistenteId = '',
  militarCandidatoId = '',
  payloadNovoCadastro = null,
  snapshotComparativo = null,
  motivo = ERROS.POSSIVEL_DUPLICIDADE,
  nivelConfianca = 0.9,
  criadoPor = '',
  origemFluxo = 'manual',
} = {}) {
  const entity = await getEntity('PossivelDuplicidadeMilitar');
  if (!entity?.create) {
    console.warn('[PossivelDuplicidadeMilitar] Entidade indisponível no runtime. Pendência não persistida.');
    return null;
  }

  const payload = {
    militar_existente_id: militarExistenteId || '',
    militar_candidato_id: militarCandidatoId || '',
    payload_novo_cadastro: payloadNovoCadastro ? JSON.stringify(payloadNovoCadastro) : '',
    snapshot_comparativo: snapshotComparativo ? JSON.stringify(snapshotComparativo) : '',
    motivo,
    nivel_confianca: Number.isFinite(Number(nivelConfianca)) ? Number(nivelConfianca) : 0,
    status: STATUS_POSSIVEL_DUPLICIDADE.PENDENTE,
    criado_por: criadoPor || '',
    resolvido_por: '',
    created_at: new Date().toISOString(),
    resolved_at: '',
    origem_fluxo: origemFluxo,
  };

  return entity.create(payload);
}

export async function listarPendenciasPossivelDuplicidade({ status = STATUS_POSSIVEL_DUPLICIDADE.PENDENTE } = {}) {
  const entity = await getEntity('PossivelDuplicidadeMilitar');
  if (!entity?.list) return [];

  const itens = await entity.list('-created_date');
  if (!status) return itens;
  return (itens || []).filter((item) => String(item?.status || '').toUpperCase() === String(status).toUpperCase());
}

export async function resolverPendenciaPossivelDuplicidade({ pendenciaId, status, resolvidoPor = '' }) {
  const entity = await getEntity('PossivelDuplicidadeMilitar');
  if (!entity?.update) throw new Error('Entidade PossivelDuplicidadeMilitar indisponível.');
  return entity.update(pendenciaId, {
    status,
    resolvido_por: resolvidoPor || '',
    resolved_at: new Date().toISOString(),
  });
}

export async function localizarDuplicidadeForte({ cpf, nomeCanonico, dataNascimento, excludeMilitarId = '' }) {
  const cpfNorm = normalizarCPF(cpf);
  const nomeNorm = normalizarNomeCanonico(nomeCanonico);
  const dataNorm = String(dataNascimento || '').trim();
  const excludeId = String(excludeMilitarId || '');

  const entity = await getEntity('Militar');
  if (entity?.filter) {
    const filters = [];
    if (cpfNorm) filters.push(entity.filter({ cpf: cpfNorm }));
    if (nomeNorm && dataNorm) {
      filters.push(entity.filter({ nome_canonico: nomeNorm, data_nascimento: dataNorm }));
    }

    const results = await Promise.all(filters);
    for (const list of results) {
      const found = (list || []).find((m) => m && String(m.id) !== excludeId);
      if (found) return found;
    }
  }

  const militares = await listarMilitares();
  return (militares || []).find((militar) => {
    if (!militar?.id || String(militar.id) === excludeId) return false;

    const cpfMatch = cpfNorm && normalizarCPF(militar.cpf) && normalizarCPF(militar.cpf) === cpfNorm;
    const nomeDataMatch = nomeNorm
      && dataNorm
      && normalizarNomeCanonico(militar.nome_completo || militar.nome_canonico) === nomeNorm
      && String(militar.data_nascimento || '').trim() === dataNorm;

    return Boolean(cpfMatch || nomeDataMatch);
  }) || null;
}

export async function validarMatriculaDisponivel(matricula, excludeMilitarId = '') {
  const matriculaNorm = normalizarMatricula(matricula);
  if (!matriculaNorm) throw new Error(ERROS.MATRICULA_OBRIGATORIA);

  const militar = await localizarMilitarPorMatricula(matricula, excludeMilitarId);
  if (militar) {
    throw new Error(ERROS.MATRICULA_DUPLICADA);
  }

  return matriculaNorm;
}

function prepararPayloadMilitar(payload = {}) {
  const nomeCanonico = normalizarNomeCanonico(payload.nome_completo || payload.nome_canonico || '');
  const cpfNormalizado = normalizarCPF(payload.cpf);

  return {
    ...payload,
    matricula: formatarMatriculaPadrao(payload.matricula),
    nome_canonico: nomeCanonico,
    cpf: cpfNormalizado || payload.cpf || '',
    merged_into_id: payload.merged_into_id || '',
  };
}

async function validarConflitosCriacaoMilitar(payload, { origemRegistro, criadoPor }) {
  const matriculaConflito = await localizarMilitarPorMatricula(payload.matricula);
  if (matriculaConflito) {
    await registrarPossivelDuplicidade({
      militarExistenteId: matriculaConflito.id,
      payloadNovoCadastro: payload,
      snapshotComparativo: {
        militar_existente: buildSnapshotMilitar(matriculaConflito),
        payload_novo_cadastro: payload,
      },
      motivo: 'Matrícula já cadastrada durante tentativa de criação.',
      nivelConfianca: 1,
      criadoPor,
      origemFluxo: origemRegistro,
    });
    throw new Error(`${ERROS.MATRICULA_DUPLICADA} Pendência enviada para revisão humana.`);
  }

  const matriculaNorm = await validarMatriculaDisponivel(payload.matricula);
  const nomeCanonico = normalizarNomeCanonico(payload.nome_completo || payload.nome_canonico);
  const duplicidadeForte = await localizarDuplicidadeForte({
    cpf: payload.cpf,
    nomeCanonico,
    dataNascimento: payload.data_nascimento,
  });

  if (duplicidadeForte) {
    const pendencia = await registrarPossivelDuplicidade({
      militarExistenteId: duplicidadeForte.id,
      payloadNovoCadastro: payload,
      snapshotComparativo: {
        militar_existente: buildSnapshotMilitar(duplicidadeForte),
        payload_novo_cadastro: payload,
      },
      motivo: 'Possível duplicidade por CPF e/ou nome + data de nascimento.',
      nivelConfianca: 0.95,
      criadoPor,
      origemFluxo: origemRegistro,
    });

    throw new Error(`${ERROS.POSSIVEL_DUPLICIDADE} Pendência #${pendencia?.id || 'N/D'} criada para revisão. Militar relacionado: ${duplicidadeForte.nome_completo || duplicidadeForte.id}.`);
  }

  return { matriculaNorm };
}

async function executarCriacaoMilitarComMatricula(militarEntity, matriculaEntity, payload, matriculaNorm, origemRegistro) {
  const militarPayload = prepararPayloadMilitar(payload);
  try {
    const militarCriado = await militarEntity.create(militarPayload);

    if (matriculaEntity?.create) {
      await matriculaEntity.create({
        militar_id: militarCriado.id,
        matricula: formatarMatriculaPadrao(matriculaNorm),
        matricula_normalizada: matriculaNorm,
        tipo_matricula: 'Principal',
        situacao: 'Ativa',
        is_atual: true,
        data_inicio: new Date().toISOString().slice(0, 10),
        data_fim: '',
        motivo: 'Cadastro inicial',
        origem_registro: origemRegistro,
      });
    }

    return militarCriado;
  } catch (error) {
    throw mapErroPersistencia(error);
  }
}

export async function criarMilitarComMatricula(payload = {}, { origemRegistro = 'manual', criadoPor = '' } = {}) {
  const militarEntity = await getEntity('Militar');
  const matriculaEntity = await getEntity('MatriculaMilitar');

  if (!militarEntity?.create) throw new Error('Entidade Militar indisponível.');

  const { matriculaNorm } = await validarConflitosCriacaoMilitar(payload, { origemRegistro, criadoPor });

  return executarCriacaoMilitarComMatricula(militarEntity, matriculaEntity, payload, matriculaNorm, origemRegistro);
}

async function validarDuplicidadeForteEdicao(militarId, atual, payload, resolvidoPor) {
  const duplicidadeForte = await localizarDuplicidadeForte({
    cpf: payload.cpf || atual.cpf,
    nomeCanonico: payload.nome_completo || atual.nome_completo,
    dataNascimento: payload.data_nascimento || atual.data_nascimento,
    excludeMilitarId: militarId,
  });

  if (duplicidadeForte) {
    await registrarPossivelDuplicidade({
      militarExistenteId: duplicidadeForte.id,
      militarCandidatoId: militarId,
      payloadNovoCadastro: { ...atual, ...payload },
      snapshotComparativo: {
        militar_existente: buildSnapshotMilitar(duplicidadeForte),
        militar_candidato: buildSnapshotMilitar(atual),
      },
      motivo: 'Possível duplicidade identificada durante atualização de cadastro.',
      nivelConfianca: 0.95,
      criadoPor: resolvidoPor,
      origemFluxo: 'edicao_manual',
    });
    throw new Error(ERROS.POSSIVEL_DUPLICIDADE);
  }
}

export async function atualizarMilitarSemTrocarMatricula(militarId, payload = {}, { resolvidoPor = '' } = {}) {
  const militarEntity = await getEntity('Militar');
  if (!militarEntity?.update || !militarEntity?.filter) throw new Error('Entidade Militar indisponível.');

  const [atual] = await militarEntity.filter({ id: militarId });
  if (!atual) throw new Error('Militar não encontrado para atualização.');

  const matriculaAtual = normalizarMatricula(atual.matricula);
  const matriculaNova = normalizarMatricula(payload.matricula || atual.matricula);

  if (matriculaAtual && matriculaNova && matriculaAtual !== matriculaNova) {
    throw new Error(ERROS.TROCA_MATRICULA_BLOQUEADA);
  }

  await validarMatriculaDisponivel(matriculaNova || matriculaAtual, militarId);

  await validarDuplicidadeForteEdicao(militarId, atual, payload, resolvidoPor);

  try {
    return await militarEntity.update(militarId, prepararPayloadMilitar({ ...atual, ...payload, matricula: atual.matricula }));
  } catch (error) {
    throw mapErroPersistencia(error);
  }
}

async function encerrarMatriculasAtuais(matriculaEntity, militarId, dataEncerramento) {
  const atuais = await matriculaEntity.filter({ militar_id: militarId, is_atual: true });
  if (Array.isArray(atuais) && atuais.length > 0) {
    const payloads = atuais.map((atual) => ({
      id: atual.id,
      is_atual: false,
      data_fim: dataEncerramento || new Date().toISOString().slice(0, 10),
      motivo: atual.motivo || 'Encerrada por inclusão de nova matrícula.',
    }));

    if (matriculaEntity.bulkUpdate) {
      await matriculaEntity.bulkUpdate(payloads);
    } else {
      await Promise.all(payloads.map(({ id, ...rest }) => matriculaEntity.update(id, rest)));
    }
  }
}

export async function adicionarNovaMatriculaMilitar({
  militarId,
  matricula,
  tipoMatricula = 'Secundária',
  motivo = 'Nova matrícula vinculada',
  origemRegistro = 'manual',
  dataInicio = '',
}) {
  const matriculaEntity = await getEntity('MatriculaMilitar');
  const militarEntity = await getEntity('Militar');

  if (!matriculaEntity?.create || !matriculaEntity?.filter || !matriculaEntity?.update) {
    throw new Error('Entidade MatriculaMilitar indisponível.');
  }

  const matriculaNorm = await validarMatriculaDisponivel(matricula, militarId);

  await encerrarMatriculasAtuais(matriculaEntity, militarId, dataInicio);

  const nova = await matriculaEntity.create({
    militar_id: militarId,
    matricula: formatarMatriculaPadrao(matriculaNorm),
    matricula_normalizada: matriculaNorm,
    tipo_matricula: tipoMatricula,
    situacao: 'Ativa',
    is_atual: true,
    data_inicio: dataInicio || new Date().toISOString().slice(0, 10),
    data_fim: '',
    motivo,
    origem_registro: origemRegistro,
  });

  if (militarEntity?.update) {
    await militarEntity.update(militarId, { matricula: formatarMatriculaPadrao(matriculaNorm) });
  }

  return nova;
}

async function obterMilitarPorId(id) {
  const militarEntity = await getEntity('Militar');
  if (!militarEntity?.filter) throw new Error('Entidade Militar indisponível.');
  const [item] = await militarEntity.filter({ id });
  return item || null;
}

async function validarEObterEntidadesMerge(militarOrigemId, militarDestinoId) {
  if (!militarOrigemId || !militarDestinoId) {
    throw new Error('Militar de origem e destino são obrigatórios para o merge.');
  }
  if (String(militarOrigemId) === String(militarDestinoId)) {
    throw new Error(ERROS.AUTO_MERGE_BLOQUEADO);
  }

  const [militarEntity, matriculaEntity, mergeLogEntity, pendenciaEntity] = await Promise.all([
    getEntity('Militar'),
    getEntity('MatriculaMilitar'),
    getEntity('MergeMilitarLog'),
    getEntity('PossivelDuplicidadeMilitar'),
  ]);

  if (!militarEntity?.update || !matriculaEntity?.list || !matriculaEntity?.update) {
    throw new Error('Entidades necessárias para merge estão indisponíveis.');
  }
  if (!mergeLogEntity?.create) {
    throw new Error('Entidade MergeMilitarLog indisponível.');
  }

  return { militarEntity, matriculaEntity, mergeLogEntity, pendenciaEntity };
}

async function buscarMatriculasMilitar(militarId, matriculaEntity) {
  if (matriculaEntity.filter) return (await matriculaEntity.filter({ militar_id: militarId })) ?? [];
  const list = (await matriculaEntity.list()) ?? [];
  return list.filter((m) => String(m.militar_id) === String(militarId));
}

async function buscarVinculosMilitar(militarId) {
  return Promise.all(ENTIDADES_VINCULOS_MILITAR_ID.map(async (name) => {
    const entity = await getEntity(name);
    if (!entity?.update) return { name, entity, items: [] };
    const items = entity.filter
      ? await entity.filter({ militar_id: militarId })
      : (await (entity.list?.() || Promise.resolve([]))) ?? [];
    const finalItems = (Array.isArray(items) ? items : [])
      .filter((row) => String(row?.militar_id || '') === String(militarId));
    return { name, entity, items: finalItems };
  }));
}

async function buscarDadosMerge(militarOrigemId, militarDestinoId, matriculaEntity) {
  const [origem, destino, matriculasOrigem, matriculasDestino, vinculosOrigem] = await Promise.all([
    obterMilitarPorId(militarOrigemId),
    obterMilitarPorId(militarDestinoId),
    buscarMatriculasMilitar(militarOrigemId, matriculaEntity),
    buscarMatriculasMilitar(militarDestinoId, matriculaEntity),
    buscarVinculosMilitar(militarOrigemId),
  ]);

  if (!origem) throw new Error('Militar de origem não encontrado.');
  if (!destino) throw new Error('Militar de destino não encontrado.');
  if (origem.merged_into_id) throw new Error('Militar de origem já está mesclado em outro cadastro.');

  return { origem, destino, matriculasOrigem, matriculasDestino, vinculosOrigem };
}

function gerarPayloadsMatriculasReatribuidas(matriculasOrigem, matriculasDestino, militarDestinoId) {
  const hoje = new Date().toISOString().slice(0, 10);
  const destinoPorNorm = new Map(
    (matriculasDestino || [])
      .map((m) => [normalizarMatricula(m.matricula_normalizada || m.matricula), m])
      .filter(([k]) => !!k),
  );

  return matriculasOrigem.map((matOrigem) => {
    const norm = normalizarMatricula(matOrigem.matricula_normalizada || matOrigem.matricula);
    if (norm && destinoPorNorm.has(norm)) {
      return {
        id: matOrigem.id,
        is_atual: false,
        situacao: 'Mesclada',
        data_fim: hoje,
        motivo: `${matOrigem.motivo || ''} Encerrada por merge manual com militar ${militarDestinoId}.`.trim(),
      };
    }

    return {
      id: matOrigem.id,
      militar_id: militarDestinoId,
      is_atual: false,
      motivo: `${matOrigem.motivo || ''} Reatribuída por merge manual a partir do militar ${matOrigem.militar_id}.`.trim(),
    };
  });
}

function gerarPayloadsConsolidacaoMatriculaPrincipal(matriculasDestinoPos, atualDestino) {
  const hoje = new Date().toISOString().slice(0, 10);
  const atualDestinoId = atualDestino.id;
  const updatePayloads = [];

  for (const mat of matriculasDestinoPos) {
    const deveSerAtual = String(mat.id) === String(atualDestinoId);
    const needsUpdate = (Boolean(mat.is_atual) !== deveSerAtual);

    if (needsUpdate) {
      const payload = { id: mat.id, is_atual: deveSerAtual };
      if (deveSerAtual) {
        payload.data_fim = '';
      } else {
        payload.data_fim = mat.data_fim || hoje;
      }
      updatePayloads.push(payload);
    }
  }
  return updatePayloads;
}

async function reatribuirVinculos(vinculosOrigem, militarDestinoId, destino) {
  const promises = (vinculosOrigem || []).map(async (v) => {
    const payloads = (v.items || []).map((row) => {
      const p = { id: row.id, militar_id: militarDestinoId };
      if (v.name === 'PunicaoDisciplinar' && destino?.nome_completo) {
        p.militar_nome = destino.nome_completo;
      }
      return p;
    });

    if (payloads.length === 0) return null;

    if (typeof v.entity.bulkUpdate === 'function') {
      return v.entity.bulkUpdate(payloads);
    }
    return Promise.all(payloads.map((p) => v.entity.update(p.id, p)));
  });

  return Promise.all(promises);
}

function determinarMatriculaPrincipalDestino(matriculasDestinoPos, destinoOriginal) {
  return (matriculasDestinoPos || []).find((m) => m.is_atual === true)
    || (matriculasDestinoPos || []).find((m) => normalizarMatricula(m.matricula_normalizada || m.matricula) === normalizarMatricula(destinoOriginal.matricula))
    || (matriculasDestinoPos || [])[0];
}

async function executarProcessoMerge(
  militarOrigemId,
  militarDestinoId,
  { origem, destino, matriculasOrigem, matriculasDestino, vinculosOrigem },
  { militarEntity, matriculaEntity, pendenciaEntity, mergeLogEntity },
  { motivo, executadoPor, pendenciaId },
) {
  const payloadsMatriculas = gerarPayloadsMatriculasReatribuidas(matriculasOrigem, matriculasDestino, militarDestinoId);

  // Simula o estado das matrículas após a reatribuição para evitar um SELECT redundante
  const matriculasDestinoPosSimuladas = [
    ...(matriculasDestino || []),
    ...payloadsMatriculas
      .filter((p) => p.militar_id === militarDestinoId)
      .map((p) => {
        const original = matriculasOrigem.find((mo) => mo.id === p.id);
        return { ...original, ...p };
      }),
  ];

  const atualDestino = determinarMatriculaPrincipalDestino(matriculasDestinoPosSimuladas, destino);
  if (!atualDestino) {
    throw new Error('Merge bloqueado: militar de destino sem matrícula após reatribuição.');
  }

  const payloadsConsolidacao = gerarPayloadsConsolidacaoMatriculaPrincipal(matriculasDestinoPosSimuladas, atualDestino);

  // Consolidar todos os updates de matrícula em uma única operação em lote, mergeando payloads para o mesmo ID
  const mapUpdatesMatricula = new Map();
  [...payloadsMatriculas, ...payloadsConsolidacao].forEach((p) => {
    mapUpdatesMatricula.set(p.id, { ...(mapUpdatesMatricula.get(p.id) || {}), ...p });
  });

  const todosPayloadsMatricula = Array.from(mapUpdatesMatricula.values());
  const matriculaUpdatePromise = (todosPayloadsMatricula.length > 0)
    ? (matriculaEntity.bulkUpdate
      ? matriculaEntity.bulkUpdate(todosPayloadsMatricula)
      : Promise.all(todosPayloadsMatricula.map(({ id, ...rest }) => matriculaEntity.update(id, rest))))
    : Promise.resolve();

  // Executar reatribuição de vínculos em paralelo com as matrículas
  await Promise.all([
    matriculaUpdatePromise,
    reatribuirVinculos(vinculosOrigem, militarDestinoId, destino),
  ]);

  const destinoMatriculaFinal = atualDestino.matricula || formatarMatriculaPadrao(atualDestino.matricula_normalizada || '');

  // Consolidar updates de militares (origem e destino) e pendência
  const militarUpdates = [
    {
      id: militarOrigemId,
      status_cadastro: 'Mesclado',
      situacao_militar: 'Mesclado',
      merged_into_id: militarDestinoId,
    },
    {
      id: militarDestinoId,
      matricula: destinoMatriculaFinal,
    },
  ];

  const pendenciaPromise = (pendenciaId && pendenciaEntity?.update)
    ? pendenciaEntity.update(pendenciaId, {
      status: STATUS_POSSIVEL_DUPLICIDADE.MESCLADO,
      militar_existente_id: militarDestinoId,
      militar_candidato_id: militarOrigemId,
      resolvido_por: executadoPor || '',
      resolved_at: new Date().toISOString(),
    })
    : Promise.resolve();

  await Promise.all([
    militarEntity.bulkUpdate
      ? militarEntity.bulkUpdate(militarUpdates)
      : Promise.all(militarUpdates.map(({ id, ...rest }) => militarEntity.update(id, rest))),
    pendenciaPromise,
  ]);

  const snapshotDestinoDepois = { ...destino, matricula: destinoMatriculaFinal };

  return mergeLogEntity.create({
    militar_origem_id: militarOrigemId,
    militar_destino_id: militarDestinoId,
    snapshot_origem: JSON.stringify(origem),
    snapshot_destino_antes: JSON.stringify(destino),
    snapshot_destino_depois: JSON.stringify(snapshotDestinoDepois),
    motivo: motivo || 'Merge manual de saneamento cadastral.',
    executado_por: executadoPor || '',
    created_at: new Date().toISOString(),
  });
}

export async function executarMergeManualMilitares({
  militarOrigemId,
  militarDestinoId,
  motivo,
  executadoPor = '',
  pendenciaId = '',
} = {}) {
  const entidades = await validarEObterEntidadesMerge(militarOrigemId, militarDestinoId);

  const dados = await buscarDadosMerge(militarOrigemId, militarDestinoId, entidades.matriculaEntity);

  const log = await executarProcessoMerge(
    militarOrigemId,
    militarDestinoId,
    dados,
    entidades,
    { motivo, executadoPor, pendenciaId },
  );

  return {
    logId: log?.id,
    militarOrigemId,
    militarDestinoId,
    matriculasReatribuídas: (dados.matriculasOrigem || []).length,
  };
}

export async function migrarMatriculasLegadas({ dryRun = true } = {}) {
  const { matriculaEntity, militares, matriculas } = await carregarDadosParaMigracao();
  return processarAnaliseMigracao(militares, matriculas, dryRun, matriculaEntity);
}

async function carregarDadosParaMigracao() {
  const [militarEntity, matriculaEntity] = await Promise.all([
    getEntity('Militar'),
    getEntity('MatriculaMilitar'),
  ]);

  if (!militarEntity?.list) throw new Error('Entidade Militar indisponível para migração.');
  if (!matriculaEntity?.list || !matriculaEntity?.create) throw new Error('Entidade MatriculaMilitar indisponível para migração.');

  const [militares, matriculas] = await Promise.all([
    militarEntity.list(),
    matriculaEntity.list(),
  ]);

  return { militarEntity, matriculaEntity, militares, matriculas };
}

async function processarAnaliseMigracao(militares, matriculas, dryRun, matriculaEntity) {
  const porMatricula = new Map((matriculas || []).map((m) => [normalizarMatricula(m.matricula_normalizada || m.matricula), m]));
  const listaMilitares = militares || [];
  const diagnostico = { totalMilitares: listaMilitares.length, criadas: 0, conflitos: [], ignoradas: 0 };
  const aCriar = [];
  const matriculasNovasNoLote = new Map();

  for (const militar of listaMilitares) {
    const matriculaNorm = normalizarMatricula(militar?.matricula);
    if (!matriculaNorm) {
      diagnostico.ignoradas += 1;
      continue;
    }

    const existenteNaBase = porMatricula.get(matriculaNorm);
    const idExistenteNoLote = matriculasNovasNoLote.get(matriculaNorm);

    if (existenteNaBase) {
      if (String(existenteNaBase.militar_id || '') !== String(militar.id || '')) {
        diagnostico.conflitos.push({
          tipo: 'matricula_duplicada',
          matricula: formatarMatriculaPadrao(matriculaNorm),
          militar_origem_id: militar.id,
          militar_destino_id: existenteNaBase.militar_id,
        });
      }
      continue;
    }

    if (idExistenteNoLote) {
      diagnostico.conflitos.push({
        tipo: 'matricula_duplicada',
        matricula: formatarMatriculaPadrao(matriculaNorm),
        militar_origem_id: militar.id,
        militar_destino_id: idExistenteNoLote,
      });
      continue;
    }

    diagnostico.criadas += 1;
    matriculasNovasNoLote.set(matriculaNorm, militar.id);

    if (!dryRun) {
      aCriar.push({
        militar_id: militar.id,
        matricula: formatarMatriculaPadrao(matriculaNorm),
        matricula_normalizada: matriculaNorm,
        tipo_matricula: 'Principal',
        situacao: 'Ativa',
        is_atual: true,
        data_inicio: militar.data_inclusao || new Date().toISOString().slice(0, 10),
        data_fim: '',
        motivo: 'Migração de legado da matrícula principal.',
        origem_registro: 'migracao_legado',
      });
    }
  }

  if (!dryRun && aCriar.length > 0) {
    if (matriculaEntity.bulkCreate) {
      await matriculaEntity.bulkCreate(aCriar);
    } else {
      await Promise.all(aCriar.map((p) => matriculaEntity.create(p)));
    }
  }

  return diagnostico;
}

export const mensagensMilitarIdentidade = ERROS;