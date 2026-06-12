import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * testarConexaoDrive
 *
 * Função para testar a conexão com o Google Drive de um repositório específico.
 */

// --- Google Drive Helpers (Simplified for testing) ---

function base64url(buf: ArrayBuffer): string {
  const binString = Array.from(new Uint8Array(buf), (byte) =>
    String.fromCharCode(byte),
  ).join("");
  return btoa(binString)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function getAccessToken(credentialsJson: string): Promise<string> {
  const credentials = JSON.parse(credentialsJson);
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: credentials.client_email,
    scope: "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.metadata.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const encodedHeader = base64url(new TextEncoder().encode(JSON.stringify(header)));
  const encodedPayload = base64url(new TextEncoder().encode(JSON.stringify(payload)));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const pemContents = credentials.private_key
    .replace(/\\n/g, "\n")
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");

  const binaryDerString = atob(pemContents);
  const binaryDer = new Uint8Array(binaryDerString.length);
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }

  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(dataToSign)
  );

  const jwt = `${dataToSign}.${base64url(signature)}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const data = await response.json();
  if (data.error) throw new Error(`Auth Error: ${data.error_description || data.error}`);
  return data.access_token;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const authUser = await base44.auth.me();
    if (!authUser) return Response.json({ error: 'Não autenticado.' }, { status: 401 });

    const payload = await req.json().catch(() => ({}));
    const { repositorio_id } = payload;

    if (!repositorio_id) {
      return Response.json({ error: 'ID do repositório não informado.' }, { status: 400 });
    }

    const repo = await base44.asServiceRole.entities.RepositorioDocumental.get(repositorio_id);
    if (!repo) return Response.json({ error: 'Repositório não encontrado.' }, { status: 404 });

    const driveCredentials = Deno.env.get('GOOGLE_DRIVE_CREDENTIALS');
    if (!driveCredentials) {
      return Response.json({ error: 'Secret GOOGLE_DRIVE_CREDENTIALS não configurado no ambiente.' }, { status: 500 });
    }

    try {
      const token = await getAccessToken(driveCredentials);

      // Testar acesso à pasta raiz
      const resp = await fetch(`https://www.googleapis.com/drive/v3/files/${repo.drive_root_folder_id}?fields=id,name,mimeType`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!resp.ok) {
        const errData = await resp.json();
        throw new Error(`Erro ao acessar Root Folder: ${errData.error?.message || resp.statusText}`);
      }

      const folderData = await resp.json();

      return Response.json({
        ok: true,
        message: 'Conexão estabelecida com sucesso!',
        details: {
          folder_name: folderData.name,
          folder_id: folderData.id,
          mime_type: folderData.mimeType
        }
      });

    } catch (err) {
      return Response.json({ error: `Falha na conexão: ${err.message}` }, { status: 500 });
    }

  } catch (error) {
    return Response.json({ error: error.message || 'Erro interno.' }, { status: 500 });
  }
});
