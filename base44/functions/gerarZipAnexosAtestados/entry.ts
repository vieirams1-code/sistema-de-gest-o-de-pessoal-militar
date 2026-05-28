// file generated
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { createClient } from 'npm:@supabase/supabase-js@2.49.8';
import JSZip from 'npm:jszip@3.10.1';

const MAX_FILES = 50;
const LEGACY_ATTACHMENT_UNSUPPORTED = 'LEGACY_ATTACHMENT_UNSUPPORTED';
const NO_ZIP_COMPATIBLE_ATTACHMENTS = 'NO_ZIP_COMPATIBLE_ATTACHMENTS';
const LEGACY_ATTACHMENT_REASON = 'Anexo legado sem metadados de storage; pode ser aberto individualmente, mas não compactado.';

const normalizeIds = (value: unknown) => Array.isArray(value) ? value.map((x) => String(x || '').trim()).filter(Boolean) : [];

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

    const autorizadosOriginais = await Promise.all(autorizadosIds.map((id) => base44.entities.Atestado.get(id).catch(() => null)));
    const autorizados = autorizadosOriginais.filter(Boolean);

    const skipped: Array<{ atestado_id: string; code: string; reason: string }> = [];
    const skipLegacyAttachment = (atestado: any) => {
      skipped.push({
        atestado_id: String(atestado?.id || ''),
        code: LEGACY_ATTACHMENT_UNSUPPORTED,
        reason: LEGACY_ATTACHMENT_REASON,
      });
    };
    const buildNoZipCompatibleResponse = () => Response.json({
      error: 'Nenhum anexo selecionado possui metadados compatíveis com ZIP.',
      code: NO_ZIP_COMPATIBLE_ATTACHMENTS,
      message: 'Nenhum anexo selecionado possui metadados compatíveis com ZIP.',
      detail: 'Anexos antigos podem ser abertos individualmente, mas não compactados automaticamente.',
      meta: {
        totalSelecionados: idsSelecionados.length,
        legacy_attachment_count: skipped.filter((item) => item.code === LEGACY_ATTACHMENT_UNSUPPORTED).length,
        unsupported_count: skipped.length,
        skipped,
      },
    }, { status: 422 });

    // MODO PRODUÇÃO: ZIP somente para anexos com storage_bucket + storage_object_path.
    // Anexos legados (sem storage metadata) são ignorados antes de qualquer signed URL, fetch,
    // download, HEAD ou interpretação de arquivo_atestado/file_url/url HTTP/Base44 legado.
    const comStorageMetadata: any[] = [];
    for (const atestado of autorizados) {
      const storage_bucket = String(atestado?.storage_bucket || '').trim();
      const storage_object_path = String(atestado?.storage_object_path || '').trim();
      if (!storage_bucket || !storage_object_path) {
        skipLegacyAttachment(atestado);
        continue;
      }
      comStorageMetadata.push({ ...atestado, storage_bucket, storage_object_path });
    }

    const semAnexo = skipped.length;
    const legacyAttachmentCount = skipped.filter((item) => item.code === LEGACY_ATTACHMENT_UNSUPPORTED).length;

    if (!comStorageMetadata.length) {
      return buildNoZipCompatibleResponse();
    }
    if (comStorageMetadata.length > MAX_FILES) return Response.json({ error: 'Limite de anexos excedido.', code: 'LIMIT_EXCEEDED', meta: { limite_arquivos: MAX_FILES, quantidade_anexos: comStorageMetadata.length, arquivos_ignorados_sem_anexo: semAnexo, limite_excedido: true } }, { status: 422 });

    const comAnexo = comStorageMetadata;

    // ZIP exige storage metadata, portanto Supabase é obrigatório.
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('BASE44_SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('BASE44_SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseKey) {
      return Response.json({ error: 'Configuração de storage indisponível.', code: 'STORAGE_CONFIG_UNAVAILABLE', detail: 'SUPABASE_URL/BASE44_SUPABASE_URL ou SERVICE_ROLE_KEY ausentes para assinar anexos internos.', meta: { quantidade_anexos: comAnexo.length } }, { status: 500 });
    }
    const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
    const prepared: Array<{ atestado: any; objectPath: string; storageLocation: { bucket: string; objectPath: string } }> = [];

    for (const atestado of comAnexo) {
      const storage_bucket = String(atestado?.storage_bucket || '').trim();
      const storage_object_path = String(atestado?.storage_object_path || '').trim();
      if (!storage_bucket || !storage_object_path) {
        skipLegacyAttachment(atestado);
        continue;
      }

      const storageLocation = {
        bucket: storage_bucket,
        objectPath: storage_object_path,
      };
      prepared.push({ atestado, objectPath: storageLocation.objectPath, storageLocation });
    }

    if (!prepared.length) return buildNoZipCompatibleResponse();

    const zip = new JSZip();
    let addedFiles = 0;
    for (const item of prepared) {
      const storage_bucket = String(item.storageLocation?.bucket || '').trim();
      const storage_object_path = String(item.storageLocation?.objectPath || '').trim();
      if (!storage_bucket || !storage_object_path) {
        skipLegacyAttachment(item.atestado);
        continue;
      }

      const downloaded = await supabase.storage.from(storage_bucket).download(storage_object_path);
      if (downloaded.error || !downloaded.data) {
        skipped.push({ atestado_id: String(item.atestado?.id || ''), code: 'ATTACHMENT_DOWNLOAD_FAILED', reason: String(downloaded.error?.message || 'Falha no download via storage API') });
        continue;
      }
      const contentType = downloaded.data.type || null;
      const buffer = await downloaded.data.arrayBuffer();
      const safeMilitar = sanitize(item.atestado?.militar_nome || item.atestado?.militar_id);
      const atestadoId = sanitize(item.atestado?.id || 'atestado');
      const data = String(item.atestado?.data_inicio || '').slice(0, 10).replaceAll('-', '') || 'sem_data';
      const ext = inferExt(item.objectPath, contentType);
      zip.file(`${data}_${safeMilitar}_${atestadoId}.${ext}`, buffer);
      addedFiles += 1;
    }

    if (!addedFiles) {
      return buildNoZipCompatibleResponse();
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
        'X-Legacy-Attachment-Count': String(legacyAttachmentCount),
      },
    });
  } catch (error) {
    const status = (error as any)?.response?.status || (error as any)?.status || 500;
    return Response.json({ error: (error as any)?.message || 'Erro ao gerar ZIP dos anexos.', code: String((error as any)?.code || 'ZIP_RUNTIME_ERROR'), detail: (error as any)?.detail || null, meta: (error as any)?.meta || null }, { status });
  }
});