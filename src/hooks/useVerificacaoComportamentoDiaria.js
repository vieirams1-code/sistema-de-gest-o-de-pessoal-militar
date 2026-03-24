import { useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import {
  PRACAS,
  calcularComportamento,
  compararComportamentos,
} from '@/utils/calcularComportamento';

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
        const todosMilitares = await base44.entities.Militar.list();
        if (cancelled) return;

        const pracas = todosMilitares.filter((m) => PRACAS.has(m.posto_graduacao));
        const blocos = chunkArray(pracas, 10);

        for (const bloco of blocos) {
          if (cancelled) return;

          await Promise.all(bloco.map(async (militar) => {
            const punicoes = await base44.entities.Punicao.filter({ militar_id: militar.id });
            const calculado = calcularComportamento(punicoes, militar.posto_graduacao, new Date(), {
              incluirReabilitadas,
            });

            if (!calculado?.comportamento) return;

            const atual = militar.comportamento || 'Bom';
            const mudouParaMelhor = compararComportamentos(atual, calculado.comportamento) > 0;

            if (!mudouParaMelhor) return;

            await base44.entities.Militar.update(militar.id, {
              comportamento: calculado.comportamento,
            });

            await base44.entities.HistoricoComportamento.create({
              militar_id: militar.id,
              comportamento_anterior: atual,
              comportamento_novo: calculado.comportamento,
              fundamento_legal: calculado.fundamento,
              motivo: 'Melhoria automática por decurso de tempo',
              data_alteracao: today,
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
