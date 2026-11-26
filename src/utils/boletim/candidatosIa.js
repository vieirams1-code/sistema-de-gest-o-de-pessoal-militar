/**
 * Empacotamento do efetivo enviado à análise assistida por IA.
 * Enviamos o efetivo ativo completo: o recorte por nota é feito no
 * backend, comparando o texto de cada item com os nomes cadastrados.
 * Filtrar aqui (por nome no documento inteiro) fazia militares citados
 * apenas em uma nota serem descartados antes da análise.
 * Função pura: não grava nada.
 */

export function empacotarCandidatos(militares = []) {
  return (militares || [])
    .filter(militar => militar?.id)
    .map(militar => ({
      id: String(militar.id),
      posto: militar.posto_graduacao || '',
      nome_guerra: militar.nome_guerra || '',
      nome_completo: militar.nome_completo || '',
      matricula: militar.matricula || '',
    }));
}