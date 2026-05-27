import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { createClient } from 'npm:@supabase/supabase-js@2.49.8';

const MIN_TTL_SECONDS = 60;
const MAX_TTL_SECONDS = 300;
const DEFAULT_TTL_SECONDS = 120;

function clampTtl(value: unknown) {
  const ttl = Number(value);
  if (!Number.isFinite(ttl)) return DEFAULT_TTL_SECONDS;
  return Math.min(MAX_TTL_SECONDS, Math.max(MIN_TTL_SECONDS, Math.floor(ttl)));
}

function parseStorageLocation(fileRef: string) {
  const trimmed = String(fileRef || '').trim();
  if (!trimmed) return null;
  const byPrefix = trimmed.match(/^([^/]+)\/(.+)$/);
  if (byPrefix && !trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return { bucket: byPrefix[1], objectPath: byPrefix[2] };
  try {
    const url = new URL(trimmed);
    const marker = '/storage/v1/object/';
    const idx = url.pathname.indexOf(marker);
    if (idx === -1) return null;
    const suffix = url.pathname.slice(idx + marker.length);
    const normalized = suffix.startsWith('public/') || suffix.startsWith('sign/') || suffix.startsWith('authenticated/') ? suffix.split('/').slice(1).join('/') : suffix;
    const parts = normalized.split('/').filter(Boolean);
    if (parts.length < 2) return null;
    return { bucket: parts[0], objectPath: parts.slice(1).join('/') };
  } catch (_e) {
    return null;
  }
}

function extractArquivoFileUri(raw: unknown): string {
  if (typeof raw === 'string') return raw.trim();
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const nested = extractArquivoFileUri(item);
      if (nested) return nested;
    }
    return '';
  }
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    const directCandidates = [obj.file_uri, obj.url, obj.path, obj.fileUrl, obj.signedUrl];
    for (const candidate of directCandidates) {
      const nested = extractArquivoFileUri(candidate);
      if (nested) return nested;
    }
    const nestedCandidates = [obj.arquivo_atestado, obj.file, obj.anexo, obj.value, obj.data];
    for (const candidate of nestedCandidates) {
      const nested = extractArquivoFileUri(candidate);
      if (nested) return nested;
    }
  }
  return '';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const authUser = await base44.auth.me();
    if (!authUser) return Response.json({ error: 'Não autenticado.' }, { status: 401 });

    let payload: Record<string, unknown> = {};
    try { payload = await req.json(); } catch (_e) { payload = {}; }

    const atestadoId = String(payload?.atestado_id || '').trim();
    if (!atestadoId) return Response.json({ error: 'atestado_id é obrigatório.' }, { status: 400 });

    const scopedResponse = await base44.functions.invoke('getScopedAtestadosBundle', payload);
    const scopedData = scopedResponse?.data ?? scopedResponse ?? {};
    const atestados = Array.isArray(scopedData?.atestados) ? scopedData.atestados : [];
    const atestado = atestados.find((item: Record<string, unknown>) => String(item?.id || '') === atestadoId);
    if (!atestado) return Response.json({ error: 'Atestado fora do escopo do usuário.' }, { status: 403 });

    const arquivoAtestado = extractArquivoFileUri(atestado?.arquivo_atestado);
    if (!arquivoAtestado) return Response.json({ error: 'Este atestado não possui arquivo anexo.' }, { status: 404 });

    const location = parseStorageLocation(arquivoAtestado);
    if (!location) {
      console.warn('[getAtestadoAnexoSignedUrl] anexo_invalido', {
        atestado_id: atestadoId,
        tipo_arquivo_atestado: Array.isArray(atestado?.arquivo_atestado) ? 'array' : typeof atestado?.arquivo_atestado,
        arquivo_atestado_preview: typeof arquivoAtestado === 'string' ? arquivoAtestado.slice(0, 180) : '',
      });
      return Response.json({ error: 'Anexo em formato inválido.', code: 'INVALID_ATTACHMENT_FORMAT' }, { status: 422 });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('BASE44_SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('BASE44_SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) return Response.json({ error: 'Configuração de storage indisponível.' }, { status: 500 });

    const ttl = clampTtl(payload?.expires_in);
    const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
    const signed = await supabase.storage.from(location.bucket).createSignedUrl(location.objectPath, ttl);
    if (signed.error || !signed.data?.signedUrl) return Response.json({ error: signed.error?.message || 'Falha ao gerar URL temporária.' }, { status: 500 });

    return Response.json({ url: signed.data.signedUrl, expires_in: ttl, atestado_id: atestadoId });
  } catch (error) {
    const status = error?.response?.status || error?.status || 500;
    return Response.json({ error: error?.message || 'Erro ao gerar URL temporária do anexo.' }, { status });
  }
});
