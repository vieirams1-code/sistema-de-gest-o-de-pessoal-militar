function jsonResponse(data: any, status = 410) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

Deno.serve(async () => jsonResponse({
  success: false,
  error: 'Endpoint legado de notificação JISO desativado. Use notificarJisoWhatsAppTemplate.',
  legacy_endpoint_disabled: true,
}));
