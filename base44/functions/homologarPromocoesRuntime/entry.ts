// Homologação concluída em 03/10/2026. Runner preservado em scripts/homologacao-promocoes-runtime.
// Endpoint desativado: não acessa nem modifica entidades.
Deno.serve(() => Response.json({success:false,motivo:'homologacao_encerrada'}, {status:410}));
