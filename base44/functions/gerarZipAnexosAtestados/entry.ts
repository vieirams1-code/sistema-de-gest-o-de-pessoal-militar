// file generated
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { createClient } from 'npm:@supabase/supabase-js@2.49.8';
import JSZip from 'npm:jszip@3.10.1';

const MAX_FILES = 50;
const MAX_ESTIMATED_BYTES = 100 * 1024 * 1024;
const SIGNED_URL_TTL_SECONDS = 120;
const HEAD_TIMEOUT_MS = 4000;
const BASE44_APP_FILES_PREFIX = '/api/apps/';

const normalizeIds = (value: unknown) => Array.isArray(value) ? value.map((x) => String(x || '').trim()).filter(Boolean) : [];

function parseStorageLocation(fileRef: string) {
  const t = String(fileRef || '').trim();
  if (!t) return null;
  const m = t.match(/^([^/]+)\/(.+)$/);
  if (m && !t.startsWith('http://') && !t.startsWith('https://')) return { bucket: m[1], objectPath: m[2] };
  try {
    const u = new URL(t);
    const k = '/storage/v1/object/';
    const i = u.pathname.indexOf(k);
    if (i === -1) return null;
    const s = u.pathname.slice(i + k.length);
    const n = s.startsWith('public/') || s.startsWith('sign/') || s.startsWith('authenticated/') ? s.split('/').slice(1).join('/') : s;
    const p = n.split('/').filter(Boolean);
    if (p.length < 2) return null;
    return { bucket: p[0], objectPath: p.slice(1).join('/') };
  } catch {
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

function parseBase44AppFileUrl(rawUrl: string): { appId: string; filePath: string; hostPathSanitized: string } | null {
  try {
    const u = new URL(rawUrl);
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length < 5 || parts[0] !== 'api' || parts[1] !== 'apps' || parts[3] !== 'files') return null;
    const appId = String(parts[2] || '').trim();
    const filePath = parts.slice(4).join('/');
    if (!appId || !filePath) return null;
    return { appId, filePath, hostPathSanitized: `${u.host}${u.pathname}` };
  } catch {
    return null;
  }
}

const sanitize = (v: unknown) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80) || 'militar';
const inferExt = (path: string, ct: string | null) => {
  const e = String(path || '').split('.').pop() || '';
  if (/^[a-zA-Z0-9]{1,8}$/.test(e)) return e.toLowerCase();
  if (ct?.includes('pdf')) return 'pdf';
  if (ct?.includes('png')) return 'png';
  if (ct?.includes('jpeg') || ct?.includes('jpg')) return 'jpg';
  return 'bin';
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const authUser = await base44.auth.me();
    if (!authUser) return Response.json({ error: 'Não autenticado.' }, { status: 401 });

    let payload: Record<string, unknown> = {};
    try { payload = await req.json(); } catch {}

    const idsSelecionados = normalizeIds(payload.idsSelecionados);
    if (!idsSelecionados.length) return Response.json({ error: 'Nenhum atestado selecionado.' }, { status: 400 });

    const scopedResponse = await base44.functions.invoke('getScopedAtestadosBundle', payload);
    const scopedData = scopedResponse?.data ?? scopedResponse ?? {};
    const scopedAtestados = Array.isArray(scopedData?.atestados) ? scopedData.atestados : [];
    const scopedIds = new Set(scopedAtestados.map((a: any) => String(a?.id || '')));
    const autorizadosIds = idsSelecionados.filter((id) => scopedIds.has(id));
    const semEscopo = idsSelecionados.length - autorizadosIds.length;

    const autorizadosOriginais = await Promise.all(autorizadosIds.map((id) => base44.entities.Atestado.get(id).catch(() => null)));
    const autorizados = autorizadosOriginais.filter(Boolean);
    const comAnexo = autorizados.filter((a: any) => extractArquivoFileUri(a?.arquivo_atestado));
    const semAnexo = autorizados.length - comAnexo.length;

    if (!comAnexo.length) return Response.json({ error: 'Nenhum selecionado possui anexo.', code: 'NO_VALID_ATTACHMENTS', detail: 'Nenhum atestado com arquivo_atestado utilizável foi encontrado no escopo autorizado.', meta: { quantidade_anexos: 0, arquivos_ignorados_sem_anexo: semAnexo, arquivos_fora_escopo: semEscopo } }, { status: 422 });
    if (comAnexo.length > MAX_FILES) return Response.json({ error: 'Limite de anexos excedido.', code: 'LIMIT_EXCEEDED', meta: { limite_arquivos: MAX_FILES, quantidade_anexos: comAnexo.length, arquivos_ignorados_sem_anexo: semAnexo, limite_excedido: true } }, { status: 422 });

    // Supabase é OPCIONAL: só inicializado se houver pelo menos um anexo
    // que precise de signed URL (ou seja, anexos que NÃO são URLs HTTPS diretas).
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('BASE44_SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('BASE44_SUPABASE_SERVICE_ROLE_KEY');
    const precisaSupabase = comAnexo.some((a: any) => {
      const u = extractArquivoFileUri(a?.arquivo_atestado);
      return u && !u.startsWith('http://') && !u.startsWith('https://');
    });
    if (precisaSupabase && (!supabaseUrl || !supabaseKey)) {
      return Response.json({ error: 'Configuração de storage indisponível.', code: 'STORAGE_CONFIG_UNAVAILABLE', detail: 'SUPABASE_URL/BASE44_SUPABASE_URL ou SERVICE_ROLE_KEY ausentes para assinar anexos internos.', meta: { quantidade_anexos: comAnexo.length } }, { status: 500 });
    }
    const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } }) : null;
    const prepared: Array<{ atestado: any; signedUrl: string; objectPath: string; storageLocation: { bucket: string; objectPath: string } | null }> = [];
    const skipped: Array<{ atestado_id: string; code: string; message: string }> = [];
    let estimatedBytes = 0;

    for (const atestado of comAnexo) {
      const rawArquivo = extractArquivoFileUri(atestado?.arquivo_atestado);

      let signedUrl: string | null = null;
      let objectPath: string = '';
      let storageLocation: { bucket: string; objectPath: string } | null = null;

      const parsedLocation = parseStorageLocation(rawArquivo);
      if (parsedLocation) storageLocation = parsedLocation;

      if ((rawArquivo.startsWith('http://') || rawArquivo.startsWith('https://')) && !storageLocation) {
        const base44FileUrl = parseBase44AppFileUrl(rawArquivo);
        if (base44FileUrl) {
          skipped.push({
            atestado_id: String(atestado?.id || ''),
            code: 'UNSUPPORTED_BASE44_FILE_URL',
            message: `URL Base44 não mapeável para storage nativo: ${base44FileUrl.hostPathSanitized}`,
          });
          continue;
        }
        signedUrl = rawArquivo;
        try { objectPath = new URL(rawArquivo).pathname; } catch { objectPath = rawArquivo; }
      } else {
        const location = storageLocation;
        if (!location || !supabase) { skipped.push({ atestado_id: String(atestado?.id || ''), code: 'INVALID_FILE_REF', message: 'Referência de arquivo inválida para assinatura.' }); continue; }
        const signed = await supabase.storage.from(location.bucket).createSignedUrl(location.objectPath, SIGNED_URL_TTL_SECONDS);
        if (signed.error || !signed.data?.signedUrl) { skipped.push({ atestado_id: String(atestado?.id || ''), code: 'SIGNED_URL_FAILED', message: String(signed.error?.message || 'Falha ao gerar signed URL.') }); continue; }
        signedUrl = signed.data.signedUrl;
        objectPath = location.objectPath;
      }

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), HEAD_TIMEOUT_MS);
        const head = await fetch(signedUrl, { method: 'HEAD', signal: controller.signal });
        clearTimeout(timeout);
        if (head.ok) {
          const size = Number(head.headers.get('content-length') || 0);
          if (Number.isFinite(size) && size > 0) estimatedBytes += size;
        }
      } catch (_headError) {
        console.warn('[gerarZipAnexosAtestados] head_falhou', { atestado_id: String(atestado?.id || '') });
      }

      if (estimatedBytes > MAX_ESTIMATED_BYTES) {
        return Response.json({ error: 'Limite de tamanho excedido.', code: 'LIMIT_EXCEEDED', meta: { limite_bytes: MAX_ESTIMATED_BYTES, tamanho_estimado_bytes: estimatedBytes, quantidade_anexos: prepared.length + 1, arquivos_ignorados_sem_anexo: semAnexo, limite_excedido: true } }, { status: 422 });
      }

      prepared.push({ atestado, signedUrl, objectPath, storageLocation });
    }

    if (!prepared.length) return Response.json({ error: 'Nenhum anexo autorizado disponível para compactação.', code: 'NO_VALID_ATTACHMENTS', detail: 'Todos os anexos falharam na etapa de preparação (referência inválida ou signed URL).', meta: { skipped } }, { status: 422 });

    const zip = new JSZip();
    let addedFiles = 0;
    for (const item of prepared) {
      let buffer: ArrayBuffer;
      let contentType: string | null = null;
      if (item.storageLocation && supabase) {
        const downloaded = await supabase.storage.from(item.storageLocation.bucket).download(item.storageLocation.objectPath);
        if (downloaded.error || !downloaded.data) {
          skipped.push({ atestado_id: String(item.atestado?.id || ''), code: 'ATTACHMENT_DOWNLOAD_FAILED', message: String(downloaded.error?.message || 'Falha no download via storage API') });
          continue;
        }
        contentType = downloaded.data.type || null;
        buffer = await downloaded.data.arrayBuffer();
      } else {
        let fetchedUrlPath = '';
        try {
          const u = new URL(item.signedUrl);
          fetchedUrlPath = u.pathname;
          if (u.pathname.includes(BASE44_APP_FILES_PREFIX)) {
            skipped.push({ atestado_id: String(item.atestado?.id || ''), code: 'UNSUPPORTED_BASE44_FILE_URL', message: `URL Base44 não suportada para fetch: ${u.host}${u.pathname}` });
            continue;
          }
        } catch {
          fetchedUrlPath = item.signedUrl;
        }
        const res = await fetch(item.signedUrl);
        if (!res.ok) {
          skipped.push({ atestado_id: String(item.atestado?.id || ''), code: 'ATTACHMENT_FETCH_FAILED', message: `Falha no fetch do anexo (${fetchedUrlPath || 'url_externa'}): HTTP ${res.status}` });
          continue;
        }
        contentType = res.headers.get('content-type');
        buffer = await res.arrayBuffer();
      }
      const safeMilitar = sanitize(item.atestado?.militar_nome || item.atestado?.militar_id);
      const atestadoId = sanitize(item.atestado?.id || 'atestado');
      const data = String(item.atestado?.data_inicio || '').slice(0, 10).replaceAll('-', '') || 'sem_data';
      const ext = inferExt(item.objectPath, contentType);
      zip.file(`${data}_${safeMilitar}_${atestadoId}.${ext}`, buffer);
      addedFiles += 1;
    }

    if (!addedFiles) {
      return Response.json({ error: 'Nenhum arquivo válido pôde ser baixado para compactação.', code: 'NO_VALID_ATTACHMENTS', detail: 'Todos os downloads de anexos falharam na etapa de fetch.', meta: { skipped } }, { status: 422 });
    }

    let zipBuffer: Uint8Array;
    try {
      zipBuffer = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    } catch (zipError) {
      return Response.json({ error: 'Falha ao compactar anexos.', code: 'ZIP_GENERATION_FAILED', detail: String((zipError as any)?.message || zipError), meta: { skipped, quantidade_anexos_preparados: prepared.length, quantidade_anexos_adicionados: addedFiles } }, { status: 500 });
    }
    const ts = new Date().toISOString().slice(0, 10);
    return new Response(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="anexos-atestados-${ts}.zip"`,
        'Cache-Control': 'no-store',
        'X-Quantidade-Anexos': String(addedFiles),
        'X-Arquivos-Ignorados-Sem-Anexo': String(semAnexo),
        'X-Extrato-Parcial': String(autorizadosIds.length < idsSelecionados.length || addedFiles < prepared.length),
        'X-Arquivos-Ignorados-Falha': String(skipped.length),
      },
    });
  } catch (error) {
    const status = (error as any)?.response?.status || (error as any)?.status || 500;
    return Response.json({ error: (error as any)?.message || 'Erro ao gerar ZIP dos anexos.', code: String((error as any)?.code || 'ZIP_RUNTIME_ERROR'), detail: (error as any)?.detail || null, meta: (error as any)?.meta || null }, { status });
  }
});
