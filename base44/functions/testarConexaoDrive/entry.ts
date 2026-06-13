import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * testarConexaoDrive — DEPRECATED.
 * A integração com Google Drive foi removida; o acervo agora é armazenado no Base44.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    await base44.auth.me().catch(() => null);
    return Response.json({
      ok: true,
      deprecated: true,
      message: 'Função descontinuada — integração com Google Drive removida.'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});