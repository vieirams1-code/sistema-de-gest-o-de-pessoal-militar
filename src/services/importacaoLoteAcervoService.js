import { base44 } from '@/api/base44Client';
import { unzipSync } from 'fflate';

/**
 * Converte Uint8Array para Base64 de forma segura para arquivos grandes.
 */
function uint8ArrayToBase64(bytes) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Calcula SHA-256 de um conteúdo em Base64.
 */
async function calcularHash(contentBase64) {
  const binaryString = atob(contentBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Parser de nomes de arquivos para identificação automática.
 * Aceita separadores (_, -, espaço) e nomes com acentos.
 */
export function parseFilename(filename) {
  const cleanName = filename.replace(/\.[^/.]+$/, ""); // Remove extensão
  const normalizedName = cleanName.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase();

  const parts = cleanName.split(/[_\-\s]+/);
  const normalizedParts = normalizedName.split(/[_\-\s]+/);

  const result = {
    matricula: null,
    tipo_documento: 'DIVERSOS',
    titulo: cleanName,
    periodo_inicial: null,
    periodo_final: null,
    comportamento_certificado: null,
    confianca: 'BAIXA',
    erros: []
  };

  if (parts.length >= 1) {
    // Busca a primeira parte que se assemelha a uma matrícula
    for (const p of parts) {
      const nums = p.replace(/\D/g, "");
      if (nums.length >= 4 && nums.length <= 10) {
        // Se for um ano sozinho (ex: 2012), só aceitamos se não houver outra opção melhor ou se for a primeira parte
        const isYear = /^(19|20)\d{2}$/.test(nums);
        // Prioriza partes que NÃO são anos, a menos que seja a única ou a primeira
        if (!isYear || p === parts[0]) {
          result.matricula = nums;
          if (!isYear) break; // Se achou algo que não é ano, para. Se for ano, continua procurando algo melhor.
        }
      }
    }
  }

  const tipos = {
    'ALTERACAO': ['alteracao', 'alteracoes', 'extrato'],
    'CERTIDAO_COMPORTAMENTO': ['certidao', 'certidões', 'certidoes', 'comportamento']
  };

  for (const [tipo, aliases] of Object.entries(tipos)) {
    if (aliases.some(alias => normalizedName.includes(alias.normalize('NFD').replace(/[\u0300-\u036f]/g, "")))) {
      result.tipo_documento = tipo;
      break;
    }
  }

  const periodoMatch = cleanName.match(/(\d{4})[_\-\s](\d{4})/);
  if (periodoMatch) {
    result.periodo_inicial = `${periodoMatch[1]}-01-01`;
    result.periodo_final = `${periodoMatch[2]}-12-31`;
  } else {
    const anoMatch = cleanName.match(/[_\-\s](\d{4})([_\-\s]|$)/);
    if (anoMatch) {
      result.periodo_inicial = `${anoMatch[1]}-01-01`;
      result.periodo_final = `${anoMatch[1]}-12-31`;
    }
  }

  const comportamentos = {
    'EXCEPCIONAL': ['excepcional'],
    'OTIMO': ['otimo', 'ótimo'],
    'BOM': ['bom'],
    'INSUFICIENTE': ['insuficiente'],
    'MAU': ['mau']
  };

  for (const [key, aliases] of Object.entries(comportamentos)) {
    if (aliases.some(alias => normalizedName.includes(alias.normalize('NFD').replace(/[\u0300-\u036f]/g, "")))) {
      result.comportamento_certificado = key;
      break;
    }
  }

  const temMatricula = !!result.matricula;
  const tipoIdentificado = normalizedParts.some(p =>
    Object.values(tipos).flat().includes(p) || p === 'diverso' || p === 'diversos'
  );

  if (temMatricula && tipoIdentificado) {
    if (result.tipo_documento === 'ALTERACAO' && result.periodo_final) {
      result.confianca = 'ALTA';
    } else if (result.tipo_documento === 'CERTIDAO_COMPORTAMENTO' && result.comportamento_certificado) {
      result.confianca = 'ALTA';
    } else if (result.tipo_documento === 'DIVERSOS') {
      result.confianca = 'MEDIA';
    }
  }

  return result;
}

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_BATCH_SIZE = 100 * 1024 * 1024; // 100MB

export async function processZip(file) {
  if (file.size > MAX_BATCH_SIZE) {
    throw new Error(`O arquivo ZIP excede o limite de ${MAX_BATCH_SIZE / 1024 / 1024}MB.`);
  }

  const buffer = await file.arrayBuffer();
  const unzipped = unzipSync(new Uint8Array(buffer));

  const files = [];
  for (const [path, content] of Object.entries(unzipped)) {
    if (path.endsWith('/') || !path.toLowerCase().endsWith('.pdf')) continue;

    const filename = path.split('/').pop();
    const folderStructure = path.split('/').slice(0, -1);

    const metadata = parseFilename(filename);

    if (metadata.confianca !== 'ALTA') {
      if (folderStructure.some(f => f.toLowerCase().includes('altera'))) metadata.tipo_documento = 'ALTERACAO';
      if (folderStructure.some(f => f.toLowerCase().includes('certid'))) metadata.tipo_documento = 'CERTIDAO_COMPORTAMENTO';
      if (folderStructure.some(f => f.toLowerCase().includes('diversos'))) metadata.tipo_documento = 'DIVERSOS';

      const lastFolder = folderStructure[folderStructure.length - 1];
      if (lastFolder && /^\d+$/.test(lastFolder) && !metadata.matricula) {
        metadata.matricula = lastFolder;
      }
    }

    if (content.length > MAX_FILE_SIZE) continue;

    // Não guardamos o Base64 em memória para o lote todo
    const hash = await calcularHash(uint8ArrayToBase64(content));

    files.push({
      path,
      filename,
      size: content.length,
      blob: new Blob([content], { type: 'application/pdf' }),
      hash,
      metadata
    });
  }

  return files;
}

export async function processMultipleFiles(filesList) {
  let totalSize = 0;
  const processedFiles = [];
  for (const file of filesList) {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`O arquivo ${file.name} excede o limite de ${MAX_FILE_SIZE / 1024 / 1024}MB.`);
    }
    totalSize += file.size;
    if (totalSize > MAX_BATCH_SIZE) {
      throw new Error(`O lote excede o limite total de ${MAX_BATCH_SIZE / 1024 / 1024}MB.`);
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) continue;

    const buffer = await file.arrayBuffer();
    const hash = await calcularHash(uint8ArrayToBase64(new Uint8Array(buffer)));

    processedFiles.push({
      filename: file.name,
      size: file.size,
      blob: file, // Referência ao File original
      hash,
      metadata: parseFilename(file.name)
    });
  }
  return processedFiles;
}

export async function vincularMilitares(processedFiles) {
  const vinculos = {};
  const militares = await base44.entities.Militar.list();

  militares.forEach(m => {
    const mNorm = m.matricula.replace(/\D/g, "");
    vinculos[mNorm] = { id: m.id, nome: m.nome_completo, matricula: m.matricula };
  });

  const acervoExistente = await base44.entities.AcervoFuncionalHistorico.list();

  return processedFiles.map(file => {
    const mMatch = vinculos[file.metadata.matricula];

    const duplicadoExato = acervoExistente.find(a => a.arquivo_sha256 === file.hash && a.militar_id === mMatch?.id);
    const duplicadoParcial = acervoExistente.find(a =>
      a.militar_id === mMatch?.id &&
      a.tipo_documento === file.metadata.tipo_documento &&
      (a.titulo === file.metadata.titulo || (a.periodo_inicial === file.metadata.periodo_inicial && a.periodo_final === file.metadata.periodo_final))
    );

    return {
      ...file,
      militar: mMatch || null,
      situacao: mMatch ? (duplicadoExato ? 'DUPLICADO_EXATO' : duplicadoParcial ? 'DUPLICADO_PARCIAL' : 'IDENTIFICADO') : 'MILITAR_NAO_ENCONTRADO',
      duplicado: duplicadoExato || duplicadoParcial || null
    };
  });
}

export async function executarImportacaoLote(importacaoId, files, options, onProgress) {
  const total = files.length;
  let processados = 0;
  const resultados = {
    importados: 0,
    ignorados: 0,
    duplicados: 0,
    falhas: 0,
    logs: []
  };

  for (const file of files) {
    try {
      if (!file.militar) {
        resultados.ignorados++;
        resultados.logs.push({ arquivo: file.filename, resultado: 'IGNORADO', mensagem: 'Militar não identificado' });
      } else if (file.situacao === 'DUPLICADO_EXATO') {
        resultados.duplicados++;
        resultados.logs.push({ arquivo: file.filename, militar_matricula: file.militar.matricula, militar_nome: file.militar.nome, tipo_documento: file.metadata.tipo_documento, titulo: file.metadata.titulo, resultado: 'DUPLICADO', mensagem: 'SHA-256 idêntico (Ignorado)', hash_sha256: file.hash });
      } else {
        try {
          const payloadData = {
            titulo: file.metadata.titulo,
            periodo_inicial: file.metadata.periodo_inicial,
            periodo_final: file.metadata.periodo_final,
            comportamento_certificado: file.metadata.comportamento_certificado,
            origem_documento_fisico: file.metadata.origem_documento_fisico || options.origem_documento_fisico,
            digitalizado_por: file.metadata.digitalizado_por || options.digitalizado_por,
            digitalizado_em: file.metadata.digitalizado_em || options.digitalizado_em || new Date().toISOString(),
            conferido_por: file.metadata.conferido_por || options.conferido_por,
            conferido_em: file.metadata.conferido_em || options.conferido_em,
            observacoes_conferencia: file.metadata.observacoes_conferencia || options.observacoes_conferencia,
            confianca_identificacao: file.metadata.confianca,
            importacao_id: importacaoId,
            validado: file.metadata.confianca === 'ALTA' && file.situacao !== 'DUPLICADO_PARCIAL'
          };

          if (file.situacao === 'DUPLICADO_PARCIAL') {
            payloadData.validado = false; // Força revisão
          }

          // Lê o arquivo somente no momento do upload
          const arrayBuffer = await file.blob.arrayBuffer();
          const base64 = uint8ArrayToBase64(new Uint8Array(arrayBuffer));

          const res = await base44.functions.invoke('gerirAcervoHistorico', {
            militar_id: file.militar.id,
            tipo_documento: file.metadata.tipo_documento,
            data: payloadData,
            file: {
              name: file.filename,
              content: base64
            }
          });

          const body = res?.data ?? res;
          if (body.ok) {
            resultados.importados++;
            resultados.logs.push({
              arquivo_original: file.filename,
              militar_matricula: file.militar.matricula,
              militar_nome: file.militar.nome,
              tipo_documento: file.metadata.tipo_documento,
              titulo: file.metadata.titulo,
              resultado: 'IMPORTADO',
              mensagem: 'Sucesso',
              drive_file_id: body.drive?.file_id,
              acervo_id: body.registro?.id,
              hash_sha256: file.hash,
              usuario_importacao: options.digitalizado_por,
              data_importacao: new Date().toISOString()
            });
          } else {
            throw new Error(body.error || 'Erro desconhecido');
          }
        } catch (err) {
          resultados.falhas++;
          resultados.logs.push({ arquivo_original: file.filename, militar_matricula: file.militar?.matricula, resultado: 'ERRO', mensagem: err.message, hash_sha256: file.hash });
        }
      }
    } catch (err) {
      resultados.falhas++;
      resultados.logs.push({ arquivo_original: file.filename, resultado: 'ERRO', mensagem: err.message });
    }

    processados++;
    const percentual = Math.round((processados / total) * 100);

    if (processados % 5 === 0 || processados === total) {
      await base44.entities.ImportacaoAcervo.update(importacaoId, {
        percentual,
        importados: resultados.importados,
        ignorados: resultados.ignorados,
        duplicados: resultados.duplicados,
        falhas: resultados.falhas
      });
    }

    if (onProgress) onProgress({ percentual, ...resultados });
  }

  const statusFinal = resultados.falhas > 0 ? 'CONCLUIDA_COM_RESSALVAS' : 'CONCLUIDA';
  await base44.entities.ImportacaoAcervo.update(importacaoId, {
    status: statusFinal,
    percentual: 100,
    relatorio_json: JSON.stringify(resultados.logs)
  });

  return { status: statusFinal, ...resultados, logs: resultados.logs };
}
