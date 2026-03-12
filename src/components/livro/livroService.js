import { base44 } from '@/api/base44Client';
import { mapLivroRegistrosPresenter } from '@/components/livro/livroRegistrosMapper';

export async function getLivroRegistrosContrato() {
  const [registros, militares, ferias, periodos] = await Promise.all([
    base44.entities.RegistroLivro.list('-created_date'),
    base44.entities.Militar.list(),
    base44.entities.Ferias.list(),
    base44.entities.PeriodoAquisitivo.list(),
  ]);

  return mapLivroRegistrosPresenter({
    registros,
    militares,
    ferias,
    periodos,
  });
}
