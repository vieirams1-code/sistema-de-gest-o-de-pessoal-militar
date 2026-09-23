import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

// Militares com a tag COV ativa — usados para marcar os nomes na distribuição por mês.
export default function useMilitaresComCov() {
  const [estado, setEstado] = useState({ ids: new Set(), icone: 'COV' });

  useEffect(() => {
    let ativo = true;

    const carregar = async () => {
      try {
        const tags = await base44.entities.Tag.filter({ nome: 'COV' });
        const tag = (tags || [])[0];
        if (!tag?.id) return;

        const vinculos = [];
        for (let skip = 0; ; skip += 500) {
          const pagina = await base44.entities.MilitarTag.filter({ tag_id: tag.id, status: 'ativa' }, 'id', 500, skip);
          vinculos.push(...pagina);
          if (pagina.length < 500) break;
        }

        if (!ativo) return;
        setEstado({
          ids: new Set(vinculos.map((v) => String(v.militar_id || '')).filter(Boolean)),
          icone: tag.emoji || tag.icone || 'COV',
        });
      } catch (_err) {
        // A marcação é informativa: uma falha aqui não pode impedir a distribuição.
      }
    };

    carregar();
    return () => { ativo = false; };
  }, []);

  return estado;
}