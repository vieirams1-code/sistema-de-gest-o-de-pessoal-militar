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
    const directCandidates = [obj.file_uri, obj.url, obj.path, obj.fileUrl, obj.signedUrl, obj.signed_url, obj.download_url];
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

function safePreview(value: unknown) {
  try {
    return JSON.stringify(value, (_key, val) => {
      if (typeof val === 'string' && val.length > 180) return `${val.slice(0, 180)}...[truncated]`;
      return val;
    }).slice(0, 360);
  } catch (_e) {
    return '[unserializable]';
  }
}

function getStorageLocationFromAtestado(atestado: Record<string, unknown>) {
  const bucket = String(atestado?.storage_bucket || '').trim();
  const objectPath = String(atestado?.storage_object_path || '').trim();
  if (!bucket || !objectPath) return null;
  return { bucket, objectPath };
}

function uriPattern(uri: string) {
  if (uri.startsWith('file://')) return 'file://';
  if (uri.startsWith('private://')) return 'private://';
  if (uri.startsWith('http://')) return 'http://';
  if (uri.startsWith('https://')) return 'https://';
  if (uri.startsWith('/')) return '/';
  if (!uri) return 'empty';
  return 'other';
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

    // (P0) Validação de PERMISSÃO EXPLÍCITA do usuário efetivo (não apenas escopo).
    // getUserPermissions consolida permissões do usuário efetivo quando há
    // impersonação (admin real só autoriza impersonar, nunca amplia o escopo).
    const permsResponse = await base44.functions.invoke('getUserPermissions', payload);
    const perms = permsResponse?.data ?? permsResponse ?? {};
    const permActions = perms?.actions || {};
    const podeVerAtestados = Boolean(perms?.isAdmin) || permActions?.visualizar_atestados === true;

    if (!podeVerAtestados) {
      console.warn('[getAtestadoAnexoSignedUrl] permissao_negada', {
        authUserEmail: String(perms?.authUserEmail || ''),
        effectiveUserEmail: String(perms?.effectiveUserEmail || ''),
        isImpersonating: Boolean(perms?.isImpersonating),
        atestado_id: atestadoId,
      });
      return Response.json({ error: 'Sem permissão para visualizar atestados.', code: 'FORBIDDEN' }, { status: 403 });
    }

    // (P0) Validação de ESCOPO sobre o atestado, via bundle escopado já corrigido.
    const scopedResponse = await base44.functions.invoke('getScopedAtestadosBundle', payload);
    const scopedData = scopedResponse?.data ?? scopedResponse ?? {};
    const atestados = Array.isArray(scopedData?.atestados) ? scopedData.atestados : [];
    const inScope = atestados.some((item) => String(item?.id || '') === atestadoId);
    if (!inScope) {
      console.warn('[getAtestadoAnexoSignedUrl] fora_do_escopo', {
        authUserEmail: String(perms?.authUserEmail || ''),
        effectiveUserEmail: String(perms?.effectiveUserEmail || ''),
        isImpersonating: Boolean(perms?.isImpersonating),
        atestado_id: atestadoId,
      });
      return Response.json({ error: 'Atestado fora do escopo do usuário.', code: 'OUT_OF_SCOPE' }, { status: 403 });
    }

    const atestadoOriginal = await base44.entities.Atestado.get(atestadoId);

    const atestadoRecord = (atestadoOriginal || {}) as Record<string, unknown>;
    const storageLocation = getStorageLocationFromAtestado(atestadoRecord);
    const arquivoAtestadoRaw = atestadoRecord?.arquivo_atestado;
    const arquivoAtestado = extractArquivoFileUri(arquivoAtestadoRaw);
    const pattern = uriPattern(arquivoAtestado);

    console.info('[getAtestadoAnexoSignedUrl] attachment_diagnostics', {
      atestado_id: atestadoId,
      arquivo_atestado_typeof: Array.isArray(arquivoAtestadoRaw) ? 'array' : typeof arquivoAtestadoRaw,
      arquivo_atestado_preview: safePreview(arquivoAtestadoRaw),
      file_uri_resolvido_preview: arquivoAtestado ? arquivoAtestado.slice(0, 220) : '',
      file_uri_pattern: pattern,
      storage_bucket: String(atestadoRecord?.storage_bucket || ''),
      storage_object_path_preview: String(atestadoRecord?.storage_object_path || '').slice(0, 180),
    });

    if (!storageLocation && !arquivoAtestado) return Response.json({ error: 'Este atestado não possui arquivo anexo.', code: 'NO_ATTACHMENT' }, { status: 404 });

    let location = storageLocation;
    const legacyAttachment = !storageLocation;

    if (!location) {
      if (pattern === 'https://' || pattern === 'http://') {
        // (P0) Anexos médicos legados com URL pública direta NÃO são mais
        // retornados automaticamente, pois bypassam TTL e controle de acesso.
        // Bloqueamos o retorno até que haja migração para storage assinado.
        console.warn('[getAtestadoAnexoSignedUrl] legacy_public_url_bloqueada', {
          atestado_id: atestadoId,
          file_uri_pattern: pattern,
        });
        return Response.json({
          error: 'Anexo legado com URL pública direta foi bloqueado por segurança. Requer migração para armazenamento assinado.',
          code: 'LEGACY_PUBLIC_URL_BLOCKED',
          legacy_attachment: true,
        }, { status: 403 });
      }
      location = parseStorageLocation(arquivoAtestado);
      if (!location) {
        return Response.json({ error: 'Anexo em formato inválido.', code: 'INVALID_ATTACHMENT_FORMAT', detail: { file_uri_pattern: pattern, file_uri_preview: arquivoAtestado.slice(0, 100) }, legacy_attachment: true }, { status: 422 });
      }
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('BASE44_SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('BASE44_SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) return Response.json({ error: 'Configuração de storage indisponível.' }, { status: 500 });

    const ttl = clampTtl(payload?.expires_in);
    const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
    const signed = await supabase.storage.from(location.bucket).createSignedUrl(location.objectPath, ttl);
    const signedData = signed?.data as Record<string, unknown> | null;
    const resolvedSignedUrl = String(signedData?.signedUrl || signedData?.signed_url || signedData?.url || signedData?.file_url || signedData?.download_url || '').trim();

    console.info('[getAtestadoAnexoSignedUrl] signed_url_response', {
      atestado_id: atestadoId,
      location,
      has_data: Boolean(signed?.data),
      keys_data: signedData ? Object.keys(signedData) : [],
      resolved_key: signedData?.signedUrl ? 'signedUrl' : signedData?.signed_url ? 'signed_url' : signedData?.url ? 'url' : signedData?.file_url ? 'file_url' : signedData?.download_url ? 'download_url' : '',
      resolved_url_preview: resolvedSignedUrl ? resolvedSignedUrl.slice(0, 220) : '',
      error_message: signed?.error?.message || '',
      error_status: (signed?.error as any)?.status || null,
    });

    if (signed.error || !resolvedSignedUrl) {
      return Response.json({ error: signed.error?.message || 'Falha ao gerar URL temporária.', code: 'SIGNED_URL_FAILED', detail: { status: (signed.error as any)?.status || null, storage_error: signed.error?.message || null } }, { status: 500 });
    }

    return Response.json({ url: resolvedSignedUrl, expires_in: ttl, atestado_id: atestadoId, source: 'signed_url', legacy_attachment: legacyAttachment });
  } catch (error) {
    const status = (error as any)?.response?.status || (error as any)?.status || 500;
    return Response.json({ error: (error as any)?.message || 'Erro ao gerar URL temporária do anexo.', code: 'UNEXPECTED_ERROR' }, { status });
  }
});