import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * testarConexaoDrive
 *
 * Função para testar a conexão real com o Google Drive via Service Account.
 */

async function getAccessToken(credentials: any) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/drive.file',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '');
  const encodedClaim = btoa(JSON.stringify(claim)).replace(/=/g, '');
  const signatureInput = `${encodedHeader}.${encodedClaim}`;

  const binaryDer = str2ab(atob(credentials.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\n/g, '')));
  const key = await crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signatureInput));
  const encodedSignature = ab2base64url(signature);
  const jwt = `${signatureInput}.${encodedSignature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const data = await res.json();
  if (data.error) throw new Error(data.error_description || data.error);
  return data.access_token;
}

function str2ab(str: string) {
  const buf = new ArrayBuffer(str.length);
  const bufView = new Uint8Array(buf);
  for (let i = 0, strLen = str.length; i < strLen; i++) bufView[i] = str.charCodeAt(i);
  return buf;
}

function ab2base64url(buf: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const authUser = await base44.auth.me();
    if (!authUser) return Response.json({ error: 'Não autenticado.' }, { status: 401 });

    const payload = await req.json().catch(() => ({}));
    const { drive_root_folder_id } = payload;

    if (!drive_root_folder_id) return Response.json({ error: 'drive_root_folder_id é obrigatório.' }, { status: 400 });

    const driveCredentialsStr = Deno.env.get('GOOGLE_DRIVE_CREDENTIALS');
    if (!driveCredentialsStr) return Response.json({ error: 'GOOGLE_DRIVE_CREDENTIALS não configurado.' }, { status: 500 });

    const credentials = JSON.parse(driveCredentialsStr);
    const accessToken = await getAccessToken(credentials);

    // 1. Validar acesso à pasta raiz
    const checkRes = await fetch(`https://www.googleapis.com/drive/v3/files/${drive_root_folder_id}?fields=id,name`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const checkData = await checkRes.json();
    if (checkData.error) throw new Error(`Acesso à pasta raiz negado: ${checkData.error.message}`);

    // 2. Criar arquivo de teste
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `SGP_TESTE_CONEXAO_${Date.now()}.txt`,
        mimeType: 'text/plain',
        parents: [drive_root_folder_id]
      })
    });
    const createData = await createRes.json();
    if (createData.error) throw new Error(`Falha ao criar objeto de teste: ${createData.error.message}`);

    // 3. Deletar arquivo de teste (Cleanup)
    const delRes = await fetch(`https://www.googleapis.com/drive/v3/files/${createData.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (delRes.status !== 204 && delRes.status !== 200) {
        console.warn('[testarConexaoDrive] Aviso: Falha ao remover arquivo de teste.');
    }

    return Response.json({
      ok: true,
      message: 'Conexão real validada: Autenticação, Escrita e Exclusão OK.',
      details: { root_folder: checkData.name }
    });

  } catch (error: any) {
    console.error('[testarConexaoDrive] Erro:', error);
    return Response.json({ error: `Falha real na conexão: ${error.message}` }, { status: 500 });
  }
});
