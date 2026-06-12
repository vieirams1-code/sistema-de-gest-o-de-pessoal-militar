import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * gerirAcervoHistorico
 *
 * Função para gerenciar documentos históricos integrados ao Google Drive via Service Account Real.
 */

// Helpers para Google Drive API v3
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

  const pem = credentials.private_key;
  const binaryDer = str2ab(atob(pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\n/g, '')));
  const key = await crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(signatureInput)
  );

  const encodedSignature = ab2base64url(signature);
  const jwt = `${signatureInput}.${encodedSignature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const data = await res.json();
  if (data.error) throw new Error(`Auth Error: ${data.error_description || data.error}`);
  return data.access_token;
}

function str2ab(str: string) {
  const buf = new ArrayBuffer(str.length);
  const bufView = new Uint8Array(buf);
  for (let i = 0, strLen = str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
}

function ab2base64url(buf: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

async function findOrCreateFolder(token: string, name: string, parentId: string) {
  const query = `name = '${name}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const listRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const listData = await listRes.json();

  if (listData.files && listData.files.length > 0) {
    return listData.files[0].id;
  }

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId]
    })
  });
  const createData = await createRes.json();
  if (createData.error) throw new Error(`Folder Create Error: ${createData.error.message}`);
  return createData.id;
}

async function uploadFile(token: string, name: string, folderId: string, mimeType: string, contentBase64: string) {
  const metadata = {
    name,
    parents: [folderId]
  };

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const body =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${mimeType}\r\n` +
    'Content-Transfer-Encoding: base64\r\n\r\n' +
    contentBase64 +
    closeDelimiter;

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body
  });

  const data = await res.json();
  if (data.error) throw new Error(`Upload Error: ${data.error.message}`);
  return { id: data.id, url: data.webViewLink };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const authUser = await base44.auth.me();
    if (!authUser) return Response.json({ error: 'Não autenticado.' }, { status: 401 });

    const payload = await req.json().catch(() => ({}));
    const { militar_id, tipo_documento, data, file } = payload;

    if (!militar_id || !tipo_documento || !data || !file) {
      return Response.json({ error: 'Parâmetros insuficientes.' }, { status: 400 });
    }

    // 0. Calcular Hash e Tamanho (SHA-256)
    const binaryString = atob(file.content);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
    const arquivo_sha256 = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    const arquivo_tamanho = bytes.byteLength;

    // 1. Detectar Duplicidade
    const duplicados = await base44.asServiceRole.entities.AcervoFuncionalHistorico.filter({
      militar_id,
      arquivo_sha256,
      ativo: true
    });

    if (duplicados.length > 0 && !data.confirmar_duplicidade) {
      return Response.json({ error: 'DUPLICIDADE_DETECTADA', documento: duplicados[0] }, { status: 409 });
    }

    // 2. Localizar militar e repositórios
    const militar = await base44.asServiceRole.entities.Militar.get(militar_id);
    if (!militar) return Response.json({ error: 'Militar não encontrado.' }, { status: 404 });

    const repositorios = await base44.asServiceRole.entities.RepositorioDocumental.filter({
      ativo: true,
      status: 'ATIVO'
    }, 'ordem_prioridade');

    if (!repositorios || repositorios.length === 0) {
      return Response.json({ error: 'Nenhum repositório documental ativo configurado.' }, { status: 503 });
    }

    const driveCredentialsStr = Deno.env.get('GOOGLE_DRIVE_CREDENTIALS');
    if (!driveCredentialsStr) {
      return Response.json({ error: 'GOOGLE_DRIVE_CREDENTIALS não configurado no servidor.' }, { status: 500 });
    }
    const credentials = JSON.parse(driveCredentialsStr);

    // 3. Gerenciar Versionamento
    let versao = 1;
    const substitui_documento_id = data.substitui_documento_id || null;
    if (substitui_documento_id) {
      const docAnterior = await base44.asServiceRole.entities.AcervoFuncionalHistorico.get(substitui_documento_id);
      if (docAnterior) {
        versao = (Number(docAnterior.versao) || 1) + 1;
      }
    }

    // 4. Integração REAL com Google Drive
    let drive_file_id, drive_folder_id, drive_url, repoSelecionado;
    let sucessoDrive = false;
    let erroUltimaTentativa = '';

    const SUBPASTAS: Record<string, string> = {
      'ALTERACAO': 'Alterações',
      'CERTIDAO_COMPORTAMENTO': 'Certidões de Comportamento',
      'DIVERSOS': 'Diversos'
    };

    for (const repo of repositorios) {
      try {
        repoSelecionado = repo;
        const accessToken = await getAccessToken(credentials);

        // Root -> Militar (Matrícula)
        const folderMilitarId = await findOrCreateFolder(accessToken, militar.matricula, repo.drive_root_folder_id);

        // Militar -> Tipo (Subpasta)
        const subpastaNome = SUBPASTAS[tipo_documento] || 'Diversos';
        drive_folder_id = await findOrCreateFolder(accessToken, subpastaNome, folderMilitarId);

        // Upload
        const uploadResult = await uploadFile(accessToken, file.name, drive_folder_id, file.type, file.content);

        drive_file_id = uploadResult.id;
        drive_url = uploadResult.url;
        sucessoDrive = true;
        break;
      } catch (err: any) {
        erroUltimaTentativa = err.message;
        console.error(`[gerirAcervoHistorico] Falha no repositório ${repo.nome}:`, err);
        if (err.message.includes('quota') || err.message.includes('full')) {
          await base44.asServiceRole.entities.RepositorioDocumental.update(repo.id, { status: 'CHEIO' });
        }
      }
    }

    if (!sucessoDrive) {
      return Response.json({ error: `Falha na integração real com Google Drive: ${erroUltimaTentativa}` }, { status: 500 });
    }

    // 5. Salvar registro no Base44
    try {
      const { confirmar_duplicidade, substituir_existente, ...dataToSave } = data;

      const registroAcervo = await base44.asServiceRole.entities.AcervoFuncionalHistorico.create({
        ...dataToSave,
        militar_id,
        tipo_documento,
        repositorio_id: repoSelecionado.id,
        drive_file_id,
        drive_folder_id,
        drive_url,
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

    } catch (error: any) {
      console.error('[gerirAcervoHistorico] Erro ao salvar registro:', error);
      return Response.json({ error: 'Erro ao persistir metadados no sistema.', details: error.message }, { status: 500 });
    }

  } catch (error: any) {
    console.error('[gerirAcervoHistorico] Erro Fatal:', error);
    return Response.json({ error: error.message || 'Erro interno.' }, { status: 500 });
  }
});
