import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * gerirAcervoHistorico
 *
 * Função para gerenciar documentos históricos integrados ao Google Drive.
 */

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
          // TODO: Implementar lógica real com API do Google Drive
          // const folderId = folderIdExistente || await criarPastaMilitar(militar.matricula, repo.drive_root_folder_id);
          // drive_file_id = await uploadParaSubpasta(file, folderId, tipo_documento);
          // drive_folder_id = folderId;
          // drive_url = `...`;
          sucessoDrive = true;
        } else {
          // Fallback simulado
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
      const { confirmar_duplicidade, ...dataToSave } = data;

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
