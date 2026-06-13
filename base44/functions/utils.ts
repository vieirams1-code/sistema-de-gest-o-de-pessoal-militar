import { Base44Client } from 'npm:@base44/sdk@0.8.25';

export interface UpdateMilitarResult {
  militar_id: string;
  matricula: string;
  success: boolean;
  updates: Array<{
    campo: string;
    anterior: string;
    esperado: string;
    apos_releitura: string;
    confirmado: boolean;
  }>;
  erro_api?: string;
}

/**
 * Atualiza o cadastro principal do Militar (Posto/Graduação e Quadro)
 * garantindo a sincronização de campos redundantes e confirmando a persistência.
 */
export async function atualizarCadastroMilitar(
  base44: Base44Client,
  militarId: string,
  dados: { posto_graduacao: string; quadro: string },
  contexto: { executado_por: string; origem: string; historico_id?: string }
): Promise<UpdateMilitarResult> {
  const Militar = base44.asServiceRole.entities.Militar;
  const AssistenteLog = base44.asServiceRole.entities.AssistenteLog;

  const militarAntes = await Militar.get(militarId);
  if (!militarAntes) {
    throw new Error(`Militar ${militarId} não encontrado para atualização.`);
  }

  const matricula = String(militarAntes.matricula || '');

  // Mapeamento de campos redundantes/alias identificados no sistema
  const camposPosto = ['posto_graduacao', 'posto_graduacao_atual', 'posto_grad', 'posto', 'graduacao'];
  const camposQuadro = ['quadro', 'quadro_atual', 'militar_quadro'];

  const payload: Record<string, string> = {};
  const comparativos: Array<{ campo: string; esperado: string; anterior: string }> = [];

  // Prepara payload apenas para campos que existem no registro ou são os canônicos
  for (const campo of camposPosto) {
    if (campo === 'posto_graduacao' || Object.prototype.hasOwnProperty.call(militarAntes, campo)) {
      payload[campo] = dados.posto_graduacao;
      comparativos.push({ campo, esperado: dados.posto_graduacao, anterior: String(militarAntes[campo] || '') });
    }
  }
  for (const campo of camposQuadro) {
    if (campo === 'quadro' || Object.prototype.hasOwnProperty.call(militarAntes, campo)) {
      payload[campo] = dados.quadro;
      comparativos.push({ campo, esperado: dados.quadro, anterior: String(militarAntes[campo] || '') });
    }
  }

  let erro_api: string | undefined;
  try {
    await Militar.update(militarId, payload);
  } catch (err: any) {
    erro_api = err.message || String(err);
  }

  // Re-leitura para confirmação real de persistência
  const militarDepois = await Militar.get(militarId);
  const results: UpdateMilitarResult['updates'] = [];

  for (const comp of comparativos) {
    const valorDepois = String(militarDepois?.[comp.campo] || '');
    results.push({
      campo: comp.campo,
      anterior: comp.anterior,
      esperado: comp.esperado,
      apos_releitura: valorDepois,
      confirmado: !erro_api && valorDepois === comp.esperado
    });
  }

  const success = !erro_api && results.every(r => r.confirmado);

  if (success) {
    await AssistenteLog.create({
      tipo: 'sincronizacao_promocao',
      acao: 'atualizar_militar_confirmado',
      descricao: `Atualização confirmada: ${militarAntes.posto_graduacao}/${militarAntes.quadro} -> ${dados.posto_graduacao}/${dados.quadro}`,
      metadata: {
        militar_id: militarId,
        matricula,
        nome: militarAntes.nome_completo,
        dados_anteriores: { posto: militarAntes.posto_graduacao, quadro: militarAntes.quadro },
        dados_novos: dados,
        historico_id: contexto.historico_id,
        executado_por: contexto.executado_por,
        origem: contexto.origem,
        campos_afetados: results.map(r => r.campo)
      }
    });
  }

  return {
    militar_id: militarId,
    matricula,
    success,
    updates: results,
    erro_api
  };
}
