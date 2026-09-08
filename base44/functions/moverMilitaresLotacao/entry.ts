import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// =====================================================================
// moverMilitaresLotacao
// ---------------------------------------------------------------------
// Lote 1C-B.2: Movimentação de militares para um nó da estrutura
// organizacional (Grupamento / Subgrupamento / Unidade), aplicando os
// campos modernos (estrutura_*) e legados (grupamento_* / subgrupamento_*)
// de forma consistente, com service role.
//
// Esta função substitui o uso direto de `base44.entities.Militar.update`
// no frontend (pages/LotacaoMilitares.jsx), que estava falhando em
// persistir os campos esperados em alguns cenários.
// =====================================================================

const RETRY_MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 450;
const RETRY_STATUS = new Set([408, 429, 500, 502, 503, 504]);

const CAMPOS_USUARIO_ACESSO = [
    'id',
    'user_email',
    'ativo',
    'tipo_acesso',
    'grupamento_id',
    'subgrupamento_id',
    'militar_id',
    'perfil_id',
];

// Capacidade funcional canônica da movimentação de lotação.
// Estrutura e administração de permissões são domínios independentes.
const ACTIONS_AUTORIZADAS = ['gerir_lotacao_militares'];

const normalizeTipo = (t) => String(t || '').trim().toLowerCase();

async function fetchWithRetry(queryFn, label = 'query') {
    let lastError;
    for (let attempt = 1; attempt <= RETRY_MAX_ATTEMPTS; attempt++) {
        try {
            const result = await queryFn();
            if (attempt > 1) {
                console.info(`[moverMilitaresLotacao] step=${label} attempt=${attempt} status=ok (after retry)`);
            }
            return result;
        } catch (error) {
            lastError = error;
            const status = error?.response?.status || error?.status || 0;
            const isRetryable = RETRY_STATUS.has(status);
            console.warn(`[moverMilitaresLotacao] step=${label} attempt=${attempt}/${RETRY_MAX_ATTEMPTS} status=${status || 'N/A'} retryable=${isRetryable}`);
            if (!isRetryable || attempt === RETRY_MAX_ATTEMPTS) break;
            const exp = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
            const jitter = Math.floor(Math.random() * 200);
            await new Promise((res) => setTimeout(res, exp + jitter));
        }
    }
    throw lastError;
}

async function resolverAutorizacaoCanonica(base44, effectiveEmail) {
    const payload = effectiveEmail ? { effectiveEmail } : {};
    const response = await base44.functions.invoke('getUserPermissions', payload);
    return response?.data ?? response ?? {};
}

function temPermissaoMover(isPlatformAdmin, targetActions) {
    if (isPlatformAdmin) return true;
    return ACTIONS_AUTORIZADAS.some((k) => targetActions?.[k] === true);
}

// =====================================================================
// Lote 1D-F: validação de escopo de militares no backend.
// ---------------------------------------------------------------------
// Para usuários NÃO admin, todos os militaresIds informados devem
// pertencer ao escopo organizacional do usuário (descendentes de
// grupamento/subgrupamento/unidade/proprio).
// Replica a lógica de getMilitarScopeFilters em modo simplificado.
// =====================================================================
async function listarMilitarIdsDoEscopo(base44, acessos) {
    const ids = new Set();

    for (const acesso of acessos || []) {
        const tipo = normalizeTipo(acesso?.tipo_acesso);
        if (tipo === 'admin') return null; // sem restrição

        // proprio: militar vinculado pelo militar_id direto
        if (tipo === 'proprio') {
            if (acesso?.militar_id) ids.add(String(acesso.militar_id));
            continue;
        }

        // setor / subsetor / unidade: resolve via estrutura
        const grupamentoId = acesso?.grupamento_id || null;
        const subgrupamentoId = acesso?.subgrupamento_id || null;

        // Universo organizacional: setor pega tudo abaixo do grupamento raiz;
        // subsetor/unidade pegam apenas o nó (e seus filhos diretos via parent_id).
        const filtros = [];
        if (tipo === 'setor' && grupamentoId) {
            // raiz e descendentes
            filtros.push({ grupamento_raiz_id: grupamentoId });
            filtros.push({ grupamento_id: grupamentoId });
            filtros.push({ estrutura_id: grupamentoId });
        } else if (tipo === 'subsetor' && subgrupamentoId) {
            filtros.push({ estrutura_id: subgrupamentoId });
            filtros.push({ subgrupamento_id: subgrupamentoId });
            // descendentes (Unidades) – consulta separada por parent_id
            try {
                const filhos = await fetchWithRetry(
                    () => base44.asServiceRole.entities.Subgrupamento.filter({ parent_id: subgrupamentoId }),
                    `subgrupamento.parent:${subgrupamentoId}`
                );
                for (const filho of (filhos || [])) {
                    if (filho?.id) {
                        filtros.push({ estrutura_id: filho.id });
                        filtros.push({ subgrupamento_id: filho.id });
                    }
                }
            } catch (_e) {
                // falha de descoberta não bloqueia, apenas reduz universo
            }
        } else if (tipo === 'unidade' && subgrupamentoId) {
            filtros.push({ estrutura_id: subgrupamentoId });
            filtros.push({ subgrupamento_id: subgrupamentoId });
        }

        for (const filtro of filtros) {
            try {
                const militares = await fetchWithRetry(
                    () => base44.asServiceRole.entities.Militar.filter(filtro, undefined, 1000, 0, ['id']),
                    `militar.escopo:${JSON.stringify(filtro)}`
                );
                for (const m of (militares || [])) {
                    if (m?.id) ids.add(String(m.id));
                }
            } catch (_e) {
                // mantém o que conseguiu coletar
            }
        }
    }

    return Array.from(ids);
}

async function buscarNoEstrutura(base44, id) {
    if (!id) return null;
    try {
        return await fetchWithRetry(
            () => base44.asServiceRole.entities.Subgrupamento.get(id),
            `subgrupamento.get:${id}`
        );
    } catch (e) {
        const status = e?.response?.status || e?.status || 0;
        if (status === 404) return null;
        throw e;
    }
}

// Determina o "Setor pai" (Grupamento Nível 1) do nó destino, usando os
// campos da própria entidade Subgrupamento. A estrutura suporta até 3
// níveis (Grupamento → Subgrupamento → Unidade).
async function resolverSetorPai(base44, no) {
    const tipo = normalizeTipo(no?.tipo);
    if (tipo === 'grupamento') return no; // já é raiz
    // Preferência: grupamento_raiz_id quando disponível
    if (no?.grupamento_raiz_id) {
        const raiz = await buscarNoEstrutura(base44, no.grupamento_raiz_id);
        if (raiz) return raiz;
    }
    // Fallback: subir pela cadeia parent_id / grupamento_id até achar um nó tipo Grupamento
    let atual = no;
    const visitados = new Set();
    while (atual && !visitados.has(atual.id)) {
        visitados.add(atual.id);
        const tipoAtual = normalizeTipo(atual?.tipo);
        if (tipoAtual === 'grupamento') return atual;
        const paiId = atual?.grupamento_id || atual?.parent_id;
        if (!paiId) break;
        atual = await buscarNoEstrutura(base44, paiId);
    }
    // Último fallback: retorna o próprio nó (mantém comportamento antigo de não quebrar)
    return no;
}

function montarUpdateData(noDestino, setorPai) {
    const tipo = normalizeTipo(noDestino?.tipo);

    let legados;
    if (tipo === 'grupamento') {
        legados = {
            grupamento_id: noDestino.id,
            grupamento_nome: noDestino.nome,
            subgrupamento_id: '',
            subgrupamento_nome: '',
        };
    } else {
        legados = {
            grupamento_id: setorPai?.id || noDestino?.grupamento_id || '',
            grupamento_nome: setorPai?.nome || noDestino?.grupamento_nome || '',
            subgrupamento_id: noDestino.id,
            subgrupamento_nome: noDestino.nome,
        };
    }

    return {
        ...legados,
        estrutura_id: noDestino.id,
        estrutura_nome: noDestino.nome,
        estrutura_tipo: noDestino.tipo,
        lotacao: noDestino.nome,
    };
}

async function atualizarMilitarComRetry(base44, id, updateData) {
    return fetchWithRetry(
        () => base44.asServiceRole.entities.Militar.update(id, updateData),
        `militar.update:${id}`
    );
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        const authUser = await base44.auth.me();
        if (!authUser) {
            return Response.json({ error: 'Não autenticado' }, { status: 401 });
        }

        let payload = {};
        try {
            payload = await req.json();
        } catch (_e) {
            payload = {};
        }

        const militaresIds = Array.isArray(payload?.militaresIds)
            ? payload.militaresIds.map(String).filter(Boolean)
            : [];
        const targetNodeRaw = payload?.targetNode || null;
        const effectiveEmailRaw = payload?.effectiveEmail;

        if (!targetNodeRaw?.id) {
            return Response.json({ error: 'targetNode.id é obrigatório.' }, { status: 400 });
        }
        if (militaresIds.length === 0) {
            return Response.json({ error: 'Nenhum militar informado.' }, { status: 400 });
        }

        // ---- Autorização canônica via getUserPermissions ----
        const authz = await resolverAutorizacaoCanonica(base44, effectiveEmailRaw);
        if (authz?.error) {
            return Response.json({ error: authz.error }, { status: 403 });
        }
        const targetEmail = authz?.effectiveUserEmail || authUser.email;
        const isImpersonating = authz?.isImpersonating === true;
        const targetIsPlatformAdmin = authz?.isAdmin === true;
        const autorizado = temPermissaoMover(targetIsPlatformAdmin, authz?.actions || {});
        if (!autorizado) {
            return Response.json({ error: 'Permissão insuficiente para mover militares.' }, { status: 403 });
        }

        // tipo_acesso=admin significa escopo global, não privilégio funcional.
        if (authz?.hasGlobalScope !== true) {
            const idsPermitidos = await listarMilitarIdsDoEscopo(base44, authz?.acessos || []);
            if (idsPermitidos !== null) {
                const setPermitidos = new Set(idsPermitidos.map(String));
                const foraDoEscopo = militaresIds.filter((id) => !setPermitidos.has(String(id)));
                if (foraDoEscopo.length > 0) {
                    console.warn('[moverMilitaresLotacao] tentativa de mover militares fora do escopo', { targetEmail, foraDoEscopo });
                    return Response.json({
                        error: 'Acesso negado: um ou mais militares estão fora do seu escopo.',
                        militaresForaDoEscopo: foraDoEscopo,
                    }, { status: 403 });
                }
            }
        }

        // ---- Validar e hidratar nó destino com dado real ----
        const noDestinoReal = await buscarNoEstrutura(base44, targetNodeRaw.id);
        if (!noDestinoReal) {
            return Response.json(
                { error: `Nó destino não encontrado: ${targetNodeRaw.id}` },
                { status: 404 }
            );
        }
        if (!noDestinoReal.nome) {
            return Response.json(
                { error: 'Nó destino sem nome no banco. Verifique a estrutura organizacional.' },
                { status: 422 }
            );
        }

        const setorPai = await resolverSetorPai(base44, noDestinoReal);
        const updateData = montarUpdateData(noDestinoReal, setorPai);

        // ---- Atualizações sequenciais com retry/backoff ----
        const ignorados = [];
        const erros = [];
        let totalAtualizados = 0;

        for (const id of militaresIds) {
            try {
                const militar = await fetchWithRetry(
                    () => base44.asServiceRole.entities.Militar.get(id),
                    `militar.get:${id}`
                ).catch((e) => {
                    const st = e?.response?.status || e?.status || 0;
                    if (st === 404) return null;
                    throw e;
                });

                if (!militar) {
                    ignorados.push({ id, motivo: 'NAO_ENCONTRADO' });
                    continue;
                }

                // Idempotência: se já está no destino, considerar atualizado.
                const jaNoDestino = (
                    String(militar.estrutura_id || '') === String(updateData.estrutura_id) &&
                    String(militar.estrutura_nome || '') === String(updateData.estrutura_nome) &&
                    String(militar.lotacao || '') === String(updateData.lotacao) &&
                    String(militar.subgrupamento_id || '') === String(updateData.subgrupamento_id || '') &&
                    String(militar.grupamento_id || '') === String(updateData.grupamento_id || '')
                );
                if (jaNoDestino) {
                    totalAtualizados += 1;
                    continue;
                }

                await atualizarMilitarComRetry(base44, id, updateData);
                totalAtualizados += 1;
            } catch (error) {
                const status = error?.response?.status || error?.status || 0;
                erros.push({
                    id,
                    status,
                    message: error?.message || 'Erro desconhecido ao atualizar militar.',
                });
                console.error('[moverMilitaresLotacao] falha ao atualizar militar', {
                    id,
                    status,
                    message: error?.message,
                });
            }
        }

        return Response.json({
            total_solicitados: militaresIds.length,
            total_atualizados: totalAtualizados,
            total_ignorados: ignorados.length,
            erros,
            destino: {
                id: noDestinoReal.id,
                nome: noDestinoReal.nome,
                tipo: noDestinoReal.tipo,
            },
            camposAplicados: updateData,
            meta: {
                authUserEmail: authUser.email,
                effectiveUserEmail: targetEmail,
                isImpersonating,
                generatedAt: new Date().toISOString(),
            },
        });
    } catch (error) {
        const status = error?.response?.status || error?.status || 500;
        console.error('[moverMilitaresLotacao] erro fatal:', {
            message: error?.message,
            status,
        });
        return Response.json(
            { error: error?.message || 'Erro interno ao mover militares.' },
            { status }
        );
    }
});