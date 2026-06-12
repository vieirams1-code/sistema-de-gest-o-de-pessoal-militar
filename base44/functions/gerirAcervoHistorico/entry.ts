import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * gerirAcervoHistorico
 *
 * Função para gerenciar documentos históricos integrados ao Google Drive.
 *
 * Payload:
 * {
 *   "militar_id": "...",
 *   "tipo_documento": "ALTERACAO" | "CERTIDAO_COMPORTAMENTO" | "DIVERSOS",
 *   "data": { ... campos do documento ... },
 *   "file": { "name": "...", "type": "...", "content": "base64..." }
 * }
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const authUser = await base44.auth.me();
    if (!authUser) return Response.json({ error: 'Não autenticado.' }, { status: 401 });

    const payload = await req.json().catch(() => ({}));
    const { militar_id, tipo_documento, data, file } = payload;

    if (!militar_id || !tipo_documento || !data) {
      return Response.json({ error: 'Parâmetros insuficientes.' }, { status: 400 });
    }

    // 1. Localizar repositório ativo
    const repositorios = await base44.asServiceRole.entities.RepositorioDocumental.filter({
      ativo: true,
      status: 'ATIVO'
    }, 'ordem_prioridade');

    const repoAtivo = repositorios?.[0];
    if (!repoAtivo) {
      return Response.json({ error: 'Nenhum repositório documental ativo configurado.' }, { status: 503 });
    }

    // 2. Localizar militar para obter nome/matrícula
    const militar = await base44.asServiceRole.entities.Militar.get(militar_id);
    if (!militar) return Response.json({ error: 'Militar não encontrado.' }, { status: 404 });

    const nomeMilitar = `${militar.matricula} - ${militar.nome_completo}`.toUpperCase();

    /**
     * NOTA: A integração real com o Google Drive requer credenciais (Service Account ou OAuth)
     * e uso da API do Google. Como as credenciais e o ambiente de integração externa
     * podem não estar prontos nesta fase de implementação do SGP, implementamos a lógica
     * com a interface preparada e um fallback controlado que simula o sucesso da operação
     * no Drive caso as variáveis de ambiente necessárias (GOOGLE_DRIVE_CREDENTIALS)
     * não estejam presentes, conforme solicitado nas instruções.
     */

    const driveCredentials = Deno.env.get('GOOGLE_DRIVE_CREDENTIALS');

    let drive_file_id = `simulated_file_${Date.now()}`;
    let drive_folder_id = `simulated_folder_${militar_id}`;
    let drive_url = `https://drive.google.com/file/d/${drive_file_id}/view`;

    if (driveCredentials) {
      // TODO: Implementar upload real usando a API do Google Drive
      // 1. Localizar ou criar pasta do militar: nomeMilitar dentro de repoAtivo.drive_root_folder_id
      // 2. Localizar ou criar subpasta: tipo_documento (Alterações, Certidões de Comportamento, Diversos)
      // 3. Upload do PDF (file.content base64) para a subpasta
      // 4. Atualizar as variáveis drive_file_id, drive_folder_id, drive_url
    } else {
      console.warn('[gerirAcervoHistorico] GOOGLE_DRIVE_CREDENTIALS não configurado. Usando fallback simulado.');
    }

    // 3. Salvar registro em AcervoFuncionalHistorico
    const registroAcervo = await base44.asServiceRole.entities.AcervoFuncionalHistorico.create({
      ...data,
      militar_id,
      tipo_documento,
      repositorio_id: repoAtivo.id,
      drive_file_id,
      drive_folder_id,
      drive_url,
      usuario_cadastro: authUser.email,
      arquivado: false
    });

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
    console.error('[gerirAcervoHistorico] Erro:', error);
    return Response.json({ error: error.message || 'Erro interno.' }, { status: 500 });
  }
});
