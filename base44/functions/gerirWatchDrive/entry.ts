import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * gerirWatchDrive
 *
 * Cria/renova/encerra canais de "push notifications" do Google Drive para cada
 * repositório documental ativo. O Drive notifica a URL pública desta função sempre
 * que houver mudanças, e ela dispara sincronizarAcervoDrive.
 *
 * Ações:
 *  - action: "renovar" (default) — cria watch novo se não houver ou se expirar em < 24h
 *  - action: "parar" — encerra o watch atual (requer repositorio_id)
 *
 * Drive watches expiram em até 7 dias. Configure uma automação cron a cada 6 dias
 * para chamar esta função com action: "renovar".
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

async function pararWatch(token, channelId, resourceId) {
  if (!channelId || !resourceId) return;
  await fetch('https://www.googleapis.com/drive/v3/channels/stop', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: channelId, resourceId })
  }).catch(() => {});
}

async function criarWatch(token, webhookUrl) {
  // Primeiro precisamos do startPageToken (cursor inicial das mudanças)
  const startRes = await fetch('https://www.googleapis.com/drive/v3/changes/startPageToken', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const startData = await startRes.json();
  if (startData.error) throw new Error(`startPageToken: ${startData.error.message}`);

  const channelId = crypto.randomUUID();
  const expirationMs = Date.now() + 6 * 24 * 60 * 60 * 1000; // 6 dias

  const watchRes = await fetch(
    `https://www.googleapis.com/drive/v3/changes/watch?pageToken=${startData.startPageToken}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: channelId,
        type: 'web_hook',
        address: webhookUrl,
        expiration: String(expirationMs)
      })
    }
  );
  const watchData = await watchRes.json();
  if (watchData.error) throw new Error(`watch: ${watchData.error.message}`);

  return {
    channelId,
    resourceId: watchData.resourceId,
    expiration: new Date(Number(watchData.expiration || expirationMs)).toISOString(),
    startPageToken: startData.startPageToken
  };
}

async function processarRepositorio(base44, credentials, repo, webhookUrl) {
  const token = await getAccessToken(credentials);

  const states = await base44.asServiceRole.entities.DriveSyncState.filter({ repositorio_id: repo.id });
  let state = states[0];

  // Para watch anterior se ainda existir
  if (state?.watch_channel_id && state?.watch_resource_id) {
    await pararWatch(token, state.watch_channel_id, state.watch_resource_id);
  }

  const watch = await criarWatch(token, webhookUrl);

  const dados = {
    repositorio_id: repo.id,
    drive_root_folder_id: repo.drive_root_folder_id,
    watch_channel_id: watch.channelId,
    watch_resource_id: watch.resourceId,
    watch_expiration: watch.expiration,
    ultimo_erro: ''
  };

  if (state) {
    await base44.asServiceRole.entities.DriveSyncState.update(state.id, dados);
  } else {
    await base44.asServiceRole.entities.DriveSyncState.create({
      ...dados,
      page_token: watch.startPageToken,
      ultima_sincronizacao: new Date().toISOString()
    });
  }

  return { repositorio: repo.nome, channel_id: watch.channelId, expira: watch.expiration };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const authUser = await base44.auth.me();
    if (!authUser || authUser.role !== 'admin') {
      return Response.json({ error: 'Acesso restrito a administradores.' }, { status: 403 });
    }

    const payload = await req.json().catch(() => ({}));
    const { action = 'renovar', repositorio_id, webhook_url } = payload;

    const credentialsStr = Deno.env.get('GOOGLE_DRIVE_CREDENTIALS');
    if (!credentialsStr) return Response.json({ error: 'GOOGLE_DRIVE_CREDENTIALS não configurado.' }, { status: 500 });
    const credentials = JSON.parse(credentialsStr);

    if (action === 'parar') {
      if (!repositorio_id) return Response.json({ error: 'repositorio_id obrigatório.' }, { status: 400 });
      const states = await base44.asServiceRole.entities.DriveSyncState.filter({ repositorio_id });
      const state = states[0];
      if (!state?.watch_channel_id) return Response.json({ ok: true, info: 'sem watch ativo' });
      const token = await getAccessToken(credentials);
      await pararWatch(token, state.watch_channel_id, state.watch_resource_id);
      await base44.asServiceRole.entities.DriveSyncState.update(state.id, {
        watch_channel_id: '',
        watch_resource_id: '',
        watch_expiration: ''
      });
      return Response.json({ ok: true, info: 'watch encerrado' });
    }

    // action === 'renovar'
    const driveWebhookUrl = webhook_url || Deno.env.get('DRIVE_WEBHOOK_URL');
    if (!driveWebhookUrl) {
      return Response.json({
        error: 'webhook_url é obrigatório. Informe a URL pública da função sincronizarAcervoDrive (ou configure o secret DRIVE_WEBHOOK_URL).'
      }, { status: 400 });
    }

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
        resultados.push(await processarRepositorio(base44, credentials, repo, driveWebhookUrl));
      } catch (err) {
        resultados.push({ repositorio: repo.nome, erro: err.message });
      }
    }

    return Response.json({ ok: true, resultados });
  } catch (error) {
    console.error('[gerirWatchDrive] Erro:', error);
    return Response.json({ error: error.message || 'Erro interno.' }, { status: 500 });
  }
});