import { useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import {
  PRACAS,
  calcularComportamento,
  compararComportamentos,
} from '@/utils/calcularComportamento';
import { getPunicaoEntity } from '@/services/justicaDisciplinaService';

const LAST_RUN_KEY = 'sgp_militar_comportamento_last_run';

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function chunkArray(items = [], chunkSize = 20) {
  const chunks = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

export default function useVerificacaoComportamentoDiaria({ incluirReabilitadas = false, enabled = true } = {}) {
  useEffect(() => {
    if (!enabled) return;

    const today = hojeISO();
    const lastRun = localStorage.getItem(LAST_RUN_KEY);
    if (lastRun === today) return;

    let cancelled = false;

    const run = async () => {
      try {
        const punicaoEntity = getPunicaoEntity();
        const todosMilitares = await base44.entities.Militar.list();
        if (cancelled) return;

        const pracas = todosMilitares.filter((m) => PRACAS.has(m.posto_graduacao));
        const blocos = chunkArray(pracas, 10);

        for (const bloco of blocos) {
          if (cancelled) return;

          await Promise.all(bloco.map(async (militar) => {
            const punicoes = await punicaoEntity.filter({ militar_id: militar.id });
            const calculado = calcularComportamento(punicoes, militar.posto_graduacao, new Date(), {
              incluirReabilitadas,
              dataInclusaoMilitar: militar.data_inclusao,
            });

            if (!calculado?.comportamento) return;

            const atual = militar.comportamento || 'Bom';
            const mudouParaMelhor = compararComportamentos(atual, calculado.comportamento) > 0;

            if (!mudouParaMelhor) return;

            const pendencias = await base44.entities.PendenciaComportamento.filter({
              militar_id: militar.id,
              status_pendencia: 'Pendente',
            });
            const jaExiste = pendencias.some((p) => p.comportamento_sugerido === calculado.comportamento);
            if (jaExiste) return;

            await base44.entities.PendenciaComportamento.create({
              militar_id: militar.id,
              militar_nome: militar.nome_completo,
              comportamento_atual: atual,
              comportamento_sugerido: calculado.comportamento,
              fundamento_legal: calculado.fundamento,
              detalhes_calculo: JSON.stringify(calculado.detalhes || {}),
              data_detectada: today,
              status_pendencia: 'Pendente',
              confirmado_por: null,
              data_confirmacao: null,
            });
          }));
        }

        localStorage.setItem(LAST_RUN_KEY, today);
      } catch (error) {
        console.error('[comportamento-diario] Erro na verificação diária:', error);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [enabled, incluirReabilitadas]);
}
