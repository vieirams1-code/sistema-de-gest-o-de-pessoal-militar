import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * gerirAcervoHistorico
 *
 * Faz upload do documento histórico DIRETAMENTE no storage do Base44
 * (sem dependências externas como Google Drive) e persiste o registro
 * em AcervoFuncionalHistorico. Mantém detecção de duplicidade por SHA-256
 * e versionamento.
 *
 * Payload esperado:
 *   {
 *     militar_id: string,
 *     tipo_documento: string,
 *     data: { ...campos da entidade, confirmar_duplicidade?: boolean, substitui_documento_id?: string },
 *     file: { name: string, type: string, content: string (base64) }
 *   }
 */

function base64ToBlob(base64, mimeType) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType || 'application/octet-stream' });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const authUser = await base44.auth.me();
    if (!authUser) return Response.json({ error: 'Não autenticado.' }, { status: 401 });

    const payload = await req.json().catch(() => ({}));
    const { militar_id, tipo_documento, data, file } = payload;

    if (!militar_id || !tipo_documento || !data || !file?.content) {
      return Response.json({ error: 'Parâmetros insuficientes.' }, { status: 400 });
    }

    // 1. Hash SHA-256 + tamanho
    const binaryString = atob(file.content);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
    const arquivo_sha256 = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    const arquivo_tamanho = bytes.byteLength;

    // 2. Detectar duplicidade
    const duplicados = await base44.asServiceRole.entities.AcervoFuncionalHistorico.filter({
      militar_id,
      arquivo_sha256,
      ativo: true
    });
    if (duplicados.length > 0 && !data.confirmar_duplicidade) {
      return Response.json({ error: 'DUPLICIDADE_DETECTADA', documento: duplicados[0] }, { status: 409 });
    }

    // 3. Localizar militar
    const militar = await base44.asServiceRole.entities.Militar.get(militar_id);
    if (!militar) return Response.json({ error: 'Militar não encontrado.' }, { status: 404 });

    // 4. Versionamento
    let versao = 1;
    const substitui_documento_id = data.substitui_documento_id || null;
    if (substitui_documento_id) {
      const docAnterior = await base44.asServiceRole.entities.AcervoFuncionalHistorico.get(substitui_documento_id);
      if (docAnterior) versao = (Number(docAnterior.versao) || 1) + 1;
    }

    // 5. Upload no storage do Base44
    const blob = base64ToBlob(file.content, file.type);
    const fileObj = new File([blob], file.name || 'documento', { type: file.type });
    const uploadResult = await base44.asServiceRole.integrations.Core.UploadFile({ file: fileObj });
    const arquivo_url = uploadResult?.file_url;
    if (!arquivo_url) {
      return Response.json({ error: 'Falha ao salvar arquivo no storage.' }, { status: 500 });
    }

    // 6. Persistir registro
    const { confirmar_duplicidade, substituir_existente, ...dataToSave } = data;
    const registroAcervo = await base44.asServiceRole.entities.AcervoFuncionalHistorico.create({
      ...dataToSave,
      militar_id,
      tipo_documento,
      arquivo_url,
      drive_url: arquivo_url,
      usuario_cadastro: authUser.email,
      status_documento: 'ATIVO',
      versao,
      substitui_documento_id,
      arquivo_sha256,
      arquivo_tamanho,
      matricula_utilizada: militar.matricula,
      ativo: true,
      arquivado: false
    });

    if (substitui_documento_id) {
      await base44.asServiceRole.entities.AcervoFuncionalHistorico.update(substitui_documento_id, {
        status_documento: 'SUBSTITUIDO'
      });
    }

    return Response.json({ ok: true, registro: registroAcervo });
  } catch (error) {
    console.error('[gerirAcervoHistorico] Erro:', error);
    return Response.json({ error: error.message || 'Erro interno.' }, { status: 500 });
  }
});