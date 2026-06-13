import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * gerirWatchDrive — DEPRECATED.
 * Push notifications do Google Drive não são mais utilizadas.
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