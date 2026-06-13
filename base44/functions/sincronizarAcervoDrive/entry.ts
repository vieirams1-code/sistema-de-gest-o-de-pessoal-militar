import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * sincronizarAcervoDrive — DEPRECATED.
 * O storage do acervo histórico foi migrado para o storage interno do Base44.
 * Esta função foi neutralizada para evitar falhas em chamadas legadas.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    await base44.auth.me().catch(() => null);
    return Response.json({
      ok: true,
      deprecated: true,
      message: 'Função descontinuada — armazenamento migrado para o Base44.'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});