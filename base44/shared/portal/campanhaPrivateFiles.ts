const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_BODY_BYTES = 16 * 1024 * 1024;
const fail = (message: string, status = 400): never => { throw Object.assign(new Error(message), { status, code: 'PORTAL_ANEXO_VALIDATION' }); };
// O armazenamento privado devolve a referência como "<escopo>/private/<caminho>"
// (ex.: "mp/private/<app>/<arquivo>"); aceitamos também o formato curto "private/...".
const PRIVATE_CAMPAIGN_FILE_RE = /^(?:[a-z0-9_-]+\/)?private\/[^\s?#\\]+$/i;
export const isPrivateCampaignFile = (value: any) => typeof value === 'string' && PRIVATE_CAMPAIGN_FILE_RE.test(value) && !value.includes('..');

export async function readCampaignMultipart(req: Request) {
  const declared = Number(req.headers.get('content-length') || 0);
  if (declared > MAX_BODY_BYTES) fail('Arquivo excede o limite de 15MB.', 413);
  if (!req.body) fail('Arquivo não informado.');
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) { await reader.cancel(); fail('Arquivo excede o limite de 15MB.', 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const form = await new Request(req.url, { method: 'POST', headers: { 'Content-Type': req.headers.get('content-type') || '' }, body: bytes }).formData();
  for (const key of form.keys()) if (['militar_id','militarid'].includes(key.toLowerCase())) fail('IDOR_BLOCKED: militar_id não pode ser informado.');
  return { payload: { acao: String(form.get('acao') || ''), campanha_id: String(form.get('campanha_id') || ''), campo_id: String(form.get('campo_id') || '') }, file: form.get('file') };
}

export async function requireCampaignFile(base44: any, uri: any, militarId: string, campanhaId: string, campoId?: string) {
  if (!isPrivateCampaignFile(uri)) fail('Referência de anexo privado inválida.');
  const rows = await base44.asServiceRole.entities.PortalAnexo.filter({ file_uri: uri, militar_id: militarId, campanha_id: campanhaId }, undefined, 2);
  const record = rows?.length === 1 ? rows[0] : null;
  if (!record || (campoId !== undefined && record.campo_id !== campoId)) fail('Anexo não pertence a este militar, campanha ou pergunta.', 403);
  return record;
}

export async function uploadCampaignFile(base44: any, file: any, militarId: string, campaign: any, campoId: string) {
  if (!(file instanceof File) || !file.size || file.size > MAX_FILE_BYTES) fail('Arquivo vazio ou acima do limite de 15MB.');
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!['pdf','png','jpg','jpeg','doc','docx','xls','xlsx'].includes(ext || '')) fail('Formato de arquivo não permitido.');
  const form = typeof campaign.config_formulario === 'string' ? JSON.parse(campaign.config_formulario || '{}') : campaign.config_formulario || {};
  const returnFile = campoId === 'devolucao' && campaign.tipo === 'ASSINATURA_DOCUMENTO';
  if (!returnFile && !(form.campos || []).some((field: any) => field.id === campoId && field.tipo === 'upload_arquivo')) fail('Pergunta de anexo inválida.');
  const core = base44.asServiceRole.integrations.Core;
  const result = await core.UploadPrivateFile({ file });
  if (!isPrivateCampaignFile(result?.file_uri)) fail('O armazenamento não confirmou um arquivo privado.', 502);
  const name = file.name.replace(/[\r\n]/g, '').slice(0, 200);
  await base44.asServiceRole.entities.PortalAnexo.create({
    file_uri: result.file_uri, militar_id: militarId, campanha_id: campaign.id,
    campo_id: campoId, nome: name, tamanho: file.size, created_at: new Date().toISOString(),
  });
  const signed = await core.CreateFileSignedUrl({ file_uri: result.file_uri, expires_in: 300 });
  if (!signed?.signed_url) fail('Não foi possível abrir o anexo privado.', 502);
  return { url: result.file_uri, signed_url: signed.signed_url, nome: name, tamanho: file.size };
}

export async function signCampaignReference(base44: any, uri: any, militarId: string, campanhaId: string, campoId: string) {
  if (!uri || !isPrivateCampaignFile(uri)) return uri || '';
  await requireCampaignFile(base44, uri, militarId, campanhaId, campoId);
  const result = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({ file_uri: uri, expires_in: 300 });
  if (!result?.signed_url) fail('Não foi possível abrir o anexo privado.', 502);
  return result.signed_url;
}

export async function signCampaignResponse(base44: any, response: any, forPortal = false) {
  if (!response) return response;
  const out = { ...response };
  if (out.arquivo_devolucao_url) {
    const url = await signCampaignReference(base44, out.arquivo_devolucao_url, out.militar_id, out.campanha_id, 'devolucao');
    if (forPortal) out.arquivo_devolucao_signed_url = url;
    else out.arquivo_devolucao_url = url;
  }
  const files = typeof out.arquivos_anexados_json === 'string' ? JSON.parse(out.arquivos_anexados_json || '{}') : out.arquivos_anexados_json || {};
  const signedFiles: Record<string, any> = {};
  for (const [field, item] of Object.entries(files)) {
    const uri = typeof item === 'string' ? item : (item as any)?.url;
    const url = await signCampaignReference(base44, uri, out.militar_id, out.campanha_id, field);
    signedFiles[field] = forPortal ? { ...(typeof item === 'object' ? item : { url: uri }), signed_url: url } : (typeof item === 'string' ? url : { ...item as any, url });
  }
  out.arquivos_anexados_json = JSON.stringify(signedFiles);
  return out;
}