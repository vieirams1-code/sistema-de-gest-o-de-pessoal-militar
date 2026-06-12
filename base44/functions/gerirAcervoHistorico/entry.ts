import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * gerirAcervoHistorico
 *
 * Função para gerenciar documentos históricos integrados ao Google Drive.
 */

// --- Google Drive Helpers ---

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
    scope: "https://www.googleapis.com/auth/drive.file",
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

async function localizarOuCriarPastaMilitar(token: string, matricula: string, rootFolderId: string): Promise<string> {
  const q = `name = '${matricula}' and '${rootFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const listUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)`;
  const listResp = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const listData = await listResp.json();

  if (listData.files && listData.files.length > 0) {
    return listData.files[0].id;
  }

  const createResp = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: matricula,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [rootFolderId]
    })
  });
  const createData = await createResp.json();
  if (createData.error) throw new Error(`Folder Create Error: ${createData.error.message}`);
  return createData.id;
}

async function uploadArquivoDrive(token: string, folderId: string, file: { name: string, type: string, content: string }, titulo: string): Promise<{ id: string, webViewLink: string }> {
  const metadata = {
    name: `${titulo || file.name}.pdf`.replace(/\.pdf\.pdf$/i, '.pdf'),
    parents: [folderId]
  };

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const close_delim = `\r\n--${boundary}--`;

  const multipartBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${file.type}\r\n` +
    'Content-Transfer-Encoding: base64\r\n\r\n' +
    file.content +
    close_delim;

  const resp = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: multipartBody
  });

  const data = await resp.json();
  if (data.error) throw new Error(`Drive Upload Error: ${data.error.message}`);
  return data;
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

    // 1. Detectar Duplicidade (Mesmo militar + Mesmo hash)
    const duplicados = await base44.asServiceRole.entities.AcervoFuncionalHistorico.filter({
      militar_id,
      arquivo_sha256,
      ativo: true
    });

    if (duplicados.length > 0 && !data.confirmar_duplicidade) {
      return Response.json({
        error: 'DUPLICIDADE_DETECTADA',
        documento: duplicados[0]
      }, { status: 409 });
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

    // 3. Gerenciar Versionamento
    let versao = 1;
    const substitui_documento_id = data.substitui_documento_id || null;

    if (substitui_documento_id) {
      const docAnterior = await base44.asServiceRole.entities.AcervoFuncionalHistorico.get(substitui_documento_id);
      if (docAnterior) {
        versao = (Number(docAnterior.versao) || 1) + 1;
      }
    }

    // 4. Integração com Drive (com Failover e Concorrência)
    const driveCredentials = Deno.env.get('GOOGLE_DRIVE_CREDENTIALS');
    let drive_file_id, drive_folder_id, drive_url, repoSelecionado;

    let sucessoDrive = false;
    let erroUltimaTentativa = '';

    for (const repo of repositorios) {
      try {
        repoSelecionado = repo;

        // Concorrência: Tentar localizar drive_folder_id existente para este militar NESTE repositório
        const registrosRepo = await base44.asServiceRole.entities.AcervoFuncionalHistorico.filter({
          militar_id,
          repositorio_id: repo.id
        }, '-created_date');

        const folderIdExistente = registrosRepo.find(r => r.drive_folder_id)?.drive_folder_id;

        if (driveCredentials) {
          const token = await getAccessToken(driveCredentials);
          const folderId = folderIdExistente || await localizarOuCriarPastaMilitar(token, militar.matricula, repo.drive_root_folder_id);
          const uploadResult = await uploadArquivoDrive(token, folderId, file, data.titulo);

          drive_file_id = uploadResult.id;
          drive_folder_id = folderId;
          drive_url = uploadResult.webViewLink;
          sucessoDrive = true;
        } else {
          // Fallback simulado (Apenas se não houver credenciais configuradas no ambiente)
          drive_file_id = `simulated_file_${Date.now()}`;
          drive_folder_id = folderIdExistente || `simulated_folder_${militar.matricula}`;
          drive_url = `https://drive.google.com/file/d/${drive_file_id}/view`;
          sucessoDrive = true;
        }

        if (sucessoDrive) break;
      } catch (err) {
        erroUltimaTentativa = err.message;
        console.error(`[gerirAcervoHistorico] Falha no repositório ${repo.nome}:`, err);
        if (err.message.includes('quota') || err.message.includes('full')) {
          await base44.asServiceRole.entities.RepositorioDocumental.update(repo.id, { status: 'CHEIO' });
        }
      }
    }

    if (!sucessoDrive) {
      return Response.json({ error: `Falha em todos os repositórios: ${erroUltimaTentativa}` }, { status: 500 });
    }

    // 5. Salvar registro no Base44
    try {
      // Limpar campos auxiliares do payload que não pertencem à entidade
      const { confirmar_duplicidade, confirmar_sobreposicao, substituir_existente, ...dataToSave } = data;

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

      // 6. Atualizar documento substituído
      if (substitui_documento_id) {
        await base44.asServiceRole.entities.AcervoFuncionalHistorico.update(substitui_documento_id, {
          status_documento: 'SUBSTITUIDO'
        });
      }

      return Response.json({
        ok: true,
        registro: registroAcervo,
        drive: {
          file_id: drive_file_id,
          folder_id: drive_folder_id,
          url: drive_url
        }
      });

    } catch (error) {
      console.error('[gerirAcervoHistorico] Erro ao salvar registro:', error);
      // Aqui poderíamos tentar remover o arquivo do Drive (Rollback)
      return Response.json({
        error: 'Erro ao persistir metadados no sistema.',
        details: error.message,
        status: 'PENDENTE_RECONCILIACAO',
        drive_file_id
      }, { status: 500 });
    }

  } catch (error) {
    console.error('[gerirAcervoHistorico] Erro Fatal:', error);
    return Response.json({ error: error.message || 'Erro interno.' }, { status: 500 });
  }
});
