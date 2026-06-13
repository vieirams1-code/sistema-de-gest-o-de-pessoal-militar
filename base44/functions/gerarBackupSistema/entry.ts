import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { zipSync, strToU8 } from 'npm:fflate@0.8.3';

/**
 * gerarBackupSistema
 *
 * Gera um backup completo do SGP em formato ZIP.
 *
 * Payload:
 *   { incluir_arquivos?: boolean }   // default false → somente dados
 *
 * Retorna o ZIP como binário (Content-Type: application/zip).
 *
 * Estrutura do ZIP:
 *   manifesto.json
 *   dados/<Entidade>.json       (array de registros)
 *   arquivos/...                (apenas se incluir_arquivos = true)
 */

// Lista de entidades do sistema (definida estaticamente para garantir cobertura completa).
const ENTIDADES_BACKUP = [
  'Militar', 'UsuarioAcesso', 'PerfilPermissao', 'PerfilPermissaoSnapshot', 'UsuarioPermissaoSnapshot',
  'Ferias', 'PeriodoAquisitivo', 'CreditoExtraFerias', 'PlanoFerias', 'FeriasTag',
  'Atestado', 'AtestadoEncaminhamento', 'JISO', 'PublicacaoJISO', 'Medico',
  'Punicao', 'PunicaoDisciplinar', 'HistoricoComportamento', 'PendenciaComportamento',
  'Medalha', 'TipoMedalha', 'ImpedimentoMedalha',
  'Promocao', 'PromocaoMilitar', 'HistoricoPromocao', 'HistoricoPromocaoMilitar', 'HistoricoPromocaoMilitarV2',
  'AntiguidadeSnapshot', 'AntiguidadeItem', 'ConfiguracaoAntiguidade',
  'PublicacaoExOfficio', 'PublicacaoCompilada', 'RegistroLivro', 'TipoPublicacaoCustom', 'SubtipoDOEMS',
  'TemplateTexto', 'ClassificacaoHistoricaAlteracao',
  'Armamento', 'Funcao', 'FuncaoMilitar', 'MilitarFuncao',
  'GratificacaoFuncao', 'TipoGratificacaoFuncao', 'CotaGratificacaoFuncao',
  'ContratoTemporario', 'ContratoConvocacao', 'ContratoDesignacaoMilitar', 'EventoContratoTemporario',
  'TransicaoDesignacaoLote', 'TransicaoDesignacaoOperacao',
  'Tag', 'TagGrupo', 'MilitarTag', 'Lotacao', 'Subgrupamento',
  'QuadroOperacional', 'ColunaOperacional', 'CardOperacional', 'CardAcao', 'CardChecklistItem', 'CardComentario', 'CardVinculo',
  'Demanda', 'DemandaComentario', 'Tarefa',
  'Processo', 'ProcedimentoProcesso', 'ProcedimentoEnvolvido', 'ProcedimentoPendencia', 'ProcedimentoPrazoHistorico', 'ProcedimentoViatura', 'BaseConhecimentoProcedimento',
  'AcervoFuncionalHistorico', 'AuditAcervoLog', 'ImportacaoAcervo',
  'ImportacaoMilitares', 'ImportacaoAlteracoesLegado', 'PossivelDuplicidadeMilitar',
  'MatriculaMilitar', 'Familiar', 'CursoMilitar',
  'ConfiguracaoUnidade', 'PrazoAlerta', 'AssistenteLog',
  'SolicitacaoAtualizacao', 'ResetOperacionalLog', 'MergeMilitarLog', 'ExtracaoEfetivoExportLog',
];

const MAX_FILE_DOWNLOAD_BYTES = 100 * 1024 * 1024; // 100 MB por arquivo
const FILE_FIELDS = ['arquivo_url', 'foto', 'arquivo_atestado', 'arquivo_ata_jiso', 'foto_url'];

function safeFileName(name, fallback) {
  const clean = String(name || fallback).replace(/[\/\\?%*:|"<>]/g, '_').slice(0, 120);
  return clean || fallback;
}

async function fetchAllEntityRecords(base44, entityName) {
  const PAGE = 500;
  let all = [];
  let skip = 0;
  while (true) {
    const batch = await base44.asServiceRole.entities[entityName].list('-created_date', PAGE, skip);
    if (!batch || batch.length === 0) break;
    all = all.concat(batch);
    if (batch.length < PAGE) break;
    skip += PAGE;
  }
  return all;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Acesso restrito a administradores.' }, { status: 403 });
    }

    const payload = await req.json().catch(() => ({}));
    const incluirArquivos = Boolean(payload?.incluir_arquivos);

    const zipEntries = {};
    const manifesto = {
      gerado_em: new Date().toISOString(),
      gerado_por: user.email,
      versao_backup: '1.0',
      incluir_arquivos: incluirArquivos,
      entidades: {},
      totais: { entidades: 0, registros: 0, arquivos: 0, arquivos_falhos: 0 },
      erros: [],
    };

    // 1. Exporta cada entidade
    for (const entidade of ENTIDADES_BACKUP) {
      try {
        if (!base44.asServiceRole.entities[entidade]) {
          manifesto.erros.push(`Entidade ${entidade} não disponível.`);
          continue;
        }
        const registros = await fetchAllEntityRecords(base44, entidade);
        const json = JSON.stringify(registros, null, 2);
        zipEntries[`dados/${entidade}.json`] = strToU8(json);
        manifesto.entidades[entidade] = registros.length;
        manifesto.totais.registros += registros.length;
        manifesto.totais.entidades += 1;
      } catch (err) {
        manifesto.erros.push(`Falha ao exportar ${entidade}: ${err.message}`);
      }
    }

    // 2. Opcional: baixar arquivos físicos
    if (incluirArquivos) {
      const arquivosBaixados = new Set();
      for (const entidade of Object.keys(manifesto.entidades)) {
        const arr = zipEntries[`dados/${entidade}.json`];
        if (!arr) continue;
        const registros = JSON.parse(new TextDecoder().decode(arr));
        for (const reg of registros) {
          for (const campo of FILE_FIELDS) {
            const url = reg?.[campo];
            if (!url || typeof url !== 'string' || !url.startsWith('http')) continue;
            const key = `${entidade}::${reg.id}::${campo}`;
            if (arquivosBaixados.has(url)) continue;
            arquivosBaixados.add(url);
            try {
              const res = await fetch(url);
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              const len = Number(res.headers.get('content-length') || 0);
              if (len > MAX_FILE_DOWNLOAD_BYTES) {
                manifesto.erros.push(`Arquivo ignorado (>${MAX_FILE_DOWNLOAD_BYTES}b): ${key}`);
                manifesto.totais.arquivos_falhos += 1;
                continue;
              }
              const buf = new Uint8Array(await res.arrayBuffer());
              const ext = (url.split('?')[0].split('.').pop() || 'bin').slice(0, 8);
              const fname = safeFileName(`${reg.id}_${campo}.${ext}`, `${campo}.bin`);
              zipEntries[`arquivos/${entidade}/${fname}`] = buf;
              manifesto.totais.arquivos += 1;
            } catch (err) {
              manifesto.erros.push(`Falha ao baixar ${key}: ${err.message}`);
              manifesto.totais.arquivos_falhos += 1;
            }
          }
        }
      }
    }

    // 3. Manifesto e geração do ZIP
    zipEntries['manifesto.json'] = strToU8(JSON.stringify(manifesto, null, 2));
    const zipped = zipSync(zipEntries, { level: 6 });

    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `sgp-backup-${stamp}${incluirArquivos ? '-completo' : '-dados'}.zip`;

    return new Response(zipped, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('[gerarBackupSistema] Erro:', error);
    return Response.json({ error: error.message || 'Erro interno.' }, { status: 500 });
  }
});