import { base44 } from '@/api/base44Client';
import { mapLivroRegistrosPresenter } from '@/components/livro/livroRegistrosMapper';

/**
 * Carrega todos os registros do livro para montar a visão de publicações.
 *
 * NOTA DE SEGURANÇA: Esta função é chamada somente quando o módulo 'publicacoes'
 * está autorizado (enabled: isAccessResolved && hasPublicacoesAccess em Publicacoes.jsx).
 * A filtragem por escopo organizacional ocorre no nível do chamador (queries de
 * publicacoesExOfficio e atestados em Publicacoes.jsx). RegistroLivro não possui
 * campo de escopo padronizado, portanto a consulta ampla é necessária aqui — o
 * acesso já foi validado pela camada de módulo antes de invocar esta função.
 */
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