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

// Permissões que autorizam a movimentação. OR aditivo:
// - admin (role/access)
// - action gerir_estrutura (mesma usada hoje no frontend para o botão)
// - action gerir_lotacao_militares (chave futura/explícita)
const ACTIONS_AUTORIZADAS = ['gerir_estrutura', 'gerir_lotacao_militares', 'gerir_permissoes'];

const normalizeTipo = (t) => String(t || '').trim().toLowerCase();
const normalizeEmail = (e) => String(e || '').trim().toLowerCase();

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

// Extrai a matriz de permissões serializada no campo `descricao` de um
// PerfilPermissao, no formato:
//   [SGP_PERMISSIONS_MATRIX]{...JSON...}[/SGP_PERMISSIONS_MATRIX]
function extrairMatrizPermissoes(descricao) {
    if (typeof descricao !== 'string' || !descricao) return {};
    const start = descricao.indexOf('[SGP_PERMISSIONS_MATRIX]');
    const end = descricao.indexOf('[/SGP_PERMISSIONS_MATRIX]');
    if (start === -1 || end === -1 || end <= start) return {};
    const jsonStr = descricao.slice(start + '[SGP_PERMISSIONS_MATRIX]'.length, end).trim();
    if (!jsonStr) return {};
    try {
        const parsed = JSON.parse(jsonStr);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_e) {
        return {};
    }
}

function consolidarActions(perfis, acessos) {
    const actions = {};
    const aplicar = (fonte) => {
        if (!fonte) return;
        Object.entries(fonte).forEach(([key, val]) => {
            if (typeof val !== 'boolean') return;
            if (!key.startsWith('perm_')) return;
            const actionKey = key.replace(/^perm_/, '');
            if (val === true) actions[actionKey] = true;
            else if (!(actionKey in actions)) actions[actionKey] = false;
        });
    };
    (perfis || []).forEach((p) => {
        aplicar(p);
        aplicar(extrairMatrizPermissoes(p?.descricao));
    });
    (acessos || []).forEach(aplicar);
    return actions;
}

async function resolverPermissoes(base44, email) {
    const acessos = await fetchWithRetry(
        () => base44.asServiceRole.entities.UsuarioAcesso.filter(
            { user_email: email, ativo: true },
            undefined,
            100,
            0,
            CAMPOS_USUARIO_ACESSO
        ),
        `usuarioAcesso.list:${email}`
    );

    const isAdminByAccess = (acessos || []).some((a) => normalizeTipo(a.tipo_acesso) === 'admin');

    const perfilIds = Array.from(new Set((acessos || []).map((a) => a?.perfil_id).filter(Boolean)));
    let perfis = [];
    if (perfilIds.length > 0) {
        perfis = await fetchWithRetry(
            () => base44.asServiceRole.entities.PerfilPermissao.filter({
                id: { $in: perfilIds },
                ativo: true,
            }),
            'perfilPermissao.in'
        );
    }

    const actions = consolidarActions(perfis || [], acessos || []);

    return { acessos: acessos || [], isAdminByAccess, actions };
}

function temPermissaoMover(authIsAdmin, targetIsAdmin, targetActions) {
    if (authIsAdmin) return true;
    if (targetIsAdmin) return true;
    return ACTIONS_AUTORIZADAS.some((k) => targetActions?.[k] === true);
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

        // ---- Impersonação (mesmo padrão do getUserPermissions) ----
        const authUserEmail = normalizeEmail(authUser.email);
        const effectiveEmailNorm = normalizeEmail(effectiveEmailRaw);
        const wantsImpersonation = Boolean(effectiveEmailNorm) && effectiveEmailNorm !== authUserEmail;

        const authPerms = await resolverPermissoes(base44, authUser.email);
        const authIsAdminByRole = String(authUser.role || '').toLowerCase() === 'admin';
        const authIsAdmin = authIsAdminByRole || authPerms.isAdminByAccess;

        if (wantsImpersonation && !authIsAdmin) {
            return Response.json(
                { error: 'Ação não permitida: somente administradores podem usar effectiveEmail.' },
                { status: 403 }
            );
        }

        const isImpersonating = wantsImpersonation && authIsAdmin;
        const targetEmail = isImpersonating ? effectiveEmailNorm : authUser.email;
        const targetPerms = isImpersonating
            ? await resolverPermissoes(base44, targetEmail)
            : authPerms;
        const targetIsAdmin = isImpersonating
            ? targetPerms.isAdminByAccess
            : authIsAdmin;

        const autorizado = temPermissaoMover(authIsAdmin, targetIsAdmin, targetPerms.actions);
        if (!autorizado) {
            return Response.json(
                { error: 'Permissão insuficiente para mover militares.' },
                { status: 403 }
            );
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