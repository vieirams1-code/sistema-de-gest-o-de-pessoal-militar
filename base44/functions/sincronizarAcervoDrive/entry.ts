import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * sincronizarAcervoDrive
 *
 * Sincroniza incrementalmente os documentos do Google Drive (via Service Account)
 * com a entidade AcervoFuncionalHistorico. Para cada repositório ativo:
 *  - Mantém um page_token na entidade DriveSyncState (cursor da Drive Changes API)
 *  - Resolve a pasta pai de cada arquivo alterado para descobrir a matrícula do militar
 *    (regra: nome da pasta CONTÉM a matrícula)
 *  - Cria/atualiza/marca como excluído o registro em AcervoFuncionalHistorico
 *
 * Pode ser chamada:
 *  - Manualmente pelo admin (botão "Sincronizar agora")
 *  - Por automação connector/cron
 *  - Como handler de push notification do Drive (channel_id no header X-Goog-Channel-Id)
 */

async function getAccessToken(credentials) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };
  const enc = (obj) => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const signatureInput = `${enc(header)}.${enc(claim)}`;
  const pemBody = credentials.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\n/g, '');
  const binaryDer = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', binaryDer.buffer, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signatureInput));
  const encodedSig = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const jwt = `${signatureInput}.${encodedSig}`;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error_description || data.error);
  return data.access_token;
}

async function driveFetch(url, token) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  if (data.error) throw new Error(`Drive API: ${data.error.message}`);
  return data;
}

/**
 * Tenta extrair matrícula de um nome de pasta (regra: pasta CONTÉM a matrícula).
 * Retorna o militar correspondente ou null.
 */
async function resolverMilitarPorPasta(base44, folderName, cacheMilitares) {
  if (!folderName) return null;
  for (const militar of cacheMilitares) {
    const mat = (militar.matricula || '').trim();
    if (mat && folderName.includes(mat)) {
      return militar;
    }
  }
  return null;
}

/**
 * Processa uma página de mudanças do Drive.
 */
async function processarMudancas(base44, token, changes, repositorio, cacheMilitares) {
  let aplicadas = 0;
  let ignoradas = 0;

  for (const change of changes) {
    const file = change.file;
    const fileId = change.fileId;

    // Arquivo removido / lixeira
    if (change.removed || (file && file.trashed)) {
      const existentes = await base44.asServiceRole.entities.AcervoFuncionalHistorico.filter({
        drive_file_id: fileId,
        ativo: true
      });
      for (const reg of existentes) {
        await base44.asServiceRole.entities.AcervoFuncionalHistorico.update(reg.id, {
          ativo: false,
          deleted_at: new Date().toISOString(),
          deleted_by: 'drive_sync'
        });
      }
      ignoradas++;
      continue;
    }

    if (!file || file.mimeType === 'application/vnd.google-apps.folder') {
      ignoradas++;
      continue;
    }

    // Pasta pai imediata (subpasta de tipo) -> pasta avô (matrícula)
    const parentId = (file.parents || [])[0];
    if (!parentId) { ignoradas++; continue; }

    const subpasta = await driveFetch(
      `https://www.googleapis.com/drive/v3/files/${parentId}?fields=id,name,parents`,
      token
    ).catch(() => null);
    if (!subpasta) { ignoradas++; continue; }

    const grandParentId = (subpasta.parents || [])[0];
    const pastaMilitar = grandParentId
      ? await driveFetch(`https://www.googleapis.com/drive/v3/files/${grandParentId}?fields=id,name`, token).catch(() => null)
      : null;

    // Tenta resolver pela pasta avô (matrícula); se falhar, tenta pela pasta pai
    let militar = pastaMilitar ? await resolverMilitarPorPasta(base44, pastaMilitar.name, cacheMilitares) : null;
    if (!militar) {
      militar = await resolverMilitarPorPasta(base44, subpasta.name, cacheMilitares);
    }
    if (!militar) { ignoradas++; continue; }

    // Mapeia subpasta -> tipo_documento
    const subNome = (subpasta.name || '').toLowerCase();
    let tipo_documento = 'DIVERSOS';
    if (subNome.includes('altera')) tipo_documento = 'ALTERACAO';
    else if (subNome.includes('comportamento')) tipo_documento = 'CERTIDAO_COMPORTAMENTO';

    // Upsert pelo drive_file_id
    const existentes = await base44.asServiceRole.entities.AcervoFuncionalHistorico.filter({
      drive_file_id: fileId
    });

    const payload = {
      militar_id: militar.id,
      tipo_documento,
      titulo: file.name,
      repositorio_id: repositorio.id,
      drive_file_id: fileId,
      drive_folder_id: parentId,
      drive_url: `https://drive.google.com/file/d/${fileId}/view`,
      matricula_utilizada: militar.matricula,
      usuario_cadastro: 'drive_sync',
      status_documento: 'ATIVO',
      ativo: true,
      arquivado: false,
      confianca_identificacao: 'MEDIA',
      validado: false
    };

    if (existentes.length > 0) {
      await base44.asServiceRole.entities.AcervoFuncionalHistorico.update(existentes[0].id, payload);
    } else {
      await base44.asServiceRole.entities.AcervoFuncionalHistorico.create(payload);
    }
    aplicadas++;
  }

  return { aplicadas, ignoradas };
}

async function sincronizarRepositorio(base44, credentials, repositorio) {
  const token = await getAccessToken(credentials);

  // Carrega/cria SyncState
  const states = await base44.asServiceRole.entities.DriveSyncState.filter({ repositorio_id: repositorio.id });
  let state = states[0];

  if (!state) {
    const tokenData = await driveFetch('https://www.googleapis.com/drive/v3/changes/startPageToken', token);
    state = await base44.asServiceRole.entities.DriveSyncState.create({
      repositorio_id: repositorio.id,
      drive_root_folder_id: repositorio.drive_root_folder_id,
      page_token: tokenData.startPageToken,
      ultima_sincronizacao: new Date().toISOString()
    });
    return { repositorio: repositorio.nome, inicializado: true, aplicadas: 0, ignoradas: 0 };
  }

  // Cache de militares (1x por repositório)
  const cacheMilitares = await base44.asServiceRole.entities.Militar.list();

  let pageToken = state.page_token;
  let newStartPageToken = null;
  let totalAplicadas = 0;
  let totalIgnoradas = 0;

  while (pageToken) {
    const url = `https://www.googleapis.com/drive/v3/changes?pageToken=${pageToken}&fields=changes(fileId,removed,file(id,name,mimeType,parents,trashed)),newStartPageToken,nextPageToken`;
    const page = await driveFetch(url, token);
    const { aplicadas, ignoradas } = await processarMudancas(base44, token, page.changes || [], repositorio, cacheMilitares);
    totalAplicadas += aplicadas;
    totalIgnoradas += ignoradas;
    if (page.newStartPageToken) newStartPageToken = page.newStartPageToken;
    pageToken = page.nextPageToken || null;
  }

  if (newStartPageToken) {
    await base44.asServiceRole.entities.DriveSyncState.update(state.id, {
      page_token: newStartPageToken,
      ultima_sincronizacao: new Date().toISOString(),
      ultimo_erro: ''
    });
  }

  return { repositorio: repositorio.nome, aplicadas: totalAplicadas, ignoradas: totalIgnoradas };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Detecta se é push notification do Drive (header X-Goog-Channel-Id)
    const channelId = req.headers.get('x-goog-channel-id');
    const resourceState = req.headers.get('x-goog-resource-state');

    const credentialsStr = Deno.env.get('GOOGLE_DRIVE_CREDENTIALS');
    if (!credentialsStr) return Response.json({ error: 'GOOGLE_DRIVE_CREDENTIALS não configurado.' }, { status: 500 });
    const credentials = JSON.parse(credentialsStr);

    // Caminho 1: Push notification do Drive
    if (channelId) {
      if (resourceState === 'sync') return Response.json({ ok: true, ack: 'sync' });
      const states = await base44.asServiceRole.entities.DriveSyncState.filter({ watch_channel_id: channelId });
      if (states.length === 0) return Response.json({ ok: true, ignored: 'unknown_channel' });
      const repo = await base44.asServiceRole.entities.RepositorioDocumental.get(states[0].repositorio_id);
      if (!repo) return Response.json({ ok: true, ignored: 'repo_missing' });
      try {
        const result = await sincronizarRepositorio(base44, credentials, repo);
        return Response.json({ ok: true, push: true, result });
      } catch (err) {
        await base44.asServiceRole.entities.DriveSyncState.update(states[0].id, { ultimo_erro: err.message });
        throw err;
      }
    }

    // Caminho 2: Invocação manual/cron — exige admin
    const authUser = await base44.auth.me();
    if (!authUser || authUser.role !== 'admin') {
      return Response.json({ error: 'Acesso restrito a administradores.' }, { status: 403 });
    }

    const payload = await req.json().catch(() => ({}));
    const { repositorio_id } = payload;

    let repositorios;
    if (repositorio_id) {
      const repo = await base44.asServiceRole.entities.RepositorioDocumental.get(repositorio_id);
      repositorios = repo ? [repo] : [];
    } else {
      repositorios = await base44.asServiceRole.entities.RepositorioDocumental.filter({ ativo: true, status: 'ATIVO' }, 'ordem_prioridade');
    }

    const resultados = [];
    for (const repo of repositorios) {
      try {
        resultados.push(await sincronizarRepositorio(base44, credentials, repo));
      } catch (err) {
        const states = await base44.asServiceRole.entities.DriveSyncState.filter({ repositorio_id: repo.id });
        if (states[0]) {
          await base44.asServiceRole.entities.DriveSyncState.update(states[0].id, { ultimo_erro: err.message });
        }
        resultados.push({ repositorio: repo.nome, erro: err.message });
      }
    }

    return Response.json({ ok: true, resultados });
  } catch (error) {
    console.error('[sincronizarAcervoDrive] Erro:', error);
    return Response.json({ error: error.message || 'Erro interno.' }, { status: 500 });
  }
});