import * as fflate from 'fflate';
import * as XLSX from 'xlsx';

/**
 * Sanitiza texto para uso seguro em nomes de arquivos do Windows/Linux/Mac
 */
function sanitizarNomeArquivo(texto) {
  return String(texto || '')
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Obtém a extensão de um arquivo ou URL
 */
function obterExtensao(nomeOuUrl) {
  if (!nomeOuUrl) return 'pdf';
  try {
    const urlSemQuery = nomeOuUrl.split('?')[0];
    const partes = urlSemQuery.split('.');
    if (partes.length > 1) {
      const ext = partes[partes.length - 1].toLowerCase();
      if (ext.length <= 5) return ext;
    }
  } catch (_e) {}
  return 'pdf';
}

/**
 * Realiza o download em lote de todos os anexos de uma campanha, renomeando cada arquivo
 * no padrão militar institucional: [MATRÍCULA] POSTO/GRAD NOME - NOME_DO_CAMPO.ext
 *
 * @param {Object} campanha - Dados da campanha
 * @param {Array} militares - Lista nominal de militares com suas respostas completas
 * @param {Function} onProgress - Callback (atual, total, statusTexto)
 */
export async function baixarAnexosCampanhaZip(campanha, militares, onProgress = () => {}) {
  if (!campanha || !Array.isArray(militares) || militares.length === 0) {
    throw new Error('Não há militares com dados para download de anexos.');
  }

  // Identificar quais arquivos precisam ser baixados
  const arquivosParaBaixar = [];

  let formCampos = [];
  if (campanha.config_formulario) {
    try {
      const parsed = typeof campanha.config_formulario === 'string'
        ? JSON.parse(campanha.config_formulario)
        : campanha.config_formulario;
      formCampos = parsed?.campos || [];
    } catch (_e) {}
  }

  const camposUpload = formCampos.filter((c) => c.tipo === 'upload_arquivo');

  militares.forEach((m) => {
    if (m.status_resposta !== 'Respondido' || !m.resposta_completa) return;
    const resp = m.resposta_completa;

    const matricula = m.militar_matricula || 'SEM_MATRICULA';
    const posto = m.militar_posto ? `${m.militar_posto} ` : '';
    const nome = m.militar_nome || 'MILITAR';
    const prefixoMilitar = `[${matricula}] ${posto}${nome}`.trim();

    // 1. Assinatura de Documentos / Devolução de Documento
    if (campanha.tipo === 'ASSINATURA_DOCUMENTO' && resp.arquivo_devolucao_url) {
      const ext = obterExtensao(resp.arquivo_devolucao_nome || resp.arquivo_devolucao_url);
      const docLabel = sanitizarNomeArquivo(campanha.titulo || 'Termo_Assinado');
      const nomeFinal = sanitizarNomeArquivo(`${prefixoMilitar} - ${docLabel}.${ext}`);

      arquivosParaBaixar.push({
        url: resp.arquivo_devolucao_url,
        nomeFormatado: nomeFinal,
        militarNome: `${posto}${nome}`,
      });
    }

    // 2. Formulário Dinâmico com Pergunta(s) de Upload
    if (campanha.tipo === 'FORMULARIO_DINAMICO') {
      let arquivosObj = {};
      if (resp.arquivos_anexados_json) {
        try {
          arquivosObj = typeof resp.arquivos_anexados_json === 'string'
            ? JSON.parse(resp.arquivos_anexados_json)
            : resp.arquivos_anexados_json;
        } catch (_e) {}
      }

      camposUpload.forEach((c) => {
        const item = arquivosObj[c.id];
        const url = typeof item === 'object' ? item?.url : item;
        const nomeOrig = typeof item === 'object' ? item?.nome || item?.nome_original : '';

        if (url) {
          const ext = obterExtensao(nomeOrig || url);
          const perguntaLabel = sanitizarNomeArquivo(c.pergunta || 'Anexo');
          const nomeFinal = sanitizarNomeArquivo(`${prefixoMilitar} - ${perguntaLabel}.${ext}`);

          arquivosParaBaixar.push({
            url,
            nomeFormatado: nomeFinal,
            militarNome: `${posto}${nome}`,
          });
        }
      });
    }
  });

  if (arquivosParaBaixar.length === 0) {
    throw new Error('Nenhum anexo foi encontrado nas respostas desta campanha.');
  }

  const total = arquivosParaBaixar.length;
  const zipFiles = {};
  const nomesUsados = new Set();

  onProgress(0, total, `Iniciando download de ${total} arquivo(s)...`);

  for (let i = 0; i < total; i++) {
    const item = arquivosParaBaixar[i];
    onProgress(i + 1, total, `Baixando (${i + 1}/${total}): ${item.militarNome}...`);

    try {
      const res = await fetch(item.url);
      if (!res.ok) {
        console.warn(`Falha ao baixar arquivo de ${item.url}: HTTP ${res.status}`);
        continue;
      }

      const buffer = await res.arrayBuffer();
      const uint8 = new Uint8Array(buffer);

      // Tratamento anti-colisão de nome
      let nomeFinal = item.nomeFormatado;
      let counter = 1;
      while (nomesUsados.has(nomeFinal)) {
        const partes = item.nomeFormatado.split('.');
        const ext = partes.pop();
        nomeFinal = `${partes.join('.')} (${counter}).${ext}`;
        counter++;
      }
      nomesUsados.add(nomeFinal);

      zipFiles[nomeFinal] = uint8;
    } catch (err) {
      console.error(`Erro ao processar anexo ${item.nomeFormatado}:`, err);
    }
  }

  onProgress(total, total, 'Compactando pacote ZIP institucional...');

  const zipped = fflate.zipSync(zipFiles, { level: 6 });
  const blob = new Blob([zipped], { type: 'application/zip' });
  const zipUrl = URL.createObjectURL(blob);

  const tituloLimpo = sanitizarNomeArquivo(campanha.titulo || 'CAMPANHA').replace(/\s+/g, '_');
  const a = document.createElement('a');
  a.href = zipUrl;
  a.download = `${tituloLimpo}_ANEXOS_NOMINAIS.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(zipUrl), 10000);

  return { totalBaixados: Object.keys(zipFiles).length, totalEsperados: total };
}

/**
 * Exporta a relação nominal e todas as respostas da campanha para arquivo Excel (.xlsx)
 */
export function exportarPlanilhaCampanhaExcel(campanha, militares) {
  if (!campanha || !Array.isArray(militares) || militares.length === 0) {
    throw new Error('Não há dados disponíveis para exportação.');
  }

  let formCampos = [];
  if (campanha.config_formulario) {
    try {
      const parsed = typeof campanha.config_formulario === 'string'
        ? JSON.parse(campanha.config_formulario)
        : campanha.config_formulario;
      formCampos = parsed?.campos || [];
    } catch (_e) {}
  }

  const excelRows = militares.map((m) => {
    const resp = m.resposta_completa || {};
    let respostasObj = {};
    let arquivosObj = {};
    if (resp.respostas_json) {
      try {
        respostasObj = typeof resp.respostas_json === 'string' ? JSON.parse(resp.respostas_json) : resp.respostas_json;
      } catch (_e) {}
    }
    if (resp.arquivos_anexados_json) {
      try {
        arquivosObj = typeof resp.arquivos_anexados_json === 'string' ? JSON.parse(resp.arquivos_anexados_json) : resp.arquivos_anexados_json;
      } catch (_e) {}
    }

    const row = {
      'Matrícula': m.militar_matricula || '',
      'Posto/Graduação': m.militar_posto || '',
      'Nome Completo': m.militar_nome || '',
      'Lotação': m.militar_lotacao || '',
      'Celular/Contato': m.militar_celular || '',
      'Status Resposta': m.status_resposta || 'Pendente',
      'Status Homologação': m.status_homologacao || (m.status_resposta === 'Respondido' ? 'Enviado' : 'Pendente'),
      'Data de Envio': m.data_resposta ? m.data_resposta.replace('T', ' ').slice(0, 16) : '-',
    };

    if (campanha.tipo === 'FORMULARIO_DINAMICO') {
      formCampos.forEach((c) => {
        if (c.tipo === 'upload_arquivo') {
          const anexo = arquivosObj[c.id];
          row[c.pergunta] = typeof anexo === 'object' ? (anexo?.url || '') : (anexo || '');
        } else {
          const val = respostasObj[c.id];
          row[c.pergunta] = Array.isArray(val) ? val.join(', ') : (val !== undefined && val !== null ? String(val) : '');
        }
      });
    } else if (campanha.tipo === 'ASSINATURA_DOCUMENTO') {
      row['Arquivo Devolvido (URL)'] = resp.arquivo_devolucao_url || '';
      row['Nome Original Arquivo'] = resp.arquivo_devolucao_nome || '';
      row['Termo de Aceite/Ciência'] = resp.termo_aceite ? 'Sim, concorda' : (resp.texto_termo_aceite ? 'Aceito' : '-');
    } else if (campanha.tipo === 'PLANO_FERIAS') {
      row['1ª Opção de Mês'] = resp.opcao_1_meses || m.detalhes_resposta || '';
      row['2ª Opção de Mês'] = resp.opcao_2_meses || '';
      row['3ª Opção de Mês'] = resp.opcao_3_meses || '';
      row['Parcelamento'] = resp.modo_parcelamento || '';
    } else {
      row['Detalhes'] = m.detalhes_resposta || '';
    }

    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(excelRows);
  const workbook = XLSX.utils.book_new();
  const sheetName = (campanha.titulo || 'Respostas').slice(0, 30).replace(/[:\/\\?*\[\]]/g, '_');
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  const tituloLimpo = sanitizarNomeArquivo(campanha.titulo || 'Campanha').replace(/\s+/g, '_');
  XLSX.writeFile(workbook, `relatorio_${tituloLimpo}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Exporta a relação nominal e respostas para arquivo CSV com UTF-8 BOM
 */
export function exportarPlanilhaCampanhaCsv(campanha, militares) {
  if (!campanha || !Array.isArray(militares) || militares.length === 0) {
    throw new Error('Não há dados disponíveis para exportação.');
  }

  let formCampos = [];
  if (campanha.config_formulario) {
    try {
      const parsed = typeof campanha.config_formulario === 'string'
        ? JSON.parse(campanha.config_formulario)
        : campanha.config_formulario;
      formCampos = parsed?.campos || [];
    } catch (_e) {}
  }

  let headers = ['Matrícula', 'Posto/Graduação', 'Nome Completo', 'Lotação', 'Celular', 'Status Resposta', 'Data Resposta'];

  if (campanha.tipo === 'FORMULARIO_DINAMICO') {
    formCampos.forEach((c) => {
      headers.push(`"${(c.pergunta || '').replace(/"/g, '""')}"`);
    });
  } else if (campanha.tipo === 'ASSINATURA_DOCUMENTO') {
    headers.push('Arquivo Devolvido URL', 'Arquivo Devolvido Nome', 'Termo Ciência');
  } else if (campanha.tipo === 'PLANO_FERIAS') {
    headers.push('Opção 1', 'Opção 2', 'Opção 3', 'Parcelamento');
  } else {
    headers.push('Detalhes');
  }

  const rows = militares.map((m) => {
    const resp = m.resposta_completa || {};
    let respostasObj = {};
    let arquivosObj = {};
    if (resp.respostas_json) {
      try {
        respostasObj = typeof resp.respostas_json === 'string' ? JSON.parse(resp.respostas_json) : resp.respostas_json;
      } catch (_e) {}
    }
    if (resp.arquivos_anexados_json) {
      try {
        arquivosObj = typeof resp.arquivos_anexados_json === 'string' ? JSON.parse(resp.arquivos_anexados_json) : resp.arquivos_anexados_json;
      } catch (_e) {}
    }

    const row = [
      `"${m.militar_matricula || ''}"`,
      `"${m.militar_posto || ''}"`,
      `"${m.militar_nome || ''}"`,
      `"${m.militar_lotacao || ''}"`,
      `"${m.militar_celular || ''}"`,
      `"${m.status_resposta || 'Pendente'}"`,
      `"${m.data_resposta || ''}"`,
    ];

    if (campanha.tipo === 'FORMULARIO_DINAMICO') {
      formCampos.forEach((c) => {
        if (c.tipo === 'upload_arquivo') {
          const anexo = arquivosObj[c.id];
          row.push(`"${(typeof anexo === 'object' ? anexo?.url : anexo) || ''}"`);
        } else {
          const val = respostasObj[c.id];
          const strVal = Array.isArray(val) ? val.join(', ') : (val !== undefined && val !== null ? String(val) : '');
          row.push(`"${strVal.replace(/"/g, '""')}"`);
        }
      });
    } else if (campanha.tipo === 'ASSINATURA_DOCUMENTO') {
      row.push(
        `"${resp.arquivo_devolucao_url || ''}"`,
        `"${resp.arquivo_devolucao_nome || ''}"`,
        `"${resp.termo_aceite ? 'Sim' : 'Não'}"`
      );
    } else if (campanha.tipo === 'PLANO_FERIAS') {
      row.push(
        `"${resp.opcao_1_meses || m.detalhes_resposta || ''}"`,
        `"${resp.opcao_2_meses || ''}"`,
        `"${resp.opcao_3_meses || ''}"`,
        `"${resp.modo_parcelamento || ''}"`
      );
    } else {
      row.push(`"${m.detalhes_resposta || ''}"`);
    }

    return row.join(';');
  });

  const csvContent = '\uFEFF' + headers.join(';') + '\n' + rows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const tituloLimpo = sanitizarNomeArquivo(campanha.titulo || 'Campanha').replace(/\s+/g, '_');
  link.setAttribute('download', `relatorio_${tituloLimpo}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
