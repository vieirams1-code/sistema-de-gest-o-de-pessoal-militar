import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Saneamento definitivo do campo `dias` dos eventos de Livro de Férias.
//
// Regra central (mesma da persistência preventiva no RegistroLivroModal):
//   Início / Saída Férias  -> dias = ferias.dias (fração iniciada)
//   Término / Retorno Férias -> dias = ferias.dias (fração encerrada)
//
// NUNCA toca em Interrupção nem Continuação (usam campos próprios:
// dias_no_momento, dias_gozados, saldo_remanescente).
//
// Payload:
//   { dryRun: true }  -> apenas audita e devolve divergências + ambíguos
//   { dryRun: false } -> aplica o saneamento seguro e devolve o relatório

const TIPOS_SANEAVEIS = new Set(['Saída Férias', 'Retorno Férias']);
const TIPOS_NUNCA_TOCAR = new Set(['Interrupção de Férias', 'Nova Saída / Retomada']);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const dryRun = body?.dryRun !== false; // default: dry-run seguro

    // 1) Carregar todas as férias e indexar por id.
    const feriasList = await base44.asServiceRole.entities.Ferias.list('-created_date', 100000);
    const feriasPorId = new Map(feriasList.map((f) => [String(f.id), f]));

    // 2) Carregar eventos de Livro dos tipos saneáveis (paginado por tipo).
    const eventos = [];
    for (const tipo of TIPOS_SANEAVEIS) {
      let skip = 0;
      const pageSize = 500;
      // paginação simples até esgotar
      // (RegistroLivro.filter aceita query + sort + limit posicionais)
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const page = await base44.asServiceRole.entities.RegistroLivro.filter(
          { tipo_registro: tipo },
          '-created_date',
          pageSize,
          skip,
        );
        if (!page || page.length === 0) break;
        eventos.push(...page);
        if (page.length < pageSize) break;
        skip += pageSize;
      }
    }

    const divergentes = [];
    const ambiguos = [];
    const corrigidos = [];

    for (const ev of eventos) {
      const tipo = ev.tipo_registro;

      // Segurança extra — nunca processar Interrupção/Continuação aqui.
      if (TIPOS_NUNCA_TOCAR.has(tipo)) continue;

      const feriasId = ev.ferias_id ? String(ev.ferias_id) : null;

      // PARTE 4 — casos ambíguos: sem ferias_id.
      if (!feriasId) {
        ambiguos.push(mapEvento(ev, null, 'sem_ferias_id'));
        continue;
      }

      const ferias = feriasPorId.get(feriasId);

      // ferias_id apontando para férias inexistente -> ambíguo.
      if (!ferias) {
        ambiguos.push(mapEvento(ev, null, 'ferias_nao_encontrada'));
        continue;
      }

      const diasFracao = Number(ferias.dias);

      // PARTE 4 — Ferias.dias vazio/inválido.
      if (!Number.isFinite(diasFracao) || diasFracao <= 0) {
        ambiguos.push(mapEvento(ev, ferias, 'ferias_dias_invalido'));
        continue;
      }

      const diasEvento = Number(ev.dias);

      // Sem divergência -> nada a fazer.
      if (Number.isFinite(diasEvento) && diasEvento === diasFracao) continue;

      const registroDivergente = mapEvento(ev, ferias, 'divergente');
      divergentes.push(registroDivergente);

      // PARTE 3 — saneamento automático seguro.
      // Todas as condições já foram garantidas acima:
      // tipo saneável, ferias_id válido, ferias.dias > 0, dias diferente,
      // não é interrupção/continuação, e só o campo `dias` é alterado.
      if (!dryRun) {
        await base44.asServiceRole.entities.RegistroLivro.update(ev.id, { dias: diasFracao });
        corrigidos.push({ ...registroDivergente, dias_corrigido_para: diasFracao });
      }
    }

    return Response.json({
      dryRun,
      totalEventosAnalisados: eventos.length,
      totalDivergentes: divergentes.length,
      totalCorrigidos: corrigidos.length,
      totalAmbiguos: ambiguos.length,
      divergentes,
      corrigidos,
      ambiguos,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function mapEvento(ev, ferias, motivo) {
  return {
    motivo,
    evento_id: ev.id,
    tipo: ev.tipo_registro,
    militar: ev.militar_nome || ferias?.militar_nome || '',
    matricula: ev.militar_matricula || ferias?.militar_matricula || '',
    periodo_aquisitivo_id: ferias?.periodo_aquisitivo_id || '',
    ferias_id: ev.ferias_id || '',
    registro_dias: ev.dias ?? null,
    ferias_dias: ferias?.dias ?? null,
    data_evento: ev.data_registro || ev.data_inicio || null,
    status: ev.status || null,
    numero_bg: ev.numero_bg || null,
    data_bg: ev.data_bg || null,
    created_at: ev.created_date || null,
    updated_at: ev.updated_date || null,
  };
}