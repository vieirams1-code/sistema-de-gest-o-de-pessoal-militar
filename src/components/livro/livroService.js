import { base44 } from '@/api/base44Client';
import { mapLivroRegistrosPresenter } from '@/components/livro/livroRegistrosMapper';

export async function getLivroRegistrosContrato({ isAdmin = false, militarIds = [] } = {}) {
  if (!isAdmin && !militarIds.length) {
    return mapLivroRegistrosPresenter({ registros: [], militares: [], ferias: [], periodos: [] });
  }

  if (isAdmin) {
    const [registros, militares, ferias, periodos] = await Promise.all([
      base44.entities.RegistroLivro.list('-created_date'),
      base44.entities.Militar.list(),
      base44.entities.Ferias.list(),
      base44.entities.PeriodoAquisitivo.list(),
    ]);

    return mapLivroRegistrosPresenter({ registros, militares, ferias, periodos });
  }

  const [registrosByMilitar, militares, feriasByMilitar, periodosByMilitar] = await Promise.all([
    Promise.all(militarIds.map((militarId) => base44.entities.RegistroLivro.filter({ militar_id: militarId }, '-created_date'))),
    Promise.all(militarIds.map((militarId) => base44.entities.Militar.filter({ id: militarId }))),
    Promise.all(militarIds.map((militarId) => base44.entities.Ferias.filter({ militar_id: militarId }, '-data_inicio'))),
    Promise.all(militarIds.map((militarId) => base44.entities.PeriodoAquisitivo.filter({ militar_id: militarId }, '-inicio_aquisitivo'))),
  ]);

  return mapLivroRegistrosPresenter({
    registros: registrosByMilitar.flat(),
    militares: militares.flat(),
    ferias: feriasByMilitar.flat(),
    periodos: periodosByMilitar.flat(),
  });
}
