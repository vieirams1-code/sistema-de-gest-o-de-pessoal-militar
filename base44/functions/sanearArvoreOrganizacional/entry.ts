import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// =====================================================================
// sanearArvoreOrganizacional
// ---------------------------------------------------------------------
// Saneamento idempotente da entidade Subgrupamento, garantindo que
// todo registro tenha corretamente:
//   - parent_id (preservado)
//   - grupamento_raiz_id  (id do nó raiz, tipo Grupamento)
//   - grupamento_raiz_nome (nome do nó raiz)
//
// Modos:
//   - mode = "dry-run" (default) → apenas calcula e devolve relatório.
//   - mode = "apply"             → aplica updates somente nos registros
//                                  que precisam de correção.
//
// Escopo: SOMENTE Subgrupamento. Não toca em Militar, Ferias, RegistroLivro,
// PublicacaoExOfficio, Atestado, PunicaoDisciplinar, etc.
//
// Acesso: somente admin.
// =====================================================================

const TIPO_RAIZ = 'grupamento';
const TIPOS_DESCENDENTES = new Set(['subgrupamento', 'unidade']);

const normalizeStr = (v) => String(v ?? '').trim();
const normalizeTipo = (v) => normalizeStr(v).toLowerCase();

function isRaiz(no) {
    return normalizeTipo(no?.tipo) === TIPO_RAIZ;
}

function buildIndex(subgrupamentos) {
    const byId = new Map();
    for (const sg of subgrupamentos || []) {
        if (sg?.id) byId.set(String(sg.id), sg);
    }
    return byId;
}

// Caminha por parent_id até encontrar o nó raiz.
// Retorna { raiz, caminho, status }
//   status:
//     - "ok"               → encontrou raiz
//     - "ciclo"             → detectou ciclo na cadeia
//     - "parent_quebrado"   → parent_id aponta para id inexistente
//     - "sem_raiz"          → cadeia terminou sem nó tipo Grupamento
//     - "self"              → próprio nó é raiz
function resolverRaiz(no, byId) {
    if (!no) return { raiz: null, caminho: [], status: 'sem_raiz' };
    if (isRaiz(no)) return { raiz: no, caminho: [no.id], status: 'self' };

    const visitados = new Set();
    const caminho = [];
    let atual = no;

    while (atual) {
        const idAtual = String(atual.id || '');
        if (!idAtual) return { raiz: null, caminho, status: 'parent_quebrado' };
        if (visitados.has(idAtual)) {
            return { raiz: null, caminho, status: 'ciclo' };
        }
        visitados.add(idAtual);
        caminho.push(idAtual);

        if (isRaiz(atual)) {
            return { raiz: atual, caminho, status: 'ok' };
        }

        const parentId = normalizeStr(atual.parent_id);
        if (!parentId) {
            return { raiz: null, caminho, status: 'sem_raiz' };
        }
        const pai = byId.get(parentId);
        if (!pai) {
            return { raiz: null, caminho, status: 'parent_quebrado' };
        }
        atual = pai;
    }

    return { raiz: null, caminho, status: 'sem_raiz' };
}

function classificarRegistro(no, byId) {
    const tipo = normalizeTipo(no?.tipo);
    const idAtual = String(no?.id || '');
    const nomeAtual = normalizeStr(no?.nome);
    const raizIdAtual = normalizeStr(no?.grupamento_raiz_id);
    const raizNomeAtual = normalizeStr(no?.grupamento_raiz_nome);

    // 1) Nó raiz: deve apontar para si mesmo.
    if (tipo === TIPO_RAIZ) {
        const esperadoId = idAtual;
        const esperadoNome = nomeAtual;
        const jaCorreto = raizIdAtual === esperadoId && raizNomeAtual === esperadoNome;
        return {
            id: idAtual,
            nome: nomeAtual,
            tipo: no?.tipo || '',
            parent_id: normalizeStr(no?.parent_id),
            grupamento_raiz_id_atual: raizIdAtual || null,
            grupamento_raiz_nome_atual: raizNomeAtual || null,
            grupamento_raiz_id_esperado: esperadoId,
            grupamento_raiz_nome_esperado: esperadoNome,
            acao: jaCorreto ? 'NENHUMA' : 'CORRIGIR_RAIZ_AUTOREFERENCIA',
            status_cadeia: 'ok_raiz',
            inconsistencia: null,
        };
    }

    // 2) Tipo não reconhecido (não é Grupamento/Subgrupamento/Unidade)
    if (!TIPOS_DESCENDENTES.has(tipo)) {
        return {
            id: idAtual,
            nome: nomeAtual,
            tipo: no?.tipo || '',
            parent_id: normalizeStr(no?.parent_id),
            grupamento_raiz_id_atual: raizIdAtual || null,
            grupamento_raiz_nome_atual: raizNomeAtual || null,
            grupamento_raiz_id_esperado: null,
            grupamento_raiz_nome_esperado: null,
            acao: 'IGNORAR_TIPO_DESCONHECIDO',
            status_cadeia: 'tipo_desconhecido',
            inconsistencia: `Tipo desconhecido: "${no?.tipo || ''}"`,
        };
    }

    // 3) Descendente: percorre parent_id até a raiz.
    const { raiz, caminho, status } = resolverRaiz(no, byId);

    if (status === 'ok' && raiz) {
        const esperadoId = String(raiz.id);
        const esperadoNome = normalizeStr(raiz.nome);
        const jaCorreto = raizIdAtual === esperadoId && raizNomeAtual === esperadoNome;
        return {
            id: idAtual,
            nome: nomeAtual,
            tipo: no?.tipo || '',
            parent_id: normalizeStr(no?.parent_id),
            grupamento_raiz_id_atual: raizIdAtual || null,
            grupamento_raiz_nome_atual: raizNomeAtual || null,
            grupamento_raiz_id_esperado: esperadoId,
            grupamento_raiz_nome_esperado: esperadoNome,
            acao: jaCorreto ? 'NENHUMA' : 'PREENCHER_RAIZ',
            status_cadeia: 'ok',
            inconsistencia: null,
        };
    }

    // 4) Cadeia quebrada / ciclo / sem raiz → não altera, apenas reporta.
    let motivo = '';
    if (status === 'ciclo') motivo = `Ciclo detectado na cadeia parent_id (${caminho.join(' → ')}).`;
    else if (status === 'parent_quebrado') motivo = `parent_id aponta para id inexistente (cadeia: ${caminho.join(' → ')}).`;
    else motivo = `Cadeia terminou sem encontrar nó tipo "Grupamento" (cadeia: ${caminho.join(' → ')}).`;

    return {
        id: idAtual,
        nome: nomeAtual,
        tipo: no?.tipo || '',
        parent_id: normalizeStr(no?.parent_id),
        grupamento_raiz_id_atual: raizIdAtual || null,
        grupamento_raiz_nome_atual: raizNomeAtual || null,
        grupamento_raiz_id_esperado: null,
        grupamento_raiz_nome_esperado: null,
        acao: 'NAO_TOCAR_INCONSISTENTE',
        status_cadeia: status,
        inconsistencia: motivo,
    };
}

async function aplicarCorrecao(base44, registros) {
    const aplicados = [];
    const falhas = [];

    for (const reg of registros) {
        if (reg.acao !== 'PREENCHER_RAIZ' && reg.acao !== 'CORRIGIR_RAIZ_AUTOREFERENCIA') continue;
        try {
            await base44.asServiceRole.entities.Subgrupamento.update(reg.id, {
                grupamento_raiz_id: reg.grupamento_raiz_id_esperado,
                grupamento_raiz_nome: reg.grupamento_raiz_nome_esperado,
            });
            aplicados.push({
                id: reg.id,
                nome: reg.nome,
                tipo: reg.tipo,
                de: {
                    grupamento_raiz_id: reg.grupamento_raiz_id_atual,
                    grupamento_raiz_nome: reg.grupamento_raiz_nome_atual,
                },
                para: {
                    grupamento_raiz_id: reg.grupamento_raiz_id_esperado,
                    grupamento_raiz_nome: reg.grupamento_raiz_nome_esperado,
                },
            });
        } catch (error) {
            falhas.push({
                id: reg.id,
                nome: reg.nome,
                erro: error?.message || 'Falha desconhecida ao atualizar Subgrupamento.',
            });
        }
    }

    return { aplicados, falhas };
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        const authUser = await base44.auth.me();
        if (!authUser) {
            return Response.json({ error: 'Não autenticado' }, { status: 401 });
        }

        // Apenas admin pode rodar saneamento.
        const isAdmin = String(authUser.role || '').toLowerCase() === 'admin';
        if (!isAdmin) {
            return Response.json(
                { error: 'Forbidden: somente administradores podem executar o saneamento.' },
                { status: 403 }
            );
        }

        let payload = {};
        try {
            payload = await req.json();
        } catch (_e) {
            payload = {};
        }

        const mode = String(payload?.mode || 'dry-run').toLowerCase();
        if (mode !== 'dry-run' && mode !== 'apply') {
            return Response.json(
                { error: `Modo inválido: ${mode}. Use "dry-run" ou "apply".` },
                { status: 400 }
            );
        }

        // 1) Carrega TODOS os Subgrupamentos com service role.
        const todos = await base44.asServiceRole.entities.Subgrupamento.list();
        const byId = buildIndex(todos);

        // 2) Classifica cada registro.
        const registros = todos.map((no) => classificarRegistro(no, byId));

        // 3) Sumariza.
        const resumo = {
            total: registros.length,
            ja_corretos: 0,
            seriam_corrigidos: 0,
            erro_cadeia: 0,
            sem_raiz_encontrada: 0,
            tipo_desconhecido: 0,
        };
        for (const reg of registros) {
            if (reg.acao === 'NENHUMA') resumo.ja_corretos += 1;
            else if (reg.acao === 'PREENCHER_RAIZ' || reg.acao === 'CORRIGIR_RAIZ_AUTOREFERENCIA') resumo.seriam_corrigidos += 1;
            else if (reg.acao === 'NAO_TOCAR_INCONSISTENTE') {
                if (reg.status_cadeia === 'ciclo' || reg.status_cadeia === 'parent_quebrado') resumo.erro_cadeia += 1;
                else if (reg.status_cadeia === 'sem_raiz') resumo.sem_raiz_encontrada += 1;
            } else if (reg.acao === 'IGNORAR_TIPO_DESCONHECIDO') {
                resumo.tipo_desconhecido += 1;
            }
        }

        const inconsistencias = registros.filter((r) => r.acao === 'NAO_TOCAR_INCONSISTENTE' || r.acao === 'IGNORAR_TIPO_DESCONHECIDO');

        console.info('[sanearArvoreOrganizacional] resumo do diagnóstico', { mode, resumo });

        if (mode === 'dry-run') {
            return Response.json({
                ok: true,
                mode,
                resumo,
                registros,
                inconsistencias,
                meta: {
                    executado_por: authUser.email,
                    generated_at: new Date().toISOString(),
                },
            });
        }

        // mode === "apply"
        const { aplicados, falhas } = await aplicarCorrecao(base44, registros);

        console.info('[sanearArvoreOrganizacional] aplicação concluída', {
            aplicados: aplicados.length,
            falhas: falhas.length,
        });

        return Response.json({
            ok: true,
            mode,
            resumo,
            total_aplicados: aplicados.length,
            total_falhas: falhas.length,
            aplicados,
            falhas,
            inconsistencias,
            meta: {
                executado_por: authUser.email,
                generated_at: new Date().toISOString(),
            },
        });
    } catch (error) {
        console.error('[sanearArvoreOrganizacional] erro fatal', {
            message: error?.message,
            stack: error?.stack,
        });
        return Response.json(
            { error: error?.message || 'Erro interno no saneamento.' },
            { status: 500 }
        );
    }
});